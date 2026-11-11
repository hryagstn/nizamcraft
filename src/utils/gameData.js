// Shared pure game data, physics AABB helpers, Minecraft crafting grid engine, and enchantment/anvil rules

const STATE_SUFFIX_RE = /_(source|[1-4]|on|pressed|extended)$/;

export function normalizeBlockType(type) {
    if (!type || typeof type !== 'string') return '';
    return type.replace(STATE_SUFFIX_RE, '');
}

export const PASSABLE_BLOCKS = new Set([
    'water',
    'lava',
    'crop',
    'rail',
    'pressure_plate',
    'button',
    'lever'
]);

export function isSolidBlock(type) {
    if (!type) return false;
    return !PASSABLE_BLOCKS.has(normalizeBlockType(type));
}

export const HOSTILE_MOBS = new Set([
    'zombie',
    'skeleton',
    'creeper',
    'bloodgolem',
    'witherskeleton'
]);

/**
 * Checks AABB collision against solid blocks centered on integer coordinates [bx - 0.5, bx + 0.5].
 * When yFromCenter is false, y is feet position [y, y + height].
 * When yFromCenter is true, y is center position [y - height/2, y + height/2].
 * preferTop controls vertical scan order so landing snaps to highest floor block.
 */
export function checkGridAABB(getBlockAt, x, y, z, radius, height, yFromCenter = false, preferTop = true) {
    const minYVal = yFromCenter ? y - height / 2 : y;
    const maxYVal = yFromCenter ? y + height / 2 : y + height;

    const minBX = Math.floor(x - radius + 0.5);
    const maxBX = Math.ceil(x + radius - 0.5);
    const minBY = Math.floor(minYVal + 0.5);
    const maxBY = Math.ceil(maxYVal - 0.5);
    const minBZ = Math.floor(z - radius + 0.5);
    const maxBZ = Math.ceil(z + radius - 0.5);

    const startY = preferTop ? maxBY : minBY;
    const endY = preferTop ? minBY : maxBY;
    const stepY = preferTop ? -1 : 1;

    for (let by = startY; preferTop ? by >= endY : by <= endY; by += stepY) {
        for (let bx = minBX; bx <= maxBX; bx++) {
            for (let bz = minBZ; bz <= maxBZ; bz++) {
                const blockType = getBlockAt(bx, by, bz);
                if (!isSolidBlock(blockType)) continue;

                const overlapX = (x + radius > bx - 0.5) && (x - radius < bx + 0.5);
                const overlapY = (maxYVal > by - 0.5) && (minYVal < by + 0.5);
                const overlapZ = (z + radius > bz - 0.5) && (z - radius < bz + 0.5);

                if (overlapX && overlapY && overlapZ) {
                    return { x: bx, y: by, z: bz, type: blockType };
                }
            }
        }
    }
    return null;
}

export function entityOverlapsBlock(px, py, pz, radius, height, bx, by, bz) {
    return (
        px + radius > bx - 0.5 &&
        px - radius < bx + 0.5 &&
        py + height > by - 0.5 &&
        py < by + 0.5 &&
        pz + radius > bz - 0.5 &&
        pz - radius < bz + 0.5
    );
}

/**
 * Cumulative underground block roll so gold_ore, iron_ore, coal_ore, lapis_ore, and obsidian spawn naturally.
 */
export function rollUndergroundBlock(oreRand, y = 5, obsidianRand = 1) {
    if (y <= 1 && obsidianRand < 0.15) return 'obsidian';
    if (oreRand < 0.015) return 'gold_ore';
    if (oreRand < 0.045) return 'iron_ore';
    if (oreRand < 0.095) return 'coal_ore';
    if (oreRand < 0.12) return 'lapis_ore';
    return 'stone';
}

export function getEquipmentCategory(type) {
    if (!type) return null;
    if (type.startsWith('sword_')) return 'sword';
    if (type.startsWith('pickaxe_')) return 'pickaxe';
    if (type === 'bow') return 'bow';
    if (
        type.startsWith('helmet_') ||
        type.startsWith('chestplate_') ||
        type.startsWith('leggings_') ||
        type.startsWith('boots_')
    ) {
        return 'armor';
    }
    return null;
}

export function getArmorSlotName(type) {
    if (!type) return null;
    if (type.startsWith('helmet_')) return 'helmet';
    if (type.startsWith('chestplate_')) return 'chestplate';
    if (type.startsWith('leggings_')) return 'leggings';
    if (type.startsWith('boots_')) return 'boots';
    return null;
}

export function getItemEnchants(item) {
    if (!item || typeof item !== 'object') return {};
    if (item.enchants && Object.keys(item.enchants).length > 0) {
        return { ...item.enchants };
    }
    if (item.type === 'enchanted_book' && item.enchant?.id) {
        return { [item.enchant.id]: item.enchant.level || 1 };
    }
    return {};
}

export function setItemEnchants(item, enchantsMap) {
    if (!item) return;
    const entries = Object.entries(enchantsMap || {}).filter(([, lvl]) => lvl > 0);
    if (entries.length === 0) {
        delete item.enchants;
        delete item.enchant;
        return;
    }
    item.enchants = Object.fromEntries(entries);
    if (item.type === 'enchanted_book') {
        item.enchant = { id: entries[0][0], level: entries[0][1] };
    }
}

export function isStackableItem(itemOrType) {
    if (!itemOrType) return true;
    const type = typeof itemOrType === 'string' ? itemOrType : itemOrType.type;
    if (!type) return true;
    if (type === 'enchanted_book') return false;
    if (getEquipmentCategory(type) !== null) return false;
    if (typeof itemOrType === 'object' && Object.keys(getItemEnchants(itemOrType)).length > 0) {
        return false;
    }
    return true;
}

export function cloneItem(item) {
    if (!item) return null;
    const copy = { type: item.type, count: item.count };
    if (item.enchant) copy.enchant = { ...item.enchant };
    if (item.enchants) copy.enchants = { ...item.enchants };
    if (item.anvilUses) copy.anvilUses = item.anvilUses;
    return copy;
}

/**
 * Inserts an item into a slot array respecting stackability (max 64 for stackable, 1 for gear/enchanted books).
 * Returns the number of items that could NOT fit (0 means all fitted).
 */
export function insertItemIntoSlots(slots, itemToInsert) {
    if (!slots || !itemToInsert || itemToInsert.count <= 0) return 0;
    const stackable = isStackableItem(itemToInsert);
    let remaining = itemToInsert.count;

    if (stackable) {
        for (let i = 0; i < slots.length && remaining > 0; i++) {
            const slot = slots[i];
            if (slot && slot.type === itemToInsert.type && isStackableItem(slot) && slot.count < 64) {
                const add = Math.min(remaining, 64 - slot.count);
                slot.count += add;
                remaining -= add;
            }
        }
    }

    for (let i = 0; i < slots.length && remaining > 0; i++) {
        if (slots[i] === null) {
            const add = stackable ? Math.min(remaining, 64) : 1;
            const entry = cloneItem(itemToInsert);
            entry.count = add;
            slots[i] = entry;
            remaining -= add;
        }
    }

    return remaining;
}

