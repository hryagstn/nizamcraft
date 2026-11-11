import { getBlockPreviewDataURL } from './textures.js';

// Production Lucide SVG icon paths sourced via better-icons
const LUCIDE_INNER = {
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>',
    folder: '<path d="m6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
    maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/>',
    locate: '<path d="M2 12h3m14 0h3M12 2v3m0 14v3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9a9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    logout: '<path d="m16 17l5-5l-5-5m5 5H9m0 9H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    heart: '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676a.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    shieldHalf: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zm-8 9V2"/>',
    backpack: '<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm4 0h8m-8 8h8"/><path d="M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
    sword: '<path d="m11 19l-6-6m0 8l-2-2m5-3l-4 4m5.5-2.5L20.414 6.586A2 2 0 0 0 21 5.172V3h-2.172a2 2 0 0 0-1.414.586L6.5 14.5"/>',
    swords: '<path d="m13 19l6-6m-4.5 4.5L3.586 6.586A2 2 0 0 1 3 5.172V3h2.172a2 2 0 0 1 1.414.586L17.5 14.5m-2.672-8.328l2.586-2.586A2 2 0 0 1 18.828 3H21v2.172a2 2 0 0 1-.586 1.414l-2.586 2.586M16 16l4 4m-1 1l2-2M5 14l4 4m-4 3l-2-2m4.5-2.5L4 20"/>',
    pickaxe: '<path d="m14 13l-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999m4.973-5.972A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024m4 4.001a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069"/><path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z"/>',
    crosshair: '<circle cx="12" cy="12" r="10"/><path d="M22 12h-4M6 12H2m10-6V2m0 20v-4"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7l8.7 5l8.7-5M12 22V12"/>',
    chevronUp: '<path d="m18 15l-6-6l-6 6"/>',
    sprout: '<path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4a4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3M4 9a5 5 0 0 1 8 4a5 5 0 0 1-8-4m1 12h14"/>',
    hammer: '<path d="m15 12l-9.373 9.373a1 1 0 0 1-3.001-3L12 9m6 6l4-4"/><path d="m21.5 11.5l-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>',
    bookOpen: '<path d="M12 5v16m8.001-2A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2a5 5 0 0 1 4-2z"/>',
    bookMarked: '<path d="M10 2v8l3-3l3 3V2"/><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
    sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594zM20 2v4m2-2h-4"/><circle cx="4" cy="20" r="2"/>',
    wand: '<path d="m21.64 3.64l-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72M14 7l3 3M5 6v4m14 4v4M10 2v2M7 8H3m18 8h-4M11 3H9"/>',
    apple: '<path d="M12 6.528V3a1 1 0 0 1 1-1"/><path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10a3 3 0 0 0 3.648.648a5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"/>',
    helmet: '<path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m0-4a6 6 0 0 1 6 6v3M4 15v-3a6 6 0 0 1 6-6"/><rect width="20" height="4" x="2" y="15" rx="1"/>',
    shirt: '<path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23"/>',
    footprints: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0m16 4v-2.38c0-2.12 1.03-3.12 1-5.62c-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0m-4-3h4M4 13h4"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    flame: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0a5 5 0 0 1 1-3a1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
    gem: '<path d="M10.5 3L8 9l4 13l4-13l-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3zM2 9h20"/>',
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2m0 4V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2m0 4.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73zm1 .27V12"/><path d="M3.29 7L12 12l8.71-5M7.5 4.27l9 5.15"/>',
    cart: '<path d="m2.05 2.05l1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18"/><path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25"/><circle cx="18" cy="20" r="2"/><circle cx="8" cy="20" r="2"/>',
    egg: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="12" r="10"/>',
    coins: '<path d="M13.744 17.736a6 6 0 1 1-7.48-7.48M15 6h1v4"/><path d="m6.134 14.768l.866-.5l2 3.464"/><circle cx="16" cy="8" r="6"/>',
    pause: '<rect width="5" height="18" x="14" y="3" rx="1"/><rect width="5" height="18" x="5" y="3" rx="1"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01"/>',
    anvil: '<path d="M7 10H6a4 4 0 0 1-4-4a1 1 0 0 1 1-1h4m0 0a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1a7 7 0 0 1-7 7H8a1 1 0 0 1-1-1zm2 7v5m6-5v5M5 20a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1"/>',
    arrowRight: '<path d="M5 12h14m-7-7l7 7l-7 7"/>',
    slash: '<path d="M22 2L2 22"/>',
    zap: '<path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"/>',
    library: '<path d="m16 6l4 14M12 6v14M8 8v12M4 4v16"/>'
};

