// Player character, first-person controls and collision detection
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { sounds } from '../utils/audio.js';
import {
    normalizeBlockType,
    isSolidBlock,
    computeArmorReduction,
    computeThornsDamage
} from '../utils/gameData.js';

const MODAL_IDS = [
    'play-overlay',
    'inventory-modal',
    'crafting-modal',
    'enchant-modal',
    'block-picker-modal'
];

export function isAnyOverlayOpen() {
    for (const id of MODAL_IDS) {
        const el = document.getElementById(id);
        if (el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none') {
            return true;
        }
    }
    return false;
}

export function flashScreen(background, holdMs = 90, fadeMs = 200) {
    const flash = document.createElement('div');
    flash.className = 'screen-flash-overlay';
    flash.style.background = background;
    flash.style.transition = `opacity ${fadeMs}ms ease-out`;
    document.body.appendChild(flash);

    setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => {
            if (flash.parentNode) flash.parentNode.removeChild(flash);
        }, fadeMs);
    }, holdMs);
}

export class Player {
    constructor(camera, domElement, world) {
        this.camera = camera;
        this.world = world;

        this.controls = new PointerLockControls(this.camera, domElement);

        this.width = 0.6;
        this.height = 1.8;
        this.eyeHeight = 1.6;

        this.position = new THREE.Vector3(0, 10, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isGrounded = false;

        this.health = 100;
        this.maxHealth = 100;
        this.xp = 0;
        this.xpLevel = 5;
        this.enchantSeed = Math.floor(Math.random() * 100000) + 1;
        this.lavaDamageTimer = 0;
        this.magmaDamageTimer = 0;
        this.witherTimer = 0;
        this.witherDamageAccumulator = 0;

        // Tas (Inventory) - 24 slots
        this.inventory = Array(24).fill(null);
        this.resetDefaultInventory();

        // Armor slots
        this.armor = {
            helmet: null,
            chestplate: null,
            leggings: null,
            boots: null
        };

        this.walkSpeed = 4.5;
        this.jumpStrength = 6.2;
        this.gravity = -18.0;

        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };

        this.minHeightLimit = -10;

        this.handContainer = null;
        this.heldItem = null;
        this.isSwinging = false;
        this.swingTimer = 0;
        this.swingDuration = 0.2;
        this.toastTimer = null;

        this.setupInput();

        this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (this.isTouch) {
            this.setupTouchInput();
        }

        this.respawn();
    }

    resetDefaultInventory() {
        this.xp = 0;
        this.xpLevel = 5;
        this.enchantSeed = Math.floor(Math.random() * 100000) + 1;
        this.inventory = Array(24).fill(null);
        this.inventory[0] = { type: 'sword_iron', count: 1 };
        this.inventory[1] = { type: 'pickaxe_iron', count: 1 };
        this.inventory[2] = { type: 'bow', count: 1 };
        this.inventory[3] = {
            type: 'enchanted_book',
            count: 1,
            enchants: { sharpness: 1 },
            enchant: { id: 'sharpness', level: 1 }
        };
        this.inventory[4] = { type: 'wood', count: 16 };
        this.inventory[5] = { type: 'iron_ingot', count: 6 };
        this.inventory[6] = { type: 'lapis', count: 12 };
        this.inventory[7] = { type: 'diamond', count: 4 };
        this.inventory[8] = { type: 'book', count: 4 };
        this.inventory[9] = { type: 'bookshelf', count: 6 };
        this.inventory[10] = { type: 'crafting', count: 1 };
        this.inventory[11] = { type: 'enchanting_table', count: 1 };
        this.inventory[12] = { type: 'golden_apple', count: 3 };
        this.inventory[13] = { type: 'coal', count: 8 };
    }

    respawn() {
        const startX = 0;
        const startZ = 0;
        let topY = 6;
        for (let y = this.world.height - 1; y >= 0; y--) {
            const b = this.world.getBlockAt(startX, y, startZ);
            if (isSolidBlock(b)) {
                topY = y + 0.5;
                break;
            }
        }

        this.position.set(startX, topY + 1.5, startZ);
        this.velocity.set(0, 0, 0);
        this.isGrounded = false;
        this.health = 100;
        this.witherTimer = 0;
        this.camera.position.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    }

