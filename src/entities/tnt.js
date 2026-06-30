import * as THREE from 'three';
import { sounds } from '../utils/audio.js';
import { textures } from '../utils/textures.js';

export class PrimedTNT {
    constructor(x, y, z, scene, world, game) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.scene = scene;
        this.world = world;
        this.game = game;

        this.fuse = 3.0; // 3 seconds fuse
        this.elapsed = 0;

        // Physical properties
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            4.0, // slight upward hop on ignition
            (Math.random() - 0.5) * 1.5
        );
        this.width = 0.98;
        this.height = 0.98;

        this.mesh = null;
        this.materials = [];
        this.initMesh();

        sounds.playFuseSound();
    }

    initMesh() {
        const geometry = new THREE.BoxGeometry(this.width, this.height, this.width);
        
        // TNT materials (sides, top, bottom)
        const tntSideMat = new THREE.MeshLambertMaterial({ 
            map: textures.tntSide,
            emissive: new THREE.Color(0x000000),
            emissiveIntensity: 0
        });
        const tntTopMat = new THREE.MeshLambertMaterial({ 
            map: textures.tntTop,
            emissive: new THREE.Color(0x000000),
            emissiveIntensity: 0
        });

        this.materials = [
            tntSideMat.clone(), // +X
            tntSideMat.clone(), // -X
            tntTopMat.clone(),  // +Y
            tntTopMat.clone(),  // -Y
            tntSideMat.clone(), // +Z
            tntSideMat.clone()  // -Z
        ];

        this.mesh = new THREE.Mesh(geometry, this.materials);
        this.mesh.position.set(this.x, this.y, this.z);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
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

    update(dt) {
        this.elapsed += dt;
        if (this.elapsed >= this.fuse) {
            this.explode();
            return false; // Tells the coordinator to delete this TNT
        }

        // Apply gravity
        this.velocity.y -= 18.0 * dt;

        // Axis-by-axis physics with collision checking
        const nextPos = this.mesh.position.clone();

        // X movement
        nextPos.x += this.velocity.x * dt;
        if (this.checkCollisions(nextPos)) {
            nextPos.x = this.mesh.position.x;
            this.velocity.x *= -0.4; // bounce
        }

        // Z movement
        nextPos.z += this.velocity.z * dt;
        if (this.checkCollisions(nextPos)) {
            nextPos.z = this.mesh.position.z;
            this.velocity.z *= -0.4; // bounce
        }

        // Y movement
        nextPos.y += this.velocity.y * dt;
        if (this.checkCollisions(nextPos)) {
            if (this.velocity.y < 0) {
                // Landed on floor
                nextPos.y = Math.ceil(nextPos.y);
                this.velocity.y = 0;
                // Friction
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
            } else {
                // Hit ceiling
                nextPos.y = Math.floor(nextPos.y);
                this.velocity.y = 0;
            }
        }

        this.mesh.position.copy(nextPos);

        // White/red flashing animation
        // Flashes faster as fuse runs down
        const flashSpeed = this.fuse - this.elapsed < 1.0 ? 30 : 12;
        const flash = Math.sin(this.elapsed * flashSpeed) * 0.5 + 0.5 > 0.5;
        
        this.materials.forEach(mat => {
            if (flash) {
                mat.emissive.setHex(0xffffff);
                mat.emissiveIntensity = 0.85;
            } else {
                mat.emissive.setHex(0x000000);
                mat.emissiveIntensity = 0;
            }
        });

        return true;
    }

    explode() {
        const ex = this.mesh.position.x;
        const ey = this.mesh.position.y;
        const ez = this.mesh.position.z;

        // 1. Clean up mesh
        this.scene.remove(this.mesh);
        this.materials.forEach(mat => mat.dispose());

        // 2. Play explosion sound
        sounds.playExplosionSound();

        // 3. Create smoke/fire blocky particles
        this.createExplosionParticles(ex, ey + 0.5, ez);

        // 4. Destroy blocks in spherical radius (radius = 3.5)
        const radius = 3.5;
        let blocksChanged = false;
        
        for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
            for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
                for (let dz = -Math.ceil(radius); dz <= Math.ceil(radius); dz++) {
                    const tx = Math.round(ex + dx);
                    const ty = Math.round(ey + dy);
                    const tz = Math.round(ez + dz);
                    
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    if (dist <= radius) {
                        const blockType = this.world.getBlockAt(tx, ty, tz);
                        if (blockType) {
                            const baseType = blockType.split('_')[0];
                            // Obsidian is blast resistant!
                            if (baseType === 'tnt') {
                                this.world.removeBlock(tx, ty, tz, true, true); // silent & skipUpdate
                                const primedTnt = new PrimedTNT(tx, ty, tz, this.scene, this.world, this.game);
                                primedTnt.fuse = 0.1 + Math.random() * 0.4; // chain reaction delay
                                if (!this.game.tnts) this.game.tnts = [];
                                this.game.tnts.push(primedTnt);
                                blocksChanged = true;
                            } else if (baseType !== 'obsidian') {
                                this.world.removeBlock(tx, ty, tz, true, true); // silent & skipUpdate
                                blocksChanged = true;
                            }
                        }
                    }
                }
            }
        }

        if (blocksChanged) {
            this.world.updateMesh();
        }

        // 5. Apply knockback and damage to Player
        const playerPos = this.game.player.position.clone();
        playerPos.y += this.game.player.height / 2; // player center
        const playerDist = this.mesh.position.distanceTo(playerPos);
        
        if (playerDist < 7.0) {
            const pushDir = playerPos.clone().sub(this.mesh.position).normalize();
            // Force drops exponentially with distance
            const factor = (7.0 - playerDist) / 7.0;
            const force = factor * 14.0;
            const damage = Math.round(factor * 65.0);

            pushDir.y += 0.35; // push slightly upwards
            pushDir.normalize();

            this.game.player.velocity.addScaledVector(pushDir, force);
            this.game.player.takeDamage(damage);
        }

        // 6. Apply knockback and damage to Mobs
        if (this.game.mobs) {
            this.game.mobs.forEach(mob => {
                const mobCenter = mob.position.clone();
                mobCenter.y += mob.height / 2;
                const mobDist = this.mesh.position.distanceTo(mobCenter);
                
                if (mobDist < 7.0) {
                    const pushDir = mobCenter.clone().sub(this.mesh.position).normalize();
                    const factor = (7.0 - mobDist) / 7.0;
                    const force = factor * 14.0;
                    const damage = Math.round(factor * 80);

                    pushDir.y += 0.35;
                    pushDir.normalize();

                    mob.velocity.addScaledVector(pushDir, force);
                    mob.takeDamage(damage);
                }
            });
        }
    }

    createExplosionParticles(x, y, z) {
        const particleCount = 28;
        const particleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
        const particlesList = [];

        // Colors representing explosion (smoke, orange fire, yellow sparks)
        const colors = [0x555555, 0x777777, 0xff5500, 0xffaa00, 0xffea00];

        for (let i = 0; i < particleCount; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const mat = new THREE.MeshBasicMaterial({ color: color });
            const mesh = new THREE.Mesh(particleGeo, mat);

            // Spawn clustered around center
            mesh.position.set(
                x + (Math.random() - 0.5) * 0.8,
                y + (Math.random() - 0.5) * 0.8,
                z + (Math.random() - 0.5) * 0.8
            );

            // Explosive expanding velocities
            const speed = 2.0 + Math.random() * 5.0;
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.3) * 1.5, // slightly more upwards bias
                (Math.random() - 0.5)
            ).normalize().multiplyScalar(speed);

            this.scene.add(mesh);

            particlesList.push({
                mesh: mesh,
                velocity: velocity,
                life: 0.6 + Math.random() * 0.5, // life in seconds
                elapsed: 0,
                material: mat
            });
        }

        // Add to game particles list to be animated in main game loop
        if (!this.game.particles) this.game.particles = [];
        this.game.particles.push(...particlesList);
    }
}
