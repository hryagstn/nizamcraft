import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveSafePath } from '../server.js';

import {
    normalizeBlockType,
    isSolidBlock,
    checkGridAABB,
    rollUndergroundBlock,
    insertItemIntoSlots,
    moveSlotBetweenContainers,
    countEnchantingBookshelves,
    getEnchantTableOffers,
    applyEnchantTableOffer,
    combineAnvilItems,
    applyEnchantBookToItem,
    getMeleeStats,
    getMiningStats,
    getBowStats,
    computeArmorReduction,
    computeThornsDamage,
    DEFAULT_HOTBAR_LOADOUT,
    selectOrAssignHotbarSlot,
    CRAFTING_RECIPES,
    canCraftRecipeFromSlots,
    deductRecipeFromSlots,
    matchCraftingGrid,
    consumeCraftingGrid,
    returnGridToInventory,
    populateGridForRecipe
} from '../src/utils/gameData.js';

test('normalizeBlockType keeps multi-word block names intact while stripping state suffixes', () => {
    assert.equal(normalizeBlockType('coal_ore'), 'coal_ore');
    assert.equal(normalizeBlockType('iron_ore'), 'iron_ore');
    assert.equal(normalizeBlockType('gold_ore'), 'gold_ore');
    assert.equal(normalizeBlockType('enchanting_table'), 'enchanting_table');
    assert.equal(normalizeBlockType('pressure_plate'), 'pressure_plate');
    assert.equal(normalizeBlockType('pressure_plate_on'), 'pressure_plate');
    assert.equal(normalizeBlockType('water_source'), 'water');
    assert.equal(normalizeBlockType('lava_3'), 'lava');
    assert.equal(normalizeBlockType('button_pressed'), 'button');
    assert.equal(normalizeBlockType('piston_extended'), 'piston');
});

test('checkGridAABB aligns hitboxes with centered [-0.5, +0.5] voxel meshes and ignores passable blocks', () => {
    const blocks = new Map([
        ['0,5,0', 'stone'],
        ['2,5,0', 'rail'],
        ['3,5,0', 'pressure_plate_on']
    ]);
    const getBlock = (x, y, z) => blocks.get(`${x},${y},${z}`) || null;

    // Standing flush on top of block y=5 (surface at 5.5) does not collide
    assert.equal(checkGridAABB(getBlock, 0, 5.5, 0, 0.3, 1.8), null);

    // Dipping below 5.5 collides with block y=5
    const hit = checkGridAABB(getBlock, 0, 5.42, 0, 0.3, 1.8);
    assert.deepEqual(hit, { x: 0, y: 5, z: 0, type: 'stone' });

    // Standing at x=0.85 (range [0.55, 1.15]) next to block x=0 ([-0.5, 0.5]) does not hit invisible +X wall
    assert.equal(checkGridAABB(getBlock, 0.85, 5.0, 0, 0.3, 1.8), null);

    // Entering [-0.5, 0.5] from negative X at x=-0.75 (range [-1.05, -0.45]) collides properly
    assert.notEqual(checkGridAABB(getBlock, -0.75, 5.0, 0, 0.3, 1.8), null);

    // Rails and pressure plates are passable
    assert.equal(isSolidBlock('rail'), false);
    assert.equal(checkGridAABB(getBlock, 2, 5.0, 0, 0.3, 1.8), null);
    assert.equal(checkGridAABB(getBlock, 3, 5.0, 0, 0.3, 1.8), null);
});

test('rollUndergroundBlock generates gold_ore, iron_ore, coal_ore, lapis_ore, and obsidian', () => {
    assert.equal(rollUndergroundBlock(0.5, 1, 0.05), 'obsidian');
    assert.equal(rollUndergroundBlock(0.01, 5, 0.9), 'gold_ore');
    assert.equal(rollUndergroundBlock(0.03, 5, 0.9), 'iron_ore');
    assert.equal(rollUndergroundBlock(0.07, 5, 0.9), 'coal_ore');
    assert.equal(rollUndergroundBlock(0.11, 5, 0.9), 'lapis_ore');
    assert.equal(rollUndergroundBlock(0.5, 5, 0.9), 'stone');
});

