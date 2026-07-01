// NizamCraft - Main Entry Point for Modular Game
import * as THREE from 'three';
import { GameRenderer } from './render/renderer.js?v=3';
import { World } from './world/world.js?v=3';
import { Player } from './player/player.js?v=3';
import { Zombie, Creeper, Skeleton, Arrow, IronGolem, SnowGolem, Chicken, Pig, Cow, BloodGolem, GiantIronGolem, WitherSkeleton } from './entities/mob.js?v=3';
import { PrimedTNT } from './entities/tnt.js?v=3';

// Initialize Game State Object (shared with entity classes)
const game = {
    player: null,
    mobs: [],
    tnts: [],
    particles: [],
    arrows: [],
    chests: {},
    showNotification: function(message) {
        if (this.player) {
            this.player.showNotification(message);
        } else {
            const toast = document.getElementById('toast-msg');
            if (toast) {
                toast.textContent = message;
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
            }
        }
    }
};

// 1. Initialize Renderer
const gameRenderer = new GameRenderer();
const scene = gameRenderer.scene;
const camera = gameRenderer.camera;
const renderer = gameRenderer.renderer;

// 2. Initialize World
const world = new World(scene);
world.game = game;

// 3. Initialize Player (passing camera, renderer's canvas, and world)
const player = new Player(camera, renderer.domElement, world);
game.player = player;
player.initHand(scene);

// 4. Setup Pointer Lock and Play Button handling
const playOverlay = document.getElementById('play-overlay');
const playButton = document.getElementById('play-button');

// Safe Fullscreen helpers
function safeRequestFullscreen(element) {
    if (!element) return Promise.reject('No element provided');
    const requestMethod = element.requestFullscreen || 
                          element.webkitRequestFullscreen || 
                          element.mozRequestFullScreen || 
                          element.msRequestFullscreen;
    if (requestMethod) {
        return requestMethod.call(element);
    }
    return Promise.reject('Fullscreen API is not supported on this device/browser');
}

function safeExitFullscreen() {
    const exitMethod = document.exitFullscreen || 
                       document.webkitExitFullscreen || 
                       document.mozCancelFullScreen || 
                       document.msExitFullscreen;
    if (exitMethod) {
        return exitMethod.call(document);
    }
    return Promise.reject('Fullscreen API is not supported on this device/browser');
}

function isFullscreen() {
    return !!(document.fullscreenElement || 
              document.webkitFullscreenElement || 
              document.mozFullScreenElement || 
              document.msFullscreenElement);
}

function enterGame() {
    // 1. Hide overlay
    if (playOverlay) {
        playOverlay.style.opacity = '0';
        setTimeout(() => {
            playOverlay.style.display = 'none';
        }, 300);
    }

    // Show hotbar container
    const hotbar = document.getElementById('hotbar-container');
    if (hotbar) hotbar.style.display = 'flex';

    // 2. Desktop: lock pointer
    if (!player.isTouch) {
        player.controls.lock();
    } else {
        // Mobile: request fullscreen & lock landscape orientation safely
        if (!isFullscreen()) {
            safeRequestFullscreen(document.documentElement).then(() => {
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(err => {
                        console.log('Orientation lock rejected/unsupported:', err);
                    });
                }
            }).catch(err => {
                console.warn('Fullscreen request rejected or unsupported:', err);
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                if (isIOS && isSafari) {
                    game.showNotification("Tips: Ketuk menu Safari (aA) lalu pilih 'Sembunyikan Toolbar' untuk layar penuh.");
                }
            });
        }
    }
}

function exitGame() {
    // 1. Unlock pointer lock for desktop
    if (!player.isTouch && player.controls.isLocked) {
        player.controls.unlock();
    }
    
    // 2. Exit fullscreen if in fullscreen
    if (isFullscreen()) {
        safeExitFullscreen().catch(err => console.log('Exit fullscreen rejected/unsupported:', err));
    }

    // 3. Show overlay
    if (playOverlay) {
        playOverlay.style.display = 'flex';
        playOverlay.offsetHeight; // Force reflow
        playOverlay.style.opacity = '1';
    }

    // Hide hotbar container
    const hotbar = document.getElementById('hotbar-container');
    if (hotbar) hotbar.style.display = 'none';
}

if (playButton && playOverlay) {
    playButton.addEventListener('click', enterGame);

    // Desktop pointer lock event listeners
    player.controls.addEventListener('lock', () => {
        if (playOverlay) {
            playOverlay.style.opacity = '0';
            setTimeout(() => {
                if (player.controls.isLocked) {
                    playOverlay.style.display = 'none';
                }
            }, 300);
        }
        // Show hotbar container
        const hotbar = document.getElementById('hotbar-container');
        if (hotbar) hotbar.style.display = 'flex';
    });

    player.controls.addEventListener('unlock', () => {
        exitGame();
    });
}

// 5. Connect UI Save / Load / Reset / Actions (Both HUD and Start Screen Overlay)
function handleSave() {
    const worldSaved = world.save();
    if (worldSaved) {
        // Save player state
        const playerState = {
            position: { x: player.position.x, y: player.position.y, z: player.position.z },
            health: player.health,
            inventory: player.inventory,
            armor: player.armor
        };
        localStorage.setItem('nizamcraft-player', JSON.stringify(playerState));
        localStorage.setItem('nizamcraft-chests', JSON.stringify(game.chests));
        game.showNotification('Dunia berhasil disimpan! 💾');
    } else {
        game.showNotification('Gagal menyimpan dunia! ❌');
    }
}

function handleLoad() {
    const worldLoaded = world.load();
    if (worldLoaded) {
        // Restore player state
        const playerSaved = localStorage.getItem('nizamcraft-player');
        if (playerSaved) {
            const data = JSON.parse(playerSaved);
            if (data.position) {
                player.position.set(data.position.x, data.position.y, data.position.z);
            }
            player.health = data.health !== undefined ? data.health : 100;
            player.velocity.set(0, 0, 0);
            player.isGrounded = false;
            
            if (data.inventory) player.inventory = data.inventory;
            if (data.armor) player.armor = data.armor;
        } else {
            player.respawn();
        }
        
        // Restore chest inventories
        const chestsSaved = localStorage.getItem('nizamcraft-chests');
        game.chests = chestsSaved ? JSON.parse(chestsSaved) : {};
        
        updateInventoryUI();
        game.showNotification('Dunia berhasil dimuat! 📂');
    } else {
        game.showNotification('Tidak ada data tersimpan! ❌');
    }
}

