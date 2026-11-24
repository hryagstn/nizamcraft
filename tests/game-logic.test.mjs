import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveSafePath } from '../server.js';

import {
    normalizeBlockType,
    parseBlockState,
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
    HOTBAR_ITEMS,
    CHARACTER_ROSTER,
    createDefaultCharacterSettings,
    normalizeCharacterSettings,
    setAllCharactersEnabled,
    countEnabledCharacters,
    getEligibleSpawnTypes,
    selectOrAssignHotbarSlot,
    CRAFTING_RECIPES,
    canCraftRecipeFromSlots,
    deductRecipeFromSlots,
    matchCraftingGrid,
    consumeCraftingGrid,
    returnGridToInventory,
    populateGridForRecipe,
    isRailBlock,
    computeInitialRailShape,
    computeRailShape,
    cycleRailShape,
    findRailAtCartPos,
    stepMinecartOnRail,
    computeRailLaunchVelocity,
    isRedstoneWireActive,
    isMechanismPowered,
    isPoweredRailActive,
    computeLaserFacing,
    computeLaserBeam,
    isEntityInLaserBeam,
    isEntityTouchingSaw,
    HOSTILE_MOBS,
    SEA_BEACH_START_Z,
    SEA_START_Z,
    isGravityBlock,
    shouldBlockFall,
    collectUnsupportedGravityBlocks,
    computePistonFacing,
    planPistonPush
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

    // Senapan Nuklir (bow) Power II + Fire Aspect I
    const bow = { type: 'bow', count: 1, enchants: { power: 2, fire_aspect: 1 } };
    const bowStats = getBowStats(bow);
    assert.equal(bowStats.damage, 140 + 70 + 15);
    assert.equal(bowStats.lifeSteal, 8);
    assert.equal(bowStats.isFire, true);
    assert.equal(bowStats.isNuclear, true);
    assert.equal(bowStats.blastRadius, 6.5);

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
    const { World, WORLD_SAVE_VERSION } = await import('../src/world/world.js');

    const scene = new THREE.Scene();
    const world = new World(scene);

    // 1. Legacy v1/v2 save was automatically invalidated and cleared
    assert.equal(WORLD_SAVE_VERSION, 3);
    assert.equal(world.width, 96);
    assert.equal(world.depth, 96);
    assert.equal(world.loadedFromSave, false);
    assert.equal(storageMap.has('nizamcraft-player'), false);

    // 2. Surface is flat grass land (z < 22), sandy beach (22..24), and deep sea (z >= 25) with zero trees
    assert.equal(world.blockTypesList.length, 38);
    for (let x = -world.width / 2; x < world.width / 2; x++) {
        for (let z = -world.depth / 2; z < world.depth / 2; z++) {
            assert.equal(world.getBlockAt(x, 0, z), 'obsidian');
            if (z < SEA_BEACH_START_Z) {
                assert.equal(world.getBlockAt(x, 5, z), 'dirt');
                assert.equal(world.getBlockAt(x, 6, z), 'grass');
            } else if (z < SEA_START_Z) {
                assert.equal(world.getBlockAt(x, 5, z), 'sand');
                assert.equal(world.getBlockAt(x, 6, z), 'sand');
            } else {
                assert.equal(world.getBlockAt(x, 2, z), 'sand');
                for (let y = 3; y <= 6; y++) {
                    assert.equal(world.getBlockAt(x, y, z), 'water_source');
                }
            }
            for (let y = 7; y < world.height; y++) {
                assert.equal(world.getBlockAt(x, y, z), null);
            }
        }
    }
    assert.equal(world.grid.includes('wood'), false);
    assert.equal(world.grid.includes('leaf'), false);

    // 3. Saving writes v3 format which reloads cleanly on next boot
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
    for (const thinType of ['rail', 'powered_rail', 'redstone', 'pressure_plate', 'button', 'lever']) {
        const mesh = world.instancedMeshMap.get(thinType);
        mesh.geometry.computeBoundingBox();
        assert.ok(Math.abs(mesh.geometry.boundingBox.min.y - (-0.5)) < 1e-6, `${thinType} does not sit on cell floor`);
        assert.ok(mesh.geometry.boundingBox.max.y < 0, `${thinType} floats too high in cell`);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        assert.ok(mats.every(m => m.opacity !== 0), `${thinType} still has invisible opacity=0 side material`);
    }

    // Verify auxMeshMap instances for curved rail, sloped rail, active powered rail, curved powered rail, redstone_on, laser_on, saw_blade, extended piston+head, lever handle, and depressed plate
    assert.equal(world.addBlock(0, 10, 0, 'rail_ne', true), true);
    assert.equal(world.addBlock(2, 10, 0, 'rail_asc_n', true), true);
    assert.equal(world.addBlock(4, 10, 0, 'powered_rail_ns_on', true), true);
    assert.equal(world.addBlock(5, 10, 0, 'powered_rail_ne_on', true), true);
    assert.equal(world.addBlock(6, 10, 0, 'piston_e_extended', true), true);
    assert.equal(world.addBlock(7, 10, 0, 'piston_head_e', true), true);
    assert.equal(world.addBlock(8, 10, 0, 'lever_n_on', true), true);
    assert.equal(world.addBlock(10, 10, 0, 'pressure_plate_pressed', true), true);
    assert.equal(world.addBlock(12, 10, 0, 'redstone_on', true), true);
    assert.equal(world.addBlock(14, 10, 0, 'laser_e_on', true), true);
    assert.equal(world.addBlock(15, 10, 0, 'laser_up_on', true), true);
    assert.equal(world.addBlock(16, 10, 0, 'laser_down_on', true), true);
    assert.equal(world.addBlock(17, 10, 0, 'laser_ne_on', true), true);
    assert.equal(world.addBlock(18, 10, 0, 'laser_up_e_on', true), true);
    assert.equal(world.addBlock(20, 10, 0, 'saw', true), true);

    assert.ok(world.auxMeshMap.get('rail_curve').count >= 1);
    assert.ok(world.auxMeshMap.get('rail_slope').count >= 1);
    assert.ok(world.auxMeshMap.get('powered_rail_on').count >= 1);
    assert.ok(world.auxMeshMap.get('powered_rail_curve_on').count >= 1);
    assert.ok(world.auxMeshMap.get('redstone_on').count >= 1);
    assert.ok(world.auxMeshMap.get('laser_on').count >= 5);
    assert.ok(world.auxMeshMap.get('saw_blade').count >= 1);
    assert.ok(world.auxMeshMap.get('piston_ext_base').count >= 1);
    assert.ok(world.auxMeshMap.get('piston_head_plate').count >= 1);
    assert.ok(world.auxMeshMap.get('piston_head_rod').count >= 1);
    assert.ok(world.auxMeshMap.get('lever_handle_on').count >= 1);
    assert.ok(world.auxMeshMap.get('pressure_plate_depressed').count >= 1);

    const prevSawAngle = world.sawSpinAngle;
    world.updateAnimatedBlocks(0.05);
    assert.ok(world.sawSpinAngle > prevSawAngle);

    // Verify FallingBlock entity falls smoothly without early snapping, stacks cleanly, and migrates chest items
    const { FallingBlock } = await import('../src/entities/fallingBlock.js');
    const notified = [];
    const mockGame = {
        chests: { '-10,12,10': [{ type: 'diamond', count: 3 }] },
        onTopologyChanged(x, y, z) {
            notified.push([x, y, z]);
        }
    };

    // Single block at y = 7.4 above grass at y = 6 must keep falling (not snap early)
    const smoothCheck = new FallingBlock(-11, 7.45, 10, 'stone', scene, world, mockGame);
    assert.equal(smoothCheck.update(0.01), true);
    assert.ok(smoothCheck.y > 7.0 && smoothCheck.y < 7.45);
    smoothCheck.cleanup();

    // 3-block vertical stack (dirt, stone, chest with items) falls onto flat grass (y = 6) at y = 7, 8, 9
    let stack = [
        new FallingBlock(-10, 10, 10, 'dirt', scene, world, mockGame),
        new FallingBlock(-10, 11, 10, 'stone', scene, world, mockGame),
        new FallingBlock(-10, 12, 10, 'chest', scene, world, mockGame, mockGame.chests['-10,12,10'])
    ];
    delete mockGame.chests['-10,12,10'];

    for (let i = 0; i < 120 && stack.length > 0; i++) {
        stack.sort((a, b) => a.y - b.y);
        stack = stack.filter(fb => fb.update(0.05));
    }
    assert.equal(stack.length, 0);
    assert.equal(world.getBlockAt(-10, 7, 10), 'dirt');
    assert.equal(world.getBlockAt(-10, 8, 10), 'stone');
    assert.equal(world.getBlockAt(-10, 9, 10), 'chest');
    assert.deepEqual(mockGame.chests['-10,9,10'], [{ type: 'diamond', count: 3 }]);
    assert.deepEqual(notified, [
        [-10, 7, 10],
        [-10, 8, 10],
        [-10, 9, 10]
    ]);
});