test('moveSlotBetweenContainers never stacks armor or enchanted books and preserves metadata', () => {
    const bag = [
        { type: 'helmet_iron', count: 1, enchants: { protection: 2 } },
        { type: 'helmet_iron', count: 1 },
        { type: 'diamond', count: 50 },
        { type: 'diamond', count: 20 }
    ];
    const chest = Array(4).fill(null);

    assert.equal(moveSlotBetweenContainers(bag, 0, chest), true);
    assert.equal(moveSlotBetweenContainers(bag, 1, chest), true);

    // Two helmets occupy two separate chest slots instead of merging into count: 2
    assert.equal(chest[0].count, 1);
    assert.deepEqual(chest[0].enchants, { protection: 2 });
    assert.equal(chest[1].count, 1);

    // Stackable diamonds cap at 64 and spill remainder
    assert.equal(moveSlotBetweenContainers(bag, 2, chest), true);
    assert.equal(moveSlotBetweenContainers(bag, 3, chest), true);
    assert.equal(chest[2].count, 64);
    assert.equal(chest[3].count, 6);
});

test('Enchanted books apply, combine equal levels, reject wrong gear, and boost combat/mining/armor stats', () => {
    const sword = { type: 'sword_diamond', count: 1 };
    const bookSharp1A = { type: 'enchanted_book', count: 1, enchant: { id: 'sharpness', level: 1 } };
    const bookSharp1B = { type: 'enchanted_book', count: 1, enchant: { id: 'sharpness', level: 1 } };
    const helmet = { type: 'helmet_diamond', count: 1 };

    // Reject sharpness on helmet
    assert.equal(applyEnchantBookToItem(helmet, bookSharp1A).ok, false);

    // Apply Sharpness I, then combine another Sharpness I -> Sharpness II
    assert.equal(applyEnchantBookToItem(sword, bookSharp1A).level, 1);
    assert.equal(applyEnchantBookToItem(sword, bookSharp1B).level, 2);
    assert.equal(getMeleeStats(sword).damage, 52 + 24);

    // Efficiency II on diamond pickaxe reaches instant 8-power break on obsidian
    const pickaxe = { type: 'pickaxe_diamond', count: 1, enchants: { efficiency: 2 } };
    assert.equal(getMiningStats(pickaxe).hitPower, 8);

    // Bow Power II + Fire Aspect I
    const bow = { type: 'bow', count: 1, enchants: { power: 2, fire_aspect: 1 } };
    const bowStats = getBowStats(bow);
    assert.equal(bowStats.damage, 25 + 30 + 8);
    assert.equal(bowStats.lifeSteal, 4);
    assert.equal(bowStats.isFire, true);

    // Protection caps safely at 85%
    const maxArmor = {
        helmet: { type: 'helmet_diamond', count: 1, enchants: { protection: 3 } },
        chestplate: { type: 'chestplate_diamond', count: 1, enchants: { protection: 3 } },
        leggings: { type: 'leggings_diamond', count: 1, enchants: { protection: 3 } },
        boots: { type: 'boots_diamond', count: 1, enchants: { protection: 3 } }
    };
    assert.equal(computeArmorReduction(maxArmor), 0.85);
});

test('Crafting deducts split ingredient stacks cleanly', () => {
    const slots = [
        { type: 'obsidian', count: 2 },
        { type: 'obsidian', count: 2 },
        { type: 'diamond', count: 2 },
        { type: 'book', count: 1 }
    ];
    const enchTableRecipe = CRAFTING_RECIPES.find(r => r.id === 'enchanting_table');
    assert.equal(canCraftRecipeFromSlots(slots, enchTableRecipe), true);
    assert.equal(deductRecipeFromSlots(slots, enchTableRecipe), true);
    assert.deepEqual(slots, [null, null, null, null]);
    assert.equal(insertItemIntoSlots(slots, { type: 'enchanting_table', count: 1 }), 0);
    assert.equal(slots[0].type, 'enchanting_table');
});

