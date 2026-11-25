import * as THREE from 'three';
import { sounds } from '../utils/audio.js';
import { textures } from '../utils/textures.js';
import {
    normalizeBlockType,
    parseBlockState,
    checkGridAABB,
    rollUndergroundBlock,
    LASER_DIRECTION_VECTORS,
    SEA_BEACH_START_Z,
    SEA_START_Z
} from '../utils/gameData.js';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);

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

const RAIL_Y_QUATS = {
    ns: new THREE.Quaternion(),
    ew: new THREE.Quaternion().setFromAxisAngle(AXIS_Y, Math.PI / 2),
    ne: new THREE.Quaternion(),
    nw: new THREE.Quaternion().setFromAxisAngle(AXIS_Y, Math.PI / 2),
    sw: new THREE.Quaternion().setFromAxisAngle(AXIS_Y, Math.PI),
    se: new THREE.Quaternion().setFromAxisAngle(AXIS_Y, -Math.PI / 2)
};

const SLOPE_TILT_QUAT = new THREE.Quaternion().setFromAxisAngle(AXIS_X, Math.PI / 4);
const RAIL_SLOPE_QUATS = {
    asc_n: SLOPE_TILT_QUAT.clone(),
    asc_w: new THREE.Quaternion().setFromAxisAngle(AXIS_Y, Math.PI / 2).multiply(SLOPE_TILT_QUAT),
    asc_s: new THREE.Quaternion().setFromAxisAngle(AXIS_Y, Math.PI).multiply(SLOPE_TILT_QUAT),
    asc_e: new THREE.Quaternion().setFromAxisAngle(AXIS_Y, -Math.PI / 2).multiply(SLOPE_TILT_QUAT)
};

export const WORLD_SAVE_VERSION = 3;

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
    crop: { id: 19, name: 'Crop', color: 0x8fc93a },
    crafting: { id: 20, name: 'Crafting Table', color: 0xb07d56 },
    piston: { id: 21, name: 'Piston', color: 0x7c7c7c },
    rail: { id: 22, name: 'Rail', color: 0xcccccc },
    pressure_plate: { id: 23, name: 'Pressure Plate', color: 0x8c5b36 },
    button: { id: 24, name: 'Button', color: 0x7c7c7c },
    lever: { id: 25, name: 'Lever', color: 0x5c3d24 },
    dispenser: { id: 26, name: 'Dispenser', color: 0x7c7c7c },
    coal_ore: { id: 27, name: 'Coal Ore', color: 0x3a3a3a },
    iron_ore: { id: 28, name: 'Iron Ore', color: 0xd4a373 },
    gold_ore: { id: 29, name: 'Gold Ore', color: 0xffb703 },
    chest: { id: 30, name: 'Chest', color: 0xa06a42 },
    enchanting_table: { id: 31, name: 'Enchanting Table', color: 0x7b2cbf },
    planks: { id: 32, name: 'Planks', color: 0xc29563 },
    bookshelf: { id: 33, name: 'Bookshelf', color: 0x9c6b3b },
    lapis_ore: { id: 34, name: 'Lapis Ore', color: 0x2563eb },
    powered_rail: { id: 35, name: 'Powered Rail', color: 0xeab308 },
    piston_head: { id: 36, name: 'Piston Head', color: 0xa06a42 },
    redstone: { id: 37, name: 'Redstone', color: 0xdc2626 },
    laser: { id: 38, name: 'Laser', color: 0xef4444 },
    saw: { id: 39, name: 'Saw', color: 0x94a3b8 }
};

const TRANSPARENT_BASE_TYPES = new Set([
    'water',
    'leaf',
    'rail',
    'powered_rail',
    'redstone',
    'saw',
    'pressure_plate',
    'button',
    'lever',
    'crop',
    'piston',
    'piston_head'
]);