test('parseBlockState handles rail shapes, slopes, powered rails, 6-dir levers and pistons', () => {
    assert.equal(normalizeBlockType('powered_rail_asc_e_on'), 'powered_rail');
    assert.equal(normalizeBlockType('piston_w_extended'), 'piston');
    assert.equal(normalizeBlockType('piston_head_down'), 'piston_head');
    assert.equal(normalizeBlockType('lever_s_on'), 'lever');

    assert.deepEqual(parseBlockState('powered_rail_asc_e_on'), {
        base: 'powered_rail',
        shape: 'asc_e',
        facing: 'up',
        active: true,
        extended: false,
        pressed: false
    });
    assert.deepEqual(parseBlockState('piston_n_extended'), {
        base: 'piston',
        shape: 'ns',
        facing: 'n',
        active: false,
        extended: true,
        pressed: false
    });
    assert.deepEqual(parseBlockState('lever_w_on'), {
        base: 'lever',
        shape: 'ns',
        facing: 'w',
        active: true,
        extended: false,
        pressed: false
    });
});

test('computeRailShape connects straight, curved corners, 45-degree slopes, and keeps powered rails uncurved', () => {
    const blocks = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    const getBlockAt = (x, y, z) => blocks.get(key(x, y, z)) || null;

    blocks.set(key(0, 7, 0), 'rail');
    blocks.set(key(0, 7, -1), 'rail');
    assert.equal(computeRailShape(getBlockAt, 0, 7, 0, true), 'ns');

    blocks.set(key(1, 7, 0), 'rail');
    assert.equal(computeRailShape(getBlockAt, 0, 7, 0, true), 'ne');
    assert.equal(computeRailShape(getBlockAt, 0, 7, 0, false), 'ns');

    blocks.set(key(0, 8, -1), 'rail');
    assert.equal(computeRailShape(getBlockAt, 0, 7, 0, true), 'asc_n');

    blocks.clear();
    blocks.set(key(0, 7, 0), 'rail');
    blocks.set(key(0, 7, 1), 'rail');
    blocks.set(key(-1, 7, 0), 'rail');
    assert.equal(computeRailShape(getBlockAt, 0, 7, 0, true), 'sw');
});

