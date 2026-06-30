import * as THREE from 'three';
import { sounds } from '../utils/audio.js';
import { PrimedTNT } from './tnt.js';

// Helper to create pixel textures for Mob faces
function createMobFaceTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (type === 'zombie') {
        ctx.fillStyle = '#147a45'; // Zombie green
        ctx.fillRect(0, 0, 8, 8);
        ctx.fillStyle = '#0a2f1d'; // Dark hair top
        ctx.fillRect(0, 0, 8, 2);
        ctx.fillStyle = '#000000'; // Eyes
        ctx.fillRect(1, 3, 2, 1);
        ctx.fillRect(5, 3, 2, 1);
        ctx.fillStyle = '#3c096c'; // Pupil highlight
        ctx.fillRect(2, 3, 1, 1);
        ctx.fillRect(6, 3, 1, 1);
        ctx.fillStyle = '#0a2f1d'; // Mouth
        ctx.fillRect(2, 5, 4, 1);
    } else if (type === 'creeper') {
        ctx.fillStyle = '#2d6a4f'; // Creeper light-green
        ctx.fillRect(0, 0, 8, 8);
        ctx.fillStyle = '#1b4332'; // Random noise spots
        ctx.fillRect(1, 1, 1, 1);
        ctx.fillRect(5, 1, 1, 1);
        ctx.fillRect(2, 6, 1, 1);
        ctx.fillRect(6, 5, 1, 1);
        ctx.fillStyle = '#000000'; // Creeper sad face
        ctx.fillRect(1, 3, 2, 2); // Left Eye
        ctx.fillRect(5, 3, 2, 2); // Right Eye
        ctx.fillRect(3, 4, 2, 2); // Center mouth top
        ctx.fillRect(2, 5, 4, 3); // Mouth lower
    } else if (type === 'skeleton') {
        ctx.fillStyle = '#d3d3d3'; // Bone gray
        ctx.fillRect(0, 0, 8, 8);
        ctx.fillStyle = '#2b2b2b'; // Hollow eye sockets
        ctx.fillRect(1, 3, 2, 2);
        ctx.fillRect(5, 3, 2, 2);
        ctx.fillRect(3, 5, 2, 1); // Nose
        ctx.fillStyle = '#7c7c7c'; // Mouth grate lines
        ctx.fillRect(2, 6, 4, 1);
    } else if (type === 'irongolem') {
        ctx.fillStyle = '#dedede'; // Iron gray
        ctx.fillRect(0, 0, 8, 8);
        
        // Red eyes
        ctx.fillStyle = '#990000';
        ctx.fillRect(1, 4, 1, 1);
        ctx.fillRect(6, 4, 1, 1);
        
        // Darker pupils
        ctx.fillStyle = '#111111';
        ctx.fillRect(2, 4, 1, 1);
        ctx.fillRect(5, 4, 1, 1);
        
        // Vines on face
        ctx.fillStyle = '#2d6a4f';
        ctx.fillRect(0, 0, 8, 1);
        ctx.fillRect(0, 1, 1, 2);
        ctx.fillRect(7, 0, 1, 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
}

export class Mob {
    constructor(type, x, y, z, scene, world, game) {
        this.type = type;
        this.scene = scene;
        this.world = world;
        this.game = game;

        this.hp = 100;
        this.maxHp = 100;

        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.isGrounded = false;
        
        // Physics settings
        this.width = 0.6;
        this.height = 1.8;
        this.gravity = -18.0;
        this.speed = 1.6;

        this.mesh = new THREE.Group();
        this.mesh.position.set(x, y, z);
        
        // AI State
        this.state = 'WANDER'; // WANDER, CHASE, ATTACK
        this.wanderTimer = 0;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.hitRedTimer = 0;

        // Custom materials array to dispose cleanly
        this.materialsToDispose = [];

        this.initMesh();
        this.scene.add(this.mesh);
    }

    initMesh() {
        // Implemented by subclasses
    }

    checkCollisions(pos) {
        const radius = this.width / 2;
        const minX = Math.floor(pos.x - radius);
        const maxX = Math.floor(pos.x + radius);
        const minY = Math.floor(pos.y);
        const maxY = Math.floor(pos.y + this.height);
        const minZ = Math.floor(pos.z - radius);
        const maxZ = Math.floor(pos.z + radius);

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const block = this.world.getBlockAt(x, y, z);
                    // Collide only with solid blocks
                    if (block && !block.startsWith('water') && !block.startsWith('lava')) {
                        const overlapX = (pos.x + radius > x) && (pos.x - radius < x + 1);
                        const overlapY = (pos.y + this.height > y) && (pos.y < y + 1);
                        const overlapZ = (pos.z + radius > z) && (pos.z - radius < z + 1);
                        
                        if (overlapX && overlapY && overlapZ) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.hitRedTimer = 0.25; // Flash red for 250ms
        sounds.playHurtSound();

        // Face player on hit
        const playerPos = this.game.player.position.clone();
        const angle = Math.atan2(playerPos.x - this.position.x, playerPos.z - this.position.z);
        this.mesh.rotation.y = angle;

        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        // Spawn death smoke particles
        this.spawnDeathParticles(this.position.x, this.position.y + 0.8, this.position.z);
        this.scene.remove(this.mesh);
        
        // Dispose materials
        this.materialsToDispose.forEach(mat => mat.dispose());
        
        // Remove from game mobs list
        if (this.game.mobs) {
            const idx = this.game.mobs.indexOf(this);
            if (idx > -1) {
                this.game.mobs.splice(idx, 1);
            }
        }
        
        this.game.showNotification(`${this.type.toUpperCase()} dikalahkan!`);
    }

    spawnDeathParticles(x, y, z) {
        const count = 12;
        const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const particlesList = [];
        
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            
            const speed = 1.0 + Math.random() * 2.0;
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize().multiplyScalar(speed);
            
            this.scene.add(mesh);
            particlesList.push({
                mesh: mesh,
                velocity: velocity,
                life: 0.4 + Math.random() * 0.3,
                elapsed: 0,
                material: mat
            });
        }
        if (!this.game.particles) this.game.particles = [];
        this.game.particles.push(...particlesList);
    }

    update(dt) {
        // 1. Gravity physics
        this.velocity.y += this.gravity * dt;

        // Apply drag if inside water/lava
        let inWater = false;
        let inLava = false;
        const feetBlock = this.world.getBlockAt(this.position.x, this.position.y, this.position.z);
        if (feetBlock) {
            if (feetBlock.startsWith('water')) inWater = true;
            if (feetBlock.startsWith('lava')) inLava = true;
        }

        if (inWater) {
            this.velocity.y += this.gravity * -0.7 * dt; // floaty
            this.velocity.x *= 0.85;
            this.velocity.z *= 0.85;
        } else if (inLava) {
            this.velocity.y += this.gravity * -0.85 * dt; // sink slowly
            this.velocity.x *= 0.6;
            this.velocity.z *= 0.6;
        }

        // 2. AI Brain Decisions
        this.updateAI(dt, inWater || inLava);

        // 3. Move Axis-by-Axis
        const nextPos = this.position.clone();
        
        nextPos.x += this.velocity.x * dt;
        if (this.checkCollisions(nextPos)) {
            // Jump if hits wall and grounded
            if (this.isGrounded && !inWater && !inLava) {
                this.velocity.y = 5.0; // Hop over blocks!
                this.isGrounded = false;
            }
            nextPos.x = this.position.x;
            this.velocity.x = 0;
        }

        nextPos.z += this.velocity.z * dt;
        if (this.checkCollisions(nextPos)) {
            if (this.isGrounded && !inWater && !inLava) {
                this.velocity.y = 5.0;
                this.isGrounded = false;
            }
            nextPos.z = this.position.z;
            this.velocity.z = 0;
        }

        this.isGrounded = false;
        nextPos.y += this.velocity.y * dt;
        if (this.checkCollisions(nextPos)) {
            if (this.velocity.y < 0) {
                nextPos.y = Math.ceil(nextPos.y);
                this.isGrounded = true;
            }
            this.velocity.y = 0;
        }

        // Limit boundaries
        const halfWidth = this.world.width / 2;
        const halfDepth = this.world.depth / 2;
        const buffer = 0.3;
        
        if (nextPos.x < -halfWidth + buffer) nextPos.x = -halfWidth + buffer;
        if (nextPos.x > halfWidth - buffer) nextPos.x = halfWidth - buffer;
        if (nextPos.z < -halfDepth + buffer) nextPos.z = -halfDepth + buffer;
        if (nextPos.z > halfDepth - buffer) nextPos.z = halfDepth - buffer;

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        // Handle hit red flashing
        if (this.hitRedTimer > 0) {
            this.hitRedTimer -= dt;
            this.materialsToDispose.forEach(mat => {
                mat.color.setRGB(1.0, 0.3, 0.3); // turn reddish tint
            });
        } else {
            this.materialsToDispose.forEach(mat => {
                // Restore base colors
                if (mat.name === 'headFace') {
                    mat.color.setHex(0xffffff); // uses face texture maps
                } else if (this.type === 'zombie') {
                    if (mat.name === 'skin') mat.color.setHex(0x147a45);
                    if (mat.name === 'shirt') mat.color.setHex(0x00b4d8);
                    if (mat.name === 'pants') mat.color.setHex(0x3c096c);
                } else if (this.type === 'creeper') {
                    mat.color.setHex(0x2d6a4f);
                } else if (this.type === 'skeleton') {
                    mat.color.setHex(0xd3d3d3);
                } else if (this.type === 'irongolem') {
                    if (mat.name === 'skin' || mat.name === 'iron') mat.color.setHex(0xdedede);
                    if (mat.name === 'nose') mat.color.setHex(0x9a8880);
                    if (mat.name === 'eyes') mat.color.setHex(0x990000);
                    if (mat.name === 'vines') mat.color.setHex(0x2d6a4f);
                    if (mat.name === 'rose') mat.color.setHex(0xd90429);
                }
            });
        }

        // Void out limit respawn
        if (this.position.y < -10) {
            this.die();
        }
    }

    updateAI(dt, isLiquid) {
        // Player tracking
        const playerPos = this.game.player.position.clone();
        const dist = this.position.distanceTo(playerPos);

        // Determine Chase vs Wander
        if (dist < 10.0 && this.state !== 'EXPLODE') {
            this.state = 'CHASE';
        } else if (this.state === 'CHASE') {
            this.state = 'WANDER';
        }

        if (this.state === 'WANDER') {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.0 + Math.random() * 3.0; // recalculate wander every few seconds
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            
            // Move slowly in wander angle
            this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.4);
            this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.4);

            // Rotate mesh towards wander angle
            this.mesh.rotation.y = this.wanderAngle;
        } 
        else if (this.state === 'CHASE') {
            // Chase player direction
            const dirX = playerPos.x - this.position.x;
            const dirZ = playerPos.z - this.position.z;
            const angle = Math.atan2(dirX, dirZ);
            this.mesh.rotation.y = angle;

            // Move speed
            const currentSpeed = isLiquid ? this.speed * 0.4 : this.speed;
            this.velocity.x = Math.sin(angle) * currentSpeed;
            this.velocity.z = Math.cos(angle) * currentSpeed;
            
            // Liquid auto-jump
            if (isLiquid && Math.random() < 0.05) {
                this.velocity.y = 3.5;
            }
        }
    }
}