export function moveSlotBetweenContainers(srcSlots, srcIndex, destSlots) {
    const item = srcSlots[srcIndex];
    if (!item) return false;
    const leftover = insertItemIntoSlots(destSlots, item);
    if (leftover === item.count) return false;
    if (leftover <= 0) {
        srcSlots[srcIndex] = null;
    } else {
        item.count = leftover;
    }
    return true;
}

// ==========================================
// XP & PLAYER LEVEL PROGRESSION (MINECRAFT STYLE)
// ==========================================

export function getXpForNextLevel(level = 0) {
    const safeLvl = Math.max(0, Math.floor(level));
    return 18 + safeLvl * 7;
}

export function grantXpToState(state, amount) {
    if (!state || amount <= 0) return { leveledUp: false, levelsGained: 0 };
    state.xp = (state.xp || 0) + amount;
    state.xpLevel = state.xpLevel || 0;
    let levelsGained = 0;
    let needed = getXpForNextLevel(state.xpLevel);
    while (state.xp >= needed) {
        state.xp -= needed;
        state.xpLevel += 1;
        levelsGained += 1;
        needed = getXpForNextLevel(state.xpLevel);
    }
    return { leveledUp: levelsGained > 0, levelsGained };
}

// ==========================================
// ENCHANTMENTS, ALTAR OFFERS & ANVIL COMBINING
// ==========================================

export const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V'];

export const ENCHANTMENTS = {
    sharpness: {
        id: 'sharpness',
        name: 'Ketajaman',
        maxLevel: 5,
        targets: ['sword'],
        weight: 10,
        anvilCost: 1,
        description: '+12 serangan jarak dekat per level pada Pedang.'
    },
    knockback: {
        id: 'knockback',
        name: 'Pentalan',
        maxLevel: 2,
        targets: ['sword'],
        weight: 5,
        anvilCost: 1,
        description: 'Mementalkan musuh lebih jauh saat dipukul Pedang.'
    },
    fire_aspect: {
        id: 'fire_aspect',
        name: 'Aspek Api',
        maxLevel: 2,
        targets: ['sword', 'bow'],
        weight: 2,
        anvilCost: 2,
        description: '+8 damage api & pulihkan +4 HP per level saat mengenai target.'
    },
    looting: {
        id: 'looting',
        name: 'Penjarahan',
        maxLevel: 3,
        targets: ['sword'],
        weight: 3,
        anvilCost: 2,
        description: 'Peluang drop ekstra & bonus XP saat mengalahkan mob.'
    },
    efficiency: {
        id: 'efficiency',
        name: 'Efisiensi',
        maxLevel: 5,
        targets: ['pickaxe'],
        weight: 10,
        anvilCost: 1,
        description: 'Mempercepat tambang blok keras seperti Obsidian.'
    },
    fortune: {
        id: 'fortune',
        name: 'Keberuntungan',
        maxLevel: 3,
        targets: ['pickaxe'],
        weight: 4,
        anvilCost: 2,
        exclusiveGroup: 'mining_drop',
        description: 'Melipatgandakan hasil tambang bijih. Tidak bisa digabung dengan Sentuhan Halus.'
    },
    silk_touch: {
        id: 'silk_touch',
        name: 'Sentuhan Halus',
        maxLevel: 1,
        targets: ['pickaxe'],
        weight: 2,
        anvilCost: 4,
        exclusiveGroup: 'mining_drop',
        description: 'Menjatuhkan blok utuh (Bijih, Rumput, Rak Buku). Tidak bisa digabung dengan Keberuntungan.'
    },
    power: {
        id: 'power',
        name: 'Kekuatan',
        maxLevel: 5,
        targets: ['bow'],
        weight: 10,
        anvilCost: 1,
        description: '+15 damage & kecepatan lesat anak panah per level pada Busur.'
    },
    punch: {
        id: 'punch',
        name: 'Hentakan',
        maxLevel: 2,
        targets: ['bow'],
        weight: 4,
        anvilCost: 2,
        description: 'Mendorong target lebih kuat saat terkena panah.'
    },
    protection: {
        id: 'protection',
        name: 'Perlindungan',
        maxLevel: 4,
        targets: ['armor'],
        weight: 10,
        anvilCost: 1,
        exclusiveGroup: 'armor_prot',
        description: '+5% reduksi semua damage per level. Tidak bisa digabung dengan Tahan Api.'
    },
    fire_protection: {
        id: 'fire_protection',
        name: 'Tahan Api',
        maxLevel: 4,
        targets: ['armor'],
        weight: 5,
        anvilCost: 1,
        exclusiveGroup: 'armor_prot',
        description: '+12% reduksi damage Lava & Magma per level. Tidak bisa digabung dengan Perlindungan.'
    },
    thorns: {
        id: 'thorns',
        name: 'Duri',
        maxLevel: 3,
        targets: ['armor'],
        weight: 2,
        anvilCost: 4,
        description: 'Memantulkan 6 damage per level ke penyerang jarak dekat.'
    }
};

export function areEnchantsCompatible(idA, idB) {
    if (idA === idB) return true;
    const a = ENCHANTMENTS[idA];
    const b = ENCHANTMENTS[idB];
    if (!a || !b) return false;
    if (a.exclusiveGroup && a.exclusiveGroup === b.exclusiveGroup) return false;
    return true;
}

export function hasAnyEnchant(item) {
    return Object.keys(getItemEnchants(item)).length > 0;
}

export function formatEnchantList(item) {
    const enchMap = getItemEnchants(item);
    return Object.entries(enchMap).map(([id, lvl]) => {
        const def = ENCHANTMENTS[id];
        const name = def ? def.name : id;
        return `${name} ${ROMAN_NUMERALS[lvl] || lvl}`;
    });
}

export function canApplyEnchantToItem(item, enchantId) {
    if (!item || !ENCHANTMENTS[enchantId]) return false;
    if (item.type === 'enchanted_book') return true;
    const category = getEquipmentCategory(item.type);
    if (!category) return false;
    return ENCHANTMENTS[enchantId].targets.includes(category);
}

/**
 * Counts up to 15 bookshelves on the 5x5x2 perimeter around an Enchanting Table at (tx, ty, tz),
 * requiring an unobstructed non-solid block gap between the table and each bookshelf (Minecraft rule).
 */
export function countEnchantingBookshelves(getBlockAt, tx, ty, tz) {
    if (typeof getBlockAt !== 'function') return 0;
    let count = 0;
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            if (Math.abs(dx) !== 2 && Math.abs(dz) !== 2) continue;
            const midX = tx + Math.trunc(dx / 2);
            const midZ = tz + Math.trunc(dz / 2);
            for (let dy = 0; dy <= 1; dy++) {
                if (isSolidBlock(getBlockAt(midX, ty + dy, midZ))) continue;
                if (normalizeBlockType(getBlockAt(tx + dx, ty + dy, tz + dz)) === 'bookshelf') {
                    count++;
                    if (count >= 15) return 15;
                }
            }
        }
    }
    return count;
}