function handleReset() {
    if (confirm('Apakah Anda yakin ingin mengatur ulang dunia ini?')) {
        world.reset();
        player.respawn();
        // Clear active mobs and TNTs
        game.mobs.forEach(mob => scene.remove(mob.mesh));
        game.mobs = [];
        game.tnts.forEach(tnt => scene.remove(tnt.mesh));
        game.tnts = [];
        game.showNotification('Dunia telah diatur ulang! 🔄');

        // Re-request fullscreen if active previously or if on mobile
        if (player.isTouch || isFullscreen()) {
            setTimeout(() => {
                safeRequestFullscreen(document.documentElement).then(() => {
                    if (screen.orientation && screen.orientation.lock) {
                        screen.orientation.lock('landscape').catch(err => {
                            console.log('Orientation lock failed after reset:', err);
                        });
                    }
                }).catch(err => {
                    console.log('Fullscreen failed after reset:', err);
                });
            }, 300);
        }
    }
}

function handleFullscreen() {
    if (!isFullscreen()) {
        safeRequestFullscreen(document.documentElement).catch(err => {
            console.error('Error enabling fullscreen:', err);
        });
    } else {
        safeExitFullscreen().catch(err => {
            console.error('Error exiting fullscreen:', err);
        });
    }
}

// Attach listeners to HUD buttons
document.getElementById('save-btn')?.addEventListener('click', handleSave);
document.getElementById('load-btn')?.addEventListener('click', handleLoad);
document.getElementById('reset-btn')?.addEventListener('click', handleReset);
document.getElementById('respawn-btn')?.addEventListener('click', () => {
    player.respawn();
    game.showNotification('Player respawned! 📍');
});
document.getElementById('fullscreen-btn')?.addEventListener('click', handleFullscreen);
document.getElementById('exit-btn')?.addEventListener('click', exitGame);

// Attach listeners to Overlay buttons
document.getElementById('overlay-save-btn')?.addEventListener('click', handleSave);
document.getElementById('overlay-load-btn')?.addEventListener('click', handleLoad);
document.getElementById('overlay-fullscreen-btn')?.addEventListener('click', handleFullscreen);
document.getElementById('overlay-reset-btn')?.addEventListener('click', handleReset);

// Auto-save on page unload
window.addEventListener('beforeunload', () => {
    world.save();
    const playerState = {
        position: { x: player.position.x, y: player.position.y, z: player.position.z },
        health: player.health
    };
    localStorage.setItem('nizamcraft-player', JSON.stringify(playerState));
});


// 6. Hotbar Block Selection & Keyboard Mapping
const hotbarSlots = document.querySelectorAll('.hotbar-slot');
let selectedBlockType = 'grass';

function selectHotbarSlot(index) {
    if (index < 0 || index >= hotbarSlots.length) return;
    
    hotbarSlots.forEach(slot => slot.classList.remove('active'));
    const activeSlot = hotbarSlots[index];
    activeSlot.classList.add('active');
    
    const blockList = ['grass', 'dirt', 'stone', 'obsidian', 'wood', 'leaf', 'brick', 'emerald', 'diamond', 'ender', 'tnt', 'water', 'lava', 'quartz', 'sand', 'farmland', 'lucky', 'magma', 'crop', 'spawn_irongolem', 'spawn_snowgolem', 'coal_ore', 'iron_ore', 'gold_ore', 'chest'];
    selectedBlockType = blockList[index];
    if (player && typeof player.updateHeldItem === 'function') {
        player.updateHeldItem(selectedBlockType);
    }
}

// Disable default context menu (critical for trackpad/MacBook right-clicks and mobile long presses)
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
}, { capture: true });

// Prevent MacBook trackpad pinch zoom gestures from zooming the page
window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}, { passive: false });

// Click listener for hotbar slots
hotbarSlots.forEach(slot => {
    slot.addEventListener('click', () => {
        const index = parseInt(slot.getAttribute('data-index') || 0);
        selectHotbarSlot(index);
    });
});

// Keyboard controls for hotbar and shortcuts
window.addEventListener('keydown', (e) => {
    if (e.key === 'e' || e.key === 'E' || e.key === 'i' || e.key === 'I') {
        const overlay = document.getElementById('play-overlay');
        if (!overlay || overlay.style.display === 'none') {
            toggleInventory();
            e.preventDefault();
            return;
        }
    }

    if (player.controls.isLocked) {
        const keyMap = {
            '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9,
            '-': 10, '=': 11, 'l': 12, 'L': 12, 'q': 13, 'Q': 13,
            'y': 14, 'Y': 14, 'u': 15, 'U': 15, 'i': 16, 'I': 16,
            'o': 17, 'O': 17, 'p': 18, 'P': 18, 'g': 19, 'G': 19, 'h': 20, 'H': 20
        };
        if (keyMap[e.key] !== undefined) {
            selectHotbarSlot(keyMap[e.key]);
        }

        // Shoot Arrow with F key on desktop
        if (e.key === 'f' || e.key === 'F') {
            shootPlayerArrow();
            if (player && typeof player.swing === 'function') {
                player.swing();
            }
        }

        // Reset World with Backspace key
        if (e.key === 'Backspace') {
            handleReset();
        }
    }
});

// Mouse scroll wheel to cycle through hotbar slots
window.addEventListener('wheel', (e) => {
    if (player.controls.isLocked) {
        let currentIndex = 0;
        for (let i = 0; i < hotbarSlots.length; i++) {
            if (hotbarSlots[i].classList.contains('active')) {
                currentIndex = i;
                break;
            }
        }
        
        if (e.deltaY > 0) {
            currentIndex = (currentIndex + 1) % hotbarSlots.length;
        } else {
            currentIndex = (currentIndex - 1 + hotbarSlots.length) % hotbarSlots.length;
        }
        
        selectHotbarSlot(currentIndex);
    }
}, { passive: true });


// Golem Spawning & Seed Planting Helpers
let activePlantTarget = null;
const plantButtonContainer = document.getElementById('plant-button-container');
const plantBtn = document.getElementById('plant-btn');