// 1. ZOMBIE
export class Zombie extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('zombie', x, y, z, scene, world, game);
        this.attackCooldown = 0;
    }

    initMesh() {
        // Voxel materials
        const skinMat = new THREE.MeshLambertMaterial({ color: 0x147a45 });
        const shirtMat = new THREE.MeshLambertMaterial({ color: 0x00b4d8 });
        const pantsMat = new THREE.MeshLambertMaterial({ color: 0x3c096c });
        skinMat.name = 'skin';
        shirtMat.name = 'shirt';
        pantsMat.name = 'pants';
        
        this.materialsToDispose.push(skinMat, shirtMat, pantsMat);

        const faceTex = createMobFaceTexture('zombie');
        const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
        faceMat.name = 'headFace';
        this.materialsToDispose.push(faceMat);

        const faceMats = [
            skinMat, skinMat, skinMat, skinMat, faceMat, skinMat
        ];

        // Voxel parts
        // Head
        const headGeo = new THREE.BoxGeometry(0.48, 0.48, 0.48);
        const head = new THREE.Mesh(headGeo, faceMats);
        head.position.set(0, 1.44, 0);
        head.castShadow = true;
        this.mesh.add(head);

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.45, 0.72, 0.24);
        const body = new THREE.Mesh(bodyGeo, shirtMat);
        body.position.set(0, 0.84, 0);
        body.castShadow = true;
        this.mesh.add(body);

        // Left/Right arms extended forward!
        const armGeo = new THREE.BoxGeometry(0.12, 0.12, 0.48);
        
        const lArm = new THREE.Mesh(armGeo, skinMat);
        lArm.position.set(-0.28, 1.0, 0.18);
        lArm.castShadow = true;
        this.mesh.add(lArm);

        const rArm = new THREE.Mesh(armGeo, skinMat);
        rArm.position.set(0.28, 1.0, 0.18);
        rArm.castShadow = true;
        this.mesh.add(rArm);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.14, 0.48, 0.14);
        
        const lLeg = new THREE.Mesh(legGeo, pantsMat);
        lLeg.position.set(-0.14, 0.24, 0);
        lLeg.castShadow = true;
        this.mesh.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, pantsMat);
        rLeg.position.set(0.14, 0.24, 0);
        rLeg.castShadow = true;
        this.mesh.add(rLeg);
    }

    updateAI(dt, isLiquid) {
        super.updateAI(dt, isLiquid);

        // Attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        // Deal damage if close to player
        if (this.state === 'CHASE') {
            const playerPos = this.game.player.position.clone();
            const playerCenter = playerPos.clone().add(new THREE.Vector3(0, this.game.player.height/2, 0));
            const mobCenter = this.position.clone().add(new THREE.Vector3(0, this.height/2, 0));
            const dist = mobCenter.distanceTo(playerCenter);

            if (dist < 1.35 && this.attackCooldown <= 0) {
                // Attack!
                this.game.player.takeDamage(12); // deals 12 damage
                this.attackCooldown = 1.2; // 1.2s cooldown
                
                // Push player back
                const pushDir = playerPos.sub(this.position).setY(0.2).normalize();
                this.game.player.velocity.addScaledVector(pushDir, 5.0);
            }
        }
    }
}

