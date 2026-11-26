import * as THREE from 'three';
import { sounds } from '../utils/audio.js';
import { textures } from '../utils/textures.js';
import { PrimedTNT } from './tnt.js';
import {
    HOSTILE_MOBS,
    SEA_BEACH_START_Z,
    SEA_START_Z,
    isSolidBlock,
    findRailAtCartPos,
    stepMinecartOnRail,
    isPoweredRailActive
} from '../utils/gameData.js';

const mobFaceTextureCache = new Map();
const SHARED_MOB_PARTICLE_GEO = new THREE.BoxGeometry(0.12, 0.12, 0.12);

// Helper to create pixel textures for Mob faces (cached per mob type)
function createMobFaceTexture(type) {
    if (mobFaceTextureCache.has(type)) {
        return mobFaceTextureCache.get(type);
    }
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
    } else if (type === 'bloodgolem') {
        ctx.fillStyle = '#660708'; // Crimson/dark red
        ctx.fillRect(0, 0, 8, 8);
        
        // Glowing red/yellow eyes
        ctx.fillStyle = '#ffb703';
        ctx.fillRect(1, 4, 1, 1);
        ctx.fillRect(6, 4, 1, 1);
        
        // Darker pupils
        ctx.fillStyle = '#ba181b';
        ctx.fillRect(2, 4, 1, 1);
        ctx.fillRect(5, 4, 1, 1);
        
        // Dark veins on face
        ctx.fillStyle = '#0b090a';
        ctx.fillRect(0, 0, 8, 1);
        ctx.fillRect(0, 1, 1, 2);
        ctx.fillRect(7, 0, 1, 3);
    } else if (type === 'witherskeleton') {
        ctx.fillStyle = '#1e1f22'; // Charred dark grey
        ctx.fillRect(0, 0, 8, 8);
        
        // Hollow white glowing eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1, 3, 2, 2);
        ctx.fillRect(5, 3, 2, 2);
        
        // Nose socket
        ctx.fillStyle = '#090a0f';
        ctx.fillRect(3, 5, 2, 1);
        
        // Dark mouth grate
        ctx.fillStyle = '#090a0f';
        ctx.fillRect(2, 6, 4, 1);
    } else if (type === 'mikey') {
        ctx.fillStyle = '#22c55e'; // Bright turtle green
        ctx.fillRect(0, 0, 8, 8);
        ctx.fillStyle = '#16a34a'; // Subtle turtle crown shading
        ctx.fillRect(0, 0, 8, 1);
        ctx.fillRect(0, 7, 8, 1);
        // Wide-set black eyes
        ctx.fillStyle = '#09090b';
        ctx.fillRect(1, 3, 1, 1);
        ctx.fillRect(6, 3, 1, 1);
        // Cheerful open mouth + red tongue
        ctx.fillStyle = '#09090b';
        ctx.fillRect(3, 4, 2, 2);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(4, 5, 1, 1);
    } else if (type === 'jj') {
        ctx.fillStyle = '#fcd5b5'; // Fair skin
        ctx.fillRect(0, 0, 8, 8);
        // Red hoodie top & side trim
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, 8, 1);
        ctx.fillRect(0, 0, 1, 8);
        ctx.fillRect(7, 0, 1, 8);
        // Brown swept hair bangs
        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(1, 1, 6, 2);
        ctx.fillRect(1, 3, 2, 1);
        // Sky-blue eyes with white sclera
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1, 4, 1, 1);
        ctx.fillRect(6, 4, 1, 1);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(2, 4, 1, 1);
        ctx.fillRect(5, 4, 1, 1);
        // Slight warm smile
        ctx.fillStyle = '#b47b5c';
        ctx.fillRect(3, 6, 2, 1);
    } else if (type === 'bananakid') {
        ctx.fillStyle = '#ebe01c'; // Banana yellow face
        ctx.fillRect(0, 0, 8, 8);
        ctx.fillStyle = '#d9ca14'; // Subtle peel shading
        ctx.fillRect(0, 0, 8, 1);
        ctx.fillRect(0, 7, 8, 1);
        // Wide-set black eyes at outer corners
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 4, 1, 1);
        ctx.fillRect(7, 4, 1, 1);
        // Open happy mouth with bright red tongue
        ctx.fillRect(2, 5, 4, 1);
        ctx.fillRect(3, 6, 1, 1);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(4, 6, 2, 1);
    } else if (type === 'carrie') {
        ctx.fillStyle = '#f4f4f5'; // Crisp white fur
        ctx.fillRect(0, 0, 8, 8);
        ctx.fillStyle = '#d4d4d8'; // Subtle top ear corners
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillRect(7, 0, 1, 1);
        ctx.fillStyle = '#e4e4e7'; // Soft cheeks
        ctx.fillRect(1, 4, 1, 1);
        ctx.fillRect(6, 4, 1, 1);
        // Vertical 1x2 black eyes & small black nose/mouth
        ctx.fillStyle = '#09090b';
        ctx.fillRect(2, 3, 1, 2);
        ctx.fillRect(5, 3, 1, 2);
        ctx.fillRect(3, 5, 2, 1);
    } else if (type === 'buu') {
        ctx.fillStyle = '#c69c82'; // Peach skin
        ctx.fillRect(0, 0, 8, 8);
        // Brown hair bangs across top
        ctx.fillStyle = '#543c26';
        ctx.fillRect(0, 0, 8, 2);
        ctx.fillStyle = '#3f2b1a';
        ctx.fillRect(2, 0, 3, 1);
        // Derpy outward-looking eyes (black pupils outside, white sclera inside)
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 2, 1, 1);
        ctx.fillRect(7, 2, 1, 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1, 2, 1, 1);
        ctx.fillRect(6, 2, 1, 1);
        // High open derpy mouth with red tongue
        ctx.fillStyle = '#09090b';
        ctx.fillRect(2, 3, 4, 1);
        ctx.fillRect(3, 4, 1, 2);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(4, 4, 2, 2);
    } else if (type === 'cookie') {
        ctx.fillStyle = '#635042'; // Gingerbread brown
        ctx.fillRect(0, 0, 8, 8);
        ctx.fillStyle = '#7a6454';
        ctx.fillRect(0, 3, 1, 1);
        ctx.fillRect(7, 4, 1, 1);
        ctx.fillRect(3, 0, 2, 1);
        // Goofy 2x2 eyes with cream-white outer highlights
        ctx.fillStyle = '#d6cec6';
        ctx.fillRect(1, 1, 2, 2);
        ctx.fillRect(5, 1, 2, 2);
        ctx.fillStyle = '#27272a';
        ctx.fillRect(2, 2, 1, 1);
        ctx.fillRect(5, 2, 1, 1);
        // Wide red smiling mouth
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(2, 4, 4, 2);
        ctx.fillRect(3, 6, 2, 1);
    } else if (type === 'penduduk') {
        ctx.fillStyle = '#a67758'; // Classic villager tan skin
        ctx.fillRect(0, 0, 8, 8);
        ctx.fillStyle = '#956749';
        ctx.fillRect(1, 1, 2, 1);
        ctx.fillRect(5, 0, 2, 1);
        // Thick dark-brown unibrow
        ctx.fillStyle = '#3d2517';
        ctx.fillRect(1, 3, 6, 1);
        // White sclera & emerald-green eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1, 4, 1, 1);
        ctx.fillRect(6, 4, 1, 1);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(2, 4, 1, 1);
        ctx.fillRect(5, 4, 1, 1);
        // Subtle lower mouth shadow
        ctx.fillStyle = '#7c4e35';
        ctx.fillRect(3, 6, 2, 1);
    } else if (type === 'steve') {
        ctx.fillStyle = '#b58567'; // Classic Steve tan skin
        ctx.fillRect(0, 0, 8, 8);
        // Dark brown hair across top + corner tufts
        ctx.fillStyle = '#432d1c';
        ctx.fillRect(0, 0, 8, 2);
        ctx.fillRect(0, 2, 1, 1);
        ctx.fillRect(7, 2, 1, 1);
        // White sclera & indigo-blue eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1, 4, 1, 1);
        ctx.fillRect(6, 4, 1, 1);
        ctx.fillStyle = '#4338ca';
        ctx.fillRect(2, 4, 1, 1);
        ctx.fillRect(5, 4, 1, 1);
        // Nose & iconic brown beard/mouth
        ctx.fillStyle = '#8f5d42';
        ctx.fillRect(3, 5, 2, 1);
        ctx.fillStyle = '#432d1c';
        ctx.fillRect(2, 6, 4, 2);
        ctx.fillStyle = '#9c684b';
        ctx.fillRect(3, 6, 2, 1);
    } else if (type === 'alex') {
        ctx.fillStyle = '#f8d7be'; // Fair peach skin
        ctx.fillRect(0, 0, 8, 8);
        // Ginger-orange swept hair bangs
        ctx.fillStyle = '#ea7a26';
        ctx.fillRect(0, 0, 8, 2);
        ctx.fillRect(0, 2, 2, 1);
        ctx.fillRect(7, 2, 1, 1);
        // White sclera & emerald-green eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(1, 3, 1, 1);
        ctx.fillRect(6, 3, 1, 1);
        ctx.fillStyle = '#15803d';
        ctx.fillRect(2, 3, 1, 1);
        ctx.fillRect(5, 3, 1, 1);
        // Warm pink mouth
        ctx.fillStyle = '#f472b6';
        ctx.fillRect(3, 5, 2, 1);
    } else if (type === 'optimus') {
        ctx.fillStyle = '#1d4ed8'; // Royal-blue helmet
        ctx.fillRect(0, 0, 8, 8);
        // Central silver helmet crest
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(3, 0, 2, 3);
        // Dark recess & glowing yellow visor eyes
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(1, 3, 6, 2);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(1, 3, 2, 1);
        ctx.fillRect(5, 3, 2, 1);
        // Silver faceplate mask
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(2, 5, 4, 3);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(3, 5, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    mobFaceTextureCache.set(type, texture);
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

    checkCollisions(pos, preferTop = true) {
        return this.world.checkAABB(pos.x, pos.y, pos.z, this.width / 2, this.height, false, preferTop);
    }

    cleanupMesh() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.traverse(child => {
                if (child.isMesh && child.geometry) {
                    child.geometry.dispose();
                }
            });
        }
        this.materialsToDispose.forEach(mat => mat.dispose());
        this.materialsToDispose = [];
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.hitRedTimer = 0.25; // Flash red for 250ms
        sounds.playHurtSound();

        // Face player on hit
        if (this.game.player) {
            const playerPos = this.game.player.position.clone();
            const angle = Math.atan2(playerPos.x - this.position.x, playerPos.z - this.position.z);
            this.mesh.rotation.y = angle;
        }

        if (this.hp <= 0) {
            this.die();
        }
    }

    die() {
        // Spawn death smoke particles
        this.spawnDeathParticles(this.position.x, this.position.y + 0.8, this.position.z);
        this.cleanupMesh();

        // Remove from game mobs list
        if (this.game.mobs) {
            const idx = this.game.mobs.indexOf(this);
            if (idx > -1) {
                this.game.mobs.splice(idx, 1);
            }
        }

        if (typeof this.game.onMobDefeated === 'function') {
            this.game.onMobDefeated(this.type);
        } else {
            this.game.showNotification(`${this.type.toUpperCase()} dikalahkan.`);
        }
    }

    spawnDeathParticles(x, y, z) {
        const count = 12;
        const particlesList = [];

        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const mesh = new THREE.Mesh(SHARED_MOB_PARTICLE_GEO, mat);
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
                material: mat,
                sharedGeo: true
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
        const hitY = this.checkCollisions(nextPos, this.velocity.y <= 0);
        if (hitY) {
            if (this.velocity.y < 0) {
                nextPos.y = hitY.y + 0.5;
                this.isGrounded = true;
            } else if (this.velocity.y > 0) {
                nextPos.y = hitY.y - 0.5 - this.height;
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
                if (mat.userData?.baseHex !== undefined) {
                    mat.color.setHex(mat.userData.baseHex);
                } else if (mat.name === 'headFace') {
                    mat.color.setHex(0xffffff); // uses face texture maps
                } else if (this.type === 'zombie') {
                    if (mat.name === 'skin') mat.color.setHex(0x147a45);
                    if (mat.name === 'shirt') mat.color.setHex(0x00b4d8);
                    if (mat.name === 'pants') mat.color.setHex(0x3c096c);
                } else if (this.type === 'creeper') {
                    mat.color.setHex(0x2d6a4f);
                } else if (this.type === 'skeleton') {
                    mat.color.setHex(0xd3d3d3);
                } else if (this.type === 'irongolem' || this.type === 'giantirongolem') {
                    if (mat.name === 'skin' || mat.name === 'iron') mat.color.setHex(0xdedede);
                    if (mat.name === 'nose') mat.color.setHex(0x9a8880);
                    if (mat.name === 'eyes') mat.color.setHex(0x990000);
                    if (mat.name === 'vines') mat.color.setHex(0x2d6a4f);
                    if (mat.name === 'rose') mat.color.setHex(0xd90429);
                } else if (this.type === 'bloodgolem') {
                    if (mat.name === 'crimson') mat.color.setHex(0x660708);
                    if (mat.name === 'red') mat.color.setHex(0xba181b);
                    if (mat.name === 'dark') mat.color.setHex(0x161a1d);
                } else if (this.type === 'witherskeleton') {
                    mat.color.setHex(0x1e1f22);
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
                this.game.player.takeDamage(12, 'mob', this); // deals 12 damage
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
        // Destroy mob and free GPU resources
        this.cleanupMesh();

        // Spawn actual explosion at Creeper center
        const tnt = new PrimedTNT(this.position.x, this.position.y + 0.5, this.position.z, this.scene, this.world, this.game);
        tnt.fuse = 0.01; // explode instantly
        tnt.velocity.set(0, 0, 0); // static

        if (!this.game.tnts) this.game.tnts = [];
        this.game.tnts.push(tnt);

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

// Arrow / Nuclear Projectile spawned by Skeletons, Bosses, or Player's Senapan Nuklir
export class Arrow {
    constructor(startPos, targetPos, scene, world, game, firedBy = 'mob', options = {}) {
        this.scene = scene;
        this.world = world;
        this.game = game;
        this.firedBy = firedBy;
        this.isNuclear = !!options.isNuclear;
        this.blastRadius = options.blastRadius || 5.5;
        this.damage = options.damage || (firedBy === 'player' ? (this.isNuclear ? 140 : 25) : 15);
        this.knockback = options.knockback || (this.isNuclear ? 12.0 : 6.0);
        this.lifeSteal = options.lifeSteal || 0;
        this.isFire = !!options.isFire;

        this.position = startPos.clone();

        const dir = targetPos.clone().sub(startPos).normalize();
        const speed = options.speed || (firedBy === 'player' ? (this.isNuclear ? 36.0 : 22.0) : 15.0);
        this.velocity = dir.multiplyScalar(speed);

        this.life = 4.0;
        this.isStuck = false;

        if (this.isNuclear) {
            const warhead = new THREE.Group();
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xa3e635 });
            const tipMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
            const finMat = new THREE.MeshBasicMaterial({ color: 0x27272a });

            const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.42), coreMat);
            const tip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.12), tipMat);
            tip.position.set(0, 0, 0.24);
            const fins = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.1), finMat);
            fins.position.set(0, 0, -0.18);
            warhead.add(body, tip, fins);
            this.mesh = warhead;
        } else {
            const geo = new THREE.BoxGeometry(0.08, 0.08, 0.35);
            const mat = new THREE.MeshBasicMaterial({ color: this.isFire ? 0xf97316 : 0xeeeeee });
            this.mesh = new THREE.Mesh(geo, mat);
            sounds.playClickSound();
        }
        this.mesh.position.copy(this.position);
        this.mesh.lookAt(targetPos);
        this.scene.add(this.mesh);
    }

    detonateNuclear(impactPos, directMob = null) {
        sounds.playNuclearBlastSound();

        const blastColors = [0x84cc16, 0xa3e635, 0xfacc15, 0xf97316, 0x3f3f46];
        if (this.game) {
            if (!this.game.particles) this.game.particles = [];
            for (let i = 0; i < 26; i++) {
                const color = blastColors[i % blastColors.length];
                const mat = new THREE.MeshBasicMaterial({ color });
                const mesh = new THREE.Mesh(SHARED_MOB_PARTICLE_GEO, mat);
                mesh.position.copy(impactPos);
                const vel = new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() * 0.9 - 0.15,
                    Math.random() - 0.5
                ).normalize().multiplyScalar(3.5 + Math.random() * 6.5);
                this.scene.add(mesh);
                this.game.particles.push({
                    mesh,
                    velocity: vel,
                    life: 0.45 + Math.random() * 0.4,
                    elapsed: 0,
                    material: mat,
                    sharedGeo: true
                });
            }
        }

        if (!this.game?.mobs) return;

        // Snapshot targets before applying damage so mob.die() splicing never skips entries
        const hits = [];
        for (let i = 0; i < this.game.mobs.length; i++) {
            const mob = this.game.mobs[i];
            if (!mob || mob.type === 'minecart' || mob.isFriendly) continue;
            const mobCenter = mob.position.clone().setY(mob.position.y + (mob.height || 1.8) * 0.5);
            const dist = Math.min(impactPos.distanceTo(mob.position), impactPos.distanceTo(mobCenter));
            if (mob === directMob || dist <= this.blastRadius) {
                const dmg = mob === directMob
                    ? this.damage
                    : Math.max(
                        Math.round(this.damage * 0.45),
                        Math.round(this.damage * (1 - dist / Math.max(1, this.blastRadius)))
                    );
                hits.push({ mob, dmg, mobCenter });
            }
        }

        let hitAny = false;
        for (const { mob, dmg, mobCenter } of hits) {
            mob.takeDamage(dmg);
            hitAny = true;
            if (this.isFire && this.world) {
                this.world.spawnBlockBreakParticles(mob.position.x, mob.position.y + 0.8, mob.position.z, 'lava', 0xf97316);
            }
            const pushDir = mobCenter.clone().sub(impactPos);
            if (pushDir.lengthSq() < 0.001) {
                pushDir.copy(this.velocity);
            }
            pushDir.setY(0.45).normalize();
            mob.velocity.addScaledVector(pushDir, this.knockback);
        }

        if (hitAny && this.lifeSteal > 0 && this.game.player) {
            this.game.player.heal(this.lifeSteal);
        }
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            this.destroy();
            return false;
        }

        if (this.isStuck) {
            return true;
        }

        this.velocity.y -= (this.isNuclear ? 0.6 : 2.0) * dt;
        const nextPos = this.position.clone().addScaledVector(this.velocity, dt);

        if (this.isNuclear && this.game && Math.random() < 0.65) {
            if (!this.game.particles) this.game.particles = [];
            const mat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xa3e635 : 0xfacc15 });
            const p = new THREE.Mesh(SHARED_MOB_PARTICLE_GEO, mat);
            p.position.copy(this.position);
            this.scene.add(p);
            this.game.particles.push({
                mesh: p,
                velocity: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.5 + Math.random(), (Math.random() - 0.5) * 1.2),
                life: 0.25,
                elapsed: 0,
                material: mat,
                sharedGeo: true
            });
        }

        const gridX = Math.round(nextPos.x);
        const gridY = Math.round(nextPos.y);
        const gridZ = Math.round(nextPos.z);
        const block = this.world.getBlockAt(gridX, gridY, gridZ);

        if (isSolidBlock(block)) {
            if (this.isNuclear) {
                this.detonateNuclear(nextPos, null);
                this.destroy();
                return false;
            }
            this.isStuck = true;
            this.position.copy(nextPos);
            this.mesh.position.copy(this.position);
            return true;
        }

        if (this.firedBy === 'mob') {
            if (this.game?.player) {
                const playerPos = this.game.player.position.clone();
                const pRadius = this.game.player.width / 2;
                const hitX = nextPos.x >= playerPos.x - pRadius && nextPos.x <= playerPos.x + pRadius;
                const hitZ = nextPos.z >= playerPos.z - pRadius && nextPos.z <= playerPos.z + pRadius;
                const hitY = nextPos.y >= playerPos.y && nextPos.y <= playerPos.y + this.game.player.height;

                if (hitX && hitY && hitZ) {
                    this.game.player.takeDamage(this.damage);
                    const pushVec = this.velocity.clone().setY(2.0).normalize();
                    this.game.player.velocity.addScaledVector(pushVec, 4.0);
                    this.destroy();
                    return false;
                }
            }
        } else if (this.firedBy === 'player') {
            if (this.game.mobs) {
                for (let i = this.game.mobs.length - 1; i >= 0; i--) {
                    const mob = this.game.mobs[i];
                    if (!mob || mob.type === 'minecart' || mob.isFriendly) continue;
                    const mobPos = mob.position;
                    const mRadius = Math.max(0.4, (mob.width || 0.8) / 2);
                    const mHeight = mob.height || 1.8;
                    const hitX = nextPos.x >= mobPos.x - mRadius && nextPos.x <= mobPos.x + mRadius;
                    const hitZ = nextPos.z >= mobPos.z - mRadius && nextPos.z <= mobPos.z + mRadius;
                    const hitY = nextPos.y >= mobPos.y && nextPos.y <= mobPos.y + mHeight;

                    if (hitX && hitY && hitZ) {
                        if (this.isNuclear) {
                            this.detonateNuclear(nextPos, mob);
                            this.destroy();
                            return false;
                        }
                        mob.takeDamage(this.damage);
                        if (this.lifeSteal > 0 && this.game.player) {
                            this.game.player.heal(this.lifeSteal);
                        }
                        if (this.isFire && this.world) {
                            this.world.spawnBlockBreakParticles(mobPos.x, mobPos.y + 0.8, mobPos.z, 'lava', 0xf97316);
                        }
                        const pushVec = this.velocity.clone().setY(2.0).normalize();
                        mob.velocity.addScaledVector(pushVec, this.knockback);
                        this.destroy();
                        return false;
                    }
                }
            }
        }

        this.position.copy(nextPos);
        this.mesh.position.copy(this.position);

        const targetDir = this.position.clone().add(this.velocity);
        this.mesh.lookAt(targetDir);

        return true;
    }

    destroy() {
        this.scene.remove(this.mesh);
        this.mesh.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
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
                if (mob !== this && HOSTILE_MOBS.has(mob.type)) {
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
                if (mob !== this && HOSTILE_MOBS.has(mob.type)) {
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

// Snowball / ranged friendly projectile fired by Snow Golem and ranged allies
export class Snowball {
    constructor(startPos, targetPos, scene, world, game, options = {}) {
        this.scene = scene;
        this.world = world;
        this.game = game;
        this.damage = options.damage ?? 15;
        const speed = options.speed ?? 16.0;
        const color = options.color ?? 0xffffff;
        const size = options.size ?? 0.15;

        this.position = startPos.clone();

        const dir = targetPos.clone().sub(startPos).normalize();
        this.velocity = dir.multiplyScalar(speed);

        this.life = 3.0;
        this.isStuck = false;

        const geo = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshBasicMaterial({ color });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(this.position);

        this.scene.add(this.mesh);
        sounds.playClickSound();
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
        
        if (isSolidBlock(block)) {
            this.destroy();
            return false;
        }

        // Check hostile mob collision
        if (this.game.mobs) {
            for (let i = this.game.mobs.length - 1; i >= 0; i--) {
                const mob = this.game.mobs[i];
                if (HOSTILE_MOBS.has(mob.type)) {
                    const mobPos = mob.position;
                    const mRadius = Math.max(0.4, (mob.width || 0.8) / 2);
                    const mHeight = mob.height || 1.8;
                    const hitX = nextPos.x >= mobPos.x - mRadius && nextPos.x <= mobPos.x + mRadius;
                    const hitZ = nextPos.z >= mobPos.z - mRadius && nextPos.z <= mobPos.z + mRadius;
                    const hitY = nextPos.y >= mobPos.y && nextPos.y <= mobPos.y + mHeight;

                    if (hitX && hitY && hitZ) {
                        mob.takeDamage(this.damage);
                        
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
        if (this.game.player) {
            this.game.player.heal(this.healAmount);
        }
        this.spawnDeathParticles(this.position.x, this.position.y + 0.5, this.position.z);
        this.cleanupMesh();
        if (this.game.mobs) {
            const idx = this.game.mobs.indexOf(this);
            if (idx > -1) this.game.mobs.splice(idx, 1);
        }
        this.game.showNotification(`${this.type.toUpperCase()} dikalahkan (+${this.healAmount} HP).`);
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

// 7. BLOOD GOLEM (Aggressive crimson monster)
export class BloodGolem extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('bloodgolem', x, y, z, scene, world, game);
        this.hp = 400;
        this.maxHp = 400;
        this.width = 1.2;
        this.height = 2.6;
        this.speed = 1.8;
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.targetMob = null;
    }

    initMesh() {
        const crimsonMat = new THREE.MeshLambertMaterial({ color: 0x660708 });
        const redMat = new THREE.MeshLambertMaterial({ color: 0xba181b });
        const darkMat = new THREE.MeshLambertMaterial({ color: 0x161a1d });
        crimsonMat.name = 'crimson';
        redMat.name = 'red';
        darkMat.name = 'dark';
        this.materialsToDispose.push(crimsonMat, redMat, darkMat);

        const faceTex = createMobFaceTexture('bloodgolem');
        const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
        faceMat.name = 'headFace';
        this.materialsToDispose.push(faceMat);

        const faceMats = [
            crimsonMat, crimsonMat, crimsonMat, crimsonMat, faceMat, crimsonMat
        ];

        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, faceMats);
        head.position.set(0, 2.3, 0);
        head.castShadow = true;
        this.mesh.add(head);

        const noseGeo = new THREE.BoxGeometry(0.08, 0.2, 0.08);
        const nose = new THREE.Mesh(noseGeo, darkMat);
        nose.position.set(0, 2.25, 0.28);
        this.mesh.add(nose);

        const torsoGeo = new THREE.BoxGeometry(0.9, 1.1, 0.5);
        const torso = new THREE.Mesh(torsoGeo, crimsonMat);
        torso.position.set(0, 1.45, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        const heartGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);
        const heart = new THREE.Mesh(heartGeo, redMat);
        heart.position.set(0.18, 1.6, 0.26);
        this.mesh.add(heart);

        const lArmGroup = new THREE.Group();
        lArmGroup.position.set(-0.54, 1.8, 0);
        const armGeo = new THREE.BoxGeometry(0.18, 1.2, 0.18);
        const lArmMesh = new THREE.Mesh(armGeo, crimsonMat);
        lArmMesh.position.set(0, -0.55, 0);
        lArmMesh.castShadow = true;
        lArmGroup.add(lArmMesh);
        this.mesh.add(lArmGroup);
        this.lArm = lArmGroup;

        const rArmGroup = new THREE.Group();
        rArmGroup.position.set(0.54, 1.8, 0);
        const rArmMesh = new THREE.Mesh(armGeo, crimsonMat);
        rArmMesh.position.set(0, -0.55, 0);
        rArmMesh.castShadow = true;
        rArmGroup.add(rArmMesh);
        this.mesh.add(rArmGroup);
        this.rArm = rArmGroup;

        const legGeo = new THREE.BoxGeometry(0.22, 0.9, 0.22);
        const lLeg = new THREE.Mesh(legGeo, darkMat);
        lLeg.position.set(-0.22, 0.45, 0);
        lLeg.castShadow = true;
        this.mesh.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, darkMat);
        rLeg.position.set(0.22, 0.45, 0);
        rLeg.castShadow = true;
        this.mesh.add(rLeg);
    }
    
    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackAnimTimer > 0) {
            this.attackAnimTimer -= dt;
            const progress = this.attackAnimTimer / 0.5;
            const angle = -Math.sin(progress * Math.PI) * 1.5;
            this.lArm.rotation.x = angle;
            this.rArm.rotation.x = angle;
        } else {
            this.lArm.rotation.x = 0;
            this.rArm.rotation.x = 0;
        }

        let target = null;
        let minDist = 18.0;

        const playerPos = this.game.player.position.clone();
        const distToPlayer = this.position.distanceTo(playerPos);
        if (distToPlayer < minDist) {
            minDist = distToPlayer;
            target = { type: 'player', position: playerPos };
        }

        if (this.game.mobs) {
            for (let i = 0; i < this.game.mobs.length; i++) {
                const mob = this.game.mobs[i];
                if (mob !== this && (mob.type === 'irongolem' || mob.type === 'giantirongolem' || mob.type === 'pig' || mob.type === 'cow' || mob.type === 'chicken')) {
                    const dist = this.position.distanceTo(mob.position);
                    if (dist < minDist) {
                        minDist = dist;
                        target = { type: 'mob', mob: mob, position: mob.position.clone() };
                    }
                }
            }
        }

        if (target) {
            const tPos = target.position;
            const dirX = tPos.x - this.position.x;
            const dirZ = tPos.z - this.position.z;
            const angle = Math.atan2(dirX, dirZ);
            this.mesh.rotation.y = angle;

            const currentSpeed = isLiquid ? this.speed * 0.4 : this.speed;
            this.velocity.x = Math.sin(angle) * currentSpeed;
            this.velocity.z = Math.cos(angle) * currentSpeed;

            const dist = this.position.distanceTo(tPos);
            if (dist < 2.0 && this.attackCooldown <= 0) {
                this.attackCooldown = 0.8;
                this.attackAnimTimer = 0.5;
                
                if (target.type === 'player') {
                    this.game.player.takeDamage(30, 'mob', this);
                } else {
                    target.mob.takeDamage(50);
                    target.mob.velocity.y = 8.0;
                    const pushDir = tPos.clone().sub(this.position).setY(0).normalize();
                    target.mob.velocity.addScaledVector(pushDir, 4.0);
                }
                sounds.playHurtSound();
            }
        } else {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.0 + Math.random() * 4.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.4);
            this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.4);
            this.mesh.rotation.y = this.wanderAngle;
        }

        if (isLiquid && Math.random() < 0.05) {
            this.velocity.y = 3.5;
        }
    }
}

// 8. GIANT IRON GOLEM (Friendly protector boss)
export class GiantIronGolem extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('giantirongolem', x, y, z, scene, world, game);
        this.hp = 1000;
        this.maxHp = 1000;
        this.width = 2.5;
        this.height = 6.0;
        this.speed = 0.9;
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

        const headGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
        const head = new THREE.Mesh(headGeo, faceMats);
        head.position.set(0, 5.4, 0);
        head.castShadow = true;
        this.mesh.add(head);

        const noseGeo = new THREE.BoxGeometry(0.2, 0.45, 0.2);
        const noseMat = new THREE.MeshLambertMaterial({ color: 0x9a8880 });
        noseMat.name = 'nose';
        this.materialsToDispose.push(noseMat);
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 5.3, 0.625);
        this.mesh.add(nose);

        const torsoGeo = new THREE.BoxGeometry(2.0, 2.5, 1.1);
        const torso = new THREE.Mesh(torsoGeo, ironMat);
        torso.position.set(0, 3.4, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        const flowerGeo = new THREE.BoxGeometry(0.3, 0.3, 0.1);
        const flower = new THREE.Mesh(flowerGeo, roseMat);
        flower.position.set(0.38, 3.75, 0.6);
        this.mesh.add(flower);

        const lArmGroup = new THREE.Group();
        lArmGroup.position.set(-1.2, 4.25, 0);
        const armGeo = new THREE.BoxGeometry(0.4, 2.75, 0.4);
        const lArmMesh = new THREE.Mesh(armGeo, ironMat);
        lArmMesh.position.set(0, -1.25, 0);
        lArmMesh.castShadow = true;
        lArmGroup.add(lArmMesh);
        this.mesh.add(lArmGroup);
        this.lArm = lArmGroup;

        const rArmGroup = new THREE.Group();
        rArmGroup.position.set(1.2, 4.25, 0);
        const rArmMesh = new THREE.Mesh(armGeo, ironMat);
        rArmMesh.position.set(0, -1.25, 0);
        rArmMesh.castShadow = true;
        rArmGroup.add(rArmMesh);
        this.mesh.add(rArmGroup);
        this.rArm = rArmGroup;

        const legGeo = new THREE.BoxGeometry(0.5, 2.0, 0.5);
        const lLeg = new THREE.Mesh(legGeo, ironMat);
        lLeg.position.set(-0.5, 1.0, 0);
        lLeg.castShadow = true;
        this.mesh.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, ironMat);
        rLeg.position.set(0.5, 1.0, 0);
        rLeg.castShadow = true;
        this.mesh.add(rLeg);
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackAnimTimer > 0) {
            this.attackAnimTimer -= dt;
            const progress = this.attackAnimTimer / 0.6;
            const angle = -Math.sin(progress * Math.PI) * 1.5;
            this.lArm.rotation.x = angle;
            this.rArm.rotation.x = angle;
        } else {
            this.lArm.rotation.x = 0;
            this.rArm.rotation.x = 0;
        }

        let closestMob = null;
        let minDist = 25.0;
        
        if (this.game.mobs) {
            for (let i = 0; i < this.game.mobs.length; i++) {
                const mob = this.game.mobs[i];
                if (mob !== this && HOSTILE_MOBS.has(mob.type)) {
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
            const tPos = this.targetMob.position;
            const dirX = tPos.x - this.position.x;
            const dirZ = tPos.z - this.position.z;
            const angle = Math.atan2(dirX, dirZ);
            this.mesh.rotation.y = angle;

            const currentSpeed = isLiquid ? this.speed * 0.4 : this.speed;
            this.velocity.x = Math.sin(angle) * currentSpeed;
            this.velocity.z = Math.cos(angle) * currentSpeed;

            const dist = this.position.distanceTo(tPos);
            if (dist < 3.2 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.6;
                this.attackAnimTimer = 0.6;
                
                this.targetMob.takeDamage(120);
                
                this.targetMob.velocity.y = 15.0; 
                const pushDir = tPos.clone().sub(this.position).setY(0).normalize();
                this.targetMob.velocity.addScaledVector(pushDir, 7.0);
                
                sounds.playClickSound();
            }
        } else {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 3.0 + Math.random() * 4.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.4);
            this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.4);
            this.mesh.rotation.y = this.wanderAngle;
        }

        if (isLiquid && Math.random() < 0.05) {
            this.velocity.y = 3.5;
        }
    }
}

