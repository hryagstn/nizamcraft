import * as THREE from 'three';
import { getTerrainHeight } from '../utils/noise.js';
import { sounds } from '../utils/audio.js';
import { textures } from '../utils/textures.js';

// Block Types Configuration
export const BLOCK_TYPES = {
    grass: { id: 1, name: 'Grass', color: 0x55a630 },
    dirt: { id: 2, name: 'Dirt', color: 0x8c5b36 },
    stone: { id: 3, name: 'Stone', color: 0x7c7c7c },
    obsidian: { id: 4, name: 'Obsidian', color: 0x240046 },
    wood: { id: 5, name: 'Wood', color: 0x9c6644 },
    leaf: { id: 6, name: 'Leaf', color: 0x2d6a4f },
    brick: { id: 7, name: 'Brick', color: 0xc35136 },
    emerald: { id: 8, name: 'Emerald', color: 0x00f5d4 },
    diamond: { id: 9, name: 'Diamond', color: 0x70d6ff },
    ender: { id: 10, name: 'Ender', color: 0x3c096c },
    tnt: { id: 11, name: 'TNT', color: 0xd90429 },
    water: { id: 12, name: 'Water', color: 0x3a86ff },
    lava: { id: 13, name: 'Lava', color: 0xff5500 },
    quartz: { id: 14, name: 'Quartz', color: 0xf5f4f0 },
    sand: { id: 15, name: 'Sand', color: 0xe5cca4 },
    farmland: { id: 16, name: 'Farmland', color: 0x4c321d },
    lucky: { id: 17, name: 'Lucky', color: 0xffb703 },
    magma: { id: 18, name: 'Magma', color: 0xff3700 },
    crop: { id: 19, name: 'Crop', color: 0x8fc93a }
};

export class World {
    constructor(scene) {
        this.scene = scene;
        
        // Expanded World Dimensions (64x24x64)
        this.width = 64;
        this.height = 24;
        this.depth = 64;
        
        // Offset to center the world at (0, 0)
        this.xOffset = -this.width / 2;
        this.zOffset = -this.depth / 2;

        this.grid = new Array(this.width * this.height * this.depth);
        this.instancedMeshMap = new Map();
        this.blockTypesList = ['grass', 'dirt', 'stone', 'obsidian', 'wood', 'leaf', 'brick', 'emerald', 'diamond', 'ender', 'tnt', 'water', 'lava', 'quartz', 'sand', 'farmland', 'lucky', 'magma', 'crop', 'coal_ore', 'iron_ore', 'gold_ore', 'chest'];

        // Highlight box helper for targeting
        this.highlightBox = null;

        // Active liquid ticking state
        this.liquidTimer = 0;

        this.init();
    }

    getGridIndex(x, y, z) {
        const lx = Math.round(x) - this.xOffset;
        const ly = Math.round(y);
        const lz = Math.round(z) - this.zOffset;
        if (lx < 0 || lx >= this.width || ly < 0 || ly >= this.height || lz < 0 || lz >= this.depth) {
            return -1;
        }
        return lx * (this.height * this.depth) + ly * this.depth + lz;
    }