// 2. CREEPER
export class Creeper extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('creeper', x, y, z, scene, world, game);
        this.fuseTimer = 0;
        this.fuseDuration = 1.5; // 1.5 seconds fuse
        this.speed = 1.8; // slightly faster than zombie
    }

    initMesh() {
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2d6a4f });
        bodyMat.name = 'skin';
        this.materialsToDispose.push(bodyMat);

        const faceTex = createMobFaceTexture('creeper');
        const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
        faceMat.name = 'headFace';
        this.materialsToDispose.push(faceMat);

        const faceMats = [
            bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat
        ];

        // Head
        const headGeo = new THREE.BoxGeometry(0.48, 0.48, 0.48);
        const head = new THREE.Mesh(headGeo, faceMats);
        head.position.set(0, 1.28, 0);
        head.castShadow = true;
        this.mesh.add(head);

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.38, 0.64, 0.22);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(0, 0.72, 0);
        body.castShadow = true;
        this.mesh.add(body);

        // 4 short legs
        const legGeo = new THREE.BoxGeometry(0.12, 0.32, 0.12);
        const legPositions = [
            [-0.14, 0.16, 0.12],  // front left
            [0.14, 0.16, 0.12],   // front right
            [-0.14, 0.16, -0.12], // back left
            [0.14, 0.16, -0.12]   // back right
        ];

        legPositions.forEach(([lx, ly, lz]) => {
            const leg = new THREE.Mesh(legGeo, bodyMat);
            leg.position.set(lx, ly, lz);
            leg.castShadow = true;
            this.mesh.add(leg);
        });
    }

    updateAI(dt, isLiquid) {
        // Override state machine logic to inject self-destruction
        const playerPos = this.game.player.position.clone();
        const dist = this.position.distanceTo(playerPos);

        if (this.state === 'EXPLODE') {
            this.velocity.set(0, this.velocity.y, 0); // Stop moving while charging
            
            // Flashing visual
            const flash = Math.sin(this.fuseTimer * 28) * 0.5 + 0.5 > 0.5;
            this.materialsToDispose.forEach(mat => {
                if (flash) {
                    mat.color.setHex(0xffffff); // flash white
                } else {
                    mat.color.setHex(0xff0000); // flash red
                }
            });

            this.fuseTimer += dt;
            if (this.fuseTimer >= this.fuseDuration) {
                this.explode();
                return;
            }

            // If player runs away, cancel fuse
            if (dist > 3.2) {
                this.state = 'CHASE';
                this.fuseTimer = 0;
                this.materialsToDispose.forEach(mat => mat.color.setHex(0x2d6a4f)); // restore
            }
        } 
        else {
            super.updateAI(dt, isLiquid);
            
            // If very close to player, initiate self-explosion countdown
            if (this.state === 'CHASE' && dist < 1.6) {
                this.state = 'EXPLODE';
                this.fuseTimer = 0;
                sounds.playFuseSound();
            }
        }
    }

    explode() {
        // Destroy mob
        this.scene.remove(this.mesh);
        
        // Spawn actual explosion at Creeper center
        const tnt = new PrimedTNT(this.position.x, this.position.y + 0.5, this.position.z, this.scene, this.world, this.game);
        tnt.fuse = 0.01; // explode instantly
        tnt.velocity.set(0, 0, 0); // static
        
        // Add to game TNT list to trigger immediate explosion
        if (!this.game.tnts) this.game.tnts = [];
        this.game.tnts.push(tnt);

        // Remove from list
        if (this.game.mobs) {
            const idx = this.game.mobs.indexOf(this);
            if (idx > -1) this.game.mobs.splice(idx, 1);
        }
    }
}