function spawnGolemParticles(x, y, z, color) {
    const count = 16;
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const particlesList = [];
    
    for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
            x + (Math.random() - 0.5) * 0.8,
            y + (Math.random() - 0.5) * 1.2,
            z + (Math.random() - 0.5) * 0.8
        );
        
        const speed = 2.0 + Math.random() * 2.5;
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2.0,
            (Math.random() * 2.0 + 1.0),
            (Math.random() - 0.5) * 2.0
        ).normalize().multiplyScalar(speed);
        
        scene.add(mesh);
        particlesList.push({
            mesh: mesh,
            velocity: velocity,
            life: 0.4 + Math.random() * 0.4,
            elapsed: 0,
            material: mat
        });
    }
    game.particles.push(...particlesList);
}

function handleGolemSpawn(type, x, y, z) {
    if (type === 'spawn_irongolem') {
        const golem = new IronGolem(x, y + 0.5, z, scene, world, game);
        game.mobs.push(golem);
        sounds.playPlaceSound();
        spawnGolemParticles(x, y + 0.5, z, 0xcccccc);
        game.showNotification('Iron Golem Berhasil Dispawn! 🦾🛡️');
        return true;
    } else if (type === 'spawn_snowgolem') {
        const golem = new SnowGolem(x, y + 0.5, z, scene, world, game);
        game.mobs.push(golem);
        sounds.playPlaceSound();
        spawnGolemParticles(x, y + 0.5, z, 0xffffff);
        game.showNotification('Snow Golem Berhasil Dispawn! ⛄❄️');
        return true;
    }
    return false;
}

function updatePlantButtonVisibility(targetPos) {
    if (!plantButtonContainer) return;
    if (targetPos) {
        activePlantTarget = targetPos;
        plantButtonContainer.classList.add('show');
    } else {
        activePlantTarget = null;
        plantButtonContainer.classList.remove('show');
    }
}

function plantSeed() {
    if (!activePlantTarget) return;
    const { x, y, z } = activePlantTarget;
    // Add crop block on top of the farmland block
    world.addBlock(x, y + 1, z, 'crop');
    game.showNotification('Benih ditanam! 🌱');
}

if (plantBtn) {
    plantBtn.addEventListener('click', (e) => {
        e.preventDefault();
        plantSeed();
    });
    plantBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        plantSeed();
    });
}



// 7. Raycasting for Dig & Build (Block Interaction) and Combat (Mob Attack)
const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

import { sounds } from './utils/audio.js?v=3';

function updateTargeting() {
    // Only update highlight when playing (controls locked or touch active)
    if (!player.controls.isLocked && !player.isTouch) {
        world.highlightBox.visible = false;
        updatePlantButtonVisibility(null);
        return null;
    }

    raycaster.setFromCamera(screenCenter, camera);
    
    // 1. Raycast against Mobs
    const mobMeshes = game.mobs.map(mob => mob.mesh);
    const mobIntersects = raycaster.intersectObjects(mobMeshes, true);
    
    // 2. Raycast against Blocks
    const blockMeshes = world.getInstancedMeshes();
    const blockIntersects = raycaster.intersectObjects(blockMeshes);

    const closestMob = mobIntersects.length > 0 ? mobIntersects[0] : null;
    const closestBlock = blockIntersects.length > 0 ? blockIntersects[0] : null;

    // Check if a mob is targeted and is closer than any block
    if (closestMob && closestMob.distance < 5.0) {
        if (!closestBlock || closestMob.distance < closestBlock.distance) {
            // Find which Mob object owns this intersected mesh
            let targetedMob = null;
            for (const mob of game.mobs) {
                let obj = closestMob.object;
                let isChild = false;
                while (obj) {
                    if (obj === mob.mesh) {
                        isChild = true;
                        break;
                    }
                    obj = obj.parent;
                }
                if (isChild) {
                    targetedMob = mob;
                    break;
                }
            }
            if (targetedMob) {
                world.highlightBox.visible = false; // Hide block outline when aiming at mob
                updatePlantButtonVisibility(null);
                return { type: 'mob', mob: targetedMob, intersect: closestMob };
            }
        }
    }

    // Otherwise raycast blocks
    if (closestBlock && closestBlock.distance < 6.0) {
        const intersect = closestBlock;
        const targetPos = world.updateHighlight(intersect);
        
        // Contextual Farmland check
        if (targetPos) {
            const targetedBlockType = world.getBlockAt(targetPos.x, targetPos.y, targetPos.z);
            if (targetedBlockType === 'farmland') {
                const blockAbove = world.getBlockAt(targetPos.x, targetPos.y + 1, targetPos.z);
                if (!blockAbove) {
                    updatePlantButtonVisibility(targetPos);
                    return { type: 'block', intersect, targetPos };
                }
            }
        }
        
        updatePlantButtonVisibility(null);
        return { type: 'block', intersect, targetPos };
    } else {
        world.highlightBox.visible = false;
        updatePlantButtonVisibility(null);
        return null;
    }
}

function performAttack(mob) {
    if (!mob) return;
    
    // Mob takes damage
    mob.takeDamage(25);
    
    // Apply knockback force
    const pushDir = mob.position.clone().sub(player.position).setY(0.25).normalize();
    mob.velocity.addScaledVector(pushDir, 6.0);
    
    game.showNotification(`Kamu menyerang ${mob.type.toUpperCase()}! ⚔️`);
}

function shootPlayerArrow() {
    // Spawn position: slightly in front of camera
    const startPos = camera.position.clone();
    
    // Get direction player is looking
    const targetDir = new THREE.Vector3();
    camera.getWorldDirection(targetDir);
    
    startPos.addScaledVector(targetDir, 0.5);
    
    const targetPos = startPos.clone().addScaledVector(targetDir, 10.0);
    
    // Spawn arrow (firedBy = 'player')
    const arrow = new Arrow(startPos, targetPos, scene, world, game, 'player');
    
    arrow.velocity.copy(targetDir).multiplyScalar(22.0); // travel speed 22 blocks/sec
    
    if (!game.arrows) game.arrows = [];
    game.arrows.push(arrow);
    
    if (sounds && typeof sounds.playBowSound === 'function') {
        sounds.playBowSound();
    } else {
        sounds.playClickSound();
    }
}

