// Player character, first-person controls and collision detection
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { sounds } from '../utils/audio.js';

export class Player {
    constructor(camera, domElement, world) {
        this.camera = camera;
        this.world = world;
        
        // Initialize Pointer Lock Controls
        this.controls = new PointerLockControls(this.camera, domElement);
        
        // Player Dimensions for collision detection
        this.width = 0.6;
        this.height = 1.8;
        this.eyeHeight = 1.6;

        // Player Position & Physics State
        this.position = new THREE.Vector3(0, 10, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isGrounded = false;
        
        // Health and damage state
        this.health = 100;
        this.maxHealth = 100;
        this.lavaDamageTimer = 0;
        this.magmaDamageTimer = 0;
        this.witherTimer = 0;

        // Tas (Inventory) - 24 slots
        this.inventory = Array(24).fill(null);
        // Default starting items
        this.inventory[0] = { type: 'golden_apple', count: 5 };
        this.inventory[1] = { type: 'chest', count: 4 };
        this.inventory[2] = { type: 'helmet_iron', count: 1 };
        this.inventory[3] = { type: 'chestplate_iron', count: 1 };
        this.inventory[4] = { type: 'coal', count: 8 };
        this.inventory[5] = { type: 'diamond', count: 2 };
        this.inventory[6] = { type: 'boots_iron', count: 1 };

        // Armor slots
        this.armor = {
            helmet: null,
            chestplate: null,
            leggings: null,
            boots: null
        };
        
        // Settings
        this.walkSpeed = 4.5;
        this.jumpStrength = 6.0;
        this.gravity = -18.0;

        // Movement input state
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };

        // Respawn height check
        this.minHeightLimit = -10;

        // First-person hand visual state
        this.handContainer = null;
        this.heldItem = null;
        this.isSwinging = false;
        this.swingTimer = 0;
        this.swingDuration = 0.2; // 200ms swing duration

        this.setupInput();
        
        // Touch Input detection for Mobile
        this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (this.isTouch) {
            this.setupTouchInput(domElement);
        }

        this.respawn();
    }

    respawn() {
        // Find center of the world and set player on top of the terrain (searching down from sky)
        const startX = 0;
        const startZ = 0;
        let topY = 6;
        for (let y = this.world.height - 1; y >= 0; y--) {
            const b = this.world.getBlockAt(startX, y, startZ);
            if (b && !b.startsWith('water') && !b.startsWith('lava')) {
                topY = y + 1;
                break;
            }
        }
        
        this.position.set(startX, topY + 2, startZ);
        this.velocity.set(0, 0, 0);
        this.isGrounded = false;
        this.health = 100;
        this.camera.position.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    }

    setupInput() {
        // Key down
        const onKeyDown = (event) => {
            if (!this.controls.isLocked) return;
            
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
                case 'KeyR':
                    // Press R to respawn if stuck
                    this.respawn();
                    break;
            }
        };

        // Key up
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