export class World {
    constructor(scene) {
        this.scene = scene;

        // World Dimensions (96x24x96)
        this.width = 96;
        this.height = 24;
        this.depth = 96;

        // Offset to center the world at (0, 0)
        this.xOffset = -this.width / 2;
        this.zOffset = -this.depth / 2;

        this.grid = new Array(this.width * this.height * this.depth);
        this.instancedMeshMap = new Map();
        this.auxMeshMap = new Map();
        this.loadedFromSave = false;
        this.blockTypesList = [
            'grass', 'dirt', 'stone', 'obsidian', 'wood', 'planks', 'leaf', 'brick',
            'emerald', 'diamond', 'ender', 'tnt', 'water', 'lava', 'quartz',
            'sand', 'farmland', 'lucky', 'magma', 'crop', 'coal_ore',
            'iron_ore', 'gold_ore', 'lapis_ore', 'bookshelf', 'chest', 'crafting',
            'enchanting_table', 'piston', 'rail', 'powered_rail', 'redstone',
            'laser', 'saw', 'pressure_plate', 'button', 'lever', 'dispenser'
        ];

        this.highlightBox = null;
        this.liquidTimer = 0;
        this.sawPositions = [];
        this.sawSpinAngle = 0;
        this._sawQuat = new THREE.Quaternion();
        this._sawPos = new THREE.Vector3();
        this._sawMatrix = new THREE.Matrix4();

        // Shared particle geometries to prevent GPU geometry leaks
        this.particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        this.cropParticleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

        this.boundGetBlockAt = this.getBlockAt.bind(this);
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

    checkAABB(x, y, z, radius, height, yFromCenter = false, preferTop = true) {
        return checkGridAABB(this.boundGetBlockAt, x, y, z, radius, height, yFromCenter, preferTop);
    }

    init() {
        const grassSideMat = new THREE.MeshLambertMaterial({ map: textures.grassSide });
        const grassTopMat = new THREE.MeshLambertMaterial({ map: textures.grassTop });
        const dirtMat = new THREE.MeshLambertMaterial({ map: textures.dirt });
        const stoneMat = new THREE.MeshLambertMaterial({ map: textures.stone });
        const obsidianMat = new THREE.MeshLambertMaterial({ map: textures.obsidian });
        const woodSideMat = new THREE.MeshLambertMaterial({ map: textures.woodSide });
        const woodTopMat = new THREE.MeshLambertMaterial({ map: textures.woodTop });
        const planksMat = new THREE.MeshLambertMaterial({ map: textures.planks });
        const bookshelfSideMat = new THREE.MeshLambertMaterial({ map: textures.bookshelfSide });

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

        const coalOreMat = new THREE.MeshLambertMaterial({ map: textures.coalOre });
        const ironOreMat = new THREE.MeshLambertMaterial({ map: textures.ironOre });
        const goldOreMat = new THREE.MeshLambertMaterial({ map: textures.goldOre });
        const lapisOreMat = new THREE.MeshLambertMaterial({ map: textures.lapisOre });
        const chestSideMat = new THREE.MeshLambertMaterial({ map: textures.chestSide });
        const chestTopMat = new THREE.MeshLambertMaterial({ map: textures.chestTop });
        const chestFrontMat = new THREE.MeshLambertMaterial({ map: textures.chestFront });

        const craftingSideMat = new THREE.MeshLambertMaterial({ map: textures.craftingSide });
        const craftingTopMat = new THREE.MeshLambertMaterial({ map: textures.craftingTop });

        const enchantingSideMat = new THREE.MeshLambertMaterial({
            map: textures.enchantingSide,
            emissive: new THREE.Color(0x3c096c),
            emissiveIntensity: 0.35
        });
        const enchantingTopMat = new THREE.MeshLambertMaterial({
            map: textures.enchantingTop,
            emissive: new THREE.Color(0x5a189a),
            emissiveIntensity: 0.35
        });

        const pistonSideMat = new THREE.MeshLambertMaterial({ map: textures.pistonSide });
        const pistonTopMat = new THREE.MeshLambertMaterial({ map: textures.pistonTop });
        const pistonExtTopMat = new THREE.MeshLambertMaterial({ map: textures.pistonExtendedTop });

        const railTopMat = new THREE.MeshLambertMaterial({
            map: textures.railTop,
            transparent: true,
            alphaTest: 0.15,
            side: THREE.DoubleSide
        });
        const railCornerMat = new THREE.MeshLambertMaterial({
            map: textures.railCorner,
            transparent: true,
            alphaTest: 0.15,
            side: THREE.DoubleSide
        });
        const poweredRailOffMat = new THREE.MeshLambertMaterial({
            map: textures.poweredRailOff,
            transparent: true,
            alphaTest: 0.15,
            side: THREE.DoubleSide
        });
        const poweredRailOnMat = new THREE.MeshLambertMaterial({
            map: textures.poweredRailOn,
            transparent: true,
            alphaTest: 0.15,
            emissive: new THREE.Color(0x991b1b),
            emissiveIntensity: 0.55,
            side: THREE.DoubleSide
        });
        const hiddenSideMat = new THREE.MeshLambertMaterial({
            map: textures.woodSide,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });

        const pressurePlateTopMat = new THREE.MeshLambertMaterial({ map: textures.pressurePlateTop });
        const pressurePlatePressedMat = new THREE.MeshLambertMaterial({
            map: textures.pressurePlateTop,
            emissive: new THREE.Color(0x7c2d12),
            emissiveIntensity: 0.35
        });
        const buttonTopMat = new THREE.MeshLambertMaterial({ map: textures.buttonTop });
        const leverTopMat = new THREE.MeshLambertMaterial({ map: textures.leverTop });
        const leverHandleOffMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
        const leverHandleOnMat = new THREE.MeshLambertMaterial({
            color: 0xef4444,
            emissive: new THREE.Color(0x991b1b),
            emissiveIntensity: 0.65
        });

        const dispenserFrontMat = new THREE.MeshLambertMaterial({ map: textures.dispenserFront });

        const poweredRailCurveOffMat = new THREE.MeshLambertMaterial({
            map: textures.poweredRailCurveOff,
            transparent: true,
            alphaTest: 0.15,
            side: THREE.DoubleSide
        });
        const poweredRailCurveOnMat = new THREE.MeshLambertMaterial({
            map: textures.poweredRailCurveOn,
            transparent: true,
            alphaTest: 0.15,
            emissive: new THREE.Color(0x991b1b),
            emissiveIntensity: 0.55,
            side: THREE.DoubleSide
        });

        const redstoneSideMat = new THREE.MeshLambertMaterial({ color: 0x581111 });
        const redstoneSideOnMat = new THREE.MeshLambertMaterial({
            color: 0xdc2626,
            emissive: new THREE.Color(0x991b1b),
            emissiveIntensity: 0.6
        });
        const redstoneOffMat = new THREE.MeshLambertMaterial({
            map: textures.redstoneOff,
            transparent: true,
            alphaTest: 0.15,
            side: THREE.DoubleSide
        });
        const redstoneOnMat = new THREE.MeshLambertMaterial({
            map: textures.redstoneOn,
            transparent: true,
            alphaTest: 0.15,
            emissive: new THREE.Color(0xdc2626),
            emissiveIntensity: 0.75,
            side: THREE.DoubleSide
        });

        const laserSideMat = new THREE.MeshLambertMaterial({ map: textures.laserSide });
        const laserFrontOffMat = new THREE.MeshLambertMaterial({ map: textures.laserFrontOff });
        const laserFrontOnMat = new THREE.MeshLambertMaterial({
            map: textures.laserFrontOn,
            emissive: new THREE.Color(0xef4444),
            emissiveIntensity: 0.9
        });

        const sawSideMat = new THREE.MeshLambertMaterial({ map: textures.sawSide });
        const sawTopMat = new THREE.MeshLambertMaterial({ map: textures.sawTop });
        const sawBladeEdgeMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
        const sawBladeMat = new THREE.MeshLambertMaterial({
            map: textures.sawBlade,
            transparent: true,
            alphaTest: 0.15,
            side: THREE.DoubleSide
        });

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const railGeo = new THREE.BoxGeometry(1, 0.06, 1);
        railGeo.translate(0, -0.47, 0);
        const railSlopeGeo = new THREE.BoxGeometry(1, 0.06, Math.SQRT2);
        const redstoneGeo = new THREE.BoxGeometry(0.92, 0.04, 0.92);
        redstoneGeo.translate(0, -0.48, 0);
        const sawBaseGeo = new THREE.BoxGeometry(1, 0.56, 1);
        sawBaseGeo.translate(0, -0.22, 0);
        const sawBladeGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.06, 16);
        sawBladeGeo.rotateZ(Math.PI / 2);
        const plateGeo = new THREE.BoxGeometry(0.88, 0.08, 0.88);
        plateGeo.translate(0, -0.46, 0);
        const plateDepressedGeo = new THREE.BoxGeometry(0.88, 0.03, 0.88);
        plateDepressedGeo.translate(0, -0.485, 0);
        const buttonGeo = new THREE.BoxGeometry(0.36, 0.14, 0.26);
        buttonGeo.translate(0, -0.43, 0);
        const leverGeo = new THREE.BoxGeometry(0.46, 0.22, 0.46);
        leverGeo.translate(0, -0.39, 0);
        const leverHandleOffGeo = new THREE.BoxGeometry(0.11, 0.52, 0.11);
        leverHandleOffGeo.translate(0, 0.24, 0);
        leverHandleOffGeo.rotateX(-0.55);
        leverHandleOffGeo.translate(0, -0.34, 0);
        const leverHandleOnGeo = new THREE.BoxGeometry(0.11, 0.52, 0.11);
        leverHandleOnGeo.translate(0, 0.24, 0);
        leverHandleOnGeo.rotateX(0.55);
        leverHandleOnGeo.translate(0, -0.34, 0);
        const pistonExtBaseGeo = new THREE.BoxGeometry(1, 0.75, 1);
        pistonExtBaseGeo.translate(0, -0.125, 0);
        const pistonHeadPlateGeo = new THREE.BoxGeometry(1, 0.25, 1);
        pistonHeadPlateGeo.translate(0, 0.375, 0);
        const pistonHeadRodGeo = new THREE.BoxGeometry(0.26, 1.0, 0.26);
        pistonHeadRodGeo.translate(0, -0.25, 0);

        const geometryConfigs = {
            rail: railGeo,
            powered_rail: railGeo,
            redstone: redstoneGeo,
            saw: sawBaseGeo,
            pressure_plate: plateGeo,
            button: buttonGeo,
            lever: leverGeo
        };

        const maxCounts = {
            stone: 45000,
            dirt: 25000,
            grass: 14000,
            obsidian: 14000,
            wood: 5000,
            planks: 10000,
            leaf: 10000,
            brick: 5000,
            emerald: 2000,
            diamond: 2000,
            ender: 2000,
            tnt: 2000,
            water: 22000,
            lava: 15000,
            quartz: 5000,
            sand: 14000,
            farmland: 5000,
            lucky: 2000,
            magma: 5000,
            crop: 5000,
            coal_ore: 5000,
            iron_ore: 5000,
            gold_ore: 5000,
            lapis_ore: 5000,
            bookshelf: 3000,
            chest: 2000,
            crafting: 2000,
            enchanting_table: 1000,
            piston: 2000,
            rail: 5000,
            powered_rail: 2000,
            redstone: 4000,
            laser: 1000,
            saw: 1000,
            pressure_plate: 2000,
            button: 2000,
            lever: 2000,
            dispenser: 2000
        };

        const materialConfigs = {
            grass: [grassSideMat, grassSideMat, grassTopMat, dirtMat, grassSideMat, grassSideMat],
            dirt: dirtMat,
            stone: stoneMat,
            obsidian: obsidianMat,
            wood: [woodSideMat, woodSideMat, woodTopMat, woodTopMat, woodSideMat, woodSideMat],
            planks: planksMat,
            leaf: leafMat,
            brick: brickMat,
            emerald: emeraldMat,
            diamond: diamondMat,
            ender: enderMat,
            tnt: [tntSideMat, tntSideMat, tntTopMat, tntTopMat, tntSideMat, tntSideMat],
            water: waterMat,
            lava: lavaMat,
            quartz: quartzMat,
            sand: sandMat,
            farmland: [farmlandSideMat, farmlandSideMat, farmlandTopMat, dirtMat, farmlandSideMat, farmlandSideMat],
            lucky: luckyMat,
            magma: magmaMat,
            crop: [cropMat, cropMat, hiddenSideMat, hiddenSideMat, cropMat, cropMat],
            coal_ore: coalOreMat,
            iron_ore: ironOreMat,
            gold_ore: goldOreMat,
            lapis_ore: lapisOreMat,
            bookshelf: [bookshelfSideMat, bookshelfSideMat, planksMat, planksMat, bookshelfSideMat, bookshelfSideMat],
            chest: [chestSideMat, chestSideMat, chestTopMat, chestTopMat, chestFrontMat, chestSideMat],
            crafting: [craftingSideMat, craftingSideMat, craftingTopMat, woodTopMat, craftingSideMat, craftingSideMat],
            enchanting_table: [enchantingSideMat, enchantingSideMat, enchantingTopMat, obsidianMat, enchantingSideMat, enchantingSideMat],
            piston: [pistonSideMat, pistonSideMat, pistonTopMat, stoneMat, pistonSideMat, pistonSideMat],
            rail: [woodSideMat, woodSideMat, railTopMat, railTopMat, woodSideMat, woodSideMat],
            powered_rail: [woodSideMat, woodSideMat, poweredRailOffMat, poweredRailOffMat, woodSideMat, woodSideMat],
            redstone: [redstoneSideMat, redstoneSideMat, redstoneOffMat, redstoneSideMat, redstoneSideMat, redstoneSideMat],
            laser: [laserSideMat, laserSideMat, laserFrontOffMat, laserSideMat, laserSideMat, laserSideMat],
            saw: [sawSideMat, sawSideMat, sawTopMat, stoneMat, sawSideMat, sawSideMat],
            pressure_plate: [woodSideMat, woodSideMat, pressurePlateTopMat, woodTopMat, woodSideMat, woodSideMat],
            button: [stoneMat, stoneMat, buttonTopMat, stoneMat, stoneMat, stoneMat],
            lever: [stoneMat, stoneMat, leverTopMat, stoneMat, stoneMat, stoneMat],
            dispenser: [stoneMat, stoneMat, stoneMat, stoneMat, dispenserFrontMat, stoneMat]
        };

        this.blockTypesList.forEach(type => {
            const mat = materialConfigs[type];
            const blockGeo = geometryConfigs[type] || geometry;
            const maxInst = maxCounts[type] || 2000;
            const instMesh = new THREE.InstancedMesh(blockGeo, mat, maxInst);
            instMesh.castShadow = (type !== 'water' && type !== 'lava');
            instMesh.receiveShadow = true;
            // Prevent Three.js from caching an empty boundingSphere (radius = -1) on meshes that start at count = 0
            instMesh.frustumCulled = false;
            instMesh.maxInstances = maxInst;
            this.scene.add(instMesh);
            this.instancedMeshMap.set(type, instMesh);
        });

        const auxConfigs = [
            ['rail_curve', railGeo, [woodSideMat, woodSideMat, railCornerMat, railCornerMat, woodSideMat, woodSideMat], 2500],
            ['rail_slope', railSlopeGeo, [woodSideMat, woodSideMat, railTopMat, railTopMat, woodSideMat, woodSideMat], 2000],
            ['powered_rail_on', railGeo, [woodSideMat, woodSideMat, poweredRailOnMat, poweredRailOnMat, woodSideMat, woodSideMat], 2000],
            ['powered_rail_curve_off', railGeo, [woodSideMat, woodSideMat, poweredRailCurveOffMat, poweredRailCurveOffMat, woodSideMat, woodSideMat], 1000],
            ['powered_rail_curve_on', railGeo, [woodSideMat, woodSideMat, poweredRailCurveOnMat, poweredRailCurveOnMat, woodSideMat, woodSideMat], 1000],
            ['powered_rail_slope_off', railSlopeGeo, [woodSideMat, woodSideMat, poweredRailOffMat, poweredRailOffMat, woodSideMat, woodSideMat], 1000],
            ['powered_rail_slope_on', railSlopeGeo, [woodSideMat, woodSideMat, poweredRailOnMat, poweredRailOnMat, woodSideMat, woodSideMat], 1000],
            ['redstone_on', redstoneGeo, [redstoneSideOnMat, redstoneSideOnMat, redstoneOnMat, redstoneSideOnMat, redstoneSideOnMat, redstoneSideOnMat], 4000],
            ['laser_on', geometry, [laserSideMat, laserSideMat, laserFrontOnMat, laserSideMat, laserSideMat, laserSideMat], 1000],
            ['saw_blade', sawBladeGeo, [sawBladeEdgeMat, sawBladeMat, sawBladeMat], 1000],
            ['piston_ext_base', pistonExtBaseGeo, [pistonSideMat, pistonSideMat, stoneMat, stoneMat, pistonSideMat, pistonSideMat], 2000],
            ['piston_head_plate', pistonHeadPlateGeo, [woodSideMat, woodSideMat, pistonExtTopMat, pistonTopMat, woodSideMat, woodSideMat], 2000],
            ['piston_head_rod', pistonHeadRodGeo, woodSideMat, 2000],
            ['lever_handle_off', leverHandleOffGeo, leverHandleOffMat, 2000],
            ['lever_handle_on', leverHandleOnGeo, leverHandleOnMat, 2000],
            ['pressure_plate_depressed', plateDepressedGeo, [woodSideMat, woodSideMat, pressurePlatePressedMat, woodTopMat, woodSideMat, woodSideMat], 2000]
        ];

        auxConfigs.forEach(([key, geo, mat, maxInst]) => {
            const auxMesh = new THREE.InstancedMesh(geo, mat, maxInst);
            auxMesh.castShadow = true;
            auxMesh.receiveShadow = true;
            auxMesh.frustumCulled = false;
            auxMesh.maxInstances = maxInst;
            this.scene.add(auxMesh);
            this.auxMeshMap.set(key, auxMesh);
        });

        // Highlight Box Setup
        const highlightGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
        const edges = new THREE.EdgesGeometry(highlightGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
        this.highlightBox = new THREE.LineSegments(edges, lineMat);
        this.highlightBox.visible = false;
        this.scene.add(this.highlightBox);

        this.loadedFromSave = this.load();
        if (!this.loadedFromSave) {
            this.generateTerrain();
        }
    }

    generateTerrain() {
        this.loadedFromSave = false;
        this.grid = new Array(this.width * this.height * this.depth);
        const flatY = 6;

        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                const worldZ = z + this.zOffset;
                for (let y = 0; y <= flatY; y++) {
                    const idx = x * (this.height * this.depth) + y * this.depth + z;
                    if (y === 0) {
                        this.grid[idx] = 'obsidian';
                    } else if (worldZ >= SEA_START_Z) {
                        if (y === 1) {
                            this.grid[idx] = 'stone';
                        } else if (y === 2) {
                            this.grid[idx] = 'sand';
                        } else {
                            this.grid[idx] = 'water_source';
                        }
                    } else if (worldZ >= SEA_BEACH_START_Z) {
                        this.grid[idx] = y >= flatY - 1 ? 'sand' : 'stone';
                    } else if (y === flatY) {
                        this.grid[idx] = 'grass';
                    } else if (y >= flatY - 2) {
                        this.grid[idx] = 'dirt';
                    } else {
                        this.grid[idx] = rollUndergroundBlock(Math.random(), y, Math.random());
                    }
                }
            }
        }