function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h || 1;
}

function createSeededRng(seedInt) {
    let s = seedInt >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function getMaterialEnchantabilityBonus(type) {
    if (!type) return 0;
    if (type.includes('gold')) return 5;
    if (type.includes('wood')) return 3;
    if (type.includes('diamond')) return 2;
    if (type.includes('iron') || type === 'book' || type === 'bow') return 1;
    return 0;
}

function pickWeightedEnchant(pool, rng) {
    const totalWeight = pool.reduce((sum, def) => sum + (def.weight || 1), 0);
    if (totalWeight <= 0 || pool.length === 0) return null;
    let roll = rng() * totalWeight;
    for (const def of pool) {
        roll -= def.weight || 1;
        if (roll <= 0) return def;
    }
    return pool[pool.length - 1];
}

/**
 * Generates Minecraft's 3-slot Enchanting Table offers (costing 1, 2, or 3 Lapis + XP Levels).
 * Un-enchanted gear and blank books are eligible; already-enchanted items must use the Anvil.
 */
export function getEnchantTableOffers(item, bookshelves = 0, seed = 1) {
    if (!item || (item.type !== 'book' && getEquipmentCategory(item.type) === null)) {
        return { eligible: false, reason: 'Pilih senjata, beliung, busur, zirah, atau Buku Kosong.', offers: [] };
    }
    if (hasAnyEnchant(item)) {
        return {
            eligible: false,
            reason: 'Item ini sudah memiliki mantra. Gunakan Paron di sebelah kanan untuk menggabungkan atau menaikkan level.',
            offers: []
        };
    }

    const clampedShelves = Math.max(0, Math.min(15, Math.floor(bookshelves)));
    const pool = Object.values(ENCHANTMENTS).filter(def =>
        item.type === 'book' ? true : canApplyEnchantToItem(item, def.id)
    );
    if (pool.length === 0) {
        return { eligible: false, reason: 'Tidak ada mantra untuk item ini.', offers: [] };
    }

    const maxTableLevel = 5 + Math.round((clampedShelves / 15) * 25); // 5 at 0 shelves -> 30 at 15 shelves
    const reqLevels = [
        Math.max(1, Math.round(maxTableLevel * 0.26)),
        Math.max(3, Math.round(maxTableLevel * 0.6)),
        maxTableLevel
    ];
    const matBonus = getMaterialEnchantabilityBonus(item.type);
    const usedClueIds = new Set();
    const offers = [];

    for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
        const tier = slotIdx + 1;
        const rng = createSeededRng(hashSeed(`${seed}:${item.type}:${clampedShelves}:${tier}`));
        const reqLevel = reqLevels[slotIdx];
        const effPower = reqLevel + matBonus;
        const powerRatio = Math.min(1, effPower / 30);

        const distinctPool = pool.filter(d => !usedClueIds.has(d.id));
        const primaryDef = pickWeightedEnchant(distinctPool.length > 0 ? distinctPool : pool, rng);
        usedClueIds.add(primaryDef.id);

        const calcLevel = (def) => {
            if (def.maxLevel <= 1) return 1;
            const raw = 1 + powerRatio * (def.maxLevel - 1) + (rng() - 0.35) * 0.75;
            return Math.max(1, Math.min(def.maxLevel, Math.round(raw)));
        };

        const enchants = { [primaryDef.id]: calcLevel(primaryDef) };

        // Roll compatible bonus enchantments on higher tiers & bookshelf counts
        const extraAttempts = tier === 3 ? (item.type === 'book' ? 1 : 2) : (tier === 2 ? 1 : 0);
        for (let attempt = 0; attempt < extraAttempts; attempt++) {
            const chance = attempt === 0 ? 0.2 + powerRatio * 0.55 : 0.1 + powerRatio * 0.35;
            if (effPower >= 7 && rng() < chance) {
                const compatPool = pool.filter(def =>
                    !enchants[def.id] &&
                    Object.keys(enchants).every(existing => areEnchantsCompatible(existing, def.id))
                );
                const bonusDef = pickWeightedEnchant(compatPool, rng);
                if (bonusDef) {
                    enchants[bonusDef.id] = calcLevel(bonusDef);
                }
            }
        }

        const clueLvl = enchants[primaryDef.id];
        offers.push({
            tier,
            reqLevel,
            lapisCost: tier,
            levelCost: tier,
            clue: {
                id: primaryDef.id,
                name: primaryDef.name,
                level: clueLvl,
                label: `${primaryDef.name} ${ROMAN_NUMERALS[clueLvl] || clueLvl}`
            },
            hasBonusHint: Object.keys(enchants).length > 1 || effPower >= 10,
            enchants
        });
    }

    return { eligible: true, bookshelves: clampedShelves, maxTableLevel, offers };
}

export function applyEnchantTableOffer(item, offer) {
    if (!item || !offer || !offer.enchants) return null;
    if (item.type === 'book') {
        const outBook = { type: 'enchanted_book', count: 1 };
        setItemEnchants(outBook, offer.enchants);
        return outBook;
    }
    const outGear = cloneItem(item);
    outGear.count = 1;
    setItemEnchants(outGear, offer.enchants);
    return outGear;
}

/**
 * Combines targetItem + sacrificeItem on a Minecraft Anvil:
 * - Equipment + Enchanted Book
 * - Enchanted Book + Enchanted Book
 * - Equipment + Same-Type Equipment
 * Enforces mutual exclusion, equal-level +1 upgrades, and Prior Work XP penalty (capped at 39 levels).
 */