    setupInput() {
        const onKeyDown = (event) => {
            if (!this.controls.isLocked || isAnyOverlayOpen()) return;

            switch (event.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.keys.forward = true;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.keys.backward = true;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.keys.left = true;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.keys.right = true;
                    break;
                case 'Space':
                    this.keys.jump = true;
                    break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.keys.forward = false;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.keys.backward = false;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.keys.left = false;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.keys.right = false;
                    break;
                case 'Space':
                    this.keys.jump = false;
                    break;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
    }

    checkCollisions(pos, preferTop = true) {
        return this.world.checkAABB(pos.x, pos.y, pos.z, this.width / 2, this.height, false, preferTop);
    }

    update(dt) {
        if (isAnyOverlayOpen()) {
            this.keys.forward = false;
            this.keys.backward = false;
            this.keys.left = false;
            this.keys.right = false;
            this.keys.jump = false;
            return;
        }

        if (this.ridingMinecart) {
            if (this.keys.jump) {
                this.ridingMinecart.rider = null;
                this.ridingMinecart = null;
                this.position.y += 1.0;
                this.camera.position.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
                sounds.playClickSound();
                return;
            }

            this.ridingMinecart.updateFromRider(dt, this.keys);
            this.position.copy(this.ridingMinecart.position);
            this.position.y += 0.35;
            this.velocity.set(0, 0, 0);
            this.isGrounded = true;
            this.camera.position.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
            return;
        }

        if (!this.controls.isLocked && !this.isTouch) return;

        // 1. Detect if player is in water or lava
        let inWater = false;
        let inLava = false;
        const gridX = Math.round(this.position.x);
        const feetY = Math.round(this.position.y);
        const headY = Math.round(this.position.y + this.eyeHeight);
        const gridZ = Math.round(this.position.z);

        for (let y = feetY; y <= headY; y++) {
            const block = this.world.getBlockAt(gridX, y, gridZ);
            if (block) {
                if (block.startsWith('water')) inWater = true;
                if (block.startsWith('lava')) inLava = true;
            }
        }

        if (inLava) {
            this.lavaDamageTimer += dt;
            if (this.lavaDamageTimer >= 0.5) {
                this.takeDamage(15, 'fire');
                this.lavaDamageTimer = 0;
            }
        } else {
            this.lavaDamageTimer = 0;
        }

        if (this.isGrounded) {
            const blockUnder = this.world.getBlockAt(
                Math.round(this.position.x),
                Math.round(this.position.y - 0.55),
                Math.round(this.position.z)
            );
            if (blockUnder === 'magma') {
                this.magmaDamageTimer += dt;
                if (this.magmaDamageTimer >= 0.5) {
                    this.takeDamage(6, 'fire');
                    this.magmaDamageTimer = 0;
                    this.world.spawnBlockBreakParticles(
                        Math.round(this.position.x),
                        Math.round(this.position.y),
                        Math.round(this.position.z),
                        'magma'
                    );
                }
            } else {
                this.magmaDamageTimer = 0;
            }
        } else {
            this.magmaDamageTimer = 0;
        }

        if (this.witherTimer > 0) {
            this.witherTimer -= dt;
            this.witherDamageAccumulator += dt;
            if (this.witherDamageAccumulator >= 0.75) {
                this.takeDamage(4);
                this.witherDamageAccumulator = 0;
                flashScreen('rgba(10, 10, 10, 0.45)', 80, 200);
            }
        } else {
            this.witherTimer = 0;
            this.witherDamageAccumulator = 0;
        }

        let currentSpeed = this.walkSpeed;
        let currentGravity = this.gravity;

        if (inWater) {
            currentSpeed = 2.2;
            currentGravity = -3.0;
        } else if (inLava) {
            currentSpeed = 1.3;
            currentGravity = -1.8;
        }

        const moveDirection = new THREE.Vector3();
        const camDirection = new THREE.Vector3();
        this.camera.getWorldDirection(camDirection);
        camDirection.y = 0;
        camDirection.normalize();

        const camRight = new THREE.Vector3();
        camRight.crossVectors(camDirection, new THREE.Vector3(0, 1, 0)).normalize();

        if (this.keys.forward) moveDirection.add(camDirection);
        if (this.keys.backward) moveDirection.sub(camDirection);
        if (this.keys.right) moveDirection.add(camRight);
        if (this.keys.left) moveDirection.sub(camRight);

        if (moveDirection.lengthSq() > 0) moveDirection.normalize();

        this.velocity.x = moveDirection.x * currentSpeed;
        this.velocity.z = moveDirection.z * currentSpeed;
        this.velocity.y += currentGravity * dt;

        if (this.keys.jump) {
            if (inWater) {
                this.velocity.y = 2.4;
            } else if (inLava) {
                this.velocity.y = 1.0;
            } else if (this.isGrounded) {
                this.velocity.y = this.jumpStrength;
                this.isGrounded = false;
            }
        }

        const nextPos = this.position.clone();

        nextPos.x += this.velocity.x * dt;
        if (this.checkCollisions(nextPos)) {
            nextPos.x = this.position.x;
            this.velocity.x = 0;
        }

        nextPos.z += this.velocity.z * dt;
        if (this.checkCollisions(nextPos)) {
            nextPos.z = this.position.z;
            this.velocity.z = 0;
        }

        this.isGrounded = false;
        nextPos.y += this.velocity.y * dt;

        const verticalHit = this.checkCollisions(nextPos, this.velocity.y <= 0);
        if (verticalHit) {
            if (this.velocity.y < 0) {
                nextPos.y = verticalHit.y + 0.5;
                this.isGrounded = true;
            } else if (this.velocity.y > 0) {
                nextPos.y = verticalHit.y - 0.5 - this.height;
            }
            this.velocity.y = 0;
        }

        const halfWidth = this.world.width / 2;
        const halfDepth = this.world.depth / 2;
        const boundaryBuffer = 0.35;

        if (nextPos.x < -halfWidth + boundaryBuffer) {
            nextPos.x = -halfWidth + boundaryBuffer;
            this.velocity.x = 0;
        } else if (nextPos.x > halfWidth - boundaryBuffer) {
            nextPos.x = halfWidth - boundaryBuffer;
            this.velocity.x = 0;
        }

        if (nextPos.z < -halfDepth + boundaryBuffer) {
            nextPos.z = -halfDepth + boundaryBuffer;
            this.velocity.z = 0;
        } else if (nextPos.z > halfDepth - boundaryBuffer) {
            nextPos.z = halfDepth - boundaryBuffer;
            this.velocity.z = 0;
        }

        this.position.copy(nextPos);

        if (this.position.y < this.minHeightLimit) {
            this.respawn();
            this.showNotification('Kamu terjatuh ke Void dan kembali ke titik awal.');
        }

        this.camera.position.set(
            this.position.x,
            this.position.y + this.eyeHeight,
            this.position.z
        );

        if (this.isSwinging && this.handContainer) {
            this.swingTimer += dt;
            if (this.swingTimer >= this.swingDuration) {
                this.isSwinging = false;
                this.handContainer.position.set(0.25, -0.2, -0.45);
                this.handContainer.rotation.set(0, 0, 0);
            } else {
                const progress = this.swingTimer / this.swingDuration;
                const angle = Math.sin(progress * Math.PI) * 0.5;
                this.handContainer.position.set(
                    0.25 - angle * 0.08,
                    -0.2 - angle * 0.06,
                    -0.45 + angle * 0.05
                );
                this.handContainer.rotation.set(angle * 1.0, -angle * 0.4, -angle * 0.3);
            }
        }
    }

    getArmorReduction(damageSource = 'normal') {
        return computeArmorReduction(this.armor, damageSource);
    }

    takeDamage(amount, damageSource = 'normal', attackerMob = null) {
        if (this.health <= 0) return;

        const reduction = this.getArmorReduction(damageSource);
        const finalDamage = amount * (1 - reduction);
        this.health = Math.max(0, this.health - finalDamage);

        if (attackerMob && typeof attackerMob.takeDamage === 'function' && attackerMob.hp > 0) {
            const thornsDamage = computeThornsDamage(this.armor);
            if (thornsDamage > 0) {
                attackerMob.takeDamage(thornsDamage);
            }
        }

        sounds.playHurtSound();
        flashScreen('rgba(255, 0, 0, 0.28)', 80, 200);

        if (this.health <= 0) {
            this.die();
        }
    }

    heal(amount) {
        if (this.health <= 0) return;
        this.health = Math.min(this.maxHealth, this.health + amount);
        flashScreen('rgba(0, 255, 128, 0.16)', 100, 200);
    }

    die() {
        sounds.playExplosionSound();
        this.showNotification('Kamu gugur dan kembali ke titik spawn.');
        this.respawn();
    }

    showNotification(message) {
        const toast = document.getElementById('toast-msg');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');
            if (this.toastTimer) clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, 2800);
        }
    }

