// NizamCraft - Main Entry Point
import * as THREE from 'three';
import { GameRenderer } from './render/renderer.js';
import { World } from './world/world.js';
import { Player, isAnyOverlayOpen, flashScreen } from './player/player.js';
import {
    Zombie, Creeper, Skeleton, Arrow, IronGolem, SnowGolem,
    Chicken, Pig, Cow, BloodGolem, GiantIronGolem, WitherSkeleton, Minecart
} from './entities/mob.js';
import { PrimedTNT } from './entities/tnt.js';
import { sounds } from './utils/audio.js';
import { svgIcon, getItemName, getItemVisualHTML } from './utils/icons.js';
import {
    normalizeBlockType,
    isSolidBlock,
    entityOverlapsBlock,
    getEquipmentCategory,
    getArmorSlotName,
    insertItemIntoSlots,
    moveSlotBetweenContainers,
    ENCHANTMENTS,
    ROMAN_NUMERALS,
    getItemEnchants,
    hasAnyEnchant,
    formatEnchantList,
    getXpForNextLevel,
    grantXpToState,
    countEnchantingBookshelves,
    getEnchantTableOffers,
    applyEnchantTableOffer,
    combineAnvilItems,
    getMeleeStats,
    getMiningStats,
    getBowStats,
    DEFAULT_HOTBAR_LOADOUT,
    selectOrAssignHotbarSlot,
    HOTBAR_ITEMS,
    CRAFTING_RECIPES,
    countInventoryMaterials,
    canCraftRecipeFromSlots,
    deductRecipeFromSlots,
    matchCraftingGrid,
    consumeCraftingGrid,
    returnGridToInventory,
    populateGridForRecipe
} from './utils/gameData.js';

// Hydrate static [data-icon] placeholders with Lucide SVGs
document.querySelectorAll('[data-icon]').forEach(el => {
    const iconName = el.getAttribute('data-icon');
    el.innerHTML = svgIcon(iconName, 18);
});

const HOTBAR_BY_TYPE = new Map(HOTBAR_ITEMS.map(item => [item.type, item]));

const game = {
    player: null,
    mobs: [],
    tnts: [],
    particles: [],
    arrows: [],
    chests: {},
    blockHits: {},
    showNotification(message) {
        if (this.player) {
            this.player.showNotification(message);
        }
    },
    onMobDefeated(mobType) {
        const lootingLevel = getMeleeStats(getActiveHeldItem()).lootingLevel || 0;
        if (mobType === 'bloodgolem' || mobType === 'witherskeleton') {
            const bossPool = ['sharpness', 'protection', 'power', 'fire_aspect', 'fortune'];
            const pick = bossPool[Math.floor(Math.random() * bossPool.length)];
            const lvl = Math.min(ENCHANTMENTS[pick].maxLevel, 2);
            addItemToInventory('enchanted_book', 1, {
                enchants: { [pick]: lvl },
                enchant: { id: pick, level: lvl }
            });
            addItemToInventory('diamond', 2 + lootingLevel);
            grantPlayerXp(35);
            sounds.playEnchantSound();
            this.showNotification(
                `${mobType.toUpperCase()} tumbang. Dapat Buku Enchant (${ENCHANTMENTS[pick].name} ${ROMAN_NUMERALS[lvl]}), Berlian, dan +35 XP.`
            );
        } else if (mobType === 'zombie' || mobType === 'skeleton' || mobType === 'creeper') {
            grantPlayerXp(12);
            if (Math.random() < 0.4 + lootingLevel * 0.25) {
                const drops = ['iron_ingot', 'lapis', 'coal'];
                const dropType = drops[Math.floor(Math.random() * drops.length)];
                const qty = 1 + (lootingLevel > 0 ? Math.floor(Math.random() * (lootingLevel + 1)) : 0);
                addItemToInventory(dropType, qty);
            }
            this.showNotification(`${mobType.toUpperCase()} dikalahkan (+12 XP).`);
        } else {
            grantPlayerXp(4);
            if (mobType === 'chicken' || mobType === 'pig' || mobType === 'cow') {
                addItemToInventory('crop', 1 + lootingLevel);
            }
            this.showNotification(`${mobType.toUpperCase()} dikalahkan (+4 XP).`);
        }
    }
};

// 1. Initialize Renderer, World, and Player
const gameRenderer = new GameRenderer();
const scene = gameRenderer.scene;
const camera = gameRenderer.camera;
const renderer = gameRenderer.renderer;

const world = new World(scene);
world.game = game;

const player = new Player(camera, renderer.domElement, world);
game.player = player;
player.initHand(scene);

// Active Loadout & Selection State (9 slots Desktop / 5 slots Mobile)
let hotbarLoadout = [...DEFAULT_HOTBAR_LOADOUT];
let activeHotbarIndex = 0;
let selectedBlockType = hotbarLoadout[0];
let equippedBagSlot = null;
let currentChestPos = null;
let selectedInventorySlot = null;
let lastWorkbenchTab = 'crafting';

// Modal & Workbench states
let activePickerCategory = 'all';
let activeCraftCategory = 'all';
let craftReadyOnly = false;
let craftGridSize = 2;
let craftGrid = Array(4).fill(null);
let selectedCraftMaterial = null;

let activeEnchantTablePos = null;
let selectedTableCandidateRef = null;
let anvilTargetRef = null;
let anvilSacrificeRef = null;

function flushCraftingGridToInventory() {
    if (!craftGrid || !player?.inventory) return;
    const hasItems = craftGrid.some(cell => cell && cell.count > 0);
    if (!hasItems) return;
    returnGridToInventory(craftGrid, player.inventory);
    updateInventoryUI();
}

function getVisibleHotbarCount() {
    return (player.isTouch || window.innerWidth <= 950) ? 5 : 9;
}

function getActiveHeldItem() {
    if (equippedBagSlot !== null) {
        const bagItem = player.inventory[equippedBagSlot];
        if (bagItem) return bagItem;
        equippedBagSlot = null;
    }
    return { type: selectedBlockType, count: 1 };
}

function findPlayerBowItem() {
    const held = getActiveHeldItem();
    if (held && held.type === 'bow') return held;
    for (const slot of player.inventory) {
        if (slot && slot.type === 'bow') return slot;
    }
    return null;
}

// ==========================================
// MODAL & POINTER LOCK COORDINATION
// ==========================================

const GAMEPLAY_MODAL_IDS = [
    'inventory-modal',
    'crafting-modal',
    'enchant-modal',
    'block-picker-modal'
];

function isGameplayModalOpen() {
    return GAMEPLAY_MODAL_IDS.some(id => {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none';
    });
}

function openGameplayModal(targetId) {
    if (targetId !== 'crafting-modal') {
        flushCraftingGridToInventory();
    }
    GAMEPLAY_MODAL_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === targetId ? 'flex' : 'none';
    });
    if (targetId !== 'inventory-modal') {
        currentChestPos = null;
    }
    if (!player.isTouch && player.controls.isLocked) {
        player.controls.unlock();
    }
}

function closeAllGameplayModals(relock = true) {
    const wasOpen = isGameplayModalOpen();
    flushCraftingGridToInventory();
    GAMEPLAY_MODAL_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    currentChestPos = null;
    selectedInventorySlot = null;

    if (wasOpen && relock && !player.isTouch && document.body.classList.contains('in-game')) {
        player.controls.lock();
    }
}

// ==========================================
// FULLSCREEN & START / PAUSE OVERLAY
// ==========================================

const playOverlay = document.getElementById('play-overlay');
const playButton = document.getElementById('play-button');
const overlaySubtitle = document.getElementById('overlay-subtitle');

let hasGameStarted = false;
let mobSpawnIntervalId = null;

function safeRequestFullscreen(element) {
    if (!element) return Promise.reject(new Error('No element'));
    const fn = element.requestFullscreen || element.webkitRequestFullscreen || element.mozRequestFullScreen || element.msRequestFullscreen;
    return fn ? fn.call(element) : Promise.reject(new Error('Fullscreen unsupported'));
}

function safeExitFullscreen() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    return fn ? fn.call(document) : Promise.reject(new Error('Fullscreen unsupported'));
}

function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
}

function startGameSessionIfNeeded() {
    if (hasGameStarted) {
        clock.getDelta();
        return;
    }
    hasGameStarted = true;
    if (playButton) playButton.textContent = 'Lanjutkan Permainan';
    if (overlaySubtitle) {
        overlaySubtitle.textContent = 'Permainan dijeda. Simpan progres, atur layar penuh, atau lanjutkan petualangan.';
    }
    spawnInitialMobs();
    startMobSpawner();
    clock.start();
    clock.getDelta();
    requestAnimationFrame(animate);
}

function enterGame() {
    document.body.classList.add('in-game');
    startGameSessionIfNeeded();

    if (playOverlay) {
        playOverlay.style.opacity = '0';
        setTimeout(() => {
            playOverlay.style.display = 'none';
        }, 240);
    }

    if (!player.isTouch) {
        player.controls.lock();
    } else if (!isFullscreen()) {
        safeRequestFullscreen(document.documentElement).then(() => {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => {});
            }
        }).catch(() => {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            if (isIOS && isSafari) {
                game.showNotification("Ketuk ikon 'aA' di Safari lalu pilih 'Sembunyikan Toolbar' untuk layar penuh.");
            }
        });
    }
}

function exitGame() {
    closeAllGameplayModals(false);
    document.body.classList.remove('in-game');

    if (!player.isTouch && player.controls.isLocked) {
        player.controls.unlock();
    }
    if (playOverlay) {
        playOverlay.style.display = 'flex';
        playOverlay.offsetHeight;
        playOverlay.style.opacity = '1';
    }
}

if (playButton && playOverlay) {
    playButton.addEventListener('click', enterGame);

    player.controls.addEventListener('lock', () => {
        document.body.classList.add('in-game');
        startGameSessionIfNeeded();
        if (playOverlay) {
            playOverlay.style.opacity = '0';
            setTimeout(() => {
                if (player.controls.isLocked) {
                    playOverlay.style.display = 'none';
                }
            }, 240);
        }
    });

    player.controls.addEventListener('unlock', () => {
        if (isGameplayModalOpen()) return;
        exitGame();
    });
}

// ==========================================
// SAVE / LOAD / RESET
// ==========================================

function saveAllState(silent = false) {
    flushCraftingGridToInventory();
    const worldSaved = world.save();
    if (!worldSaved) {
        if (!silent) game.showNotification('Gagal menyimpan dunia.');
        return false;
    }
    try {
        const playerState = {
            position: { x: player.position.x, y: player.position.y, z: player.position.z },
            health: player.health,
            xp: player.xp,
            xpLevel: player.xpLevel,
            enchantSeed: player.enchantSeed,
            inventory: player.inventory,
            armor: player.armor,
            hotbarLoadout
        };
        localStorage.setItem('nizamcraft-player', JSON.stringify(playerState));
        localStorage.setItem('nizamcraft-chests', JSON.stringify(game.chests));
        if (!silent) game.showNotification('Dunia, Tas, Zirah, dan Level XP tersimpan.');
        return true;
    } catch (err) {
        console.error('Failed to save player/chests:', err);
        if (!silent) game.showNotification('Gagal menyimpan progres pemain.');
        return false;
    }
}

function restorePlayerAndChests() {
    try {
        const playerSaved = localStorage.getItem('nizamcraft-player');
        if (playerSaved) {
            const data = JSON.parse(playerSaved);
            if (data.position) {
                player.position.set(data.position.x, data.position.y, data.position.z);
                player.camera.position.set(data.position.x, data.position.y + player.eyeHeight, data.position.z);
            }
            player.health = data.health !== undefined ? data.health : 100;
            player.xp = data.xp !== undefined ? data.xp : 0;
            player.xpLevel = data.xpLevel !== undefined ? data.xpLevel : 5;
            player.enchantSeed = data.enchantSeed || (Math.floor(Math.random() * 100000) + 1);
            player.velocity.set(0, 0, 0);
            player.isGrounded = false;
            if (Array.isArray(data.inventory) && data.inventory.length === 24) {
                player.inventory = data.inventory;
            }
            if (data.armor) {
                player.armor = {
                    helmet: data.armor.helmet || null,
                    chestplate: data.armor.chestplate || null,
                    leggings: data.armor.leggings || null,
                    boots: data.armor.boots || null
                };
            }
            if (Array.isArray(data.hotbarLoadout) && data.hotbarLoadout.length === 9) {
                hotbarLoadout = data.hotbarLoadout;
                selectedBlockType = hotbarLoadout[activeHotbarIndex] || hotbarLoadout[0];
            }
        }
        const chestsSaved = localStorage.getItem('nizamcraft-chests');
        game.chests = chestsSaved ? JSON.parse(chestsSaved) : {};
    } catch (err) {
        console.error('Failed to restore player/chests:', err);
    }
}