// 3. SKELETON
export class Skeleton extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('skeleton', x, y, z, scene, world, game);
        this.shootCooldown = 1.0; // initial prep
        this.speed = 1.4; // wanders slower
    }

    initMesh() {
        const boneMat = new THREE.MeshLambertMaterial({ color: 0xd3d3d3 });
        boneMat.name = 'skin';
        this.materialsToDispose.push(boneMat);

        const faceTex = createMobFaceTexture('skeleton');
        const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
        faceMat.name = 'headFace';
        this.materialsToDispose.push(faceMat);

        const faceMats = [
            boneMat, boneMat, boneMat, boneMat, faceMat, boneMat
        ];

        // Head
        const headGeo = new THREE.BoxGeometry(0.46, 0.46, 0.46);
        const head = new THREE.Mesh(headGeo, faceMats);
        head.position.set(0, 1.44, 0);
        head.castShadow = true;
        this.mesh.add(head);

        // Thin Rib Body
        const bodyGeo = new THREE.BoxGeometry(0.24, 0.72, 0.12);
        const body = new THREE.Mesh(bodyGeo, boneMat);
        body.position.set(0, 0.84, 0);
        body.castShadow = true;
        this.mesh.add(body);

        // Arm bones extended forward holding imaginary bow
        const armGeo = new THREE.BoxGeometry(0.08, 0.08, 0.46);
        
        const lArm = new THREE.Mesh(armGeo, boneMat);
        lArm.position.set(-0.2, 1.0, 0.18);
        lArm.castShadow = true;
        this.mesh.add(lArm);

        const rArm = new THREE.Mesh(armGeo, boneMat);
        rArm.position.set(0.2, 1.0, 0.18);
        rArm.castShadow = true;
        this.mesh.add(rArm);

        // Thin leg bones
        const legGeo = new THREE.BoxGeometry(0.08, 0.48, 0.08);
        
        const lLeg = new THREE.Mesh(legGeo, boneMat);
        lLeg.position.set(-0.1, 0.24, 0);
        lLeg.castShadow = true;
        this.mesh.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, boneMat);
        rLeg.position.set(0.1, 0.24, 0);
        rLeg.castShadow = true;
        this.mesh.add(rLeg);
    }

    updateAI(dt, isLiquid) {
        super.updateAI(dt, isLiquid);

        if (this.shootCooldown > 0) {
            this.shootCooldown -= dt;
        }

        if (this.state === 'CHASE') {
            const playerPos = this.game.player.position.clone();
            const dist = this.position.distanceTo(playerPos);

            // Skeleton stops to shoot when in range
            if (dist < 8.0) {
                // Decelerate horizontal movement
                this.velocity.x *= 0.2;
                this.velocity.z *= 0.2;

                if (this.shootCooldown <= 0) {
                    this.shootArrow();
                    this.shootCooldown = 2.0; // Shoot arrow every 2 seconds
                }
            }
        }
    }

    shootArrow() {
        const playerPos = this.game.player.position.clone();
        // Target player chest
        playerPos.y += this.game.player.height * 0.6;
        
        const startPos = this.position.clone().setY(this.position.y + 1.1); // Arm level
        
        // Spawn arrow projectile
        const arrow = new Arrow(startPos, playerPos, this.scene, this.world, this.game);
        if (!this.game.arrows) this.game.arrows = [];
        this.game.arrows.push(arrow);
    }
}

// Arrow Projectile spawned by Skeletons or Player
export class Arrow {
    constructor(startPos, targetPos, scene, world, game, firedBy = 'mob') {
        this.scene = scene;
        this.world = world;
        this.game = game;
        this.firedBy = firedBy;

        this.position = startPos.clone();
        
        // Compute direction
        const dir = targetPos.clone().sub(startPos).normalize();
        this.velocity = dir.multiplyScalar(firedBy === 'player' ? 22.0 : 15.0); // Travel speed

        this.life = 4.0; // disappear after 4 seconds
        this.isStuck = false;

        // Thin arrow mesh (blocky stick)
        const geo = new THREE.BoxGeometry(0.08, 0.08, 0.35);
        const mat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(this.position);
        
        // Look in motion direction
        this.mesh.lookAt(targetPos);
        this.scene.add(this.mesh);

        // Play shoot audio
        sounds.playClickSound(); // standard snap
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            this.destroy();
            return false;
        }

        if (this.isStuck) {
            return true; // Still stuck, just waiting for timer
        }

        // Apply a tiny bit of gravity drop
        this.velocity.y -= 2.0 * dt;

        const nextPos = this.position.clone().addScaledVector(this.velocity, dt);

        // Check block collision
        const gridX = Math.round(nextPos.x);
        const gridY = Math.round(nextPos.y);
        const gridZ = Math.round(nextPos.z);
        const block = this.world.getBlockAt(gridX, gridY, gridZ);
        
        if (block && !block.startsWith('water') && !block.startsWith('lava')) {
            this.isStuck = true;
            this.position.copy(nextPos);
            this.mesh.position.copy(this.position);
            return true;
        }