// 9. WITHER SKELETON (Hostile melee boss skeleton)
export class WitherSkeleton extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('witherskeleton', x, y, z, scene, world, game);
        this.hp = 150;
        this.maxHp = 150;
        this.width = 0.7;
        this.height = 2.4;
        this.speed = 1.8;
        this.attackCooldown = 0;
        this.swingAnimTimer = 0;
    }

    initMesh() {
        const coalMat = new THREE.MeshLambertMaterial({ color: 0x1e1f22 });
        coalMat.name = 'skin';
        this.materialsToDispose.push(coalMat);

        const faceTex = createMobFaceTexture('witherskeleton');
        const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
        faceMat.name = 'headFace';
        this.materialsToDispose.push(faceMat);

        const faceMats = [
            coalMat, coalMat, coalMat, coalMat, faceMat, coalMat
        ];

        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, faceMats);
        head.position.set(0, 2.05, 0);
        head.castShadow = true;
        this.mesh.add(head);

        const bodyGeo = new THREE.BoxGeometry(0.28, 1.0, 0.14);
        const body = new THREE.Mesh(bodyGeo, coalMat);
        body.position.set(0, 1.25, 0);
        body.castShadow = true;
        this.mesh.add(body);

        const armGroup = new THREE.Group();
        armGroup.position.set(0, 1.45, 0);

        const armGeo = new THREE.BoxGeometry(0.08, 0.08, 0.6);
        const lArm = new THREE.Mesh(armGeo, coalMat);
        lArm.position.set(-0.22, 0, 0.25);
        lArm.castShadow = true;
        armGroup.add(lArm);

        const rArm = new THREE.Mesh(armGeo, coalMat);
        rArm.position.set(0.22, 0, 0.25);
        rArm.castShadow = true;
        armGroup.add(rArm);

        const swordGroup = new THREE.Group();
        const bladeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.6);
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        stoneMat.name = 'sword_blade';
        this.materialsToDispose.push(stoneMat);
        const blade = new THREE.Mesh(bladeGeo, stoneMat);
        blade.position.set(0, 0, 0.3);
        swordGroup.add(blade);

        const handleGeo = new THREE.BoxGeometry(0.02, 0.02, 0.15);
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x5c3a21 });
        woodMat.name = 'sword_handle';
        this.materialsToDispose.push(woodMat);
        const handle = new THREE.Mesh(handleGeo, woodMat);
        handle.position.set(0, 0, -0.05);
        swordGroup.add(handle);

        swordGroup.position.set(0.22, -0.02, 0.45);
        armGroup.add(swordGroup);
        this.mesh.add(armGroup);
        this.arms = armGroup;

        const legGeo = new THREE.BoxGeometry(0.08, 0.75, 0.08);
        const lLeg = new THREE.Mesh(legGeo, coalMat);
        lLeg.position.set(-0.12, 0.38, 0);
        lLeg.castShadow = true;
        this.mesh.add(lLeg);

        const rLeg = new THREE.Mesh(legGeo, coalMat);
        rLeg.position.set(0.12, 0.38, 0);
        rLeg.castShadow = true;
        this.mesh.add(rLeg);
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.swingAnimTimer > 0 && this.arms) {
            this.swingAnimTimer -= dt;
            if (this.swingAnimTimer <= 0) {
                this.arms.rotation.x = 0;
            } else {
                const progress = 1.0 - (this.swingAnimTimer / 0.3);
                this.arms.rotation.x = -Math.sin(progress * Math.PI) * 0.8;
            }
        }

        const playerPos = this.game.player.position.clone();
        const dist = this.position.distanceTo(playerPos);

        if (dist < 12.0) {
            this.state = 'CHASE';
        } else {
            this.state = 'WANDER';
        }

        if (this.state === 'WANDER') {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.0 + Math.random() * 3.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.4);
            this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.4);
            this.mesh.rotation.y = this.wanderAngle;
        } else if (this.state === 'CHASE') {
            const dirX = playerPos.x - this.position.x;
            const dirZ = playerPos.z - this.position.z;
            const angle = Math.atan2(dirX, dirZ);
            this.mesh.rotation.y = angle;

            const currentSpeed = isLiquid ? this.speed * 0.4 : this.speed;
            this.velocity.x = Math.sin(angle) * currentSpeed;
            this.velocity.z = Math.cos(angle) * currentSpeed;

            if (dist < 1.8 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.2;
                this.swingAnimTimer = 0.3;

                this.game.player.takeDamage(20, 'mob', this);
                this.game.player.witherTimer = 5.0;
                this.game.showNotification('Terkena efek Wither Decay selama 5 detik.');
            }
        }

        if (isLiquid && Math.random() < 0.05) {
            this.velocity.y = 3.5;
        }
    }
}

export class Minecart extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('minecart', x, y, z, scene, world, game);
        this.width = 0.8;
        this.height = 0.5;
        this.rider = null;
        this.riderInput = null;
        this.cartYaw = 0;
        this.cartPitch = 0;
        this.cartBank = 0;
    }

    initMesh() {
        const bodyGroup = new THREE.Group();
        this.bodyGroup = bodyGroup;
        this.mesh.add(bodyGroup);

        const ironMat = new THREE.MeshLambertMaterial({ color: 0x8b95a5 });
        const rimMat = new THREE.MeshLambertMaterial({ color: 0xb8c2d0 });
        const floorMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
        this.materialsToDispose.push(ironMat, rimMat, floorMat, wheelMat);

        // Floor & darkened inner bottom
        const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.9), floorMat);
        baseMesh.position.set(0, 0.08, 0);
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        bodyGroup.add(baseMesh);

        // Front & back walls + top rims
        const wallGeoFB = new THREE.BoxGeometry(0.76, 0.34, 0.07);
        const rimGeoFB = new THREE.BoxGeometry(0.8, 0.05, 0.09);
        for (const zSign of [1, -1]) {
            const wall = new THREE.Mesh(wallGeoFB, ironMat);
            wall.position.set(0, 0.25, zSign * 0.415);
            wall.castShadow = true;
            wall.receiveShadow = true;
            bodyGroup.add(wall);

            const rim = new THREE.Mesh(rimGeoFB, rimMat);
            rim.position.set(0, 0.44, zSign * 0.415);
            bodyGroup.add(rim);
        }

        // Left & right walls + top rims
        const wallGeoLR = new THREE.BoxGeometry(0.07, 0.34, 0.78);
        const rimGeoLR = new THREE.BoxGeometry(0.09, 0.05, 0.78);
        for (const xSign of [1, -1]) {
            const wall = new THREE.Mesh(wallGeoLR, ironMat);
            wall.position.set(xSign * 0.345, 0.25, 0);
            wall.castShadow = true;
            wall.receiveShadow = true;
            bodyGroup.add(wall);

            const rim = new THREE.Mesh(rimGeoLR, rimMat);
            rim.position.set(xSign * 0.345, 0.44, 0);
            bodyGroup.add(rim);
        }

        // 4 iron wheels beneath the chassis
        this.wheels = [];
        const wheelGeo = new THREE.BoxGeometry(0.08, 0.14, 0.14);
        for (const xPos of [-0.36, 0.36]) {
            for (const zPos of [-0.26, 0.26]) {
                const wheel = new THREE.Mesh(wheelGeo, wheelMat);
                wheel.position.set(xPos, 0.07, zPos);
                wheel.castShadow = true;
                bodyGroup.add(wheel);
                this.wheels.push(wheel);
            }
        }
    }

    pushImpulse(vx, vz) {
        this.velocity.x += vx;
        this.velocity.z += vz;
        const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
        if (horizSpeed > 16.0) {
            const scale = 16.0 / horizSpeed;
            this.velocity.x *= scale;
            this.velocity.z *= scale;
        }
    }

    syncRider() {
        if (!this.rider) return;
        this.rider.position.set(this.position.x, this.position.y + 0.35, this.position.z);
        this.rider.velocity.set(0, 0, 0);
        this.rider.isGrounded = true;
        this.rider.camera.position.set(
            this.position.x,
            this.position.y + 0.35 + this.rider.eyeHeight,
            this.position.z
        );
    }

    dismountRider() {
        if (!this.rider) return;
        const rider = this.rider;
        this.rider = null;
        this.riderInput = null;
        rider.ridingMinecart = null;
        rider.position.set(this.position.x, this.position.y + 1.0, this.position.z);
        rider.velocity.set(0, 0, 0);
        rider.camera.position.set(rider.position.x, rider.position.y + rider.eyeHeight, rider.position.z);
        sounds.playClickSound();
    }

    update(dt) {
        const clampedDt = Math.min(Math.max(dt || 0, 0), 0.05);

        // Unmanned carts respond cleanly when bumped by the player
        const player = this.game && this.game.player;
        if (!this.rider && player && !player.ridingMinecart) {
            const dx = this.position.x - player.position.x;
            const dz = this.position.z - player.position.z;
            const dy = Math.abs(this.position.y - player.position.y);
            const distSq = dx * dx + dz * dz;
            if (dy < 1.1 && distSq < 0.72 * 0.72 && distSq > 1e-4) {
                const dist = Math.sqrt(distSq);
                const pushSpeed = Math.max(4.5, Math.hypot(player.velocity.x, player.velocity.z) * 1.15);
                this.velocity.x = (dx / dist) * pushSpeed;
                this.velocity.z = (dz / dist) * pushSpeed;
            }
        }

        const rail = findRailAtCartPos(this.world.boundGetBlockAt, this.position.x, this.position.y, this.position.z);
        if (rail) {
            const isPowered = rail.base === 'powered_rail'
                ? isPoweredRailActive(this.world.boundGetBlockAt, rail.x, rail.y, rail.z)
                : false;

            const step = stepMinecartOnRail({
                x: this.position.x,
                y: this.position.y,
                z: this.position.z,
                vx: this.velocity.x,
                vz: this.velocity.z,
                yaw: this.cartYaw,
                rail,
                isPowered,
                riderInput: this.rider ? this.riderInput : null,
                getBlockAt: this.world.boundGetBlockAt,
                dt: clampedDt
            });

            this.position.set(step.x, step.y, step.z);
            this.velocity.set(step.vx, 0, step.vz);
            this.cartYaw = step.yaw;
            this.cartPitch = THREE.MathUtils.lerp(this.cartPitch, step.pitch || 0, 0.35);
            this.cartBank = THREE.MathUtils.lerp(this.cartBank, step.bank || 0, 0.25);
            this.isGrounded = true;
            if (step.bounced) {
                sounds.playClickSound();
            }
        } else {
            this.velocity.y += this.gravity * clampedDt;
            const drag = this.isGrounded ? Math.exp(-5.0 * clampedDt) : Math.exp(-1.5 * clampedDt);
            this.velocity.x *= drag;
            this.velocity.z *= drag;
            if (Math.abs(this.velocity.x) < 0.04) this.velocity.x = 0;
            if (Math.abs(this.velocity.z) < 0.04) this.velocity.z = 0;

            const nextPos = this.position.clone();
            nextPos.x += this.velocity.x * clampedDt;
            if (this.checkCollisions(nextPos, false)) {
                nextPos.x = this.position.x;
                this.velocity.x = 0;
            }

            nextPos.z += this.velocity.z * clampedDt;
            if (this.checkCollisions(nextPos, false)) {
                nextPos.z = this.position.z;
                this.velocity.z = 0;
            }

            nextPos.y += this.velocity.y * clampedDt;
            const hitY = this.checkCollisions(nextPos, this.velocity.y <= 0);
            if (hitY) {
                if (this.velocity.y < 0) {
                    nextPos.y = hitY.y + 0.5;
                    this.isGrounded = true;
                } else {
                    nextPos.y = this.position.y;
                }
                this.velocity.y = 0;
            } else {
                this.isGrounded = false;
            }

            this.position.copy(nextPos);
            this.cartPitch = THREE.MathUtils.lerp(this.cartPitch, 0, 0.25);
            this.cartBank = THREE.MathUtils.lerp(this.cartBank, 0, 0.25);
        }

        this.riderInput = null;
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.cartYaw;
        if (this.bodyGroup) {
            this.bodyGroup.rotation.x = this.cartPitch;
            this.bodyGroup.rotation.z = this.cartBank;
        }
        if (this.wheels && this.wheels.length > 0) {
            const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
            const wheelSpin = horizSpeed * clampedDt * 2.5;
            for (const wheel of this.wheels) {
                wheel.rotation.x += wheelSpin;
            }
        }

        if (this.rider) {
            this.syncRider();
        }
    }

    updateAI() {
        // Minecarts do not have AI decisions
    }

    updateFromRider(dt, keys) {
        // Backward compatibility wrapper for callers invoking updateFromRider directly
        const camDir = new THREE.Vector3();
        if (this.game?.player?.camera) {
            this.game.player.camera.getWorldDirection(camDir);
            camDir.y = 0;
            if (camDir.lengthSq() > 1e-6) camDir.normalize();
        } else {
            camDir.set(Math.sin(this.cartYaw), 0, Math.cos(this.cartYaw));
        }
        const drive = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
        this.riderInput = drive !== 0 ? { wishX: camDir.x * drive, wishZ: camDir.z * drive } : null;
        this.update(dt);
    }
}