function handleLoad() {
    craftGrid = Array(craftGridSize * craftGridSize).fill(null);
    if (world.load()) {
        restorePlayerAndChests();
        buildHotbarDOM();
        syncHeldVisual();
        updateArmorUI();
        updateXpUI();
        updateInventoryUI();
        if (!hasGameStarted) gameRenderer.render();
        game.showNotification('Dunia dan perlengkapan berhasil dimuat.');
    } else {
        game.showNotification('Belum ada data dunia tersimpan.');
    }
}

function handleReset() {
    if (!confirm('Atur ulang seluruh dunia menjadi rata tanpa pohon dan kembali ke perlengkapan awal?')) return;

    game.mobs.forEach(mob => mob.cleanupMesh?.());
    game.mobs = [];
    game.tnts.forEach(tnt => tnt.cleanup?.());
    game.tnts = [];
    game.arrows.forEach(arr => arr.destroy?.());
    game.arrows = [];
    game.chests = {};
    game.blockHits = {};

    craftGrid = Array(craftGridSize * craftGridSize).fill(null);
    player.ridingMinecart = null;
    player.resetDefaultInventory();
    player.armor = { helmet: null, chestplate: null, leggings: null, boots: null };
    hotbarLoadout = [...DEFAULT_HOTBAR_LOADOUT];
    equippedBagSlot = null;

    world.reset();
    player.respawn();
    if (hasGameStarted) {
        spawnInitialMobs();
    } else {
        gameRenderer.render();
    }
    buildHotbarDOM();
    selectHotbarSlot(0);
    updateArmorUI();
    updateXpUI();
    updateInventoryUI();
    saveAllState(true);
    game.showNotification('Dunia rata baru berhasil dibuat.');
}

function handleFullscreen() {
    if (!isFullscreen()) {
        safeRequestFullscreen(document.documentElement).catch(() => {});
    } else {
        safeExitFullscreen().catch(() => {});
    }
}

document.getElementById('overlay-save-btn')?.addEventListener('click', () => saveAllState(false));
document.getElementById('overlay-load-btn')?.addEventListener('click', handleLoad);
document.getElementById('overlay-respawn-btn')?.addEventListener('click', () => {
    player.respawn();
    if (!hasGameStarted) {
        gameRenderer.render();
        game.showNotification('Posisi awal disiapkan.');
    } else {
        game.showNotification('Kembali ke titik spawn.');
        enterGame();
    }
});
document.getElementById('overlay-fullscreen-btn')?.addEventListener('click', handleFullscreen);
document.getElementById('overlay-reset-btn')?.addEventListener('click', handleReset);

window.addEventListener('beforeunload', () => {
    if (hasGameStarted) {
        saveAllState(true);
    }
});

// ==========================================
// DYNAMIC 9/5-SLOT LOADOUT HOTBAR & BLOCK PICKER
// ==========================================

const hotbarContainer = document.getElementById('hotbar-container');
const heldBadge = document.getElementById('held-item-badge');
const heldBadgeIcon = document.getElementById('held-item-badge-icon');
const heldBadgeName = document.getElementById('held-item-badge-name');

function buildHotbarDOM() {
    if (!hotbarContainer) return;
    hotbarContainer.innerHTML = '';

    hotbarLoadout.forEach((type, index) => {
        const meta = HOTBAR_BY_TYPE.get(type) || { type, label: getItemName(type), nameId: getItemName(type) };
        const isActive = equippedBagSlot === null && index === activeHotbarIndex;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hotbar-slot' + (isActive ? ' active' : '');
        btn.dataset.index = String(index);
        btn.title = `${meta.nameId} (${index + 1})`;
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        btn.innerHTML = `
            <span class="slot-num">${index + 1}</span>
            <div class="block-preview">${getItemVisualHTML(type, 24)}</div>
            <span class="block-name">${meta.label}</span>
        `;
        btn.addEventListener('click', () => {
            selectHotbarSlot(index);
        });
        hotbarContainer.appendChild(btn);
    });
}

function syncHeldVisual() {
    const held = getActiveHeldItem();
    const enchanted = hasAnyEnchant(held);
    player.updateHeldItem(held.type, enchanted);

    if (heldBadge && heldBadgeIcon && heldBadgeName) {
        if (equippedBagSlot !== null && player.inventory[equippedBagSlot]) {
            const enchText = formatEnchantList(held).join(', ');
            heldBadge.style.display = 'inline-flex';
            heldBadgeIcon.innerHTML = getItemVisualHTML(held.type, 16);
            heldBadgeName.textContent = enchText
                ? `${getItemName(held.type)} · ${enchText}`
                : getItemName(held.type);
        } else {
            heldBadge.style.display = 'none';
        }
    }
}

function selectHotbarSlot(index) {
    const visibleCount = getVisibleHotbarCount();
    if (index < 0 || index >= visibleCount) return;
    activeHotbarIndex = index;
    equippedBagSlot = null;
    selectedBlockType = hotbarLoadout[index];

    const slots = hotbarContainer ? hotbarContainer.querySelectorAll('.hotbar-slot') : [];
    slots.forEach((slotEl, i) => {
        const isActive = i === index;
        slotEl.classList.toggle('active', isActive);
        slotEl.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    syncHeldVisual();
}

function pickBlockIntoLoadout(blockType) {
    const visibleCount = getVisibleHotbarCount();
    const { nextIndex, updated } = selectOrAssignHotbarSlot(
        hotbarLoadout,
        activeHotbarIndex,
        visibleCount,
        blockType
    );
    activeHotbarIndex = nextIndex;
    equippedBagSlot = null;
    selectedBlockType = blockType;
    if (updated) {
        buildHotbarDOM();
    } else {
        selectHotbarSlot(nextIndex);
    }
    syncHeldVisual();
}

function equipBagItemToHand(slotIndex) {
    const item = player.inventory[slotIndex];
    if (!item) return;
    equippedBagSlot = slotIndex;
    selectedBlockType = item.type;

    const slots = hotbarContainer ? hotbarContainer.querySelectorAll('.hotbar-slot') : [];
    slots.forEach(slotEl => {
        slotEl.classList.remove('active');
        slotEl.setAttribute('aria-selected', 'false');
    });

    syncHeldVisual();
    closeAllGameplayModals(true);
    game.showNotification(`Memegang ${getItemName(item.type)} di tangan.`);
}

function renderBlockPicker() {
    const grid = document.getElementById('block-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';

    HOTBAR_ITEMS.forEach(entry => {
        if (activePickerCategory !== 'all' && entry.category !== activePickerCategory) return;
        const isCurrent = equippedBagSlot === null && selectedBlockType === entry.type;
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'picker-tile' + (isCurrent ? ' active' : '');
        tile.innerHTML = `
            <div class="block-preview">${getItemVisualHTML(entry.type, 28)}</div>
            <span class="picker-tile-name">${entry.nameId}</span>
            <span class="picker-tile-key">Tombol: ${entry.key}</span>
        `;
        tile.addEventListener('click', () => {
            sounds.playClickSound();
            pickBlockIntoLoadout(entry.type);
            closeAllGameplayModals(true);
            game.showNotification(`Slot #${activeHotbarIndex + 1}: ${entry.nameId}`);
        });
        grid.appendChild(tile);
    });
}

function toggleBlockPicker() {
    const modal = document.getElementById('block-picker-modal');
    if (!modal) return;
    if (modal.style.display !== 'none') {
        closeAllGameplayModals(true);
    } else {
        openGameplayModal('block-picker-modal');
        renderBlockPicker();
    }
}

document.getElementById('open-block-picker-btn')?.addEventListener('click', toggleBlockPicker);
document.getElementById('close-picker-btn')?.addEventListener('click', () => closeAllGameplayModals(true));
document.querySelectorAll('#picker-category-tabs .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('#picker-category-tabs .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activePickerCategory = tab.getAttribute('data-cat') || 'all';
        renderBlockPicker();
    });
});

if (world.loadedFromSave) {
    restorePlayerAndChests();
}
buildHotbarDOM();
syncHeldVisual();

window.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true });
window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
}, { passive: false });

// ==========================================
// TARGETING & CONTEXTUAL HUD MORPHING
// ==========================================

const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);
const lookDirVec = new THREE.Vector3();

let activePlantTarget = null;
const contextPromptEl = document.getElementById('context-prompt');
const mobilePrimaryBtn = document.getElementById('mobile-btn-primary');
const mobileSecondaryBtn = document.getElementById('mobile-btn-secondary');
const mobileAuxBtn = document.getElementById('mobile-btn-aux');
const mobilePrimaryIcon = document.getElementById('mobile-icon-primary');
const mobileSecondaryIcon = document.getElementById('mobile-icon-secondary');
const mobileAuxIcon = document.getElementById('mobile-icon-aux');

let lastPrimaryIconName = 'pickaxe';
let lastSecondaryIconName = 'box';
let lastAuxIconName = 'crosshair';
let lastPromptText = '';

const INTERACTIVE_PROMPT_LABELS = {
    chest: '[Klik Kanan / .] Buka Peti',
    crafting: '[Klik Kanan / .] Meja Crafting',
    enchanting_table: '[Klik Kanan / .] Meja Enchant',
    lever: '[Klik Kanan / .] Saklar',
    button: '[Klik Kanan / .] Tekan Tombol',
    dispenser: '[Klik Kanan / .] Aktifkan Dispenser',
    tnt: '[Klik / .] Sulut TNT'
};

function syncContextualHUD(target) {
    // 1. Primary Mobile Arc Button: Swords on Mob, Pickaxe otherwise
    const isMob = target?.type === 'mob' && target.mob.type !== 'minecart';
    const nextPrimaryIcon = isMob ? 'swords' : 'pickaxe';
    if (nextPrimaryIcon !== lastPrimaryIconName && mobilePrimaryIcon) {
        mobilePrimaryIcon.innerHTML = svgIcon(nextPrimaryIcon, 22);
        lastPrimaryIconName = nextPrimaryIcon;
    }
    mobilePrimaryBtn?.classList.toggle('target-mob', isMob);

    // 2. Secondary Mobile Arc Button & Crosshair Prompt
    let promptText = '';
    let isInteractive = false;

    if (target?.type === 'mob' && target.mob.type === 'minecart') {
        promptText = '[Klik Kanan / .] Naiki Minecart';
        isInteractive = true;
    } else if (target?.type === 'block') {
        const base = normalizeBlockType(target.blockType);
        if (INTERACTIVE_PROMPT_LABELS[base]) {
            promptText = INTERACTIVE_PROMPT_LABELS[base];
            isInteractive = true;
        } else if (activePlantTarget) {
            promptText = '[P] Tanam Benih Gandum';
        }
    }

    const nextSecondaryIcon = isInteractive ? 'hand' : 'box';
    if (nextSecondaryIcon !== lastSecondaryIconName && mobileSecondaryIcon) {
        mobileSecondaryIcon.innerHTML = svgIcon(nextSecondaryIcon, 20);
        lastSecondaryIconName = nextSecondaryIcon;
    }
    mobileSecondaryBtn?.classList.toggle('target-interact', isInteractive);

    // 3. Aux Mobile Arc Button: Sprout on empty Farmland, Crosshair (Bow) otherwise
    const canPlant = activePlantTarget !== null;
    const nextAuxIcon = canPlant ? 'sprout' : 'crosshair';
    if (nextAuxIcon !== lastAuxIconName && mobileAuxIcon) {
        mobileAuxIcon.innerHTML = svgIcon(nextAuxIcon, 19);
        lastAuxIconName = nextAuxIcon;
    }
    mobileAuxBtn?.classList.toggle('target-plant', canPlant);

    // 4. Desktop/Center Crosshair Context Label
    if (contextPromptEl && promptText !== lastPromptText) {
        contextPromptEl.textContent = promptText;
        contextPromptEl.classList.toggle('visible', promptText.length > 0);
        lastPromptText = promptText;
    }
}

