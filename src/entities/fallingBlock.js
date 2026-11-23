import * as THREE from 'three';
import { sounds } from '../utils/audio.js';
import { textures } from '../utils/textures.js';
import { isSolidBlock, normalizeBlockType } from '../utils/gameData.js';

export class FallingBlock {
    constructor(x, y, z, type, scene, world, game) {
        this.x = Math.round(x);
        this.y = y;
        this.z = Math.round(z);
        this.type = type || 'sand';
        this.scene = scene;
        this.world = world;
        this.game = game;
        this.vy = 0;
        this.mesh = null;
        this.material = null;
        this.initMesh();
    }

    initMesh() {
        const baseType = normalizeBlockType(this.type);
        const tex = textures[baseType] || textures.sand;
        const geo = new THREE.BoxGeometry(1, 1, 1);
        this.material = new THREE.MeshLambertMaterial({ map: tex });
        this.mesh = new THREE.Mesh(geo, this.material);
        this.mesh.position.set(this.x, this.y, this.z);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
    }

    cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            this.mesh = null;
        }
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
    }

    update(dt) {
        const clampedDt = Math.min(Math.max(dt || 0, 0), 0.05);
        const prevY = this.y;
        this.vy = Math.max(-28, this.vy - 22.0 * clampedDt);
        this.y += this.vy * clampedDt;

        const startCheckY = Math.floor(prevY - 0.5);
        const endCheckY = Math.floor(this.y - 0.5);
        for (let cy = startCheckY; cy >= endCheckY; cy--) {
            if (cy <= 0 || isSolidBlock(this.world.getBlockAt(this.x, cy, this.z))) {
                const landY = Math.max(1, cy + 1);
                this.cleanup();
                this.world.addBlock(this.x, landY, this.z, this.type, true);
                sounds.playPlaceSound();
                this.game?.onTopologyChanged?.(this.x, landY, this.z);
                return false;
            }
        }

        if (this.mesh) {
            this.mesh.position.y = this.y;
        }
        return true;
    }
}