    // Check if player bounding box collides with any solid block in the world
    checkCollisions(pos) {
        const radius = this.width / 2;
        
        // Get bounding box range in grid coordinates
        const minX = Math.floor(pos.x - radius);
        const maxX = Math.floor(pos.x + radius);
        const minY = Math.floor(pos.y);
        const maxY = Math.floor(pos.y + this.height);
        const minZ = Math.floor(pos.z - radius);
        const maxZ = Math.floor(pos.z + radius);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const blockType = this.world.getBlockAt(x, y, z);
                    // Collide only with solid blocks (ignore air, water, and lava)
                    if (blockType && !blockType.startsWith('water') && !blockType.startsWith('lava')) {
                        // Check exact overlap
                        const overlapX = (pos.x + radius > x) && (pos.x - radius < x + 1);
                        const overlapY = (pos.y + this.height > y) && (pos.y < y + 1);
                        const overlapZ = (pos.z + radius > z) && (pos.z - radius < z + 1);
                        
                        if (overlapX && overlapY && overlapZ) {
                            return true; // Collision detected
                        }
                    }
                }
            }
        }
        return false;
    }

    update(dt) {
        // Stop movement if overlay is visible
        const overlay = document.getElementById('play-overlay');
        if (overlay && overlay.style.display !== 'none') return;

        // Stop movement if inventory is open
        const invModal = document.getElementById('inventory-modal');
        if (invModal && invModal.style.display !== 'none') return;

        // Allow movement either if pointer is locked OR if we are on a mobile device where pointer lock is skipped
        if (!this.controls.isLocked && !this.isTouch) return;

        // 1. Detect if player is in water or lava
        let inWater = false;
        let inLava = false;
        const gridX = Math.round(this.position.x);
        const feetY = Math.floor(this.position.y);
        const headY = Math.floor(this.position.y + this.eyeHeight);
        const gridZ = Math.round(this.position.z);

        for (let y = feetY; y <= headY; y++) {
            const block = this.world.getBlockAt(gridX, y, gridZ);
            if (block) {
                if (block.startsWith('water')) inWater = true;
                if (block.startsWith('lava')) inLava = true;
            }
        }

        // Apply lava damage over time
        if (inLava) {
            this.lavaDamageTimer += dt;
            if (this.lavaDamageTimer >= 0.5) { // every 500ms
                this.takeDamage(15);
                this.lavaDamageTimer = 0;
            }
        } else {
            this.lavaDamageTimer = 0;
        }

        // Apply magma damage over time if standing on a magma block
        if (this.isGrounded) {
            const blockUnder = this.world.getBlockAt(Math.round(this.position.x), Math.round(this.position.y - 0.5), Math.round(this.position.z));
            if (blockUnder === 'magma') {
                this.magmaDamageTimer += dt;
                if (this.magmaDamageTimer >= 0.5) { // every 500ms
                    this.takeDamage(6); // Magma block deals 6 damage
                    this.magmaDamageTimer = 0;
                    if (this.world && typeof this.world.spawnBlockBreakParticles === 'function') {
                        this.world.spawnBlockBreakParticles(Math.round(this.position.x), Math.round(this.position.y), Math.round(this.position.z), 'magma');
                    }
                }
            } else {
                this.magmaDamageTimer = 0;
            }
        } else {
            this.magmaDamageTimer = 0;
        }

        // Apply Wither Decay damage over time
        if (this.witherTimer > 0) {
            this.witherTimer -= dt;
            if (!this.witherDamageAccumulator) this.witherDamageAccumulator = 0;
            this.witherDamageAccumulator += dt;
            if (this.witherDamageAccumulator >= 0.75) { // every 750ms deal 4 damage
                this.takeDamage(4);
                this.witherDamageAccumulator = 0;
                
                // Dark wither screen flash
                const flash = document.createElement('div');
                flash.style.position = 'fixed';
                flash.style.top = '0';
                flash.style.left = '0';
                flash.style.width = '100vw';
                flash.style.height = '100vh';
                flash.style.background = 'rgba(10, 10, 10, 0.45)';
                flash.style.zIndex = '9999';
                flash.style.pointerEvents = 'none';
                flash.style.transition = 'opacity 0.2s ease-out';
                document.body.appendChild(flash);
                setTimeout(() => {
                    flash.style.opacity = '0';
                    setTimeout(() => {
                        if (flash.parentNode) flash.parentNode.removeChild(flash);
                    }, 200);
                }, 80);
            }
        } else {
            this.witherTimer = 0;
            this.witherDamageAccumulator = 0;
        }

        // 2. Adjust speeds and gravity based on environment
        let currentSpeed = this.walkSpeed;
        let currentGravity = this.gravity;
        
        if (inWater) {
            currentSpeed = 2.0; // Swimming speed
            currentGravity = -3.0; // Floaty water gravity
        } else if (inLava) {
            currentSpeed = 1.2; // Thick lava speed
            currentGravity = -1.8; // Thick lava gravity
        }

        // 3. Calculate horizontal movement directions
        const moveDirection = new THREE.Vector3();
        
        // Forward / backward direction relative to camera
        const camDirection = new THREE.Vector3();
        this.camera.getWorldDirection(camDirection);
        // Project onto XZ plane for horizontal movement
        camDirection.y = 0;
        camDirection.normalize();

        // Left / right direction (cross product of camera look direction and UP vector)
        const camRight = new THREE.Vector3();
        camRight.crossVectors(camDirection, new THREE.Vector3(0, 1, 0)).normalize();

        if (this.keys.forward) moveDirection.add(camDirection);
        if (this.keys.backward) moveDirection.sub(camDirection);
        if (this.keys.right) moveDirection.add(camRight);
        if (this.keys.left) moveDirection.sub(camRight);
        
        moveDirection.normalize();
        
        // 4. Set horizontal velocity
        this.velocity.x = moveDirection.x * currentSpeed;
        this.velocity.z = moveDirection.z * currentSpeed;

        // 5. Apply gravity to vertical velocity
        this.velocity.y += currentGravity * dt;

        // Jump / Swim up logic
        if (this.keys.jump) {
            if (inWater) {
                this.velocity.y = 2.2; // Swim up water
            } else if (inLava) {
                this.velocity.y = 0.9; // Swim up lava slowly
            } else if (this.isGrounded) {
                this.velocity.y = this.jumpStrength; // Normal jump
                this.isGrounded = false;
            }
        }

        // 6. Resolve Collisions (Axis-by-Axis)
        const nextPos = this.position.clone();

        // A. X-Axis Movement and Collision Resolution
        nextPos.x += this.velocity.x * dt;
        if (this.checkCollisions(nextPos)) {
            nextPos.x = this.position.x;
            this.velocity.x = 0;
        }

        // B. Z-Axis Movement and Collision Resolution
        nextPos.z += this.velocity.z * dt;
        if (this.checkCollisions(nextPos)) {
            nextPos.z = this.position.z;
            this.velocity.z = 0;
        }

        // C. Y-Axis (Vertical) Movement and Collision Resolution
        this.isGrounded = false;
        nextPos.y += this.velocity.y * dt;
        
        if (this.checkCollisions(nextPos)) {
            if (this.velocity.y < 0) {
                nextPos.y = Math.ceil(nextPos.y);
                this.isGrounded = true;
            } else if (this.velocity.y > 0) {
                nextPos.y = Math.floor(nextPos.y);
            }
            this.velocity.y = 0;
        }

        // 7. Apply world boundary checks (Invisible Walls)
        const halfWidth = this.world.width / 2;
        const halfDepth = this.world.depth / 2;
        const boundaryBuffer = 0.3;
        
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

        // Apply resolved coordinates to player position
        this.position.copy(nextPos);

        // 8. Respawn player if they fall below the world void
        if (this.position.y < this.minHeightLimit) {
            this.respawn();
            this.showNotification('Kamu terjatuh ke Void!');
        }

        // 9. Update camera position to player eye height
        this.camera.position.set(
            this.position.x, 
            this.position.y + this.eyeHeight, 
            this.position.z
        );

        // 10. Update first-person hand swing animation
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

    getArmorReduction() {
        let reduction = 0;
        if (this.armor) {
            for (const slot in this.armor) {
                const item = this.armor[slot];
                if (item) {
                    if (item.type.includes('diamond')) {
                        if (slot === 'helmet') reduction += 0.15;
                        else if (slot === 'chestplate') reduction += 0.25;
                        else if (slot === 'leggings') reduction += 0.20;
                        else if (slot === 'boots') reduction += 0.10;
                    } else if (item.type.includes('iron')) {
                        if (slot === 'helmet') reduction += 0.10;
                        else if (slot === 'chestplate') reduction += 0.15;
                        else if (slot === 'leggings') reduction += 0.10;
                        else if (slot === 'boots') reduction += 0.05;
                    } else if (item.type.includes('gold')) {
                        if (slot === 'helmet') reduction += 0.07;
                        else if (slot === 'chestplate') reduction += 0.12;
                        else if (slot === 'leggings') reduction += 0.07;
                        else if (slot === 'boots') reduction += 0.04;
                    }
                }
            }
        }
        return reduction;
    }

    takeDamage(amount) {
        if (this.health <= 0) return;
        
        const reduction = this.getArmorReduction();
        const finalDamage = amount * (1 - reduction);
        this.health -= finalDamage;
        if (this.health < 0) this.health = 0;
        
        sounds.playHurtSound();

        // Screen Flash red overlay
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100vw';
        flash.style.height = '100vh';
        flash.style.background = 'rgba(255, 0, 0, 0.28)';
        flash.style.zIndex = '9999';
        flash.style.pointerEvents = 'none';
        flash.style.transition = 'opacity 0.2s ease-out';
        document.body.appendChild(flash);

        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => {
                if (flash.parentNode) flash.parentNode.removeChild(flash);
            }, 200);
        }, 80);

        if (this.health <= 0) {
            this.die();
        }
    }

    heal(amount) {
        if (this.health <= 0) return;
        this.health = Math.min(this.maxHealth, this.health + amount);
        
        // Green healing screen flash for premium aesthetics!
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100vw';
        flash.style.height = '100vh';
        flash.style.background = 'rgba(0, 255, 128, 0.15)';
        flash.style.zIndex = '9999';
        flash.style.pointerEvents = 'none';
        flash.style.transition = 'opacity 0.2s ease-out';
        document.body.appendChild(flash);

        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => {
                if (flash.parentNode) flash.parentNode.removeChild(flash);
            }, 200);
        }, 100);
    }

    die() {
        sounds.playExplosionSound();
        this.showNotification('Kamu gugur! Kembali ke spawn.');
        this.respawn();
    }

    showNotification(message) {
        const toast = document.getElementById('toast-msg');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    }

    setupTouchInput(domElement) {
        document.body.classList.add('is-mobile');

        // Joystick DOM nodes
        const joystickBase = document.getElementById('mobile-joystick-base');
        const joystickHandle = document.getElementById('mobile-joystick-handle');
        const jumpBtn = document.getElementById('mobile-btn-jump');

        if (!joystickBase || !joystickHandle || !jumpBtn) return;

        let joystickTouchId = null;
        let joystickStartX = 0;
        let joystickStartY = 0;
        const maxJoystickDistance = 45; // Max radius in px

        let lookTouchId = null;
        let lastLookX = 0;
        let lastLookY = 0;

        // Jump button listeners
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

        // Window level touch handlers to handle dragging outside element boundaries
        window.addEventListener('touchstart', (e) => {
            // Check if overlay is active. If so, don't capture touch controls yet.
            const overlay = document.getElementById('play-overlay');
            if (overlay && overlay.style.display !== 'none') return;

            // Prevent default zoom/scrolling gestures on canvas touches, but allow buttons/hotbars
            const isInteractive = e.target.closest('button') || 
                                  e.target.closest('.hotbar-slot') || 
                                  e.target.closest('#hotbar-container') ||
                                  e.target.closest('.action-btn');
            if (!isInteractive) {
                e.preventDefault();
            }

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const clientX = touch.clientX;
                const clientY = touch.clientY;

                // Joystick detection: left half of the screen
                if (clientX < window.innerWidth / 2) {
                    if (joystickTouchId === null) {
                        joystickTouchId = touch.identifier;
                        // Center of the joystick base
                        const rect = joystickBase.getBoundingClientRect();
                        joystickStartX = rect.left + rect.width / 2;
                        joystickStartY = rect.top + rect.height / 2;
                    }
                } 
                // Look drag detection: right half of the screen
                else {
                    if (lookTouchId === null) {
                        // Check if tapping on action buttons (don't rotate camera if touching them)
                        const isActionButton = e.target.closest('.mobile-action-btn') || e.target.closest('#actions-panel');
                        if (!isActionButton) {
                            lookTouchId = touch.identifier;
                            lastLookX = clientX;
                            lastLookY = clientY;
                        }
                    }
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            const overlay = document.getElementById('play-overlay');
            if (overlay && overlay.style.display !== 'none') return;

            // Unconditionally block scrolling/zooming gestures while playing, EXCEPT on the scrollable hotbar
            const isHotbar = e.target.closest('#hotbar-container');
            if (!isHotbar) {
                e.preventDefault();
            }

            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];

                // Update Joystick position & inputs
                if (touch.identifier === joystickTouchId) {
                    let dx = touch.clientX - joystickStartX;
                    let dy = touch.clientY - joystickStartY;
                    
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > maxJoystickDistance) {
                        dx = (dx / dist) * maxJoystickDistance;
                        dy = (dy / dist) * maxJoystickDistance;
                    }

                    // Move visual handle
                    joystickHandle.style.transform = `translate(${dx}px, ${dy}px)`;
                    joystickHandle.style.transition = 'none';

                    // Convert to values between -1 and 1
                    const normalizedX = dx / maxJoystickDistance;
                    const normalizedY = dy / maxJoystickDistance;

                    // Map to keys for player update method
                    this.keys.left = normalizedX < -0.25;
                    this.keys.right = normalizedX > 0.25;
                    this.keys.forward = normalizedY < -0.25;
                    this.keys.backward = normalizedY > 0.25;
                }

                // Update Camera Rotation (Look)
                if (touch.identifier === lookTouchId) {
                    const dx = touch.clientX - lastLookX;
                    const dy = touch.clientY - lastLookY;

                    const sensitivity = 0.005;
                    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
                    euler.setFromQuaternion(this.camera.quaternion);

                    euler.y -= dx * sensitivity;
                    euler.x -= dy * sensitivity;

                    // Clamp pitch (look up/down) to avoid flipping
                    euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, euler.x));
                    this.camera.quaternion.setFromEuler(euler);

                    lastLookX = touch.clientX;
                    lastLookY = touch.clientY;
                }
            }
        }, { passive: false });

        const endTouch = (touch) => {
            if (touch.identifier === joystickTouchId) {
                // Reset joystick UI
                joystickHandle.style.transform = 'translate(0px, 0px)';
                joystickHandle.style.transition = 'transform 0.15s ease';
                
                // Clear joystick state
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
        
        this.updateHeldItem('grass');
    }

    updateHeldItem(type) {
        if (!this.handContainer) return;
        
        if (this.heldItem) {
            this.handContainer.remove(this.heldItem);
            if (this.heldItem.geometry) this.heldItem.geometry.dispose();
            // Don't dispose shared material from world instMesh!
            this.heldItem = null;
        }
        
        if (!type) return;
        
        if (type === 'bow') {
            const group = new THREE.Group();
            const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
            const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), woodMat);
            group.add(p1);
            
            const stringMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
            const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.16, 0.005), stringMat);
            s1.position.set(-0.02, 0, -0.01);
            group.add(s1);
            
            this.heldItem = group;
            this.heldItem.position.set(-0.04, 0.05, -0.05);
            this.heldItem.rotation.set(0, Math.PI / 4, 0);
            this.handContainer.add(this.heldItem);
        } else if (type === 'spawn_irongolem' || type === 'spawn_snowgolem') {
            const eggGroup = new THREE.Group();
            
            // Create a small blocky egg (overlapping layers)
            const eggGeo = new THREE.BoxGeometry(0.05, 0.07, 0.05);
            const eggMat = new THREE.MeshLambertMaterial({ 
                color: type === 'spawn_irongolem' ? 0xdcdcdc : 0xe0e2db 
            });
            const eggMesh = new THREE.Mesh(eggGeo, eggMat);
            eggGroup.add(eggMesh);
            
            // Add some spots to the spawn egg
            const spotGeo = new THREE.BoxGeometry(0.015, 0.015, 0.015);
            const spotMat = new THREE.MeshBasicMaterial({ 
                color: type === 'spawn_irongolem' ? 0x990000 : 0xff7a00 
            });
            
            const spot1 = new THREE.Mesh(spotGeo, spotMat);
            spot1.position.set(0.015, 0.02, 0.015);
            eggGroup.add(spot1);
            
            const spot2 = new THREE.Mesh(spotGeo, spotMat);
            spot2.position.set(-0.015, -0.01, -0.015);
            eggGroup.add(spot2);
            
            const spot3 = new THREE.Mesh(spotGeo, spotMat);
            spot3.position.set(0.015, -0.02, -0.01);
            eggGroup.add(spot3);
            
            this.heldItem = eggGroup;
            this.heldItem.position.set(-0.02, 0.04, -0.06);
            this.heldItem.rotation.set(0.2, 0.4, 0.1);
            this.handContainer.add(this.heldItem);
        } else {
            const baseType = type.split('_')[0];
            const instMesh = this.world.instancedMeshMap.get(baseType);
            if (instMesh) {
                const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
                this.heldItem = new THREE.Mesh(geo, instMesh.material);
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