function handleBlockDig(targetPos) {
    const tx = targetPos.x;
    const ty = targetPos.y;
    const tz = targetPos.z;
    const blockType = world.getBlockAt(tx, ty, tz);
    if (!blockType) return;

    if (blockType === 'tnt') {
        // Ignite TNT on dig
        world.removeBlock(tx, ty, tz, true);
        const primedTnt = new PrimedTNT(tx, ty, tz, scene, world, game);
        game.tnts.push(primedTnt);
        return;
    }

    let blockDestroyed = false;

    if (blockType === 'obsidian') {
        const coordKey = `${tx},${ty},${tz}`;
        if (!game.blockHits) game.blockHits = {};
        game.blockHits[coordKey] = (game.blockHits[coordKey] || 0) + 1;
        
        // Spawn block break particles & sound
        world.spawnBlockBreakParticles(tx, ty, tz, 'obsidian');
        sounds.playDigSound();
        
        const hits = game.blockHits[coordKey];
        if (hits >= 8) {
            world.removeBlock(tx, ty, tz);
            delete game.blockHits[coordKey];
            blockDestroyed = true;
        } else {
            game.showNotification(`Menambang Obsidian... (${hits}/8)`);
        }
    } else if (blockType === 'lucky') {
        world.removeBlock(tx, ty, tz);
        triggerLuckyEvent(tx, ty, tz);
        blockDestroyed = true;
    } else {
        // Normal block dig
        world.removeBlock(tx, ty, tz);
        blockDestroyed = true;
    }

    if (blockDestroyed) {
        if (blockType === 'chest') {
            const key = `${tx},${ty},${tz}`;
            const chestInv = game.chests[key];
            if (chestInv) {
                let transferredAny = false;
                chestInv.forEach(item => {
                    if (item) {
                        addItemToInventory(item.type, item.count);
                        transferredAny = true;
                    }
                });
                if (transferredAny) {
                    game.showNotification("Peti hancur! Isi peti dipindahkan ke tas.");
                }
                delete game.chests[key];
            }
        }
        
        let itemToGive = blockType;
        if (blockType.startsWith('water')) itemToGive = 'water';
        else if (blockType.startsWith('lava')) itemToGive = 'lava';
        else if (blockType === 'grass') itemToGive = 'dirt';
        
        if (blockType === 'leaf') {
            const r = Math.random();
            if (r < 0.15) {
                itemToGive = 'golden_apple';
                game.showNotification("Mendapatkan Apel Emas dari dedaunan! 🍎✨");
            } else if (r < 0.3) {
                itemToGive = 'crop';
            }
        }

        if (blockType === 'coal_ore') itemToGive = 'coal';

        if (itemToGive !== 'lucky' && !itemToGive.includes('spawner')) {
            addItemToInventory(itemToGive, 1);
        }
    }
}

// Interactive Randomized Lucky Block Break Events!
function triggerLuckyEvent(x, y, z) {
    const events = ['wealth', 'heal', 'golem', 'tnt', 'mobs'];
    const choice = events[Math.floor(Math.random() * events.length)];
    
    // Play sound on break
    sounds.playClickSound();
    
    if (choice === 'wealth') {
        // Fountain of Wealth: spawn random Diamond, Emerald, and Quartz blocks nearby!
        game.showNotification('Lucky Block: Hujan Block Berharga! 💎✨');
        for (let i = 0; i < 4; i++) {
            const dx = Math.floor((Math.random() - 0.5) * 4);
            const dz = Math.floor((Math.random() - 0.5) * 4);
            const dy = 2 + Math.floor(Math.random() * 3);
            const bx = x + dx;
            const by = y + dy;
            const bz = z + dz;
            const bTypes = ['diamond', 'emerald', 'quartz'];
            const randomType = bTypes[Math.floor(Math.random() * bTypes.length)];
            world.addBlock(bx, by, bz, randomType);
        }
    } 
    else if (choice === 'heal') {
        // Recover full health
        player.health = 100;
        updateHealthUI();
        game.showNotification('Lucky Block: Kesembuhan Penuh! ❤️💖');
    } 
    else if (choice === 'golem') {
        // Spawn a friendly Iron Golem to protect player!
        const golem = new IronGolem(x, y + 1.5, z, scene, world, game);
        game.mobs.push(golem);
        game.showNotification('Lucky Block: Memanggil Iron Golem Protektor! 🤖🛡️');
    } 
    else if (choice === 'tnt') {
        // Spawn Primed TNT!
        const primedTnt = new PrimedTNT(x, y + 0.5, z, scene, world, game);
        primedTnt.fuse = 1.0; // short fuse for suspense
        game.tnts.push(primedTnt);
        game.showNotification('Lucky Block: Awas! Trap TNT Aktif! 💥🏃‍♂️');
    } 
    else if (choice === 'mobs') {
        // Zombie & Skeleton ambush!
        game.showNotification('Lucky Block: Serbuan Monster! 🧟‍♂️💀');
        const zomb = new Zombie(x - 1, y + 1.2, z, scene, world, game);
        const skel = new Skeleton(x + 1, y + 1.2, z, scene, world, game);
        game.mobs.push(zomb, skel);
    }
}

// Desktop Mouse Interaction (Left click = dig/attack, Right click = build)
// Ctrl+Click also counts as right-click for MacBook trackpad compatibility
window.addEventListener('mousedown', (e) => {
    if (!player.controls.isLocked) return;

    // Treat Ctrl+Left-click as right-click (MacBook trackpad two-finger tap alternative)
    const isRightClick = e.button === 2 || (e.button === 0 && (e.ctrlKey || e.metaKey));
    const isLeftClick = e.button === 0 && !e.ctrlKey && !e.metaKey;

    const target = updateTargeting();
    if (!target) {
        if (isLeftClick) {
            sounds.playClickSound(); // Play swing sound on miss
            if (player && typeof player.swing === 'function') {
                player.swing();
            }
        }
        return;
    }

    // Trigger hand swing animation
    if (player && typeof player.swing === 'function') {
        player.swing();
    }

    if (isLeftClick) { // Left click: Attack Mob OR Dig Block
        if (target.type === 'mob') {
            performAttack(target.mob);
        } else if (target.type === 'block') {
            handleBlockDig(target.targetPos);
        }
    } else if (isRightClick) { // Right click (or Ctrl+click): Build Block
        if (target.type === 'block') {
            const intersect = target.intersect;
            const targetPos = target.targetPos;
            
            // If right clicking an existing TNT block, ignite it!
            const targetedBlockType = world.getBlockAt(targetPos.x, targetPos.y, targetPos.z);
            if (targetedBlockType === 'chest') {
                openChestStorage(targetPos.x, targetPos.y, targetPos.z);
                return;
            }
            if (targetedBlockType === 'tnt') {
                world.removeBlock(targetPos.x, targetPos.y, targetPos.z, true);
                const primedTnt = new PrimedTNT(targetPos.x, targetPos.y, targetPos.z, scene, world, game);
                game.tnts.push(primedTnt);
                return;
            }

            const normal = intersect.face.normal;
            
            const buildX = Math.round(targetPos.x + normal.x);
            const buildY = Math.round(targetPos.y + normal.y);
            const buildZ = Math.round(targetPos.z + normal.z);

            // Bounding check for player
            const pX = Math.round(player.position.x);
            const pZ = Math.round(player.position.z);
            const pYMin = Math.floor(player.position.y);
            const pYMax = Math.floor(player.position.y + player.height);

            if (buildX === pX && buildZ === pZ && buildY >= pYMin && buildY <= pYMax) {
                return; // Can't place inside player
            }

            let blockToPlace = selectedBlockType;
            if (blockToPlace === 'spawn_irongolem' || blockToPlace === 'spawn_snowgolem') {
                handleGolemSpawn(blockToPlace, buildX, buildY, buildZ);
            } else {
                if (blockToPlace === 'water') blockToPlace = 'water_source';
                if (blockToPlace === 'lava') blockToPlace = 'lava_source';
                world.addBlock(buildX, buildY, buildZ, blockToPlace);
            }
        }
    }
});