function plantSeed() {
    if (!activePlantTarget) return false;
    const { x, y, z } = activePlantTarget;
    world.addBlock(x, y + 1, z, 'crop');
    game.showNotification('Benih gandum ditanam.');
    return true;
}

function updateTargeting() {
    if ((!player.controls.isLocked && !player.isTouch) || isAnyOverlayOpen()) {
        world.setHighlightPosition(null);
        activePlantTarget = null;
        syncContextualHUD(null);
        return null;
    }

    raycaster.setFromCamera(screenCenter, camera);

    const mobMeshes = game.mobs.map(mob => mob.mesh);
    const mobIntersects = mobMeshes.length > 0 ? raycaster.intersectObjects(mobMeshes, true) : [];
    const closestMob = mobIntersects.length > 0 ? mobIntersects[0] : null;

    camera.getWorldDirection(lookDirVec);
    const blockHit = world.raycastBlock(camera.position, lookDirVec, 6.0);

    if (closestMob && closestMob.distance < 5.0 && (!blockHit || closestMob.distance < blockHit.distance)) {
        let targetedMob = null;
        for (const mob of game.mobs) {
            let obj = closestMob.object;
            while (obj) {
                if (obj === mob.mesh) {
                    targetedMob = mob;
                    break;
                }
                obj = obj.parent;
            }
            if (targetedMob) break;
        }
        if (targetedMob) {
            world.setHighlightPosition(null);
            activePlantTarget = null;
            const res = { type: 'mob', mob: targetedMob };
            syncContextualHUD(res);
            return res;
        }
    }

    if (blockHit) {
        const targetPos = blockHit.position;
        world.setHighlightPosition(targetPos);

        if (blockHit.blockType === 'farmland' && !world.getBlockAt(targetPos.x, targetPos.y + 1, targetPos.z)) {
            activePlantTarget = targetPos;
        } else {
            activePlantTarget = null;
        }

        const res = { type: 'block', targetPos, normal: blockHit.normal, blockType: blockHit.blockType };
        syncContextualHUD(res);
        return res;
    }

    world.setHighlightPosition(null);
    activePlantTarget = null;
    syncContextualHUD(null);
    return null;
}

// ==========================================
// COMBAT, MINING & BUILDING ACTIONS
// ==========================================

function grantPlayerXp(amount) {
    if (!player || amount <= 0) return;
    const res = grantXpToState(player, amount);
    updateXpUI();
    if (res.leveledUp) {
        sounds.playEnchantSound();
        game.showNotification(`Level XP naik ke Lv. ${player.xpLevel}.`);
    }
}

function addItemToInventory(type, count = 1, extra = {}) {
    if (!player || !player.inventory) return false;
    const leftover = insertItemIntoSlots(player.inventory, { type, count, ...extra });
    updateInventoryUI();
    if (leftover > 0) {
        game.showNotification('Tas penuh.');
        return false;
    }
    return true;
}

function performAttack(mob) {
    if (!mob) return;

    if (mob.type === 'minecart') {
        sounds.playDigSound();
        addItemToInventory('minecart', 1);
        if (player.ridingMinecart === mob) {
            player.ridingMinecart = null;
        }
        mob.cleanupMesh();
        const idx = game.mobs.indexOf(mob);
        if (idx !== -1) game.mobs.splice(idx, 1);
        game.showNotification('Minecart diambil kembali ke Tas.');
        return;
    }

    const held = getActiveHeldItem();
    const stats = getMeleeStats(held);
    mob.takeDamage(stats.damage);

    if (stats.lifeSteal > 0) {
        player.heal(stats.lifeSteal);
    }
    if (hasAnyEnchant(held)) {
        world.spawnBlockBreakParticles(
            mob.position.x,
            mob.position.y + 0.9,
            mob.position.z,
            'ender',
            stats.isFire ? 0xf97316 : 0xc084fc
        );
    }

    const pushDir = mob.position.clone().sub(player.position).setY(0.25).normalize();
    mob.velocity.addScaledVector(pushDir, stats.knockback);
}

function shootPlayerArrow() {
    const startPos = camera.position.clone();
    const targetDir = new THREE.Vector3();
    camera.getWorldDirection(targetDir);
    startPos.addScaledVector(targetDir, 0.5);
    const targetPos = startPos.clone().addScaledVector(targetDir, 10.0);

    const bowStats = getBowStats(findPlayerBowItem());
    const arrow = new Arrow(startPos, targetPos, scene, world, game, 'player', bowStats);
    game.arrows.push(arrow);
    sounds.playBowSound();
}

function triggerLuckyEvent(x, y, z) {
    const events = ['wealth', 'heal', 'golem', 'tnt', 'mobs', 'enchant'];
    const choice = events[Math.floor(Math.random() * events.length)];
    sounds.playClickSound();

    if (choice === 'wealth') {
        game.showNotification('Lucky Block: Hujan blok mulia.');
        const bTypes = ['diamond', 'emerald', 'quartz'];
        for (let i = 0; i < 4; i++) {
            const dx = Math.floor((Math.random() - 0.5) * 4);
            const dz = Math.floor((Math.random() - 0.5) * 4);
            const dy = 2 + Math.floor(Math.random() * 3);
            world.addBlock(x + dx, y + dy, z + dz, bTypes[Math.floor(Math.random() * bTypes.length)]);
        }
    } else if (choice === 'heal') {
        player.health = player.maxHealth;
        updateHealthUI();
        game.showNotification('Lucky Block: HP pulih penuh.');
    } else if (choice === 'golem') {
        game.mobs.push(new IronGolem(x, y + 1.5, z, scene, world, game));
        game.showNotification('Lucky Block: Iron Golem pelindung muncul.');
    } else if (choice === 'tnt') {
        const primedTnt = new PrimedTNT(x, y + 0.5, z, scene, world, game);
        primedTnt.fuse = 1.2;
        game.tnts.push(primedTnt);
        game.showNotification('Lucky Block: Jebakan TNT menyala.');
    } else if (choice === 'enchant') {
        const ids = Object.keys(ENCHANTMENTS);
        const pick = ids[Math.floor(Math.random() * ids.length)];
        const lvl = Math.min(ENCHANTMENTS[pick].maxLevel, 1 + Math.floor(Math.random() * 2));
        addItemToInventory('enchanted_book', 1, {
            enchants: { [pick]: lvl },
            enchant: { id: pick, level: lvl }
        });
        addItemToInventory('lapis', 6);
        grantPlayerXp(15);
        sounds.playEnchantSound();
        game.showNotification(`Lucky Block: Buku Enchant ${ENCHANTMENTS[pick].name} ${ROMAN_NUMERALS[lvl]} dan 6 Lapis Lazuli.`);
    } else {
        game.mobs.push(
            new Zombie(x - 1, y + 1.2, z, scene, world, game),
            new Skeleton(x + 1, y + 1.2, z, scene, world, game)
        );
        game.showNotification('Lucky Block: Penyergapan monster.');
    }
}

function handleBlockDig(targetPos) {
    const { x: tx, y: ty, z: tz } = targetPos;
    const blockType = world.getBlockAt(tx, ty, tz);
    if (!blockType) return;

    const baseType = normalizeBlockType(blockType);
    if (baseType === 'tnt') {
        world.removeBlock(tx, ty, tz, true);
        game.tnts.push(new PrimedTNT(tx, ty, tz, scene, world, game));
        return;
    }

    const mining = getMiningStats(getActiveHeldItem());
    let blockDestroyed = false;

    if (baseType === 'obsidian') {
        const coordKey = `${tx},${ty},${tz}`;
        game.blockHits[coordKey] = (game.blockHits[coordKey] || 0) + mining.hitPower;
        world.spawnBlockBreakParticles(tx, ty, tz, 'obsidian');
        sounds.playDigSound();

        const progress = Math.min(8, game.blockHits[coordKey]);
        if (progress >= 8) {
            world.removeBlock(tx, ty, tz);
            delete game.blockHits[coordKey];
            blockDestroyed = true;
        } else {
            game.showNotification(`Menambang Obsidian (${progress}/8)`);
        }
    } else if (baseType === 'lucky') {
        world.removeBlock(tx, ty, tz);
        triggerLuckyEvent(tx, ty, tz);
        blockDestroyed = true;
    } else {
        world.removeBlock(tx, ty, tz);
        blockDestroyed = true;
    }

    if (!blockDestroyed) return;

    if (baseType === 'chest') {
        const key = `${tx},${ty},${tz}`;
        const chestInv = game.chests[key];
        if (chestInv) {
            let transferredAny = false;
            chestInv.forEach(item => {
                if (item) {
                    insertItemIntoSlots(player.inventory, item);
                    transferredAny = true;
                }
            });
            delete game.chests[key];
            updateInventoryUI();
            if (transferredAny) {
                game.showNotification('Peti dihancurkan, seluruh isinya masuk ke Tas.');
            }
        }
    }

    const xpRewards = {
        coal_ore: 2,
        iron_ore: 3,
        gold_ore: 4,
        lapis_ore: 5,
        diamond: 7,
        emerald: 7,
        obsidian: 6,
        crop: 1
    };
    if (xpRewards[baseType]) {
        grantPlayerXp(xpRewards[baseType]);
    }

    let itemToGive = baseType;
    let dropCount = 1;

    if (mining.silkTouch) {
        itemToGive = baseType;
        dropCount = 1;
    } else {
        if (baseType === 'grass') itemToGive = 'dirt';
        else if (baseType === 'coal_ore') itemToGive = 'coal';
        else if (baseType === 'iron_ore') itemToGive = 'iron_ingot';
        else if (baseType === 'gold_ore') itemToGive = 'gold_ingot';
        else if (baseType === 'lapis_ore') {
            itemToGive = 'lapis';
            dropCount = 2 + Math.floor(Math.random() * 3);
        } else if (baseType === 'bookshelf') {
            itemToGive = 'book';
            dropCount = 3;
        } else if (baseType === 'leaf') {
            const r = Math.random();
            if (r < 0.15) {
                itemToGive = 'golden_apple';
                game.showNotification('Apel Emas jatuh dari dedaunan.');
            } else if (r < 0.35) {
                itemToGive = 'crop';
            } else if (r < 0.55) {
                itemToGive = 'stick';
                dropCount = 1 + Math.floor(Math.random() * 2);
            }
        }

        if (
            mining.fortuneLevel > 0 &&
            (baseType === 'coal_ore' ||
                baseType === 'iron_ore' ||
                baseType === 'gold_ore' ||
                baseType === 'lapis_ore' ||
                baseType === 'diamond' ||
                baseType === 'emerald')
        ) {
            dropCount += Math.floor(Math.random() * (mining.fortuneLevel + 1));
        }
    }

    if (itemToGive !== 'lucky') {
        addItemToInventory(itemToGive, dropCount);
    }
}

function handleGolemSpawn(type, x, y, z) {
    if (type === 'spawn_irongolem') {
        game.mobs.push(new IronGolem(x, y + 0.5, z, scene, world, game));
        sounds.playPlaceSound();
        world.spawnCropParticles(x, y + 0.5, z, 0xcccccc);
        game.showNotification('Iron Golem dipanggil.');
        return true;
    }
    if (type === 'spawn_snowgolem') {
        game.mobs.push(new SnowGolem(x, y + 0.5, z, scene, world, game));
        sounds.playPlaceSound();
        world.spawnCropParticles(x, y + 0.5, z, 0xffffff);
        game.showNotification('Snow Golem dipanggil.');
        return true;
    }
    return false;
}

function handlePrimaryAction() {
    player.swing();
    const target = updateTargeting();
    if (!target) {
        sounds.playClickSound();
        return;
    }
    if (target.type === 'mob') {
        performAttack(target.mob);
    } else if (target.type === 'block') {
        handleBlockDig(target.targetPos);
    }
}