// 11. TRAIN EATER (Giant fleshy crimson worm-tube boss with eyeball mounds & throat lure)
export class TrainEater extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('traineater', x, y, z, scene, world, game);
        this.hp = 600;
        this.maxHp = 600;
        this.width = 2.2;
        this.height = 2.8;
        this.speed = 3.2;
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.movePhase = 0;
    }

    initMesh() {
        const makeTexMat = (map, extra = {}) => {
            const mat = new THREE.MeshLambertMaterial({ map, ...extra });
            mat.userData.baseHex = 0xffffff;
            this.materialsToDispose.push(mat);
            return mat;
        };
        const makeMat = (hex, extra = {}) => {
            const mat = new THREE.MeshLambertMaterial({ color: hex, ...extra });
            mat.userData.baseHex = hex;
            this.materialsToDispose.push(mat);
            return mat;
        };

        const fleshMat = makeTexMat(textures.trainEaterFlesh);
        const throatMat = makeMat(0x4a0505);
        const scleraMat = makeMat(0xf5e9a6);
        const irisMat = makeMat(0x7f1d1d);
        const pupilMat = makeMat(0x140404);
        const teethMat = makeMat(0xf8f5e6);
        const lureMat = makeMat(0xd96b6b);

        const addEyeball = (parent, x, y, z, scale = 1, sideSign = 1) => {
            const eyeGroup = new THREE.Group();
            eyeGroup.position.set(x, y, z);

            const bulb = new THREE.Mesh(
                new THREE.BoxGeometry(0.28 * scale, 0.42 * scale, 0.36 * scale),
                scleraMat
            );
            eyeGroup.add(bulb);

            const iris = new THREE.Mesh(
                new THREE.BoxGeometry(0.08 * scale, 0.2 * scale, 0.16 * scale),
                irisMat
            );
            iris.position.set(sideSign * 0.12 * scale, 0, 0);
            eyeGroup.add(iris);

            const pupil = new THREE.Mesh(
                new THREE.BoxGeometry(0.1 * scale, 0.1 * scale, 0.08 * scale),
                pupilMat
            );
            pupil.position.set(sideSign * 0.13 * scale, 0, 0);
            eyeGroup.add(pupil);

            parent.add(eyeGroup);
        };

        // Hollow fleshy front mouth rim (top, left, right) + deep crimson throat cavity
        const topLip = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.48, 2.0), fleshMat);
        topLip.position.set(0, 2.55, 0.2);
        topLip.castShadow = true;
        this.mesh.add(topLip);

        for (const xSign of [-1, 1]) {
            const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.48, 2.25, 2.0), fleshMat);
            sideWall.position.set(xSign * 0.98, 1.45, 0.2);
            sideWall.castShadow = true;
            this.mesh.add(sideWall);

            const innerSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 1.65), throatMat);
            innerSide.position.set(xSign * 0.72, 1.45, 0.18);
            this.mesh.add(innerSide);
        }

        const innerTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.65), throatMat);
        innerTop.position.set(0, 2.3, 0.18);
        this.mesh.add(innerTop);

        const throatBack = new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.0, 0.22), throatMat);
        throatBack.position.set(0, 1.45, -0.45);
        this.mesh.add(throatBack);

        const headSleeve = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.38, 1.35, 10), fleshMat);
        headSleeve.rotation.x = Math.PI / 2;
        headSleeve.position.set(0, 1.45, -0.75);
        headSleeve.castShadow = true;
        this.mesh.add(headSleeve);

        // Sharp upper ivory-white teeth
        const toothGeo = new THREE.CylinderGeometry(0.02, 0.12, 0.34, 4);
        for (let i = 0; i < 6; i++) {
            const tx = -0.68 + i * 0.272;
            const upperTooth = new THREE.Mesh(toothGeo, teethMat);
            upperTooth.rotation.x = Math.PI;
            upperTooth.position.set(tx, 2.18, 1.12);
            this.mesh.add(upperTooth);
        }

        // Hinged lower jaw + sharp lower teeth
        this.jawGroup = new THREE.Group();
        this.jawGroup.position.set(0, 0.42, 0.2);
        const bottomLip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.95), fleshMat);
        bottomLip.position.set(0, 0, 0.05);
        bottomLip.castShadow = true;
        this.jawGroup.add(bottomLip);

        const innerBottom = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.6), throatMat);
        innerBottom.position.set(0, 0.21, 0.02);
        this.jawGroup.add(innerBottom);

        for (let i = 0; i < 6; i++) {
            const tx = -0.68 + i * 0.272;
            const lowerTooth = new THREE.Mesh(toothGeo, teethMat);
            lowerTooth.position.set(tx, 0.34, 0.92);
            this.jawGroup.add(lowerTooth);
        }
        this.mesh.add(this.jawGroup);

        // Fleshy humanoid lure figure stretching its arms inside the open red throat
        this.lureFigure = new THREE.Group();
        this.lureFigure.position.set(0, 1.32, 0.55);

        const lureTorso = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.16), lureMat);
        this.lureFigure.add(lureTorso);

        const lureHead = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.24), lureMat);
        lureHead.position.set(0, 0.5, 0.03);
        this.lureFigure.add(lureHead);

        for (const xSign of [-1, 1]) {
            const lureEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), pupilMat);
            lureEye.position.set(xSign * 0.06, 0.52, 0.14);
            this.lureFigure.add(lureEye);

            const lureArm = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.12), lureMat);
            lureArm.position.set(xSign * 0.36, 0.28, -0.02);
            lureArm.rotation.z = xSign * 0.38;
            this.lureFigure.add(lureArm);

            const lureLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.12), lureMat);
            lureLeg.position.set(xSign * 0.08, -0.58, -0.04);
            this.lureFigure.add(lureLeg);
        }
        this.mesh.add(this.lureFigure);

        // Scattered pale-yellow eyeball mounds on head flanks
        addEyeball(this.mesh, -1.16, 1.95, 0.45, 1.25, -1);
        addEyeball(this.mesh, -1.18, 1.15, 0.55, 1.35, -1);
        addEyeball(this.mesh, 1.16, 1.85, 0.5, 1.15, 1);
        addEyeball(this.mesh, 1.18, 1.05, 0.35, 0.9, 1);

        // 4 thick fleshy tubular body segments trailing behind head with scattered yellow eyeballs
        this.tailSegments = [];
        for (let i = 0; i < 4; i++) {
            const seg = new THREE.Group();
            seg.position.set(0, 1.4 - i * 0.04, -1.85 - i * 1.25);
            const radius = 1.24 - i * 0.1;
            const segMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(radius * 0.94, radius, 1.35, 10),
                fleshMat
            );
            segMesh.rotation.x = Math.PI / 2;
            segMesh.castShadow = true;
            seg.add(segMesh);

            const sideA = i % 2 === 0 ? -1 : 1;
            addEyeball(seg, sideA * (radius - 0.04), 0.35, 0.15, 1.05 - i * 0.1, sideA);
            addEyeball(seg, -sideA * (radius - 0.04), -0.25, -0.2, 0.85, -sideA);
            if (i % 2 === 0) {
                addEyeball(seg, sideA * (radius - 0.06), -0.4, 0.35, 0.72, sideA);
            }

            this.mesh.add(seg);
            this.tailSegments.push(seg);
        }
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        const speedMag = Math.hypot(this.velocity.x, this.velocity.z);
        this.movePhase += dt * (2.6 + speedMag * 1.6);

        if (this.attackAnimTimer > 0) {
            this.attackAnimTimer -= dt;
            const chomp = Math.sin((this.attackAnimTimer / 0.5) * Math.PI);
            if (this.jawGroup) this.jawGroup.rotation.x = chomp * 0.68;
        } else if (this.jawGroup) {
            this.jawGroup.rotation.x = Math.max(0, Math.sin(this.movePhase * 0.5) * 0.14);
        }

        if (this.lureFigure) {
            this.lureFigure.rotation.z = Math.sin(this.movePhase * 0.9) * 0.12;
            this.lureFigure.position.y = 1.32 + Math.sin(this.movePhase * 1.3) * 0.06;
        }

        if (this.tailSegments) {
            for (let i = 0; i < this.tailSegments.length; i++) {
                this.tailSegments[i].position.x = Math.sin(this.movePhase - i * 0.85) * 0.24;
                this.tailSegments[i].rotation.y = Math.cos(this.movePhase - i * 0.85) * 0.14;
            }
        }

        let target = null;
        let minDist = 26.0;
        const player = this.game?.player;
        if (player) {
            const distToPlayer = this.position.distanceTo(player.position);
            if (distToPlayer < minDist) {
                minDist = distToPlayer;
                target = { type: 'player', position: player.position.clone() };
            }
        }

        if (this.game?.mobs) {
            for (let i = 0; i < this.game.mobs.length; i++) {
                const mob = this.game.mobs[i];
                if (
                    mob !== this &&
                    (mob.type === 'minecart' ||
                        mob.type === 'irongolem' ||
                        mob.type === 'giantirongolem' ||
                        mob.type === 'pig' ||
                        mob.type === 'cow' ||
                        mob.type === 'chicken')
                ) {
                    const dist = this.position.distanceTo(mob.position);
                    if (dist < minDist) {
                        minDist = dist;
                        target = { type: 'mob', mob, position: mob.position.clone() };
                    }
                }
            }
        }

        if (target && target.position.z < SEA_START_Z) {
            const tPos = target.position;
            const angle = Math.atan2(tPos.x - this.position.x, tPos.z - this.position.z);
            this.mesh.rotation.y = angle;
            const currentSpeed = isLiquid ? this.speed * 0.45 : this.speed;
            this.velocity.x = Math.sin(angle) * currentSpeed;
            this.velocity.z = Math.cos(angle) * currentSpeed;

            const dist = this.position.distanceTo(tPos);
            if (dist < 3.4 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.1;
                this.attackAnimTimer = 0.5;
                sounds.playMonsterRoarSound('train');
                if (target.type === 'player' && player) {
                    player.takeDamage(32, 'mob', this);
                } else if (target.type === 'mob' && target.mob) {
                    if (target.mob.type === 'minecart') {
                        const pushDir = tPos.clone().sub(this.position).setY(0).normalize();
                        target.mob.pushImpulse?.(pushDir.x * 14, pushDir.z * 14);
                        sounds.playSawHitSound?.();
                    } else {
                        target.mob.takeDamage(45);
                        target.mob.velocity.y = 7.5;
                        const pushDir = tPos.clone().sub(this.position).setY(0).normalize();
                        target.mob.velocity.addScaledVector(pushDir, 5.0);
                    }
                }
            }
        } else {
            this.wanderTimer -= dt;
            if (this.position.z >= SEA_START_Z - 1) {
                this.wanderAngle = Math.PI + (Math.random() - 0.5) * 0.8;
                this.wanderTimer = 1.8;
            } else if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.0 + Math.random() * 3.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.5);
            this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.5);
            this.mesh.rotation.y = this.wanderAngle;
        }

        if (isLiquid && Math.random() < 0.08) {
            this.velocity.y = 4.0;
        }
    }
}

// 12. SEA EATER (Colossal grey-green arched-maw ocean leviathan with towering bent limbs)
export class SeaEater extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('seaeater', x, y, z, scene, world, game);
        this.hp = 650;
        this.maxHp = 650;
        this.width = 3.2;
        this.height = 6.5;
        this.speed = 3.0;
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.swimPhase = Math.random() * Math.PI * 2;
    }

    initMesh() {
        const makeTexMat = (map, extra = {}) => {
            const mat = new THREE.MeshLambertMaterial({ map, ...extra });
            mat.userData.baseHex = 0xffffff;
            this.materialsToDispose.push(mat);
            return mat;
        };
        const makeMat = (hex, extra = {}) => {
            const mat = new THREE.MeshLambertMaterial({ color: hex, ...extra });
            mat.userData.baseHex = hex;
            this.materialsToDispose.push(mat);
            return mat;
        };

        const skinMat = makeTexMat(textures.seaEaterSkin);
        const darkSkinMat = makeMat(0x344444);
        const mawMat = makeTexMat(textures.seaEaterMaw);

        // Colossal arched hood & cavernous pitch-black mouth
        for (const xSign of [-1, 1]) {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 5.8, 2.8), skinMat);
            pillar.position.set(xSign * 1.9, 2.9, 0.35);
            pillar.castShadow = true;
            this.mesh.add(pillar);

            const upperArch = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.5, 2.8), skinMat);
            upperArch.position.set(xSign * 1.25, 6.25, 0.35);
            upperArch.rotation.z = xSign * 0.56;
            upperArch.castShadow = true;
            this.mesh.add(upperArch);

            const innerBlackWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.0, 2.2), mawMat);
            innerBlackWall.position.set(xSign * 1.32, 3.2, 0.32);
            this.mesh.add(innerBlackWall);
        }

        const crown = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.15, 2.85), skinMat);
        crown.position.set(0, 7.25, 0.35);
        crown.castShadow = true;
        this.mesh.add(crown);

        const innerCrown = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.35, 2.2), mawMat);
        innerCrown.position.set(0, 6.55, 0.3);
        this.mesh.add(innerCrown);

        const mawBack = new THREE.Mesh(new THREE.BoxGeometry(3.2, 6.8, 0.55), mawMat);
        mawBack.position.set(0, 3.4, -0.75);
        this.mesh.add(mawBack);

        // Subtle dark lower maw ridge that sways when lunging/breathing
        this.jawGroup = new THREE.Group();
        this.jawGroup.position.set(0, 0.5, 0.8);
        const lowerMaw = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.7, 1.3), darkSkinMat);
        lowerMaw.position.set(0, -0.1, 0.35);
        this.jawGroup.add(lowerMaw);
        this.mesh.add(this.jawGroup);

        // Two colossal bent pillar-limbs (asymmetrical tall arches plunging into the ocean)
        const buildBentLimb = (sideSign, upperLen, elbowX, elbowY, lowerLen) => {
            const limb = new THREE.Group();
            limb.position.set(sideSign * 1.9, 3.6, -0.15);

            const upperSeg = new THREE.Mesh(new THREE.BoxGeometry(1.1, upperLen, 1.1), skinMat);
            upperSeg.position.set(elbowX * 0.5, elbowY * 0.5, 0);
            upperSeg.rotation.z = Math.atan2(-elbowX, elbowY);
            upperSeg.castShadow = true;
            limb.add(upperSeg);

            const elbowJoint = new THREE.Mesh(new THREE.BoxGeometry(1.28, 1.28, 1.28), skinMat);
            elbowJoint.position.set(elbowX, elbowY, 0);
            elbowJoint.castShadow = true;
            limb.add(elbowJoint);

            const lowerPillar = new THREE.Mesh(new THREE.BoxGeometry(1.15, lowerLen, 1.15), skinMat);
            lowerPillar.position.set(elbowX + sideSign * 0.18, elbowY - lowerLen * 0.5, 0);
            lowerPillar.castShadow = true;
            limb.add(lowerPillar);

            this.mesh.add(limb);
            return limb;
        };

        this.leftLimb = buildBentLimb(-1, 4.2, -2.5, 2.7, 6.8);
        this.rightLimb = buildBentLimb(1, 5.1, 2.6, 3.8, 7.9);

        // 2 heavy submerged rear body humps trailing behind the hood
        this.tailSegments = [];
        for (let i = 0; i < 2; i++) {
            const seg = new THREE.Group();
            seg.position.set(0, 2.7 - i * 0.9, -2.5 - i * 2.1);
            const segBody = new THREE.Mesh(
                new THREE.BoxGeometry(3.4 - i * 0.8, 3.2 - i * 0.8, 2.5),
                i === 0 ? skinMat : darkSkinMat
            );
            segBody.castShadow = true;
            seg.add(segBody);
            this.mesh.add(seg);
            this.tailSegments.push(seg);
        }
    }

    update(dt) {
        const feetBlock = this.world.getBlockAt(this.position.x, this.position.y, this.position.z);
        const midBlock = this.world.getBlockAt(this.position.x, this.position.y + 1.5, this.position.z);
        const upperBlock = this.world.getBlockAt(this.position.x, this.position.y + 3.0, this.position.z);
        const inWater = Boolean(
            (feetBlock && feetBlock.startsWith('water')) ||
            (midBlock && midBlock.startsWith('water')) ||
            (upperBlock && upperBlock.startsWith('water'))
        );
        this.gravity = inWater ? 0 : -25.0;
        super.update(dt);
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        this.swimPhase += dt * (isLiquid ? 3.2 : 1.6);

        if (this.attackAnimTimer > 0) {
            this.attackAnimTimer -= dt;
            const snap = Math.sin((this.attackAnimTimer / 0.5) * Math.PI);
            if (this.jawGroup) this.jawGroup.rotation.x = snap * 0.45;
        } else if (this.jawGroup) {
            this.jawGroup.rotation.x = Math.max(0, Math.sin(this.swimPhase * 0.6) * 0.12);
        }

        if (this.leftLimb && this.rightLimb) {
            this.leftLimb.rotation.x = Math.sin(this.swimPhase) * 0.16;
            this.rightLimb.rotation.x = -Math.sin(this.swimPhase) * 0.16;
        }

        if (this.tailSegments) {
            for (let i = 0; i < this.tailSegments.length; i++) {
                this.tailSegments[i].position.x = Math.sin(this.swimPhase - i * 0.9) * 0.28;
                this.tailSegments[i].rotation.y = Math.cos(this.swimPhase - i * 0.9) * 0.14;
            }
        }

        let target = null;
        let minDist = 32.0;
        const player = this.game?.player;
        if (player) {
            const pBlock = this.world.getBlockAt(player.position.x, player.position.y, player.position.z);
            const playerNearSea = player.position.z >= SEA_BEACH_START_Z - 1 || (pBlock && pBlock.startsWith('water'));
            const distToPlayer = this.position.distanceTo(player.position);
            if (playerNearSea && distToPlayer < minDist) {
                minDist = distToPlayer;
                target = { type: 'player', position: player.position.clone() };
            }
        }

        if (this.game?.mobs) {
            for (let i = 0; i < this.game.mobs.length; i++) {
                const mob = this.game.mobs[i];
                if (
                    mob !== this &&
                    (mob.type === 'irongolem' ||
                        mob.type === 'giantirongolem' ||
                        mob.type === 'pig' ||
                        mob.type === 'cow' ||
                        mob.type === 'chicken')
                ) {
                    const mBlock = this.world.getBlockAt(mob.position.x, mob.position.y, mob.position.z);
                    const mobNearSea = mob.position.z >= SEA_BEACH_START_Z - 1 || (mBlock && mBlock.startsWith('water'));
                    const dist = this.position.distanceTo(mob.position);
                    if (mobNearSea && dist < minDist) {
                        minDist = dist;
                        target = { type: 'mob', mob, position: mob.position.clone() };
                    }
                }
            }
        }

        const activeSpeed = isLiquid ? this.speed : this.speed * 0.45;
        if (target) {
            const tPos = target.position;
            const angle = Math.atan2(tPos.x - this.position.x, tPos.z - this.position.z);
            this.mesh.rotation.y = angle;
            this.velocity.x = Math.sin(angle) * activeSpeed;
            this.velocity.z = Math.cos(angle) * activeSpeed;

            if (isLiquid) {
                const targetDepthY = 2.6;
                this.velocity.y = THREE.MathUtils.clamp((targetDepthY - this.position.y) * 2.2, -2.5, 2.5);
                if (Math.random() < 0.2 && this.game?.particles) {
                    const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
                    const pMesh = new THREE.Mesh(SHARED_MOB_PARTICLE_GEO, mat);
                    pMesh.position.set(
                        this.position.x + (Math.random() - 0.5) * 3.0,
                        6.4,
                        this.position.z + (Math.random() - 0.5) * 2.0
                    );
                    this.scene.add(pMesh);
                    this.game.particles.push({
                        mesh: pMesh,
                        velocity: new THREE.Vector3((Math.random() - 0.5) * 2.5, 3.0, (Math.random() - 0.5) * 2.5),
                        life: 0.45,
                        elapsed: 0,
                        material: mat,
                        sharedGeo: true
                    });
                }
            }

            const horizDist = Math.hypot(tPos.x - this.position.x, tPos.z - this.position.z);
            if (horizDist < 4.5 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.1;
                this.attackAnimTimer = 0.5;
                sounds.playMonsterRoarSound('sea');
                if (target.type === 'player' && player) {
                    player.takeDamage(34, 'mob', this);
                } else if (target.type === 'mob' && target.mob) {
                    target.mob.takeDamage(50);
                    target.mob.velocity.y = 7.0;
                    const pushDir = tPos.clone().sub(this.position).setY(0).normalize();
                    target.mob.velocity.addScaledVector(pushDir, 4.5);
                }
            }
        } else {
            this.wanderTimer -= dt;
            if (this.position.z < SEA_START_Z + 3) {
                this.wanderAngle = (Math.random() - 0.5) * 0.9;
                this.wanderTimer = 1.6;
            } else if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.2 + Math.random() * 3.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (activeSpeed * 0.55);
            this.velocity.z = Math.cos(this.wanderAngle) * (activeSpeed * 0.55);
            this.mesh.rotation.y = this.wanderAngle;

            if (isLiquid) {
                const patrolY = 2.6 + Math.sin(this.swimPhase * 0.35) * 0.25;
                this.velocity.y = THREE.MathUtils.clamp((patrolY - this.position.y) * 2.0, -2.0, 2.0);
            }
        }
    }
}