// Mobile Action Buttons Interaction (dig, build, attack, shoot)
const mobileDigBtn = document.getElementById('mobile-btn-dig');
const mobileBuildBtn = document.getElementById('mobile-btn-build');
const mobileAttackBtn = document.getElementById('mobile-btn-attack');
const mobileShootBtn = document.getElementById('mobile-btn-shoot');

if (mobileShootBtn) {
    mobileShootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player && typeof player.swing === 'function') player.swing();
        shootPlayerArrow();
    });
}

if (mobileAttackBtn) {
    mobileAttackBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player && typeof player.swing === 'function') player.swing();
        const target = updateTargeting();
        if (target && target.type === 'mob') {
            performAttack(target.mob);
        } else {
            sounds.playClickSound(); // Swing sound on miss
        }
    });
}

if (mobileDigBtn) {
    mobileDigBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player && typeof player.swing === 'function') player.swing();
        const target = updateTargeting();
        if (target) {
            if (target.type === 'mob') {
                performAttack(target.mob);
            } else if (target.type === 'block') {
                handleBlockDig(target.targetPos);
            }
        } else {
            sounds.playClickSound(); // Swing sound on miss
        }
    });
}

if (mobileBuildBtn) {
    mobileBuildBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (player && typeof player.swing === 'function') player.swing();
        const target = updateTargeting();
        let built = false;
        if (target && target.type === 'block') {
            const intersect = target.intersect;
            const targetPos = target.targetPos;

            // If right clicking/building on an existing TNT block, ignite it!
            const targetedBlockType = world.getBlockAt(targetPos.x, targetPos.y, targetPos.z);
            if (targetedBlockType === 'chest') {
                openChestStorage(targetPos.x, targetPos.y, targetPos.z);
                return;
            }
            if (targetedBlockType === 'tnt') {
                world.removeBlock(targetPos.x, targetPos.y, targetPos.z, true);
                const primedTnt = new PrimedTNT(targetPos.x, targetPos.y, targetPos.z, scene, world, game);
                game.tnts.push(primedTnt);
                return;
            }

            const normal = intersect.face.normal;
            
            const buildX = Math.round(targetPos.x + normal.x);
            const buildY = Math.round(targetPos.y + normal.y);
            const buildZ = Math.round(targetPos.z + normal.z);

            const pX = Math.round(player.position.x);
            const pZ = Math.round(player.position.z);
            const pYMin = Math.floor(player.position.y);
            const pYMax = Math.floor(player.position.y + player.height);

            if (!(buildX === pX && buildZ === pZ && buildY >= pYMin && buildY <= pYMax)) {
                let blockToPlace = selectedBlockType;
                if (blockToPlace === 'spawn_irongolem' || blockToPlace === 'spawn_snowgolem') {
                    handleGolemSpawn(blockToPlace, buildX, buildY, buildZ);
                    built = true;
                } else {
                    if (blockToPlace === 'water') blockToPlace = 'water_source';
                    if (blockToPlace === 'lava') blockToPlace = 'lava_source';

                    built = world.addBlock(buildX, buildY, buildZ, blockToPlace);
                }
            }
        }
        if (!built) {
            sounds.playClickSound(); // Swing sound on miss
        }
    });
}


// 8. Mob Spawning System
function spawnMob(type) {
    // Pick coordinates in centered world
    const x = Math.floor((Math.random() - 0.5) * (world.width - 8));
    const z = Math.floor((Math.random() - 0.5) * (world.depth - 8));
    
    // Find surface height
    let y = world.height - 1;
    while (y > 0) {
        const b = world.getBlockAt(x, y, z);
        if (b && !b.startsWith('water') && !b.startsWith('lava')) {
            break;
        }
        y--;
    }
    
    // Spawn only if surface found
    if (y > 0 && y < world.height - 3) {
        let mobInstance;
        if (type === 'zombie') mobInstance = new Zombie(x, y + 1.2, z, scene, world, game);
        else if (type === 'creeper') mobInstance = new Creeper(x, y + 1.2, z, scene, world, game);
        else if (type === 'skeleton') mobInstance = new Skeleton(x, y + 1.2, z, scene, world, game);
        else if (type === 'irongolem') mobInstance = new IronGolem(x, y + 1.5, z, scene, world, game);
        else if (type === 'snowgolem') mobInstance = new SnowGolem(x, y + 1.2, z, scene, world, game);
        else if (type === 'chicken') mobInstance = new Chicken(x, y + 1.0, z, scene, world, game);
        else if (type === 'pig') mobInstance = new Pig(x, y + 1.1, z, scene, world, game);
        else if (type === 'cow') mobInstance = new Cow(x, y + 1.2, z, scene, world, game);
        else if (type === 'bloodgolem') mobInstance = new BloodGolem(x, y + 1.5, z, scene, world, game);
        else if (type === 'giantirongolem') mobInstance = new GiantIronGolem(x, y + 3.0, z, scene, world, game);
        else if (type === 'witherskeleton') mobInstance = new WitherSkeleton(x, y + 1.2, z, scene, world, game);
        
        if (mobInstance) {
            game.mobs.push(mobInstance);
        }
    }
}

