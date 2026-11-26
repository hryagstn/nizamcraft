// Shared pure game data, physics AABB helpers, Minecraft crafting grid engine, and enchantment/anvil rules

const STATE_SUFFIX_RE = /(?:_(?:source|[1-4]|asc_[nsew]|up_[nsew]|down_[nsew]|ns|ew|ne|nw|se|sw|up|down|[nsew]|on|pressed|extended))+$/;

export function normalizeBlockType(type) {
    if (!type || typeof type !== 'string') return '';
    return type.replace(STATE_SUFFIX_RE, '');
}

export function parseBlockState(type) {
    if (!type || typeof type !== 'string') {
        return { base: '', shape: 'ns', facing: 'up', active: false, extended: false, pressed: false };
    }
    const base = normalizeBlockType(type);
    const suffix = type.slice(base.length);
    const active = /(?:^|_)on(?:_|$)/.test(suffix);
    const extended = /(?:^|_)extended(?:_|$)/.test(suffix);
    const pressed = /(?:^|_)pressed(?:_|$)/.test(suffix);

    let shape = 'ns';
    const diagSlopeMatch = suffix.match(/(?:^|_)(up_[nsew]|down_[nsew])(?:_|$)/);
    const shapeMatch = !diagSlopeMatch
        ? suffix.match(/(?:^|_)(asc_[nsew]|ns|ew|ne|nw|se|sw)(?:_|$)/)
        : null;
    if (shapeMatch) {
        shape = shapeMatch[1];
    }

    let facing = 'up';
    if (diagSlopeMatch) {
        facing = diagSlopeMatch[1];
    } else if (base === 'laser' && shapeMatch && (shape === 'ne' || shape === 'nw' || shape === 'se' || shape === 'sw')) {
        facing = shape;
    } else if (!shapeMatch) {
        const facingMatch = suffix.match(/(?:^|_)(up|down|[nsew])(?:_|$)/);
        if (facingMatch) {
            facing = facingMatch[1];
        }
    }

    return { base, shape, facing, active, extended, pressed };
}

export const PASSABLE_BLOCKS = new Set([
    'water',
    'lava',
    'crop',
    'rail',
    'powered_rail',
    'redstone',
    'pressure_plate',
    'button',
    'lever'
]);

export const NON_GRAVITY_SOLID_BLOCKS = new Set(['piston_head']);

export function isGravityBlock(type) {
    if (!type || !isSolidBlock(type)) return false;
    const parsed = parseBlockState(type);
    if (NON_GRAVITY_SOLID_BLOCKS.has(parsed.base)) return false;
    if (parsed.base === 'piston' && parsed.extended) return false;
    return true;
}

export function shouldBlockFall(getBlockAt, x, y, z) {
    if (y <= 0) return false;
    const raw = getBlockAt(x, y, z);
    if (!isGravityBlock(raw)) return false;
    return !isSolidBlock(getBlockAt(x, y - 1, z));
}

export function collectUnsupportedGravityBlocks(getBlockAt, cx, cy, cz, radius = 1, maxY = 23) {
    const falling = [];
    const queued = new Set();
    const minY = Math.max(1, cy - 1);

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            const x = cx + dx;
            const z = cz + dz;
            for (let y = minY; y <= maxY; y++) {
                const raw = getBlockAt(x, y, z);
                if (!isGravityBlock(raw)) continue;
                const belowRaw = getBlockAt(x, y - 1, z);
                const belowFalls = queued.has(`${x},${y - 1},${z}`);
                if (belowFalls || !isSolidBlock(belowRaw)) {
                    queued.add(`${x},${y},${z}`);
                    falling.push({ x, y, z, type: raw });
                }
            }
        }
    }

    falling.sort((a, b) => a.y - b.y);
    return falling;
}

export function isSolidBlock(type) {
    if (!type) return false;
    return !PASSABLE_BLOCKS.has(normalizeBlockType(type));
}

export const SEA_BEACH_START_Z = 22;
export const SEA_START_Z = 25;