// ==========================================
// SHARED HELPERS FOR SPECIAL CHARACTERS
// ==========================================

const UP_AXIS = new THREE.Vector3(0, 1, 0);

function createTrackedColorMat(mob, hex, basic = false) {
    const mat = basic
        ? new THREE.MeshBasicMaterial({ color: hex })
        : new THREE.MeshLambertMaterial({ color: hex });
    mat.userData.baseHex = hex;
    mob.materialsToDispose.push(mat);
    return mat;
}

function createTrackedTexMat(mob, map, basic = false) {
    const mat = basic
        ? new THREE.MeshBasicMaterial({ map })
        : new THREE.MeshLambertMaterial({ map });
    mat.userData.baseHex = 0xffffff;
    mob.materialsToDispose.push(mat);
    return mat;
}

function createOrientedLimbSegment(start, end, thickness, mat) {
    const dir = end.clone().sub(start);
    const len = Math.max(0.05, dir.length());
    const seg = new THREE.Mesh(new THREE.BoxGeometry(thickness, len, thickness), mat);
    seg.position.copy(start).addScaledVector(dir, 0.5);
    seg.quaternion.setFromUnitVectors(UP_AXIS, dir.normalize());
    seg.castShadow = true;
    return seg;
}

function buildSpiderLegGroup(hipPos, kneePos, footPos, thickness, upperMat, lowerMat, jointMat) {
    const leg = new THREE.Group();
    leg.position.copy(hipPos);
    const zero = new THREE.Vector3(0, 0, 0);
    leg.add(createOrientedLimbSegment(zero, kneePos, thickness, upperMat));
    const joint = new THREE.Mesh(
        new THREE.BoxGeometry(thickness * 1.35, thickness * 1.35, thickness * 1.35),
        jointMat
    );
    joint.position.copy(kneePos);
    leg.add(joint);
    leg.add(createOrientedLimbSegment(kneePos, footPos, thickness * 0.82, lowerMat));
    return leg;
}

function spawnMobBurstParticle(mob, colorHex, x, y, z, vx, vy, vz, life = 0.5) {
    if (!mob.game?.particles) return;
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    const pMesh = new THREE.Mesh(SHARED_MOB_PARTICLE_GEO, mat);
    pMesh.position.set(x, y, z);
    mob.scene.add(pMesh);
    mob.game.particles.push({
        mesh: pMesh,
        velocity: new THREE.Vector3(vx, vy, vz),
        life,
        elapsed: 0,
        material: mat,
        sharedGeo: true
    });
}

function findNearestBossTarget(mob, maxDist, opts = {}) {
    const {
        landOnly = false,
        seaOnly = false,
        includeMinecarts = false
    } = opts;
    let target = null;
    let minDist = maxDist;

    const isAllowedPos = (pos) => {
        if (landOnly) return pos.z < SEA_START_Z;
        if (seaOnly) {
            const blk = mob.world.getBlockAt(pos.x, pos.y, pos.z);
            return pos.z >= SEA_BEACH_START_Z - 1 || Boolean(blk && blk.startsWith('water'));
        }
        return true;
    };

    const player = mob.game?.player;
    if (player && isAllowedPos(player.position)) {
        const distToPlayer = mob.position.distanceTo(player.position);
        if (distToPlayer < minDist) {
            minDist = distToPlayer;
            target = { type: 'player', position: player.position.clone() };
        }
    }

    const mobs = mob.game?.mobs;
    if (mobs) {
        for (let i = 0; i < mobs.length; i++) {
            const other = mobs[i];
            if (!other || other === mob) continue;
            const isPrey =
                (includeMinecarts && other.type === 'minecart') ||
                other.type === 'irongolem' ||
                other.type === 'giantirongolem' ||
                other.type === 'pig' ||
                other.type === 'cow' ||
                other.type === 'chicken';
            if (!isPrey || !isAllowedPos(other.position)) continue;
            const dist = mob.position.distanceTo(other.position);
            if (dist < minDist) {
                minDist = dist;
                target = { type: 'mob', mob: other, position: other.position.clone() };
            }
        }
    }

    return { target, minDist };
}

function applyBossMeleeHit(mob, target, playerDamage, mobDamage, pushY = 7.5, pushXZ = 5.0) {
    if (target.type === 'player' && mob.game?.player) {
        mob.game.player.takeDamage(playerDamage, 'mob', mob);
    } else if (target.type === 'mob' && target.mob) {
        if (target.mob.type === 'minecart') {
            const pushDir = target.position.clone().sub(mob.position).setY(0).normalize();
            target.mob.pushImpulse?.(pushDir.x * 14, pushDir.z * 14);
            sounds.playSawHitSound?.();
        } else {
            target.mob.takeDamage(mobDamage);
            target.mob.velocity.y = pushY;
            const pushDir = target.position.clone().sub(mob.position).setY(0).normalize();
            target.mob.velocity.addScaledVector(pushDir, pushXZ);
        }
    }
}

function stepFlyingBossAI(mob, dt, cfg) {
    if (mob.attackCooldown > 0) mob.attackCooldown -= dt;
    if (mob.shootCooldown > 0) mob.shootCooldown -= dt;
    if (mob.attackAnimTimer > 0) mob.attackAnimTimer -= dt;
    mob.hoverPhase += dt * cfg.hoverFreq;
    mob.diveCycle += dt;

    const { target } = findNearestBossTarget(mob, 38.0);
    if (target) {
        const tPos = target.position;
        const dx = tPos.x - mob.position.x;
        const dz = tPos.z - mob.position.z;
        const angle = Math.atan2(dx, dz);
        mob.mesh.rotation.y = angle;

        // Alternate between aerial bombardment and swooping dives
        const diving = (mob.diveCycle % cfg.divePeriod) > (cfg.divePeriod - cfg.diveWindow);
        const desiredY = diving
            ? Math.max(8.0, tPos.y + cfg.diveClearance)
            : cfg.cruiseY + Math.sin(mob.hoverPhase) * 1.1;

        const horizDist = Math.hypot(dx, dz);
        const moveScale = diving ? 1.25 : (horizDist > 7.5 ? 1.0 : 0.45);
        mob.velocity.x = Math.sin(angle) * mob.speed * moveScale;
        mob.velocity.z = Math.cos(angle) * mob.speed * moveScale;
        mob.velocity.y = THREE.MathUtils.clamp((desiredY - mob.position.y) * 2.4, -5.0, 5.0);

        if (cfg.bankRoll) {
            mob.mesh.rotation.z = Math.sin(mob.hoverPhase * 0.7) * 0.14;
        }

        if (mob.game?.player && mob.game?.arrows && mob.shootCooldown <= 0 && horizDist < 34.0) {
            mob.shootCooldown = cfg.shootInterval;
            const launchPos = mob.position.clone().add(
                new THREE.Vector3(Math.sin(angle) * 2.4, cfg.muzzleY, Math.cos(angle) * 2.4)
            );
            const aimPos = tPos.clone().add(new THREE.Vector3(0, 1.0, 0));
            const bolt = new Arrow(launchPos, aimPos, mob.scene, mob.world, mob.game, 'mob', {
                damage: cfg.rangedDamage,
                speed: cfg.projectileSpeed,
                isFire: cfg.fireProjectiles
            });
            mob.game.arrows.push(bolt);
            sounds.playMonsterRoarSound(cfg.roarVariant);
        }

        if (horizDist < cfg.meleeRange && Math.abs(mob.position.y - tPos.y) < cfg.meleeVertRange && mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.25;
            mob.attackAnimTimer = 0.5;
            sounds.playMonsterRoarSound(cfg.roarVariant);
            applyBossMeleeHit(mob, target, cfg.meleePlayerDamage, cfg.meleeMobDamage, 7.0, 5.5);
        }

        if (Math.random() < cfg.particleChance) {
            spawnMobBurstParticle(
                mob,
                cfg.particleColor,
                mob.position.x + (Math.random() - 0.5) * 2.6,
                mob.position.y + 1.2 + Math.random() * 1.8,
                mob.position.z + (Math.random() - 0.5) * 2.6,
                (Math.random() - 0.5) * 1.8,
                -0.8 - Math.random() * 1.2,
                (Math.random() - 0.5) * 1.8,
                0.55
            );
        }
    } else {
        mob.wanderTimer -= dt;
        const limit = Math.min(mob.world.width, mob.world.depth) / 2 - 8;
        if (Math.abs(mob.position.x) > limit || Math.abs(mob.position.z) > limit) {
            mob.wanderAngle = Math.atan2(-mob.position.x, -mob.position.z);
            mob.wanderTimer = 2.0;
        } else if (mob.wanderTimer <= 0) {
            mob.wanderTimer = 2.5 + Math.random() * 2.5;
            mob.wanderAngle = Math.random() * Math.PI * 2;
        }
        mob.velocity.x = Math.sin(mob.wanderAngle) * (mob.speed * 0.65);
        mob.velocity.z = Math.cos(mob.wanderAngle) * (mob.speed * 0.65);
        const patrolY = cfg.cruiseY + Math.sin(mob.hoverPhase) * 0.9;
        mob.velocity.y = THREE.MathUtils.clamp((patrolY - mob.position.y) * 2.0, -3.0, 3.0);
        mob.mesh.rotation.y = mob.wanderAngle;
        if (cfg.bankRoll) {
            mob.mesh.rotation.z = Math.sin(mob.hoverPhase * 0.6) * 0.08;
        }
    }

    // Hard sky floor/ceiling clamp so aerial bosses stay overhead
    if (mob.position.y < 8.5 && mob.velocity.y < 0) {
        mob.velocity.y = 2.2;
    } else if (mob.position.y > 20.0 && mob.velocity.y > 0) {
        mob.velocity.y = -2.0;
    }
}

// 13. CHARLES (Crimson Spider-Train Nightmare Boss with 8 articulated spider legs)
export class Charles extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('charles', x, y, z, scene, world, game);
        this.hp = 620;
        this.maxHp = 620;
        this.width = 2.2;
        this.height = 2.8;
        this.speed = 3.6;
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.walkPhase = 0;
    }

    initMesh() {
        const redMetalMat = createTrackedTexMat(this, textures.charlesRedMetal);
        const faceMat = createTrackedTexMat(this, textures.charlesFace);
        const blackMat = createTrackedColorMat(this, 0x111114);
        const rustLegMat = createTrackedColorMat(this, 0x451a1a);
        const jointMat = createTrackedColorMat(this, 0x27272a);
        const metalMat = createTrackedColorMat(this, 0x71717a);
        const glowWhiteMat = createTrackedColorMat(this, 0xffffff, true);
        const teethMat = createTrackedColorMat(this, 0xf8fafc);
        const crimsonGlassMat = createTrackedColorMat(this, 0xdc2626);

        // Locomotive under-chassis & red front cowcatcher beam
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.42, 3.1), blackMat);
        chassis.position.set(0, 0.85, -0.05);
        chassis.castShadow = true;
        this.mesh.add(chassis);

        const frontDeck = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.36, 0.72), redMetalMat);
        frontDeck.position.set(0, 0.88, 1.32);
        frontDeck.castShadow = true;
        this.mesh.add(frontDeck);

        // Twin conical front buffers + glowing front headlamp
        const bufferGeo = new THREE.CylinderGeometry(0.05, 0.22, 0.32, 8);
        for (const xSign of [-1, 1]) {
            const buf = new THREE.Mesh(bufferGeo, metalMat);
            buf.rotation.x = Math.PI / 2;
            buf.position.set(xSign * 0.68, 0.86, 1.75);
            this.mesh.add(buf);
        }
        const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.3, 10), redMetalMat);
        lampHousing.rotation.x = Math.PI / 2;
        lampHousing.position.set(0, 0.94, 1.66);
        this.mesh.add(lampHousing);
        const lampLens = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 10), glowWhiteMat);
        lampLens.rotation.x = Math.PI / 2;
        lampLens.position.set(0, 0.94, 1.82);
        this.mesh.add(lampLens);

        // Boiler barrel & tall smokestack
        const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 1.75, 12), blackMat);
        boiler.rotation.x = Math.PI / 2;
        boiler.position.set(0, 1.75, 0.42);
        boiler.castShadow = true;
        this.mesh.add(boiler);

        const boilerStripe = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.28, 1.6), redMetalMat);
        boilerStripe.position.set(0, 1.5, 0.42);
        this.mesh.add(boilerStripe);

        const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.95, 10), redMetalMat);
        chimney.position.set(0, 2.75, 0.78);
        chimney.castShadow = true;
        this.mesh.add(chimney);

        const chimneyRim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.14, 10), blackMat);
        chimneyRim.position.set(0, 3.22, 0.78);
        this.mesh.add(chimneyRim);

        // Rear crimson cab with red window, dark curved roof & twin exhaust pipes
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.5, 1.35), redMetalMat);
        cab.position.set(0, 1.8, -0.95);
        cab.castShadow = true;
        this.mesh.add(cab);

        const cabWindow = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.62, 0.08), crimsonGlassMat);
        cabWindow.position.set(0, 2.08, -0.26);
        this.mesh.add(cabWindow);

        const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 1.6), blackMat);
        cabRoof.position.set(0, 2.6, -0.95);
        cabRoof.castShadow = true;
        this.mesh.add(cabRoof);

        for (const xSign of [-1, 1]) {
            const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.05, 6), metalMat);
            pipe.position.set(xSign * 1.15, 2.45, -1.35);
            pipe.rotation.z = -xSign * 0.25;
            this.mesh.add(pipe);
        }

        // Nightmare pale face on front boiler + hinged lower toothy jaw
        const faceMats = [blackMat, blackMat, blackMat, blackMat, faceMat, blackMat];
        const facePlate = new THREE.Mesh(new THREE.BoxGeometry(1.56, 1.56, 0.2), faceMats);
        facePlate.position.set(0, 1.75, 1.32);
        this.mesh.add(facePlate);

        this.jawGroup = new THREE.Group();
        this.jawGroup.position.set(0, 1.18, 1.28);
        const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.24, 0.34), redMetalMat);
        lowerJaw.position.set(0, -0.08, 0.08);
        this.jawGroup.add(lowerJaw);

        const toothGeo = new THREE.CylinderGeometry(0.02, 0.075, 0.24, 4);
        for (let i = 0; i < 5; i++) {
            const tooth = new THREE.Mesh(toothGeo, teethMat);
            tooth.position.set(-0.42 + i * 0.21, 0.12, 0.2);
            this.jawGroup.add(tooth);
        }
        this.mesh.add(this.jawGroup);

        // 8 splayed spider legs (4 per side) reaching down to y = 0
        this.spiderLegs = [];
        const zOffsets = [1.05, 0.35, -0.35, -1.05];
        for (const zPos of zOffsets) {
            for (const sideSign of [-1, 1]) {
                const hip = new THREE.Vector3(sideSign * 0.92, 0.92, zPos);
                const knee = new THREE.Vector3(sideSign * 1.38, 1.08, zPos * 0.22);
                const foot = new THREE.Vector3(sideSign * 2.15, -0.92, zPos * 0.45);
                const leg = buildSpiderLegGroup(hip, knee, foot, 0.18, rustLegMat, rustLegMat, jointMat);
                leg.userData.sideSign = sideSign;
                leg.userData.phaseOffset = zPos * 1.4 + (sideSign > 0 ? Math.PI : 0);
                this.mesh.add(leg);
                this.spiderLegs.push(leg);
            }
        }
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        const speedMag = Math.hypot(this.velocity.x, this.velocity.z);
        this.walkPhase += dt * (4.2 + speedMag * 2.2);

        if (this.attackAnimTimer > 0) {
            this.attackAnimTimer -= dt;
            const chomp = Math.sin((this.attackAnimTimer / 0.45) * Math.PI);
            if (this.jawGroup) this.jawGroup.rotation.x = chomp * 0.65;
        } else if (this.jawGroup) {
            this.jawGroup.rotation.x = Math.max(0, Math.sin(this.walkPhase * 0.4) * 0.15);
        }

        if (this.spiderLegs) {
            const amp = speedMag > 0.2 ? 0.28 : 0.08;
            for (let i = 0; i < this.spiderLegs.length; i++) {
                const leg = this.spiderLegs[i];
                const swing = Math.sin(this.walkPhase + leg.userData.phaseOffset);
                leg.rotation.y = swing * amp;
                leg.rotation.z = Math.cos(this.walkPhase + leg.userData.phaseOffset) * (amp * 0.45);
            }
        }

        const { target } = findNearestBossTarget(this, 28.0, { landOnly: true, includeMinecarts: true });
        if (target) {
            const tPos = target.position;
            const angle = Math.atan2(tPos.x - this.position.x, tPos.z - this.position.z);
            this.mesh.rotation.y = angle;
            const currentSpeed = isLiquid ? this.speed * 0.45 : this.speed;
            this.velocity.x = Math.sin(angle) * currentSpeed;
            this.velocity.z = Math.cos(angle) * currentSpeed;

            const dist = this.position.distanceTo(tPos);
            if (dist < 3.4 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.05;
                this.attackAnimTimer = 0.45;
                sounds.playMonsterRoarSound('train');
                applyBossMeleeHit(this, target, 32, 45, 7.5, 5.0);
            }
        } else {
            this.wanderTimer -= dt;
            if (this.position.z >= SEA_START_Z - 1) {
                this.wanderAngle = Math.PI + (Math.random() - 0.5) * 0.8;
                this.wanderTimer = 1.8;
            } else if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.0 + Math.random() * 3.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.5);
            this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.5);
            this.mesh.rotation.y = this.wanderAngle;
        }

        if (isLiquid && Math.random() < 0.08) {
            this.velocity.y = 4.0;
        }
    }
}