export function combineAnvilItems(targetItem, sacrificeItem) {
    if (!targetItem || !sacrificeItem) {
        return { ok: false, reason: 'Pilih item utama dan item penggabung.' };
    }

    const targetIsBook = targetItem.type === 'enchanted_book';
    const sacIsBook = sacrificeItem.type === 'enchanted_book';
    const targetCat = getEquipmentCategory(targetItem.type);
    const sameGear = targetCat !== null && targetItem.type === sacrificeItem.type;

    if (!((targetCat !== null && sacIsBook) || (targetIsBook && sacIsBook) || sameGear)) {
        return {
            ok: false,
            reason: 'Paron hanya menggabungkan Perlengkapan + Buku Enchant, dua Buku Enchant, atau dua Perlengkapan sejenis.'
        };
    }

    const sacEnchants = getItemEnchants(sacrificeItem);
    if (Object.keys(sacEnchants).length === 0) {
        return { ok: false, reason: 'Item penggabung tidak memiliki mantra untuk ditambahkan.' };
    }

    const merged = getItemEnchants(targetItem);
    let addedCost = 0;
    let changedCount = 0;
    let conflictMsg = null;
    let wrongCategoryCount = 0;
    let cappedOrLowerCount = 0;

    for (const [enchId, sacLvl] of Object.entries(sacEnchants)) {
        const def = ENCHANTMENTS[enchId];
        if (!def) continue;

        if (!targetIsBook && !canApplyEnchantToItem(targetItem, enchId)) {
            wrongCategoryCount++;
            continue;
        }

        const conflictingId = Object.keys(merged).find(existing => !areEnchantsCompatible(existing, enchId));
        if (conflictingId) {
            const existDef = ENCHANTMENTS[conflictingId];
            conflictMsg = `Mantra bertabrakan: ${def.name} tidak bisa digabung dengan ${existDef?.name || conflictingId}.`;
            addedCost += 1; // Minecraft +1 level conflict penalty when merging multi-enchant items
            continue;
        }

        const curLvl = merged[enchId] || 0;
        let nextLvl = curLvl;
        if (curLvl === sacLvl && curLvl < def.maxLevel) {
            nextLvl = curLvl + 1;
        } else if (sacLvl > curLvl) {
            nextLvl = Math.min(def.maxLevel, sacLvl);
        } else {
            cappedOrLowerCount++;
            continue;
        }

        if (nextLvl > curLvl) {
            merged[enchId] = nextLvl;
            const mult = sacIsBook ? Math.max(1, Math.ceil((def.anvilCost || 1) / 2)) : (def.anvilCost || 1);
            addedCost += nextLvl * mult;
            changedCount++;
        }
    }

    if (changedCount === 0) {
        if (conflictMsg) return { ok: false, reason: conflictMsg };
        if (wrongCategoryCount > 0) {
            return { ok: false, reason: 'Mantra ini tidak cocok untuk jenis perlengkapan tersebut.' };
        }
        if (cappedOrLowerCount > 0) {
            return { ok: false, reason: 'Item sudah memiliki level mantra setara atau maksimum.' };
        }
        return { ok: false, reason: 'Tidak ada mantra yang dapat ditingkatkan.' };
    }

    const targetWork = (1 << Math.min(10, targetItem.anvilUses || 0)) - 1;
    const sacWork = (1 << Math.min(10, sacrificeItem.anvilUses || 0)) - 1;
    const xpCost = Math.max(1, addedCost + targetWork + sacWork + (sameGear ? 2 : 0));

    if (xpCost >= 40) {
        return { ok: false, reason: 'Terlalu Mahal! Batas tempa Paron maksimum 39 Level.' };
    }

    const resultItem = cloneItem(targetItem);
    resultItem.count = 1;
    setItemEnchants(resultItem, merged);
    resultItem.anvilUses = Math.max(targetItem.anvilUses || 0, sacrificeItem.anvilUses || 0) + 1;

    const firstAddedId = Object.keys(sacEnchants).find(id => merged[id] !== (getItemEnchants(targetItem)[id] || 0)) || Object.keys(merged)[0];
    const firstDef = ENCHANTMENTS[firstAddedId];

    return {
        ok: true,
        resultItem,
        xpCost,
        level: merged[firstAddedId],
        enchantName: firstDef ? firstDef.name : firstAddedId,
        enchants: merged
    };
}

export function applyEnchantBookToItem(targetItem, bookItem) {
    if (!targetItem || !bookItem || bookItem.type !== 'enchanted_book' || !hasAnyEnchant(bookItem)) {
        return { ok: false, reason: 'Buku Enchant tidak valid.' };
    }
    const res = combineAnvilItems(targetItem, bookItem);
    if (!res.ok) return res;
    setItemEnchants(targetItem, res.enchants);
    targetItem.anvilUses = res.resultItem.anvilUses;
    return {
        ok: true,
        level: res.level,
        enchantName: res.enchantName,
        enchants: res.enchants,
        xpCost: res.xpCost
    };
}

export function getMeleeStats(heldItem) {
    let damage = 25;
    let knockback = 6.0;
    let lifeSteal = 0;
    let fireDamage = 0;
    let lootingLevel = 0;

    if (heldItem) {
        if (heldItem.type === 'sword_wood') damage = 30;
        else if (heldItem.type === 'sword_stone') damage = 34;
        else if (heldItem.type === 'sword_iron') damage = 38;
        else if (heldItem.type === 'sword_diamond') damage = 52;
        else if (heldItem.type === 'pickaxe_wood') damage = 27;
        else if (heldItem.type === 'pickaxe_stone') damage = 28;
        else if (heldItem.type === 'pickaxe_iron') damage = 30;
        else if (heldItem.type === 'pickaxe_diamond') damage = 36;

        const ench = getItemEnchants(heldItem);
        if (ench.sharpness) {
            damage += ench.sharpness * 12;
            knockback += ench.sharpness * 0.6;
        }
        if (ench.knockback) {
            knockback += ench.knockback * 3.5;
        }
        if (ench.fire_aspect) {
            fireDamage = ench.fire_aspect * 8;
            lifeSteal = ench.fire_aspect * 4;
        }
        if (ench.looting) {
            lootingLevel = ench.looting;
        }
    }

    return {
        damage: damage + fireDamage,
        knockback,
        lifeSteal,
        lootingLevel,
        isFire: fireDamage > 0
    };
}

export function getMiningStats(heldItem) {
    let hitPower = 1;
    let bonusDropChance = 0;
    let fortuneLevel = 0;
    let silkTouch = false;

    if (heldItem) {
        if (heldItem.type === 'pickaxe_wood') hitPower = 1.5;
        else if (heldItem.type === 'pickaxe_stone') hitPower = 2;
        else if (heldItem.type === 'pickaxe_iron') hitPower = 3;
        else if (heldItem.type === 'pickaxe_diamond') hitPower = 4;

        const ench = getItemEnchants(heldItem);
        const eff = ench.efficiency || 0;
        if (eff > 0) {
            hitPower += eff * 2;
            bonusDropChance = eff * 0.15;
        }
        if (ench.silk_touch) {
            silkTouch = true;
            bonusDropChance = 0;
        } else if (ench.fortune) {
            fortuneLevel = ench.fortune;
            bonusDropChance = Math.max(bonusDropChance, fortuneLevel * 0.3);
        }
    }

    return { hitPower, bonusDropChance, fortuneLevel, silkTouch };
}

export function getBowStats(bowItem) {
    let damage = 25;
    let speed = 22.0;
    let knockback = 6.0;
    let lifeSteal = 0;
    let isFire = false;

    if (bowItem) {
        const ench = getItemEnchants(bowItem);
        if (ench.power) {
            damage += ench.power * 15;
            speed += ench.power * 4.0;
        }
        if (ench.punch) {
            knockback += ench.punch * 4.0;
        }
        if (ench.fire_aspect) {
            damage += ench.fire_aspect * 8;
            lifeSteal = ench.fire_aspect * 4;
            isFire = true;
        }
    }

    return { damage, speed, knockback, lifeSteal, isFire };
}