test('Minecraft 2x2 and 3x3 crafting grid handles offset invariance, horizontal mirror, and grid gating', () => {
    // 1. Shapeless wood -> 4 planks in any 2x2 cell
    const handGrid = [null, null, null, { type: 'wood', count: 3 }];
    const plankMatch = matchCraftingGrid(handGrid, 2);
    assert.equal(plankMatch?.recipe.id, 'planks');
    assert.equal(plankMatch?.recipe.resultCount, 4);
    assert.equal(plankMatch?.maxBatches, 3);

    // 2. Shaped sticks ['P', 'P'] shifted to right column of 2x2 grid
    const stickRightCol = [null, { type: 'planks', count: 1 }, null, { type: 'planks', count: 1 }];
    assert.equal(matchCraftingGrid(stickRightCol, 2)?.recipe.id, 'stick');

    // 3. 3x3 Pickaxe blocked in 2x2 hand grid via populateGridForRecipe
    const bagForPickaxe = [
        { type: 'planks', count: 3 },
        { type: 'stick', count: 2 }
    ];
    const woodPickRecipe = CRAFTING_RECIPES.find(r => r.id === 'pickaxe_wood');
    const gated = populateGridForRecipe(bagForPickaxe, Array(4).fill(null), 2, woodPickRecipe);
    assert.equal(gated.ok, false);

    // 4. Populate 3x3 grid for wood pickaxe, match, and consume
    const tableGrid = Array(9).fill(null);
    const filled = populateGridForRecipe(bagForPickaxe, tableGrid, 3, woodPickRecipe);
    assert.equal(filled.ok, true);
    assert.equal(matchCraftingGrid(tableGrid, 3)?.recipe.id, 'pickaxe_wood');
    consumeCraftingGrid(tableGrid, 1);
    assert.ok(tableGrid.every(c => c === null));

    // 5. Horizontal mirror invariance for Bow ['CS ', 'C S', 'CS '] vs [' SC', 'S C', ' SC']
    const mirroredBowGrid = [
        { type: 'crop', count: 1 }, { type: 'stick', count: 1 }, null,
        { type: 'crop', count: 1 }, null, { type: 'stick', count: 1 },
        { type: 'crop', count: 1 }, { type: 'stick', count: 1 }, null
    ];
    assert.equal(matchCraftingGrid(mirroredBowGrid, 3)?.recipe.id, 'bow');

    // 6. returnGridToInventory restores all uncrafted cells cleanly
    const returnBag = Array(4).fill(null);
    returnGridToInventory(mirroredBowGrid, returnBag);
    assert.ok(mirroredBowGrid.every(c => c === null));
    assert.deepEqual(returnBag[0], { type: 'crop', count: 3 });
    assert.deepEqual(returnBag[1], { type: 'stick', count: 3 });
});

test('Minecraft Enchanting Table counts unobstructed bookshelves up to 15 and scales to Level 30', () => {
    const blocks = new Map([['0,7,0', 'enchanting_table']]);
    // Place 16 perimeter bookshelves on y=7; count must cap at 15
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
                blocks.set(`${dx},7,${dz}`, 'bookshelf');
            }
        }
    }
    const getBlock = (x, y, z) => blocks.get(`${x},${y},${z}`) || null;
    assert.equal(countEnchantingBookshelves(getBlock, 0, 7, 0), 15);

    // Obstructing the air ring at (1, 7, 0) blocks shelves behind (+2, 7, -1..1)
    for (const z of [-2, -1, 0, 1, 2]) {
        blocks.delete(`-2,7,${z}`);
    }
    const unobstructedCount = countEnchantingBookshelves(getBlock, 0, 7, 0);
    blocks.set('1,7,0', 'stone');
    const obstructedCount = countEnchantingBookshelves(getBlock, 0, 7, 0);
    assert.ok(obstructedCount < unobstructedCount);

    // Full 15-bookshelf offers reach Lv. 30 on Tier III and reject already-enchanted gear
    const cleanPick = { type: 'pickaxe_diamond', count: 1 };
    const tableRes = getEnchantTableOffers(cleanPick, 15, 4242);
    assert.equal(tableRes.eligible, true);
    assert.equal(tableRes.offers.length, 3);
    assert.equal(tableRes.offers[2].reqLevel, 30);
    assert.equal(tableRes.offers[2].lapisCost, 3);

    const enchantedPick = applyEnchantTableOffer(cleanPick, tableRes.offers[2]);
    assert.equal(getEnchantTableOffers(enchantedPick, 15, 4242).eligible, false);

    // Blank book enchants into an enchanted_book
    const blankBook = { type: 'book', count: 2 };
    const bookRes = getEnchantTableOffers(blankBook, 8, 999);
    assert.equal(bookRes.eligible, true);
    assert.equal(bookRes.offers.length, 3);
    const outBook = applyEnchantTableOffer(blankBook, bookRes.offers[1]);
    assert.equal(outBook.type, 'enchanted_book');
    assert.equal(outBook.count, 1);
});