// Spawn initial mobs and passive animals around the world
for (let i = 0; i < 4; i++) {
    const hostileTypes = ['zombie', 'creeper', 'skeleton', 'witherskeleton'];
    spawnMob(hostileTypes[i % hostileTypes.length]);
}
for (let i = 0; i < 6; i++) {
    const animalTypes = ['chicken', 'pig', 'cow'];
    spawnMob(animalTypes[i % animalTypes.length]);
}
// Spawn 1 Giant Iron Golem and 1 Blood Golem at start
spawnMob('giantirongolem');
spawnMob('bloodgolem');

// Periodically check and spawn mobs to populate the world (every 8 seconds)
setInterval(() => {
    const invModal = document.getElementById('inventory-modal');
    const isInvOpen = invModal && invModal.style.display !== 'none';
    if ((player.controls.isLocked || isInvOpen) && game.mobs.length < 18) {
        const rand = Math.random();
        if (rand < 0.03) {
            spawnMob('giantirongolem');
        } else if (rand < 0.07) {
            spawnMob('bloodgolem');
        } else if (rand < 0.12) {
            spawnMob('irongolem');
        } else if (rand < 0.17) {
            spawnMob('snowgolem');
        } else if (rand < 0.45) {
            const animalTypes = ['chicken', 'pig', 'cow'];
            spawnMob(animalTypes[Math.floor(Math.random() * animalTypes.length)]);
        } else {
            const hostileTypes = ['zombie', 'creeper', 'skeleton', 'witherskeleton'];
            spawnMob(hostileTypes[Math.floor(Math.random() * hostileTypes.length)]);
        }
    }
}, 8000);


// Inventory & Storage State Registry
let currentChestPos = null;
let selectedInventorySlot = null;

const itemInfo = {
    grass: { name: 'Rumput', emoji: '🌱' },
    dirt: { name: 'Tanah', emoji: '🟫' },
    stone: { name: 'Batu', emoji: '🪨' },
    obsidian: { name: 'Obsidian', emoji: '🔮' },
    wood: { name: 'Kayu', emoji: '🪵' },
    leaf: { name: 'Daun', emoji: '🍃' },
    brick: { name: 'Bata', emoji: '🧱' },
    emerald: { name: 'Zamrud', emoji: '💚' },
    diamond: { name: 'Berlian', emoji: '💎' },
    ender: { name: 'Ender Block', emoji: '👁️' },
    tnt: { name: 'TNT', emoji: '🧨' },
    water: { name: 'Air', emoji: '💧' },
    lava: { name: 'Lava', emoji: '🔥' },
    quartz: { name: 'Kuarsa', emoji: '🤍' },
    sand: { name: 'Pasir', emoji: '⏳' },
    farmland: { name: 'Ladang', emoji: '🚜' },
    lucky: { name: 'Lucky Block', emoji: '❓' },
    magma: { name: 'Magma', emoji: '🌋' },
    crop: { name: 'Bibit Gandum', emoji: '🌾' },
    coal: { name: 'Batu Bara', emoji: '⚫' },
    coal_ore: { name: 'Bijih Batu Bara', emoji: '🪨⚫' },
    iron_ore: { name: 'Bijih Besi', emoji: '🪨🟫' },
    gold_ore: { name: 'Bijih Emas', emoji: '🪨🪙' },
    chest: { name: 'Peti', emoji: '📦' },
    golden_apple: { name: 'Apel Emas', emoji: '🍎' },
    helmet_iron: { name: 'Helm Besi', emoji: '🪖' },
    chestplate_iron: { name: 'Zirah Besi', emoji: '👕' },
    leggings_iron: { name: 'Celana Besi', emoji: '👖' },
    boots_iron: { name: 'Sepatu Besi', emoji: '🥾' },
    helmet_gold: { name: 'Helm Emas', emoji: '🪖' },
    chestplate_gold: { name: 'Zirah Emas', emoji: '👕' },
    leggings_gold: { name: 'Celana Emas', emoji: '👖' },
    boots_gold: { name: 'Sepatu Emas', emoji: '🥾' },
    helmet_diamond: { name: 'Helm Berlian', emoji: '🪖' },
    chestplate_diamond: { name: 'Zirah Berlian', emoji: '👕' },
    leggings_diamond: { name: 'Celana Berlian', emoji: '👖' },
    boots_diamond: { name: 'Sepatu Berlian', emoji: '🥾' }
};

function addItemToInventory(type, count = 1) {
    if (!player || !player.inventory) return false;
    
    const isStackable = !type.startsWith('helmet_') && 
                        !type.startsWith('chestplate_') && 
                        !type.startsWith('leggings_') && 
                        !type.startsWith('boots_');
    
    let remaining = count;
    
    if (isStackable) {
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            if (item && item.type === type && item.count < 64) {
                const addAmount = Math.min(remaining, 64 - item.count);
                item.count += addAmount;
                remaining -= addAmount;
                if (remaining <= 0) break;
            }
        }
    }
    
    if (remaining > 0) {
        for (let i = 0; i < player.inventory.length; i++) {
            if (player.inventory[i] === null) {
                const addAmount = Math.min(remaining, isStackable ? 64 : 1);
                player.inventory[i] = { type: type, count: addAmount };
                remaining -= addAmount;
                if (remaining <= 0) break;
            }
        }
    }
    
    if (remaining > 0) {
        game.showNotification("Tas Penuh!");
        return false;
    }
    
    updateInventoryUI();
    return true;
}