// 14. INFECTED OCEAN (Ship-Maw Leviathan + Giant Crimson Kraken Tentacles)
export class InfectedOcean extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('infectedocean', x, y, z, scene, world, game);
        this.hp = 680;
        this.maxHp = 680;
        this.width = 3.6;
        this.height = 5.2;
        this.speed = 3.1;
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.swimPhase = Math.random() * Math.PI * 2;
    }

    initMesh() {
        const hullMat = createTrackedTexMat(this, textures.infectedShipHull);
        const tentacleMat = createTrackedTexMat(this, textures.infectedOceanTentacle);
        const blackKeelMat = createTrackedColorMat(this, 0x090b0f);
        const redMawMat = createTrackedColorMat(this, 0x991b1b);
        const darkMawMat = createTrackedColorMat(this, 0x450a0a);
        const windowMat = createTrackedColorMat(this, 0x1e3a8a);
        const teethMat = createTrackedColorMat(this, 0xf8fafc);
        const eyeScleraMat = createTrackedColorMat(this, 0xfacc15);
        const eyePupilMat = createTrackedColorMat(this, 0x78350f);

        // Dark keel + lower hull platform
        const keel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.75, 4.0), blackKeelMat);
        keel.position.set(0, 0.45, -0.2);
        keel.castShadow = true;
        this.mesh.add(keel);

        // Ship bridge superstructure with horizontal blue windows & top funnel
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.85, 1.95, 2.6), hullMat);
        bridge.position.set(0, 3.85, -0.1);
        bridge.castShadow = true;
        this.mesh.add(bridge);

        for (let row = 0; row < 3; row++) {
            for (const xSign of [-1, 1]) {
                const winPane = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.24, 0.08), windowMat);
                winPane.position.set(xSign * 0.65, 3.45 + row * 0.42, 1.22);
                this.mesh.add(winPane);
            }
        }

        const funnel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), hullMat);
        funnel.position.set(0, 5.2, -0.35);
        funnel.castShadow = true;
        this.mesh.add(funnel);

        const funnelCap = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.22, 0.96), blackKeelMat);
        funnelCap.position.set(0, 5.65, -0.35);
        this.mesh.add(funnelCap);

        // Gaping crimson mouth cavity between bridge bow and lower hull
        const mawBack = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.9, 1.4), darkMawMat);
        mawBack.position.set(0, 1.85, -0.1);
        this.mesh.add(mawBack);

        const upperLip = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.45, 2.7), hullMat);
        upperLip.position.set(0, 2.78, 0.25);
        this.mesh.add(upperLip);

        for (const xSign of [-1, 1]) {
            const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.95, 2.2), hullMat);
            cheek.position.set(xSign * 1.42, 1.85, 0.15);
            this.mesh.add(cheek);
        }

        for (let i = 0; i < 6; i++) {
            const tx = -1.0 + i * 0.4;
            const uTooth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, 0.2), teethMat);
            uTooth.position.set(tx, 2.42, 1.48);
            this.mesh.add(uTooth);
        }

        // Hinged lower ship jaw with crimson tongue & white teeth
        this.jawGroup = new THREE.Group();
        this.jawGroup.position.set(0, 0.92, 0.1);
        const lowerDeck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 1.9), hullMat);
        lowerDeck.position.set(0, 0, 0.72);
        this.jawGroup.add(lowerDeck);

        const tongue = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.14, 1.6), redMawMat);
        tongue.position.set(0, 0.24, 0.7);
        this.jawGroup.add(tongue);

        for (let i = 0; i < 6; i++) {
            const tx = -1.0 + i * 0.4;
            const lTooth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.2), teethMat);
            lTooth.position.set(tx, 0.36, 1.56);
            this.jawGroup.add(lTooth);
        }
        this.mesh.add(this.jawGroup);

        // Twin yellow-and-brown octopus eyes on the upper side flanks of the crimson hull
        for (const xSign of [-1, 1]) {
            const eyeBase = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.55), eyeScleraMat);
            eyeBase.position.set(xSign * 1.55, 2.25, 1.25);
            this.mesh.add(eyeBase);

            const eyeBar = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.58), eyePupilMat);
            eyeBar.position.set(xSign * 1.56, 2.25, 1.27);
            this.mesh.add(eyeBar);
        }

        // 6 giant mottled-red kraken tentacles radiating outward into the sea
        this.tentacles = [];
        const tentacleAngles = [-0.95, -0.42, 0.42, 0.95, -2.35, 2.35];
        for (let t = 0; t < tentacleAngles.length; t++) {
            const yaw = tentacleAngles[t];
            const root = new THREE.Group();
            root.position.set(Math.sin(yaw) * 1.45, 0.65, Math.cos(yaw) * 1.45);
            root.rotation.y = yaw;

            const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.68, 2.0), tentacleMat);
            seg1.position.set(0, 0, 1.0);
            seg1.castShadow = true;
            root.add(seg1);

            const seg2Pivot = new THREE.Group();
            seg2Pivot.position.set(0, -0.05, 1.95);
            const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.54, 1.9), tentacleMat);
            seg2.position.set(0, 0, 0.95);
            seg2Pivot.add(seg2);

            const seg3 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 1.6), tentacleMat);
            seg3.position.set(0, -0.05, 2.55);
            seg2Pivot.add(seg3);

            root.add(seg2Pivot);
            root.userData.tipPivot = seg2Pivot;
            root.userData.baseYaw = yaw;
            root.userData.phase = t * 1.05;
            this.mesh.add(root);
            this.tentacles.push(root);
        }
    }

    update(dt) {
        const feetBlock = this.world.getBlockAt(this.position.x, this.position.y, this.position.z);
        const midBlock = this.world.getBlockAt(this.position.x, this.position.y + 1.5, this.position.z);
        const upperBlock = this.world.getBlockAt(this.position.x, this.position.y + 3.0, this.position.z);
        const inWater = Boolean(
            (feetBlock && feetBlock.startsWith('water')) ||
            (midBlock && midBlock.startsWith('water')) ||
            (upperBlock && upperBlock.startsWith('water'))
        );
        this.gravity = inWater ? 0 : -25.0;
        super.update(dt);
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        this.swimPhase += dt * (isLiquid ? 3.4 : 1.8);

        if (this.attackAnimTimer > 0) {
            this.attackAnimTimer -= dt;
            const snap = Math.sin((this.attackAnimTimer / 0.5) * Math.PI);
            if (this.jawGroup) this.jawGroup.rotation.x = snap * 0.55;
        } else if (this.jawGroup) {
            this.jawGroup.rotation.x = Math.max(0, Math.sin(this.swimPhase * 0.6) * 0.16);
        }

        if (this.tentacles) {
            for (let i = 0; i < this.tentacles.length; i++) {
                const tentacle = this.tentacles[i];
                const wave = Math.sin(this.swimPhase + tentacle.userData.phase);
                tentacle.rotation.y = tentacle.userData.baseYaw + wave * 0.18;
                tentacle.rotation.x = Math.cos(this.swimPhase + tentacle.userData.phase) * 0.1;
                if (tentacle.userData.tipPivot) {
                    tentacle.userData.tipPivot.rotation.y = -wave * 0.25;
                    tentacle.userData.tipPivot.rotation.x = Math.sin(this.swimPhase * 1.2 + i) * 0.14;
                }
            }
        }

        const { target } = findNearestBossTarget(this, 34.0, { seaOnly: true });
        const activeSpeed = isLiquid ? this.speed : this.speed * 0.45;
        if (target) {
            const tPos = target.position;
            const angle = Math.atan2(tPos.x - this.position.x, tPos.z - this.position.z);
            this.mesh.rotation.y = angle;
            this.velocity.x = Math.sin(angle) * activeSpeed;
            this.velocity.z = Math.cos(angle) * activeSpeed;

            if (isLiquid) {
                this.velocity.y = THREE.MathUtils.clamp((2.6 - this.position.y) * 2.2, -2.5, 2.5);
                if (Math.random() < 0.22) {
                    spawnMobBurstParticle(
                        this,
                        0xdc2626,
                        this.position.x + (Math.random() - 0.5) * 3.2,
                        6.2,
                        this.position.z + (Math.random() - 0.5) * 2.4,
                        (Math.random() - 0.5) * 2.4,
                        2.8,
                        (Math.random() - 0.5) * 2.4,
                        0.45
                    );
                }
            }

            const horizDist = Math.hypot(tPos.x - this.position.x, tPos.z - this.position.z);
            if (horizDist < 4.8 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.1;
                this.attackAnimTimer = 0.5;
                sounds.playMonsterRoarSound('sea');
                applyBossMeleeHit(this, target, 35, 50, 7.0, 4.5);
            }
        } else {
            this.wanderTimer -= dt;
            if (this.position.z < SEA_START_Z + 3) {
                this.wanderAngle = (Math.random() - 0.5) * 0.9;
                this.wanderTimer = 1.6;
            } else if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.2 + Math.random() * 3.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (activeSpeed * 0.55);
            this.velocity.z = Math.cos(this.wanderAngle) * (activeSpeed * 0.55);
            this.mesh.rotation.y = this.wanderAngle;

            if (isLiquid) {
                const patrolY = 2.6 + Math.sin(this.swimPhase * 0.35) * 0.25;
                this.velocity.y = THREE.MathUtils.clamp((patrolY - this.position.y) * 2.0, -2.0, 2.0);
            }
        }
    }
}

// 15. INFECTED SKY (Cracked White Airplane with Spiral Turbines & Crimson Tendrils)
export class InfectedSky extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('infectedsky', x, y, z, scene, world, game);
        this.hp = 620;
        this.maxHp = 620;
        this.width = 3.8;
        this.height = 2.6;
        this.gravity = 0;
        this.speed = 4.2;
        this.attackCooldown = 0;
        this.shootCooldown = 1.2;
        this.attackAnimTimer = 0;
        this.hoverPhase = Math.random() * Math.PI * 2;
        this.diveCycle = Math.random() * 8.0;
    }

    initMesh() {
        const planeMat = createTrackedTexMat(this, textures.infectedPlaneSkin);
        const turbineMat = createTrackedTexMat(this, textures.infectedPlaneTurbine);
        const darkMat = createTrackedColorMat(this, 0x0f172a);
        const crimsonMat = createTrackedColorMat(this, 0xe11d48);
        const veinMat = createTrackedColorMat(this, 0xbe123c);

        // Long cracked white fuselage
        const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.5, 6.4), planeMat);
        fuselage.position.set(0, 1.35, -0.2);
        fuselage.castShadow = true;
        this.mesh.add(fuselage);

        // Nose with cockpit slit, 3 black eyes per side & thin red mouth
        const nose = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.25, 1.35), planeMat);
        nose.position.set(0, 1.25, 3.55);
        nose.castShadow = true;
        this.mesh.add(nose);

        const cockpitVisor = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.28, 0.55), darkMat);
        cockpitVisor.position.set(0, 1.62, 3.85);
        this.mesh.add(cockpitVisor);

        for (const xSign of [-1, 1]) {
            for (let e = 0; e < 3; e++) {
                const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.16), darkMat);
                eye.position.set(xSign * 0.72, 1.38, 3.25 + e * 0.3);
                this.mesh.add(eye);
            }
        }

        const mouthSlit = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.1, 1.05), crimsonMat);
        mouthSlit.position.set(0, 0.92, 3.68);
        this.mesh.add(mouthSlit);

        // Main wings, rear stabilizers, vertical tail fin & nose landing gear
        const mainWings = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.22, 2.05), planeMat);
        mainWings.position.set(0, 1.45, 0.35);
        mainWings.castShadow = true;
        this.mesh.add(mainWings);

        const rearWings = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 0.95), planeMat);
        rearWings.position.set(0, 1.65, -2.95);
        this.mesh.add(rearWings);

        const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.95, 1.3), planeMat);
        tailFin.position.set(0, 2.75, -2.75);
        tailFin.castShadow = true;
        this.mesh.add(tailFin);

        const noseWheel = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.45, 0.45), darkMat);
        noseWheel.position.set(0, 0.45, 2.85);
        this.mesh.add(noseWheel);

        // Twin boxy under-wing turbines with spiral intakes
        const engineMats = [planeMat, planeMat, planeMat, planeMat, turbineMat, darkMat];
        for (const xSign of [-1, 1]) {
            const engine = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.92, 1.55), engineMats);
            engine.position.set(xSign * 2.15, 0.85, 0.65);
            engine.castShadow = true;
            this.mesh.add(engine);
        }

        // Animated crimson fleshy infection tendrils bursting from spine and engines
        this.tendrils = [];
        const tendrilSpecs = [
            { x: -0.25, y: 2.1, z: 0.4, dirY: 1, len: 1.55 },
            { x: 0.28, y: 2.1, z: -0.35, dirY: 1, len: 1.75 },
            { x: -0.1, y: 2.1, z: -1.1, dirY: 1, len: 1.45 },
            { x: -2.15, y: 0.4, z: 0.55, dirY: -1, len: 1.35 },
            { x: -2.6, y: 1.25, z: 0.35, dirY: -1, len: 1.2 },
            { x: 2.15, y: 0.4, z: 0.55, dirY: -1, len: 1.35 },
            { x: 2.6, y: 1.25, z: 0.35, dirY: -1, len: 1.2 },
            { x: 0.0, y: 0.55, z: -0.9, dirY: -1, len: 1.4 }
        ];
        for (let i = 0; i < tendrilSpecs.length; i++) {
            const spec = tendrilSpecs[i];
            const tendril = new THREE.Group();
            tendril.position.set(spec.x, spec.y, spec.z);
            const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, spec.len * 0.55, 0.22), crimsonMat);
            seg1.position.set(0, spec.dirY * spec.len * 0.28, 0);
            tendril.add(seg1);

            const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, spec.len * 0.55, 0.14), veinMat);
            seg2.position.set(0.12 * (i % 2 === 0 ? 1 : -1), spec.dirY * spec.len * 0.72, -0.1);
            seg2.rotation.z = 0.3 * (i % 2 === 0 ? 1 : -1);
            tendril.add(seg2);

            tendril.userData.phase = i * 0.9;
            this.mesh.add(tendril);
            this.tendrils.push(tendril);
        }
    }

    updateAI(dt) {
        if (this.tendrils) {
            for (let i = 0; i < this.tendrils.length; i++) {
                const t = this.tendrils[i];
                t.rotation.x = Math.sin(this.hoverPhase * 1.4 + t.userData.phase) * 0.26;
                t.rotation.z = Math.cos(this.hoverPhase * 1.1 + t.userData.phase) * 0.22;
            }
        }
        stepFlyingBossAI(this, dt, {
            hoverFreq: 3.1,
            cruiseY: 13.5,
            divePeriod: 8.5,
            diveWindow: 2.6,
            diveClearance: 2.4,
            shootInterval: 2.8,
            muzzleY: 1.1,
            rangedDamage: 20,
            projectileSpeed: 17.5,
            fireProjectiles: false,
            meleeRange: 4.5,
            meleeVertRange: 4.2,
            meleePlayerDamage: 30,
            meleeMobDamage: 42,
            roarVariant: 'sky',
            bankRoll: true,
            particleChance: 0.24,
            particleColor: 0xe11d48
        });
    }
}

// 16 - 25. JJ, Mikey, BananaKid, Carrie, Buu, Cookie, Penduduk, Steve, Alex & Optimus (Friendly Companions)
class AllyHero extends Mob {
    constructor(type, x, y, z, scene, world, game) {
        super(type, x, y, z, scene, world, game);
        this.isFriendly = true;
        this.followPlayer = type !== 'penduduk';
        this.modelScale = 1.0;
        this.hp = type === 'optimus' ? 480 : 260;
        this.maxHp = this.hp;
        this.width = 0.6;
        this.height = 1.8;
        this.speed = type === 'jj' ? 2.6 : (type === 'penduduk' ? 1.55 : (type === 'optimus' ? 2.4 : 2.5));
        this.walkPhase = 0;
        this.targetMob = null;
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.combatStyle = type === 'penduduk'
            ? 'none'
            : ((type === 'carrie' || type === 'cookie') ? 'ranged' : 'melee');
        const dmgTable = {
            optimus: 56,
            jj: 42,
            mikey: 40,
            steve: 40,
            alex: 38,
            carrie: 26,
            cookie: 26
        };
        this.attackDamage = dmgTable[type] ?? 34;
        this.projectileColor = type === 'carrie' ? 0xf43f5e : 0xa855f7;
    }

    applyScale(scale) {
        this.modelScale = scale;
        this.width = 0.6 * scale;
        this.height = 1.8 * scale;
        this.mesh.scale.setScalar(scale);
    }

    buildTwoToneLimb(w, h, d, topMat, topRatio, bottomMat) {
        const grp = new THREE.Group();
        const topH = h * topRatio;
        const botH = h * (1 - topRatio);

        const upper = new THREE.Mesh(new THREE.BoxGeometry(w, topH, d), topMat);
        upper.position.set(0, -topH / 2, 0);
        upper.castShadow = true;
        grp.add(upper);

        const lower = new THREE.Mesh(new THREE.BoxGeometry(w, botH, d), bottomMat);
        lower.position.set(0, -topH - botH / 2, 0);
        lower.castShadow = true;
        grp.add(lower);

        return grp;
    }

    buildSolidLimb(w, h, d, mat) {
        const grp = new THREE.Group();
        const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        part.position.set(0, -h / 2, 0);
        part.castShadow = true;
        grp.add(part);
        return grp;
    }

    attachDiamondSword(handY = -0.58) {
        const handleMat = createTrackedColorMat(this, 0x78350f);
        const guardMat = createTrackedColorMat(this, 0x0e7490);
        const bladeMat = createTrackedColorMat(this, 0x38bdf8);
        const glintMat = createTrackedColorMat(this, 0xbae6fd);

        const sword = new THREE.Group();
        sword.position.set(0, handY, 0.14);
        sword.rotation.x = Math.PI / 2.6;

        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), handleMat);
        sword.add(handle);

        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.08), guardMat);
        guard.position.set(0, 0.13, 0);
        sword.add(guard);

        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.62, 0.045), bladeMat);
        blade.position.set(0, 0.47, 0);
        sword.add(blade);

        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.54, 0.055), glintMat);
        edge.position.set(0, 0.48, 0);
        sword.add(edge);

        this.rArm.add(sword);
        this.swordGroup = sword;
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackAnimTimer > 0) this.attackAnimTimer -= dt;

        const speedMag = Math.hypot(this.velocity.x, this.velocity.z);
        this.walkPhase += dt * (4.0 + speedMag * 3.0);

        const currentSpeed = isLiquid ? this.speed * 0.45 : this.speed;

        // Scan for nearest hostile mob (Iron Golem / Snow Golem defender style)
        let closestMob = null;
        if (this.combatStyle !== 'none' && this.game?.mobs) {
            let minDist = 18.0;
            for (let i = 0; i < this.game.mobs.length; i++) {
                const mob = this.game.mobs[i];
                if (!mob || mob === this || !HOSTILE_MOBS.has(mob.type)) continue;
                if (this.combatStyle === 'melee' && Math.abs(mob.position.y - this.position.y) >= 4.5) continue;
                const dist = this.position.distanceTo(mob.position);
                if (dist < minDist) {
                    minDist = dist;
                    closestMob = mob;
                }
            }
        }
        this.targetMob = closestMob;

        if (this.targetMob) {
            const tPos = this.targetMob.position;
            const angle = Math.atan2(tPos.x - this.position.x, tPos.z - this.position.z);
            this.mesh.rotation.y = angle;
            const dist = this.position.distanceTo(tPos);

            if (this.combatStyle === 'ranged') {
                if (dist > 8.5) {
                    this.velocity.x = Math.sin(angle) * currentSpeed;
                    this.velocity.z = Math.cos(angle) * currentSpeed;
                } else if (dist < 3.5) {
                    this.velocity.x = -Math.sin(angle) * (currentSpeed * 0.65);
                    this.velocity.z = -Math.cos(angle) * (currentSpeed * 0.65);
                } else {
                    this.velocity.x *= 0.5;
                    this.velocity.z *= 0.5;
                }

                if (dist < 16.0 && this.attackCooldown <= 0) {
                    this.attackCooldown = 0.85;
                    this.attackAnimTimer = 0.25;
                    const startPos = this.position.clone().setY(this.position.y + this.height * 0.58);
                    const aimPos = tPos.clone().setY(tPos.y + (this.targetMob.height || 1.8) * 0.5);
                    const shot = new Snowball(startPos, aimPos, this.scene, this.world, this.game, {
                        color: this.projectileColor,
                        damage: this.attackDamage,
                        speed: 20.0,
                        size: 0.14
                    });
                    if (!this.game.arrows) this.game.arrows = [];
                    this.game.arrows.push(shot);
                }
            } else {
                this.velocity.x = Math.sin(angle) * currentSpeed;
                this.velocity.z = Math.cos(angle) * currentSpeed;

                const meleeReach = 2.1 + (this.targetMob.width || 0.6) * 0.45;
                if (dist < meleeReach && this.attackCooldown <= 0) {
                    this.attackCooldown = 0.75;
                    this.attackAnimTimer = 0.35;
                    this.targetMob.takeDamage(this.attackDamage);
                    this.targetMob.velocity.y = Math.max(this.targetMob.velocity.y, 6.0);
                    const pushDir = tPos.clone().sub(this.position).setY(0);
                    if (pushDir.lengthSq() > 0.0001) {
                        pushDir.normalize();
                        this.targetMob.velocity.addScaledVector(pushDir, 4.5);
                    }
                    sounds.playClickSound();
                }
            }
        } else {
            const player = this.game?.player;
            const distToPlayer = player ? this.position.distanceTo(player.position) : 0;

            if (this.followPlayer && player && distToPlayer > 6.5 && distToPlayer < 22.0) {
                const angle = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
                this.mesh.rotation.y = angle;
                this.velocity.x = Math.sin(angle) * (currentSpeed * 0.78);
                this.velocity.z = Math.cos(angle) * (currentSpeed * 0.78);
            } else {
                this.wanderTimer -= dt;
                if (this.wanderTimer <= 0) {
                    this.wanderTimer = 2.5 + Math.random() * 3.0;
                    this.wanderAngle = Math.random() * Math.PI * 2;
                }
                this.velocity.x = Math.sin(this.wanderAngle) * (currentSpeed * 0.4);
                this.velocity.z = Math.cos(this.wanderAngle) * (currentSpeed * 0.4);
                this.mesh.rotation.y = this.wanderAngle;
            }
        }

        const legSwing = speedMag > 0.15 ? Math.sin(this.walkPhase) * 0.55 : 0;
        if (this.lLeg && this.rLeg) {
            this.lLeg.rotation.x = legSwing;
            this.rLeg.rotation.x = -legSwing;
        }
        if (this.lArm) {
            this.lArm.rotation.x = -legSwing * 0.65;
        }
        if (this.rArm) {
            if (this.attackAnimTimer > 0) {
                const swing = Math.sin((this.attackAnimTimer / 0.35) * Math.PI) * 1.45;
                this.rArm.rotation.x = -swing - 0.35;
            } else {
                this.rArm.rotation.x = legSwing * 0.45 - 0.15;
            }
        }

        if (isLiquid && Math.random() < 0.08) {
            this.velocity.y = 4.2;
        }
    }
}