function handleSecondaryAction() {
    player.swing();
    const held = getActiveHeldItem();

    if (held && held.type === 'golden_apple' && equippedBagSlot !== null) {
        eatGoldenApple(equippedBagSlot);
        return;
    }
    if (held && held.type === 'bow') {
        shootPlayerArrow();
        return;
    }

    const target = updateTargeting();
    if (target && target.type === 'mob' && target.mob.type === 'minecart') {
        target.mob.rider = player;
        player.ridingMinecart = target.mob;
        sounds.playClickSound();
        game.showNotification('Menaiki Minecart. Gunakan W/S untuk melaju, Spasi untuk turun.');
        return;
    }

    if (!target || target.type !== 'block') {
        if (held && held.type === 'enchanted_book' && equippedBagSlot !== null) {
            anvilSacrificeRef = { source: 'bag', key: equippedBagSlot };
            openEnchantMenu();
            return;
        }
        sounds.playClickSound();
        return;
    }

    const { targetPos, normal } = target;
    const targetedBlockType = world.getBlockAt(targetPos.x, targetPos.y, targetPos.z);
    const targetedBase = normalizeBlockType(targetedBlockType);

    if (targetedBase === 'chest') {
        openChestStorage(targetPos.x, targetPos.y, targetPos.z);
        return;
    }
    if (targetedBase === 'crafting') {
        openCraftingMenu(true);
        return;
    }
    if (targetedBase === 'enchanting_table') {
        openEnchantMenu({ x: targetPos.x, y: targetPos.y, z: targetPos.z });
        return;
    }
    if (targetedBlockType === 'lever' || targetedBlockType === 'lever_on') {
        toggleLever(targetPos.x, targetPos.y, targetPos.z);
        return;
    }
    if (targetedBlockType === 'button' || targetedBlockType === 'button_pressed') {
        pressButton(targetPos.x, targetPos.y, targetPos.z);
        return;
    }
    if (targetedBase === 'dispenser') {
        activateDispenser(targetPos.x, targetPos.y, targetPos.z);
        return;
    }
    if (targetedBase === 'tnt') {
        world.removeBlock(targetPos.x, targetPos.y, targetPos.z, true);
        game.tnts.push(new PrimedTNT(targetPos.x, targetPos.y, targetPos.z, scene, world, game));
        return;
    }

    if (held && held.type === 'enchanted_book' && equippedBagSlot !== null) {
        anvilSacrificeRef = { source: 'bag', key: equippedBagSlot };
        openEnchantMenu();
        return;
    }

    const blockToPlace = held ? held.type : selectedBlockType;

    if (
        getEquipmentCategory(blockToPlace) !== null ||
        blockToPlace === 'book' ||
        blockToPlace === 'stick' ||
        blockToPlace === 'lapis' ||
        blockToPlace === 'coal' ||
        blockToPlace === 'iron_ingot' ||
        blockToPlace === 'gold_ingot'
    ) {
        sounds.playClickSound();
        return;
    }

    if (blockToPlace === 'minecart') {
        const railPos = targetedBase === 'rail'
            ? targetPos
            : (world.getBlockAt(targetPos.x, targetPos.y + 1, targetPos.z) === 'rail'
                ? new THREE.Vector3(targetPos.x, targetPos.y + 1, targetPos.z)
                : null);

        if (railPos) {
            const cart = new Minecart(railPos.x, railPos.y - 0.44, railPos.z, scene, world, game);
            game.mobs.push(cart);
            sounds.playPlaceSound();
            if (equippedBagSlot !== null && player.inventory[equippedBagSlot]?.type === 'minecart') {
                player.inventory[equippedBagSlot].count--;
                if (player.inventory[equippedBagSlot].count <= 0) {
                    player.inventory[equippedBagSlot] = null;
                    selectHotbarSlot(activeHotbarIndex);
                }
                updateInventoryUI();
            }
            game.showNotification('Minecart diletakkan di atas rel. Klik kanan atau tekan [.] untuk naik.');
        } else {
            game.showNotification('Arahkan ke blok Rel Kereta untuk meletakkan Minecart.');
        }
        return;
    }

    const buildX = Math.round(targetPos.x + normal.x);
    const buildY = Math.round(targetPos.y + normal.y);
    const buildZ = Math.round(targetPos.z + normal.z);

    if (
        isSolidBlock(blockToPlace) &&
        entityOverlapsBlock(
            player.position.x,
            player.position.y,
            player.position.z,
            player.width / 2,
            player.height,
            buildX,
            buildY,
            buildZ
        )
    ) {
        return;
    }

    if (blockToPlace === 'spawn_irongolem' || blockToPlace === 'spawn_snowgolem') {
        handleGolemSpawn(blockToPlace, buildX, buildY, buildZ);
        return;
    }

    world.addBlock(buildX, buildY, buildZ, blockToPlace);
}

// ==========================================
// DESKTOP MOUSE, KEYBOARD & MOBILE INPUTS
// ==========================================

window.addEventListener('mousedown', (e) => {
    if (!player.controls.isLocked || isAnyOverlayOpen()) return;
    const isRightClick = e.button === 2 || (e.button === 0 && (e.ctrlKey || e.metaKey));
    const isLeftClick = e.button === 0 && !e.ctrlKey && !e.metaKey;

    if (isLeftClick) handlePrimaryAction();
    else if (isRightClick) handleSecondaryAction();
});

// Direct block shortcuts outside digits 1-9 load the block into the active slot
const DIRECT_BLOCK_KEY_MAP = {};
HOTBAR_ITEMS.forEach(entry => {
    if (!/^[1-9]$/.test(entry.key)) {
        DIRECT_BLOCK_KEY_MAP[entry.key.toLowerCase()] = entry.type;
        DIRECT_BLOCK_KEY_MAP[entry.key.toUpperCase()] = entry.type;
    }
});

function toggleDesktopHelp() {
    const guide = document.getElementById('guide-panel');
    if (!guide) return;
    guide.style.display = guide.style.display === 'none' ? 'block' : 'none';
}

function toggleWorkbenchModal() {
    const craftEl = document.getElementById('crafting-modal');
    const enchEl = document.getElementById('enchant-modal');
    if ((craftEl && craftEl.style.display !== 'none') || (enchEl && enchEl.style.display !== 'none')) {
        closeAllGameplayModals(true);
        return;
    }
    if (lastWorkbenchTab === 'enchant') {
        openEnchantMenu();
    } else {
        openCraftingMenu();
    }
}

window.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('in-game')) return;

    if (e.key === 'Escape' && isGameplayModalOpen()) {
        e.preventDefault();
        closeAllGameplayModals(true);
        return;
    }

    if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        toggleInventory();
        return;
    }

    if (e.key === 'Tab') {
        e.preventDefault();
        toggleBlockPicker();
        return;
    }

    if (e.code === 'Slash') {
        e.preventDefault();
        toggleWorkbenchModal();
        return;
    }

    if (isGameplayModalOpen()) return;
    if (!player.controls.isLocked && !player.isTouch) return;

    if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleDesktopHelp();
        return;
    }

    // Keyboard Dig/Attack (`,` or `[`) and Place/Interact (`.` or `]`)
    if (e.code === 'Comma' || e.code === 'BracketLeft') {
        e.preventDefault();
        handlePrimaryAction();
        return;
    }
    if (e.code === 'Period' || e.code === 'BracketRight') {
        e.preventDefault();
        handleSecondaryAction();
        return;
    }

    if ((e.key === 'p' || e.key === 'P') && activePlantTarget) {
        e.preventDefault();
        player.swing();
        plantSeed();
        return;
    }

    if (/^[1-9]$/.test(e.key)) {
        selectHotbarSlot(parseInt(e.key, 10) - 1);
        return;
    }

    if (DIRECT_BLOCK_KEY_MAP[e.key]) {
        pickBlockIntoLoadout(DIRECT_BLOCK_KEY_MAP[e.key]);
        return;
    }

    if (e.key === 'f' || e.key === 'F') {
        player.swing();
        shootPlayerArrow();
    } else if (e.key === 'Backspace') {
        handleReset();
    }
});

window.addEventListener('wheel', (e) => {
    if (player.controls.isLocked && !isGameplayModalOpen()) {
        const visibleCount = getVisibleHotbarCount();
        const delta = e.deltaY > 0 ? 1 : -1;
        const nextIndex = (activeHotbarIndex + delta + visibleCount) % visibleCount;
        selectHotbarSlot(nextIndex);
    }
}, { passive: true });

// Mobile Top Bar & Contextual 4-Button Arc Listeners
document.getElementById('mobile-bag-btn')?.addEventListener('click', toggleInventory);
document.getElementById('mobile-workbench-btn')?.addEventListener('click', toggleWorkbenchModal);
document.getElementById('mobile-pause-btn')?.addEventListener('click', exitGame);

mobilePrimaryBtn?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handlePrimaryAction();
});

mobileSecondaryBtn?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleSecondaryAction();
});

mobileAuxBtn?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    player.swing();
    if (activePlantTarget) {
        plantSeed();
    } else {
        shootPlayerArrow();
    }
});

// ==========================================
// MOB SPAWNING (DEFERRED UNTIL START)
// ==========================================

function spawnMob(type) {
    const x = Math.floor((Math.random() - 0.5) * (world.width - 8));
    const z = Math.floor((Math.random() - 0.5) * (world.depth - 8));

    let y = world.height - 1;
    while (y > 0) {
        const b = world.getBlockAt(x, y, z);
        if (b && !b.startsWith('water') && !b.startsWith('lava')) break;
        y--;
    }

    if (y > 0 && y < world.height - 3) {
        const sy = y + 0.5;
        let mobInstance = null;
        if (type === 'zombie') mobInstance = new Zombie(x, sy, z, scene, world, game);
        else if (type === 'creeper') mobInstance = new Creeper(x, sy, z, scene, world, game);
        else if (type === 'skeleton') mobInstance = new Skeleton(x, sy, z, scene, world, game);
        else if (type === 'irongolem') mobInstance = new IronGolem(x, sy, z, scene, world, game);
        else if (type === 'snowgolem') mobInstance = new SnowGolem(x, sy, z, scene, world, game);
        else if (type === 'chicken') mobInstance = new Chicken(x, sy, z, scene, world, game);
        else if (type === 'pig') mobInstance = new Pig(x, sy, z, scene, world, game);
        else if (type === 'cow') mobInstance = new Cow(x, sy, z, scene, world, game);
        else if (type === 'bloodgolem') mobInstance = new BloodGolem(x, sy, z, scene, world, game);
        else if (type === 'giantirongolem') mobInstance = new GiantIronGolem(x, sy, z, scene, world, game);
        else if (type === 'witherskeleton') mobInstance = new WitherSkeleton(x, sy, z, scene, world, game);

        if (mobInstance) game.mobs.push(mobInstance);
    }
}

function spawnInitialMobs() {
    for (let i = 0; i < 4; i++) {
        spawnMob(['zombie', 'creeper', 'skeleton', 'witherskeleton'][i]);
    }
    for (let i = 0; i < 6; i++) {
        spawnMob(['chicken', 'pig', 'cow'][i % 3]);
    }
    spawnMob('giantirongolem');
    spawnMob('bloodgolem');
}

function startMobSpawner() {
    if (mobSpawnIntervalId !== null) return;
    mobSpawnIntervalId = setInterval(() => {
        if (hasGameStarted && document.body.classList.contains('in-game') && !isGameplayModalOpen() && game.mobs.length < 18) {
            const rand = Math.random();
            if (rand < 0.03) spawnMob('giantirongolem');
            else if (rand < 0.07) spawnMob('bloodgolem');
            else if (rand < 0.12) spawnMob('irongolem');
            else if (rand < 0.17) spawnMob('snowgolem');
            else if (rand < 0.45) {
                const animals = ['chicken', 'pig', 'cow'];
                spawnMob(animals[Math.floor(Math.random() * animals.length)]);
            } else {
                const hostiles = ['zombie', 'creeper', 'skeleton', 'witherskeleton'];
                spawnMob(hostiles[Math.floor(Math.random() * hostiles.length)]);
            }
        }
    }, 8000);
}

// ==========================================
// INVENTORY, ARMOR & CHEST UI
// ==========================================

function formatSlotTooltip(item) {
    if (!item) return '';
    const baseName = getItemName(item.type);
    const enchants = formatEnchantList(item);
    const countLabel = item.count > 1 ? ` (${item.count})` : '';
    return enchants.length > 0
        ? `${baseName}${countLabel} — ${enchants.join(', ')}`
        : `${baseName}${countLabel}`;
}