function updateInventoryUI() {
    const bagGrid = document.getElementById('bag-grid');
    const chestGrid = document.getElementById('chest-grid');
    
    if (!bagGrid) return;
    
    bagGrid.innerHTML = '';
    
    for (let i = 0; i < player.inventory.length; i++) {
        const item = player.inventory[i];
        const slotEl = document.createElement('div');
        slotEl.className = 'inv-slot';
        slotEl.dataset.index = i;
        
        if (selectedInventorySlot === i) {
            slotEl.classList.add('selected');
        }
        
        if (item) {
            const info = itemInfo[item.type] || { name: item.type, emoji: '📦' };
            slotEl.title = `${info.name} (${item.count})`;
            
            if (item.type === 'golden_apple' || item.type.includes('diamond')) {
                slotEl.classList.add('rare-item');
            }
            
            slotEl.innerHTML = `
                <div class="item-visual">${info.emoji}</div>
                <div class="item-count">${item.count}</div>
            `;
            
            slotEl.addEventListener('click', () => {
                handleSlotClick('bag', i);
            });
        } else {
            slotEl.innerHTML = `<div class="empty-slot"></div>`;
        }
        bagGrid.appendChild(slotEl);
    }
    
    if (currentChestPos && chestGrid) {
        chestGrid.innerHTML = '';
        const key = `${currentChestPos.x},${currentChestPos.y},${currentChestPos.z}`;
        if (!game.chests[key]) {
            game.chests[key] = Array(18).fill(null);
        }
        const chestInv = game.chests[key];
        
        for (let i = 0; i < chestInv.length; i++) {
            const item = chestInv[i];
            const slotEl = document.createElement('div');
            slotEl.className = 'inv-slot';
            slotEl.dataset.index = i;
            
            if (item) {
                const info = itemInfo[item.type] || { name: item.type, emoji: '📦' };
                slotEl.title = `${info.name} (${item.count})`;
                
                if (item.type === 'golden_apple' || item.type.includes('diamond')) {
                    slotEl.classList.add('rare-item');
                }
                
                slotEl.innerHTML = `
                    <div class="item-visual">${info.emoji}</div>
                    <div class="item-count">${item.count}</div>
                `;
                
                slotEl.addEventListener('click', () => {
                    handleSlotClick('chest', i);
                });
            } else {
                slotEl.innerHTML = `<div class="empty-slot"></div>`;
            }
            chestGrid.appendChild(slotEl);
        }
    }
    
    const armorSlots = ['helmet', 'chestplate', 'leggings', 'boots'];
    armorSlots.forEach(slotName => {
        const slotEl = document.querySelector(`.armor-slot[data-slot="${slotName}"]`);
        if (slotEl) {
            const slotItemContainer = slotEl.querySelector('.slot-item');
            const placeholderEl = slotEl.querySelector('.slot-placeholder');
            const item = player.armor[slotName];
            
            if (item) {
                const info = itemInfo[item.type] || { name: item.type, emoji: '🛡️' };
                slotEl.title = `${info.name} (Terpasang)`;
                placeholderEl.style.display = 'none';
                slotItemContainer.innerHTML = `<div class="item-visual">${info.emoji}</div>`;
                slotItemContainer.style.display = 'block';
                
                slotItemContainer.onclick = (e) => {
                    e.stopPropagation();
                    unequipArmor(slotName);
                };
            } else {
                slotEl.title = `${slotName.toUpperCase()} Slot`;
                placeholderEl.style.display = 'block';
                slotItemContainer.innerHTML = '';
                slotItemContainer.style.display = 'none';
                slotItemContainer.onclick = null;
            }
        }
    });
    
    const statsHp = document.getElementById('stats-hp');
    const statsDef = document.getElementById('stats-def');
    if (statsHp) statsHp.textContent = `❤️ HP: ${Math.round(player.health)}/${player.maxHealth}`;
    if (statsDef) {
        const defPercent = Math.round(player.getArmorReduction() * 100);
        statsDef.textContent = `🛡️ DEF: ${defPercent}%`;
    }
    
    const eatBtn = document.getElementById('eat-apple-btn');
    if (eatBtn) {
        if (selectedInventorySlot !== null) {
            const selectedItem = player.inventory[selectedInventorySlot];
            if (selectedItem && selectedItem.type === 'golden_apple') {
                eatBtn.style.display = 'block';
            } else {
                eatBtn.style.display = 'none';
            }
        } else {
            eatBtn.style.display = 'none';
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
            let moved = false;
            
            for (let i = 0; i < chestInv.length; i++) {
                const cItem = chestInv[i];
                if (cItem && cItem.type === item.type && cItem.count < 64) {
                    const countToAdd = Math.min(item.count, 64 - cItem.count);
                    cItem.count += countToAdd;
                    item.count -= countToAdd;
                    if (item.count <= 0) {
                        player.inventory[index] = null;
                    }
                    moved = true;
                    break;
                }
            }
            
            if (!moved) {
                for (let i = 0; i < chestInv.length; i++) {
                    if (chestInv[i] === null) {
                        chestInv[i] = { type: item.type, count: item.count };
                        player.inventory[index] = null;
                        moved = true;
                        break;
                    }
                }
            }
            if (moved) {
                sounds.playClickSound();
            } else {
                game.showNotification("Peti penuh!");
            }
            selectedInventorySlot = null;
        } else {
            if (item.type.startsWith('helmet_') || item.type.startsWith('chestplate_') || item.type.startsWith('leggings_') || item.type.startsWith('boots_')) {
                equipArmor(index);
            } else {
                if (selectedInventorySlot === index) {
                    selectedInventorySlot = null;
                } else {
                    selectedInventorySlot = index;
                }
            }
        }
    } else if (source === 'chest') {
        const key = `${currentChestPos.x},${currentChestPos.y},${currentChestPos.z}`;
        const chestInv = game.chests[key];
        const item = chestInv[index];
        if (!item) return;
        
        let moved = false;
        for (let i = 0; i < player.inventory.length; i++) {
            const bItem = player.inventory[i];
            if (bItem && bItem.type === item.type && bItem.count < 64) {
                const countToAdd = Math.min(item.count, 64 - bItem.count);
                bItem.count += countToAdd;
                item.count -= countToAdd;
                if (item.count <= 0) {
                    chestInv[index] = null;
                }
                moved = true;
                break;
            }
        }
        if (!moved) {
            for (let i = 0; i < player.inventory.length; i++) {
                if (player.inventory[i] === null) {
                    player.inventory[i] = { type: item.type, count: item.count };
                    chestInv[index] = null;
                    moved = true;
                    break;
                }
            }
        }
        if (moved) {
            sounds.playClickSound();
        } else {
            game.showNotification("Tas penuh!");
        }
    }
    updateInventoryUI();
}

function equipArmor(slotIndex) {
    const item = player.inventory[slotIndex];
    if (!item) return;
    
    let slotName = '';
    if (item.type.includes('helmet')) slotName = 'helmet';
    else if (item.type.includes('chestplate')) slotName = 'chestplate';
    else if (item.type.includes('leggings')) slotName = 'leggings';
    else if (item.type.includes('boots')) slotName = 'boots';
    
    if (!slotName) return;
    
    const temp = player.armor[slotName];
    player.armor[slotName] = { type: item.type, count: 1 };
    player.inventory[slotIndex] = temp;
    
    sounds.playClickSound();
    game.showNotification(`Memasang ${itemInfo[item.type].name}! 🛡️`);
}