export function computeArmorReduction(armor, damageSource = 'normal') {
    let reduction = 0;
    if (!armor) return 0;

    const baseTable = {
        diamond: { helmet: 0.15, chestplate: 0.25, leggings: 0.20, boots: 0.10 },
        iron: { helmet: 0.10, chestplate: 0.15, leggings: 0.10, boots: 0.05 },
        gold: { helmet: 0.07, chestplate: 0.12, leggings: 0.07, boots: 0.04 }
    };

    for (const slot of ['helmet', 'chestplate', 'leggings', 'boots']) {
        const item = armor[slot];
        if (!item || !item.type) continue;
        if (item.type.includes('diamond')) reduction += baseTable.diamond[slot];
        else if (item.type.includes('iron')) reduction += baseTable.iron[slot];
        else if (item.type.includes('gold')) reduction += baseTable.gold[slot];

        const ench = getItemEnchants(item);
        if (ench.protection) {
            reduction += ench.protection * 0.05;
        }
        if (ench.fire_protection) {
            reduction += ench.fire_protection * (damageSource === 'fire' ? 0.12 : 0.02);
        }
    }

    return Math.min(0.85, reduction);
}

export function computeThornsDamage(armor) {
    if (!armor) return 0;
    let totalLvl = 0;
    for (const slot of ['helmet', 'chestplate', 'leggings', 'boots']) {
        const ench = getItemEnchants(armor[slot]);
        totalLvl += ench.thorns || 0;
    }
    return totalLvl * 6;
}

// ==========================================
// HOTBAR & BLOCK CATALOG DEFINITIONS
// ==========================================

export const DEFAULT_HOTBAR_LOADOUT = [
    'grass',
    'dirt',
    'stone',
    'wood',
    'planks',
    'bookshelf',
    'chest',
    'crafting',
    'enchanting_table'
];

export function selectOrAssignHotbarSlot(loadout, activeIndex, visibleCount, targetType) {
    const safeVisible = Math.max(1, Math.min(loadout.length, visibleCount));
    const clampedActive = Math.min(Math.max(0, activeIndex), safeVisible - 1);
    for (let i = 0; i < safeVisible; i++) {
        if (loadout[i] === targetType) {
            return { nextIndex: i, updated: false };
        }
    }
    loadout[clampedActive] = targetType;
    return { nextIndex: clampedActive, updated: true };
}

export const HOTBAR_ITEMS = [
    { type: 'grass', label: 'Grass', key: '1', category: 'nature', nameId: 'Rumput' },
    { type: 'dirt', label: 'Dirt', key: '2', category: 'nature', nameId: 'Tanah' },
    { type: 'stone', label: 'Stone', key: '3', category: 'nature', nameId: 'Batu' },
    { type: 'obsidian', label: 'Obsidian', key: '4', category: 'mineral', nameId: 'Obsidian' },
    { type: 'wood', label: 'Wood', key: '5', category: 'nature', nameId: 'Kayu Gelondongan' },
    { type: 'planks', label: 'Planks', key: '`', category: 'nature', nameId: 'Papan Kayu' },
    { type: 'leaf', label: 'Leaf', key: '6', category: 'nature', nameId: 'Daun' },
    { type: 'brick', label: 'Brick', key: '7', category: 'mineral', nameId: 'Bata' },
    { type: 'emerald', label: 'Emerald', key: '8', category: 'mineral', nameId: 'Zamrud' },
    { type: 'diamond', label: 'Diamond', key: '9', category: 'mineral', nameId: 'Berlian' },
    { type: 'ender', label: 'Ender', key: '0', category: 'mineral', nameId: 'Blok Ender' },
    { type: 'tnt', label: 'TNT', key: '-', category: 'redstone', nameId: 'TNT' },
    { type: 'water', label: 'Water', key: '=', category: 'nature', nameId: 'Air' },
    { type: 'lava', label: 'Lava', key: 'L', category: 'nature', nameId: 'Lava' },
    { type: 'quartz', label: 'Quartz', key: 'Q', category: 'mineral', nameId: 'Kuarsa' },
    { type: 'sand', label: 'Sand', key: 'Y', category: 'nature', nameId: 'Pasir' },
    { type: 'farmland', label: 'Farmland', key: 'U', category: 'nature', nameId: 'Ladang' },
    { type: 'lucky', label: 'Lucky', key: 'I', category: 'redstone', nameId: 'Lucky Block' },
    { type: 'magma', label: 'Magma', key: 'O', category: 'nature', nameId: 'Magma' },
    { type: 'crop', label: 'Crop', key: 'P', category: 'nature', nameId: 'Gandum' },
    { type: 'spawn_irongolem', label: 'G. Iron', key: 'G', category: 'special', nameId: 'Telur Iron Golem' },
    { type: 'spawn_snowgolem', label: 'G. Snow', key: "'", category: 'special', nameId: 'Telur Snow Golem' },
    { type: 'coal_ore', label: 'Coal Ore', key: 'K', category: 'mineral', nameId: 'Bijih Batu Bara' },
    { type: 'iron_ore', label: 'Iron Ore', key: 'J', category: 'mineral', nameId: 'Bijih Besi' },
    { type: 'gold_ore', label: 'Gold Ore', key: 'N', category: 'mineral', nameId: 'Bijih Emas' },
    { type: 'lapis_ore', label: 'Lapis Ore', key: '\\', category: 'mineral', nameId: 'Bijih Lapis' },
    { type: 'bookshelf', label: 'Bookshelf', key: '+', category: 'redstone', nameId: 'Rak Buku' },
    { type: 'chest', label: 'Chest', key: 'C', category: 'redstone', nameId: 'Peti Penyimpanan' },
    { type: 'crafting', label: 'Crafting', key: 'V', category: 'redstone', nameId: 'Meja Crafting' },
    { type: 'enchanting_table', label: 'Enchant', key: ';', category: 'redstone', nameId: 'Meja Enchant' },
    { type: 'piston', label: 'Piston', key: 'X', category: 'redstone', nameId: 'Piston' },
    { type: 'rail', label: 'Rail', key: 'Z', category: 'redstone', nameId: 'Rel Kereta' },
    { type: 'pressure_plate', label: 'Plate', key: 'M', category: 'redstone', nameId: 'Pelat Tekanan' },
    { type: 'button', label: 'Button', key: 'B', category: 'redstone', nameId: 'Tombol Batu' },
    { type: 'lever', label: 'Lever', key: 'T', category: 'redstone', nameId: 'Tuas Saklar' },
    { type: 'dispenser', label: 'Dispenser', key: 'R', category: 'redstone', nameId: 'Dispenser' }
];

// ==========================================
// MINECRAFT SHAPED & SHAPELESS CRAFTING ENGINE
// ==========================================

function defineRecipe(raw) {
    const ingredients = {};
    let gridSize = 2;

    if (raw.shapeless) {
        raw.shapeless.forEach(item => {
            ingredients[item] = (ingredients[item] || 0) + 1;
        });
        gridSize = raw.shapeless.length > 4 ? 3 : 2;
    } else if (raw.pattern && raw.key) {
        const patH = raw.pattern.length;
        const patW = Math.max(...raw.pattern.map(r => r.length));
        gridSize = (patH > 2 || patW > 2) ? 3 : 2;
        for (const row of raw.pattern) {
            for (const ch of row) {
                if (ch === ' ') continue;
                const item = raw.key[ch];
                if (item) ingredients[item] = (ingredients[item] || 0) + 1;
            }
        }
    }

    return {
        ...raw,
        gridSize,
        ingredients
    };
}