export class JJ extends AllyHero {
    constructor(x, y, z, scene, world, game) {
        super('jj', x, y, z, scene, world, game);
    }

    initMesh() {
        const hoodieMat = createTrackedColorMat(this, 0xdc2626);
        const darkCuffMat = createTrackedColorMat(this, 0x18181b);
        const skinMat = createTrackedColorMat(this, 0xfcd5b5);
        const pantsMat = createTrackedColorMat(this, 0x1f2937);
        const sneakerMat = createTrackedColorMat(this, 0xd946ef);
        const soleMat = createTrackedColorMat(this, 0xf8fafc);
        const torsoFrontMat = createTrackedTexMat(this, textures.jjTorsoFront);
        const faceTex = createMobFaceTexture('jj');
        const faceMat = createTrackedTexMat(this, faceTex);

        // Head wrapped in red hoodie hood
        const headMats = [hoodieMat, hoodieMat, hoodieMat, hoodieMat, faceMat, hoodieMat];
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
        head.position.set(0, 1.56, 0);
        head.castShadow = true;
        this.mesh.add(head);

        const hoodLip = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.58), hoodieMat);
        hoodLip.position.set(0, 1.78, 0);
        this.mesh.add(hoodLip);

        // Open red hoodie over white t-shirt
        const torsoMats = [hoodieMat, hoodieMat, hoodieMat, hoodieMat, torsoFrontMat, hoodieMat];
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.32), torsoMats);
        torso.position.set(0, 0.94, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        // Sleeved arms with black cuffs & peach hands
        const makeArm = () => {
            const grp = new THREE.Group();
            const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.48, 0.22), hoodieMat);
            sleeve.position.set(0, -0.24, 0);
            sleeve.castShadow = true;
            grp.add(sleeve);

            const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.08, 0.23), darkCuffMat);
            cuff.position.set(0, -0.5, 0);
            grp.add(cuff);

            const hand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), skinMat);
            hand.position.set(0, -0.6, 0);
            grp.add(hand);
            return grp;
        };

        this.lArm = makeArm();
        this.lArm.position.set(-0.38, 1.28, 0);
        this.mesh.add(this.lArm);

        this.rArm = makeArm();
        this.rArm.position.set(0.38, 1.28, 0);
        this.mesh.add(this.rArm);
        this.attachDiamondSword(-0.58);

        // Dark pants + bright magenta sneakers with white soles
        const makeLeg = () => {
            const grp = new THREE.Group();
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.44, 0.24), pantsMat);
            leg.position.set(0, -0.22, 0);
            leg.castShadow = true;
            grp.add(leg);

            const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.11, 0.26), sneakerMat);
            shoe.position.set(0, -0.49, 0.01);
            grp.add(shoe);

            const sole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.26), soleMat);
            sole.position.set(0, -0.57, 0.01);
            grp.add(sole);
            return grp;
        };

        this.lLeg = makeLeg();
        this.lLeg.position.set(-0.14, 0.6, 0);
        this.mesh.add(this.lLeg);

        this.rLeg = makeLeg();
        this.rLeg.position.set(0.14, 0.6, 0);
        this.mesh.add(this.rLeg);
    }
}

export class Mikey extends AllyHero {
    constructor(x, y, z, scene, world, game) {
        super('mikey', x, y, z, scene, world, game);
    }

    initMesh() {
        const greenMat = createTrackedColorMat(this, 0x22c55e);
        const darkGreenMat = createTrackedColorMat(this, 0x15803d);
        const bellyMat = createTrackedTexMat(this, textures.mikeyBelly);
        const shellMat = createTrackedTexMat(this, textures.mikeyShell);
        const faceTex = createMobFaceTexture('mikey');
        const faceMat = createTrackedTexMat(this, faceTex);

        // Turtle head
        const headMats = [greenMat, greenMat, greenMat, greenMat, faceMat, greenMat];
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
        head.position.set(0, 1.56, 0);
        head.castShadow = true;
        this.mesh.add(head);

        // Torso with yellow plastron front and checkered brown shell back
        const torsoMats = [greenMat, greenMat, greenMat, greenMat, bellyMat, shellMat];
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.32), torsoMats);
        torso.position.set(0, 0.94, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        const backShell = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.64, 0.14), shellMat);
        backShell.position.set(0, 0.94, -0.2);
        backShell.castShadow = true;
        this.mesh.add(backShell);

        // Arms & legs with darker turtle-claw tips
        const makeLimb = (w, h, d, tipColorMat) => {
            const grp = new THREE.Group();
            const upper = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.75, d), greenMat);
            upper.position.set(0, -h * 0.375, 0);
            upper.castShadow = true;
            grp.add(upper);

            const tip = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.25, d), tipColorMat);
            tip.position.set(0, -h * 0.875, 0);
            grp.add(tip);
            return grp;
        };

        this.lArm = makeLimb(0.22, 0.68, 0.22, darkGreenMat);
        this.lArm.position.set(-0.38, 1.28, 0);
        this.mesh.add(this.lArm);

        this.rArm = makeLimb(0.22, 0.68, 0.22, darkGreenMat);
        this.rArm.position.set(0.38, 1.28, 0);
        this.mesh.add(this.rArm);
        this.attachDiamondSword(-0.58);

        this.lLeg = makeLimb(0.24, 0.6, 0.24, darkGreenMat);
        this.lLeg.position.set(-0.14, 0.6, 0);
        this.mesh.add(this.lLeg);

        this.rLeg = makeLimb(0.24, 0.6, 0.24, darkGreenMat);
        this.rLeg.position.set(0.14, 0.6, 0);
        this.mesh.add(this.rLeg);
    }
}

export class BananaKid extends AllyHero {
    constructor(x, y, z, scene, world, game) {
        super('bananakid', x, y, z, scene, world, game);
    }

    initMesh() {
        const yellowMat = createTrackedColorMat(this, 0xf0e11c);
        const bodyMat = createTrackedTexMat(this, textures.bananaBody);
        const legFrontMat = createTrackedTexMat(this, textures.bananaLegFront);
        const stemMat = createTrackedColorMat(this, 0x5c3310);
        const faceMat = createTrackedTexMat(this, createMobFaceTexture('bananakid'));

        // Head + dark brown banana stem cap on crown
        const headMats = [yellowMat, yellowMat, yellowMat, yellowMat, faceMat, yellowMat];
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
        head.position.set(0, 1.56, 0);
        head.castShadow = true;
        this.mesh.add(head);

        const stem = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), stemMat);
        stem.position.set(0, 1.86, 0);
        stem.castShadow = true;
        this.mesh.add(stem);

        // Bright yellow banana torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.32), bodyMat);
        torso.position.set(0, 0.94, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        // Yellow arms
        this.lArm = this.buildSolidLimb(0.22, 0.68, 0.22, yellowMat);
        this.lArm.position.set(-0.38, 1.28, 0);
        this.mesh.add(this.lArm);

        this.rArm = this.buildSolidLimb(0.22, 0.68, 0.22, yellowMat);
        this.rArm.position.set(0.38, 1.28, 0);
        this.mesh.add(this.rArm);

        // Yellow legs with dark brown square knee patches & sole rim
        const legMats = [yellowMat, yellowMat, yellowMat, stemMat, legFrontMat, yellowMat];
        this.lLeg = this.buildSolidLimb(0.24, 0.6, 0.24, legMats);
        this.lLeg.position.set(-0.14, 0.6, 0);
        this.mesh.add(this.lLeg);

        this.rLeg = this.buildSolidLimb(0.24, 0.6, 0.24, legMats);
        this.rLeg.position.set(0.14, 0.6, 0);
        this.mesh.add(this.rLeg);
    }
}

export class Carrie extends AllyHero {
    constructor(x, y, z, scene, world, game) {
        super('carrie', x, y, z, scene, world, game);
        this.applyScale(0.55);
    }

    initMesh() {
        const whiteMat = createTrackedColorMat(this, 0xf4f4f5);
        const earMat = createTrackedColorMat(this, 0xd4d4d8);
        const scarfMat = createTrackedTexMat(this, textures.carrieScarf);
        const faceMat = createTrackedTexMat(this, createMobFaceTexture('carrie'));

        // White head with two small corner ears
        const headMats = [whiteMat, whiteMat, whiteMat, whiteMat, faceMat, whiteMat];
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
        head.position.set(0, 1.56, 0);
        head.castShadow = true;
        this.mesh.add(head);

        for (const side of [-1, 1]) {
            const ear = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.14), earMat);
            ear.position.set(side * 0.21, 1.85, 0.04);
            ear.castShadow = true;
            this.mesh.add(ear);
        }

        // White torso + thick crimson scarf/shawl over chest & shoulders
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.32), whiteMat);
        torso.position.set(0, 0.94, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        const scarfMantle = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.28, 0.38), scarfMat);
        scarfMantle.position.set(0, 1.18, 0);
        scarfMantle.castShadow = true;
        this.mesh.add(scarfMantle);

        // Two-tone arms: top crimson scarf sleeves, bottom white paws
        this.lArm = this.buildTwoToneLimb(0.22, 0.68, 0.22, scarfMat, 0.38, whiteMat);
        this.lArm.position.set(-0.38, 1.28, 0);
        this.mesh.add(this.lArm);

        this.rArm = this.buildTwoToneLimb(0.22, 0.68, 0.22, scarfMat, 0.38, whiteMat);
        this.rArm.position.set(0.38, 1.28, 0);
        this.mesh.add(this.rArm);

        // White legs
        this.lLeg = this.buildSolidLimb(0.24, 0.6, 0.24, whiteMat);
        this.lLeg.position.set(-0.14, 0.6, 0);
        this.mesh.add(this.lLeg);

        this.rLeg = this.buildSolidLimb(0.24, 0.6, 0.24, whiteMat);
        this.rLeg.position.set(0.14, 0.6, 0);
        this.mesh.add(this.rLeg);
    }
}

export class Buu extends AllyHero {
    constructor(x, y, z, scene, world, game) {
        super('buu', x, y, z, scene, world, game);
    }

    initMesh() {
        const hairMat = createTrackedColorMat(this, 0x543c26);
        const skinMat = createTrackedColorMat(this, 0xc69c82);
        const shirtMat = createTrackedColorMat(this, 0x26b5a5);
        const pantsMat = createTrackedColorMat(this, 0x52478c);
        const shoeMat = createTrackedColorMat(this, 0x71717a);
        const stemMat = createTrackedColorMat(this, 0x22c55e);
        const petalMat = createTrackedColorMat(this, 0xdc2626);

        const hairSideMat = createTrackedTexMat(this, textures.buuHairSide);
        const torsoFrontMat = createTrackedTexMat(this, textures.buuTorsoFront);
        const faceMat = createTrackedTexMat(this, createMobFaceTexture('buu'));

        // Head with brown hair top/back, stepped sideburns, and derpy face
        const headMats = [hairSideMat, hairSideMat, hairMat, skinMat, faceMat, hairMat];
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
        head.position.set(0, 1.56, 0);
        head.castShadow = true;
        this.mesh.add(head);

        // Cyan shirt torso with belt & purple waistband on front
        const torsoMats = [shirtMat, shirtMat, shirtMat, pantsMat, torsoFrontMat, shirtMat];
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.32), torsoMats);
        torso.position.set(0, 0.94, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        // Short cyan sleeves over peach forearms
        this.lArm = this.buildTwoToneLimb(0.22, 0.68, 0.22, shirtMat, 0.42, skinMat);
        this.lArm.position.set(-0.38, 1.28, 0);
        this.mesh.add(this.lArm);

        this.rArm = this.buildTwoToneLimb(0.22, 0.68, 0.22, shirtMat, 0.42, skinMat);
        this.rArm.position.set(0.38, 1.28, 0);
        this.mesh.add(this.rArm);

        // Tiny red poppy flower held in right hand
        const flower = new THREE.Group();
        flower.position.set(0, -0.62, 0.14);
        flower.rotation.x = Math.PI / 2.8;
        const stem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), stemMat);
        stem.position.set(0, 0.1, 0);
        flower.add(stem);
        const bloom = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.06), petalMat);
        bloom.position.set(0, 0.22, 0);
        flower.add(bloom);
        this.rArm.add(flower);
        this.flowerGroup = flower;

        // Purple pants with grey shoes
        this.lLeg = this.buildTwoToneLimb(0.24, 0.6, 0.24, pantsMat, 0.85, shoeMat);
        this.lLeg.position.set(-0.14, 0.6, 0);
        this.mesh.add(this.lLeg);

        this.rLeg = this.buildTwoToneLimb(0.24, 0.6, 0.24, pantsMat, 0.85, shoeMat);
        this.rLeg.position.set(0.14, 0.6, 0);
        this.mesh.add(this.rLeg);
    }
}

export class Cookie extends AllyHero {
    constructor(x, y, z, scene, world, game) {
        super('cookie', x, y, z, scene, world, game);
        this.applyScale(0.52);
    }

    initMesh() {
        const doughMat = createTrackedColorMat(this, 0x635042);
        const torsoFrontMat = createTrackedTexMat(this, textures.cookieTorsoFront);
        const limbMat = createTrackedTexMat(this, textures.cookieLimb);
        const faceMat = createTrackedTexMat(this, createMobFaceTexture('cookie'));

        // Gingerbread head with goofy eyes and red smile
        const headMats = [doughMat, doughMat, doughMat, doughMat, faceMat, doughMat];
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
        head.position.set(0, 1.56, 0);
        head.castShadow = true;
        this.mesh.add(head);

        // Torso with purple buttons and zigzag cream icing waist
        const torsoMats = [doughMat, doughMat, doughMat, doughMat, torsoFrontMat, torsoFrontMat];
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.32), torsoMats);
        torso.position.set(0, 0.94, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        // Arms & legs with cream-white zigzag icing cuffs
        const limbMats = [limbMat, limbMat, doughMat, doughMat, limbMat, limbMat];
        this.lArm = this.buildSolidLimb(0.22, 0.68, 0.22, limbMats);
        this.lArm.position.set(-0.38, 1.28, 0);
        this.mesh.add(this.lArm);

        this.rArm = this.buildSolidLimb(0.22, 0.68, 0.22, limbMats);
        this.rArm.position.set(0.38, 1.28, 0);
        this.mesh.add(this.rArm);

        this.lLeg = this.buildSolidLimb(0.24, 0.6, 0.24, limbMats);
        this.lLeg.position.set(-0.14, 0.6, 0);
        this.mesh.add(this.lLeg);

        this.rLeg = this.buildSolidLimb(0.24, 0.6, 0.24, limbMats);
        this.rLeg.position.set(0.14, 0.6, 0);
        this.mesh.add(this.rLeg);
    }
}

export class Penduduk extends AllyHero {
    constructor(x, y, z, scene, world, game) {
        super('penduduk', x, y, z, scene, world, game);
    }

    initMesh() {
        const skinMat = createTrackedTexMat(this, textures.villagerSkin);
        const noseMat = createTrackedColorMat(this, 0x8a5d41);
        const robeMat = createTrackedTexMat(this, textures.villagerRobe);
        const bootMat = createTrackedColorMat(this, 0x3f3f46);
        const faceMat = createTrackedTexMat(this, createMobFaceTexture('penduduk'));

        // Tall Minecraft Villager head + iconic 3D protruding nose
        const headMats = [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat];
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.64, 0.5), headMats);
        head.position.set(0, 1.64, 0);
        head.castShadow = true;
        this.mesh.add(head);

        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.16), noseMat);
        nose.position.set(0, 1.48, 0.31);
        nose.castShadow = true;
        this.mesh.add(nose);

        // Long brown villager robe torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.86, 0.36), robeMat);
        torso.position.set(0, 0.88, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        // Stationary folded arms crossed over chest
        const foldedArms = new THREE.Group();
        for (const side of [-1, 1]) {
            const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.22), robeMat);
            sleeve.position.set(side * 0.35, 1.08, 0.08);
            sleeve.rotation.x = -0.68;
            sleeve.castShadow = true;
            foldedArms.add(sleeve);
        }
        const forearmBar = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.22, 0.22), robeMat);
        forearmBar.position.set(0, 0.9, 0.26);
        forearmBar.castShadow = true;
        foldedArms.add(forearmBar);
        this.mesh.add(foldedArms);
        this.foldedArms = foldedArms;
        this.lArm = null;
        this.rArm = null;

        // Brown legs with dark grey boots
        this.lLeg = this.buildTwoToneLimb(0.24, 0.56, 0.24, robeMat, 0.8, bootMat);
        this.lLeg.position.set(-0.14, 0.56, 0);
        this.mesh.add(this.lLeg);

        this.rLeg = this.buildTwoToneLimb(0.24, 0.56, 0.24, robeMat, 0.8, bootMat);
        this.rLeg.position.set(0.14, 0.56, 0);
        this.mesh.add(this.rLeg);
    }
}

// 18. RED SUN (Blazing Pink/Magenta Solar Boss floating high in the sky)
export class RedSun extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('redsun', x, y, z, scene, world, game);
        this.hp = 700;
        this.maxHp = 700;
        this.width = 4.2;
        this.height = 4.2;
        this.gravity = 0;
        this.speed = 2.6;
        this.attackCooldown = 0;
        this.shootCooldown = 1.4;
        this.attackAnimTimer = 0;
        this.hoverPhase = Math.random() * Math.PI * 2;
        this.diveCycle = Math.random() * 9.0;
    }

    initMesh() {
        const faceMat = createTrackedTexMat(this, textures.redSunFace, true);
        const plasmaMat = createTrackedTexMat(this, textures.redSunSurface, true);
        const haloWhiteMat = createTrackedColorMat(this, 0xfff1f2, true);
        const haloPinkMat = createTrackedColorMat(this, 0xff2a6d, true);

        const coreMats = [plasmaMat, plasmaMat, plasmaMat, plasmaMat, faceMat, plasmaMat];
        const core = new THREE.Mesh(new THREE.BoxGeometry(3.3, 3.3, 3.3), coreMats);
        core.position.set(0, 2.1, 0);
        this.mesh.add(core);

        // Stepped outer shell caps for rounded blazing solar orb silhouette
        const capOffsets = [
            [0, 2.1 + 1.8, 0, 2.45, 0.45, 2.45],
            [0, 2.1 - 1.8, 0, 2.45, 0.45, 2.45],
            [1.8, 2.1, 0, 0.45, 2.45, 2.45],
            [-1.8, 2.1, 0, 0.45, 2.45, 2.45],
            [0, 2.1, -1.8, 2.45, 2.45, 0.45]
        ];
        for (const [px, py, pz, sx, sy, sz] of capOffsets) {
            const cap = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), plasmaMat);
            cap.position.set(px, py, pz);
            this.mesh.add(cap);
        }

        // Luminous rotating solar corona rings
        this.coronaGroup = new THREE.Group();
        this.coronaGroup.position.set(0, 2.1, 0);
        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.14, 6, 16), haloWhiteMat);
        const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.12, 6, 16), haloPinkMat);
        ring2.rotation.x = Math.PI / 3;
        ring2.rotation.y = Math.PI / 5;
        this.coronaGroup.add(ring1, ring2);
        this.mesh.add(this.coronaGroup);
    }

    updateAI(dt) {
        if (this.coronaGroup) {
            this.coronaGroup.rotation.z += dt * 1.1;
            this.coronaGroup.rotation.y += dt * 0.65;
        }
        stepFlyingBossAI(this, dt, {
            hoverFreq: 2.2,
            cruiseY: 14.5,
            divePeriod: 10.0,
            diveWindow: 2.4,
            diveClearance: 2.8,
            shootInterval: 2.6,
            muzzleY: 2.1,
            rangedDamage: 22,
            projectileSpeed: 17.0,
            fireProjectiles: true,
            meleeRange: 4.8,
            meleeVertRange: 4.8,
            meleePlayerDamage: 34,
            meleeMobDamage: 48,
            roarVariant: 'celestial',
            bankRoll: false,
            particleChance: 0.3,
            particleColor: 0xff2a6d
        });
    }
}