    init() {
        // Setup materials for each block type using procedural canvas textures
        const grassSideMat = new THREE.MeshLambertMaterial({ map: textures.grassSide });
        const grassTopMat = new THREE.MeshLambertMaterial({ map: textures.grassTop });
        const dirtMat = new THREE.MeshLambertMaterial({ map: textures.dirt });
        const stoneMat = new THREE.MeshLambertMaterial({ map: textures.stone });
        const obsidianMat = new THREE.MeshLambertMaterial({ map: textures.obsidian });
        const woodSideMat = new THREE.MeshLambertMaterial({ map: textures.woodSide });
        const woodTopMat = new THREE.MeshLambertMaterial({ map: textures.woodTop });
        
        const leafMat = new THREE.MeshLambertMaterial({ 
            map: textures.leaf, 
            transparent: true, 
            alphaTest: 0.15 
        });
        
        const brickMat = new THREE.MeshLambertMaterial({ map: textures.brick });
        const emeraldMat = new THREE.MeshLambertMaterial({ map: textures.emerald });
        const diamondMat = new THREE.MeshLambertMaterial({ map: textures.diamond });
        const enderMat = new THREE.MeshLambertMaterial({ map: textures.ender });
        
        const tntSideMat = new THREE.MeshLambertMaterial({ map: textures.tntSide, color: 0xd90429 });
        const tntTopMat = new THREE.MeshLambertMaterial({ map: textures.tntTop, color: 0xd90429 });
        
        const waterMat = new THREE.MeshLambertMaterial({ 
            map: textures.water, 
            color: 0x3a86ff,
            transparent: true, 
            opacity: 0.65, 
            depthWrite: false, 
            side: THREE.DoubleSide 
        });
        
        const lavaMat = new THREE.MeshLambertMaterial({ 
            map: textures.lava, 
            color: 0xff5500,
            emissive: new THREE.Color(0xff3300), 
            emissiveIntensity: 0.8
        });

        const quartzMat = new THREE.MeshLambertMaterial({ map: textures.quartz });
        const sandMat = new THREE.MeshLambertMaterial({ map: textures.sand });
        const farmlandTopMat = new THREE.MeshLambertMaterial({ map: textures.farmlandTop });
        const farmlandSideMat = new THREE.MeshLambertMaterial({ map: textures.farmlandSide });
        const luckyMat = new THREE.MeshLambertMaterial({ map: textures.lucky });

        const magmaMat = new THREE.MeshLambertMaterial({ 
            map: textures.magma,
            emissive: new THREE.Color(0xff2200),
            emissiveIntensity: 0.6
        });
        const cropMat = new THREE.MeshLambertMaterial({ 
            map: textures.crop,
            transparent: true,
            alphaTest: 0.15,
            side: THREE.DoubleSide
        });

        // New blocks materials
        const coalOreMat = new THREE.MeshLambertMaterial({ map: textures.coalOre });
        const ironOreMat = new THREE.MeshLambertMaterial({ map: textures.ironOre });
        const goldOreMat = new THREE.MeshLambertMaterial({ map: textures.goldOre });
        const chestSideMat = new THREE.MeshLambertMaterial({ map: textures.chestSide });
        const chestTopMat = new THREE.MeshLambertMaterial({ map: textures.chestTop });
        const chestFrontMat = new THREE.MeshLambertMaterial({ map: textures.chestFront });

        // Box Geometry for cubes
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        // Max instances mapping
        const maxCounts = {
            stone: 45000,
            dirt: 25000,
            grass: 10000,
            obsidian: 5000,
            wood: 5000,
            leaf: 10000,
            brick: 5000,
            emerald: 2000,
            diamond: 2000,
            ender: 2000,
            tnt: 2000,
            water: 15000,
            lava: 15000,
            quartz: 5000,
            sand: 10000,
            farmland: 5000,
            lucky: 2000,
            magma: 5000,
            crop: 5000,
            coal_ore: 5000,
            iron_ore: 5000,
            gold_ore: 5000,
            chest: 2000
        };

        // Material arrays mapping (right, left, top, bottom, front, back)
        const materialConfigs = {
            grass: [grassSideMat, grassSideMat, grassTopMat, dirtMat, grassSideMat, grassSideMat],
            dirt: dirtMat,
            stone: stoneMat,
            obsidian: obsidianMat,
            wood: [woodSideMat, woodSideMat, woodTopMat, woodTopMat, woodSideMat, woodSideMat],
            leaf: leafMat,
            brick: brickMat,
            emerald: emeraldMat,
            diamond: diamondMat,
            ender: enderMat,
            tnt: tntSideMat,
            water: waterMat,
            lava: lavaMat,
            quartz: quartzMat,
            sand: sandMat,
            farmland: [farmlandSideMat, farmlandSideMat, farmlandTopMat, dirtMat, farmlandSideMat, farmlandSideMat],
            lucky: luckyMat,
            magma: magmaMat,
            crop: cropMat,
            coal_ore: coalOreMat,
            iron_ore: ironOreMat,
            gold_ore: goldOreMat,
            chest: [chestSideMat, chestSideMat, chestTopMat, chestTopMat, chestFrontMat, chestSideMat]
        };

        // Initialize InstancedMesh for each block type
        this.blockTypesList.forEach(type => {
            const mat = materialConfigs[type];
            const maxInst = maxCounts[type] || 2000;
            const instMesh = new THREE.InstancedMesh(geometry, mat, maxInst);
            instMesh.castShadow = (type !== 'water' && type !== 'lava');
            instMesh.receiveShadow = true;
            instMesh.maxInstances = maxInst; // Custom tag
            this.scene.add(instMesh);
            this.instancedMeshMap.set(type, instMesh);
        });

        // Highlight Box Setup
        const highlightGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
        const edges = new THREE.EdgesGeometry(highlightGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
        this.highlightBox = new THREE.LineSegments(edges, lineMat);
        this.highlightBox.visible = false;
        this.scene.add(this.highlightBox);

        // Load existing world or generate new terrain
        if (!this.load()) {
            this.generateTerrain();
        }
    }

    generateTerrain() {
        this.grid = new Array(this.width * this.height * this.depth);
        
        const seaLevel = 4;
        
        // 1. Generate core terrain heights & blocks
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                const worldX = x + this.xOffset;
                const worldZ = z + this.zOffset;
                
                // Get terrain height using Simplex Noise (ranging from 3 to 18)
                const terrainH = getTerrainHeight(worldX, worldZ, this.height - 6);
                
                if (terrainH <= seaLevel) {
                    // Generate pools under water level
                    for (let y = 0; y < this.height; y++) {
                        const idx = x * (this.height * this.depth) + y * this.depth + z;
                        if (y <= terrainH - 3) {
                            this.grid[idx] = 'stone';
                        } else if (y < terrainH) {
                            // Under-water floor is sandy or dirty
                            this.grid[idx] = (Math.random() < 0.6) ? 'sand' : 'dirt';
                        } else if (y <= seaLevel) {
                            this.grid[idx] = 'water_source';
                        }
                    }
                } else if (terrainH === seaLevel + 1) {
                    // Sandy shoreline/beach!
                    for (let y = 0; y < this.height; y++) {
                        const idx = x * (this.height * this.depth) + y * this.depth + z;
                        if (y === terrainH) {
                            // Rare shoreline lucky block!
                            this.grid[idx] = (Math.random() < 0.005) ? 'lucky' : 'sand';
                        } else if (y < terrainH && y >= terrainH - 3) {
                            this.grid[idx] = 'sand';
                        } else if (y < terrainH - 3) {
                            const r = Math.random();
                            if (r < 0.05) {
                                this.grid[idx] = 'coal_ore';
                            } else if (r < 0.03) {
                                this.grid[idx] = 'iron_ore';
                            } else if (r < 0.015) {
                                this.grid[idx] = 'gold_ore';
                            } else {
                                this.grid[idx] = 'stone';
                            }
                        }
                    }
                } else {
                    for (let y = 0; y < this.height; y++) {
                        const idx = x * (this.height * this.depth) + y * this.depth + z;
                        if (y === terrainH) {
                            // Rare surface lucky block!
                            if (Math.random() < 0.005) {
                                this.grid[idx] = 'lucky';
                            } else {
                                this.grid[idx] = 'grass';
                            }
                        } else if (y < terrainH && y >= terrainH - 3) {
                            this.grid[idx] = 'dirt';
                        } else if (y < terrainH - 3) {
                            // Rare obsidian veins at bottom (y=0 or 1)
                            if (y <= 1 && Math.random() < 0.15) {
                                this.grid[idx] = 'obsidian';
                            } else {
                                const r = Math.random();
                                if (r < 0.05) {
                                    this.grid[idx] = 'coal_ore';
                                } else if (r < 0.03) {
                                    this.grid[idx] = 'iron_ore';
                                } else if (r < 0.015) {
                                    this.grid[idx] = 'gold_ore';
                                } else {
                                    this.grid[idx] = 'stone';
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // 2. Spawn trees on dry land (grass blocks)
        const treeSpawns = [];
        for (let x = 2; x < this.width - 2; x++) {
            for (let z = 2; z < this.depth - 2; z++) {
                const worldX = x + this.xOffset;
                const worldZ = z + this.zOffset;
                
                // Find surface y
                let surfaceY = -1;
                for (let y = this.height - 1; y >= 0; y--) {
                    const idx = x * (this.height * this.depth) + y * this.depth + z;
                    if (this.grid[idx] !== undefined) {
                        surfaceY = y;
                        break;
                    }
                }
                
                if (surfaceY > seaLevel) {
                    const idx = x * (this.height * this.depth) + surfaceY * this.depth + z;
                    const blockType = this.grid[idx];
                    if (blockType === 'grass') {
                        if (Math.random() < 0.015) { // 1.5% chance per column
                            let tooClose = false;
                            for (const spawn of treeSpawns) {
                                const dist = Math.abs(spawn.x - worldX) + Math.abs(spawn.z - worldZ);
                                if (dist < 4) {
                                    tooClose = true;
                                    break;
                                }
                            }
                            if (!tooClose) {
                                treeSpawns.push({ x: worldX, y: surfaceY, z: worldZ });
                            }
                        }
                    }
                }
            }
        }
        
        // Render tree trunks and leaf canopies
        treeSpawns.forEach(spawn => {
            this.spawnTree(spawn.x, spawn.y + 1, spawn.z);
        });

        // 3. Spawn underground lava pools
        for (let i = 0; i < 4; i++) {
            const lx = Math.floor(Math.random() * (this.width - 6)) + 3;
            const lz = Math.floor(Math.random() * (this.depth - 6)) + 3;
            const ly = 1 + Math.floor(Math.random() * 2);
            
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const idx = (lx + dx) * (this.height * this.depth) + ly * this.depth + (lz + dz);
                    if (this.grid[idx] === 'stone') {
                        this.grid[idx] = 'lava_source';
                    }
                }
            }
        }
        
        this.updateMesh();
    }

    spawnTree(startX, startY, startZ) {
        // Trunk of wood (4 to 5 blocks tall)
        const trunkH = 4 + Math.floor(Math.random() * 2);
        for (let dy = 0; dy < trunkH; dy++) {
            const idx = this.getGridIndex(startX, startY + dy, startZ);
            if (idx !== -1) {
                this.grid[idx] = 'wood';
            }
        }
        
        // Leaf canopy around top of trunk
        const leafStart = startY + trunkH - 2;
        for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
                for (let ly = 0; ly <= 2; ly++) {
                    const tx = startX + lx;
                    const ty = leafStart + ly;
                    const tz = startZ + lz;
                    const idx = this.getGridIndex(tx, ty, tz);
                    if (idx === -1) continue;
                    
                    // Don't place leaves at corners of the 5x5 canopy at the top layer
                    if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly === 2) continue;
                    
                    // Don't overwrite trunk wood
                    if (this.grid[idx] === undefined) {
                        this.grid[idx] = 'leaf';
                    }
                }
            }
        }
    }

    isTransparent(type) {
        if (!type) return true;
        const baseType = type.split('_')[0];
        return baseType === 'water' || baseType === 'leaf';
    }

    isBlockVisible(x, y, z) {
        const lx = Math.round(x) - this.xOffset;
        const ly = Math.round(y);
        const lz = Math.round(z) - this.zOffset;
        if (lx < 0 || lx >= this.width || ly < 0 || ly >= this.height || lz < 0 || lz >= this.depth) {
            return true; // exposed if out of bounds
        }
        const idx = lx * (this.height * this.depth) + ly * this.depth + lz;
        const currentType = this.grid[idx];
        if (!currentType) return false;
        return this.isBlockVisibleAtIndex(lx, ly, lz, currentType);
    }

    isBlockVisibleAtIndex(lx, ly, lz, currentType) {
        const currentBase = currentType.split('_')[0];

        // 6 directions
        const neighbors = [
            [lx + 1, ly, lz],
            [lx - 1, ly, lz],
            [lx, ly + 1, lz],
            [lx, ly - 1, lz],
            [lx, ly, lz + 1],
            [lx, ly, lz - 1]
        ];

        for (const [nx, ny, nz] of neighbors) {
            // Out of bounds vertically counts as air (exposed)
            if (ny < 0 || ny >= this.height) return true;
            
            // Out of bounds horizontally (world boundaries) counts as air
            if (nx < 0 || nx >= this.width || 
                nz < 0 || nz >= this.depth) {
                return true;
            }

            const nIdx = nx * (this.height * this.depth) + ny * this.depth + nz;
            const neighborType = this.grid[nIdx];
            if (!neighborType) return true; // Next to air

            const neighborBase = neighborType.split('_')[0];

            // If neighbor is transparent, and not the same transparent type, this face is visible
            if (this.isTransparent(neighborType) && neighborBase !== currentBase) {
                return true;
            }
        }

        return false;
    }

    updateMesh() {
        // Reset counts
        this.instancedMeshMap.forEach(mesh => {
            mesh.count = 0;
        });

        const counts = {};
        this.blockTypesList.forEach(type => {
            counts[type] = 0;
        });

        const matrix = new THREE.Matrix4();

        // Populate instanced meshes with only VISIBLE blocks
        let idx = 0;
        for (let x = 0; x < this.width; x++) {
            const worldX = x + this.xOffset;
            for (let y = 0; y < this.height; y++) {
                for (let z = 0; z < this.depth; z++) {
                    const type = this.grid[idx];
                    if (type !== undefined) {
                        const baseType = type.split('_')[0];
                        const mesh = this.instancedMeshMap.get(baseType);
                        if (mesh && this.isBlockVisibleAtIndex(x, y, z, type)) {
                            const instanceIdx = counts[baseType];
                            if (instanceIdx < mesh.maxInstances) {
                                const worldZ = z + this.zOffset;
                                matrix.makeTranslation(worldX, y, worldZ);
                                mesh.setMatrixAt(instanceIdx, matrix);
                                counts[baseType]++;
                            }
                        }
                    }
                    idx++;
                }
            }
        }

        // Set counts and trigger GPU buffers upload
        this.instancedMeshMap.forEach((mesh, type) => {
            mesh.count = counts[type];
            mesh.instanceMatrix.needsUpdate = true;
            // Recompute bounding volumes so raycasting works after instance changes
            mesh.computeBoundingSphere();
            mesh.computeBoundingBox();
        });
    }

    getInstancedMeshes() {
        return Array.from(this.instancedMeshMap.values());
    }

    getBlockAt(x, y, z) {
        const idx = this.getGridIndex(x, y, z);
        return idx !== -1 ? (this.grid[idx] || null) : null;
    }

    addBlock(x, y, z, type) {
        const idx = this.getGridIndex(x, y, z);
        if (idx === -1) return false;
        if (this.grid[idx] !== undefined) {
            this.removeBlock(x, y, z, true, true);
        }

        // If placing liquid, place as source
        let finalType = type;
        if (type === 'water') finalType = 'water_source';
        if (type === 'lava') finalType = 'lava_source';

        this.grid[idx] = finalType;
        this.updateMesh();
        sounds.playPlaceSound();

        // Crop Growth Hook
        if (finalType === 'crop') {
            // Spark green planting particles immediately
            setTimeout(() => {
                this.spawnCropParticles(x, y, z, 0x2d6a4f); // dark green
            }, 50);

            // Timeout for growth (5 seconds)
            setTimeout(() => {
                const currentBlock = this.getBlockAt(x, y, z);
                if (currentBlock === 'crop') {
                    // Spark light green growth particles
                    this.spawnCropParticles(x, y, z, 0x55a630); // vibrant light green
                    sounds.playPlaceSound();
                    if (this.game && typeof this.game.showNotification === 'function') {
                        this.game.showNotification('Tanamanmu telah matang! 🌾');
                    }
                }
            }, 5000);
        }

        return true;
    }

    removeBlock(x, y, z, silent = false, skipUpdate = false) {
        const idx = this.getGridIndex(x, y, z);
        if (idx === -1 || this.grid[idx] === undefined) return null;

        const type = this.grid[idx];
        this.grid[idx] = undefined;
        if (!skipUpdate) {
            this.updateMesh();
        }
        if (!silent) {
            sounds.playDigSound();
            if (this.game && this.game.particles) {
                this.spawnBlockBreakParticles(x, y, z, type);
            }
        }
        return type;
    }

    spawnBlockBreakParticles(x, y, z, type) {
        if (!type) return;
        const baseType = type.split('_')[0];
        const blockConfig = BLOCK_TYPES[baseType];
        const color = blockConfig ? blockConfig.color : 0x888888;
        
        const count = 12;
        const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const particlesList = [];
        
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({ color: color });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                x + (Math.random() - 0.5) * 0.6,
                y + (Math.random() - 0.5) * 0.6,
                z + (Math.random() - 0.5) * 0.6
            );
            
            const speed = 1.5 + Math.random() * 2.0;
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                (Math.random() * 1.5 + 0.5),
                (Math.random() - 0.5) * 1.5
            ).normalize().multiplyScalar(speed);
            