test('stepMinecartOnRail drives curves, slopes, powered rail launch/brake, and wall bounces', () => {
    const blocks = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    const getBlockAt = (x, y, z) => blocks.get(key(x, y, z)) || null;

    // 1. Powered rail with solid stopper launches stationary cart East
    blocks.set(key(-1, 7, 0), 'stone');
    blocks.set(key(0, 7, 0), 'powered_rail_ew_on');
    blocks.set(key(1, 7, 0), 'rail_ew');
    const rail0 = findRailAtCartPos(getBlockAt, 0, 6.56, 0);
    assert.equal(rail0.base, 'powered_rail');
    assert.equal(rail0.shape, 'ew');

    const launched = stepMinecartOnRail({
        x: 0, y: 6.56, z: 0, vx: 0, vz: 0, yaw: 0,
        rail: rail0, isPowered: true, riderInput: null, getBlockAt, dt: 0.04
    });
    assert.ok(launched.vx > 5, `Expected East launch > 5, got ${launched.vx}`);

    // 2. Unpowered powered rail brakes fast-moving cart
    const braked = stepMinecartOnRail({
        x: 0, y: 6.56, z: 0, vx: 6.0, vz: 0, yaw: Math.PI / 2,
        rail: { ...rail0, active: false }, isPowered: false, riderInput: null, getBlockAt, dt: 0.05
    });
    assert.ok(braked.vx < 5.5, `Expected brake < 5.5, got ${braked.vx}`);

    // 3. 90-degree curve ('se') smoothly redirects South -> East with speed preserved
    blocks.clear();
    blocks.set(key(0, 7, 0), 'rail_se');
    blocks.set(key(1, 7, 0), 'rail_ew');
    let state = { x: 0, y: 6.56, z: 0.45, vx: 0, vz: -5.0, yaw: Math.PI };
    for (let i = 0; i < 12; i++) {
        const r = findRailAtCartPos(getBlockAt, state.x, state.y, state.z);
        assert.ok(r, `Lost rail at step ${i}: (${state.x}, ${state.y}, ${state.z})`);
        state = stepMinecartOnRail({ ...state, rail: r, isPowered: false, getBlockAt, dt: 0.025 });
    }
    assert.ok(state.vx > 3.5 && state.x > 0.35, `Cart should turn East, got vx=${state.vx}, x=${state.x}`);

    // 4. Solid buffer block bounces cart back
    blocks.clear();
    blocks.set(key(0, 7, 0), 'rail_ns');
    blocks.set(key(0, 7, -1), 'stone');
    const hitWall = stepMinecartOnRail({
        x: 0, y: 6.56, z: -0.45, vx: 0, vz: -6.0, yaw: Math.PI,
        rail: { x: 0, y: 7, z: 0, base: 'rail', shape: 'ns', active: false },
        isPowered: false, getBlockAt, dt: 0.05
    });
    assert.equal(hitWall.bounced, true);
    assert.ok(hitWall.vz > 0, `Expected rebound +Z, got vz=${hitWall.vz}`);
});

test('redstone evaluator powers direct neighbors, attached blocks, and 8-rail powered chains', () => {
    const blocks = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    const getBlockAt = (x, y, z) => blocks.get(key(x, y, z)) || null;

    // Wall lever on stone pushes piston on opposite side of stone
    blocks.set(key(0, 7, 0), 'stone');
    blocks.set(key(-1, 7, 0), 'lever_w_on');
    blocks.set(key(1, 7, 0), 'piston_e');
    assert.equal(isMechanismPowered(getBlockAt, 1, 7, 0), true);

    blocks.set(key(-1, 7, 0), 'lever_w');
    assert.equal(isMechanismPowered(getBlockAt, 1, 7, 0), false);

    // Powered rail propagation reaches 8 rails, stops at 9th
    blocks.clear();
    for (let x = 0; x <= 9; x++) {
        blocks.set(key(x, 7, 0), 'powered_rail_ew');
    }
    blocks.set(key(0, 7, 1), 'lever_up_on');
    assert.equal(isPoweredRailActive(getBlockAt, 8, 7, 0), true);
    assert.equal(isPoweredRailActive(getBlockAt, 9, 7, 0), false);
});

test('planPistonPush handles 12-block push limit, immovable blocks, crushables, and camera facing', () => {
    const blocks = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    const getBlockAt = (x, y, z) => blocks.get(key(x, y, z)) || null;

    assert.equal(computePistonFacing({ x: 0, y: -0.9, z: -0.1 }), 'up');
    assert.equal(computePistonFacing({ x: 0, y: 0.9, z: -0.1 }), 'down');
    assert.equal(computePistonFacing({ x: -0.95, y: 0, z: 0 }), 'e');

    // 12 blocks succeed
    blocks.set(key(0, 7, 0), 'piston_e');
    for (let i = 1; i <= 12; i++) blocks.set(key(i, 7, 0), 'stone');
    const ok12 = planPistonPush(getBlockAt, 0, 7, 0, 'e', 12);
    assert.equal(ok12.canPush, true);
    assert.equal(ok12.pushCount, 12);

    // 13 blocks exceed limit
    blocks.set(key(13, 7, 0), 'stone');
    const fail13 = planPistonPush(getBlockAt, 0, 7, 0, 'e', 12);
    assert.equal(fail13.canPush, false);
    assert.equal(fail13.reason, 'limit');

    // Obsidian blocks push
    blocks.clear();
    blocks.set(key(0, 7, 0), 'piston_e');
    blocks.set(key(1, 7, 0), 'stone');
    blocks.set(key(2, 7, 0), 'obsidian');
    const failObs = planPistonPush(getBlockAt, 0, 7, 0, 'e', 12);
    assert.equal(failObs.canPush, false);
    assert.equal(failObs.reason, 'immovable');

    // Fragile rail gets marked as crushPos
    blocks.clear();
    blocks.set(key(0, 7, 0), 'piston_e');
    blocks.set(key(1, 7, 0), 'stone');
    blocks.set(key(2, 7, 0), 'rail_ew');
    const crush = planPistonPush(getBlockAt, 0, 7, 0, 'e', 12);
    assert.equal(crush.canPush, true);
    assert.equal(crush.pushCount, 1);
    assert.deepEqual(crush.crushPos, { x: 2, y: 7, z: 0, type: 'rail_ew' });
});