        if (this.firedBy === 'mob') {
            // Check player collision
            const playerPos = this.game.player.position.clone();
            const pRadius = this.game.player.width / 2;
            const hitX = nextPos.x >= playerPos.x - pRadius && nextPos.x <= playerPos.x + pRadius;
            const hitZ = nextPos.z >= playerPos.z - pRadius && nextPos.z <= playerPos.z + pRadius;
            const hitY = nextPos.y >= playerPos.y && nextPos.y <= playerPos.y + this.game.player.height;

            if (hitX && hitY && hitZ) {
                // Hit player!
                this.game.player.takeDamage(15); // deal 15 damage
                
                // Push player back
                const pushVec = this.velocity.clone().setY(2.0).normalize();
                this.game.player.velocity.addScaledVector(pushVec, 4.0);

                this.destroy();
                return false;
            }
        } else if (this.firedBy === 'player') {
            // Check mob collision
            if (this.game.mobs) {
                for (let i = this.game.mobs.length - 1; i >= 0; i--) {
                    const mob = this.game.mobs[i];
                    const mobPos = mob.position.clone();
                    const mobWidth = 0.8;
                    const mobHeight = 1.8;
                    const mRadius = mobWidth / 2;
                    const hitX = nextPos.x >= mobPos.x - mRadius && nextPos.x <= mobPos.x + mRadius;
                    const hitZ = nextPos.z >= mobPos.z - mRadius && nextPos.z <= mobPos.z + mRadius;
                    const hitY = nextPos.y >= mobPos.y && nextPos.y <= mobPos.y + mobHeight;

                    if (hitX && hitY && hitZ) {
                        // Hit mob!
                        mob.takeDamage(25); // deal 25 damage
                        
                        // Push mob back
                        const pushVec = this.velocity.clone().setY(2.0).normalize();
                        mob.velocity.addScaledVector(pushVec, 6.0);

                        this.destroy();
                        return false;
                    }
                }
            }
        }

        // Apply position
        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);
        
        // Re-align mesh rotation towards flight velocity
        const targetDir = this.position.clone().add(this.velocity);
        this.mesh.lookAt(targetDir);

        return true;
    }

    destroy() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

// 4. IRON GOLEM
export class IronGolem extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('irongolem', x, y, z, scene, world, game);
        this.hp = 300;
        this.maxHp = 300;
        this.width = 1.0;
        this.height = 2.4;
        this.speed = 1.2; // Majestic, slow-paced walker
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.targetMob = null;
    }

    initMesh() {
        const ironMat = new THREE.MeshLambertMaterial({ color: 0xdedede });
        const roseMat = new THREE.MeshLambertMaterial({ color: 0xd90429 });
        ironMat.name = 'iron';
        roseMat.name = 'rose';
        this.materialsToDispose.push(ironMat, roseMat);

        const faceTex = createMobFaceTexture('irongolem');
        const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
        faceMat.name = 'headFace';
        this.materialsToDispose.push(faceMat);

        const faceMats = [
            ironMat, ironMat, ironMat, ironMat, faceMat, ironMat
        ];

        // Head (dimensions: 0.45 x 0.45 x 0.45)
        const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
        const head = new THREE.Mesh(headGeo, faceMats);
        head.position.set(0, 2.15, 0);
        head.castShadow = true;
        this.mesh.add(head);

        // Nose (thick grey-brown sticking out)
        const noseGeo = new THREE.BoxGeometry(0.08, 0.18, 0.08);
        const noseMat = new THREE.MeshLambertMaterial({ color: 0x9a8880 });
        noseMat.name = 'nose';
        this.materialsToDispose.push(noseMat);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 2.12, 0.25);
        this.mesh.add(nose);

        // Torso (dimensions: 0.8 x 1.0 x 0.45)
        const torsoGeo = new THREE.BoxGeometry(0.8, 1.0, 0.45);
        const torso = new THREE.Mesh(torsoGeo, ironMat);
        torso.position.set(0, 1.35, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        // Little rose on chest
        const flowerGeo = new THREE.BoxGeometry(0.12, 0.12, 0.04);
        const flower = new THREE.Mesh(flowerGeo, roseMat);
        flower.position.set(0.15, 1.5, 0.24);
        this.mesh.add(flower);

        // Arms (0.16 x 1.1 x 0.16)
        // Group for left arm rotation pivot at shoulder (Y = 1.7)
        const lArmGroup = new THREE.Group();
        lArmGroup.position.set(-0.48, 1.7, 0);
        
        const armGeo = new THREE.BoxGeometry(0.16, 1.1, 0.16);
        const lArmMesh = new THREE.Mesh(armGeo, ironMat);
        lArmMesh.position.set(0, -0.5, 0); // pivot at shoulder top
        lArmMesh.castShadow = true;
        lArmGroup.add(lArmMesh);
        this.mesh.add(lArmGroup);
        this.lArm = lArmGroup;

        // Group for right arm rotation pivot
        const rArmGroup = new THREE.Group();
        rArmGroup.position.set(0.48, 1.7, 0);
        
        const rArmMesh = new THREE.Mesh(armGeo, ironMat);
        rArmMesh.position.set(0, -0.5, 0);
        rArmMesh.castShadow = true;
        rArmGroup.add(rArmMesh);
        this.mesh.add(rArmGroup);
        this.rArm = rArmGroup;

        // Legs (0.2 x 0.8 x 0.2)
        const legGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
        
        const lLeg = new THREE.Mesh(legGeo, ironMat);
        lLeg.position.set(-0.2, 0.4, 0);
        lLeg.castShadow = true;
        this.mesh.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, ironMat);
        rLeg.position.set(0.2, 0.4, 0);
        rLeg.castShadow = true;
        this.mesh.add(rLeg);
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackAnimTimer > 0) {
            this.attackAnimTimer -= dt;
            // swing arms upward animation (Minecraft style fling!)
            const progress = this.attackAnimTimer / 0.5; // ranges 1 down to 0
            const angle = -Math.sin(progress * Math.PI) * 1.5;
            this.lArm.rotation.x = angle;
            this.rArm.rotation.x = angle;
        } else {
            this.lArm.rotation.x = 0;
            this.rArm.rotation.x = 0;
        }

        // Find closest hostile mob
        let closestMob = null;
        let minDist = 15.0; // 15 blocks scan radius
        
        if (this.game.mobs) {
            for (let i = 0; i < this.game.mobs.length; i++) {
                const mob = this.game.mobs[i];
                if (mob !== this && (mob.type === 'zombie' || mob.type === 'skeleton' || mob.type === 'creeper')) {
                    const dist = this.position.distanceTo(mob.position);
                    if (dist < minDist) {
                        minDist = dist;
                        closestMob = mob;
                    }
                }
            }
        }

        this.targetMob = closestMob;

        if (this.targetMob) {
            // Chase target mob
            const tPos = this.targetMob.position;
            const dirX = tPos.x - this.position.x;
            const dirZ = tPos.z - this.position.z;
            const angle = Math.atan2(dirX, dirZ);
            this.mesh.rotation.y = angle;

            const currentSpeed = isLiquid ? this.speed * 0.4 : this.speed;
            this.velocity.x = Math.sin(angle) * currentSpeed;
            this.velocity.z = Math.cos(angle) * currentSpeed;

            // Attack if in distance
            const dist = this.position.distanceTo(tPos);
            if (dist < 1.8 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.0;
                this.attackAnimTimer = 0.5; // 500ms swing animation
                
                this.targetMob.takeDamage(40); // high golem punch damage
                
                // Throw mob up and away in the air!
                this.targetMob.velocity.y = 8.0; 
                const pushDir = tPos.clone().sub(this.position).setY(0).normalize();
                this.targetMob.velocity.addScaledVector(pushDir, 4.0);
                
                // Play slam clash sound
                sounds.playClickSound();
            }
        } else {
            // Peacefully wander
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 3.0 + Math.random() * 4.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.4);
            this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.4);
            this.mesh.rotation.y = this.wanderAngle;
        }

        // Jump out of liquid
        if (isLiquid && Math.random() < 0.05) {
            this.velocity.y = 3.5;
        }
    }
}