test('Minecraft Anvil merges books/gear, enforces mutual exclusion, Prior Work XP penalty, and Fire/Thorns effects', () => {
    // 1. Two Sharpness II books -> Sharpness III book
    const b1 = { type: 'enchanted_book', count: 1, enchants: { sharpness: 2 } };
    const b2 = { type: 'enchanted_book', count: 1, enchants: { sharpness: 2 } };
    const mergedBookRes = combineAnvilItems(b1, b2);
    assert.equal(mergedBookRes.ok, true);
    assert.equal(mergedBookRes.resultItem.enchants.sharpness, 3);
    assert.equal(mergedBookRes.resultItem.anvilUses, 1);

    // 2. Mutual exclusion: Fortune vs Silk Touch on pickaxe
    const fortunePick = { type: 'pickaxe_diamond', count: 1, enchants: { fortune: 2 } };
    const silkBook = { type: 'enchanted_book', count: 1, enchants: { silk_touch: 1 } };
    const conflict = combineAnvilItems(fortunePick, silkBook);
    assert.equal(conflict.ok, false);
    assert.match(conflict.reason, /bertabrakan/i);

    // 3. Prior Work penalty >= 40 levels triggers Too Expensive
    const overworkedSword = { type: 'sword_diamond', count: 1, enchants: { sharpness: 1 }, anvilUses: 6 };
    const fireBook = { type: 'enchanted_book', count: 1, enchants: { fire_aspect: 1 } };
    const tooExpensive = combineAnvilItems(overworkedSword, fireBook);
    assert.equal(tooExpensive.ok, false);
    assert.match(tooExpensive.reason, /Terlalu Mahal/i);

    // 4. Silk Touch / Fortune mining stats & Fire Protection / Thorns armor stats
    assert.equal(getMiningStats({ type: 'pickaxe_iron', count: 1, enchants: { silk_touch: 1 } }).silkTouch, true);
    assert.equal(getMiningStats({ type: 'pickaxe_iron', count: 1, enchants: { fortune: 3 } }).fortuneLevel, 3);

    const fireArmor = {
        chestplate: { type: 'chestplate_iron', count: 1, enchants: { fire_protection: 3, thorns: 2 } }
    };
    assert.ok(computeArmorReduction(fireArmor, 'fire') > computeArmorReduction(fireArmor, 'normal'));
    assert.equal(computeThornsDamage(fireArmor), 12);
});

test('selectOrAssignHotbarSlot jumps to existing visible slot or assigns into active slot', () => {
    const loadout = [...DEFAULT_HOTBAR_LOADOUT];
    // On mobile (5 visible slots: grass, dirt, stone, wood, brick), selecting 'wood' jumps to index 3
    const existing = selectOrAssignHotbarSlot(loadout, 0, 5, 'wood');
    assert.deepEqual(existing, { nextIndex: 3, updated: false });

    // Selecting 'lava' (not in first 5 slots) places 'lava' into active slot 2
    const assigned = selectOrAssignHotbarSlot(loadout, 2, 5, 'lava');
    assert.deepEqual(assigned, { nextIndex: 2, updated: true });
    assert.equal(loadout[2], 'lava');
});

test('server resolveSafePath blocks path traversal and dotfiles', () => {
    assert.equal(resolveSafePath('/../../../../etc/passwd'), null);
    assert.equal(resolveSafePath('/%2e%2e/%2e%2e/etc/hosts'), null);
    assert.equal(resolveSafePath('/.git/config'), null);
    assert.equal(resolveSafePath('/.htaccess'), null);
    assert.equal(resolveSafePath('/.env'), null);
    assert.ok(resolveSafePath('/')?.endsWith(path.join('nizamcraft', 'index.html')));
    assert.ok(resolveSafePath('/src/main.js?v=4')?.endsWith(path.join('src', 'main.js')));
});