test('minecart stays on open-end rails, launches from button trigger, and completes 360-degree loops', () => {
    const blocks = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    const getBlockAt = (x, y, z) => blocks.get(key(x, y, z)) || null;

    // 1. Open-end straight rail never derails cart
    blocks.set(key(0, 7, 0), 'rail_ew');
    let endState = { x: 0.2, y: 6.56, z: 0, vx: 8.0, vz: 0, yaw: Math.PI / 2 };
    for (let i = 0; i < 15; i++) {
        const r = findRailAtCartPos(getBlockAt, endState.x, endState.y, endState.z);
        assert.ok(r, `Cart derailed off open rail at step ${i}`);
        endState = stepMinecartOnRail({ ...endState, rail: r, isPowered: false, getBlockAt, dt: 0.05 });
    }
    assert.ok(endState.x <= 0.45 && endState.vx === 0);

    // 2. Open-end curved rail never derails cart
    blocks.clear();
    blocks.set(key(0, 7, 0), 'rail_se');
    let curveEnd = { x: 0, y: 6.56, z: 0.4, vx: 0, vz: -7.0, yaw: Math.PI };
    for (let i = 0; i < 15; i++) {
        const r = findRailAtCartPos(getBlockAt, curveEnd.x, curveEnd.y, curveEnd.z);
        assert.ok(r, `Cart derailed off open curved rail at step ${i}`);
        curveEnd = stepMinecartOnRail({ ...curveEnd, rail: r, isPowered: false, getBlockAt, dt: 0.05 });
    }
    assert.ok(findRailAtCartPos(getBlockAt, curveEnd.x, curveEnd.y, curveEnd.z));

    // 3. Button near start rail launches stationary minecart toward continuing track
    blocks.clear();
    blocks.set(key(0, 7, 0), 'rail_ew');
    blocks.set(key(1, 7, 0), 'rail_ew');
    blocks.set(key(0, 7, 1), 'button_up_pressed');
    const launch = computeRailLaunchVelocity(getBlockAt, { x: 0, y: 7, z: 0, base: 'rail', shape: 'ew' }, 0, 1, 8.5);
    assert.equal(launch.vx, 8.5);
    assert.equal(launch.vz, 0);

    // 4. 2x2 closed 360-degree loop runs full orbit without derailing
    blocks.clear();
    blocks.set(key(0, 7, 0), 'rail_se');
    blocks.set(key(1, 7, 0), 'rail_sw');
    blocks.set(key(1, 7, 1), 'rail_nw');
    blocks.set(key(0, 7, 1), 'rail_ne');
    let loopState = { x: 0, y: 6.56, z: 0.4, vx: 0, vz: -10.0, yaw: Math.PI };
    const visited = new Set();
    for (let i = 0; i < 80; i++) {
        const r = findRailAtCartPos(getBlockAt, loopState.x, loopState.y, loopState.z);
        assert.ok(r, `Lost rail on 360 loop at step ${i}`);
        visited.add(`${r.x},${r.z}`);
        loopState = stepMinecartOnRail({ ...loopState, rail: r, isPowered: false, getBlockAt, dt: 0.025 });
    }
    assert.equal(visited.size, 4);

    // 5. Manual rail cycling & T-junction curve preservation
    blocks.set(key(-1, 7, 0), 'rail_ew');
    assert.equal(computeRailShape(getBlockAt, 0, 7, 0, true, 'se'), 'se');
    assert.equal(cycleRailShape(getBlockAt, 0, 7, 0, 'se', true), 'ew');
    assert.equal(cycleRailShape(getBlockAt, 0, 7, 0, 'ew', true), 'sw');
    assert.equal(cycleRailShape(getBlockAt, 0, 7, 0, 'sw', true), 'se');
});

test('gravity blocks detach when lower support is removed for all relevant solid blocks and exclude attachments/extended pistons', () => {
    for (const solidType of [
        'grass', 'dirt', 'stone', 'wood', 'planks', 'obsidian', 'sand',
        'tnt', 'chest', 'laser_e', 'saw', 'piston_e'
    ]) {
        assert.equal(isGravityBlock(solidType), true, `Expected ${solidType} to be gravity-enabled`);
    }
    for (const nonGravity of [
        'water_source', 'lava_source', 'rail_ns', 'powered_rail_ew',
        'redstone_on', 'lever_up', 'crop', 'piston_head_e', 'piston_e_extended'
    ]) {
        assert.equal(isGravityBlock(nonGravity), false, `Expected ${nonGravity} not to fall as a solid block`);
    }

    const blocks = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    const getBlockAt = (x, y, z) => blocks.get(key(x, y, z)) || null;

    blocks.set(key(0, 0, 0), 'obsidian');
    for (let y = 1; y <= 3; y++) blocks.set(key(0, y, 0), 'stone');
    blocks.set(key(0, 4, 0), 'dirt');
    blocks.set(key(0, 5, 0), 'dirt');
    blocks.set(key(0, 6, 0), 'grass');
    blocks.set(key(0, 7, 0), 'dirt');
    blocks.set(key(0, 8, 0), 'stone');
    blocks.set(key(0, 9, 0), 'wood');
    blocks.set(key(0, 10, 0), 'chest');
    blocks.set(key(0, 11, 0), 'laser_n');

    assert.equal(shouldBlockFall(getBlockAt, 0, 0, 0), false);
    assert.equal(shouldBlockFall(getBlockAt, 0, 7, 0), false);
    assert.deepEqual(collectUnsupportedGravityBlocks(getBlockAt, 0, 6, 0, 1, 23), []);

    // Remove grass support block underneath mixed column
    blocks.delete(key(0, 6, 0));
    assert.equal(shouldBlockFall(getBlockAt, 0, 7, 0), true);
    const falling = collectUnsupportedGravityBlocks(getBlockAt, 0, 6, 0, 1, 23);
    assert.deepEqual(
        falling.map(b => [b.x, b.y, b.z, b.type]),
        [
            [0, 7, 0, 'dirt'],
            [0, 8, 0, 'stone'],
            [0, 9, 0, 'wood'],
            [0, 10, 0, 'chest'],
            [0, 11, 0, 'laser_n']
        ]
    );
});

test('rollercoaster rails align to look direction, curve powered rails, propagate power, and bank turns', () => {
    assert.equal(computeInitialRailShape({ x: 0.9, y: 0, z: 0.2 }), 'ew');
    assert.equal(computeInitialRailShape({ x: 0.1, y: 0, z: -0.9 }), 'ns');

    const blocks = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    const getBlockAt = (x, y, z) => blocks.get(key(x, y, z)) || null;

    // Curved powered rail loop with lever at start propagates around curves
    blocks.set(key(0, 7, 0), 'powered_rail_se');
    blocks.set(key(1, 7, 0), 'powered_rail_sw');
    blocks.set(key(1, 7, 1), 'powered_rail_nw');
    blocks.set(key(0, 7, 1), 'powered_rail_ne');
    blocks.set(key(0, 7, -1), 'lever_up_on');
    assert.equal(isPoweredRailActive(getBlockAt, 1, 7, 1), true);

    // Powered curved rail boosts and banks the minecart cleanly
    const boosted = stepMinecartOnRail({
        x: 0.1, y: 6.56, z: 0.4, vx: 0, vz: -6.0, yaw: Math.PI,
        rail: { x: 0, y: 7, z: 0, base: 'powered_rail', shape: 'se', active: true },
        isPowered: true, getBlockAt, dt: 0.04
    });
    assert.ok(Math.hypot(boosted.vx, boosted.vz) > 6.5);
    assert.notEqual(boosted.bank, 0);

    // Unpowered curved powered rail applies braking
    const braked = stepMinecartOnRail({
        x: 0.1, y: 6.56, z: 0.4, vx: 0, vz: -6.0, yaw: Math.PI,
        rail: { x: 0, y: 7, z: 0, base: 'powered_rail', shape: 'se', active: false },
        isPowered: false, getBlockAt, dt: 0.05
    });
    assert.ok(Math.hypot(braked.vx, braked.vz) < 5.5);
});