            this.scene.add(mesh);
            particlesList.push({
                mesh: mesh,
                velocity: velocity,
                life: 0.3 + Math.random() * 0.3,
                elapsed: 0,
                material: mat
            });
        }
        this.game.particles.push(...particlesList);
    }

    spawnCropParticles(x, y, z, color) {
        if (!this.game || !this.game.particles) return;
        const count = 10;
        const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const particlesList = [];
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                x + (Math.random() - 0.5) * 0.5,
                y + Math.random() * 0.5,
                z + (Math.random() - 0.5) * 0.5
            );
            const speed = 1.0 + Math.random() * 1.5;
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.8,
                (Math.random() * 1.0 + 0.5),
                (Math.random() - 0.5) * 0.8
            ).normalize().multiplyScalar(speed);
            this.scene.add(mesh);
            particlesList.push({
                mesh: mesh,
                velocity: velocity,
                life: 0.3 + Math.random() * 0.3,
                elapsed: 0,
                material: mat
            });
        }
        this.game.particles.push(...particlesList);
    }

    updateHighlight(intersect) {
        if (intersect && this.getInstancedMeshes().includes(intersect.object)) {
            const instanceId = intersect.instanceId;
            const instMesh = intersect.object;
            
            const matrix = new THREE.Matrix4();
            instMesh.getMatrixAt(instanceId, matrix);
            
            const position = new THREE.Vector3();
            position.setFromMatrixPosition(matrix);
            
            this.highlightBox.position.copy(position);
            this.highlightBox.visible = true;
            return position;
        } else {
        this.highlightBox.visible = false;
            return null;
        }
    }

    tickLiquids() {
        let changed = false;
        const newAdditions = [];
        const toRemove = [];
        
        let idx = 0;
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                for (let z = 0; z < this.depth; z++) {
                    const type = this.grid[idx];
                    if (type && type.startsWith('lava_')) {
                        // Check if water is adjacent
                        let hasWaterNeighbor = false;
                        const adj = [];
                        if (x > 0) adj.push(idx - this.height * this.depth);
                        if (x < this.width - 1) adj.push(idx + this.height * this.depth);
                        if (z > 0) adj.push(idx - 1);
                        if (z < this.depth - 1) adj.push(idx + 1);
                        if (y > 0) adj.push(idx - this.depth);
                        if (y < this.height - 1) adj.push(idx + this.depth);
                        
                        for (const nIdx of adj) {
                            const nBlock = this.grid[nIdx];
                            if (nBlock && nBlock.startsWith('water_')) {
                                hasWaterNeighbor = true;
                                break;
                            }
                        }
                        
                        if (hasWaterNeighbor) {
                            toRemove.push(idx);
                            newAdditions.push({ idx: idx, type: 'obsidian' });
                            changed = true;
                            idx++;
                            continue;
                        }
                    }

                    if (type && (type.startsWith('water_') || type.startsWith('lava_'))) {
                        const parts = type.split('_');
                        const baseType = parts[0];
                        const isSource = parts[1] === 'source';
                        const level = isSource ? 4 : parseInt(parts[1]);
                        
                        // Flow down check
                        if (y > 0) {
                            const belowIdx = idx - this.depth; // ly - 1
                            const belowBlock = this.grid[belowIdx];
                            
                            if (!belowBlock) {
                                newAdditions.push({ idx: belowIdx, type: `${baseType}_4` });
                                changed = true;
                                idx++;
                                continue;
                            }
                        }
                        
                        // Spread horizontally if level > 1
                        if (level > 1) {
                            const neighbors = [];
                            if (x > 0) neighbors.push(idx - this.height * this.depth);
                            if (x < this.width - 1) neighbors.push(idx + this.height * this.depth);
                            if (z > 0) neighbors.push(idx - 1);
                            if (z < this.depth - 1) neighbors.push(idx + 1);
                            
                            neighbors.forEach(nIdx => {
                                const nBlock = this.grid[nIdx];
                                if (!nBlock) {
                                    newAdditions.push({ idx: nIdx, type: `${baseType}_${level - 1}` });
                                    changed = true;
                                }
                            });
                        }
                        
                        // Dry up logic: If not source, make sure it has a source above or adjacent higher level
                        if (!isSource) {
                            let hasSource = false;
                            
                            // Above
                            if (y < this.height - 1) {
                                const aboveIdx = idx + this.depth; // ly + 1
                                const aboveBlock = this.grid[aboveIdx];
                                if (aboveBlock && aboveBlock.startsWith(baseType)) {
                                    hasSource = true;
                                }
                            }
                            
                            // Adjacents
                            if (!hasSource) {
                                const adjacents = [];
                                if (x > 0) adjacents.push(idx - this.height * this.depth);
                                if (x < this.width - 1) adjacents.push(idx + this.height * this.depth);
                                if (z > 0) adjacents.push(idx - 1);
                                if (z < this.depth - 1) adjacents.push(idx + 1);
                                
                                for (const adjIdx of adjacents) {
                                    const adjBlock = this.grid[adjIdx];
                                    if (adjBlock && adjBlock.startsWith(baseType)) {
                                        const adjParts = adjBlock.split('_');
                                        const adjIsSource = adjParts[1] === 'source';
                                        const adjLevel = adjIsSource ? 4 : parseInt(adjParts[1]);
                                        if (adjLevel > level) {
                                            hasSource = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            if (!hasSource) {
                                toRemove.push(idx);
                                changed = true;
                            }
                        }
                    }
                    idx++;
                }
            }
        }
        
        // Apply updates
        toRemove.forEach(rIdx => {
            this.grid[rIdx] = undefined;
        });
        newAdditions.forEach(({ idx: aIdx, type }) => {
            if (this.grid[aIdx] === undefined) {
                this.grid[aIdx] = type;
            }
        });
        
        if (changed) {
            this.updateMesh();
        }
    }

    // Save world state to localStorage
    save() {
        try {
            const entries = [];
            for (let idx = 0; idx < this.grid.length; idx++) {
                const type = this.grid[idx];
                if (type !== undefined) {
                    entries.push([idx, type]);
                }
            }
            const data = {
                grid: entries,
                width: this.width,
                height: this.height,
                depth: this.depth
            };
            localStorage.setItem('nizamcraft-save', JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Failed to save game:', e);
            return false;
        }
    }

    // Load world state from localStorage
    load() {
        try {
            const saved = localStorage.getItem('nizamcraft-save');
            if (!saved) return false;

            const data = JSON.parse(saved);
            this.width = data.width || 64;
            this.height = data.height || 24;
            this.depth = data.depth || 64;
            this.xOffset = -this.width / 2;
            this.zOffset = -this.depth / 2;

            this.grid = new Array(this.width * this.height * this.depth);
            if (Array.isArray(data.grid)) {
                data.grid.forEach(([key, type]) => {
                    if (typeof key === 'string') {
                        // Compatibility with old "x,y,z" format
                        const [x, y, z] = key.split(',').map(Number);
                        const idx = this.getGridIndex(x, y, z);
                        if (idx !== -1) {
                            this.grid[idx] = type;
                        }
                    } else {
                        // New format using numeric indices
                        this.grid[key] = type;
                    }
                });
            }
            this.updateMesh();
            return true;
        } catch (e) {
            console.error('Failed to load game:', e);
            return false;
        }
    }

    // Reset world (clear and regenerate)
    reset() {
        this.generateTerrain();
        this.save();
    }
}