export const CRAFTING_RECIPES = [
    // Bahan Dasar & Resep 2x2 (Rakit Tangan)
    defineRecipe({
        id: 'planks',
        category: 'basic',
        result: 'planks',
        resultName: 'Papan Kayu',
        resultCount: 4,
        shapeless: ['wood'],
        description: 'Ubah 1 Kayu Gelondongan menjadi 4 Papan Kayu di slot mana saja.'
    }),
    defineRecipe({
        id: 'stick',
        category: 'basic',
        result: 'stick',
        resultName: 'Tongkat Kayu',
        resultCount: 4,
        pattern: ['P', 'P'],
        key: { P: 'planks' },
        description: 'Susun 2 Papan Kayu vertikal sebagai gagang beliung, pedang, dan busur.'
    }),
    defineRecipe({
        id: 'crafting',
        category: 'basic',
        result: 'crafting',
        resultName: 'Meja Crafting',
        resultCount: 1,
        pattern: ['PP', 'PP'],
        key: { P: 'planks' },
        description: 'Pasang di dunia lalu klik kanan untuk membuka Grid Crafting 3x3.'
    }),
    defineRecipe({
        id: 'book',
        category: 'magic',
        result: 'book',
        resultName: 'Buku Kosong',
        resultCount: 1,
        shapeless: ['crop', 'crop', 'crop', 'planks'],
        description: 'Bahan Rak Buku dan media mantra di Meja Enchant.'
    }),

    // Senjata & Alat (Grid 3x3)
    defineRecipe({
        id: 'pickaxe_wood',
        category: 'weapon',
        result: 'pickaxe_wood',
        resultName: 'Beliung Kayu',
        resultCount: 1,
        pattern: ['PPP', ' S ', ' S '],
        key: { P: 'planks', S: 'stick' },
        description: 'Beliung awal untuk mulai menambang batu dan batu bara.'
    }),
    defineRecipe({
        id: 'pickaxe_stone',
        category: 'weapon',
        result: 'pickaxe_stone',
        resultName: 'Beliung Batu',
        resultCount: 1,
        pattern: ['RRR', ' S ', ' S '],
        key: { R: 'stone', S: 'stick' },
        description: 'Menambang bijih besi dan lapis lebih cepat.'
    }),
    defineRecipe({
        id: 'pickaxe_iron',
        category: 'weapon',
        result: 'pickaxe_iron',
        resultName: 'Beliung Besi',
        resultCount: 1,
        pattern: ['III', ' S ', ' S '],
        key: { I: 'iron_ingot', S: 'stick' },
        description: 'Menambang bijih emas, berlian, dan obsidian 3x lebih cepat.'
    }),
    defineRecipe({
        id: 'pickaxe_diamond',
        category: 'weapon',
        result: 'pickaxe_diamond',
        resultName: 'Beliung Berlian',
        resultCount: 1,
        pattern: ['DDD', ' S ', ' S '],
        key: { D: 'diamond', S: 'stick' },
        description: 'Menghancurkan Obsidian dalam 2 pukulan (1 pukulan dengan Efisiensi II).'
    }),
    defineRecipe({
        id: 'sword_wood',
        category: 'weapon',
        result: 'sword_wood',
        resultName: 'Pedang Kayu',
        resultCount: 1,
        pattern: ['P', 'P', 'S'],
        key: { P: 'planks', S: 'stick' },
        description: '30 damage serangan jarak dekat.'
    }),
    defineRecipe({
        id: 'sword_stone',
        category: 'weapon',
        result: 'sword_stone',
        resultName: 'Pedang Batu',
        resultCount: 1,
        pattern: ['R', 'R', 'S'],
        key: { R: 'stone', S: 'stick' },
        description: '34 damage serangan jarak dekat.'
    }),
    defineRecipe({
        id: 'sword_iron',
        category: 'weapon',
        result: 'sword_iron',
        resultName: 'Pedang Besi',
        resultCount: 1,
        pattern: ['I', 'I', 'S'],
        key: { I: 'iron_ingot', S: 'stick' },
        description: '38 damage serangan dekat. Cocok diberi mantra di Meja Enchant.'
    }),
    defineRecipe({
        id: 'sword_diamond',
        category: 'weapon',
        result: 'sword_diamond',
        resultName: 'Pedang Berlian',
        resultCount: 1,
        pattern: ['D', 'D', 'S'],
        key: { D: 'diamond', S: 'stick' },
        description: '52 damage serangan dekat untuk menghadapi Wither & Blood Golem.'
    }),
    defineRecipe({
        id: 'bow',
        category: 'weapon',
        result: 'bow',
        resultName: 'Busur Panah',
        resultCount: 1,
        pattern: [' SC', 'S C', ' SC'],
        key: { S: 'stick', C: 'crop' },
        description: 'Senjata jarak jauh. Mendukung Kekuatan, Hentakan, dan Aspek Api.'
    }),

    // Zirah Lengkap (Besi, Emas, Berlian)
    defineRecipe({
        id: 'helmet_iron',
        category: 'armor',
        result: 'helmet_iron',
        resultName: 'Helm Besi',
        resultCount: 1,
        pattern: ['III', 'I I'],
        key: { I: 'iron_ingot' },
        description: '+10% pertahanan dasar (DEF).'
    }),
    defineRecipe({
        id: 'chestplate_iron',
        category: 'armor',
        result: 'chestplate_iron',
        resultName: 'Zirah Dada Besi',
        resultCount: 1,
        pattern: ['I I', 'III', 'III'],
        key: { I: 'iron_ingot' },
        description: '+15% pertahanan dasar (DEF).'
    }),
    defineRecipe({
        id: 'leggings_iron',
        category: 'armor',
        result: 'leggings_iron',
        resultName: 'Celana Besi',
        resultCount: 1,
        pattern: ['III', 'I I', 'I I'],
        key: { I: 'iron_ingot' },
        description: '+10% pertahanan dasar (DEF).'
    }),
    defineRecipe({
        id: 'boots_iron',
        category: 'armor',
        result: 'boots_iron',
        resultName: 'Sepatu Besi',
        resultCount: 1,
        pattern: ['I I', 'I I'],
        key: { I: 'iron_ingot' },
        description: '+5% pertahanan dasar (DEF).'
    }),
    defineRecipe({
        id: 'helmet_gold',
        category: 'armor',
        result: 'helmet_gold',
        resultName: 'Helm Emas',
        resultCount: 1,
        pattern: ['GGG', 'G G'],
        key: { G: 'gold_ingot' },
        description: '+7% DEF dan daya serap mantra tertinggi di Meja Enchant.'
    }),
    defineRecipe({
        id: 'chestplate_gold',
        category: 'armor',
        result: 'chestplate_gold',
        resultName: 'Zirah Dada Emas',
        resultCount: 1,
        pattern: ['G G', 'GGG', 'GGG'],
        key: { G: 'gold_ingot' },
        description: '+12% DEF dengan afinitas mantra tinggi.'
    }),
    defineRecipe({
        id: 'leggings_gold',
        category: 'armor',
        result: 'leggings_gold',
        resultName: 'Celana Emas',
        resultCount: 1,
        pattern: ['GGG', 'G G', 'G G'],
        key: { G: 'gold_ingot' },
        description: '+7% DEF dengan afinitas mantra tinggi.'
    }),
    defineRecipe({
        id: 'boots_gold',
        category: 'armor',
        result: 'boots_gold',
        resultName: 'Sepatu Emas',
        resultCount: 1,
        pattern: ['G G', 'G G'],
        key: { G: 'gold_ingot' },
        description: '+4% DEF dengan afinitas mantra tinggi.'
    }),
    defineRecipe({
        id: 'helmet_diamond',
        category: 'armor',
        result: 'helmet_diamond',
        resultName: 'Helm Berlian',
        resultCount: 1,
        pattern: ['DDD', 'D D'],
        key: { D: 'diamond' },
        description: '+15% pertahanan tinggi.'
    }),
    defineRecipe({
        id: 'chestplate_diamond',
        category: 'armor',
        result: 'chestplate_diamond',
        resultName: 'Zirah Dada Berlian',
        resultCount: 1,
        pattern: ['D D', 'DDD', 'DDD'],
        key: { D: 'diamond' },
        description: '+25% pertahanan tinggi.'
    }),
    defineRecipe({
        id: 'leggings_diamond',
        category: 'armor',
        result: 'leggings_diamond',
        resultName: 'Celana Berlian',
        resultCount: 1,
        pattern: ['DDD', 'D D', 'D D'],
        key: { D: 'diamond' },
        description: '+20% pertahanan tinggi.'
    }),
    defineRecipe({
        id: 'boots_diamond',
        category: 'armor',
        result: 'boots_diamond',
        resultName: 'Sepatu Berlian',
        resultCount: 1,
        pattern: ['D D', 'D D'],
        key: { D: 'diamond' },
        description: '+10% pertahanan tinggi.'
    }),

    // Sihir & Pangan
    defineRecipe({
        id: 'bookshelf',
        category: 'magic',
        result: 'bookshelf',
        resultName: 'Rak Buku',
        resultCount: 1,
        pattern: ['PPP', 'BBB', 'PPP'],
        key: { P: 'planks', B: 'book' },
        description: 'Pasang berjarak 1 blok mengelilingi Meja Enchant (maks 15) hingga Level 30.'
    }),
    defineRecipe({
        id: 'enchanting_table',
        category: 'magic',
        result: 'enchanting_table',
        resultName: 'Meja Enchant',
        resultCount: 1,
        pattern: [' B ', 'DOD', 'OOO'],
        key: { B: 'book', D: 'diamond', O: 'obsidian' },
        description: 'Altar mantra 3-slot menggunakan Lapis Lazuli dan Level XP.'
    }),
    defineRecipe({
        id: 'golden_apple',
        category: 'magic',
        result: 'golden_apple',
        resultName: 'Apel Emas',
        resultCount: 1,
        pattern: ['GGG', 'GCG', 'GGG'],
        key: { G: 'gold_ingot', C: 'crop' },
        description: 'Memulihkan +50 HP seketika saat dimakan.'
    }),

    // Mekanis & Blok Utilitas
    defineRecipe({
        id: 'chest',
        category: 'block',
        result: 'chest',
        resultName: 'Peti Penyimpanan',
        resultCount: 1,
        pattern: ['PPP', 'P P', 'PPP'],
        key: { P: 'planks' },
        description: 'Menyimpan 18 slot barang per lokasi.'
    }),
    defineRecipe({
        id: 'piston',
        category: 'block',
        result: 'piston',
        resultName: 'Piston Penggerak',
        resultCount: 1,
        pattern: ['PPP', 'RIR', 'RCR'],
        key: { P: 'planks', R: 'stone', I: 'iron_ingot', C: 'coal' },
        description: 'Mendorong blok di depannya saat menerima sinyal saklar.'
    }),
    defineRecipe({
        id: 'rail',
        category: 'block',
        result: 'rail',
        resultName: 'Rel Kereta',
        resultCount: 16,
        pattern: ['I I', 'ISI', 'I I'],
        key: { I: 'iron_ingot', S: 'stick' },
        description: 'Jalur besi tempat Minecart meluncur.'
    }),
    defineRecipe({
        id: 'minecart',
        category: 'block',
        result: 'minecart',
        resultName: 'Minecart',
        resultCount: 1,
        pattern: ['I I', 'III'],
        key: { I: 'iron_ingot' },
        description: 'Pegang dari Tas lalu pasang di atas Rel untuk dikendarai.'
    }),
    defineRecipe({
        id: 'tnt',
        category: 'block',
        result: 'tnt',
        resultName: 'Blok TNT',
        resultCount: 1,
        pattern: ['CSC', 'SCS', 'CSC'],
        key: { C: 'coal', S: 'sand' },
        description: 'Bahan peledak berantai dengan sumbu 3 detik.'
    }),
    defineRecipe({
        id: 'dispenser',
        category: 'block',
        result: 'dispenser',
        resultName: 'Dispenser Otomatis',
        resultCount: 1,
        pattern: ['RRR', 'RBR', 'RCR'],
        key: { R: 'stone', B: 'bow', C: 'coal' },
        description: 'Meluncurkan Zirah Berlian saat menerima sinyal mekanis.'
    }),
    defineRecipe({
        id: 'pressure_plate',
        category: 'block',
        result: 'pressure_plate',
        resultName: 'Pelat Tekanan',
        resultCount: 1,
        pattern: ['PP'],
        key: { P: 'planks' },
        description: 'Mengirim sinyal mekanis otomatis saat diinjak (bisa dirakit di 2x2).'
    }),
    defineRecipe({
        id: 'lever',
        category: 'block',
        result: 'lever',
        resultName: 'Tuas Saklar',
        resultCount: 1,
        pattern: ['S', 'R'],
        key: { S: 'stick', R: 'stone' },
        description: 'Saklar nyala/mati permanen untuk Piston atau Dispenser (bisa di 2x2).'
    }),
    defineRecipe({
        id: 'button',
        category: 'block',
        result: 'button',
        resultName: 'Tombol Batu',
        resultCount: 1,
        pattern: ['R'],
        key: { R: 'stone' },
        description: 'Mengirim sinyal mekanis sesaat selama 1 detik (bisa di 2x2).'
    })
];