    setupTouchInput() {
        document.body.classList.add('is-mobile');

        const joystickBase = document.getElementById('mobile-joystick-base');
        const joystickHandle = document.getElementById('mobile-joystick-handle');
        const jumpBtn = document.getElementById('mobile-btn-jump');

        if (!joystickBase || !joystickHandle || !jumpBtn) return;

        let joystickTouchId = null;
        let joystickStartX = 0;
        let joystickStartY = 0;
        const maxJoystickDistance = 42;

        let lookTouchId = null;
        let lastLookX = 0;
        let lastLookY = 0;

        jumpBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            jumpBtn.classList.add('active');
            this.keys.jump = true;
        });
        jumpBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            jumpBtn.classList.remove('active');
            this.keys.jump = false;
        });
        jumpBtn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            jumpBtn.classList.remove('active');
            this.keys.jump = false;
        });

        window.addEventListener('touchstart', (e) => {
            if (isAnyOverlayOpen()) return;

            const isInteractive = e.target.closest('button') ||
                                  e.target.closest('.hotbar-slot') ||
                                  e.target.closest('#hotbar-wrapper') ||
                                  e.target.closest('#actions-panel');
            if (!isInteractive) {
                e.preventDefault();
            }

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const clientX = touch.clientX;
                const clientY = touch.clientY;

                if (isInteractive) continue;

                if (clientX < window.innerWidth * 0.42) {
                    if (joystickTouchId === null) {
                        joystickTouchId = touch.identifier;
                        const rect = joystickBase.getBoundingClientRect();
                        joystickStartX = rect.left + rect.width / 2;
                        joystickStartY = rect.top + rect.height / 2;
                    }
                } else if (lookTouchId === null) {
                    lookTouchId = touch.identifier;
                    lastLookX = clientX;
                    lastLookY = clientY;
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (isAnyOverlayOpen()) return;

            const isHotbar = e.target.closest('#hotbar-container');
            if (!isHotbar) {
                e.preventDefault();
            }

            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];

                if (touch.identifier === joystickTouchId) {
                    let dx = touch.clientX - joystickStartX;
                    let dy = touch.clientY - joystickStartY;

                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > maxJoystickDistance) {
                        dx = (dx / dist) * maxJoystickDistance;
                        dy = (dy / dist) * maxJoystickDistance;
                    }

                    joystickHandle.style.transform = `translate(${dx}px, ${dy}px)`;
                    joystickHandle.style.transition = 'none';

                    const normalizedX = dx / maxJoystickDistance;
                    const normalizedY = dy / maxJoystickDistance;

                    this.keys.left = normalizedX < -0.25;
                    this.keys.right = normalizedX > 0.25;
                    this.keys.forward = normalizedY < -0.25;
                    this.keys.backward = normalizedY > 0.25;
                }

                if (touch.identifier === lookTouchId) {
                    const dx = touch.clientX - lastLookX;
                    const dy = touch.clientY - lastLookY;

                    const sensitivity = 0.005;
                    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
                    euler.setFromQuaternion(this.camera.quaternion);

                    euler.y -= dx * sensitivity;
                    euler.x -= dy * sensitivity;
                    euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
                    this.camera.quaternion.setFromEuler(euler);

                    lastLookX = touch.clientX;
                    lastLookY = touch.clientY;
                }
            }
        }, { passive: false });

        const endTouch = (touch) => {
            if (touch.identifier === joystickTouchId) {
                joystickHandle.style.transform = 'translate(0px, 0px)';
                joystickHandle.style.transition = 'transform 0.15s ease';
                this.keys.left = false;
                this.keys.right = false;
                this.keys.forward = false;
                this.keys.backward = false;
                joystickTouchId = null;
            }
            if (touch.identifier === lookTouchId) {
                lookTouchId = null;
            }
        };

        window.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                endTouch(e.changedTouches[i]);
            }
        });

        window.addEventListener('touchcancel', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                endTouch(e.changedTouches[i]);
            }
        });
    }

    initHand(scene) {
        this.handContainer = new THREE.Group();
        this.handContainer.position.set(0.25, -0.2, -0.45);

        const handGeo = new THREE.BoxGeometry(0.08, 0.08, 0.25);
        const handMat = new THREE.MeshLambertMaterial({ color: 0xe0a96d });
        const handMesh = new THREE.Mesh(handGeo, handMat);
        handMesh.position.set(0, 0, 0.05);
        this.handContainer.add(handMesh);

        this.camera.add(this.handContainer);
        scene.add(this.camera);

        this.updateHeldItem('grass', false);
    }

    disposeHeldObject(obj) {
        if (!obj) return;
        obj.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (!child.userData.sharedMaterial && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    }

    updateHeldItem(type, isEnchanted = false) {
        if (!this.handContainer) return;

        if (this.heldItem) {
            this.handContainer.remove(this.heldItem);
            this.disposeHeldObject(this.heldItem);
            this.heldItem = null;
        }

        if (!type) return;

        const glintEmissive = isEnchanted ? new THREE.Color(0x9d4edd) : new THREE.Color(0x000000);
        const glintIntensity = isEnchanted ? 0.55 : 0;

        if (type === 'bow') {
            const group = new THREE.Group();
            const woodMat = new THREE.MeshLambertMaterial({
                color: 0x8b5a2b,
                emissive: glintEmissive,
                emissiveIntensity: glintIntensity
            });
            const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), woodMat);
            group.add(p1);

            const stringMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
            const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.16, 0.005), stringMat);
            s1.position.set(-0.02, 0, -0.01);
            group.add(s1);

            this.heldItem = group;
            this.heldItem.position.set(-0.04, 0.05, -0.05);
            this.heldItem.rotation.set(0, Math.PI / 4, 0);
            this.handContainer.add(this.heldItem);
        } else if (type.startsWith('sword_')) {
            const group = new THREE.Group();
            const matColor = type.includes('diamond')
                ? 0x38bdf8
                : type.includes('iron')
                    ? 0xd4d4d8
                    : type.includes('stone')
                        ? 0x94a3b8
                        : 0xb07d56;
            const bladeMat = new THREE.MeshLambertMaterial({
                color: matColor,
                emissive: glintEmissive,
                emissiveIntensity: glintIntensity
            });
            const hiltMat = new THREE.MeshLambertMaterial({ color: 0x6d4c33 });

            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.19, 0.032), bladeMat);
            blade.position.set(0, 0.08, 0);
            const guard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.018, 0.08), hiltMat);
            guard.position.set(0, -0.015, 0);
            const grip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.06, 0.018), hiltMat);
            grip.position.set(0, -0.05, 0);

            group.add(blade, guard, grip);
            this.heldItem = group;
            this.heldItem.position.set(-0.03, 0.04, -0.07);
            this.heldItem.rotation.set(-0.35, 0.3, 0);
            this.handContainer.add(this.heldItem);
        } else if (type.startsWith('pickaxe_')) {
            const group = new THREE.Group();
            const matColor = type.includes('diamond')
                ? 0x38bdf8
                : type.includes('iron')
                    ? 0xd4d4d8
                    : type.includes('stone')
                        ? 0x94a3b8
                        : 0xb07d56;
            const headMat = new THREE.MeshLambertMaterial({
                color: matColor,
                emissive: glintEmissive,
                emissiveIntensity: glintIntensity
            });
            const stickMat = new THREE.MeshLambertMaterial({ color: 0x784f30 });

            const stick = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.18, 0.016), stickMat);
            stick.position.set(0, 0.04, 0);
            const head = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.03, 0.13), headMat);
            head.position.set(0, 0.12, 0);

            group.add(stick, head);
            this.heldItem = group;
            this.heldItem.position.set(-0.03, 0.02, -0.07);
            this.heldItem.rotation.set(-0.3, 0.35, 0);
            this.handContainer.add(this.heldItem);
        } else if (type === 'stick') {
            const stickMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
            const stick = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.17, 0.016), stickMat);
            this.heldItem = stick;
            this.heldItem.position.set(-0.02, 0.05, -0.06);
            this.heldItem.rotation.set(-0.35, 0.25, 0.2);
            this.handContainer.add(this.heldItem);
        } else if (type === 'lapis') {
            const lapisMat = new THREE.MeshLambertMaterial({ color: 0x2563eb });
            const gem = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.025), lapisMat);
            this.heldItem = gem;
            this.heldItem.position.set(-0.02, 0.04, -0.06);
            this.heldItem.rotation.set(0.2, 0.4, 0.15);
            this.handContainer.add(this.heldItem);
        } else if (type === 'book' || type === 'enchanted_book') {
            const group = new THREE.Group();
            const coverMat = new THREE.MeshLambertMaterial({
                color: type === 'enchanted_book' ? 0x6d28d9 : 0x92400e,
                emissive: type === 'enchanted_book' ? new THREE.Color(0x9d4edd) : new THREE.Color(0x000000),
                emissiveIntensity: type === 'enchanted_book' ? 0.6 : 0
            });
            const pageMat = new THREE.MeshLambertMaterial({ color: 0xfef3c7 });
            const cover = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.024), coverMat);
            const pages = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.082, 0.018), pageMat);
            pages.position.set(0.004, 0, 0);
            group.add(cover, pages);

            this.heldItem = group;
            this.heldItem.position.set(-0.02, 0.04, -0.06);
            this.heldItem.rotation.set(0.25, 0.45, 0.1);
            this.handContainer.add(this.heldItem);
        } else if (type === 'minecart') {
            const mat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.09), mat);
            this.heldItem = mesh;
            this.heldItem.position.set(-0.02, 0.04, -0.06);
            this.heldItem.rotation.set(0.2, 0.4, 0.1);
            this.handContainer.add(this.heldItem);
        } else if (type === 'spawn_irongolem' || type === 'spawn_snowgolem') {
            const eggGroup = new THREE.Group();
            const eggGeo = new THREE.BoxGeometry(0.05, 0.07, 0.05);
            const eggMat = new THREE.MeshLambertMaterial({
                color: type === 'spawn_irongolem' ? 0xdcdcdc : 0xe0e2db
            });
            const eggMesh = new THREE.Mesh(eggGeo, eggMat);
            eggGroup.add(eggMesh);

            const spotGeo = new THREE.BoxGeometry(0.015, 0.015, 0.015);
            const spotMat = new THREE.MeshBasicMaterial({
                color: type === 'spawn_irongolem' ? 0x990000 : 0xff7a00
            });

            const spot1 = new THREE.Mesh(spotGeo, spotMat.clone());
            spot1.position.set(0.015, 0.02, 0.015);
            const spot2 = new THREE.Mesh(spotGeo.clone(), spotMat.clone());
            spot2.position.set(-0.015, -0.01, -0.015);
            eggGroup.add(spot1, spot2);
            spotMat.dispose();

            this.heldItem = eggGroup;
            this.heldItem.position.set(-0.02, 0.04, -0.06);
            this.heldItem.rotation.set(0.2, 0.4, 0.1);
            this.handContainer.add(this.heldItem);
        } else {
            const baseType = normalizeBlockType(type);
            const instMesh = this.world.instancedMeshMap.get(baseType);
            if (instMesh) {
                const heldDims = {
                    rail: [0.09, 0.014, 0.09],
                    pressure_plate: [0.08, 0.018, 0.08],
                    button: [0.05, 0.026, 0.04],
                    lever: [0.06, 0.036, 0.06]
                }[baseType] || [0.08, 0.08, 0.08];
                const geo = new THREE.BoxGeometry(heldDims[0], heldDims[1], heldDims[2]);
                this.heldItem = new THREE.Mesh(geo, instMesh.material);
                this.heldItem.userData.sharedMaterial = true;
                this.heldItem.position.set(-0.02, 0.04, -0.06);
                this.heldItem.rotation.set(0.2, 0.4, 0.1);
                this.handContainer.add(this.heldItem);
            }
        }
    }

    swing() {
        if (this.isSwinging) return;
        this.isSwinging = true;
        this.swingTimer = 0;
    }
}