test('redstone circuits power laser blocks across up to 15 hops and laser beams stop on solid blocks', () => {
    const blocks = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    const getBlockAt = (x, y, z) => blocks.get(key(x, y, z)) || null;

    blocks.set(key(0, 7, 0), 'lever_up_on');
    for (let x = 1; x <= 6; x++) {
        blocks.set(key(x, 7 + (x >= 4 ? 1 : 0), 0), 'redstone');
    }
    blocks.set(key(7, 8, 0), 'laser_e');

    assert.equal(isRedstoneWireActive(getBlockAt, 6, 8, 0), true);
    assert.equal(isMechanismPowered(getBlockAt, 7, 8, 0), true);

    // Turning off lever shuts down wire and laser
    blocks.set(key(0, 7, 0), 'lever_up');
    assert.equal(isRedstoneWireActive(getBlockAt, 6, 8, 0), false);
    assert.equal(isMechanismPowered(getBlockAt, 7, 8, 0), false);

    // Laser beam extends through open air/passable blocks and stops at solid block
    blocks.clear();
    blocks.set(key(0, 7, 0), 'laser_e_on');
    blocks.set(key(2, 7, 0), 'rail_ew');
    blocks.set(key(4, 7, 0), 'stone');
    const beam = computeLaserBeam(getBlockAt, 0, 7, 0, 'e', 20);
    assert.equal(beam.length, 3);
    assert.deepEqual(beam.hitBlock, { x: 4, y: 7, z: 0, type: 'stone' });
    assert.equal(isEntityInLaserBeam(2, 6.6, 0, 0.3, 1.8, beam), true);
    assert.equal(isEntityInLaserBeam(5, 6.6, 0, 0.3, 1.8, beam), false);
});

test('spinning saw detects entity contact on top and sides', () => {
    const blocks = new Map([['3,7,3', 'saw']]);
    const getBlockAt = (x, y, z) => blocks.get(`${x},${y},${z}`) || null;

    assert.equal(isEntityTouchingSaw(getBlockAt, 3, 7.5, 3, 0.3, 1.8), true);
    assert.equal(isEntityTouchingSaw(getBlockAt, 3.6, 7.0, 3, 0.3, 1.8), true);
    assert.equal(isEntityTouchingSaw(getBlockAt, 5, 7.5, 3, 0.3, 1.8), false);
});

test('omnidirectional lasers aim up, down, and diagonally and block on airtight diagonal corners', () => {
    assert.equal(computeLaserFacing({ x: 0, y: -0.95, z: 0 }), 'up');
    assert.equal(computeLaserFacing({ x: 0, y: 0.95, z: 0 }), 'down');
    assert.equal(computeLaserFacing({ x: -0.7, y: 0, z: 0.7 }), 'ne');
    assert.equal(computeLaserFacing({ x: -0.7, y: -0.7, z: 0 }), 'up_e');
    assert.equal(computeLaserFacing({ x: 0, y: 0.7, z: -0.7 }), 'down_s');

    assert.equal(parseBlockState('laser_up_e_on').facing, 'up_e');
    assert.equal(parseBlockState('laser_down_n').facing, 'down_n');
    assert.equal(parseBlockState('laser_ne_on').facing, 'ne');

    const blocks = new Map();
    const key = (x, y, z) => `${x},${y},${z}`;
    const getBlockAt = (x, y, z) => blocks.get(key(x, y, z)) || null;

    // Vertical up & down beams
    blocks.set(key(0, 7, 0), 'laser_up_on');
    blocks.set(key(0, 11, 0), 'stone');
    const upBeam = computeLaserBeam(getBlockAt, 0, 7, 0, 'up', 20);
    assert.equal(upBeam.length, 3);
    assert.deepEqual(upBeam.hitBlock, { x: 0, y: 11, z: 0, type: 'stone' });

    blocks.set(key(2, 10, 0), 'laser_down_on');
    blocks.set(key(2, 6, 0), 'grass');
    const downBeam = computeLaserBeam(getBlockAt, 2, 10, 0, 'down', 20);
    assert.equal(downBeam.length, 3);
    assert.deepEqual(downBeam.hitBlock, { x: 2, y: 6, z: 0, type: 'grass' });

    // Upward diagonal beam (up_e) hits diagonal entity & stops on solid block
    blocks.clear();
    blocks.set(key(0, 7, 0), 'laser_up_e_on');
    blocks.set(key(3, 10, 0), 'stone');
    const diagBeam = computeLaserBeam(getBlockAt, 0, 7, 0, 'up_e', 20);
    assert.equal(diagBeam.length, 2);
    assert.ok(Math.abs(diagBeam.worldLength - 2 * Math.SQRT2) < 1e-6);
    assert.equal(isEntityInLaserBeam(2, 8.6, 0, 0.3, 1.8, diagBeam), true);
    assert.equal(isEntityInLaserBeam(2, 6.5, 0, 0.3, 1.8, diagBeam), false);
    assert.equal(isEntityInLaserBeam(4, 10.6, 0, 0.3, 1.8, diagBeam), false);

    // Horizontal diagonal (ne) cannot pass through airtight corner walls
    blocks.clear();
    blocks.set(key(0, 7, 0), 'laser_ne_on');
    blocks.set(key(1, 7, 0), 'stone');
    blocks.set(key(0, 7, -1), 'stone');
    const blockedCorner = computeLaserBeam(getBlockAt, 0, 7, 0, 'ne', 20);
    assert.equal(blockedCorner.length, 0);
    assert.ok(blockedCorner.hitBlock);
});