function createSlotElement(item, index, isSelected, onClick) {
    const slotEl = document.createElement('button');
    slotEl.type = 'button';
    slotEl.className = 'inv-slot';
    slotEl.dataset.index = String(index);

    if (isSelected) slotEl.classList.add('selected');
    if (item) {
        slotEl.title = formatSlotTooltip(item);
        if (item.type === 'golden_apple' || item.type.includes('diamond')) {
            slotEl.classList.add('rare-item');
        }
        if (hasAnyEnchant(item)) {
            slotEl.classList.add('enchanted-item');
        }
        slotEl.innerHTML = `
            ${hasAnyEnchant(item) ? '<span class="enchant-glint-dot"></span>' : ''}
            <div class="item-visual">${getItemVisualHTML(item.type, 24)}</div>
            ${item.count > 1 ? `<div class="item-count">${item.count}</div>` : ''}
        `;
        slotEl.addEventListener('click', onClick);
    }
    return slotEl;
}

function updateInventoryUI() {
    const bagGrid = document.getElementById('bag-grid');
    const chestGrid = document.getElementById('chest-grid');
    if (!bagGrid) return;

    bagGrid.innerHTML = '';
    for (let i = 0; i < player.inventory.length; i++) {
        const item = player.inventory[i];
        const slotEl = createSlotElement(item, i, selectedInventorySlot === i, () => handleSlotClick('bag', i));
        bagGrid.appendChild(slotEl);
    }

    if (currentChestPos && chestGrid) {
        chestGrid.innerHTML = '';
        const key = `${currentChestPos.x},${currentChestPos.y},${currentChestPos.z}`;
        if (!game.chests[key]) game.chests[key] = Array(18).fill(null);
        const chestInv = game.chests[key];

        for (let i = 0; i < chestInv.length; i++) {
            const item = chestInv[i];
            const slotEl = createSlotElement(item, i, false, () => handleSlotClick('chest', i));
            chestGrid.appendChild(slotEl);
        }
    }

    ['helmet', 'chestplate', 'leggings', 'boots'].forEach(slotName => {
        const slotEl = document.querySelector(`.armor-slot[data-slot="${slotName}"]`);
        if (!slotEl) return;
        const slotItemContainer = slotEl.querySelector('.slot-item');
        const placeholderEl = slotEl.querySelector('.slot-placeholder');
        const item = player.armor[slotName];

        slotEl.classList.toggle('enchanted-item', hasAnyEnchant(item));

        if (item) {
            slotEl.title = `${formatSlotTooltip(item)} — Klik untuk melepas`;
            placeholderEl.style.display = 'none';
            slotItemContainer.innerHTML = `<div class="item-visual">${getItemVisualHTML(item.type, 24)}</div>`;
            slotItemContainer.style.display = 'flex';
            slotEl.onclick = () => unequipArmor(slotName);
        } else {
            slotEl.title = `Slot ${slotName}`;
            placeholderEl.style.display = 'flex';
            slotItemContainer.innerHTML = '';
            slotItemContainer.style.display = 'none';
            slotEl.onclick = null;
        }
    });

    const statsHp = document.getElementById('stats-hp');
    const statsDef = document.getElementById('stats-def');
    const statsXp = document.getElementById('stats-xp');
    if (statsHp) statsHp.textContent = `HP: ${Math.round(player.health)} / ${player.maxHealth}`;
    if (statsDef) statsDef.textContent = `DEF: ${Math.round(player.getArmorReduction() * 100)}%`;
    if (statsXp) statsXp.textContent = `Level XP: ${player.xpLevel} (${player.xp}/${getXpForNextLevel(player.xpLevel)})`;

    const detailEl = document.getElementById('selected-item-detail');
    const eatBtn = document.getElementById('eat-apple-btn');
    const handBtn = document.getElementById('equip-hand-btn');
    const useBookBtn = document.getElementById('use-enchant-book-btn');

    const selectedItem = selectedInventorySlot !== null ? player.inventory[selectedInventorySlot] : null;

    if (eatBtn) eatBtn.style.display = selectedItem?.type === 'golden_apple' ? 'inline-flex' : 'none';
    if (useBookBtn) useBookBtn.style.display = selectedItem?.type === 'enchanted_book' ? 'inline-flex' : 'none';
    if (handBtn) {
        const canHold = selectedItem && !getArmorSlotName(selectedItem.type);
        handBtn.style.display = canHold ? 'inline-flex' : 'none';
    }
    if (detailEl) {
        if (selectedItem) {
            detailEl.textContent = formatSlotTooltip(selectedItem);
        } else if (currentChestPos) {
            detailEl.textContent = 'Klik item untuk memindahkan antara Tas dan Peti.';
        } else {
            detailEl.textContent = 'Pilih item di Tas untuk memegang, memakai zirah, atau menempa buku enchant.';
        }
    }

    updateArmorUI();
}

function handleSlotClick(source, index) {
    if (source === 'bag') {
        const item = player.inventory[index];
        if (!item) return;

        if (currentChestPos) {
            const key = `${currentChestPos.x},${currentChestPos.y},${currentChestPos.z}`;
            const chestInv = game.chests[key];
            if (moveSlotBetweenContainers(player.inventory, index, chestInv)) {
                if (equippedBagSlot === index && !player.inventory[index]) equippedBagSlot = null;
                sounds.playClickSound();
                syncHeldVisual();
            } else {
                game.showNotification('Peti penuh.');
            }
            selectedInventorySlot = null;
        } else if (getArmorSlotName(item.type)) {
            equipArmor(index);
        } else {
            selectedInventorySlot = selectedInventorySlot === index ? null : index;
        }
    } else if (source === 'chest' && currentChestPos) {
        const key = `${currentChestPos.x},${currentChestPos.y},${currentChestPos.z}`;
        const chestInv = game.chests[key];
        if (moveSlotBetweenContainers(chestInv, index, player.inventory)) {
            sounds.playClickSound();
        } else {
            game.showNotification('Tas penuh.');
        }
    }
    updateInventoryUI();
}

function equipArmor(slotIndex) {
    const item = player.inventory[slotIndex];
    const slotName = item ? getArmorSlotName(item.type) : null;
    if (!slotName) return;

    const prevArmor = player.armor[slotName];
    const ench = getItemEnchants(item);
    player.armor[slotName] = {
        type: item.type,
        count: 1,
        ...(Object.keys(ench).length > 0 ? { enchants: ench } : {}),
        ...(item.anvilUses ? { anvilUses: item.anvilUses } : {})
    };
    player.inventory[slotIndex] = prevArmor;
    selectedInventorySlot = null;

    sounds.playClickSound();
    game.showNotification(`${getItemName(item.type)} terpasang.`);
}

function unequipArmor(slotName) {
    const item = player.armor[slotName];
    if (!item) return;

    const leftover = insertItemIntoSlots(player.inventory, item);
    if (leftover === 0) {
        player.armor[slotName] = null;
        sounds.playClickSound();
        game.showNotification(`${getItemName(item.type)} dilepas ke Tas.`);
    } else {
        game.showNotification('Kosongkan satu slot Tas untuk melepas zirah.');
    }
    updateInventoryUI();
}

function eatGoldenApple(slotIndex) {
    const item = player.inventory[slotIndex];
    if (!item || item.type !== 'golden_apple') return;

    item.count--;
    if (item.count <= 0) {
        player.inventory[slotIndex] = null;
        if (equippedBagSlot === slotIndex) equippedBagSlot = null;
    }

    player.health = Math.min(player.maxHealth, player.health + 50);
    updateHealthUI();
    sounds.playEnchantSound();
    flashScreen('rgba(251, 191, 36, 0.3)', 120, 260);
    game.showNotification('Apel Emas dikonsumsi (+50 HP).');
    selectedInventorySlot = null;
    syncHeldVisual();
    updateInventoryUI();
}

function toggleInventory() {
    const modal = document.getElementById('inventory-modal');
    if (!modal) return;
    if (modal.style.display !== 'none') {
        closeAllGameplayModals(true);
    } else {
        openGameplayModal('inventory-modal');
        const chestSec = document.getElementById('chest-storage-section');
        if (chestSec) chestSec.style.display = 'none';
        const title = document.getElementById('inventory-title');
        if (title) title.textContent = 'Tas & Perlengkapan';
        selectedInventorySlot = null;
        updateInventoryUI();
    }
}

function openChestStorage(x, y, z) {
    currentChestPos = { x, y, z };
    openGameplayModal('inventory-modal');
    const chestSec = document.getElementById('chest-storage-section');
    if (chestSec) chestSec.style.display = 'block';
    const title = document.getElementById('inventory-title');
    if (title) title.textContent = 'Peti Penyimpanan';
    selectedInventorySlot = null;
    updateInventoryUI();
}

document.getElementById('close-inventory-btn')?.addEventListener('click', () => closeAllGameplayModals(true));
document.getElementById('eat-apple-btn')?.addEventListener('click', () => {
    if (selectedInventorySlot !== null) eatGoldenApple(selectedInventorySlot);
});
document.getElementById('equip-hand-btn')?.addEventListener('click', () => {
    if (selectedInventorySlot !== null) equipBagItemToHand(selectedInventorySlot);
});
document.getElementById('use-enchant-book-btn')?.addEventListener('click', () => {
    if (selectedInventorySlot !== null) {
        anvilSacrificeRef = { source: 'bag', key: selectedInventorySlot };
        openEnchantMenu();
    }
});

// ==========================================
// MINECRAFT CRAFTING (2x2 & 3x3) & ENCHANTING + ANVIL
// ==========================================

function findNearbyStationBlock(targetBaseType, radius = 5) {
    const px = Math.round(player.position.x);
    const py = Math.round(player.position.y);
    const pz = Math.round(player.position.z);

    let best = null;
    let bestScore = -Infinity;

    for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const bx = px + dx;
                const by = py + dy;
                const bz = pz + dz;
                const block = world.getBlockAt(bx, by, bz);
                if (!block || normalizeBlockType(block) !== targetBaseType) continue;

                const distSq = dx * dx + dy * dy + dz * dz;
                const shelfBonus = targetBaseType === 'enchanting_table'
                    ? countEnchantingBookshelves(world.boundGetBlockAt, bx, by, bz) * 100
                    : 0;
                const score = shelfBonus - distSq;
                if (score > bestScore) {
                    bestScore = score;
                    best = { x: bx, y: by, z: bz };
                }
            }
        }
    }
    return best;
}

function getCombinedCraftingCounts() {
    const counts = countInventoryMaterials(player.inventory);
    craftGrid.forEach(cell => {
        if (cell && cell.type && cell.count > 0 && !hasAnyEnchant(cell)) {
            counts[cell.type] = (counts[cell.type] || 0) + cell.count;
        }
    });
    return counts;
}

function deductSingleMaterialFromBag(type) {
    for (let i = 0; i < player.inventory.length; i++) {
        const slot = player.inventory[i];
        if (!slot || slot.type !== type || hasAnyEnchant(slot)) continue;
        slot.count -= 1;
        if (slot.count <= 0) {
            player.inventory[i] = null;
            if (equippedBagSlot === i) equippedBagSlot = null;
        }
        return true;
    }
    return false;
}

function handleCraftCellClick(cellIdx, addStack = false) {
    const current = craftGrid[cellIdx];

    if (!current) {
        if (!selectedCraftMaterial) {
            game.showNotification('Pilih bahan di bawah Grid terlebih dahulu.');
            return;
        }
        if (deductSingleMaterialFromBag(selectedCraftMaterial)) {
            craftGrid[cellIdx] = { type: selectedCraftMaterial, count: 1 };
            sounds.playClickSound();
            syncHeldVisual();
            updateInventoryUI();
            renderCraftingMenu();
        }
        return;
    }

    if (addStack && selectedCraftMaterial === current.type) {
        if (deductSingleMaterialFromBag(selectedCraftMaterial)) {
            current.count += 1;
            sounds.playClickSound();
            syncHeldVisual();
            updateInventoryUI();
            renderCraftingMenu();
        }
        return;
    }

    const leftover = insertItemIntoSlots(player.inventory, { type: current.type, count: current.count });
    if (leftover > 0) {
        current.count = leftover;
        game.showNotification('Tas penuh.');
    } else {
        craftGrid[cellIdx] = null;
    }
    sounds.playClickSound();
    updateInventoryUI();
    renderCraftingMenu();
}

