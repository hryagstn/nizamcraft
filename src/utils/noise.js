// Simplex Noise utility for terrain generation
import { createNoise2D } from 'simplex-noise';

// Create noise generator with a seeded or random generator
let noise2D = createNoise2D();

export function setNoiseSeed(seedFunc) {
    noise2D = createNoise2D(seedFunc);
}

/**
 * Returns a height value between 0 and maxPlayerHeight based on 2D coordinates.
 * Uses octave simplex noise for more natural looking terrain.
 */
export function getTerrainHeight(x, z, maxY = 12) {
    const scale1 = 0.02; // Large-scale features (hills)
    const scale2 = 0.08; // Small-scale features (roughness)
    
    // Octave 1
    const n1 = noise2D(x * scale1, z * scale1);
    // Octave 2
    const n2 = noise2D(x * scale2, z * scale2);
    
    // Combine and normalize to 0-1
    let noiseVal = (n1 * 0.7 + n2 * 0.3); // ranges from -1 to 1
    noiseVal = (noiseVal + 1) / 2; // ranges from 0 to 1
    
    // Add a baseline height and scale to maxY
    const baseline = 2;
    return Math.floor(baseline + noiseVal * (maxY - baseline));
}