function cellType(cell) {
    if (!cell) return null;
    return typeof cell === 'string' ? cell : (cell.count > 0 ? cell.type : null);
}

function cellCount(cell) {
    if (!cell) return 0;
    return typeof cell === 'string' ? 1 : (cell.count || 0);
}

/**
 * Matches a 2x2 (length 4) or 3x3 (length 9) crafting grid against Minecraft shaped (bounding-box
 * offset + horizontal mirror invariant) and shapeless recipes.
 */
export function matchCraftingGrid(gridCells, size = 3) {
    if (!Array.isArray(gridCells) || gridCells.length < size * size) return null;

    let minR = size;
    let maxR = -1;
    let minC = size;
    let maxC = -1;
    const occupiedTypes = [];
    let maxBatches = Infinity;

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = gridCells[r * size + c];
            const t = cellType(cell);
            if (t) {
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
                occupiedTypes.push(t);
                maxBatches = Math.min(maxBatches, cellCount(cell));
            }
        }
    }

    if (occupiedTypes.length === 0 || maxBatches <= 0) return null;

    const subH = maxR - minR + 1;
    const subW = maxC - minC + 1;

    // 1. Check Shaped Recipes (exact trimmed bounding box, direct or horizontally mirrored)
    for (const recipe of CRAFTING_RECIPES) {
        if (!recipe.pattern || recipe.gridSize > size) continue;
        const patH = recipe.pattern.length;
        const patW = Math.max(...recipe.pattern.map(row => row.length));
        if (patH !== subH || patW !== subW) continue;

        for (const mirrored of [false, true]) {
            let matches = true;
            for (let r = 0; r < subH && matches; r++) {
                const rawRow = recipe.pattern[r].padEnd(patW, ' ');
                for (let c = 0; c < subW; c++) {
                    const patChar = rawRow[mirrored ? (patW - 1 - c) : c];
                    const expected = patChar === ' ' ? null : recipe.key[patChar];
                    const actual = cellType(gridCells[(minR + r) * size + (minC + c)]);
                    if (actual !== expected) {
                        matches = false;
                        break;
                    }
                }
            }
            if (matches) {
                return { recipe, maxBatches };
            }
        }
    }

    // 2. Check Shapeless Recipes (exact multiset of 1-per-slot items)
    const sortedOccupied = [...occupiedTypes].sort().join('|');
    for (const recipe of CRAFTING_RECIPES) {
        if (!recipe.shapeless || recipe.gridSize > size) continue;
        if (recipe.shapeless.length !== occupiedTypes.length) continue;
        const sortedReq = [...recipe.shapeless].sort().join('|');
        if (sortedOccupied === sortedReq) {
            return { recipe, maxBatches };
        }
    }

    return null;
}