// 5. SNOW GOLEM
export class SnowGolem extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('snowgolem', x, y, z, scene, world, game);
        this.hp = 150;
        this.maxHp = 150;
        this.width = 0.6;
        this.height = 1.8;
        this.speed = 1.5;
        this.shootCooldown = 0;
        this.targetMob = null;
    }

    initMesh() {
        const snowMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const orangeMat = new THREE.MeshLambertMaterial({ color: 0xff7a00 }); // Pumpkin Orange
        const stickMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b }); // Woody brown
        snowMat.name = 'skin';
        orangeMat.name = 'pumpkin';
        stickMat.name = 'stick';
        this.materialsToDispose.push(snowMat, orangeMat, stickMat);

        // Lower body snowball (0.6 x 0.6 x 0.6)
        const lowerGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const lowerBody = new THREE.Mesh(lowerGeo, snowMat);
        lowerBody.position.set(0, 0.3, 0);
        lowerBody.castShadow = true;
        this.mesh.add(lowerBody);

        // Upper body snowball (0.45 x 0.45 x 0.45)
        const upperGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
        const upperBody = new THREE.Mesh(upperGeo, snowMat);
        upperBody.position.set(0, 0.825, 0);
        upperBody.castShadow = true;
        this.mesh.add(upperBody);

        // Pumpkin Head (0.38 x 0.38 x 0.38)
        const headGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
        const head = new THREE.Mesh(headGeo, orangeMat);
        head.position.set(0, 1.24, 0);
        head.castShadow = true;
        this.mesh.add(head);

        // Left arm stick (pointing outwards)
        const lArmGeo = new THREE.BoxGeometry(0.4, 0.05, 0.05);
        const lArm = new THREE.Mesh(lArmGeo, stickMat);
        lArm.position.set(-0.38, 0.85, 0);
        lArm.rotation.z = -0.2;
        lArm.castShadow = true;
        this.mesh.add(lArm);

        // Right arm stick
        const rArm = new THREE.Mesh(lArmGeo, stickMat);
        rArm.position.set(0.38, 0.85, 0);
        rArm.rotation.z = 0.2;
        rArm.castShadow = true;
        this.mesh.add(rArm);
    }

    updateAI(dt, isLiquid) {
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        // Find closest hostile mob
        let closestMob = null;
        let minDist = 15.0; // 15 blocks scan radius
        
        if (this.game.mobs) {
            for (let i = 0; i < this.game.mobs.length; i++) {
                const mob = this.game.mobs[i];
                if (mob !== this && (mob.type === 'zombie' || mob.type === 'skeleton' || mob.type === 'creeper')) {
                    const dist = this.position.distanceTo(mob.position);
                    if (dist < minDist) {
                        minDist = dist;
                        closestMob = mob;
                    }
                }
            }
        }

        this.targetMob = closestMob;

        if (this.targetMob) {
            // Face target mob
            const tPos = this.targetMob.position;
            const dirX = tPos.x - this.position.x;
            const dirZ = tPos.z - this.position.z;
            const angle = Math.atan2(dirX, dirZ);
            this.mesh.rotation.y = angle;

            // Maintain distance (slowly walk towards or slide away)
            const dist = this.position.distanceTo(tPos);
            if (dist > 3.0) {
                const currentSpeed = isLiquid ? this.speed * 0.4 : this.speed;
                this.velocity.x = Math.sin(angle) * currentSpeed;
                this.velocity.z = Math.cos(angle) * currentSpeed;
            } else {
                this.velocity.x *= 0.5;
                this.velocity.z *= 0.5;
            }

            // Shoot snowballs!
            if (this.shootCooldown <= 0 && dist < 10.0) {
                this.shootCooldown = 1.0; // Shoot snowball every 1 second
                this.shootSnowball();
            }
        } else {
            // Peacefully wander
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 3.0 + Math.random() * 4.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.4);
            this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.4);
            this.mesh.rotation.y = this.wanderAngle;
        }

        // Jump out of liquid
        if (isLiquid && Math.random() < 0.05) {
            this.velocity.y = 3.5;
        }
    }

    shootSnowball() {
        if (!this.targetMob) return;
        const startPos = this.position.clone().setY(this.position.y + 0.85); // Chest level
        const targetPos = this.targetMob.position.clone().setY(this.targetMob.position.y + 0.9);
        
        const snowball = new Snowball(startPos, targetPos, this.scene, this.world, this.game);
        if (!this.game.arrows) this.game.arrows = []; // reuse arrow update loop for projectiles
        this.game.arrows.push(snowball);
    }
}