export const HOSTILE_MOBS = new Set([
    'zombie',
    'skeleton',
    'creeper',
    'bloodgolem',
    'witherskeleton',
    'traineater',
    'seaeater',
    'charles',
    'infectedocean',
    'infectedsky',
    'redsun',
    'lunarmoon',
    'cursedthomas',
    'sandworm',
    'bloop',
    'whaleeater'
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
        description: '+35 damage, kecepatan & radius ledak per level pada Senapan Nuklir.'
    },
    punch: {
        id: 'punch',
        name: 'Hentakan',
        maxLevel: 2,
        targets: ['bow'],
        weight: 4,
        anvilCost: 2,
        description: 'Mendorong target lebih kuat saat terkena tembakan Senapan Nuklir.'
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
    let damage = 140;
    let speed = 36.0;
    let knockback = 12.0;
    let lifeSteal = 0;
    let isFire = false;
    let blastRadius = 5.5;

    if (bowItem) {
        const ench = getItemEnchants(bowItem);
        if (ench.power) {
            damage += ench.power * 35;
            speed += ench.power * 4.0;
            blastRadius += ench.power * 0.5;
        }
        if (ench.punch) {
            knockback += ench.punch * 5.0;
        }
        if (ench.fire_aspect) {
            damage += ench.fire_aspect * 15;
            lifeSteal = ench.fire_aspect * 8;
            isFire = true;
        }
    }

    return { damage, speed, knockback, lifeSteal, isFire, isNuclear: true, blastRadius };
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
    { type: 'cobblestone', label: 'Cobble', key: 'F11', category: 'nature', nameId: 'Cobblestone' },
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
    { type: 'spawn_traineater', label: 'T. Eater', key: '(', category: 'special', nameId: 'Telur Train Eater' },
    { type: 'spawn_seaeater', label: 'S. Eater', key: ')', category: 'special', nameId: 'Telur Sea Eater' },
    { type: 'spawn_charles', label: 'Charles', key: '!', category: 'special', nameId: 'Telur Charles' },
    { type: 'spawn_infectedocean', label: 'Inf. Ocean', key: '@', category: 'special', nameId: 'Telur Infected Ocean' },
    { type: 'spawn_infectedsky', label: 'Inf. Sky', key: '#', category: 'special', nameId: 'Telur Infected Sky' },
    { type: 'spawn_jj', label: 'JJ', key: '$', category: 'special', nameId: 'Telur JJ' },
    { type: 'spawn_mikey', label: 'Mikey', key: '%', category: 'special', nameId: 'Telur Mikey' },
    { type: 'spawn_redsun', label: 'Red Sun', key: '^', category: 'special', nameId: 'Telur Red Sun' },
    { type: 'spawn_lunarmoon', label: 'Lunar Moon', key: '&', category: 'special', nameId: 'Telur Lunar Moon' },
    { type: 'spawn_cursedthomas', label: 'C. Thomas', key: '*', category: 'special', nameId: 'Telur Cursed Thomas' },
    { type: 'spawn_bananakid', label: 'BananaKid', key: '~', category: 'special', nameId: 'Telur BananaKid' },
    { type: 'spawn_carrie', label: 'Carrie', key: '_', category: 'special', nameId: 'Telur Carrie' },
    { type: 'spawn_buu', label: 'Buu', key: '|', category: 'special', nameId: 'Telur Buu' },
    { type: 'spawn_cookie', label: 'Cookie', key: '?', category: 'special', nameId: 'Telur Cookie' },
    { type: 'spawn_penduduk', label: 'Penduduk', key: '"', category: 'special', nameId: 'Telur Penduduk' },
    { type: 'spawn_steve', label: 'Steve', key: 'F6', category: 'special', nameId: 'Telur Steve' },
    { type: 'spawn_alex', label: 'Alex', key: 'F7', category: 'special', nameId: 'Telur Alex' },
    { type: 'spawn_sandworm', label: 'Sandworm', key: 'F8', category: 'special', nameId: 'Telur Sandworm' },
    { type: 'spawn_optimus', label: 'Optimus', key: 'F9', category: 'special', nameId: 'Telur Optimus' },
    { type: 'spawn_bloop', label: 'Bloop', key: 'F10', category: 'special', nameId: 'Telur Bloop' },
    { type: 'spawn_whaleeater', label: 'Whale Eater', key: 'F12', category: 'special', nameId: 'Telur Whale Eater' },
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
    { type: 'dispenser', label: 'Dispenser', key: 'R', category: 'redstone', nameId: 'Dispenser' },
    { type: 'powered_rail', label: 'Pow Rail', key: '[', category: 'redstone', nameId: 'Rel Berdaya' },
    { type: 'minecart', label: 'Minecart', key: ']', category: 'redstone', nameId: 'Kereta Tambang' },
    { type: 'redstone', label: 'Redstone', key: ':', category: 'redstone', nameId: 'Kabel Redstone' },
    { type: 'laser', label: 'Laser', key: '{', category: 'redstone', nameId: 'Blok Laser' },
    { type: 'saw', label: 'Gergaji', key: '}', category: 'redstone', nameId: 'Blok Gergaji' }
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
        resultName: 'Senapan Nuklir',
        resultCount: 1,
        pattern: [' SC', 'S C', ' SC'],
        key: { S: 'stick', C: 'crop' },
        description: 'Senapan nuklir jarak jauh berdaya ledak tinggi. Mendukung Kekuatan, Hentakan, dan Aspek Api.'
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
        id: 'powered_rail',
        category: 'block',
        result: 'powered_rail',
        resultName: 'Rel Berdaya',
        resultCount: 6,
        pattern: ['G G', 'GSG', 'GCG'],
        key: { G: 'gold_ingot', S: 'stick', C: 'coal' },
        description: 'Mempercepat Minecart saat aktif daya, atau mengerem saat mati.'
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
    }),
    defineRecipe({
        id: 'redstone',
        category: 'block',
        result: 'redstone',
        resultName: 'Kabel Redstone',
        resultCount: 8,
        pattern: [' C ', 'CIC', ' C '],
        key: { C: 'coal', I: 'iron_ingot' },
        description: 'Menghantarkan sinyal dari tuas/tombol/pelat hingga 15 blok ke mekanisme dan laser.'
    }),
    defineRecipe({
        id: 'laser',
        category: 'block',
        result: 'laser',
        resultName: 'Blok Laser',
        resultCount: 1,
        pattern: ['III', 'RDR', 'III'],
        key: { I: 'iron_ingot', R: 'redstone', D: 'diamond' },
        description: 'Memancarkan sinar laser berbahaya saat dialiri sinyal Redstone atau tuas.'
    }),
    defineRecipe({
        id: 'saw',
        category: 'block',
        result: 'saw',
        resultName: 'Blok Gergaji',
        resultCount: 1,
        pattern: [' I ', 'IRI', 'SSS'],
        key: { I: 'iron_ingot', R: 'redstone', S: 'stone' },
        description: 'Gergaji cakram berputar otomatis yang melukai siapa saja yang menyentuhnya.'
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

export function isRecipeIngredientMatch(expected, actual) {
    if (!expected || !actual) return expected === actual;
    if (expected === actual) return true;
    return expected === 'stone' && actual === 'cobblestone';
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
                    if (!isRecipeIngredientMatch(expected, actual)) {
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
    for (const recipe of CRAFTING_RECIPES) {
        if (!recipe.shapeless || recipe.gridSize > size) continue;
        if (recipe.shapeless.length !== occupiedTypes.length) continue;
        const normalizedOccupied = occupiedTypes
            .map(t => (recipe.ingredients?.stone && t === 'cobblestone' ? 'stone' : t))
            .sort()
            .join('|');
        const sortedReq = [...recipe.shapeless].sort().join('|');
        if (normalizedOccupied === sortedReq) {
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

function takeOneMatchingFromSlots(slots, expectedType, preferredType = null) {
    const order = [expectedType];
    if (expectedType === 'stone') order.push('cobblestone');
    if (preferredType && order.includes(preferredType)) {
        order.splice(order.indexOf(preferredType), 1);
        order.unshift(preferredType);
    }
    for (const targetType of order) {
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            if (slot && slot.type === targetType && isStackableItem(slot) && slot.count > 0) {
                slot.count -= 1;
                if (slot.count <= 0) slots[i] = null;
                return targetType;
            }
        }
    }
    return null;
}

export function populateGridForRecipe(inventorySlots, gridCells, size, recipe) {
    if (!recipe || recipe.gridSize > size) {
        return { ok: false, reason: 'Resep ini membutuhkan Grid 3x3 di Meja Crafting.' };
    }
    const targetCells = getRecipePatternCells(recipe, size);
    if (!targetCells) return { ok: false, reason: 'Pola tidak muat di grid saat ini.' };

    const bagCountsBefore = countInventoryMaterials(inventorySlots);
    const matchesExistingLayout = targetCells.every((expectedType, i) => {
        const cur = gridCells[i];
        if (expectedType === null) return cur === null;
        if (cur === null) return true;
        return isRecipeIngredientMatch(expectedType, cur.type) &&
            cur.count < 64 &&
            (bagCountsBefore[cur.type] || 0) > 0;
    }) && gridCells.every((cur, i) => cur === null || isRecipeIngredientMatch(targetCells[i], cur.type));

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

    for (let i = 0; i < targetCells.length; i++) {
        const t = targetCells[i];
        if (!t) continue;
        const pickedType = takeOneMatchingFromSlots(inventorySlots, t, gridCells[i]?.type || null);
        if (!pickedType) continue;
        if (gridCells[i] && gridCells[i].type === pickedType) {
            gridCells[i].count += 1;
        } else {
            gridCells[i] = { type: pickedType, count: 1 };
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
        const avail = ing === 'stone'
            ? (counts.stone || 0) + (counts.cobblestone || 0)
            : (counts[ing] || 0);
        if (avail < req) return false;
    }
    return true;
}

export function deductRecipeFromSlots(slots, recipe) {
    if (!canCraftRecipeFromSlots(slots, recipe)) return false;
    for (const [ing, req] of Object.entries(recipe.ingredients)) {
        let rem = req;
        for (let i = 0; i < slots.length && rem > 0; i++) {
            const slot = slots[i];
            if (slot && isRecipeIngredientMatch(ing, slot.type) && isStackableItem(slot)) {
                const take = Math.min(rem, slot.count);
                slot.count -= take;
                rem -= take;
                if (slot.count <= 0) slots[i] = null;
            }
        }
    }
    return true;
}

// ==========================================
// RAILS, MINECART, REDSTONE & PISTON LOGIC
// ==========================================

export const DIRECTION_VECTORS = {
    n: { x: 0, y: 0, z: -1 },
    s: { x: 0, y: 0, z: 1 },
    e: { x: 1, y: 0, z: 0 },
    w: { x: -1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    down: { x: 0, y: -1, z: 0 }
};

const RAIL_CORNER_ARCS = {
    ne: { cx: 0.5, cz: -0.5, tMin: Math.PI / 2, tMax: Math.PI },
    nw: { cx: -0.5, cz: -0.5, tMin: 0, tMax: Math.PI / 2 },
    sw: { cx: -0.5, cz: 0.5, tMin: -Math.PI / 2, tMax: 0 },
    se: { cx: 0.5, cz: 0.5, tMin: -Math.PI, tMax: -Math.PI / 2 }
};

const RAIL_ASC_DIRS = {
    asc_n: { x: 0, z: -1 },
    asc_s: { x: 0, z: 1 },
    asc_e: { x: 1, z: 0 },
    asc_w: { x: -1, z: 0 }
};

const PISTON_IMMOVABLE_BASES = new Set([
    'obsidian',
    'chest',
    'enchanting_table',
    'crafting',
    'piston_head'
]);

const PISTON_CRUSHABLE_BASES = new Set([
    'water',
    'lava',
    'crop',
    'rail',
    'powered_rail',
    'redstone',
    'pressure_plate',
    'button',
    'lever'
]);

function clamp01(v) {
    return Math.max(0, Math.min(1, v));
}

export function isRailBlock(type) {
    const base = normalizeBlockType(type);
    return base === 'rail' || base === 'powered_rail';
}

export function getRailShape(type) {
    return parseBlockState(type).shape;
}

export const RAIL_SHAPES_ORDER = ['ns', 'ew', 'ne', 'nw', 'sw', 'se'];

const RAIL_SHAPE_ENDPOINTS = {
    ns: ['n', 's'],
    ew: ['e', 'w'],
    ne: ['n', 'e'],
    nw: ['n', 'w'],
    sw: ['s', 'w'],
    se: ['s', 'e']
};

export function hasConnectingRailAt(getBlockAt, x, y, z) {
    if (!getBlockAt) return false;
    return (
        isRailBlock(getBlockAt(x, y, z)) ||
        isRailBlock(getBlockAt(x, y - 1, z)) ||
        isRailBlock(getBlockAt(x, y + 1, z))
    );
}

export function cycleRailShape(getBlockAt, x, y, z, currentShape = 'ns', allowCurves = true) {
    if (!allowCurves) {
        return currentShape === 'ew' ? 'ns' : 'ew';
    }
    const n = hasConnectingRailAt(getBlockAt, x, y, z - 1);
    const s = hasConnectingRailAt(getBlockAt, x, y, z + 1);
    const e = hasConnectingRailAt(getBlockAt, x + 1, y, z);
    const w = hasConnectingRailAt(getBlockAt, x - 1, y, z);
    const dirs = { n, s, e, w };
    const neighborCount = (n ? 1 : 0) + (s ? 1 : 0) + (e ? 1 : 0) + (w ? 1 : 0);

    let candidates = RAIL_SHAPES_ORDER;
    if (neighborCount >= 3) {
        const connected = RAIL_SHAPES_ORDER.filter((sh) => {
            const [d1, d2] = RAIL_SHAPE_ENDPOINTS[sh];
            return dirs[d1] && dirs[d2];
        });
        if (connected.length > 0) candidates = connected;
    }

    const idx = candidates.indexOf(currentShape);
    return candidates[(idx + 1) % candidates.length];
}

export function computeInitialRailShape(lookDir) {
    if (!lookDir) return 'ns';
    return Math.abs(lookDir.x || 0) >= Math.abs(lookDir.z || 0) ? 'ew' : 'ns';
}

export function computeRailShape(getBlockAt, x, y, z, allowCurves = true, fallbackShape = 'ns') {
    const upN = isRailBlock(getBlockAt(x, y + 1, z - 1));
    const upS = isRailBlock(getBlockAt(x, y + 1, z + 1));
    const upE = isRailBlock(getBlockAt(x + 1, y + 1, z));
    const upW = isRailBlock(getBlockAt(x - 1, y + 1, z));

    if (upN) return 'asc_n';
    if (upS) return 'asc_s';
    if (upE) return 'asc_e';
    if (upW) return 'asc_w';

    const hasDir = (dx, dz) =>
        isRailBlock(getBlockAt(x + dx, y, z + dz)) ||
        isRailBlock(getBlockAt(x + dx, y - 1, z + dz));

    const n = hasDir(0, -1);
    const s = hasDir(0, 1);
    const e = hasDir(1, 0);
    const w = hasDir(-1, 0);

    if ((n || s) && !(e || w)) return 'ns';
    if ((e || w) && !(n || s)) return 'ew';

    if (allowCurves) {
        if (n && e && !s && !w) return 'ne';
        if (n && w && !s && !e) return 'nw';
        if (s && e && !n && !w) return 'se';
        if (s && w && !n && !e) return 'sw';

        const endpoints = RAIL_SHAPE_ENDPOINTS[fallbackShape];
        if (endpoints) {
            const dirs = { n, s, e, w };
            if (dirs[endpoints[0]] && dirs[endpoints[1]]) {
                return fallbackShape;
            }
        }
    }

    if (n && s) return 'ns';
    if (e && w) return 'ew';
    if (n || s) return 'ns';
    if (e || w) return 'ew';
    return allowCurves ? fallbackShape : (fallbackShape === 'ew' ? 'ew' : 'ns');
}

function getRailSurfaceY(rx, ry, rz, shape, x, z) {
    const baseSurface = ry - 0.44;
    if (shape === 'asc_n') return baseSurface + clamp01(0.5 - (z - rz));
    if (shape === 'asc_s') return baseSurface + clamp01(0.5 + (z - rz));
    if (shape === 'asc_e') return baseSurface + clamp01(0.5 + (x - rx));
    if (shape === 'asc_w') return baseSurface + clamp01(0.5 - (x - rx));
    return baseSurface;
}

export function findRailAtCartPos(getBlockAt, x, y, z) {
    const rx = Math.round(x);
    const rz = Math.round(z);
    const baseY = Math.round(y);
    let best = null;
    let bestDist = Infinity;

    for (const cy of [baseY, baseY - 1, baseY + 1]) {
        const raw = getBlockAt(rx, cy, rz);
        if (!isRailBlock(raw)) continue;
        const parsed = parseBlockState(raw);
        const surfY = getRailSurfaceY(rx, cy, rz, parsed.shape, x, z);
        const dist = Math.abs(y - surfY);
        if (dist <= 0.85 && dist < bestDist) {
            bestDist = dist;
            best = {
                x: rx,
                y: cy,
                z: rz,
                type: raw,
                base: parsed.base,
                shape: parsed.shape,
                active: parsed.active
            };
        }
    }
    return best;
}

function stepMinecartSubstep({
    x, y, z, vx, vz, yaw = 0,
    rail,
    isPowered = false,
    riderInput = null,
    getBlockAt,
    stepDt
}) {
    const rx = rail.x;
    const ry = rail.y;
    const rz = rail.z;
    const shape = rail.shape;
    const isPoweredRail = rail.base === 'powered_rail';
    const arc = RAIL_CORNER_ARCS[shape];

    if (arc) {
        const cx = rx + arc.cx;
        const cz = rz + arc.cz;
        const tMid = (arc.tMin + arc.tMax) * 0.5;
        let theta = Math.atan2(z - cz, x - cx);
        while (theta - tMid > Math.PI) theta -= Math.PI * 2;
        while (theta - tMid < -Math.PI) theta += Math.PI * 2;
        theta = Math.max(arc.tMin, Math.min(arc.tMax, theta));

        const tx = -Math.sin(theta);
        const tz = Math.cos(theta);
        let tSpeed = vx * tx + vz * tz;

        if (riderInput && (riderInput.wishX || riderInput.wishZ)) {
            const wishDot = (riderInput.wishX || 0) * tx + (riderInput.wishZ || 0) * tz;
            if (Math.abs(wishDot) > 0.2) {
                const wishSign = Math.sign(wishDot);
                const reversing = Math.abs(tSpeed) > 0.2 && Math.sign(tSpeed) !== wishSign;
                if (reversing || Math.abs(tSpeed) < 7.5) {
                    tSpeed += wishSign * (reversing ? 12.0 : 9.0) * stepDt;
                }
            }
        }

        if (isPoweredRail && isPowered) {
            if (Math.abs(tSpeed) < 0.25 && getBlockAt) {
                const minDx = Math.round(Math.sin(arc.tMin));
                const minDz = Math.round(-Math.cos(arc.tMin));
                const maxDx = Math.round(-Math.sin(arc.tMax));
                const maxDz = Math.round(Math.cos(arc.tMax));
                const minBlocked = isSolidBlock(getBlockAt(rx + minDx, ry, rz + minDz));
                const maxBlocked = isSolidBlock(getBlockAt(rx + maxDx, ry, rz + maxDz));
                const minHasRail = hasConnectingRailAt(getBlockAt, rx + minDx, ry, rz + minDz);
                const maxHasRail = hasConnectingRailAt(getBlockAt, rx + maxDx, ry, rz + maxDz);

                if (minBlocked && !maxBlocked) {
                    tSpeed = 9.5;
                } else if (maxBlocked && !minBlocked) {
                    tSpeed = -9.5;
                } else if (!maxBlocked && maxHasRail && !minHasRail) {
                    tSpeed = 9.5;
                } else if (!minBlocked && minHasRail && !maxHasRail) {
                    tSpeed = -9.5;
                } else if (riderInput && (riderInput.wishX || riderInput.wishZ)) {
                    const wishDot = (riderInput.wishX || 0) * tx + (riderInput.wishZ || 0) * tz;
                    if (Math.abs(wishDot) > 0.15) tSpeed = Math.sign(wishDot) * 9.5;
                }
            } else if (Math.abs(tSpeed) >= 0.05) {
                tSpeed += Math.sign(tSpeed) * 28.0 * stepDt;
            }
        } else if (isPoweredRail && !isPowered) {
            const brakeDrop = Math.min(Math.abs(tSpeed), 18.0 * stepDt);
            tSpeed -= Math.sign(tSpeed) * brakeDrop;
            if (Math.abs(tSpeed) < 0.15) tSpeed = 0;
        } else {
            tSpeed *= Math.exp(-0.18 * stepDt);
            if (!riderInput && Math.abs(tSpeed) < 0.06) tSpeed = 0;
        }

        tSpeed = Math.max(-16.0, Math.min(16.0, tSpeed));
        const bank = Math.max(-0.34, Math.min(0.34, tSpeed * 0.028));

        const thetaNext = theta + (tSpeed * stepDt) / 0.5;
        if (thetaNext < arc.tMin) {
            const over = (arc.tMin - thetaNext) * 0.5;
            const eTx = -Math.sin(arc.tMin);
            const eTz = Math.cos(arc.tMin);
            const outVx = tSpeed * eTx;
            const outVz = tSpeed * eTz;
            const nx = cx + 0.5 * Math.cos(arc.tMin) - eTx * over;
            const nz = cz + 0.5 * Math.sin(arc.tMin) - eTz * over;
            const probeDist = Math.max(over, 0.05);
            const gx = Math.round(cx + 0.5 * Math.cos(arc.tMin) - eTx * probeDist);
            const gz = Math.round(cz + 0.5 * Math.sin(arc.tMin) - eTz * probeDist);
            if (getBlockAt && isSolidBlock(getBlockAt(gx, ry, gz))) {
                const bouncedSpeed = -tSpeed * 0.65;
                const bTheta = Math.min(arc.tMax, arc.tMin + 0.08);
                return {
                    x: cx + 0.5 * Math.cos(bTheta),
                    y: ry - 0.44,
                    z: cz + 0.5 * Math.sin(bTheta),
                    vx: bouncedSpeed * (-Math.sin(bTheta)),
                    vz: bouncedSpeed * Math.cos(bTheta),
                    yaw: Math.abs(bouncedSpeed) > 0.05 ? Math.atan2(bouncedSpeed * (-Math.sin(bTheta)), bouncedSpeed * Math.cos(bTheta)) : yaw,
                    pitch: 0,
                    bank: 0,
                    bounced: true
                };
            }
            if (getBlockAt && !hasConnectingRailAt(getBlockAt, gx, ry, gz)) {
                const clampTheta = Math.min(arc.tMax, arc.tMin + 0.02);
                return {
                    x: cx + 0.5 * Math.cos(clampTheta),
                    y: ry - 0.44,
                    z: cz + 0.5 * Math.sin(clampTheta),
                    vx: 0,
                    vz: 0,
                    yaw,
                    pitch: 0,
                    bank: 0,
                    bounced: false
                };
            }
            return {
                x: nx,
                y: ry - 0.44,
                z: nz,
                vx: outVx,
                vz: outVz,
                yaw: Math.abs(tSpeed) > 0.05 ? Math.atan2(outVx, outVz) : yaw,
                pitch: 0,
                bank,
                bounced: false
            };
        }

        if (thetaNext > arc.tMax) {
            const over = (thetaNext - arc.tMax) * 0.5;
            const eTx = -Math.sin(arc.tMax);
            const eTz = Math.cos(arc.tMax);
            const outVx = tSpeed * eTx;
            const outVz = tSpeed * eTz;
            const nx = cx + 0.5 * Math.cos(arc.tMax) + eTx * over;
            const nz = cz + 0.5 * Math.sin(arc.tMax) + eTz * over;
            const probeDist = Math.max(over, 0.05);
            const gx = Math.round(cx + 0.5 * Math.cos(arc.tMax) + eTx * probeDist);
            const gz = Math.round(cz + 0.5 * Math.sin(arc.tMax) + eTz * probeDist);
            if (getBlockAt && isSolidBlock(getBlockAt(gx, ry, gz))) {
                const bouncedSpeed = -tSpeed * 0.65;
                const bTheta = Math.max(arc.tMin, arc.tMax - 0.08);
                return {
                    x: cx + 0.5 * Math.cos(bTheta),
                    y: ry - 0.44,
                    z: cz + 0.5 * Math.sin(bTheta),
                    vx: bouncedSpeed * (-Math.sin(bTheta)),
                    vz: bouncedSpeed * Math.cos(bTheta),
                    yaw: Math.abs(bouncedSpeed) > 0.05 ? Math.atan2(bouncedSpeed * (-Math.sin(bTheta)), bouncedSpeed * Math.cos(bTheta)) : yaw,
                    pitch: 0,
                    bank: 0,
                    bounced: true
                };
            }
            if (getBlockAt && !hasConnectingRailAt(getBlockAt, gx, ry, gz)) {
                const clampTheta = Math.max(arc.tMin, arc.tMax - 0.02);
                return {
                    x: cx + 0.5 * Math.cos(clampTheta),
                    y: ry - 0.44,
                    z: cz + 0.5 * Math.sin(clampTheta),
                    vx: 0,
                    vz: 0,
                    yaw,
                    pitch: 0,
                    bank: 0,
                    bounced: false
                };
            }
            return {
                x: nx,
                y: ry - 0.44,
                z: nz,
                vx: outVx,
                vz: outVz,
                yaw: Math.abs(tSpeed) > 0.05 ? Math.atan2(outVx, outVz) : yaw,
                pitch: 0,
                bank,
                bounced: false
            };
        }

        const nx = cx + 0.5 * Math.cos(thetaNext);
        const nz = cz + 0.5 * Math.sin(thetaNext);
        const nTx = -Math.sin(thetaNext);
        const nTz = Math.cos(thetaNext);
        const outVx = tSpeed * nTx;
        const outVz = tSpeed * nTz;
        return {
            x: nx,
            y: ry - 0.44,
            z: nz,
            vx: outVx,
            vz: outVz,
            yaw: Math.abs(tSpeed) > 0.05 ? Math.atan2(outVx, outVz) : yaw,
            pitch: 0,
            bank,
            bounced: false
        };
    }

    const isEastWest = shape === 'ew' || shape === 'asc_e' || shape === 'asc_w';
    const ax = isEastWest ? 1 : 0;
    const az = isEastWest ? 0 : 1;
    let vAxis = vx * ax + vz * az;

    if (riderInput && (riderInput.wishX || riderInput.wishZ)) {
        const wishDot = (riderInput.wishX || 0) * ax + (riderInput.wishZ || 0) * az;
        if (Math.abs(wishDot) > 0.2) {
            const wishSign = Math.sign(wishDot);
            const reversing = Math.abs(vAxis) > 0.2 && Math.sign(vAxis) !== wishSign;
            if (reversing || Math.abs(vAxis) < 7.5) {
                vAxis += wishSign * (reversing ? 12.0 : 9.0) * stepDt;
            }
        }
    }

    const ascVec = RAIL_ASC_DIRS[shape];
    if (ascVec) {
        const ascSign = ascVec.x * ax + ascVec.z * az;
        vAxis -= ascSign * 11.0 * stepDt;
    }

    if (isPoweredRail && isPowered) {
        if (Math.abs(vAxis) < 0.25 && getBlockAt) {
            const posBlocked = isSolidBlock(getBlockAt(rx + ax, ry, rz + az));
            const negBlocked = isSolidBlock(getBlockAt(rx - ax, ry, rz - az));
            const posHasRail = hasConnectingRailAt(getBlockAt, rx + ax, ry, rz + az);
            const negHasRail = hasConnectingRailAt(getBlockAt, rx - ax, ry, rz - az);
            if (negBlocked && !posBlocked) {
                vAxis = 9.5;
            } else if (posBlocked && !negBlocked) {
                vAxis = -9.5;
            } else if (!posBlocked && posHasRail && !negHasRail) {
                vAxis = 9.5;
            } else if (!negBlocked && negHasRail && !posHasRail) {
                vAxis = -9.5;
            } else if (riderInput && (riderInput.wishX || riderInput.wishZ)) {
                const wishDot = (riderInput.wishX || 0) * ax + (riderInput.wishZ || 0) * az;
                if (Math.abs(wishDot) > 0.15) vAxis = Math.sign(wishDot) * 9.5;
            }
        } else if (Math.abs(vAxis) >= 0.05) {
            vAxis += Math.sign(vAxis) * 28.0 * stepDt;
        }
    } else if (isPoweredRail && !isPowered) {
        const brakeDrop = Math.min(Math.abs(vAxis), 18.0 * stepDt);
        vAxis -= Math.sign(vAxis) * brakeDrop;
        if (Math.abs(vAxis) < 0.15) vAxis = 0;
    } else {
        vAxis *= Math.exp(-0.20 * stepDt);
        if (!ascVec && !riderInput && Math.abs(vAxis) < 0.08) vAxis = 0;
    }

    vAxis = Math.max(-16.0, Math.min(16.0, vAxis));

    const sCur = isEastWest ? (x - rx) : (z - rz);
    const sNext = sCur + vAxis * stepDt;
    let nextX = isEastWest ? (rx + sNext) : rx;
    let nextZ = isEastWest ? rz : (rz + sNext);
    let nextY = getRailSurfaceY(rx, ry, rz, shape, nextX, nextZ);

    let bounced = false;
    if (getBlockAt && Math.abs(sNext) > 0.42) {
        const sign = Math.sign(sNext);
        const checkX = isEastWest ? (rx + sign) : rx;
        const checkZ = isEastWest ? rz : (rz + sign);
        const checkY = ascVec ? Math.round(nextY + 0.25) : ry;
        if (isSolidBlock(getBlockAt(checkX, checkY, checkZ))) {
            vAxis = -vAxis * 0.65;
            const clampedS = sign * 0.28;
            nextX = isEastWest ? (rx + clampedS) : rx;
            nextZ = isEastWest ? rz : (rz + clampedS);
            nextY = getRailSurfaceY(rx, ry, rz, shape, nextX, nextZ);
            bounced = true;
        } else if (Math.abs(sNext) > 0.44 && !hasConnectingRailAt(getBlockAt, checkX, ry, checkZ)) {
            vAxis = 0;
            const clampedS = sign * 0.44;
            nextX = isEastWest ? (rx + clampedS) : rx;
            nextZ = isEastWest ? rz : (rz + clampedS);
            nextY = getRailSurfaceY(rx, ry, rz, shape, nextX, nextZ);
        }
    }

    const outVx = vAxis * ax;
    const outVz = vAxis * az;
    const nextYaw = Math.abs(vAxis) > 0.05 ? Math.atan2(outVx, outVz) : yaw;
    let pitch = 0;
    if (ascVec && Math.abs(vAxis) > 0.05) {
        const ascSign = ascVec.x * ax + ascVec.z * az;
        pitch = (Math.sign(vAxis) === Math.sign(ascSign)) ? -Math.PI / 5 : Math.PI / 5;
    }

    return {
        x: nextX,
        y: nextY,
        z: nextZ,
        vx: outVx,
        vz: outVz,
        yaw: nextYaw,
        pitch,
        bank: 0,
        bounced
    };
}

export function stepMinecartOnRail({
    x, y, z, vx, vz, yaw = 0,
    rail,
    isPowered = false,
    riderInput = null,
    getBlockAt,
    dt
}) {
    const totalDt = Math.min(Math.max(dt || 0, 0), 0.05);
    if (totalDt <= 0) {
        return { x, y, z, vx, vz, yaw, pitch: 0, bank: 0, bounced: false };
    }

    const horizSpeed = Math.hypot(vx, vz);
    const steps = Math.max(1, Math.min(4, Math.ceil((Math.max(horizSpeed, 4) * totalDt) / 0.22)));
    const stepDt = totalDt / steps;

    let state = { x, y, z, vx, vz, yaw, pitch: 0, bank: 0, bounced: false };
    let curRail = rail;
    let anyBounced = false;

    for (let i = 0; i < steps; i++) {
        if (i > 0 && getBlockAt) {
            const nextRail = findRailAtCartPos(getBlockAt, state.x, state.y, state.z);
            if (!nextRail) break;
            curRail = nextRail;
        }
        const res = stepMinecartSubstep({
            x: state.x,
            y: state.y,
            z: state.z,
            vx: state.vx,
            vz: state.vz,
            yaw: state.yaw,
            rail: curRail,
            isPowered: curRail.base === 'powered_rail' ? isPowered : false,
            riderInput,
            getBlockAt,
            stepDt
        });
        state = res;
        if (res.bounced) anyBounced = true;
    }

    return { ...state, bounced: anyBounced };
}

export function computeRailLaunchVelocity(getBlockAt, rail, triggerX, triggerZ, speed = 8.5) {
    if (!rail) return { vx: 0, vz: 0 };
    const rx = rail.x;
    const ry = rail.y;
    const rz = rail.z;
    const shape = rail.shape;
    const arc = RAIL_CORNER_ARCS[shape];

    if (arc) {
        const thetaMid = (arc.tMin + arc.tMax) * 0.5;
        const tx = -Math.sin(thetaMid);
        const tz = Math.cos(thetaMid);
        const endpoints = RAIL_SHAPE_ENDPOINTS[shape] || ['n', 'e'];
        const d0 = DIRECTION_VECTORS[endpoints[0]];
        const d1 = DIRECTION_VECTORS[endpoints[1]];
        const open0 = !getBlockAt || (hasConnectingRailAt(getBlockAt, rx + d0.x, ry, rz + d0.z) && !isSolidBlock(getBlockAt(rx + d0.x, ry, rz + d0.z)));
        const open1 = !getBlockAt || (hasConnectingRailAt(getBlockAt, rx + d1.x, ry, rz + d1.z) && !isSolidBlock(getBlockAt(rx + d1.x, ry, rz + d1.z)));

        let targetDir = d0;
        if (open1 && !open0) {
            targetDir = d1;
        } else if (open0 === open1) {
            const awayX = rx - triggerX;
            const awayZ = rz - triggerZ;
            const score0 = awayX * d0.x + awayZ * d0.z;
            const score1 = awayX * d1.x + awayZ * d1.z;
            targetDir = score1 > score0 ? d1 : d0;
        }
        const dot = tx * targetDir.x + tz * targetDir.z;
        const sign = dot >= 0 ? 1 : -1;
        return { vx: tx * sign * speed, vz: tz * sign * speed };
    }

    const isEastWest = shape === 'ew' || shape === 'asc_e' || shape === 'asc_w';
    const ax = isEastWest ? 1 : 0;
    const az = isEastWest ? 0 : 1;

    const posBlocked = getBlockAt ? isSolidBlock(getBlockAt(rx + ax, ry, rz + az)) : false;
    const negBlocked = getBlockAt ? isSolidBlock(getBlockAt(rx - ax, ry, rz - az)) : false;
    const posHasRail = getBlockAt ? hasConnectingRailAt(getBlockAt, rx + ax, ry, rz + az) : true;
    const negHasRail = getBlockAt ? hasConnectingRailAt(getBlockAt, rx - ax, ry, rz - az) : true;

    let sign = 1;
    if (!posBlocked && posHasRail && (negBlocked || !negHasRail)) {
        sign = 1;
    } else if (!negBlocked && negHasRail && (posBlocked || !posHasRail)) {
        sign = -1;
    } else if (negBlocked && !posBlocked) {
        sign = 1;
    } else if (posBlocked && !negBlocked) {
        sign = -1;
    } else {
        const awayDot = (rx - triggerX) * ax + (rz - triggerZ) * az;
        sign = awayDot >= 0 ? 1 : -1;
    }

    return { vx: ax * sign * speed, vz: az * sign * speed };
}

export function getAttachedSupportPos(x, y, z, type) {
    const parsed = parseBlockState(type);
    if (
        parsed.base === 'pressure_plate' ||
        parsed.base === 'rail' ||
        parsed.base === 'powered_rail' ||
        parsed.base === 'redstone' ||
        parsed.base === 'crop'
    ) {
        return { x, y: y - 1, z };
    }
    const dir = DIRECTION_VECTORS[parsed.facing] || DIRECTION_VECTORS.up;
    return { x: x - dir.x, y: y - dir.y, z: z - dir.z };
}

export function isPowerSourceActive(getBlockAt, x, y, z) {
    const raw = getBlockAt(x, y, z);
    if (!raw) return false;
    const parsed = parseBlockState(raw);
    if (parsed.base === 'lever') return parsed.active;
    if (parsed.base === 'button') return parsed.pressed;
    if (parsed.base === 'pressure_plate') return parsed.pressed || parsed.active;
    return false;
}

export function isBlockDirectlyPowered(getBlockAt, x, y, z) {
    const raw = getBlockAt(x, y, z);
    const base = normalizeBlockType(raw);
    if (!raw || !isSolidBlock(raw) || base === 'piston' || base === 'piston_head') {
        return false;
    }

    for (const dir of Object.values(DIRECTION_VECTORS)) {
        const sx = x + dir.x;
        const sy = y + dir.y;
        const sz = z + dir.z;
        if (!isPowerSourceActive(getBlockAt, sx, sy, sz)) continue;
        const sup = getAttachedSupportPos(sx, sy, sz, getBlockAt(sx, sy, sz));
        if (sup.x === x && sup.y === y && sup.z === z) {
            return true;
        }
    }
    return false;
}

const HORIZ_WIRE_DIRS = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 }
];

export function isRedstoneWireActive(getBlockAt, x, y, z, maxHops = 15) {
    if (normalizeBlockType(getBlockAt(x, y, z)) !== 'redstone') return false;
    const queue = [{ x, y, z, dist: 0 }];
    const visited = new Set([`${x},${y},${z}`]);

    while (queue.length > 0) {
        const cur = queue.shift();
        for (const dir of Object.values(DIRECTION_VECTORS)) {
            const nx = cur.x + dir.x;
            const ny = cur.y + dir.y;
            const nz = cur.z + dir.z;
            if (isPowerSourceActive(getBlockAt, nx, ny, nz) || isBlockDirectlyPowered(getBlockAt, nx, ny, nz)) {
                return true;
            }
        }
        if (cur.dist >= maxHops) continue;

        for (const d of HORIZ_WIRE_DIRS) {
            for (const dy of [-1, 0, 1]) {
                const nx = cur.x + d.dx;
                const ny = cur.y + dy;
                const nz = cur.z + d.dz;
                const key = `${nx},${ny},${nz}`;
                if (visited.has(key)) continue;
                if (normalizeBlockType(getBlockAt(nx, ny, nz)) !== 'redstone') continue;
                visited.add(key);
                queue.push({ x: nx, y: ny, z: nz, dist: cur.dist + 1 });
            }
        }
    }
    return false;
}

export function isMechanismPowered(getBlockAt, x, y, z) {
    for (const dir of Object.values(DIRECTION_VECTORS)) {
        const nx = x + dir.x;
        const ny = y + dir.y;
        const nz = z + dir.z;
        if (isPowerSourceActive(getBlockAt, nx, ny, nz)) return true;
        if (isBlockDirectlyPowered(getBlockAt, nx, ny, nz)) return true;
        if (normalizeBlockType(getBlockAt(nx, ny, nz)) === 'redstone' && isRedstoneWireActive(getBlockAt, nx, ny, nz)) {
            return true;
        }
    }
    return false;
}

export function isPoweredRailActive(getBlockAt, x, y, z, maxHops = 8) {
    const queue = [{ x, y, z, dist: 0 }];
    const visited = new Set([`${x},${y},${z}`]);

    while (queue.length > 0) {
        const cur = queue.shift();
        if (isMechanismPowered(getBlockAt, cur.x, cur.y, cur.z)) {
            return true;
        }
        if (cur.dist >= maxHops) continue;

        const shape = getRailShape(getBlockAt(cur.x, cur.y, cur.z));
        const endpoints = RAIL_SHAPE_ENDPOINTS[shape];
        let axes;
        if (endpoints) {
            axes = endpoints.map((ep) => {
                const v = DIRECTION_VECTORS[ep];
                return { dx: v.x, dz: v.z };
            });
        } else {
            const isEW = shape === 'ew' || shape === 'asc_e' || shape === 'asc_w';
            axes = isEW ? [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }] : [{ dx: 0, dz: -1 }, { dx: 0, dz: 1 }];
        }

        for (const a of axes) {
            for (const dy of [-1, 0, 1]) {
                const nx = cur.x + a.dx;
                const ny = cur.y + dy;
                const nz = cur.z + a.dz;
                const key = `${nx},${ny},${nz}`;
                if (visited.has(key)) continue;
                if (normalizeBlockType(getBlockAt(nx, ny, nz)) !== 'powered_rail') continue;
                visited.add(key);
                queue.push({ x: nx, y: ny, z: nz, dist: cur.dist + 1 });
            }
        }
    }
    return false;
}

export const LASER_DIRECTION_VECTORS = {
    n: { x: 0, y: 0, z: -1 },
    s: { x: 0, y: 0, z: 1 },
    e: { x: 1, y: 0, z: 0 },
    w: { x: -1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    down: { x: 0, y: -1, z: 0 },
    ne: { x: 1, y: 0, z: -1 },
    nw: { x: -1, y: 0, z: -1 },
    se: { x: 1, y: 0, z: 1 },
    sw: { x: -1, y: 0, z: 1 },
    up_n: { x: 0, y: 1, z: -1 },
    up_e: { x: 1, y: 1, z: 0 },
    up_s: { x: 0, y: 1, z: 1 },
    up_w: { x: -1, y: 1, z: 0 },
    down_n: { x: 0, y: -1, z: -1 },
    down_e: { x: 1, y: -1, z: 0 },
    down_s: { x: 0, y: -1, z: 1 },
    down_w: { x: -1, y: -1, z: 0 }
};

export const LASER_FACING_ORDER = [
    'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw',
    'up', 'up_n', 'up_e', 'up_s', 'up_w',
    'down', 'down_n', 'down_e', 'down_s', 'down_w'
];

export function computeLaserFacing(lookDir) {
    if (!lookDir) return 'e';
    const ax = -(lookDir.x || 0);
    const ay = -(lookDir.y || 0);
    const az = -(lookDir.z || 0);
    const len = Math.hypot(ax, ay, az);
    if (len < 1e-6) return 'e';
    const nx = ax / len;
    const ny = ay / len;
    const nz = az / len;

    let bestFacing = 'e';
    let bestDot = -Infinity;
    for (const facing of LASER_FACING_ORDER) {
        const v = LASER_DIRECTION_VECTORS[facing];
        const vLen = Math.hypot(v.x, v.y, v.z);
        const dot = (nx * v.x + ny * v.y + nz * v.z) / vLen;
        if (dot > bestDot) {
            bestDot = dot;
            bestFacing = facing;
        }
    }
    return bestFacing;
}

export function computeLaserBeam(getBlockAt, lx, ly, lz, facing = 'e', maxRange = 20) {
    const dir = LASER_DIRECTION_VECTORS[facing] || DIRECTION_VECTORS.e;
    const stepLen = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const unitDir = { x: dir.x / stepLen, y: dir.y / stepLen, z: dir.z / stepLen };
    const nonZeroAxes = ['x', 'y', 'z'].filter(axis => dir[axis] !== 0);
    const isDiagonal = nonZeroAxes.length === 2;
    const cells = [];
    let hitBlock = null;

    for (let step = 1; step <= maxRange; step++) {
        const prevX = lx + dir.x * (step - 1);
        const prevY = ly + dir.y * (step - 1);
        const prevZ = lz + dir.z * (step - 1);
        const cx = lx + dir.x * step;
        const cy = ly + dir.y * step;
        const cz = lz + dir.z * step;

        if (isDiagonal) {
            const [a0, a1] = nonZeroAxes;
            const c1x = prevX + (a0 === 'x' ? dir.x : 0);
            const c1y = prevY + (a0 === 'y' ? dir.y : 0);
            const c1z = prevZ + (a0 === 'z' ? dir.z : 0);
            const c2x = prevX + (a1 === 'x' ? dir.x : 0);
            const c2y = prevY + (a1 === 'y' ? dir.y : 0);
            const c2z = prevZ + (a1 === 'z' ? dir.z : 0);
            const b1 = getBlockAt(c1x, c1y, c1z);
            const b2 = getBlockAt(c2x, c2y, c2z);
            if (isSolidBlock(b1) && isSolidBlock(b2)) {
                hitBlock = { x: c1x, y: c1y, z: c1z, type: b1 };
                break;
            }
        }

        const block = getBlockAt(cx, cy, cz);
        if (isSolidBlock(block)) {
            hitBlock = { x: cx, y: cy, z: cz, type: block };
            break;
        }
        cells.push({ x: cx, y: cy, z: cz });
    }

    return {
        origin: { x: lx, y: ly, z: lz },
        dir,
        unitDir,
        facing,
        length: cells.length,
        worldLength: cells.length * stepLen,
        cells,
        hitBlock
    };
}

export function isEntityInLaserBeam(px, py, pz, radius, height, beam) {
    if (!beam || !Array.isArray(beam.cells) || beam.cells.length === 0) return false;
    for (const c of beam.cells) {
        if (entityOverlapsBlock(px, py, pz, radius, height, c.x, c.y, c.z)) {
            return true;
        }
    }
    return false;
}

export function isEntityTouchingSaw(getBlockAt, px, py, pz, radius, height) {
    const minBX = Math.floor(px - radius + 0.5);
    const maxBX = Math.ceil(px + radius - 0.5);
    const minBY = Math.min(Math.floor(py + 0.5), Math.round(py - 0.55));
    const maxBY = Math.ceil(py + height - 0.5);
    const minBZ = Math.floor(pz - radius + 0.5);
    const maxBZ = Math.ceil(pz + radius - 0.5);

    for (let bx = minBX; bx <= maxBX; bx++) {
        for (let by = minBY; by <= maxBY; by++) {
            for (let bz = minBZ; bz <= maxBZ; bz++) {
                if (normalizeBlockType(getBlockAt(bx, by, bz)) !== 'saw') continue;
                const overlapX = (px + radius > bx - 0.5) && (px - radius < bx + 0.5);
                const overlapZ = (pz + radius > bz - 0.5) && (pz - radius < bz + 0.5);
                const overlapY = (py + height > by - 0.5) && (py <= by + 0.58);
                if (overlapX && overlapY && overlapZ) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function computePistonFacing(lookDir) {
    if (!lookDir) return 'up';
    const ax = Math.abs(lookDir.x || 0);
    const ay = Math.abs(lookDir.y || 0);
    const az = Math.abs(lookDir.z || 0);
    if ((lookDir.y || 0) < -0.65 && ay >= ax && ay >= az) return 'up';
    if ((lookDir.y || 0) > 0.65 && ay >= ax && ay >= az) return 'down';
    if (ax >= az) return (lookDir.x || 0) >= 0 ? 'w' : 'e';
    return (lookDir.z || 0) >= 0 ? 'n' : 's';
}

export function planPistonPush(getBlockAt, px, py, pz, facing = 'up', maxPush = 12, bounds = null) {
    const dir = DIRECTION_VECTORS[facing] || DIRECTION_VECTORS.up;
    const minY = bounds?.minY ?? 1;
    const maxY = bounds?.maxY ?? 63;
    const blocks = [];

    for (let step = 1; step <= maxPush + 1; step++) {
        const cx = px + dir.x * step;
        const cy = py + dir.y * step;
        const cz = pz + dir.z * step;

        if (cy < minY || cy > maxY) {
            return { canPush: false, reason: 'out_of_bounds', blocks: [], crushPos: null };
        }
        if (bounds) {
            if (cx < bounds.minX || cx > bounds.maxX || cz < bounds.minZ || cz > bounds.maxZ) {
                return { canPush: false, reason: 'out_of_bounds', blocks: [], crushPos: null };
            }
        }

        const raw = getBlockAt(cx, cy, cz);
        if (!raw) {
            return { canPush: true, pushCount: blocks.length, blocks, crushPos: null };
        }

        const parsed = parseBlockState(raw);
        if (PISTON_CRUSHABLE_BASES.has(parsed.base)) {
            return {
                canPush: true,
                pushCount: blocks.length,
                blocks,
                crushPos: { x: cx, y: cy, z: cz, type: raw }
            };
        }

        if (PISTON_IMMOVABLE_BASES.has(parsed.base) || (parsed.base === 'piston' && parsed.extended)) {
            return { canPush: false, reason: 'immovable', blocks: [], crushPos: null };
        }

        if (step > maxPush) {
            return { canPush: false, reason: 'limit', blocks: [], crushPos: null };
        }

        blocks.push({ x: cx, y: cy, z: cz, type: raw });
    }

    return { canPush: false, reason: 'limit', blocks: [], crushPos: null };
}

// ==========================================
// CHARACTER ROSTER & ON/OFF SWITCH HELPERS
// ==========================================

export const CHARACTER_ROSTER = [
    // Maizen World & Teman
    { type: 'jj', name: 'JJ', group: 'maizen', role: 'Teman', color: '#ef4444', isUnique: true, isFriendly: true },
    { type: 'mikey', name: 'Mikey', group: 'maizen', role: 'Teman', color: '#22c55e', isUnique: true, isFriendly: true },
    { type: 'bananakid', name: 'BananaKid', group: 'maizen', role: 'Teman', color: '#facc15', isUnique: true, isFriendly: true },
    { type: 'carrie', name: 'Carrie', group: 'maizen', role: 'Teman', color: '#f8fafc', isUnique: true, isFriendly: true },
    { type: 'buu', name: 'Buu', group: 'maizen', role: 'Teman', color: '#14b8a6', isUnique: true, isFriendly: true },
    { type: 'cookie', name: 'Cookie', group: 'maizen', role: 'Teman', color: '#8b5cf6', isUnique: true, isFriendly: true },
    { type: 'penduduk', name: 'Penduduk', group: 'maizen', role: 'Warga', color: '#a67758', isUnique: false, isFriendly: true },
    { type: 'steve', name: 'Steve', group: 'maizen', role: 'Teman', color: '#14b8b8', isUnique: true, isFriendly: true },
    { type: 'alex', name: 'Alex', group: 'maizen', role: 'Teman', color: '#f97316', isUnique: true, isFriendly: true },

    // Penjaga / Golem
    { type: 'irongolem', name: 'Iron Golem', group: 'golem', role: 'Penjaga', color: '#e2e8f0', isUnique: false, isFriendly: false },
    { type: 'snowgolem', name: 'Snow Golem', group: 'golem', role: 'Penjaga', color: '#fb923c', isUnique: false, isFriendly: false },
    { type: 'giantirongolem', name: 'Giant Iron Golem', group: 'golem', role: 'Penjaga', color: '#cbd5e1', isUnique: true, isFriendly: false },
    { type: 'optimus', name: 'Optimus', group: 'golem', role: 'Penjaga', color: '#dc2626', isUnique: true, isFriendly: true },

    // Hewan
    { type: 'chicken', name: 'Ayam', group: 'animal', role: 'Hewan', color: '#fef08a', isUnique: false, isFriendly: false },
    { type: 'pig', name: 'Babi', group: 'animal', role: 'Hewan', color: '#f472b6', isUnique: false, isFriendly: false },
    { type: 'cow', name: 'Sapi', group: 'animal', role: 'Hewan', color: '#78716c', isUnique: false, isFriendly: false },

    // Monster
    { type: 'zombie', name: 'Zombie', group: 'monster', role: 'Monster', color: '#16a34a', isUnique: false, isFriendly: false },
    { type: 'creeper', name: 'Creeper', group: 'monster', role: 'Monster', color: '#4ade80', isUnique: false, isFriendly: false },
    { type: 'skeleton', name: 'Skeleton', group: 'monster', role: 'Monster', color: '#d4d4d8', isUnique: false, isFriendly: false },
    { type: 'witherskeleton', name: 'Wither Skeleton', group: 'monster', role: 'Monster', color: '#3f3f46', isUnique: false, isFriendly: false },
    { type: 'bloodgolem', name: 'Blood Golem', group: 'monster', role: 'Monster', color: '#991b1b', isUnique: false, isFriendly: false },

    // Boss
    { type: 'traineater', name: 'Train Eater', group: 'boss', role: 'Boss', color: '#dc2626', isUnique: true, isFriendly: false },
    { type: 'seaeater', name: 'Sea Eater', group: 'boss', role: 'Boss', color: '#22d3ee', isUnique: true, isFriendly: false },
    { type: 'charles', name: 'Charles', group: 'boss', role: 'Boss', color: '#b91c1c', isUnique: true, isFriendly: false },
    { type: 'infectedocean', name: 'Infected Ocean', group: 'boss', role: 'Boss', color: '#7f1d1d', isUnique: true, isFriendly: false },
    { type: 'infectedsky', name: 'Infected Sky', group: 'boss', role: 'Boss', color: '#e11d48', isUnique: true, isFriendly: false },
    { type: 'redsun', name: 'Red Sun', group: 'boss', role: 'Boss', color: '#ff2a6d', isUnique: true, isFriendly: false },
    { type: 'lunarmoon', name: 'Lunar Moon', group: 'boss', role: 'Boss', color: '#a8a29e', isUnique: true, isFriendly: false },
    { type: 'cursedthomas', name: 'Cursed Thomas', group: 'boss', role: 'Boss', color: '#0ea5e9', isUnique: true, isFriendly: false },
    { type: 'sandworm', name: 'Sandworm', group: 'boss', role: 'Boss', color: '#a16207', isUnique: true, isFriendly: false },
    { type: 'bloop', name: 'Bloop', group: 'boss', role: 'Boss', color: '#47687c', isUnique: true, isFriendly: false },
    { type: 'whaleeater', name: 'Whale Eater', group: 'boss', role: 'Boss', color: '#dc2626', isUnique: true, isFriendly: false }
];

export function createDefaultCharacterSettings() {
    const settings = {};
    for (const entry of CHARACTER_ROSTER) {
        settings[entry.type] = false;
    }
    return settings;
}

export function normalizeCharacterSettings(saved) {
    const normalized = createDefaultCharacterSettings();
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
        return normalized;
    }
    for (const entry of CHARACTER_ROSTER) {
        if (Object.prototype.hasOwnProperty.call(saved, entry.type)) {
            normalized[entry.type] = Boolean(saved[entry.type]);
        }
    }
    return normalized;
}

export function setAllCharactersEnabled(settings, enabled) {
    const next = {};
    const flag = Boolean(enabled);
    for (const entry of CHARACTER_ROSTER) {
        next[entry.type] = flag;
    }
    return next;
}

export function countEnabledCharacters(settings) {
    let count = 0;
    for (const entry of CHARACTER_ROSTER) {
        if (Boolean(settings?.[entry.type])) count++;
    }
    return count;
}

export function getEligibleSpawnTypes(settings, activeMobTypes = []) {
    const activeSet = new Set(activeMobTypes);
    const eligible = [];
    for (const entry of CHARACTER_ROSTER) {
        if (!Boolean(settings?.[entry.type])) continue;
        if (entry.isUnique && activeSet.has(entry.type)) continue;
        eligible.push(entry.type);
    }
    return eligible;
}

// ==========================================
// GAME MODE & ONE BLOCK SURVIVAL HELPERS
// ==========================================

export const GAME_MODES = {
    FREEPLAY: 'freeplay',
    SURVIVAL: 'survival',
    SKYBLOCK: 'skyblock'
};

export function isSurvivalLikeMode(mode) {
    return mode === GAME_MODES.SURVIVAL || mode === GAME_MODES.SKYBLOCK;
}

export const ONE_BLOCK_POS = { x: 0, y: 6, z: 0 };
export const SKYBLOCK_TREE_POS = { x: -2, y: 7, z: -3 };
export const SKYBLOCK_CHEST_POS = { x: 2, y: 7, z: -2 };

export function createSkyblockStarterChestItems() {
    const slots = Array(18).fill(null);
    slots[0] = { type: 'lava', count: 2 };
    slots[1] = { type: 'water', count: 2 };
    slots[2] = { type: 'wood', count: 4 };
    slots[3] = { type: 'dirt', count: 8 };
    slots[4] = { type: 'crop', count: 4 };
    slots[5] = { type: 'golden_apple', count: 2 };
    slots[6] = { type: 'coal', count: 4 };
    slots[7] = { type: 'iron_ingot', count: 3 };
    return slots;
}

export const ONE_BLOCK_PHASES = [
    {
        index: 1,
        name: 'Dataran',
        minBlocks: 0,
        blocks: ['grass', 'dirt', 'dirt', 'wood', 'wood', 'leaf', 'sand', 'lucky']
    },
    {
        index: 2,
        name: 'Tambang Batu',
        minBlocks: 15,
        blocks: ['stone', 'cobblestone', 'coal_ore', 'iron_ore', 'dirt', 'wood', 'sand', 'brick', 'lucky']
    },
    {
        index: 3,
        name: 'Gua Mulia',
        minBlocks: 35,
        blocks: ['stone', 'iron_ore', 'gold_ore', 'lapis_ore', 'diamond', 'emerald', 'bookshelf', 'quartz', 'wood', 'lucky']
    },
    {
        index: 4,
        name: 'Nether & Magma',
        minBlocks: 60,
        blocks: ['obsidian', 'magma', 'quartz', 'gold_ore', 'diamond', 'tnt', 'redstone', 'iron_ore', 'lucky']
    },
    {
        index: 5,
        name: 'End & Master',
        minBlocks: 90,
        blocks: ['ender', 'obsidian', 'diamond', 'emerald', 'lapis_ore', 'enchanting_table', 'iron_ore', 'wood', 'lucky']
    }
];

export function getOneBlockPhase(minedCount = 0) {
    const safeCount = Math.max(0, Math.floor(minedCount));
    let activeIdx = 0;
    for (let i = ONE_BLOCK_PHASES.length - 1; i >= 0; i--) {
        if (safeCount >= ONE_BLOCK_PHASES[i].minBlocks) {
            activeIdx = i;
            break;
        }
    }
    const phase = ONE_BLOCK_PHASES[activeIdx];
    const next = ONE_BLOCK_PHASES[activeIdx + 1];
    return {
        ...phase,
        nextThreshold: next ? next.minBlocks : null
    };
}

export function rollOneBlockType(minedCount = 0, randFn = Math.random) {
    const phase = getOneBlockPhase(minedCount);
    const r = Math.min(0.999999, Math.max(0, randFn()));
    const idx = Math.floor(r * phase.blocks.length);
    return phase.blocks[idx] || 'grass';
}

export function rollOneBlockBonusItem(minedCount, randFn = Math.random) {
    if (!Number.isFinite(minedCount) || minedCount <= 0 || minedCount % 12 !== 0) {
        return null;
    }
    const phase = getOneBlockPhase(minedCount);
    const pool = phase.index >= 3
        ? [
            { type: 'iron_ingot', count: 3 },
            { type: 'lapis', count: 4 },
            { type: 'golden_apple', count: 1 },
            { type: 'diamond', count: 1 },
            { type: 'wood', count: 4 }
        ]
        : [
            { type: 'wood', count: 4 },
            { type: 'crop', count: 4 },
            { type: 'golden_apple', count: 1 },
            { type: 'coal', count: 4 }
        ];
    const r = Math.min(0.999999, Math.max(0, randFn()));
    return { ...pool[Math.floor(r * pool.length)] };
}

export function getModeStorageKeys(mode) {
    if (mode === GAME_MODES.SURVIVAL) {
        return {
            world: 'nizamcraft-save-survival',
            player: 'nizamcraft-player-survival',
            chests: 'nizamcraft-chests-survival'
        };
    }
    if (mode === GAME_MODES.SKYBLOCK) {
        return {
            world: 'nizamcraft-save-skyblock',
            player: 'nizamcraft-player-skyblock',
            chests: 'nizamcraft-chests-skyblock'
        };
    }
    return {
        world: 'nizamcraft-save',
        player: 'nizamcraft-player',
        chests: 'nizamcraft-chests'
    };
}