test('TrainEater and SeaEater bosses are hostile, instantiate cleanly, and update in land and sea zones', async () => {
    assert.equal(HOSTILE_MOBS.has('traineater'), true);
    assert.equal(HOSTILE_MOBS.has('seaeater'), true);

    const THREE = await import('three');
    const { World } = await import('../src/world/world.js');
    const { TrainEater, SeaEater } = await import('../src/entities/mob.js');

    const scene = new THREE.Scene();
    const world = new World(scene);
    const mockGame = { player: null, mobs: [], particles: [] };

    const trainEater = new TrainEater(0, 7, -10, scene, world, mockGame);
    const seaEater = new SeaEater(0, 2.6, 36, scene, world, mockGame);
    mockGame.mobs.push(trainEater, seaEater);

    for (let i = 0; i < 10; i++) {
        trainEater.update(0.05);
        seaEater.update(0.05);
    }

    assert.equal(trainEater.hp, 600);
    assert.equal(seaEater.hp, 650);
    assert.equal(trainEater.tailSegments.length, 4);
    assert.ok(trainEater.lureFigure);
    assert.ok(trainEater.jawGroup);
    assert.equal(seaEater.tailSegments.length, 2);
    assert.ok(seaEater.leftLimb);
    assert.ok(seaEater.rightLimb);
    assert.equal(seaEater.gravity, 0);

    trainEater.cleanupMesh();
    seaEater.cleanupMesh();
});

test('Charles, InfectedOcean, InfectedSky, JJ, Mikey, RedSun, LunarMoon, and CursedThomas register factions, eggs, and update cleanly', async () => {
    const newHostiles = ['charles', 'infectedocean', 'infectedsky', 'redsun', 'lunarmoon', 'cursedthomas'];
    for (const id of newHostiles) {
        assert.equal(HOSTILE_MOBS.has(id), true, `Expected ${id} in HOSTILE_MOBS`);
    }
    assert.equal(HOSTILE_MOBS.has('jj'), false);
    assert.equal(HOSTILE_MOBS.has('mikey'), false);

    const expectedEggs = [
        'spawn_charles',
        'spawn_infectedocean',
        'spawn_infectedsky',
        'spawn_jj',
        'spawn_mikey',
        'spawn_redsun',
        'spawn_lunarmoon',
        'spawn_cursedthomas'
    ];
    const { ITEM_CATALOG } = await import('../src/utils/icons.js');
    const { textures } = await import('../src/utils/textures.js');
    const hotbarByType = new Map(HOTBAR_ITEMS.map(item => [item.type, item]));
    for (const eggType of expectedEggs) {
        assert.ok(hotbarByType.has(eggType), `Expected ${eggType} in HOTBAR_ITEMS`);
        assert.ok(ITEM_CATALOG[eggType], `Expected ${eggType} in ITEM_CATALOG`);
    }
    assert.equal(ITEM_CATALOG.spawn_jj.color, '#ef4444');
    assert.equal(ITEM_CATALOG.spawn_mikey.color, '#22c55e');
    assert.ok(textures.jjTorsoFront);
    assert.ok(textures.mikeyBelly);
    assert.ok(textures.mikeyShell);

    const keys = HOTBAR_ITEMS.map(item => item.key.toLowerCase());
    assert.equal(new Set(keys).size, keys.length, 'Expected unique hotbar shortcut keys');

    const THREE = await import('three');
    const { World } = await import('../src/world/world.js');
    const {
        Charles, InfectedOcean, InfectedSky,
        JJ, Mikey, RedSun, LunarMoon, CursedThomas, Arrow
    } = await import('../src/entities/mob.js');

    const scene = new THREE.Scene();
    const world = new World(scene);
    const mockGame = { player: null, mobs: [], particles: [], arrows: [] };

    const charles = new Charles(0, 7, -12, scene, world, mockGame);
    const infectedOcean = new InfectedOcean(0, 2.6, 36, scene, world, mockGame);
    const infectedSky = new InfectedSky(-10, 14, -10, scene, world, mockGame);
    const jj = new JJ(2, 7, 2, scene, world, mockGame);
    const mikey = new Mikey(-2, 7, 2, scene, world, mockGame);
    const redSun = new RedSun(14, 15, -14, scene, world, mockGame);
    const lunarMoon = new LunarMoon(-14, 15, 14, scene, world, mockGame);
    const cursedThomas = new CursedThomas(10, 7, -10, scene, world, mockGame);

    const roster = [charles, infectedOcean, infectedSky, jj, mikey, redSun, lunarMoon, cursedThomas];
    mockGame.mobs.push(...roster);

    for (let i = 0; i < 10; i++) {
        for (const mob of roster) {
            mob.update(0.05);
        }
    }

    assert.equal(charles.spiderLegs.length, 8);
    assert.ok(charles.jawGroup);
    assert.equal(infectedOcean.tentacles.length, 6);
    assert.ok(infectedOcean.jawGroup);
    assert.equal(infectedOcean.gravity, 0);
    assert.equal(infectedSky.tendrils.length, 8);
    assert.equal(infectedSky.gravity, 0);
    assert.equal(jj.isFriendly, true);
    assert.equal(mikey.isFriendly, true);
    assert.ok(jj.swordGroup);
    assert.ok(mikey.swordGroup);
    assert.ok(redSun.coronaGroup);
    assert.equal(redSun.gravity, 0);
    assert.equal(lunarMoon.orbitRocks.length, 6);
    assert.equal(lunarMoon.gravity, 0);
    assert.equal(cursedThomas.spiderLegs.length, 6);
    assert.ok(cursedThomas.abdomen);
    assert.ok(cursedThomas.neckGroup);

    // Exercise active simulation: JJ & Mikey help fight hostile mobs like Iron Golem,
    // never hurt player or friends, and ignore player-fired shots
    let playerHitCount = 0;
    mockGame.player = {
        position: new THREE.Vector3(0, 7, 0),
        velocity: new THREE.Vector3(),
        width: 0.6,
        height: 1.8,
        takeDamage() { playerHitCount++; }
    };
    const nearbyEnemy = new Charles(2.6, 7, 2.2, scene, world, mockGame);
    mockGame.mobs.push(nearbyEnemy);
    const prevEnemyHp = nearbyEnemy.hp;
    const prevJjHp = jj.hp;
    const prevMikeyHp = mikey.hp;

    for (let i = 0; i < 12; i++) {
        jj.update(0.08);
        mikey.update(0.08);
        infectedSky.update(0.08);
        redSun.update(0.08);
        lunarMoon.update(0.08);
    }
    assert.ok(nearbyEnemy.hp < prevEnemyHp, 'Expected JJ & Mikey to damage nearby hostile mob');
    assert.equal(playerHitCount, 0, 'Expected JJ & Mikey never to damage player');
    assert.equal(jj.hp, prevJjHp, 'Expected JJ not to be hurt by Mikey');
    assert.equal(mikey.hp, prevMikeyHp, 'Expected Mikey not to be hurt by JJ');

    const friendlyArrow = new Arrow(
        new THREE.Vector3(jj.position.x, jj.position.y + 0.9, jj.position.z - 0.5),
        new THREE.Vector3(jj.position.x, jj.position.y + 0.9, jj.position.z + 1.5),
        scene, world, mockGame, 'player', getBowStats(null)
    );
    for (let i = 0; i < 6; i++) {
        friendlyArrow.update(0.05);
    }
    friendlyArrow.destroy();
    assert.equal(jj.hp, prevJjHp, 'Expected player shot not to hurt JJ');
    assert.equal(mikey.hp, prevMikeyHp, 'Expected player shot not to hurt Mikey');

    for (const arrow of mockGame.arrows) {
        arrow.update(0.05);
        arrow.destroy();
    }

    nearbyEnemy.cleanupMesh();
    for (const mob of roster) {
        mob.cleanupMesh();
    }
});