        // Spawn underground lava pools strictly deep below the land surface
        const maxLandLz = Math.max(4, SEA_BEACH_START_Z - 4 - this.zOffset);
        for (let i = 0; i < 4; i++) {
            const lx = Math.floor(Math.random() * (this.width - 6)) + 3;
            const lz = Math.floor(Math.random() * Math.max(1, maxLandLz - 3)) + 3;
            const ly = 1;

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

    generateOneBlockTerrain(initialBlock = 'grass') {
        this.loadedFromSave = false;
        this.grid = new Array(this.width * this.height * this.depth);
        const idx = this.getGridIndex(0, 6, 0);
        if (idx !== -1) {
            this.grid[idx] = initialBlock || 'grass';
        }
        this.updateMesh();
    }

    spawnTree(startX, startY, startZ) {
        const trunkH = 4 + Math.floor(Math.random() * 2);
        for (let dy = 0; dy < trunkH; dy++) {
            const idx = this.getGridIndex(startX, startY + dy, startZ);
            if (idx !== -1) this.grid[idx] = 'wood';
        }

        const leafStart = startY + trunkH - 2;
        for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
                for (let ly = 0; ly <= 2; ly++) {
                    if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly === 2) continue;
                    const idx = this.getGridIndex(startX + lx, leafStart + ly, startZ + lz);
                    if (idx !== -1 && this.grid[idx] === undefined) {
                        this.grid[idx] = 'leaf';
                    }
                }
            }
        }
    }

    isTransparent(type) {
        if (!type) return true;
        return TRANSPARENT_BASE_TYPES.has(normalizeBlockType(type));
    }

    isNeighborTransparentTo(nIdx, currentBase) {
        const neighborType = this.grid[nIdx];
        if (neighborType === undefined) return true;
        const neighborBase = normalizeBlockType(neighborType);
        return TRANSPARENT_BASE_TYPES.has(neighborBase) && neighborBase !== currentBase;
    }

    isBlockVisibleAtIndex(lx, ly, lz, currentBase) {
        if (lx <= 0 || lx >= this.width - 1 || ly <= 0 || ly >= this.height - 1 || lz <= 0 || lz >= this.depth - 1) {
            return true;
        }
        const strideX = this.height * this.depth;
        const strideY = this.depth;
        const baseIdx = lx * strideX + ly * strideY + lz;

        return (
            this.isNeighborTransparentTo(baseIdx + strideX, currentBase) ||
            this.isNeighborTransparentTo(baseIdx - strideX, currentBase) ||
            this.isNeighborTransparentTo(baseIdx + strideY, currentBase) ||
            this.isNeighborTransparentTo(baseIdx - strideY, currentBase) ||
            this.isNeighborTransparentTo(baseIdx + 1, currentBase) ||
            this.isNeighborTransparentTo(baseIdx - 1, currentBase)
        );
    }

    updateMesh() {
        const counts = {};
        for (let i = 0; i < this.blockTypesList.length; i++) {
            counts[this.blockTypesList[i]] = 0;
        }
        const auxCounts = {};
        this.auxMeshMap.forEach((_, key) => {
            auxCounts[key] = 0;
        });

        const matrix = new THREE.Matrix4();
        const posVec = new THREE.Vector3();
        const identityQuat = FACING_QUATS.up;
        this.sawPositions.length = 0;
        const sawQuat = this._sawQuat.setFromAxisAngle(AXIS_X, this.sawSpinAngle);

        const pushToMap = (meshMap, countMap, key, px, py, pz, quat = identityQuat) => {
            const mesh = meshMap.get(key);
            if (!mesh) return;
            const instanceIdx = countMap[key] || 0;
            if (instanceIdx < mesh.maxInstances) {
                posVec.set(px, py, pz);
                matrix.compose(posVec, quat, UNIT_SCALE);
                mesh.setMatrixAt(instanceIdx, matrix);
                countMap[key] = instanceIdx + 1;
            }
        };

        let idx = 0;
        for (let x = 0; x < this.width; x++) {
            const worldX = x + this.xOffset;
            for (let y = 0; y < this.height; y++) {
                for (let z = 0; z < this.depth; z++) {
                    const type = this.grid[idx];
                    if (type !== undefined) {
                        const parsed = parseBlockState(type);
                        const baseType = parsed.base;
                        if (this.isBlockVisibleAtIndex(x, y, z, baseType)) {
                            const worldZ = z + this.zOffset;
                            if (baseType === 'rail') {
                                if (parsed.shape.startsWith('asc_')) {
                                    pushToMap(this.auxMeshMap, auxCounts, 'rail_slope', worldX, y, worldZ, RAIL_SLOPE_QUATS[parsed.shape] || RAIL_SLOPE_QUATS.asc_n);
                                } else if (parsed.shape === 'ns' || parsed.shape === 'ew') {
                                    pushToMap(this.instancedMeshMap, counts, 'rail', worldX, y, worldZ, RAIL_Y_QUATS[parsed.shape] || identityQuat);
                                } else {
                                    pushToMap(this.auxMeshMap, auxCounts, 'rail_curve', worldX, y, worldZ, RAIL_Y_QUATS[parsed.shape] || identityQuat);
                                }
                            } else if (baseType === 'powered_rail') {
                                if (parsed.shape.startsWith('asc_')) {
                                    const slopeKey = parsed.active ? 'powered_rail_slope_on' : 'powered_rail_slope_off';
                                    pushToMap(this.auxMeshMap, auxCounts, slopeKey, worldX, y, worldZ, RAIL_SLOPE_QUATS[parsed.shape] || RAIL_SLOPE_QUATS.asc_n);
                                } else if (parsed.shape !== 'ns' && parsed.shape !== 'ew') {
                                    const curveKey = parsed.active ? 'powered_rail_curve_on' : 'powered_rail_curve_off';
                                    pushToMap(this.auxMeshMap, auxCounts, curveKey, worldX, y, worldZ, RAIL_Y_QUATS[parsed.shape] || identityQuat);
                                } else if (parsed.active) {
                                    pushToMap(this.auxMeshMap, auxCounts, 'powered_rail_on', worldX, y, worldZ, RAIL_Y_QUATS[parsed.shape] || identityQuat);
                                } else {
                                    pushToMap(this.instancedMeshMap, counts, 'powered_rail', worldX, y, worldZ, RAIL_Y_QUATS[parsed.shape] || identityQuat);
                                }
                            } else if (baseType === 'redstone') {
                                if (parsed.active) {
                                    pushToMap(this.auxMeshMap, auxCounts, 'redstone_on', worldX, y, worldZ, identityQuat);
                                } else {
                                    pushToMap(this.instancedMeshMap, counts, 'redstone', worldX, y, worldZ, identityQuat);
                                }
                            } else if (baseType === 'laser') {
                                const q = LASER_FACING_QUATS[parsed.facing] || identityQuat;
                                if (parsed.active) {
                                    pushToMap(this.auxMeshMap, auxCounts, 'laser_on', worldX, y, worldZ, q);
                                } else {
                                    pushToMap(this.instancedMeshMap, counts, 'laser', worldX, y, worldZ, q);
                                }
                            } else if (baseType === 'saw') {
                                pushToMap(this.instancedMeshMap, counts, 'saw', worldX, y, worldZ, identityQuat);
                                this.sawPositions.push({ x: worldX, y, z: worldZ });
                                pushToMap(this.auxMeshMap, auxCounts, 'saw_blade', worldX, y + 0.08, worldZ, sawQuat);
                            } else if (baseType === 'piston') {
                                const q = FACING_QUATS[parsed.facing] || identityQuat;
                                if (parsed.extended) {
                                    pushToMap(this.auxMeshMap, auxCounts, 'piston_ext_base', worldX, y, worldZ, q);
                                } else {
                                    pushToMap(this.instancedMeshMap, counts, 'piston', worldX, y, worldZ, q);
                                }
                            } else if (baseType === 'piston_head') {
                                const q = FACING_QUATS[parsed.facing] || identityQuat;
                                pushToMap(this.auxMeshMap, auxCounts, 'piston_head_plate', worldX, y, worldZ, q);
                                pushToMap(this.auxMeshMap, auxCounts, 'piston_head_rod', worldX, y, worldZ, q);
                            } else if (baseType === 'lever') {
                                const q = FACING_QUATS[parsed.facing] || identityQuat;
                                pushToMap(this.instancedMeshMap, counts, 'lever', worldX, y, worldZ, q);
                                pushToMap(this.auxMeshMap, auxCounts, parsed.active ? 'lever_handle_on' : 'lever_handle_off', worldX, y, worldZ, q);
                            } else if (baseType === 'pressure_plate') {
                                if (parsed.pressed || parsed.active) {
                                    pushToMap(this.auxMeshMap, auxCounts, 'pressure_plate_depressed', worldX, y, worldZ, identityQuat);
                                } else {
                                    pushToMap(this.instancedMeshMap, counts, 'pressure_plate', worldX, y, worldZ, identityQuat);
                                }
                            } else {
                                const q = baseType === 'button' ? (FACING_QUATS[parsed.facing] || identityQuat) : identityQuat;
                                pushToMap(this.instancedMeshMap, counts, baseType, worldX, y, worldZ, q);
                            }
                        }
                    }
                    idx++;
                }
            }
        }

        const finalizeMeshGroup = (meshMap, countMap) => {
            meshMap.forEach((mesh, type) => {
                const nextCount = countMap[type] || 0;
                mesh.count = nextCount;
                mesh.instanceMatrix.needsUpdate = true;
                if (nextCount > 0) {
                    mesh.computeBoundingSphere();
                } else {
                    mesh.boundingSphere = null;
                }
            });
        };

        finalizeMeshGroup(this.instancedMeshMap, counts);
        finalizeMeshGroup(this.auxMeshMap, auxCounts);
    }

    updateAnimatedBlocks(dt) {
        if (this.sawPositions.length === 0) return;
        const bladeMesh = this.auxMeshMap.get('saw_blade');
        if (!bladeMesh) return;

        this.sawSpinAngle = (this.sawSpinAngle + dt * 10.0) % (Math.PI * 2);
        this._sawQuat.setFromAxisAngle(AXIS_X, this.sawSpinAngle);
        const count = Math.min(this.sawPositions.length, bladeMesh.maxInstances);
        for (let i = 0; i < count; i++) {
            const s = this.sawPositions[i];
            this._sawPos.set(s.x, s.y + 0.08, s.z);
            this._sawMatrix.compose(this._sawPos, this._sawQuat, UNIT_SCALE);
            bladeMesh.setMatrixAt(i, this._sawMatrix);
        }
        bladeMesh.count = count;
        bladeMesh.instanceMatrix.needsUpdate = true;
    }

    /**
     * Fast 3D DDA voxel raycast over integer-centered blocks [bx - 0.5, bx + 0.5].
     * Skips flowing/source water and lava so players can target solid blocks cleanly.
     */
    raycastBlock(origin, direction, maxDist = 6.0) {
        const ox = origin.x + 0.5;
        const oy = origin.y + 0.5;
        const oz = origin.z + 0.5;

        let cx = Math.floor(ox);
        let cy = Math.floor(oy);
        let cz = Math.floor(oz);

        const stepX = direction.x > 0 ? 1 : (direction.x < 0 ? -1 : 0);
        const stepY = direction.y > 0 ? 1 : (direction.y < 0 ? -1 : 0);
        const stepZ = direction.z > 0 ? 1 : (direction.z < 0 ? -1 : 0);

        const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
        const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
        const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

        let tMaxX = stepX > 0 ? (cx + 1 - ox) * tDeltaX : (stepX < 0 ? (ox - cx) * tDeltaX : Infinity);
        let tMaxY = stepY > 0 ? (cy + 1 - oy) * tDeltaY : (stepY < 0 ? (oy - cy) * tDeltaY : Infinity);
        let tMaxZ = stepZ > 0 ? (cz + 1 - oz) * tDeltaZ : (stepZ < 0 ? (oz - cz) * tDeltaZ : Infinity);

        let t = 0;
        let nx = 0;
        let ny = 0;
        let nz = 0;

        for (let step = 0; step < 32 && t <= maxDist; step++) {
            if (t > 0) {
                const blockType = this.getBlockAt(cx, cy, cz);
                if (blockType && !blockType.startsWith('water') && !blockType.startsWith('lava')) {
                    return {
                        position: new THREE.Vector3(cx, cy, cz),
                        normal: new THREE.Vector3(nx, ny, nz),
                        distance: t,
                        blockType
                    };
                }
            }

            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) {
                    cx += stepX;
                    t = tMaxX;
                    tMaxX += tDeltaX;
                    nx = -stepX; ny = 0; nz = 0;
                } else {
                    cz += stepZ;
                    t = tMaxZ;
                    tMaxZ += tDeltaZ;
                    nx = 0; ny = 0; nz = -stepZ;
                }
            } else {
                if (tMaxY < tMaxZ) {
                    cy += stepY;
                    t = tMaxY;
                    tMaxY += tDeltaY;
                    nx = 0; ny = -stepY; nz = 0;
                } else {
                    cz += stepZ;
                    t = tMaxZ;
                    tMaxZ += tDeltaZ;
                    nx = 0; ny = 0; nz = -stepZ;
                }
            }
        }

        return null;
    }

    setHighlightPosition(pos) {
        if (pos) {
            this.highlightBox.position.copy(pos);
            this.highlightBox.visible = true;
        } else {
            this.highlightBox.visible = false;
        }
    }

    getBlockAt(x, y, z) {
        const idx = this.getGridIndex(x, y, z);
        return idx !== -1 ? (this.grid[idx] || null) : null;
    }

    addBlock(x, y, z, type, silent = false, skipUpdate = false) {
        const idx = this.getGridIndex(x, y, z);
        if (idx === -1) return false;
        if (this.grid[idx] !== undefined) {
            this.removeBlock(x, y, z, true, true);
        }

        let finalType = type;
        if (type === 'water') finalType = 'water_source';
        if (type === 'lava') finalType = 'lava_source';

        this.grid[idx] = finalType;
        if (!skipUpdate) {
            this.updateMesh();
        }
        if (!silent) {
            sounds.playPlaceSound();
        }

        if (finalType === 'crop') {
            setTimeout(() => {
                this.spawnCropParticles(x, y, z, 0x2d6a4f);
            }, 50).unref?.();

            setTimeout(() => {
                if (this.getBlockAt(x, y, z) === 'crop') {
                    this.spawnCropParticles(x, y, z, 0x55a630);
                    sounds.playPlaceSound();
                    if (this.game && typeof this.game.showNotification === 'function') {
                        this.game.showNotification('Tanaman gandum siap dipanen.');
                    }
                }
            }, 5000).unref?.();
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

    spawnBlockBreakParticles(x, y, z, type, overrideColor = null) {
        if (!type && overrideColor === null) return;
        const baseType = normalizeBlockType(type);
        const blockConfig = BLOCK_TYPES[baseType];
        const color = overrideColor !== null ? overrideColor : (blockConfig ? blockConfig.color : 0x888888);

        const count = 12;
        const particlesList = [];

        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({ color });
            const mesh = new THREE.Mesh(this.particleGeo, mat);
            mesh.position.set(
                x + (Math.random() - 0.5) * 0.6,
                y + (Math.random() - 0.5) * 0.6,
                z + (Math.random() - 0.5) * 0.6
            );

            const speed = 1.5 + Math.random() * 2.0;
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 1.5,
                Math.random() * 1.5 + 0.5,
                (Math.random() - 0.5) * 1.5
            ).normalize().multiplyScalar(speed);

            this.scene.add(mesh);
            particlesList.push({
                mesh,
                velocity,
                life: 0.3 + Math.random() * 0.3,
                elapsed: 0,
                material: mat,
                sharedGeo: true
            });
        }
        this.game.particles.push(...particlesList);
    }

    spawnCropParticles(x, y, z, color) {
        if (!this.game || !this.game.particles) return;
        const count = 10;
        const particlesList = [];
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
            const mesh = new THREE.Mesh(this.cropParticleGeo, mat);
            mesh.position.set(
                x + (Math.random() - 0.5) * 0.5,
                y + Math.random() * 0.5,
                z + (Math.random() - 0.5) * 0.5
            );
            const speed = 1.0 + Math.random() * 1.5;
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.8,
                Math.random() * 1.0 + 0.5,
                (Math.random() - 0.5) * 0.8
            ).normalize().multiplyScalar(speed);
            this.scene.add(mesh);
            particlesList.push({
                mesh,
                velocity,
                life: 0.3 + Math.random() * 0.3,
                elapsed: 0,
                material: mat,
                sharedGeo: true
            });
        }
        this.game.particles.push(...particlesList);
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
                            newAdditions.push({ idx, type: 'obsidian' });
                            changed = true;
                            idx++;
                            continue;
                        }
                    }

                    if (type && (type.startsWith('water_') || type.startsWith('lava_'))) {
                        const isLava = type.startsWith('lava_');
                        const baseType = isLava ? 'lava' : 'water';
                        const suffix = type.slice(baseType.length + 1);
                        const isSource = suffix === 'source';
                        const level = isSource ? 4 : parseInt(suffix, 10);

                        if (y > 0) {
                            const belowIdx = idx - this.depth;
                            const belowBlock = this.grid[belowIdx];
                            if (!belowBlock) {
                                newAdditions.push({ idx: belowIdx, type: `${baseType}_4` });
                                changed = true;
                                idx++;
                                continue;
                            }
                        }

                        if (level > 1) {
                            const neighbors = [];
                            if (x > 0) neighbors.push(idx - this.height * this.depth);
                            if (x < this.width - 1) neighbors.push(idx + this.height * this.depth);
                            if (z > 0) neighbors.push(idx - 1);
                            if (z < this.depth - 1) neighbors.push(idx + 1);

                            for (const nIdx of neighbors) {
                                if (!this.grid[nIdx]) {
                                    newAdditions.push({ idx: nIdx, type: `${baseType}_${level - 1}` });
                                    changed = true;
                                }
                            }
                        }

                        if (!isSource) {
                            let hasSource = false;
                            if (y < this.height - 1) {
                                const aboveBlock = this.grid[idx + this.depth];
                                if (aboveBlock && aboveBlock.startsWith(baseType)) {
                                    hasSource = true;
                                }
                            }
                            if (!hasSource) {
                                const adjacents = [];
                                if (x > 0) adjacents.push(idx - this.height * this.depth);
                                if (x < this.width - 1) adjacents.push(idx + this.height * this.depth);
                                if (z > 0) adjacents.push(idx - 1);
                                if (z < this.depth - 1) adjacents.push(idx + 1);

                                for (const adjIdx of adjacents) {
                                    const adjBlock = this.grid[adjIdx];
                                    if (adjBlock && adjBlock.startsWith(baseType)) {
                                        const adjSuffix = adjBlock.slice(baseType.length + 1);
                                        const adjLevel = adjSuffix === 'source' ? 4 : parseInt(adjSuffix, 10);
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

        for (const rIdx of toRemove) {
            this.grid[rIdx] = undefined;
        }
        for (const { idx: aIdx, type } of newAdditions) {
            if (this.grid[aIdx] === undefined) {
                this.grid[aIdx] = type;
            }
        }

        if (changed) {
            this.updateMesh();
        }
    }

    save(storageKey = 'nizamcraft-save') {
        try {
            const entries = [];
            for (let idx = 0; idx < this.grid.length; idx++) {
                const type = this.grid[idx];
                if (type !== undefined) {
                    entries.push([idx, type]);
                }
            }
            const data = {
                version: WORLD_SAVE_VERSION,
                grid: entries,
                width: this.width,
                height: this.height,
                depth: this.depth
            };
            localStorage.setItem(storageKey, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Failed to save game:', e);
            return false;
        }
    }

    load(storageKey = 'nizamcraft-save') {
        try {
            const saved = localStorage.getItem(storageKey);
            if (!saved) {
                this.loadedFromSave = false;
                return false;
            }

            const data = JSON.parse(saved);
            if (!data || data.version !== WORLD_SAVE_VERSION) {
                localStorage.removeItem?.(storageKey);
                if (storageKey === 'nizamcraft-save') {
                    localStorage.removeItem?.('nizamcraft-player');
                    localStorage.removeItem?.('nizamcraft-chests');
                }
                this.loadedFromSave = false;
                return false;
            }

            this.width = data.width || 96;
            this.height = data.height || 24;
            this.depth = data.depth || 96;
            this.xOffset = -this.width / 2;
            this.zOffset = -this.depth / 2;

            this.grid = new Array(this.width * this.height * this.depth);
            if (Array.isArray(data.grid)) {
                data.grid.forEach(([key, type]) => {
                    if (typeof key === 'string') {
                        const [x, y, z] = key.split(',').map(Number);
                        const idx = this.getGridIndex(x, y, z);
                        if (idx !== -1) this.grid[idx] = type;
                    } else if (key >= 0 && key < this.grid.length) {
                        this.grid[key] = type;
                    }
                });
            }
            this.updateMesh();
            this.loadedFromSave = true;
            return true;
        } catch (e) {
            console.error('Failed to load game:', e);
            this.loadedFromSave = false;
            return false;
        }
    }

    reset(mode = 'freeplay', storageKey = 'nizamcraft-save') {
        if (mode === 'survival') {
            this.generateOneBlockTerrain('grass');
        } else {
            this.generateTerrain();
        }
        this.save(storageKey);
    }
}
