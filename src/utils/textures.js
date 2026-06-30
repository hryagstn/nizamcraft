import * as THREE from 'three';

// Create a texture from canvas drawing
function createPixelTexture(drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    
    // Disable image smoothing on the context
    ctx.imageSmoothingEnabled = false;
    
    // Draw the texture
    drawFn(ctx);
    
    const texture = new THREE.CanvasTexture(canvas);
    // NearestFilter keeps the retro pixel-art style sharp!
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Procedural textures map
export const textures = {};

// 1. Grass Top
textures.grassTop = createPixelTexture((ctx) => {
    ctx.fillStyle = '#55a630'; // Base green
    ctx.fillRect(0, 0, 16, 16);
    // Add noise
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const rand = Math.random();
            if (rand < 0.2) {
                ctx.fillStyle = '#3f7d20'; // Dark green
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.35) {
                ctx.fillStyle = '#70e000'; // Light green
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
});

// 2. Dirt (used for Grass bottom and Dirt block)
textures.dirt = createPixelTexture((ctx) => {
    ctx.fillStyle = '#8c5b36'; // Base brown
    ctx.fillRect(0, 0, 16, 16);
    // Add noise
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const rand = Math.random();
            if (rand < 0.25) {
                ctx.fillStyle = '#5c3d24'; // Dark brown
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.4) {
                ctx.fillStyle = '#b07d56'; // Light brown
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
});

// 3. Grass Side (top green hanging, bottom brown dirt)
textures.grassSide = createPixelTexture((ctx) => {
    // Fill with dirt first
    ctx.fillStyle = '#8c5b36';
    ctx.fillRect(0, 0, 16, 16);
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const rand = Math.random();
            if (rand < 0.2) {
                ctx.fillStyle = '#5c3d24';
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.3) {
                ctx.fillStyle = '#b07d56';
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    
    // Draw green grass hanging down
    ctx.fillStyle = '#55a630';
    for (let x = 0; x < 16; x++) {
        // Random hanging depth between 3 and 7 pixels
        const depth = 3 + Math.floor(Math.random() * 3);
        ctx.fillRect(x, 0, 1, depth);
        
        // Add random highlights
        if (Math.random() < 0.3) {
            ctx.fillStyle = '#70e000';
            ctx.fillRect(x, depth - 1, 1, 1);
            ctx.fillStyle = '#55a630'; // restore
        }
    }
});

// 4. Stone
textures.stone = createPixelTexture((ctx) => {
    ctx.fillStyle = '#7c7c7c'; // Base gray
    ctx.fillRect(0, 0, 16, 16);
    // Add cobblestone-like cracks
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const rand = Math.random();
            if (rand < 0.18) {
                ctx.fillStyle = '#555555'; // Dark crack
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.3) {
                ctx.fillStyle = '#9e9e9e'; // Light highlight
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
});

// 5. Obsidian
textures.obsidian = createPixelTexture((ctx) => {
    ctx.fillStyle = '#10001f'; // Deep purple/black
    ctx.fillRect(0, 0, 16, 16);
    // Crystal highlights
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const rand = Math.random();
            if (rand < 0.08) {
                ctx.fillStyle = '#3c096c'; // Dark purple
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.15) {
                ctx.fillStyle = '#7b2cbf'; // Glowing magenta/purple
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.25) {
                ctx.fillStyle = '#05000a'; // Pure black
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
});

// 6. Wood Side (Bark)
textures.woodSide = createPixelTexture((ctx) => {
    ctx.fillStyle = '#5c3d24'; // Medium bark brown
    ctx.fillRect(0, 0, 16, 16);
    
    // Draw vertical ridges
    for (let x = 0; x < 16; x++) {
        if (x % 4 === 0 || x % 5 === 1) {
            ctx.fillStyle = '#3d2513'; // Dark ridge
            ctx.fillRect(x, 0, 1, 16);
        } else {
            ctx.fillStyle = '#6d4c33'; // Light ridge
            if (Math.random() < 0.3) {
                ctx.fillRect(x, Math.floor(Math.random() * 16), 1, 3);
            }
        }
    }
});

// 7. Wood Top (Log rings)
textures.woodTop = createPixelTexture((ctx) => {
    ctx.fillStyle = '#d7b899'; // Base light wood rings
    ctx.fillRect(0, 0, 16, 16);
    
    ctx.strokeStyle = '#a47c5c'; // Ring color
    ctx.lineWidth = 1;
    
    // Draw 3 nested squares representing tree rings
    ctx.strokeRect(2, 2, 12, 12);
    ctx.strokeRect(4, 4, 8, 8);
    ctx.strokeRect(6, 6, 4, 4);
    
    // Dark brown bark border
    ctx.fillStyle = '#3d2513';
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(0, 0, 1, 16);
    ctx.fillRect(15, 0, 1, 16);
});

// 8. Leaf (with transparency)
textures.leaf = createPixelTexture((ctx) => {
    ctx.fillStyle = '#2d6a4f'; // Base dark green
    ctx.fillRect(0, 0, 16, 16);
    
    // Leaf clumps and transparent cutouts
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const rand = Math.random();
            if (rand < 0.25) {
                ctx.fillStyle = '#40916c'; // Light leaf
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.4) {
                ctx.fillStyle = '#1b4332'; // Deep shadow leaf
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.55) {
                // Cutout hole (transparent)
                ctx.clearRect(x, y, 1, 1);
            }
        }
    }
});

// 9. Brick
textures.brick = createPixelTexture((ctx) => {
    ctx.fillStyle = '#b04a33'; // Red-orange brick
    ctx.fillRect(0, 0, 16, 16);
    
    // Grout lines (gray)
    ctx.fillStyle = '#c7c7c7';
    
    // Horizontal grout
    ctx.fillRect(0, 3, 16, 1);
    ctx.fillRect(0, 7, 16, 1);
    ctx.fillRect(0, 11, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    
    // Vertical grouts
    // Row 1 (0-2)
    ctx.fillRect(4, 0, 1, 3);
    ctx.fillRect(12, 0, 1, 3);
    // Row 2 (4-6)
    ctx.fillRect(0, 4, 1, 3);
    ctx.fillRect(8, 4, 1, 3);
    // Row 3 (8-10)
    ctx.fillRect(4, 8, 1, 3);
    ctx.fillRect(12, 8, 1, 3);
    // Row 4 (12-14)
    ctx.fillRect(0, 12, 1, 3);
    ctx.fillRect(8, 12, 1, 3);
    
    // Add brick details (noise / texture)
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            // Skip grout lines
            const isGrout = (y === 3 || y === 7 || y === 11 || y === 15 || 
                             (y < 3 && (x === 4 || x === 12)) ||
                             (y > 3 && y < 7 && (x === 0 || x === 8)) ||
                             (y > 7 && y < 11 && (x === 4 || x === 12)) ||
                             (y > 11 && y < 15 && (x === 0 || x === 8)));
                             
            if (!isGrout && Math.random() < 0.15) {
                ctx.fillStyle = '#822f1c'; // Dark brick smudge
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
});

// 10. Emerald
textures.emerald = createPixelTexture((ctx) => {
    ctx.fillStyle = '#06d6a0'; // Base mint emerald
    ctx.fillRect(0, 0, 16, 16);
    
    // Crystal highlights & border
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const isEdge = (x === 0 || y === 0 || x === 15 || y === 15);
            if (isEdge) {
                ctx.fillStyle = '#007254'; // Dark border
                ctx.fillRect(x, y, 1, 1);
            } else {
                const rand = Math.random();
                if (rand < 0.15) {
                    ctx.fillStyle = '#c7f9cc'; // Shiny bright highlight
                    ctx.fillRect(x, y, 1, 1);
                } else if (rand < 0.3) {
                    ctx.fillStyle = '#05b385'; // Deep green shading
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
});

// 11. Diamond
textures.diamond = createPixelTexture((ctx) => {
    ctx.fillStyle = '#80e8ff'; // Base sky diamond
    ctx.fillRect(0, 0, 16, 16);
    
    // Highlights & border
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const isEdge = (x === 0 || y === 0 || x === 15 || y === 15);
            if (isEdge) {
                ctx.fillStyle = '#3ea8cf'; // Darker cyan border
                ctx.fillRect(x, y, 1, 1);
            } else {
                const rand = Math.random();
                if (rand < 0.18) {
                    ctx.fillStyle = '#ffffff'; // Sparkle highlight
                    ctx.fillRect(x, y, 1, 1);
                } else if (rand < 0.3) {
                    ctx.fillStyle = '#00b4d8'; // Darker blue core shadow
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
});

// 12. Ender Block
textures.ender = createPixelTexture((ctx) => {
    ctx.fillStyle = '#1c0330'; // Deep dark ender
    ctx.fillRect(0, 0, 16, 16);
    
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const isEdge = (x === 0 || y === 0 || x === 15 || y === 15);
            if (isEdge) {
                ctx.fillStyle = '#0a0014'; // Black border
                ctx.fillRect(x, y, 1, 1);
            } else {
                const rand = Math.random();
                if (rand < 0.08) {
                    ctx.fillStyle = '#d90429'; // Portal red particle eye
                    ctx.fillRect(x, y, 1, 1);
                } else if (rand < 0.22) {
                    ctx.fillStyle = '#5a189a'; // Portal purple dust
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
});

// 13. TNT Side
textures.tntSide = createPixelTexture((ctx) => {
    ctx.fillStyle = '#cc2a36'; // Red body
    ctx.fillRect(0, 0, 16, 16);
    
    // Draw white stripes (alternating dynamite sticks)
    ctx.fillStyle = '#e9d8a6';
    for (let x = 1; x < 16; x += 3) {
        ctx.fillRect(x, 0, 1, 5);
        ctx.fillRect(x, 11, 1, 5);
    }
    
    // Dark gray belt in the middle (Rows 5-10)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 5, 16, 6);
    
    // Draw "TNT" in black pixel letters (pixelated)
    ctx.fillStyle = '#ffffff';
    
    // Letter T
    ctx.fillRect(1, 6, 3, 1);
    ctx.fillRect(2, 7, 1, 3);
    
    // Letter N
    ctx.fillRect(5, 6, 1, 4);
    ctx.fillRect(6, 7, 1, 1);
    ctx.fillRect(7, 8, 1, 1);
    ctx.fillRect(8, 6, 1, 4);
    
    // Letter T
    ctx.fillRect(11, 6, 3, 1);
    ctx.fillRect(12, 7, 1, 3);
});

// 14. TNT Top
textures.tntTop = createPixelTexture((ctx) => {
    ctx.fillStyle = '#cc2a36'; // Red
    ctx.fillRect(0, 0, 16, 16);
    
    // Black grids (fuse bundles)
    ctx.fillStyle = '#000000';
    for (let x = 0; x < 16; x += 4) {
        ctx.fillRect(x, 0, 1, 16);
        ctx.fillRect(0, x, 16, 1);
    }
    
    // Center fuse block (gray circle & fuse)
    ctx.fillStyle = '#7c7c7c';
    ctx.fillRect(6, 6, 4, 4);
    
    ctx.fillStyle = '#ffffff'; // White fuse sumbu
    ctx.fillRect(8, 8, 1, 4);
});

// 15. Water
textures.water = createPixelTexture((ctx) => {
    ctx.fillStyle = '#4cc9f0'; // Base blue
    ctx.fillRect(0, 0, 16, 16);
    
    // Wave lines
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const wave = Math.sin(x * 0.5) * 2;
            if (Math.abs(y - (8 + wave)) < 1.5 && Math.random() < 0.4) {
                ctx.fillStyle = '#4895ef'; // Light wave
                ctx.fillRect(x, y, 1, 1);
            } else if (Math.random() < 0.1) {
                ctx.fillStyle = '#4361ee'; // Deep blue shade
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
});

// 16. Lava
textures.lava = createPixelTexture((ctx) => {
    ctx.fillStyle = '#d90429'; // Dark red/orange base
    ctx.fillRect(0, 0, 16, 16);
    
    // Glowing currents
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const rand = Math.random();
            if (rand < 0.22) {
                ctx.fillStyle = '#f77f00'; // Orange flow
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.35) {
                ctx.fillStyle = '#fcbf49'; // Bright yellow spot
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.5) {
                ctx.fillStyle = '#9b2226'; // Crusty black-red spot
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
});

// 17. Quartz Block
textures.quartz = createPixelTexture((ctx) => {
    ctx.fillStyle = '#f5f4f0'; // Base creamy white
    ctx.fillRect(0, 0, 16, 16);
    
    // Draw clean borders (polished quartz look)
    ctx.fillStyle = '#e4dfd3'; 
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(0, 0, 1, 16);
    ctx.fillRect(15, 0, 1, 16);
    
    // Subtle quartz streaks / crystal texture
    for (let x = 1; x < 15; x++) {
        for (let y = 1; y < 15; y++) {
            const rand = Math.random();
            if (rand < 0.15) {
                ctx.fillStyle = '#ffffff'; // bright highlight
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.08) {
                ctx.fillStyle = '#dbd6ca'; // subtle shadow
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
});

// 18. Sand
textures.sand = createPixelTexture((ctx) => {
    ctx.fillStyle = '#e5cca4'; // Sandy base yellow
    ctx.fillRect(0, 0, 16, 16);
    // Grainy texture noise
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const rand = Math.random();
            if (rand < 0.18) {
                ctx.fillStyle = '#d0b38c'; // Darker grain
                ctx.fillRect(x, y, 1, 1);
            } else if (rand < 0.3) {
                ctx.fillStyle = '#ebdcb9'; // Lighter grain
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
});

// 19. Farmland Top
textures.farmlandTop = createPixelTexture((ctx) => {
    ctx.fillStyle = '#4c321d'; // Dark fertile soil brown
    ctx.fillRect(0, 0, 16, 16);
    // Draw plowed parallel rows (stripes)
    ctx.fillStyle = '#2d1e10'; // Deep dark furrow rows
    for (let y = 0; y < 16; y += 4) {
        ctx.fillRect(0, y, 16, 2);
    }
    // Add soil noise
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            if (y % 4 !== 0 && Math.random() < 0.15) {
                ctx.fillStyle = '#65432a'; // Lighter soil clod
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
});

// 20. Farmland Side
textures.farmlandSide = createPixelTexture((ctx) => {
    ctx.fillStyle = '#8c5b36'; // Dirt base brown
    ctx.fillRect(0, 0, 16, 16);
    // Dirt noise
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            const rand = Math.random();
            if (rand < 0.2) {
                ctx.fillStyle = '#5c3d24';
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    // Top dark fertile soil layer (about 4 pixels deep)
    ctx.fillStyle = '#4c321d';
    ctx.fillRect(0, 0, 16, 4);
    for (let x = 0; x < 16; x++) {
        if (Math.random() < 0.4) {
            ctx.fillStyle = '#4c321d';
            ctx.fillRect(x, 4, 1, 1 + Math.floor(Math.random() * 2));
        }
    }
});

// 21. Lucky Block
textures.lucky = createPixelTexture((ctx) => {
    ctx.fillStyle = '#ffb703'; // Bright yellow base
    ctx.fillRect(0, 0, 16, 16);
    
    // Orange/Darker border
    ctx.fillStyle = '#fb8500';
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(0, 0, 1, 16);
    ctx.fillRect(15, 0, 1, 16);
    
    // Tiny dark rivets on the corners
    ctx.fillStyle = '#023047';
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(14, 1, 1, 1);
    ctx.fillRect(1, 14, 1, 1);
    ctx.fillRect(14, 14, 1, 1);
    
    // Draw white "?" pixel art in the center (coordinates 4x4 to 12x12)
    ctx.fillStyle = '#ffffff';
    // Top curve of "?"
    ctx.fillRect(5, 4, 6, 1);
    ctx.fillRect(4, 5, 2, 1);
    ctx.fillRect(10, 5, 2, 1);
    // Right side hook
    ctx.fillRect(10, 6, 2, 2);
    // Middle neck of "?"
    ctx.fillRect(8, 8, 2, 1);
    ctx.fillRect(7, 9, 2, 1);
    // Dot of "?"
    ctx.fillRect(7, 11, 2, 2);
    
    // Give "?" a nice dark orange drop-shadow for 3D effect
    ctx.fillStyle = '#d97706';
    ctx.fillRect(11, 5, 1, 1);
    ctx.fillRect(12, 6, 1, 2);
    ctx.fillRect(10, 8, 1, 1);
    ctx.fillRect(9, 9, 1, 1);
    ctx.fillRect(9, 11, 1, 2);
});
