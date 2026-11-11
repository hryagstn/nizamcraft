import * as THREE from 'three';
import { sounds } from '../utils/audio.js';
import { textures } from '../utils/textures.js';
import { normalizeBlockType } from '../utils/gameData.js';

const SHARED_EXPLOSION_PARTICLE_GEO = new THREE.BoxGeometry(0.18, 0.18, 0.18);

export class PrimedTNT {
    constructor(x, y, z, scene, world, game) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.scene = scene;
        this.world = world;
        this.game = game;

        this.fuse = 3.0;
        this.elapsed = 0;

        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5,
            4.0,
            (Math.random() - 0.5) * 1.5
        );
        this.width = 0.96;
        this.height = 0.96;

        this.mesh = null;
        this.materials = [];
        this.initMesh();

        sounds.playFuseSound();
    }

    initMesh() {
        const geometry = new THREE.BoxGeometry(this.width, this.height, this.width);

        const sideMat = new THREE.MeshLambertMaterial({
            map: textures.tntSide,
            emissive: new THREE.Color(0x000000),
            emissiveIntensity: 0
        });
        const topMat = new THREE.MeshLambertMaterial({
            map: textures.tntTop,
            emissive: new THREE.Color(0x000000),
            emissiveIntensity: 0
        });

        this.materials = [sideMat, topMat];

        this.mesh = new THREE.Mesh(geometry, [
            sideMat, sideMat, topMat, topMat, sideMat, sideMat
        ]);
        this.mesh.position.set(this.x, this.y, this.z);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
    }

    cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
        }
        this.materials.forEach(mat => mat.dispose());
        this.materials = [];
    }

    checkCollisions(pos, preferTop = true) {
        return this.world.checkAABB(pos.x, pos.y, pos.z, this.width / 2, this.height, true, preferTop);
    }

    update(dt) {
        this.elapsed += dt;
        if (this.elapsed >= this.fuse) {
            this.explode();
            return false;
        }

        this.velocity.y -= 18.0 * dt;
        const nextPos = this.mesh.position.clone();

        nextPos.x += this.velocity.x * dt;
        if (this.checkCollisions(nextPos)) {
            nextPos.x = this.mesh.position.x;
            this.velocity.x *= -0.4;
        }

        nextPos.z += this.velocity.z * dt;
        if (this.checkCollisions(nextPos)) {
            nextPos.z = this.mesh.position.z;
            this.velocity.z *= -0.4;
        }

        nextPos.y += this.velocity.y * dt;
        const hitY = this.checkCollisions(nextPos, this.velocity.y <= 0);
        if (hitY) {
            if (this.velocity.y < 0) {
                nextPos.y = hitY.y + 0.5 + this.height / 2;
                this.velocity.y = 0;
                this.velocity.x *= 0.8;
                this.velocity.z *= 0.8;
            } else {
                nextPos.y = hitY.y - 0.5 - this.height / 2;
                this.velocity.y = 0;
            }
        }

        this.mesh.position.copy(nextPos);

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

        this.cleanup();
        sounds.playExplosionSound();
        this.createExplosionParticles(ex, ey + 0.3, ez);

        const radius = 3.5;
        let blocksChanged = false;

        for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
            for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
                for (let dz = -Math.ceil(radius); dz <= Math.ceil(radius); dz++) {
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (dist > radius) continue;

                    const tx = Math.round(ex + dx);
                    const ty = Math.round(ey + dy);
                    const tz = Math.round(ez + dz);

                    const blockType = this.world.getBlockAt(tx, ty, tz);
                    if (!blockType) continue;

                    const baseType = normalizeBlockType(blockType);
                    if (baseType === 'tnt') {
                        this.world.removeBlock(tx, ty, tz, true, true);
                        const primedTnt = new PrimedTNT(tx, ty, tz, this.scene, this.world, this.game);
                        primedTnt.fuse = 0.1 + Math.random() * 0.4;
                        if (!this.game.tnts) this.game.tnts = [];
                        this.game.tnts.push(primedTnt);
                        blocksChanged = true;
                    } else if (baseType !== 'obsidian') {
                        this.world.removeBlock(tx, ty, tz, true, true);
                        blocksChanged = true;
                    }
                }
            }
        }

        if (blocksChanged) {
            this.world.updateMesh();
        }

        if (this.game.player) {
            const playerPos = this.game.player.position.clone();
            playerPos.y += this.game.player.height / 2;
            const center = new THREE.Vector3(ex, ey, ez);
            const playerDist = center.distanceTo(playerPos);

            if (playerDist < 7.0) {
                const pushDir = playerPos.clone().sub(center).normalize();
                const factor = (7.0 - playerDist) / 7.0;
                pushDir.y += 0.35;
                pushDir.normalize();
                this.game.player.velocity.addScaledVector(pushDir, factor * 14.0);
                this.game.player.takeDamage(Math.round(factor * 65.0));
            }
        }

        if (this.game.mobs) {
            const center = new THREE.Vector3(ex, ey, ez);
            for (let i = this.game.mobs.length - 1; i >= 0; i--) {
                const mob = this.game.mobs[i];
                if (!mob || mob.type === 'minecart') continue;
                const mobCenter = mob.position.clone();
                mobCenter.y += mob.height / 2;
                const mobDist = center.distanceTo(mobCenter);

                if (mobDist < 7.0) {
                    const pushDir = mobCenter.clone().sub(center).normalize();
                    const factor = (7.0 - mobDist) / 7.0;
                    pushDir.y += 0.35;
                    pushDir.normalize();
                    mob.velocity.addScaledVector(pushDir, factor * 14.0);
                    mob.takeDamage(Math.round(factor * 80));
                }
            }
        }
    }

    createExplosionParticles(x, y, z) {
        const particleCount = 28;
        const particlesList = [];
        const colors = [0x555555, 0x777777, 0xff5500, 0xffaa00, 0xffea00];

        for (let i = 0; i < particleCount; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            const mat = new THREE.MeshBasicMaterial({ color });
            const mesh = new THREE.Mesh(SHARED_EXPLOSION_PARTICLE_GEO, mat);

            mesh.position.set(
                x + (Math.random() - 0.5) * 0.8,
                y + (Math.random() - 0.5) * 0.8,
                z + (Math.random() - 0.5) * 0.8
            );

            const speed = 2.0 + Math.random() * 5.0;
            const velocity = new THREE.Vector3(
                Math.random() - 0.5,
                (Math.random() - 0.3) * 1.5,
                Math.random() - 0.5
            ).normalize().multiplyScalar(speed);

            this.scene.add(mesh);
            particlesList.push({
                mesh,
                velocity,
                life: 0.6 + Math.random() * 0.5,
                elapsed: 0,
                material: mat,
                sharedGeo: true
            });
        }

        if (!this.game.particles) this.game.particles = [];
        this.game.particles.push(...particlesList);
    }
}