test('BananaKid, Carrie, Buu, Cookie, and Penduduk support mini scaling and defender combat AI', async () => {
    const peacefulIds = ['bananakid', 'carrie', 'buu', 'cookie', 'penduduk'];
    for (const id of peacefulIds) {
        assert.equal(HOSTILE_MOBS.has(id), false, `Expected ${id} NOT to be in HOSTILE_MOBS`);
    }

    const expectedEggs = [
        'spawn_bananakid',
        'spawn_carrie',
        'spawn_buu',
        'spawn_cookie',
        'spawn_penduduk'
    ];
    const { ITEM_CATALOG } = await import('../src/utils/icons.js');
    const { textures } = await import('../src/utils/textures.js');
    const hotbarByType = new Map(HOTBAR_ITEMS.map(item => [item.type, item]));
    for (const eggType of expectedEggs) {
        assert.ok(hotbarByType.has(eggType), `Expected ${eggType} in HOTBAR_ITEMS`);
        assert.ok(ITEM_CATALOG[eggType], `Expected ${eggType} in ITEM_CATALOG`);
    }

    for (const texKey of [
        'bananaBody',
        'bananaLegFront',
        'carrieScarf',
        'buuHairSide',
        'buuTorsoFront',
        'cookieTorsoFront',
        'cookieLimb',
        'villagerSkin',
        'villagerRobe'
    ]) {
        assert.ok(textures[texKey], `Expected textures.${texKey} to exist`);
    }

    const keys = HOTBAR_ITEMS.map(item => item.key.toLowerCase());
    assert.equal(new Set(keys).size, keys.length, 'Expected unique hotbar shortcut keys');
    for (const eggType of expectedEggs) {
        const item = hotbarByType.get(eggType);
        assert.equal(/[<>&]/.test(item.key), false, `Expected HTML-safe key for ${item.type}`);
    }

    const THREE = await import('three');
    const { World } = await import('../src/world/world.js');
    const {
        BananaKid, Carrie, Buu, Cookie, Penduduk, Charles, Arrow
    } = await import('../src/entities/mob.js');

    const scene = new THREE.Scene();
    const world = new World(scene);
    let playerHitCount = 0;
    const mockGame = {
        player: {
            position: new THREE.Vector3(0, 7, 0),
            velocity: new THREE.Vector3(),
            width: 0.6,
            height: 1.8,
            takeDamage() { playerHitCount++; }
        },
        mobs: [],
        particles: [],
        arrows: [],
        showNotification() {},
        onMobDefeated() {}
    };

    const bananakid = new BananaKid(2, 7, 2, scene, world, mockGame);
    const carrie = new Carrie(-2, 7, 2, scene, world, mockGame);
    const buu = new Buu(3, 7, -2, scene, world, mockGame);
    const cookie = new Cookie(-3, 7, -2, scene, world, mockGame);
    const penduduk = new Penduduk(4, 7, 0, scene, world, mockGame);
    const nearbyEnemy = new Charles(2.6, 7, 2.2, scene, world, mockGame);
    const prevEnemyHp = nearbyEnemy.hp;

    const friends = [bananakid, carrie, buu, cookie, penduduk];
    mockGame.mobs.push(...friends, nearbyEnemy);

    assert.ok(buu.flowerGroup, 'Expected Buu to hold a red poppy flower');
    assert.ok(penduduk.foldedArms, 'Expected Penduduk to have folded crossed arms');
    assert.equal(penduduk.followPlayer, false, 'Expected Penduduk to wander calmly rather than follow player');
    assert.equal(penduduk.combatStyle, 'none', 'Expected Penduduk to stay non-combatant');

    // Carrie & Cookie use mini scale like their original proportions
    assert.equal(carrie.modelScale, 0.55);
    assert.equal(carrie.mesh.scale.y, 0.55);
    assert.ok(carrie.height < 1.1, 'Expected mini Carrie height < 1.1');
    assert.equal(cookie.modelScale, 0.52);
    assert.equal(cookie.mesh.scale.y, 0.52);
    assert.ok(cookie.height < 1.0, 'Expected mini Cookie height < 1.0');

    // Combat styles match Iron Golem (melee) & Snow Golem (ranged)
    assert.equal(bananakid.combatStyle, 'melee');
    assert.equal(buu.combatStyle, 'melee');
    assert.equal(carrie.combatStyle, 'ranged');
    assert.equal(cookie.combatStyle, 'ranged');

    for (const friend of friends) {
        assert.equal(friend.isFriendly, true, `Expected ${friend.type} to have isFriendly = true`);
    }

    for (let i = 0; i < 18; i++) {
        for (const friend of friends) {
            friend.update(0.08);
        }
        for (let j = mockGame.arrows.length - 1; j >= 0; j--) {
            if (!mockGame.arrows[j].update(0.08)) {
                mockGame.arrows.splice(j, 1);
            }
        }
    }

    assert.ok(nearbyEnemy.hp < prevEnemyHp, 'Expected Maizen defenders to damage nearby hostile mob');
    assert.equal(playerHitCount, 0, 'Expected friendly characters never to damage player');

    // Verify Penduduk alone stays completely passive
    const calmGame = {
        player: mockGame.player,
        mobs: [],
        particles: [],
        arrows: [],
        showNotification() {},
        onMobDefeated() {}
    };
    const soloPenduduk = new Penduduk(0, 7, 0, scene, world, calmGame);
    const soloHostile = new Charles(1.5, 7, 0, scene, world, calmGame);
    calmGame.mobs.push(soloPenduduk, soloHostile);
    const soloHostileHp = soloHostile.hp;
    for (let i = 0; i < 10; i++) {
        soloPenduduk.update(0.08);
    }
    assert.equal(soloHostile.hp, soloHostileHp, 'Expected Penduduk never to attack mobs');
    soloPenduduk.cleanupMesh();
    soloHostile.cleanupMesh();

    for (const friend of friends) {
        const prevHp = friend.hp;
        const arrow = new Arrow(
            new THREE.Vector3(friend.position.x, friend.position.y + 0.4, friend.position.z - 0.5),
            new THREE.Vector3(friend.position.x, friend.position.y + 0.4, friend.position.z + 1.5),
            scene, world, mockGame, 'player', { damage: 25 }
        );
        for (let i = 0; i < 6; i++) {
            arrow.update(0.05);
        }
        arrow.destroy();
        assert.equal(friend.hp, prevHp, `Expected player shot not to hurt ${friend.type}`);
    }

    for (const shot of mockGame.arrows) {
        shot.destroy();
    }
    nearbyEnemy.cleanupMesh();
    for (const friend of friends) {
        friend.cleanupMesh();
    }
});