function executeGridCraft(craftMax = false) {
    const match = matchCraftingGrid(craftGrid, craftGridSize);
    if (!match) return;

    const { recipe } = match;
    let totalCrafted = 0;

    while (true) {
        const currentMatch = matchCraftingGrid(craftGrid, craftGridSize);
        if (!currentMatch || currentMatch.recipe.id !== recipe.id) break;

        const probeBag = player.inventory.map(s => (s ? { ...s } : null));
        if (insertItemIntoSlots(probeBag, { type: recipe.result, count: recipe.resultCount }) > 0) {
            if (totalCrafted === 0) {
                game.showNotification('Tas penuh. Kosongkan slot terlebih dahulu.');
            }
            break;
        }

        consumeCraftingGrid(craftGrid, 1);
        insertItemIntoSlots(player.inventory, { type: recipe.result, count: recipe.resultCount });
        totalCrafted += recipe.resultCount;

        if (!craftMax) break;

        const gridEmpty = craftGrid.every(c => !c);
        if (gridEmpty && canCraftRecipeFromSlots(player.inventory, recipe)) {
            populateGridForRecipe(player.inventory, craftGrid, craftGridSize, recipe);
        }
    }

    if (totalCrafted > 0) {
        sounds.playPlaceSound();
        game.showNotification(`${recipe.resultName} x${totalCrafted} dirakit ke Tas.`);
        syncHeldVisual();
        updateInventoryUI();
        renderCraftingMenu();
    }
}

function renderCraftingMenu() {
    const modeBadge = document.getElementById('craft-mode-badge');
    const footerTip = document.getElementById('crafting-footer-tip');
    if (modeBadge) {
        modeBadge.textContent = craftGridSize === 3 ? '3x3 Meja Crafting' : '2x2 Rakit Tangan';
        modeBadge.classList.toggle('emerald', craftGridSize === 3);
    }
    if (footerTip) {
        footerTip.textContent = craftGridSize === 3
            ? 'Meja Crafting aktif (3x3). Susun bahan manual di Grid atau klik resep untuk mengisi pola otomatis.'
            : 'Mode Rakit Tangan (2x2). Rakit Meja Crafting lalu pasang di dunia untuk membuka seluruh resep 3x3.';
    }

    const bagCounts = countInventoryMaterials(player.inventory);
    const availableTypes = Object.keys(bagCounts).filter(
        t => bagCounts[t] > 0 && getEquipmentCategory(t) === null && t !== 'enchanted_book'
    );
    if (!selectedCraftMaterial || !bagCounts[selectedCraftMaterial]) {
        selectedCraftMaterial = availableTypes[0] || null;
    }

    // 1. Render Interactive 2x2 / 3x3 Grid
    const boardEl = document.getElementById('crafting-grid-board');
    if (boardEl) {
        boardEl.className = `craft-matrix grid-${craftGridSize}x${craftGridSize}`;
        boardEl.innerHTML = '';
        for (let idx = 0; idx < craftGridSize * craftGridSize; idx++) {
            const cell = craftGrid[idx];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'craft-cell' + (cell ? ' filled' : '');
            if (cell) {
                btn.title = `${getItemName(cell.type)} (${cell.count}) - Klik untuk melepas ke Tas`;
                btn.innerHTML = `
                    <div class="item-visual">${getItemVisualHTML(cell.type, 24)}</div>
                    ${cell.count > 1 ? `<span class="item-count">${cell.count}</span>` : ''}
                `;
            } else {
                btn.title = selectedCraftMaterial
                    ? `Taruh 1 ${getItemName(selectedCraftMaterial)}`
                    : 'Kotak kosong';
            }
            btn.addEventListener('click', (e) => handleCraftCellClick(idx, e.shiftKey));
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleCraftCellClick(idx, true);
            });
            boardEl.appendChild(btn);
        }
    }

    // 2. Render Output Slot & Craft Buttons
    const match = matchCraftingGrid(craftGrid, craftGridSize);
    const outSlot = document.getElementById('craft-output-slot');
    const onceBtn = document.getElementById('craft-once-btn');
    const onceLabel = document.getElementById('craft-once-label');
    const maxBtn = document.getElementById('craft-max-btn');

    if (outSlot) {
        if (match) {
            outSlot.disabled = false;
            outSlot.classList.add('ready');
            outSlot.title = `Klik untuk merakit ${match.recipe.resultName} x${match.recipe.resultCount}`;
            outSlot.innerHTML = `
                <div class="item-visual">${getItemVisualHTML(match.recipe.result, 30)}</div>
                ${match.recipe.resultCount > 1 ? `<span class="item-count">x${match.recipe.resultCount}</span>` : ''}
            `;
        } else {
            outSlot.disabled = true;
            outSlot.classList.remove('ready');
            outSlot.title = 'Susun bahan sesuai resep Minecraft';
            outSlot.innerHTML = '';
        }
    }
    if (onceBtn && onceLabel) {
        onceBtn.disabled = !match;
        onceLabel.textContent = match
            ? `Rakit ${match.recipe.resultName}${match.recipe.resultCount > 1 ? ` x${match.recipe.resultCount}` : ''}`
            : 'Susun Pola';
    }
    if (maxBtn) {
        maxBtn.disabled = !match;
    }

    // 3. Render Clickable Bag Palette
    const paletteEl = document.getElementById('crafting-bag-palette');
    if (paletteEl) {
        paletteEl.innerHTML = '';
        if (availableTypes.length === 0) {
            paletteEl.innerHTML = `<span class="info-tip">Tidak ada bahan mentah tersisa di Tas.</span>`;
        } else {
            availableTypes.forEach(matType => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'palette-chip' + (selectedCraftMaterial === matType ? ' selected' : '');
                chip.innerHTML = `
                    ${getItemVisualHTML(matType, 16)}
                    <span>${getItemName(matType)}</span>
                    <strong>${bagCounts[matType]}</strong>
                `;
                chip.addEventListener('click', () => {
                    selectedCraftMaterial = matType;
                    renderCraftingMenu();
                });
                paletteEl.appendChild(chip);
            });
        }
    }

    // 4. Render Minecraft Recipe Book
    const listEl = document.getElementById('recipes-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const combinedCounts = getCombinedCraftingCounts();
    const filtered = CRAFTING_RECIPES.filter(recipe => {
        if (activeCraftCategory !== 'all' && recipe.category !== activeCraftCategory) return false;
        const hasMats = Object.entries(recipe.ingredients).every(
            ([ing, req]) => (combinedCounts[ing] || 0) >= req
        );
        if (craftReadyOnly && (!hasMats || recipe.gridSize > craftGridSize)) return false;
        return true;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="empty-state-box">Belum ada resep pada kategori ini yang siap dirakit pada mode ${craftGridSize}x${craftGridSize}.</div>`;
        return;
    }

    filtered.forEach(recipe => {
        const needsTable = recipe.gridSize > craftGridSize;
        const hasMats = Object.entries(recipe.ingredients).every(
            ([ing, req]) => (combinedCounts[ing] || 0) >= req
        );
        const canAutoFill = !needsTable && hasMats;

        const card = document.createElement('div');
        card.className = 'recipe-card' + (canAutoFill ? ' craftable' : '');

        const ingPills = Object.entries(recipe.ingredients).map(([ing, req]) => {
            const have = combinedCounts[ing] || 0;
            const ok = have >= req;
            return `
                <span class="ing-pill ${ok ? 'ok' : 'missing'}">
                    ${getItemVisualHTML(ing, 14)}
                    <span>${getItemName(ing)} ${have}/${req}</span>
                </span>
            `;
        }).join('');

        const btnLabel = needsTable
            ? 'Butuh Meja Crafting 3x3'
            : hasMats
                ? 'Susun ke Grid'
                : 'Bahan Belum Cukup';

        card.innerHTML = `
            <div class="recipe-top">
                <div class="recipe-icon-box">
                    ${getItemVisualHTML(recipe.result, 26)}
                    ${recipe.resultCount > 1 ? `<span class="recipe-qty">x${recipe.resultCount}</span>` : ''}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div class="recipe-title-row">
                        <h3 class="recipe-title">${recipe.resultName}</h3>
                        <span class="recipe-grid-tag ${needsTable ? 'locked' : ''}">${recipe.gridSize}x${recipe.gridSize}</span>
                    </div>
                    <p class="recipe-desc">${recipe.description}</p>
                </div>
            </div>
            <div class="recipe-ingredients">${ingPills}</div>
            <button type="button" class="primary-btn" ${canAutoFill ? '' : 'disabled'}>
                ${svgIcon('hammer', 15)}
                <span>${btnLabel}</span>
            </button>
        `;

        if (canAutoFill) {
            card.querySelector('button')?.addEventListener('click', () => {
                const res = populateGridForRecipe(player.inventory, craftGrid, craftGridSize, recipe);
                if (!res.ok) {
                    game.showNotification(res.reason);
                    return;
                }
                sounds.playClickSound();
                syncHeldVisual();
                updateInventoryUI();
                renderCraftingMenu();
            });
        }

        listEl.appendChild(card);
    });
}

function openCraftingMenu(forceTable = false) {
    lastWorkbenchTab = 'crafting';
    flushCraftingGridToInventory();
    const hasNearbyTable = forceTable || findNearbyStationBlock('crafting', 5) !== null;
    craftGridSize = hasNearbyTable ? 3 : 2;
    craftGrid = Array(craftGridSize * craftGridSize).fill(null);
    openGameplayModal('crafting-modal');
    renderCraftingMenu();
}

function getSlotRefItem(ref) {
    if (!ref) return null;
    return ref.source === 'armor' ? player.armor[ref.key] : player.inventory[ref.key];
}

function setSlotRefItem(ref, nextItem) {
    if (!ref) return;
    if (ref.source === 'armor') {
        player.armor[ref.key] = nextItem;
    } else {
        player.inventory[ref.key] = nextItem;
    }
}

function sameSlotRef(a, b) {
    return !!(a && b && a.source === b.source && a.key === b.key);
}

function resolveEnchantTableStation() {
    if (activeEnchantTablePos) {
        const block = world.getBlockAt(
            activeEnchantTablePos.x,
            activeEnchantTablePos.y,
            activeEnchantTablePos.z
        );
        if (block && normalizeBlockType(block) === 'enchanting_table') {
            return activeEnchantTablePos;
        }
    }
    activeEnchantTablePos = findNearbyStationBlock('enchanting_table', 5);
    return activeEnchantTablePos;
}

function collectTableCandidates() {
    const list = [];
    ['helmet', 'chestplate', 'leggings', 'boots'].forEach(slotName => {
        const item = player.armor[slotName];
        if (item && !hasAnyEnchant(item)) {
            list.push({ source: 'armor', key: slotName, item, whereLabel: 'Terpasang' });
        }
    });
    player.inventory.forEach((item, idx) => {
        if (!item) return;
        const isGear = getEquipmentCategory(item.type) !== null && !hasAnyEnchant(item);
        const isBlankBook = item.type === 'book';
        if (isGear || isBlankBook) {
            list.push({ source: 'bag', key: idx, item, whereLabel: `Slot Tas #${idx + 1}` });
        }
    });
    return list;
}

function collectAnvilTargets() {
    const list = [];
    ['helmet', 'chestplate', 'leggings', 'boots'].forEach(slotName => {
        const item = player.armor[slotName];
        if (item) {
            list.push({ source: 'armor', key: slotName, item, whereLabel: 'Terpasang' });
        }
    });
    player.inventory.forEach((item, idx) => {
        if (!item) return;
        if (getEquipmentCategory(item.type) !== null || item.type === 'enchanted_book') {
            list.push({ source: 'bag', key: idx, item, whereLabel: `Slot Tas #${idx + 1}` });
        }
    });
    return list;
}

function collectAnvilSacrifices(targetRef) {
    const targetItem = getSlotRefItem(targetRef);
    if (!targetItem) return [];
    const list = [];

    player.inventory.forEach((item, idx) => {
        if (!item) return;
        const ref = { source: 'bag', key: idx };
        if (sameSlotRef(ref, targetRef)) return;
        if (!hasAnyEnchant(item)) return;

        const compatible =
            item.type === 'enchanted_book' ||
            (getEquipmentCategory(targetItem.type) !== null && item.type === targetItem.type);
        if (compatible) {
            list.push({ ...ref, item, whereLabel: `Slot Tas #${idx + 1}` });
        }
    });
    return list;
}