// 19. LUNAR MOON (Majora-Style Cratered Moon Boss with Glowing Red Eyes)
export class LunarMoon extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('lunarmoon', x, y, z, scene, world, game);
        this.hp = 700;
        this.maxHp = 700;
        this.width = 4.2;
        this.height = 4.2;
        this.gravity = 0;
        this.speed = 2.5;
        this.attackCooldown = 0;
        this.shootCooldown = 1.6;
        this.attackAnimTimer = 0;
        this.hoverPhase = Math.random() * Math.PI * 2;
        this.diveCycle = Math.random() * 10.0;
    }

    initMesh() {
        const faceMat = createTrackedTexMat(this, textures.lunarMoonFace);
        const craterMat = createTrackedTexMat(this, textures.lunarMoonCrater);
        const redEyeGlowMat = createTrackedColorMat(this, 0xff1e1e, true);
        const darkSocketMat = createTrackedColorMat(this, 0x09090b);

        const moonMats = [craterMat, craterMat, craterMat, craterMat, faceMat, craterMat];
        const core = new THREE.Mesh(new THREE.BoxGeometry(3.3, 3.3, 3.3), moonMats);
        core.position.set(0, 2.1, 0);
        core.castShadow = true;
        this.mesh.add(core);

        const capOffsets = [
            [0, 2.1 + 1.85, 0, 2.45, 0.5, 2.45],
            [0, 2.1 - 1.85, 0, 2.45, 0.5, 2.45],
            [1.85, 2.1, 0, 0.5, 2.45, 2.45],
            [-1.85, 2.1, 0, 0.5, 2.45, 2.45],
            [0, 2.1, -1.85, 2.45, 2.45, 0.5]
        ];
        for (const [px, py, pz, sx, sy, sz] of capOffsets) {
            const cap = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), craterMat);
            cap.position.set(px, py, pz);
            cap.castShadow = true;
            this.mesh.add(cap);
        }

        // Piercing glowing crimson-red eyes set inside dark sockets on front (+Z)
        for (const xSign of [-1, 1]) {
            const socket = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.14), darkSocketMat);
            socket.position.set(xSign * 0.72, 2.55, 1.63);
            this.mesh.add(socket);

            const eyeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.16), redEyeGlowMat);
            eyeGlow.position.set(xSign * 0.72, 2.55, 1.65);
            this.mesh.add(eyeGlow);
        }

        // Orbiting lunar crater rock fragments
        this.orbitRocks = [];
        for (let i = 0; i < 6; i++) {
            const rock = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.46), craterMat);
            const angle = (i / 6) * Math.PI * 2;
            rock.position.set(Math.cos(angle) * 2.95, 2.1 + Math.sin(angle * 2) * 0.65, Math.sin(angle) * 2.95);
            rock.userData.baseAngle = angle;
            this.mesh.add(rock);
            this.orbitRocks.push(rock);
        }
    }

    updateAI(dt) {
        if (this.orbitRocks) {
            for (let i = 0; i < this.orbitRocks.length; i++) {
                const rock = this.orbitRocks[i];
                const a = rock.userData.baseAngle + this.hoverPhase * 0.6;
                rock.position.set(Math.cos(a) * 2.95, 2.1 + Math.sin(a * 2.0) * 0.65, Math.sin(a) * 2.95);
                rock.rotation.x += dt * 1.2;
                rock.rotation.y += dt * 0.9;
            }
        }
        stepFlyingBossAI(this, dt, {
            hoverFreq: 1.9,
            cruiseY: 14.0,
            divePeriod: 10.5,
            diveWindow: 2.5,
            diveClearance: 2.6,
            shootInterval: 2.6,
            muzzleY: 2.1,
            rangedDamage: 24,
            projectileSpeed: 16.5,
            fireProjectiles: false,
            meleeRange: 4.8,
            meleeVertRange: 4.8,
            meleePlayerDamage: 36,
            meleeMobDamage: 50,
            roarVariant: 'celestial',
            bankRoll: false,
            particleChance: 0.22,
            particleColor: 0xef4444
        });
    }
}

// 20. CURSED THOMAS (Sky-Blue Spider-Train with Bloated Abdomen & Elongated Worm-Neck)
export class CursedThomas extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('cursedthomas', x, y, z, scene, world, game);
        this.hp = 640;
        this.maxHp = 640;
        this.width = 2.4;
        this.height = 3.0;
        this.speed = 3.4;
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.walkPhase = 0;
    }

    initMesh() {
        const blueMat = createTrackedTexMat(this, textures.cursedThomasBlue);
        const faceMat = createTrackedTexMat(this, textures.cursedThomasFace);
        const darkBlueMat = createTrackedColorMat(this, 0x0284c7);
        const redBoardMat = createTrackedColorMat(this, 0xdc2626);
        const whiteTrimMat = createTrackedColorMat(this, 0xf1f5f9);
        const blackMat = createTrackedColorMat(this, 0x111827);
        const goldMat = createTrackedColorMat(this, 0xeab308);
        const boneMat = createTrackedColorMat(this, 0xd6cbb8);
        const paleNeckMat = createTrackedColorMat(this, 0xa1a1aa);
        const redEyeGlowMat = createTrackedColorMat(this, 0xff1e1e, true);

        // Red running board & white front buffer beam
        const runningBoard = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.24, 3.0), redBoardMat);
        runningBoard.position.set(0, 0.92, -0.1);
        runningBoard.castShadow = true;
        this.mesh.add(runningBoard);

        const bufferBeam = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.34, 0.32), whiteTrimMat);
        bufferBeam.position.set(0, 0.9, 1.32);
        this.mesh.add(bufferBeam);

        for (const xSign of [-1, 1]) {
            const buf = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 8), blackMat);
            buf.rotation.x = Math.PI / 2;
            buf.position.set(xSign * 0.65, 0.9, 1.52);
            this.mesh.add(buf);
        }

        // 6 blue train wheels (3 per side)
        const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.16, 10);
        for (const zPos of [0.85, 0.0, -0.85]) {
            for (const xSign of [-1, 1]) {
                const wheel = new THREE.Mesh(wheelGeo, blueMat);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(xSign * 0.92, 0.65, zPos);
                this.mesh.add(wheel);
            }
        }

        // Blue boiler, side tanks, black smokebox & blue funnel
        const sideTanks = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.05, 1.7), blueMat);
        sideTanks.position.set(0, 1.52, 0.25);
        sideTanks.castShadow = true;
        this.mesh.add(sideTanks);

        const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.9, 12), blueMat);
        boiler.rotation.x = Math.PI / 2;
        boiler.position.set(0, 1.95, 0.25);
        boiler.castShadow = true;
        this.mesh.add(boiler);

        const smokebox = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.45, 12), blackMat);
        smokebox.rotation.x = Math.PI / 2;
        smokebox.position.set(0, 1.95, 1.18);
        this.mesh.add(smokebox);

        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.6, 8), darkBlueMat);
        funnel.position.set(0, 2.8, 0.92);
        this.mesh.add(funnel);

        // Rear blue cab with gold-trimmed windows & black roof
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.38, 1.15), blueMat);
        cab.position.set(0, 1.74, -1.05);
        cab.castShadow = true;
        this.mesh.add(cab);

        const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 1.35), blackMat);
        cabRoof.position.set(0, 2.48, -1.05);
        this.mesh.add(cabRoof);

        for (const xSign of [-1, 1]) {
            const winRing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.42), goldMat);
            winRing.position.set(xSign * 0.96, 1.95, -1.02);
            this.mesh.add(winRing);

            const winGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.28), blackMat);
            winGlass.position.set(xSign * 0.97, 1.95, -1.02);
            this.mesh.add(winGlass);
        }

        // Giant bloated pale-beige spider abdomen behind the cab
        this.abdomen = new THREE.Group();
        this.abdomen.position.set(0, 1.95, -2.55);
        const sacMain = new THREE.Mesh(new THREE.BoxGeometry(2.25, 2.15, 2.25), boneMat);
        sacMain.castShadow = true;
        this.abdomen.add(sacMain);
        const sacCap = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.65, 2.65), boneMat);
        this.abdomen.add(sacCap);
        this.mesh.add(this.abdomen);

        // 6 tall arched pale-bone spider legs (3 per side) rising above boiler then dropping to ground
        this.spiderLegs = [];
        const legZPositions = [0.78, -0.1, -0.95];
        for (const zPos of legZPositions) {
            for (const sideSign of [-1, 1]) {
                const hip = new THREE.Vector3(sideSign * 0.9, 1.45, zPos);
                const knee = new THREE.Vector3(sideSign * 1.42, 1.45, zPos * 0.15);
                const foot = new THREE.Vector3(sideSign * 2.25, -1.45, zPos * 0.4);
                const leg = buildSpiderLegGroup(hip, knee, foot, 0.16, boneMat, boneMat, paleNeckMat);
                leg.userData.phaseOffset = zPos * 1.6 + (sideSign > 0 ? Math.PI : 0);
                this.mesh.add(leg);
                this.spiderLegs.push(leg);
            }
        }

        // Elongated pale grey curving worm-neck ending in creepy red-eyed Thomas head
        this.neckGroup = new THREE.Group();
        this.neckGroup.position.set(0, 1.95, 1.32);

        const neckSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.65), paleNeckMat);
        neckSeg1.position.set(0, 0.05, 0.3);
        this.neckGroup.add(neckSeg1);

        const neckSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.65), paleNeckMat);
        neckSeg2.position.set(0, 0.35, 0.72);
        neckSeg2.rotation.x = -0.35;
        this.neckGroup.add(neckSeg2);

        const neckSeg3 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.88, 0.65), paleNeckMat);
        neckSeg3.position.set(0, 0.62, 1.15);
        this.neckGroup.add(neckSeg3);

        const headMats = [paleNeckMat, paleNeckMat, paleNeckMat, paleNeckMat, faceMat, paleNeckMat];
        const thomasHead = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.55), headMats);
        thomasHead.position.set(0, 0.68, 1.56);
        thomasHead.castShadow = true;
        this.neckGroup.add(thomasHead);

        // Glowing red eye accents protruding slightly on the eerie Thomas face
        for (const xSign of [-1, 1]) {
            const glowEye = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.08), redEyeGlowMat);
            glowEye.position.set(xSign * 0.24, 0.76, 1.84);
            this.neckGroup.add(glowEye);
        }

        this.mesh.add(this.neckGroup);
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        const speedMag = Math.hypot(this.velocity.x, this.velocity.z);
        this.walkPhase += dt * (4.0 + speedMag * 2.1);

        if (this.attackAnimTimer > 0) {
            this.attackAnimTimer -= dt;
            const lunge = Math.sin((this.attackAnimTimer / 0.45) * Math.PI);
            if (this.neckGroup) {
                this.neckGroup.position.z = 1.32 + lunge * 0.55;
                this.neckGroup.rotation.x = lunge * 0.22;
            }
        } else if (this.neckGroup) {
            this.neckGroup.position.z = 1.32;
            this.neckGroup.rotation.x = Math.sin(this.walkPhase * 0.65) * 0.08;
            this.neckGroup.rotation.y = Math.cos(this.walkPhase * 0.5) * 0.12;
        }

        if (this.abdomen) {
            this.abdomen.rotation.y = Math.sin(this.walkPhase * 0.45) * 0.08;
        }

        if (this.spiderLegs) {
            const amp = speedMag > 0.2 ? 0.3 : 0.08;
            for (let i = 0; i < this.spiderLegs.length; i++) {
                const leg = this.spiderLegs[i];
                const swing = Math.sin(this.walkPhase + leg.userData.phaseOffset);
                leg.rotation.y = swing * amp;
                leg.rotation.z = Math.cos(this.walkPhase + leg.userData.phaseOffset) * (amp * 0.45);
            }
        }

        const { target } = findNearestBossTarget(this, 28.0, { landOnly: true, includeMinecarts: true });
        if (target) {
            const tPos = target.position;
            const angle = Math.atan2(tPos.x - this.position.x, tPos.z - this.position.z);
            this.mesh.rotation.y = angle;
            const currentSpeed = isLiquid ? this.speed * 0.45 : this.speed;
            this.velocity.x = Math.sin(angle) * currentSpeed;
            this.velocity.z = Math.cos(angle) * currentSpeed;

            const dist = this.position.distanceTo(tPos);
            if (dist < 3.6 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.05;
                this.attackAnimTimer = 0.45;
                sounds.playMonsterRoarSound('train');
                applyBossMeleeHit(this, target, 33, 46, 7.5, 5.0);
            }
        } else {
            this.wanderTimer -= dt;
            if (this.position.z >= SEA_START_Z - 1) {
                this.wanderAngle = Math.PI + (Math.random() - 0.5) * 0.8;
                this.wanderTimer = 1.8;
            } else if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.0 + Math.random() * 3.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.5);
            this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.5);
            this.mesh.rotation.y = this.wanderAngle;
        }

        if (isLiquid && Math.random() < 0.08) {
            this.velocity.y = 4.0;
        }
    }
}

export class Steve extends AllyHero {
    constructor(x, y, z, scene, world, game) {
        super('steve', x, y, z, scene, world, game);
    }

    initMesh() {
        const hairMat = createTrackedColorMat(this, 0x432d1c);
        const skinMat = createTrackedColorMat(this, 0xb58567);
        const shirtMat = createTrackedColorMat(this, 0x14b8b8);
        const pantsMat = createTrackedColorMat(this, 0x4736a8);
        const shoeMat = createTrackedColorMat(this, 0x52525b);

        const hairSideMat = createTrackedTexMat(this, textures.steveHairSide);
        const torsoFrontMat = createTrackedTexMat(this, textures.steveTorsoFront);
        const faceMat = createTrackedTexMat(this, createMobFaceTexture('steve'));

        const headMats = [hairSideMat, hairSideMat, hairMat, skinMat, faceMat, hairMat];
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
        head.position.set(0, 1.56, 0);
        head.castShadow = true;
        this.mesh.add(head);

        const torsoMats = [shirtMat, shirtMat, shirtMat, pantsMat, torsoFrontMat, shirtMat];
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.32), torsoMats);
        torso.position.set(0, 0.94, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        this.lArm = this.buildTwoToneLimb(0.22, 0.68, 0.22, shirtMat, 0.38, skinMat);
        this.lArm.position.set(-0.38, 1.28, 0);
        this.mesh.add(this.lArm);

        this.rArm = this.buildTwoToneLimb(0.22, 0.68, 0.22, shirtMat, 0.38, skinMat);
        this.rArm.position.set(0.38, 1.28, 0);
        this.mesh.add(this.rArm);

        this.lLeg = this.buildTwoToneLimb(0.24, 0.6, 0.24, pantsMat, 0.85, shoeMat);
        this.lLeg.position.set(-0.14, 0.6, 0);
        this.mesh.add(this.lLeg);

        this.rLeg = this.buildTwoToneLimb(0.24, 0.6, 0.24, pantsMat, 0.85, shoeMat);
        this.rLeg.position.set(0.14, 0.6, 0);
        this.mesh.add(this.rLeg);
    }
}

export class Alex extends AllyHero {
    constructor(x, y, z, scene, world, game) {
        super('alex', x, y, z, scene, world, game);
    }

    initMesh() {
        const hairMat = createTrackedColorMat(this, 0xea7a26);
        const skinMat = createTrackedColorMat(this, 0xf8d7be);
        const tunicMat = createTrackedColorMat(this, 0x73b06b);
        const pantsMat = createTrackedColorMat(this, 0x5c3c24);
        const bootMat = createTrackedColorMat(this, 0x3f3f46);

        const hairSideMat = createTrackedTexMat(this, textures.alexHairSide);
        const torsoFrontMat = createTrackedTexMat(this, textures.alexTorsoFront);
        const faceMat = createTrackedTexMat(this, createMobFaceTexture('alex'));

        const headMats = [hairSideMat, hairSideMat, hairMat, skinMat, faceMat, hairMat];
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
        head.position.set(0, 1.56, 0);
        head.castShadow = true;
        this.mesh.add(head);

        const torsoMats = [tunicMat, tunicMat, tunicMat, pantsMat, torsoFrontMat, tunicMat];
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.72, 0.32), torsoMats);
        torso.position.set(0, 0.94, 0);
        torso.castShadow = true;
        this.mesh.add(torso);

        // Slim Alex arms (0.18 width)
        this.lArm = this.buildTwoToneLimb(0.18, 0.68, 0.18, tunicMat, 0.38, skinMat);
        this.lArm.position.set(-0.36, 1.28, 0);
        this.mesh.add(this.lArm);

        this.rArm = this.buildTwoToneLimb(0.18, 0.68, 0.18, tunicMat, 0.38, skinMat);
        this.rArm.position.set(0.36, 1.28, 0);
        this.mesh.add(this.rArm);

        this.lLeg = this.buildTwoToneLimb(0.24, 0.6, 0.24, pantsMat, 0.74, bootMat);
        this.lLeg.position.set(-0.14, 0.6, 0);
        this.mesh.add(this.lLeg);

        this.rLeg = this.buildTwoToneLimb(0.24, 0.6, 0.24, pantsMat, 0.74, bootMat);
        this.rLeg.position.set(0.14, 0.6, 0);
        this.mesh.add(this.rLeg);
    }
}

export class Optimus extends AllyHero {
    constructor(x, y, z, scene, world, game) {
        super('optimus', x, y, z, scene, world, game);
        this.width = 1.05;
        this.height = 2.95;
    }

    initMesh() {
        const redMat = createTrackedColorMat(this, 0xdc2626);
        const blueMat = createTrackedColorMat(this, 0x1d4ed8);
        const silverMat = createTrackedColorMat(this, 0x9ca3af);
        const darkMetalMat = createTrackedColorMat(this, 0x18181b);
        const wheelMat = createTrackedColorMat(this, 0x09090b);
        const visorMat = createTrackedColorMat(this, 0xfacc15, true);
        const chestMat = createTrackedTexMat(this, textures.optimusChest);
        const grillMat = createTrackedTexMat(this, textures.optimusGrill);
        const faceMat = createTrackedTexMat(this, createMobFaceTexture('optimus'));

        // Helmet head with ear antennae + central crest
        const headMats = [blueMat, blueMat, blueMat, silverMat, faceMat, blueMat];
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), headMats);
        head.position.set(0, 2.52, 0);
        head.castShadow = true;
        this.mesh.add(head);

        for (const side of [-1, 1]) {
            const antenna = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.14), blueMat);
            antenna.position.set(side * 0.35, 2.74, 0);
            antenna.castShadow = true;
            this.mesh.add(antenna);
        }
        const crest = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.66), silverMat);
        crest.position.set(0, 2.86, 0);
        this.mesh.add(crest);

        const visorBar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.06), visorMat);
        visorBar.position.set(0, 2.56, 0.3);
        this.mesh.add(visorBar);

        // Red truck-cab chest + ribbed silver abdomen + shoulder smokestacks
        const torsoMats = [redMat, redMat, redMat, silverMat, chestMat, redMat];
        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.68, 0.54), torsoMats);
        chest.position.set(0, 1.84, 0);
        chest.castShadow = true;
        this.mesh.add(chest);

        const abdomen = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.42, 0.44), grillMat);
        abdomen.position.set(0, 1.32, 0);
        abdomen.castShadow = true;
        this.mesh.add(abdomen);

        for (const side of [-1, 1]) {
            const pipe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.1), silverMat);
            pipe.position.set(side * 0.54, 2.34, -0.14);
            pipe.castShadow = true;
            this.mesh.add(pipe);
        }

        // Broad Mech Arms (red pauldrons, silver biceps, red forearms, blue fists)
        const makeMechArm = () => {
            const grp = new THREE.Group();
            const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), redMat);
            pauldron.position.set(0, -0.14, 0);
            pauldron.castShadow = true;
            grp.add(pauldron);

            const bicep = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.24), silverMat);
            bicep.position.set(0, -0.46, 0);
            grp.add(bicep);

            const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.32), redMat);
            forearm.position.set(0, -0.82, 0);
            forearm.castShadow = true;
            grp.add(forearm);

            const fist = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), blueMat);
            fist.position.set(0, -1.12, 0);
            grp.add(fist);
            return grp;
        };

        this.lArm = makeMechArm();
        this.lArm.position.set(-0.66, 2.12, 0);
        this.mesh.add(this.lArm);

        this.rArm = makeMechArm();
        this.rArm.position.set(0.66, 2.12, 0);
        this.mesh.add(this.rArm);

        // Ion Blaster cannon mounted on right arm
        const blaster = new THREE.Group();
        blaster.position.set(0, -1.04, 0.28);
        const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.68), darkMetalMat);
        const barrelTip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.28), silverMat);
        barrelTip.position.set(0, 0.02, 0.44);
        blaster.add(gunBody, barrelTip);
        this.rArm.add(blaster);
        this.blasterGroup = blaster;

        // Heavy Legs (silver thighs, royal-blue shins with truck wheels, silver feet)
        const makeMechLeg = (side) => {
            const grp = new THREE.Group();
            const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.32), silverMat);
            thigh.position.set(0, -0.22, 0);
            thigh.castShadow = true;
            grp.add(thigh);

            const shin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.56, 0.4), blueMat);
            shin.position.set(0, -0.7, 0);
            shin.castShadow = true;
            grp.add(shin);

            for (const wy of [-0.56, -0.84]) {
                const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.22), wheelMat);
                wheel.position.set(side * 0.22, wy, 0);
                grp.add(wheel);
            }

            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.48), silverMat);
            foot.position.set(0, -1.04, 0.04);
            grp.add(foot);
            return grp;
        };

        this.lLeg = makeMechLeg(-1);
        this.lLeg.position.set(-0.24, 1.12, 0);
        this.mesh.add(this.lLeg);

        this.rLeg = makeMechLeg(1);
        this.rLeg.position.set(0.24, 1.12, 0);
        this.mesh.add(this.rLeg);
    }
}