test('Senapan Nuklir deals massive AoE nuclear damage to hostiles without hurting player or allies', async () => {
    const { ITEM_CATALOG } = await import('../src/utils/icons.js');
    assert.equal(ITEM_CATALOG.bow.name, 'Senapan Nuklir');
    assert.equal(ITEM_CATALOG.bow.icon, 'radiation');

    const THREE = await import('three');
    const { World } = await import('../src/world/world.js');
    const { Zombie, JJ, Carrie, Penduduk, Arrow } = await import('../src/entities/mob.js');

    const scene = new THREE.Scene();
    const world = new World(scene);
    let playerHitCount = 0;
    const mockGame = {
        player: {
            position: new THREE.Vector3(0, 7, 0),
            velocity: new THREE.Vector3(),
            width: 0.6,
            height: 1.8,
            takeDamage() { playerHitCount++; },
            heal() {}
        },
        mobs: [],
        particles: [],
        arrows: [],
        showNotification() {},
        onMobDefeated() {}
    };

    const z1 = new Zombie(0, 7, 4, scene, world, mockGame);
    const z2 = new Zombie(2.5, 7, 4, scene, world, mockGame);
    const allyJJ = new JJ(-1.5, 7, 4, scene, world, mockGame);
    const allyCarrie = new Carrie(1.2, 7, 4, scene, world, mockGame);
    const villager = new Penduduk(0.5, 7, 5, scene, world, mockGame);

    mockGame.mobs.push(z1, z2, allyJJ, allyCarrie, villager);

    const prevZ1 = z1.hp;
    const prevZ2 = z2.hp;
    const prevJJ = allyJJ.hp;
    const prevCarrie = allyCarrie.hp;
    const prevVillager = villager.hp;

    const nukeShot = new Arrow(
        new THREE.Vector3(0, 7.9, 2),
        new THREE.Vector3(0, 7.9, 5),
        scene, world, mockGame, 'player', getBowStats(null)
    );
    assert.equal(nukeShot.isNuclear, true);

    for (let i = 0; i < 12; i++) {
        if (!nukeShot.update(0.05)) break;
    }

    assert.ok(z1.hp < prevZ1, 'Expected direct hostile target to take nuclear damage');
    assert.ok(z2.hp < prevZ2, 'Expected nearby hostile mob to take nuclear blast AoE damage');
    assert.equal(allyJJ.hp, prevJJ, 'Expected Senapan Nuklir never to hurt JJ');
    assert.equal(allyCarrie.hp, prevCarrie, 'Expected Senapan Nuklir never to hurt Carrie');
    assert.equal(villager.hp, prevVillager, 'Expected Senapan Nuklir never to hurt Penduduk');
    assert.equal(playerHitCount, 0, 'Expected Senapan Nuklir never to hurt player');

    for (const mob of [...mockGame.mobs]) {
        mob.cleanupMesh();
    }
    for (const p of mockGame.particles) {
        scene.remove(p.mesh);
        p.material?.dispose();
    }
});

test('Character roster switch helpers default all 26 characters to OFF and filter spawns safely', () => {
    assert.equal(CHARACTER_ROSTER.length, 26);
    const rosterTypes = CHARACTER_ROSTER.map(c => c.type);
    assert.equal(new Set(rosterTypes).size, 26, 'Expected 26 unique character types in CHARACTER_ROSTER');

    for (const id of ['bananakid', 'carrie', 'buu', 'cookie', 'penduduk']) {
        assert.ok(rosterTypes.includes(id), `Expected ${id} in CHARACTER_ROSTER`);
    }

    const defaults = createDefaultCharacterSettings();
    assert.equal(countEnabledCharacters(defaults), 0, 'Expected all characters OFF by default');
    for (const id of rosterTypes) {
        assert.equal(defaults[id], false);
    }
    assert.deepEqual(getEligibleSpawnTypes(defaults, []), []);

    const normalized = normalizeCharacterSettings({
        bananakid: true,
        penduduk: 1,
        unknown_mob: true
    });
    assert.equal(normalized.bananakid, true);
    assert.equal(normalized.penduduk, true);
    assert.equal(normalized.jj, false);
    assert.equal('unknown_mob' in normalized, false);
    assert.equal(countEnabledCharacters(normalized), 2);

    const eligibleBefore = getEligibleSpawnTypes(normalized, ['bananakid']);
    assert.equal(eligibleBefore.includes('bananakid'), false, 'Unique enabled character already alive should not respawn');
    assert.equal(eligibleBefore.includes('penduduk'), true, 'Non-unique enabled character can still spawn');

    const allOn = setAllCharactersEnabled(defaults, true);
    assert.equal(countEnabledCharacters(allOn), 26);
    const allOff = setAllCharactersEnabled(allOn, false);
    assert.equal(countEnabledCharacters(allOff), 0);
});