export function svgIcon(name, size = 18, color = 'currentColor') {
    const inner = LUCIDE_INNER[name] || LUCIDE_INNER.package;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

export const ITEM_CATALOG = {
    grass: { name: 'Rumput' },
    dirt: { name: 'Tanah' },
    stone: { name: 'Batu' },
    obsidian: { name: 'Obsidian' },
    wood: { name: 'Kayu Gelondongan' },
    planks: { name: 'Papan Kayu' },
    bookshelf: { name: 'Rak Buku' },
    leaf: { name: 'Daun' },
    brick: { name: 'Bata' },
    emerald: { name: 'Zamrud', icon: 'gem', color: '#10b981' },
    diamond: { name: 'Berlian', icon: 'gem', color: '#38bdf8' },
    ender: { name: 'Blok Ender' },
    tnt: { name: 'Blok TNT' },
    water: { name: 'Air' },
    lava: { name: 'Lava' },
    quartz: { name: 'Kuarsa' },
    sand: { name: 'Pasir' },
    farmland: { name: 'Ladang' },
    lucky: { name: 'Lucky Block' },
    magma: { name: 'Magma' },
    crop: { name: 'Gandum' },
    coal_ore: { name: 'Bijih Batu Bara' },
    iron_ore: { name: 'Bijih Besi' },
    gold_ore: { name: 'Bijih Emas' },
    lapis_ore: { name: 'Bijih Lapis' },
    chest: { name: 'Peti Penyimpanan' },
    crafting: { name: 'Meja Crafting' },
    enchanting_table: { name: 'Meja Enchant' },
    piston: { name: 'Piston' },
    rail: { name: 'Rel Kereta' },
    pressure_plate: { name: 'Pelat Tekanan' },
    button: { name: 'Tombol Batu' },
    lever: { name: 'Tuas Saklar' },
    dispenser: { name: 'Dispenser' },
    spawn_irongolem: { name: 'Telur Iron Golem', icon: 'egg', color: '#e2e8f0' },
    spawn_snowgolem: { name: 'Telur Snow Golem', icon: 'egg', color: '#fb923c' },
    stick: { name: 'Tongkat Kayu', icon: 'slash', color: '#d97706' },
    lapis: { name: 'Lapis Lazuli', icon: 'gem', color: '#3b82f6' },
    coal: { name: 'Batu Bara', icon: 'layers', color: '#94a3b8' },
    iron_ingot: { name: 'Batangan Besi', icon: 'layers', color: '#e2e8f0' },
    gold_ingot: { name: 'Batangan Emas', icon: 'coins', color: '#fbbf24' },
    book: { name: 'Buku Kosong', icon: 'bookOpen', color: '#f59e0b' },
    enchanted_book: { name: 'Buku Enchant', icon: 'bookMarked', color: '#c084fc' },
    golden_apple: { name: 'Apel Emas', icon: 'apple', color: '#fbbf24' },
    minecart: { name: 'Minecart', icon: 'cart', color: '#cbd5e1' },
    bow: { name: 'Busur Panah', icon: 'crosshair', color: '#f59e0b' },
    sword_wood: { name: 'Pedang Kayu', icon: 'sword', color: '#d97706' },
    sword_stone: { name: 'Pedang Batu', icon: 'sword', color: '#94a3b8' },
    sword_iron: { name: 'Pedang Besi', icon: 'sword', color: '#e2e8f0' },
    sword_diamond: { name: 'Pedang Berlian', icon: 'sword', color: '#38bdf8' },
    pickaxe_wood: { name: 'Beliung Kayu', icon: 'pickaxe', color: '#d97706' },
    pickaxe_stone: { name: 'Beliung Batu', icon: 'pickaxe', color: '#94a3b8' },
    pickaxe_iron: { name: 'Beliung Besi', icon: 'pickaxe', color: '#e2e8f0' },
    pickaxe_diamond: { name: 'Beliung Berlian', icon: 'pickaxe', color: '#38bdf8' },
    helmet_iron: { name: 'Helm Besi', icon: 'helmet', color: '#e2e8f0' },
    chestplate_iron: { name: 'Zirah Besi', icon: 'shirt', color: '#e2e8f0' },
    leggings_iron: { name: 'Celana Besi', icon: 'shieldHalf', color: '#e2e8f0' },
    boots_iron: { name: 'Sepatu Besi', icon: 'footprints', color: '#e2e8f0' },
    helmet_gold: { name: 'Helm Emas', icon: 'helmet', color: '#fbbf24' },
    chestplate_gold: { name: 'Zirah Emas', icon: 'shirt', color: '#fbbf24' },
    leggings_gold: { name: 'Celana Emas', icon: 'shieldHalf', color: '#fbbf24' },
    boots_gold: { name: 'Sepatu Emas', icon: 'footprints', color: '#fbbf24' },
    helmet_diamond: { name: 'Helm Berlian', icon: 'helmet', color: '#38bdf8' },
    chestplate_diamond: { name: 'Zirah Berlian', icon: 'shirt', color: '#38bdf8' },
    leggings_diamond: { name: 'Celana Berlian', icon: 'shieldHalf', color: '#38bdf8' },
    boots_diamond: { name: 'Sepatu Berlian', icon: 'footprints', color: '#38bdf8' }
};

export function getItemName(type) {
    return ITEM_CATALOG[type]?.name || type;
}

export function getItemVisualHTML(type, size = 24) {
    const meta = ITEM_CATALOG[type];
    const blockDataUrl = getBlockPreviewDataURL(type);
    if (blockDataUrl && (!meta || !meta.icon || type === 'emerald' || type === 'diamond')) {
        // Use genuine procedural pixel-art block texture when item is a block
        if (type !== 'coal' && type !== 'iron_ingot' && type !== 'gold_ingot') {
            return `<img src="${blockDataUrl}" width="${size}" height="${size}" class="pixel-thumb" alt="">`;
        }
    }
    if (meta && meta.icon) {
        return svgIcon(meta.icon, size, meta.color || 'currentColor');
    }
    return svgIcon('package', size, '#cbd5e1');
}