// 26. SANDWORM (Colossal Ribbed Desert Worm Boss with Crimson Fang Maw)
export class Sandworm extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('sandworm', x, y, z, scene, world, game);
        this.hp = 680;
        this.maxHp = 680;
        this.width = 2.8;
        this.height = 4.6;
        this.speed = 2.15;
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.walkPhase = Math.random() * Math.PI * 2;
    }

    initMesh() {
        const skinMat = createTrackedTexMat(this, textures.sandwormSkin);
        const mawMat = createTrackedTexMat(this, textures.sandwormMaw);
        const fangMat = createTrackedColorMat(this, 0xd4d4d8);
        const crestMat = createTrackedColorMat(this, 0xcbd5e1);
        const sandMat = createTrackedColorMat(this, 0xd6be8a);

        // Sandy eruption base mound
        const baseRing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.42, 2.6), sandMat);
        baseRing.position.set(0, 0.21, 0);
        baseRing.receiveShadow = true;
        this.mesh.add(baseRing);

        // 5 curving articulated ribbed worm segments rising out of the ground
        this.wormSegments = [];
        const segSpecs = [
            { y: 0.72, z: -0.35, r: 2.0, h: 0.92, tilt: 0.15 },
            { y: 1.54, z: -0.2, r: 1.92, h: 0.92, tilt: 0.28 },
            { y: 2.34, z: 0.08, r: 1.88, h: 0.9, tilt: 0.44 },
            { y: 3.08, z: 0.48, r: 1.96, h: 0.9, tilt: 0.65 },
            { y: 3.68, z: 1.02, r: 2.12, h: 0.88, tilt: 0.9 }
        ];
        for (let i = 0; i < segSpecs.length; i++) {
            const spec = segSpecs[i];
            const seg = new THREE.Mesh(new THREE.BoxGeometry(spec.r, spec.h, spec.r), skinMat);
            seg.position.set(0, spec.y, spec.z);
            seg.rotation.x = spec.tilt;
            seg.castShadow = true;
            seg.userData.baseY = spec.y;
            seg.userData.baseZ = spec.z;
            seg.userData.baseTilt = spec.tilt;
            this.mesh.add(seg);
            this.wormSegments.push(seg);
        }

        // Massive crimson funnel maw + 12 jagged white fangs + rocky side crest
        this.mawGroup = new THREE.Group();
        this.mawGroup.position.set(0, 3.92, 1.44);
        this.mawGroup.rotation.x = 0.22;

        const mawFace = new THREE.Mesh(new THREE.BoxGeometry(2.34, 2.34, 0.56), [
            skinMat, skinMat, skinMat, skinMat, mawMat, skinMat
        ]);
        mawFace.castShadow = true;
        this.mawGroup.add(mawFace);

        const crest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.65, 0.88), crestMat);
        crest.position.set(1.16, 0.1, -0.18);
        crest.rotation.z = -0.12;
        this.mawGroup.add(crest);

        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            const fang = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.14), fangMat);
            fang.position.set(Math.cos(ang) * 0.98, Math.sin(ang) * 0.98, 0.36);
            fang.rotation.z = ang - Math.PI / 2;
            fang.rotation.x = 0.55;
            this.mawGroup.add(fang);
        }

        this.mesh.add(this.mawGroup);
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackAnimTimer > 0) this.attackAnimTimer -= dt;

        const speedMag = Math.hypot(this.velocity.x, this.velocity.z);
        this.walkPhase += dt * (2.6 + speedMag * 1.4);

        const lunge = this.attackAnimTimer > 0
            ? Math.sin((this.attackAnimTimer / 0.45) * Math.PI) * 0.55
            : 0;

        if (this.wormSegments) {
            for (let i = 0; i < this.wormSegments.length; i++) {
                const seg = this.wormSegments[i];
                const sway = Math.sin(this.walkPhase - i * 0.65) * (0.06 + i * 0.025);
                seg.position.x = sway;
                seg.position.z = seg.userData.baseZ + lunge * (i / this.wormSegments.length);
                seg.rotation.z = sway * 0.4;
            }
        }
        if (this.mawGroup) {
            this.mawGroup.position.z = 1.44 + lunge;
            this.mawGroup.position.x = Math.sin(this.walkPhase - 2.4) * 0.16;
            this.mawGroup.rotation.x = 0.22 + lunge * 0.28;
        }

        const { target } = findNearestBossTarget(this, 30.0, { landOnly: true, includeMinecarts: true });
        if (target) {
            const tPos = target.position;
            const angle = Math.atan2(tPos.x - this.position.x, tPos.z - this.position.z);
            this.mesh.rotation.y = angle;
            const currentSpeed = isLiquid ? this.speed * 0.45 : this.speed;
            this.velocity.x = Math.sin(angle) * currentSpeed;
            this.velocity.z = Math.cos(angle) * currentSpeed;

            const dist = this.position.distanceTo(tPos);
            if (dist < 3.9 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.15;
                this.attackAnimTimer = 0.45;
                sounds.playMonsterRoarSound('sea');
                applyBossMeleeHit(this, target, 36, 52, 8.5, 6.0);
            }
        } else {
            this.wanderTimer -= dt;
            if (this.position.z >= SEA_START_Z - 1) {
                this.wanderAngle = Math.PI + (Math.random() - 0.5) * 0.8;
                this.wanderTimer = 1.8;
            } else if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.2 + Math.random() * 3.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (this.speed * 0.45);
            this.velocity.z = Math.cos(this.wanderAngle) * (this.speed * 0.45);
            this.mesh.rotation.y = this.wanderAngle;
        }

        if (isLiquid && Math.random() < 0.08) {
            this.velocity.y = 4.2;
        }
        if (this.game?.particles && Math.random() < 0.18) {
            const mat = new THREE.MeshBasicMaterial({ color: 0xd6be8a });
            const p = new THREE.Mesh(SHARED_MOB_PARTICLE_GEO, mat);
            p.position.set(
                this.position.x + (Math.random() - 0.5) * 1.8,
                this.position.y + 0.3,
                this.position.z + (Math.random() - 0.5) * 1.8
            );
            this.scene.add(p);
            this.game.particles.push({
                mesh: p,
                velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5),
                life: 0.4,
                elapsed: 0,
                material: mat,
                sharedGeo: true
            });
        }
    }
}

// 27. BLOOP (Colossal Slate-Blue Deep-Sea Whale Leviathan Boss)
export class Bloop extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('bloop', x, y, z, scene, world, game);
        this.hp = 750;
        this.maxHp = 750;
        this.width = 3.4;
        this.height = 4.4;
        this.speed = 2.9;
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.swimPhase = Math.random() * Math.PI * 2;
    }

    initMesh() {
        const skinMat = createTrackedTexMat(this, textures.bloopSkin);
        const bellyMat = createTrackedColorMat(this, 0x334857);
        const mawMat = createTrackedTexMat(this, textures.bloopMaw);
        const toothMat = createTrackedColorMat(this, 0xe5e7eb);
        const eyeMat = createTrackedColorMat(this, 0x090d12);

        // Colossal boxy whale head & dark underside
        const upperCranium = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.15, 3.6), skinMat);
        upperCranium.position.set(0, 3.35, 0.2);
        upperCranium.castShadow = true;
        this.mesh.add(upperCranium);

        const browRidge = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.48, 3.3), skinMat);
        browRidge.position.set(0, 4.02, 0.12);
        browRidge.castShadow = true;
        this.mesh.add(browRidge);

        for (const xSign of [-1, 1]) {
            const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.0, 3.45), skinMat);
            cheek.position.set(xSign * 1.39, 1.95, 0.2);
            cheek.castShadow = true;
            this.mesh.add(cheek);

            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.24), eyeMat);
            eye.position.set(xSign * 1.48, 3.55, 1.85);
            this.mesh.add(eye);
        }

        const mawBack = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.45, 0.6), mawMat);
        mawBack.position.set(0, 2.1, -0.8);
        this.mesh.add(mawBack);

        // Gaping articulated jaws + 16 sharp white teeth
        this.mawGroup = new THREE.Group();
        this.mawGroup.position.set(0, 1.2, 0.45);

        const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.68, 3.1), bellyMat);
        lowerJaw.position.set(0, -0.25, 0.15);
        lowerJaw.castShadow = true;
        this.mawGroup.add(lowerJaw);

        const innerLower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 2.2), mawMat);
        innerLower.position.set(0, 0.12, 0.1);
        this.mawGroup.add(innerLower);

        for (let i = 0; i < 8; i++) {
            const angle = -Math.PI * 0.42 + (i / 7) * Math.PI * 0.84;
            const lx = Math.sin(angle) * 1.05;
            const lz = 1.45 - Math.abs(Math.cos(angle) * 0.18) + Math.cos(angle) * 0.25;

            const upperTooth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.18), toothMat);
            upperTooth.position.set(lx, 2.66, lz + 0.35);
            upperTooth.rotation.x = 0.16;
            this.mesh.add(upperTooth);

            const lowerTooth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.18), toothMat);
            lowerTooth.position.set(lx, 0.28, lz);
            lowerTooth.rotation.x = -0.18;
            this.mawGroup.add(lowerTooth);
        }

        this.mesh.add(this.mawGroup);

        // Wide sweeping pectoral fins
        const buildFin = (xSign) => {
            const pivot = new THREE.Group();
            pivot.position.set(xSign * 1.55, 1.45, -1.2);
            const blade = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.34, 1.35), skinMat);
            blade.position.set(xSign * 1.35, 0, -0.25);
            blade.rotation.y = xSign * -0.35;
            blade.castShadow = true;
            pivot.add(blade);
            this.mesh.add(pivot);
            return pivot;
        };
        this.leftFin = buildFin(-1);
        this.rightFin = buildFin(1);

        // 3 articulated tapering whale body & tail fluke segments
        this.tailSegments = [];
        const bodySpecs = [
            { w: 2.9, h: 2.8, l: 2.5, y: 2.2, z: -2.45 },
            { w: 2.1, h: 2.1, l: 2.3, y: 2.1, z: -4.65 },
            { w: 1.35, h: 1.4, l: 2.1, y: 2.0, z: -6.65 }
        ];
        for (let i = 0; i < bodySpecs.length; i++) {
            const spec = bodySpecs[i];
            const seg = new THREE.Group();
            seg.position.set(0, spec.y, spec.z);
            const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.l), skinMat);
            bodyBox.castShadow = true;
            seg.add(bodyBox);

            const bellyStripe = new THREE.Mesh(
                new THREE.BoxGeometry(spec.w * 0.88, spec.h * 0.28, spec.l * 0.96),
                bellyMat
            );
            bellyStripe.position.set(0, -spec.h * 0.38, 0);
            seg.add(bellyStripe);

            if (i === 2) {
                const fluke = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.28, 1.35), skinMat);
                fluke.position.set(0, 0, -1.25);
                fluke.castShadow = true;
                seg.add(fluke);
            }
            this.mesh.add(seg);
            this.tailSegments.push(seg);
        }
    }

    update(dt) {
        const feetBlock = this.world.getBlockAt(this.position.x, this.position.y, this.position.z);
        const midBlock = this.world.getBlockAt(this.position.x, this.position.y + 1.5, this.position.z);
        const upperBlock = this.world.getBlockAt(this.position.x, this.position.y + 2.8, this.position.z);
        const inWater = Boolean(
            (feetBlock && feetBlock.startsWith('water')) ||
            (midBlock && midBlock.startsWith('water')) ||
            (upperBlock && upperBlock.startsWith('water'))
        );
        this.gravity = inWater ? 0 : -25.0;
        super.update(dt);
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        this.swimPhase += dt * (isLiquid ? 3.2 : 1.8);

        if (this.attackAnimTimer > 0) {
            this.attackAnimTimer -= dt;
            const snap = Math.sin((this.attackAnimTimer / 0.5) * Math.PI);
            if (this.mawGroup) this.mawGroup.rotation.x = snap * 0.48;
        } else if (this.mawGroup) {
            this.mawGroup.rotation.x = Math.max(0, Math.sin(this.swimPhase * 0.65) * 0.14);
        }

        if (this.leftFin && this.rightFin) {
            this.leftFin.rotation.z = Math.sin(this.swimPhase) * 0.22;
            this.rightFin.rotation.z = -Math.sin(this.swimPhase) * 0.22;
        }

        if (this.tailSegments) {
            for (let i = 0; i < this.tailSegments.length; i++) {
                this.tailSegments[i].position.x = Math.sin(this.swimPhase - i * 0.85) * (0.2 + i * 0.14);
                this.tailSegments[i].rotation.y = Math.cos(this.swimPhase - i * 0.85) * 0.12;
            }
        }

        const hasOcean = Boolean(this.world.getBlockAt(0, 5, SEA_START_Z + 2)?.startsWith('water'));
        const { target } = findNearestBossTarget(this, 36.0, { seaOnly: hasOcean && isLiquid, includeMinecarts: !hasOcean });
        const activeSpeed = isLiquid ? this.speed : this.speed * 0.5;

        if (target) {
            const tPos = target.position;
            const angle = Math.atan2(tPos.x - this.position.x, tPos.z - this.position.z);
            this.mesh.rotation.y = angle;
            this.velocity.x = Math.sin(angle) * activeSpeed;
            this.velocity.z = Math.cos(angle) * activeSpeed;

            if (isLiquid) {
                this.velocity.y = THREE.MathUtils.clamp((3.2 - this.position.y) * 2.2, -2.5, 2.5);
                if (Math.random() < 0.2) {
                    spawnMobBurstParticle(
                        this,
                        0x7dd3fc,
                        this.position.x + (Math.random() - 0.5) * 3.0,
                        6.2,
                        this.position.z + (Math.random() - 0.5) * 2.6,
                        (Math.random() - 0.5) * 2.2,
                        2.5,
                        (Math.random() - 0.5) * 2.2,
                        0.45
                    );
                }
            }

            const horizDist = Math.hypot(tPos.x - this.position.x, tPos.z - this.position.z);
            if (horizDist < 4.4 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.2;
                this.attackAnimTimer = 0.5;
                sounds.playMonsterRoarSound('sea');
                applyBossMeleeHit(this, target, 38, 56, 9.0, 6.0);
            }
        } else {
            this.wanderTimer -= dt;
            if (hasOcean && this.position.z < SEA_START_Z + 3) {
                this.wanderAngle = (Math.random() - 0.5) * 0.9;
                this.wanderTimer = 1.6;
            } else if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.2 + Math.random() * 3.0;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (activeSpeed * 0.55);
            this.velocity.z = Math.cos(this.wanderAngle) * (activeSpeed * 0.55);
            this.mesh.rotation.y = this.wanderAngle;

            if (isLiquid) {
                const patrolY = 3.2 + Math.sin(this.swimPhase * 0.35) * 0.25;
                this.velocity.y = THREE.MathUtils.clamp((patrolY - this.position.y) * 2.0, -2.0, 2.0);
            }
        }
    }
}

// 28. WHALE EATER (Colossal Mottled Crimson-Red Octopus/Kraken Boss with Yellow-Banded Eyes & 8 Tentacles)
export class WhaleEater extends Mob {
    constructor(x, y, z, scene, world, game) {
        super('whaleeater', x, y, z, scene, world, game);
        this.hp = 760;
        this.maxHp = 760;
        this.width = 3.4;
        this.height = 4.2;
        this.speed = 2.85;
        this.attackCooldown = 0;
        this.attackAnimTimer = 0;
        this.swimPhase = Math.random() * Math.PI * 2;
    }

    initMesh() {
        const skinMat = createTrackedTexMat(this, textures.whaleEaterSkin);
        const eyeMat = createTrackedTexMat(this, textures.whaleEaterEye);
        const darkSkinMat = createTrackedColorMat(this, 0x7f1d1d);
        const beakMat = createTrackedColorMat(this, 0x5c1111);

        // Upright crimson octopus head & bulky rear mantle dome
        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 2.0, 0);

        const headCore = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.3, 2.2), skinMat);
        headCore.position.set(0, 0.35, 0.05);
        headCore.castShadow = true;
        this.headGroup.add(headCore);

        const rearDome = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.3, 2.6), skinMat);
        rearDome.position.set(0, 0.75, -1.25);
        rearDome.rotation.x = -0.22;
        rearDome.castShadow = true;
        this.headGroup.add(rearDome);

        const crownCrest = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 2.1), darkSkinMat);
        crownCrest.position.set(0, 1.55, -0.55);
        this.headGroup.add(crownCrest);

        // Prominent protruding yellow-and-brown banded octopus eyes on upper-front corners
        for (const xSign of [-1, 1]) {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.72), [
                skinMat, skinMat, skinMat, skinMat, eyeMat, skinMat
            ]);
            eye.position.set(xSign * 1.05, 1.05, 0.92);
            eye.rotation.y = xSign * 0.2;
            eye.castShadow = true;
            this.headGroup.add(eye);
        }

        const beak = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.55, 0.95), beakMat);
        beak.position.set(0, -0.68, 0.88);
        this.headGroup.add(beak);

        this.mesh.add(this.headGroup);

        // 8 long articulated spreading crimson tentacles fanning forward, sideways, and back
        this.tentacles = [];
        const tentacleAngles = [-0.72, -0.26, 0.26, 0.72, -1.25, 1.25, -1.95, 1.95];
        for (let i = 0; i < tentacleAngles.length; i++) {
            const ang = tentacleAngles[i];
            const pivot = new THREE.Group();
            pivot.position.set(Math.sin(ang) * 0.95, 0.9, Math.cos(ang) * 0.95);
            pivot.rotation.y = ang;
            pivot.userData.baseAngle = ang;

            const innerSeg = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.68, 2.2), skinMat);
            innerSeg.position.set(0, -0.25, 1.05);
            innerSeg.rotation.x = 0.24;
            innerSeg.castShadow = true;
            pivot.add(innerSeg);

            const outerSeg = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 2.9), skinMat);
            outerSeg.position.set(0, -0.55, 3.25);
            outerSeg.castShadow = true;
            pivot.add(outerSeg);

            const suckerStrip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 2.75), darkSkinMat);
            suckerStrip.position.set(0, -0.8, 3.25);
            pivot.add(suckerStrip);

            const tipSeg = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 1.15), skinMat);
            tipSeg.position.set(0, -0.6, 5.15);
            tipSeg.castShadow = true;
            pivot.add(tipSeg);

            this.mesh.add(pivot);
            this.tentacles.push(pivot);
        }
    }

    update(dt) {
        const feetBlock = this.world.getBlockAt(this.position.x, this.position.y, this.position.z);
        const midBlock = this.world.getBlockAt(this.position.x, this.position.y + 1.4, this.position.z);
        const upperBlock = this.world.getBlockAt(this.position.x, this.position.y + 2.6, this.position.z);
        const inWater = Boolean(
            (feetBlock && feetBlock.startsWith('water')) ||
            (midBlock && midBlock.startsWith('water')) ||
            (upperBlock && upperBlock.startsWith('water'))
        );
        this.gravity = inWater ? 0 : -25.0;
        super.update(dt);
    }

    updateAI(dt, isLiquid) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.attackAnimTimer > 0) this.attackAnimTimer -= dt;
        this.swimPhase += dt * (isLiquid ? 3.1 : 2.1);

        const lunge = this.attackAnimTimer > 0
            ? Math.sin((this.attackAnimTimer / 0.5) * Math.PI)
            : 0;

        if (this.headGroup) {
            this.headGroup.position.y = 2.0 + Math.sin(this.swimPhase * 0.8) * 0.14 + lunge * 0.25;
            this.headGroup.rotation.x = lunge * 0.22;
        }

        if (this.tentacles) {
            for (let i = 0; i < this.tentacles.length; i++) {
                const tent = this.tentacles[i];
                const wave = Math.sin(this.swimPhase * 1.15 + i * 0.8);
                tent.rotation.x = wave * 0.08 - lunge * 0.18;
                tent.rotation.y = tent.userData.baseAngle + Math.cos(this.swimPhase * 0.9 + i * 0.7) * 0.09;
            }
        }

        const { target } = findNearestBossTarget(this, 36.0, { landOnly: false, includeMinecarts: true });
        const activeSpeed = isLiquid ? this.speed : this.speed * 0.9;

        if (target) {
            const tPos = target.position;
            const angle = Math.atan2(tPos.x - this.position.x, tPos.z - this.position.z);
            this.mesh.rotation.y = angle;
            this.velocity.x = Math.sin(angle) * activeSpeed;
            this.velocity.z = Math.cos(angle) * activeSpeed;

            if (isLiquid) {
                this.velocity.y = THREE.MathUtils.clamp((3.0 - this.position.y) * 2.2, -2.4, 2.4);
            }

            const horizDist = Math.hypot(tPos.x - this.position.x, tPos.z - this.position.z);
            if (horizDist < 4.6 && this.attackCooldown <= 0) {
                this.attackCooldown = 1.15;
                this.attackAnimTimer = 0.5;
                sounds.playMonsterRoarSound('sea');
                applyBossMeleeHit(this, target, 38, 56, 8.5, 6.5);
                if (Math.random() < 0.85) {
                    spawnMobBurstParticle(
                        this,
                        0xdc2626,
                        this.position.x + (Math.random() - 0.5) * 2.6,
                        this.position.y + 1.2,
                        this.position.z + (Math.random() - 0.5) * 2.6,
                        (Math.random() - 0.5) * 2.4,
                        2.6,
                        (Math.random() - 0.5) * 2.4,
                        0.45
                    );
                }
            }
        } else {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 2.4 + Math.random() * 2.8;
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.velocity.x = Math.sin(this.wanderAngle) * (activeSpeed * 0.5);
            this.velocity.z = Math.cos(this.wanderAngle) * (activeSpeed * 0.5);
            this.mesh.rotation.y = this.wanderAngle;

            if (isLiquid) {
                const patrolY = 3.0 + Math.sin(this.swimPhase * 0.35) * 0.2;
                this.velocity.y = THREE.MathUtils.clamp((patrolY - this.position.y) * 2.0, -2.0, 2.0);
            }
        }
    }
}