function unequipArmor(slotName) {
    const item = player.armor[slotName];
    if (!item) return;
    
    let foundSlot = -1;
    for (let i = 0; i < player.inventory.length; i++) {
        if (player.inventory[i] === null) {
            foundSlot = i;
            break;
        }
    }
    
    if (foundSlot > -1) {
        player.inventory[foundSlot] = { type: item.type, count: 1 };
        player.armor[slotName] = null;
        sounds.playClickSound();
        game.showNotification(`Melepas ${itemInfo[item.type].name}.`);
    } else {
        game.showNotification("Tas penuh! Kosongkan tas untuk melepas armor.");
    }
    updateInventoryUI();
}

function eatGoldenApple(slotIndex) {
    const item = player.inventory[slotIndex];
    if (item && item.type === 'golden_apple') {
        item.count--;
        if (item.count <= 0) {
            player.inventory[slotIndex] = null;
        }
        
        player.health = Math.min(player.maxHealth, player.health + 50);
        updateHealthUI();
        
        sounds.playClickSound();
        
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100vw';
        flash.style.height = '100vh';
        flash.style.background = 'rgba(255, 215, 0, 0.35)';
        flash.style.zIndex = '9999';
        flash.style.pointerEvents = 'none';
        flash.style.transition = 'opacity 0.3s ease-out';
        document.body.appendChild(flash);

        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => {
                if (flash.parentNode) flash.parentNode.removeChild(flash);
            }, 300);
        }, 150);
        
        game.showNotification("Mengonsumsi Apel Emas! Memulihkan 50 HP ❤️");
        selectedInventorySlot = null;
        updateInventoryUI();
    }
}

function toggleInventory() {
    const modal = document.getElementById('inventory-modal');
    if (!modal) return;
    
    const isVisible = modal.style.display !== 'none';
    if (isVisible) {
        modal.style.display = 'none';
        currentChestPos = null;
        selectedInventorySlot = null;
        
        if (!player.isTouch) {
            player.controls.lock();
        }
    } else {
        modal.style.display = 'flex';
        const chestSec = document.getElementById('chest-storage-section');
        if (chestSec) chestSec.style.display = 'none';
        
        const title = document.getElementById('inventory-title');
        if (title) title.textContent = "🎒 Tas & Perlengkapan";
        
        selectedInventorySlot = null;
        updateInventoryUI();
        
        player.controls.unlock();
    }
}

function openChestStorage(x, y, z) {
    const modal = document.getElementById('inventory-modal');
    if (!modal) return;
    
    currentChestPos = { x, y, z };
    modal.style.display = 'flex';
    
    const chestSec = document.getElementById('chest-storage-section');
    if (chestSec) chestSec.style.display = 'block';
    
    const title = document.getElementById('inventory-title');
    if (title) title.textContent = "📦 Peti Penyimpanan";
    
    selectedInventorySlot = null;
    updateInventoryUI();
    
    player.controls.unlock();
}

// Main HUD Armor UI Updater
const armorBarContainer = document.getElementById('armor-bar-container');
const armorFill = document.getElementById('armor-fill');
const armorText = document.getElementById('armor-text');

function updateArmorUI() {
    if (armorBarContainer && armorFill && armorText && player) {
        const reduction = player.getArmorReduction();
        const percentage = Math.round(reduction * 100);
        if (percentage > 0) {
            armorBarContainer.style.display = 'flex';
            armorFill.style.width = `${percentage}%`;
            armorText.textContent = `${percentage}% DEF`;
        } else {
            armorBarContainer.style.display = 'none';
        }
    }
}

// Bind UI actions for inventory modal
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('close-inventory-btn')?.addEventListener('click', toggleInventory);
    document.getElementById('inventory-btn')?.addEventListener('click', toggleInventory);
    document.getElementById('eat-apple-btn')?.addEventListener('click', () => {
        if (selectedInventorySlot !== null) {
            eatGoldenApple(selectedInventorySlot);
        }
    });
});


// 9. HUD Health UI Updater
const healthFill = document.getElementById('health-fill');
const healthText = document.getElementById('health-text');

function updateHealthUI() {
    if (healthFill && healthText) {
        const percentage = Math.max(0, Math.min(100, player.health));
        healthFill.style.width = `${percentage}%`;
        healthText.textContent = `${Math.round(player.health)} HP`;
        
        // Color transition
        if (percentage < 30) {
            healthFill.style.background = '#ef476f'; // Low: Red/Pink
        } else if (percentage < 60) {
            healthFill.style.background = '#ffd166'; // Medium: Yellow
        } else {
            healthFill.style.background = '#06d6a0'; // High: Green
        }
    }
}


// 10. Game Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const dt = Math.min(clock.getDelta(), 0.1); // Clamp physics time steps

    // A. Update Player
    player.update(dt);
    updateHealthUI();

    // B. Update Mobs
    if (game.mobs) {
        for (let i = game.mobs.length - 1; i >= 0; i--) {
            game.mobs[i].update(dt);
        }
    }

    // C. Update Primed TNTs
    if (game.tnts) {
        for (let i = game.tnts.length - 1; i >= 0; i--) {
            const keep = game.tnts[i].update(dt);
            if (!keep) game.tnts.splice(i, 1);
        }
    }

    // D. Update Particles
    if (game.particles) {
        for (let i = game.particles.length - 1; i >= 0; i--) {
            const p = game.particles[i];
            p.elapsed += dt;
            if (p.elapsed >= p.life) {
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.material.dispose();
                game.particles.splice(i, 1);
            } else {
                p.velocity.y -= 9.8 * dt; // gravity drop
                p.mesh.position.addScaledVector(p.velocity, dt);
                
                // Fade out transparency
                const ratio = 1.0 - (p.elapsed / p.life);
                p.material.opacity = ratio;
                p.material.transparent = true;
            }
        }
    }

    // E. Update Arrows
    if (game.arrows) {
        for (let i = game.arrows.length - 1; i >= 0; i--) {
            const keep = game.arrows[i].update(dt);
            if (!keep) game.arrows.splice(i, 1);
        }
    }

    // F. Update block highlighting (crosshair targeting)
    updateTargeting();

    // G. Tick world cellular water/lava updates
    if (world) {
        world.liquidTimer += dt;
        if (world.liquidTimer >= 0.2) { // 200ms tick rate
            world.tickLiquids();
            world.liquidTimer = 0;
        }
    }

    // H. Render frame
    gameRenderer.render();
}

// Start loop
animate();