test('World starts completely flat without trees, invalidates legacy pre-v2 saves, and renders all 34 block types', async () => {
    // Minimal DOM canvas + localStorage shim so textures.js and world.js load cleanly in Node
    const storageMap = new Map([
        ['nizamcraft-save', JSON.stringify({ width: 64, height: 24, depth: 64, grid: [[0, 'wood']] })],
        ['nizamcraft-player', JSON.stringify({ health: 40 })]
    ]);
    globalThis.document = {
        createElement() {
            return {
                width: 16,
                height: 16,
                getContext() {
                    return {
                        imageSmoothingEnabled: false,
                        fillStyle: '#000',
                        strokeStyle: '#000',
                        lineWidth: 1,
                        fillRect() {},
                        strokeRect() {},
                        clearRect() {}
                    };
                },
                toDataURL() {
                    return 'data:image/png;base64,AA==';
                }
            };
        }
    };
    globalThis.localStorage = {
        getItem(k) { return storageMap.has(k) ? storageMap.get(k) : null; },
        setItem(k, v) { storageMap.set(k, v); },
        removeItem(k) { storageMap.delete(k); }
    };

    const THREE = await import('three');
    const { World } = await import('../src/world/world.js');

    const scene = new THREE.Scene();
    const world = new World(scene);

    // 1. Legacy v1 save was automatically invalidated and cleared
    assert.equal(world.loadedFromSave, false);
    assert.equal(storageMap.has('nizamcraft-player'), false);

    // 2. Surface is 100% flat grass at y = 6 with zero trees (no wood or leaf anywhere)
    assert.equal(world.blockTypesList.length, 34);
    for (let x = -world.width / 2; x < world.width / 2; x++) {
        for (let z = -world.depth / 2; z < world.depth / 2; z++) {
            assert.equal(world.getBlockAt(x, 0, z), 'obsidian');
            assert.equal(world.getBlockAt(x, 5, z), 'dirt');
            assert.equal(world.getBlockAt(x, 6, z), 'grass');
            for (let y = 7; y < world.height; y++) {
                assert.equal(world.getBlockAt(x, y, z), null);
            }
        }
    }
    assert.equal(world.grid.includes('wood'), false);
    assert.equal(world.grid.includes('leaf'), false);

    // 3. Saving writes v2 format which reloads cleanly on next boot
    assert.equal(world.save(), true);
    const reloadedScene = new THREE.Scene();
    const reloadedWorld = new World(reloadedScene);
    assert.equal(reloadedWorld.loadedFromSave, true);

    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
    camera.position.set(0, 23, 12);
    camera.lookAt(0, 22, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const projScreenMatrix = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
    );
    const frustum = new THREE.Frustum().setFromProjectionMatrix(projScreenMatrix);

    // Simulate the initial start-screen WebGLRenderer frustum check when crafted/redstone meshes have count === 0
    for (const type of world.blockTypesList) {
        const mesh = world.instancedMeshMap.get(type);
        assert.ok(mesh, `Missing InstancedMesh for ${type}`);
        assert.equal(mesh.frustumCulled, false, `${type} should disable frustumCulled`);
        frustum.intersectsObject(mesh);
    }

    // Place every single one of the 34 block types in open sky above flat terrain and verify visibility
    let offset = -17;
    for (const type of world.blockTypesList) {
        const bx = offset;
        const by = 22;
        const bz = 0;
        offset += 1;

        assert.equal(world.addBlock(bx, by, bz, type), true, `Failed to place ${type}`);
        const mesh = world.instancedMeshMap.get(type);
        assert.ok(mesh.count > 0, `${type} mesh count remained 0 after placement`);
        assert.ok(mesh.boundingSphere && !mesh.boundingSphere.isEmpty(), `${type} boundingSphere is empty after placement`);

        // Aim camera at the newly placed block and confirm Three.js frustum test also passes
        camera.lookAt(bx, by, bz);
        camera.updateMatrixWorld();
        projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);
        assert.equal(frustum.intersectsObject(mesh), true, `${type} was frustum-culled after placement`);
    }

    // Verify flat mechanism blocks sit flush on the cell floor [-0.5, < 0] with opaque side materials
    for (const thinType of ['rail', 'pressure_plate', 'button', 'lever']) {
        const mesh = world.instancedMeshMap.get(thinType);
        mesh.geometry.computeBoundingBox();
        assert.ok(Math.abs(mesh.geometry.boundingBox.min.y - (-0.5)) < 1e-6, `${thinType} does not sit on cell floor`);
        assert.ok(mesh.geometry.boundingBox.max.y < 0, `${thinType} floats too high in cell`);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        assert.ok(mats.every(m => m.opacity !== 0), `${thinType} still has invisible opacity=0 side material`);
    }
});