// Snowball projectile fired by Snow Golem
export class Snowball {
    constructor(startPos, targetPos, scene, world, game) {
        this.scene = scene;
        this.world = world;
        this.game = game;

        this.position = startPos.clone();
        
        // Compute direction
        const dir = targetPos.clone().sub(startPos).normalize();
        this.velocity = dir.multiplyScalar(16.0); // travel speed

        this.life = 3.0; // disappears after 3 seconds
        this.isStuck = false;

        // Round-ish white snowball mesh (small box)
        const geo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(this.position);
        
        this.scene.add(this.mesh);
        sounds.playClickSound(); // light snap sound
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            this.destroy();
            return false;
        }

        if (this.isStuck) return true;

        // Apply slight gravity
        this.velocity.y -= 1.5 * dt;

        const nextPos = this.position.clone().addScaledVector(this.velocity, dt);

        // Check block collision
        const gridX = Math.round(nextPos.x);
        const gridY = Math.round(nextPos.y);
        const gridZ = Math.round(nextPos.z);
        const block = this.world.getBlockAt(gridX, gridY, gridZ);
        
        if (block && !block.startsWith('water') && !block.startsWith('lava')) {
            this.destroy();
            return false; // disappears on block hit!
        }

        // Check hostile mob collision
        if (this.game.mobs) {
            for (let i = this.game.mobs.length - 1; i >= 0; i--) {
                const mob = this.game.mobs[i];
                if (mob.type === 'zombie' || mob.type === 'skeleton' || mob.type === 'creeper') {
                    const mobPos = mob.position.clone();
                    const mobWidth = 0.8;
                    const mobHeight = 1.8;
                    const mRadius = mobWidth / 2;
                    const hitX = nextPos.x >= mobPos.x - mRadius && nextPos.x <= mobPos.x + mRadius;
                    const hitZ = nextPos.z >= mobPos.z - mRadius && nextPos.z <= mobPos.z + mRadius;
                    const hitY = nextPos.y >= mobPos.y && nextPos.y <= mobPos.y + mobHeight;

                    if (hitX && hitY && hitZ) {
                        mob.takeDamage(15); // snowballs deal 15 damage!
                        
                        // Push mob back slightly
                        const pushVec = this.velocity.clone().setY(2.0).normalize();
                        mob.velocity.addScaledVector(pushVec, 3.5);

                        this.destroy();
                        return false;
                    }
                }
            }
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);
        return true;
    }

    destroy() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

// Base class for cute passive animals
export class Animal extends Mob {
    constructor(type, x, y, z, scene, world, game, healAmount) {
        super(type, x, y, z, scene, world, game);
        this.healAmount = healAmount;
        this.speed = 1.0; // gentle slow pace
    }

    updateAI(dt, isLiquid) {
        // Animals only wander peacefully, never chase the player
        this.state = 'WANDER';
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
            this.wanderTimer = 2.5 + Math.random() * 4.0;
            this.wanderAngle = Math.random() * Math.PI * 2;
        }
        
        this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.5);
        this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.5);
        this.mesh.rotation.y = this.wanderAngle;

        // Auto-jump out of water/lava
        if (isLiquid && Math.random() < 0.05) {
            this.velocity.y = 3.0;
        }
    }

    die() {
        // Heal player when killed!
        if (this.game.player) {
            this.game.player.heal(this.healAmount);
            this.game.showNotification(`${this.type.toUpperCase()} dikalahkan! Memulihkan HP +${this.healAmount} ❤️`);
        }
        
        super.die(); // triggers particles, clean remove, and sound
    }
}

// 6. CHICKEN
export class Chicken extends Animal {
    constructor(x, y, z, scene, world, game) {
        super('chicken', x, y, z, scene, world, game, 15); // Heals 15 HP
        this.width = 0.4;
        this.height = 0.6;
    }