function handleApplyTableOffer(offer) {
    const targetItem = getSlotRefItem(selectedTableCandidateRef);
    if (!targetItem || !offer) return;

    const counts = countInventoryMaterials(player.inventory);
    if (player.xpLevel < offer.reqLevel) {
        game.showNotification(`Butuh minimal Level XP ${offer.reqLevel}.`);
        return;
    }
    if ((counts.lapis || 0) < offer.lapisCost) {
        game.showNotification(`Butuh ${offer.lapisCost} Lapis Lazuli.`);
        return;
    }

    const enchantedResult = applyEnchantTableOffer(targetItem, offer);

    // Ensure bag space if splitting 1 Blank Book from a stack > 1
    if (targetItem.type === 'book' && targetItem.count > 1) {
        const probe = player.inventory.map(s => (s ? { ...s } : null));
        probe[selectedTableCandidateRef.key] = { ...targetItem, count: targetItem.count - 1 };
        deductRecipeFromSlots(probe, { ingredients: { lapis: offer.lapisCost } });
        if (insertItemIntoSlots(probe, enchantedResult) > 0) {
            game.showNotification('Tas penuh. Kosongkan 1 slot untuk Buku Enchant.');
            return;
        }
        deductRecipeFromSlots(player.inventory, { ingredients: { lapis: offer.lapisCost } });
        targetItem.count -= 1;
        insertItemIntoSlots(player.inventory, enchantedResult);
    } else {
        deductRecipeFromSlots(player.inventory, { ingredients: { lapis: offer.lapisCost } });
        setSlotRefItem(selectedTableCandidateRef, enchantedResult);
    }

    player.xpLevel = Math.max(0, player.xpLevel - offer.levelCost);
    player.enchantSeed = ((player.enchantSeed * 1664525 + 1013904223) >>> 1) || 1;

    const gainedLabels = formatEnchantList(enchantedResult).join(', ');
    sounds.playEnchantSound();
    flashScreen('rgba(147, 51, 234, 0.28)', 110, 240);
    game.showNotification(`${getItemName(enchantedResult.type)} mendapat mantra: ${gainedLabels}.`);

    syncHeldVisual();
    updateXpUI();
    updateArmorUI();
    updateInventoryUI();
    renderEnchantMenu();
}

function renderEnchantMenu() {
    const stationPos = resolveEnchantTableStation();
    const shelfCount = stationPos
        ? countEnchantingBookshelves(world.boundGetBlockAt, stationPos.x, stationPos.y, stationPos.z)
        : 0;
    const maxTableLevel = stationPos ? (5 + Math.round((Math.min(15, shelfCount) / 15) * 25)) : 0;

    const shelfBadge = document.getElementById('enchant-shelf-badge');
    if (shelfBadge) {
        shelfBadge.textContent = stationPos
            ? `${shelfCount} / 15 Rak Buku (Maks Lv. ${maxTableLevel})`
            : 'Meja Belum Dipasang';
    }

    const counts = countInventoryMaterials(player.inventory);
    const resBar = document.getElementById('enchant-resources-bar');
    if (resBar) {
        resBar.innerHTML = `
            <span class="mat-chip">
                ${svgIcon('zap', 15)}
                <span>Level XP:</span>
                <strong>Lv. ${player.xpLevel} (${player.xp}/${getXpForNextLevel(player.xpLevel)})</strong>
            </span>
            <span class="mat-chip">
                ${svgIcon('library', 15)}
                <span>Rak Buku Aktif:</span>
                <strong>${stationPos ? `${shelfCount}/15` : 'Belum ada Meja'}</strong>
            </span>
            <span class="mat-chip">
                ${getItemVisualHTML('lapis', 15)}
                <span>Lapis Lazuli:</span>
                <strong>${counts.lapis || 0}</strong>
            </span>
            <span class="mat-chip">
                ${getItemVisualHTML('book', 15)}
                <span>Buku Kosong:</span>
                <strong>${counts.book || 0}</strong>
            </span>
        `;
    }

    // 1. Left Column: Minecraft Enchanting Table (3-Slot Altar)
    const tableCandidates = collectTableCandidates();
    if (
        selectedTableCandidateRef &&
        !tableCandidates.some(c => sameSlotRef(c, selectedTableCandidateRef))
    ) {
        selectedTableCandidateRef = null;
    }
    if (!selectedTableCandidateRef && tableCandidates.length > 0) {
        selectedTableCandidateRef = { source: tableCandidates[0].source, key: tableCandidates[0].key };
    }

    const tableCandEl = document.getElementById('enchant-table-candidates');
    if (tableCandEl) {
        tableCandEl.innerHTML = '';
        if (tableCandidates.length === 0) {
            tableCandEl.innerHTML = `<div class="empty-state-box">Tidak ada perlengkapan polos atau Buku Kosong. Item yang sudah bermantra digabungkan di Paron kanan.</div>`;
        } else {
            tableCandidates.forEach(entry => {
                const isSel = sameSlotRef(selectedTableCandidateRef, entry);
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'select-item-row' + (isSel ? ' selected' : '');
                const qtyText = entry.item.count > 1 ? ` x${entry.item.count}` : '';
                row.innerHTML = `
                    <span class="select-item-left">
                        ${getItemVisualHTML(entry.item.type, 20)}
                        <span><strong>${getItemName(entry.item.type)}${qtyText}</strong></span>
                    </span>
                    <span class="select-item-sub">${entry.whereLabel}</span>
                `;
                row.addEventListener('click', () => {
                    selectedTableCandidateRef = { source: entry.source, key: entry.key };
                    renderEnchantMenu();
                });
                tableCandEl.appendChild(row);
            });
        }
    }

    const offersEl = document.getElementById('enchant-table-offers');
    if (offersEl) {
        offersEl.innerHTML = '';
        const chosenItem = getSlotRefItem(selectedTableCandidateRef);
        if (!stationPos) {
            offersEl.innerHTML = `<div class="empty-state-box">Pasang Meja Enchant di dunia (jarak maks 5 blok) atau klik kanan Meja Enchant untuk membuka 3 tawaran mantra.</div>`;
        } else if (!chosenItem) {
            offersEl.innerHTML = `<div class="empty-state-box">Pilih perlengkapan polos atau Buku Kosong di atas.</div>`;
        } else {
            const tableRes = getEnchantTableOffers(chosenItem, shelfCount, player.enchantSeed);
            if (!tableRes.eligible) {
                offersEl.innerHTML = `<div class="empty-state-box">${tableRes.reason}</div>`;
            } else {
                tableRes.offers.forEach(offer => {
                    const hasXp = player.xpLevel >= offer.reqLevel;
                    const hasLapis = (counts.lapis || 0) >= offer.lapisCost;
                    const canBuy = hasXp && hasLapis;
                    const clueText = `${offer.clue.label}${offer.hasBonusHint ? ' ... ?' : ''}`;

                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'enchant-offer-btn';
                    btn.disabled = !canBuy;
                    btn.innerHTML = `
                        <div class="offer-left">
                            <span class="offer-tier-badge">${ROMAN_NUMERALS[offer.tier]}</span>
                            <div>
                                <div class="offer-clue-text">${clueText}</div>
                                <div class="offer-sub-text">Biaya: ${offer.lapisCost} Lapis dan ${offer.levelCost} Level XP</div>
                            </div>
                        </div>
                        <div class="offer-cost-meta">
                            <span class="${hasXp ? 'offer-req-ok' : 'offer-req-low'}">Min. Lv. ${offer.reqLevel}</span>
                            <span>-${offer.lapisCost} Lapis</span>
                        </div>
                    `;
                    if (canBuy) {
                        btn.addEventListener('click', () => handleApplyTableOffer(offer));
                    }
                    offersEl.appendChild(btn);
                });
            }
        }
    }

    // 2. Right Column: Minecraft Anvil Combining
    const anvilTargets = collectAnvilTargets();
    if (anvilTargetRef && !anvilTargets.some(t => sameSlotRef(t, anvilTargetRef))) {
        anvilTargetRef = null;
    }
    if (!anvilTargetRef && anvilTargets.length > 0) {
        const preferred = anvilTargets.find(t => !sameSlotRef(t, anvilSacrificeRef)) || anvilTargets[0];
        anvilTargetRef = { source: preferred.source, key: preferred.key };
    }

    const anvilTargetEl = document.getElementById('anvil-target-list');
    if (anvilTargetEl) {
        anvilTargetEl.innerHTML = '';
        if (anvilTargets.length === 0) {
            anvilTargetEl.innerHTML = `<div class="empty-state-box">Belum ada perlengkapan atau Buku Enchant di Tas.</div>`;
        } else {
            anvilTargets.forEach(entry => {
                const isSel = sameSlotRef(anvilTargetRef, entry);
                const enchStr = formatEnchantList(entry.item).join(', ');
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'select-item-row' + (isSel ? ' selected' : '');
                row.innerHTML = `
                    <span class="select-item-left">
                        ${getItemVisualHTML(entry.item.type, 20)}
                        <span>
                            <strong>${getItemName(entry.item.type)}</strong>
                            ${enchStr ? `<span class="select-item-sub"> (${enchStr})</span>` : ''}
                        </span>
                    </span>
                    <span class="select-item-sub">${entry.whereLabel}</span>
                `;
                row.addEventListener('click', () => {
                    anvilTargetRef = { source: entry.source, key: entry.key };
                    if (sameSlotRef(anvilTargetRef, anvilSacrificeRef)) {
                        anvilSacrificeRef = null;
                    }
                    renderEnchantMenu();
                });
                anvilTargetEl.appendChild(row);
            });
        }
    }

    const sacrifices = collectAnvilSacrifices(anvilTargetRef);
    if (anvilSacrificeRef && !sacrifices.some(s => sameSlotRef(s, anvilSacrificeRef))) {
        anvilSacrificeRef = null;
    }
    if (!anvilSacrificeRef && sacrifices.length > 0) {
        anvilSacrificeRef = { source: sacrifices[0].source, key: sacrifices[0].key };
    }

    const anvilSacEl = document.getElementById('anvil-sacrifice-list');
    if (anvilSacEl) {
        anvilSacEl.innerHTML = '';
        if (!anvilTargetRef) {
            anvilSacEl.innerHTML = `<div class="empty-state-box">Pilih Item Utama terlebih dahulu.</div>`;
        } else if (sacrifices.length === 0) {
            anvilSacEl.innerHTML = `<div class="empty-state-box">Belum ada Buku Enchant atau perlengkapan sejenis bermantra di Tas.</div>`;
        } else {
            sacrifices.forEach(entry => {
                const isSel = sameSlotRef(anvilSacrificeRef, entry);
                const enchStr = formatEnchantList(entry.item).join(', ');
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'select-item-row' + (isSel ? ' selected' : '');
                row.innerHTML = `
                    <span class="select-item-left">
                        ${getItemVisualHTML(entry.item.type, 20)}
                        <span>
                            <strong>${getItemName(entry.item.type)}</strong>
                            ${enchStr ? `<span class="select-item-sub"> (${enchStr})</span>` : ''}
                        </span>
                    </span>
                    <span class="select-item-sub">${entry.whereLabel}</span>
                `;
                row.addEventListener('click', () => {
                    anvilSacrificeRef = { source: entry.source, key: entry.key };
                    renderEnchantMenu();
                });
                anvilSacEl.appendChild(row);
            });
        }
    }

    const previewBox = document.getElementById('anvil-preview-box');
    const applyBtn = document.getElementById('apply-anvil-btn');
    const applyText = document.getElementById('apply-anvil-btn-text');

    const tItem = getSlotRefItem(anvilTargetRef);
    const sItem = getSlotRefItem(anvilSacrificeRef);

    if (previewBox && applyBtn && applyText) {
        if (!tItem || !sItem) {
            previewBox.className = 'anvil-preview-box';
            previewBox.textContent = 'Pilih item utama dan item penggabung untuk melihat hasil tempaan serta biaya Level XP.';
            applyBtn.disabled = true;
            applyText.textContent = 'Pilih Dua Item di Paron';
        } else {
            const res = combineAnvilItems(tItem, sItem);
            if (!res.ok) {
                previewBox.className = 'anvil-preview-box error';
                previewBox.textContent = res.reason;
                applyBtn.disabled = true;
                applyText.textContent = 'Tidak Dapat Digabung';
            } else {
                const resultEnch = formatEnchantList(res.resultItem).join(', ');
                const enoughXp = player.xpLevel >= res.xpCost;
                previewBox.className = enoughXp ? 'anvil-preview-box ready' : 'anvil-preview-box error';
                previewBox.textContent = `Hasil: ${getItemName(res.resultItem.type)} (${resultEnch}) · Biaya Paron: ${res.xpCost} Level XP${res.conflictWarning ? ` · Catatan: ${res.conflictWarning}` : ''}`;
                applyBtn.disabled = !enoughXp;
                applyText.textContent = enoughXp
                    ? `Tempa di Paron (-${res.xpCost} Level XP)`
                    : `Butuh Level XP ${res.xpCost} (Saat ini Lv. ${player.xpLevel})`;
            }
        }
    }
}

