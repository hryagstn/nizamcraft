import * as THREE from 'three';
import { sounds } from '../utils/audio.js';
import { textures } from '../utils/textures.js';
import { isSolidBlock, parseBlockState, entityOverlapsBlock, LASER_DIRECTION_VECTORS } from '../utils/gameData.js';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

const FACING_QUATS = {
    up: new THREE.Quaternion(),
    down: new THREE.Quaternion().setFromAxisAngle(AXIS_X, Math.PI),
    s: new THREE.Quaternion().setFromAxisAngle(AXIS_X, Math.PI / 2),
    n: new THREE.Quaternion().setFromAxisAngle(AXIS_X, -Math.PI / 2),
    e: new THREE.Quaternion().setFromAxisAngle(AXIS_Z, -Math.PI / 2),
    w: new THREE.Quaternion().setFromAxisAngle(AXIS_Z, Math.PI / 2)
};

const LASER_FACING_QUATS = {};
for (const [dirKey, vec] of Object.entries(LASER_DIRECTION_VECTORS)) {
    if (dirKey === 'down') {
        LASER_FACING_QUATS[dirKey] = FACING_QUATS.down.clone();
    } else {
        const target = new THREE.Vector3(vec.x, vec.y, vec.z).normalize();
        LASER_FACING_QUATS[dirKey] = new THREE.Quaternion().setFromUnitVectors(AXIS_Y, target);
    }
}

export class FallingBlock {
    constructor(x, y, z, type, scene, world, game, chestData = null) {
        this.x = Math.round(x);
        this.y = y;
        this.z = Math.round(z);
        this.type = type || 'sand';
        this.scene = scene;
        this.world = world;
        this.game = game;
        this.chestData = chestData;
        this.vy = 0;
        this.mesh = null;
        this.material = null;
        this.sharedGeometry = false;
        this.sharedMaterial = false;
        this.initMesh();
    }

    initMesh() {
        const parsed = parseBlockState(this.type);
        const baseType = parsed.base;
        const instMesh = this.world?.instancedMeshMap?.get(baseType);

        if (instMesh) {
            this.material = instMesh.material;
            this.mesh = new THREE.Mesh(instMesh.geometry, this.material);
            this.sharedGeometry = true;
            this.sharedMaterial = true;
        } else {
            const tex = textures[baseType] || textures.sand;
            const geo = new THREE.BoxGeometry(1, 1, 1);
            this.material = new THREE.MeshLambertMaterial({ map: tex });
            this.mesh = new THREE.Mesh(geo, this.material);
            this.sharedGeometry = false;
            this.sharedMaterial = false;
        }

        if (baseType === 'laser') {
            this.mesh.quaternion.copy(LASER_FACING_QUATS[parsed.facing] || FACING_QUATS.up);
        } else if (baseType === 'piston') {
            this.mesh.quaternion.copy(FACING_QUATS[parsed.facing] || FACING_QUATS.up);
        }

        this.mesh.position.set(this.x, this.y, this.z);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
    }

    cleanup() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (!this.sharedGeometry && this.mesh.geometry) {
                this.mesh.geometry.dispose();
            }
            this.mesh = null;
        }
        if (this.material && !this.sharedMaterial) {
            if (Array.isArray(this.material)) {
                this.material.forEach(mat => mat.dispose());
            } else {
                this.material.dispose();
            }
        }
        this.material = null;
    }

    update(dt) {
        const clampedDt = Math.min(Math.max(dt || 0, 0), 0.05);
        const prevY = this.y;
        this.vy = Math.max(-28, this.vy - 22.0 * clampedDt);
        this.y += this.vy * clampedDt;

        const startCheckY = Math.floor(prevY - 1e-6);
        const endCheckY = Math.floor(this.y - 1e-6);
        const maxGridY = (this.world?.height ?? 24) - 1;

        for (let cy = startCheckY; cy >= endCheckY; cy--) {
            if (cy < 0 || isSolidBlock(this.world.getBlockAt(this.x, cy, this.z))) {
                let landY = Math.max(0, cy + 1);
                while (landY < maxGridY && isSolidBlock(this.world.getBlockAt(this.x, landY, this.z))) {
                    landY++;
                }

                this.cleanup();
                this.world.addBlock(this.x, landY, this.z, this.type, true);

                if (this.chestData && this.game?.chests) {
                    this.game.chests[`${this.x},${landY},${this.z}`] = this.chestData;
                }

                const player = this.game?.player;
                if (
                    player &&
                    !player.ridingMinecart &&
                    entityOverlapsBlock(
                        player.position.x,
                        player.position.y,
                        player.position.z,
                        player.width / 2,
                        player.height,
                        this.x,
                        landY,
                        this.z
                    )
                ) {
                    player.position.y = Math.max(player.position.y, landY + 0.5);
                    if (player.camera) {
                        player.camera.position.y = player.position.y + player.eyeHeight;
                    }
                }

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