    initMesh() {
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const yellowMat = new THREE.MeshLambertMaterial({ color: 0xffb703 }); // beak/feet
        const redMat = new THREE.MeshLambertMaterial({ color: 0xd90429 }); // comb
        whiteMat.name = 'skin';
        yellowMat.name = 'beak';
        redMat.name = 'comb';
        this.materialsToDispose.push(whiteMat, yellowMat, redMat);

        // Body (0.3 x 0.3 x 0.4)
        const bodyGeo = new THREE.BoxGeometry(0.3, 0.3, 0.4);
        const body = new THREE.Mesh(bodyGeo, whiteMat);
        body.position.set(0, 0.25, 0);
        body.castShadow = true;
        this.mesh.add(body);

        // Head (0.18 x 0.22 x 0.18)
        const headGeo = new THREE.BoxGeometry(0.18, 0.22, 0.18);
        const head = new THREE.Mesh(headGeo, whiteMat);
        head.position.set(0, 0.45, 0.1);
        head.castShadow = true;
        this.mesh.add(head);

        // Beak (0.1 x 0.06 x 0.08)
        const beakGeo = new THREE.BoxGeometry(0.1, 0.06, 0.08);
        const beak = new THREE.Mesh(beakGeo, yellowMat);
        beak.position.set(0, 0.43, 0.21);
        this.mesh.add(beak);

        // Red comb under beak (wattle)
        const combGeo = new THREE.BoxGeometry(0.06, 0.08, 0.06);
        const comb = new THREE.Mesh(combGeo, redMat);
        comb.position.set(0, 0.37, 0.14);
        this.mesh.add(comb);

        // Two small legs (0.04 x 0.12 x 0.04)
        const legGeo = new THREE.BoxGeometry(0.04, 0.12, 0.04);
        const lLeg = new THREE.Mesh(legGeo, yellowMat);
        lLeg.position.set(-0.08, 0.06, 0);
        lLeg.castShadow = true;
        this.mesh.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, yellowMat);
        rLeg.position.set(0.08, 0.06, 0);
        rLeg.castShadow = true;
        this.mesh.add(rLeg);
    }
}

// 7. PIG
export class Pig extends Animal {
    constructor(x, y, z, scene, world, game) {
        super('pig', x, y, z, scene, world, game, 25); // Heals 25 HP
        this.width = 0.6;
        this.height = 0.8;
    }

    initMesh() {
        const pinkMat = new THREE.MeshLambertMaterial({ color: 0xffafcc });
        const darkPinkMat = new THREE.MeshLambertMaterial({ color: 0xffc2d1 });
        pinkMat.name = 'skin';
        darkPinkMat.name = 'snout';
        this.materialsToDispose.push(pinkMat, darkPinkMat);

        // Body (0.45 x 0.4 x 0.65)
        const bodyGeo = new THREE.BoxGeometry(0.45, 0.4, 0.65);
        const body = new THREE.Mesh(bodyGeo, pinkMat);
        body.position.set(0, 0.4, 0);
        body.castShadow = true;
        this.mesh.add(body);

        // Head (0.3 x 0.3 x 0.3)
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const head = new THREE.Mesh(headGeo, pinkMat);
        head.position.set(0, 0.55, 0.35);
        head.castShadow = true;
        this.mesh.add(head);

        // Snout snout (0.14 x 0.08 x 0.08)
        const snoutGeo = new THREE.BoxGeometry(0.14, 0.08, 0.08);
        const snout = new THREE.Mesh(snoutGeo, darkPinkMat);
        snout.position.set(0, 0.48, 0.52);
        this.mesh.add(snout);

        // 4 legs (0.12 x 0.22 x 0.12)
        const legGeo = new THREE.BoxGeometry(0.12, 0.22, 0.12);
        const legOffsets = [
            [-0.15, 0.11, 0.2],
            [0.15, 0.11, 0.2],
            [-0.15, 0.11, -0.2],
            [0.15, 0.11, -0.2]
        ];

        legOffsets.forEach(([lx, ly, lz]) => {
            const leg = new THREE.Mesh(legGeo, pinkMat);
            leg.position.set(lx, ly, lz);
            leg.castShadow = true;
            this.mesh.add(leg);
        });
    }
}

// 8. COW
export class Cow extends Animal {
    constructor(x, y, z, scene, world, game) {
        super('cow', x, y, z, scene, world, game, 35); // Heals 35 HP
        this.width = 0.8;
        this.height = 1.2;
    }

    initMesh() {
        const brownMat = new THREE.MeshLambertMaterial({ color: 0x4a3b32 }); // Dark brown base
        const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // horns/spots
        brownMat.name = 'skin';
        whiteMat.name = 'horns';
        this.materialsToDispose.push(brownMat, whiteMat);

        // Large Body (0.6 x 0.6 x 0.9)
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.6, 0.9);
        const body = new THREE.Mesh(bodyGeo, brownMat);
        body.position.set(0, 0.65, 0);
        body.castShadow = true;
        this.mesh.add(body);

        // Head (0.32 x 0.32 x 0.32)
        const headGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
        const head = new THREE.Mesh(headGeo, brownMat);
        head.position.set(0, 0.85, 0.45);
        head.castShadow = true;
        this.mesh.add(head);

        // Snout
        const snoutGeo = new THREE.BoxGeometry(0.18, 0.12, 0.08);
        const pinkMat = new THREE.MeshLambertMaterial({ color: 0xffccd5 });
        pinkMat.name = 'nose';
        this.materialsToDispose.push(pinkMat);
        const snout = new THREE.Mesh(snoutGeo, pinkMat);
        snout.position.set(0, 0.78, 0.62);
        this.mesh.add(snout);

        // Two horns (0.04 x 0.12 x 0.04)
        const hornGeo = new THREE.BoxGeometry(0.04, 0.12, 0.04);
        const lHorn = new THREE.Mesh(hornGeo, whiteMat);
        lHorn.position.set(-0.14, 1.04, 0.42);
        lHorn.rotation.z = -0.15;
        this.mesh.add(lHorn);

        const rHorn = new THREE.Mesh(hornGeo, whiteMat);
        rHorn.position.set(0.14, 1.04, 0.42);
        rHorn.rotation.z = 0.15;
        this.mesh.add(rHorn);

        // 4 legs (0.16 x 0.38 x 0.16)
        const legGeo = new THREE.BoxGeometry(0.16, 0.38, 0.16);
        const legOffsets = [
            [-0.2, 0.19, 0.3],
            [0.2, 0.19, 0.3],
            [-0.2, 0.19, -0.3],
            [0.2, 0.19, -0.3]
        ];

        legOffsets.forEach(([lx, ly, lz]) => {
            const leg = new THREE.Mesh(legGeo, brownMat);
            leg.position.set(lx, ly, lz);
            leg.castShadow = true;
            this.mesh.add(leg);
        });
    }
}