function openEnchantMenu(tablePos = null) {
    lastWorkbenchTab = 'enchant';
    if (tablePos && typeof tablePos.x === 'number') {
        activeEnchantTablePos = tablePos;
    }
    openGameplayModal('enchant-modal');
    renderEnchantMenu();
}

document.getElementById('switch-to-enchant-btn')?.addEventListener('click', () => openEnchantMenu());
document.getElementById('switch-to-craft-btn')?.addEventListener('click', () => openCraftingMenu(false));
document.getElementById('close-crafting-btn')?.addEventListener('click', () => closeAllGameplayModals(true));
document.getElementById('close-enchant-btn')?.addEventListener('click', () => closeAllGameplayModals(true));

document.getElementById('clear-craft-grid-btn')?.addEventListener('click', () => {
    flushCraftingGridToInventory();
    sounds.playClickSound();
    renderCraftingMenu();
});
document.getElementById('craft-output-slot')?.addEventListener('click', () => executeGridCraft(false));
document.getElementById('craft-once-btn')?.addEventListener('click', () => executeGridCraft(false));
document.getElementById('craft-max-btn')?.addEventListener('click', () => executeGridCraft(true));

document.querySelectorAll('#crafting-category-tabs .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('#crafting-category-tabs .filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeCraftCategory = tab.getAttribute('data-craft-cat') || 'all';
        renderCraftingMenu();
    });
});
document.getElementById('craft-ready-only')?.addEventListener('change', (e) => {
    craftReadyOnly = !!e.target.checked;
    renderCraftingMenu();
});

document.getElementById('apply-anvil-btn')?.addEventListener('click', () => {
    const tItem = getSlotRefItem(anvilTargetRef);
    const sItem = getSlotRefItem(anvilSacrificeRef);
    if (!tItem || !sItem) return;

    const res = combineAnvilItems(tItem, sItem);
    if (!res.ok) {
        game.showNotification(res.reason);
        return;
    }
    if (player.xpLevel < res.xpCost) {
        game.showNotification(`Butuh ${res.xpCost} Level XP.`);
        return;
    }

    player.xpLevel = Math.max(0, player.xpLevel - res.xpCost);
    setSlotRefItem(anvilTargetRef, res.resultItem);

    if (sItem.count > 1) {
        sItem.count -= 1;
    } else {
        setSlotRefItem(anvilSacrificeRef, null);
        if (anvilSacrificeRef.source === 'bag' && equippedBagSlot === anvilSacrificeRef.key) {
            equippedBagSlot = anvilTargetRef.source === 'bag' ? anvilTargetRef.key : null;
        }
        anvilSacrificeRef = null;
    }

    sounds.playEnchantSound();
    flashScreen('rgba(168, 85, 247, 0.3)', 120, 260);
    game.showNotification(
        `${getItemName(res.resultItem.type)} ditempa: ${formatEnchantList(res.resultItem).join(', ')}.`
    );

    syncHeldVisual();
    updateXpUI();
    updateArmorUI();
    updateInventoryUI();
    renderEnchantMenu();
});

// ==========================================
// REDSTONE & INTERACTIVE BLOCKS
// ==========================================

function toggleLever(x, y, z) {
    const isOn = world.getBlockAt(x, y, z) === 'lever_on';
    world.addBlock(x, y, z, isOn ? 'lever' : 'lever_on');
    sounds.playClickSound();
    game.showNotification(`Tuas saklar: ${!isOn ? 'Aktif' : 'Mati'}`);
    triggerRedstoneSignal(x, y, z, !isOn);
}

function pressButton(x, y, z) {
    if (world.getBlockAt(x, y, z) === 'button_pressed') return;
    world.addBlock(x, y, z, 'button_pressed');
    sounds.playClickSound();
    game.showNotification('Tombol batu ditekan.');
    triggerRedstoneSignal(x, y, z, true);

    setTimeout(() => {
        if (world.getBlockAt(x, y, z) === 'button_pressed') {
            world.addBlock(x, y, z, 'button');
            sounds.playClickSound();
            triggerRedstoneSignal(x, y, z, false);
        }
    }, 1000);
}

function activateDispenser(x, y, z) {
    sounds.playClickSound();
    world.spawnBlockBreakParticles(x, y, z, 'dispenser');

    const dist = player.position.distanceTo(new THREE.Vector3(x, y, z));
    if (dist < 4.0) {
        let equippedAny = false;
        const armorPieces = {
            helmet: 'helmet_diamond',
            chestplate: 'chestplate_diamond',
            leggings: 'leggings_diamond',
            boots: 'boots_diamond'
        };
        for (const [slot, type] of Object.entries(armorPieces)) {
            if (!player.armor[slot]) {
                player.armor[slot] = { type, count: 1 };
                equippedAny = true;
            } else {
                addItemToInventory(type, 1);
            }
        }
        updateArmorUI();
        updateInventoryUI();
        game.showNotification(
            equippedAny
                ? 'Dispenser memasangkan Zirah Berlian ke tubuhmu.'
                : 'Dispenser meluncurkan Zirah Berlian ke dalam Tas.'
        );
    } else {
        game.showNotification('Dispenser berbunyi klik (mendekatlah dalam jarak 4 blok).');
    }
}

function triggerRedstoneSignal(x, y, z, active) {
    const neighbors = [
        { x: x + 1, y, z },
        { x: x - 1, y, z },
        { x, y: y + 1, z },
        { x, y: y - 1, z },
        { x, y, z: z + 1 },
        { x, y, z: z - 1 }
    ];

    neighbors.forEach(n => {
        const block = world.getBlockAt(n.x, n.y, n.z);
        if (!block) return;
        const base = normalizeBlockType(block);

        if (base === 'piston') {
            if (active) {
                world.addBlock(n.x, n.y, n.z, 'piston_extended');
                const dx = n.x - x;
                const dy = n.y - y;
                const dz = n.z - z;
                const pushX = n.x + dx;
                const pushY = n.y + dy;
                const pushZ = n.z + dz;
                const pushBlock = world.getBlockAt(pushX, pushY, pushZ);
                if (pushBlock && pushBlock !== 'obsidian' && !pushBlock.startsWith('water') && !pushBlock.startsWith('lava')) {
                    const destX = pushX + dx;
                    const destY = pushY + dy;
                    const destZ = pushZ + dz;
                    if (!world.getBlockAt(destX, destY, destZ)) {
                        world.removeBlock(pushX, pushY, pushZ, true);
                        world.addBlock(destX, destY, destZ, pushBlock);
                        world.spawnBlockBreakParticles(pushX, pushY, pushZ, pushBlock);
                        game.showNotification('Piston mendorong blok.');
                    }
                }
            } else {
                world.addBlock(n.x, n.y, n.z, 'piston');
            }
        } else if (base === 'dispenser' && active) {
            activateDispenser(n.x, n.y, n.z);
        }
    });
}

let activePressurePlates = {};

function checkPressurePlates() {
    const px = Math.round(player.position.x);
    const py = Math.floor(player.position.y + 0.55);
    const pz = Math.round(player.position.z);

    const block = world.getBlockAt(px, py, pz);
    if (block === 'pressure_plate' || block === 'pressure_plate_on') {
        const key = `${px},${py},${pz}`;
        if (!activePressurePlates[key]) {
            world.addBlock(px, py, pz, 'pressure_plate_on');
            sounds.playClickSound();
            triggerRedstoneSignal(px, py, pz, true);
            activePressurePlates[key] = true;
        }
    } else {
        for (const key in activePressurePlates) {
            const [x, y, z] = key.split(',').map(Number);
            if (world.getBlockAt(x, y, z) === 'pressure_plate_on') {
                world.addBlock(x, y, z, 'pressure_plate');
                sounds.playClickSound();
                triggerRedstoneSignal(x, y, z, false);
            }
            delete activePressurePlates[key];
        }
    }
}

// ==========================================
// HUD BARS & ANIMATION LOOP
// ==========================================

const armorBarContainer = document.getElementById('armor-bar-container');
const armorFill = document.getElementById('armor-fill');
const armorText = document.getElementById('armor-text');

function updateArmorUI() {
    if (!armorBarContainer || !armorFill || !armorText) return;
    const percentage = Math.round(player.getArmorReduction() * 100);
    if (percentage > 0) {
        armorBarContainer.style.display = 'inline-flex';
        armorFill.style.width = `${percentage}%`;
        armorText.textContent = `${percentage}% DEF`;
    } else {
        armorBarContainer.style.display = 'none';
    }
}

const healthFill = document.getElementById('health-fill');
const healthText = document.getElementById('health-text');

function updateHealthUI() {
    if (!healthFill || !healthText) return;
    const percentage = Math.max(0, Math.min(100, player.health));
    healthFill.style.width = `${percentage}%`;
    healthText.textContent = `${Math.round(player.health)} HP`;

    if (percentage < 30) healthFill.style.background = '#f43f5e';
    else if (percentage < 60) healthFill.style.background = '#f59e0b';
    else healthFill.style.background = '#10b981';
}

const xpFill = document.getElementById('xp-fill');
const xpText = document.getElementById('xp-text');

function updateXpUI() {
    if (!xpFill || !xpText) return;
    const needed = getXpForNextLevel(player.xpLevel);
    const pct = Math.max(0, Math.min(100, Math.round((player.xp / needed) * 100)));
    xpFill.style.width = `${pct}%`;
    xpText.textContent = `Lv. ${player.xpLevel}`;
}

updateArmorUI();
updateHealthUI();
updateXpUI();

const clock = new THREE.Clock(false);

function animate() {
    if (!hasGameStarted) return;
    requestAnimationFrame(animate);

    if (!document.body.classList.contains('in-game') || isGameplayModalOpen()) {
        clock.getDelta();
        gameRenderer.render();
        return;
    }

    const dt = Math.min(clock.getDelta(), 0.1);

    player.update(dt);
    updateHealthUI();

    for (let i = game.mobs.length - 1; i >= 0; i--) {
        game.mobs[i].update(dt);
    }

    for (let i = game.tnts.length - 1; i >= 0; i--) {
        if (!game.tnts[i].update(dt)) {
            game.tnts.splice(i, 1);
        }
    }

    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.elapsed += dt;
        if (p.elapsed >= p.life) {
            scene.remove(p.mesh);
            if (!p.sharedGeo && p.mesh.geometry) {
                p.mesh.geometry.dispose();
            }
            p.material.dispose();
            game.particles.splice(i, 1);
        } else {
            p.velocity.y -= 9.8 * dt;
            p.mesh.position.addScaledVector(p.velocity, dt);
            p.material.opacity = 1.0 - (p.elapsed / p.life);
            p.material.transparent = true;
        }
    }

    for (let i = game.arrows.length - 1; i >= 0; i--) {
        if (!game.arrows[i].update(dt)) {
            game.arrows.splice(i, 1);
        }
    }

    updateTargeting();

    world.liquidTimer += dt;
    if (world.liquidTimer >= 0.2) {
        world.tickLiquids();
        world.liquidTimer = 0;
    }

    checkPressurePlates();
    gameRenderer.render();
}

// Render one static backdrop frame while waiting for the Start button
gameRenderer.render();