export function consumeCraftingGrid(gridCells, batches = 1) {
    if (!Array.isArray(gridCells) || batches <= 0) return;
    for (let i = 0; i < gridCells.length; i++) {
        const cell = gridCells[i];
        if (cell && typeof cell === 'object') {
            cell.count -= batches;
            if (cell.count <= 0) gridCells[i] = null;
        } else if (typeof cell === 'string') {
            gridCells[i] = null;
        }
    }
}

export function returnGridToInventory(gridCells, inventorySlots) {
    if (!Array.isArray(gridCells) || !Array.isArray(inventorySlots)) return true;
    let allReturned = true;
    for (let i = 0; i < gridCells.length; i++) {
        const cell = gridCells[i];
        if (!cell) continue;
        const leftover = insertItemIntoSlots(inventorySlots, cell);
        if (leftover <= 0) {
            gridCells[i] = null;
        } else {
            cell.count = leftover;
            allReturned = false;
        }
    }
    return allReturned;
}

export function getRecipePatternCells(recipe, size = 3) {
    if (!recipe || recipe.gridSize > size) return null;
    const cells = Array(size * size).fill(null);
    if (recipe.shapeless) {
        recipe.shapeless.forEach((type, idx) => {
            if (idx < cells.length) cells[idx] = type;
        });
        return cells;
    }
    const patH = recipe.pattern.length;
    const patW = Math.max(...recipe.pattern.map(r => r.length));
    const offR = Math.floor((size - patH) / 2);
    const offC = Math.floor((size - patW) / 2);
    for (let r = 0; r < patH; r++) {
        const row = recipe.pattern[r].padEnd(patW, ' ');
        for (let c = 0; c < patW; c++) {
            const ch = row[c];
            if (ch !== ' ') {
                cells[(offR + r) * size + (offC + c)] = recipe.key[ch];
            }
        }
    }
    return cells;
}

export function populateGridForRecipe(inventorySlots, gridCells, size, recipe) {
    if (!recipe || recipe.gridSize > size) {
        return { ok: false, reason: 'Resep ini membutuhkan Grid 3x3 di Meja Crafting.' };
    }
    const targetCells = getRecipePatternCells(recipe, size);
    if (!targetCells) return { ok: false, reason: 'Pola tidak muat di grid saat ini.' };

    const matchesExistingLayout = targetCells.every((expectedType, i) => {
        const cur = gridCells[i];
        if (expectedType === null) return cur === null;
        return cur === null || (cur.type === expectedType && cur.count < 64);
    }) && gridCells.every((cur, i) => cur === null || targetCells[i] === cur.type);

    if (!matchesExistingLayout) {
        if (!returnGridToInventory(gridCells, inventorySlots)) {
            return { ok: false, reason: 'Tas penuh untuk mengembalikan isi grid sebelumnya.' };
        }
    }

    if (!canCraftRecipeFromSlots(inventorySlots, recipe)) {
        return { ok: false, reason: 'Bahan di Tas belum mencukupi.' };
    }

    const hittingCap = targetCells.some((expectedType, i) => expectedType && (gridCells[i]?.count || 0) >= 64);
    if (hittingCap) {
        return { ok: false, reason: 'Tumpukan di grid sudah penuh (64).' };
    }

    deductRecipeFromSlots(inventorySlots, recipe);
    for (let i = 0; i < targetCells.length; i++) {
        const t = targetCells[i];
        if (!t) continue;
        if (gridCells[i]) {
            gridCells[i].count += 1;
        } else {
            gridCells[i] = { type: t, count: 1 };
        }
    }
    return { ok: true };
}

export function countInventoryMaterials(slots) {
    const counts = {};
    if (!slots) return counts;
    for (const item of slots) {
        if (item && isStackableItem(item)) {
            counts[item.type] = (counts[item.type] || 0) + item.count;
        }
    }
    return counts;
}

export function canCraftRecipeFromSlots(slots, recipe) {
    const counts = countInventoryMaterials(slots);
    for (const [ing, req] of Object.entries(recipe.ingredients)) {
        if ((counts[ing] || 0) < req) return false;
    }
    return true;
}

export function deductRecipeFromSlots(slots, recipe) {
    if (!canCraftRecipeFromSlots(slots, recipe)) return false;
    for (const [ing, req] of Object.entries(recipe.ingredients)) {
        let rem = req;
        for (let i = 0; i < slots.length && rem > 0; i++) {
            const slot = slots[i];
            if (slot && slot.type === ing && isStackableItem(slot)) {
                const take = Math.min(rem, slot.count);
                slot.count -= take;
                rem -= take;
                if (slot.count <= 0) slots[i] = null;
            }
        }
    }
    return true;
}
