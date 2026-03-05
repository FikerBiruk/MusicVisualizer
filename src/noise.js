/**
 * Simplex-like noise implementation for Nebula world and other effects.
 * Lightweight, no dependencies.
 */

// Simple hash-based 2D/3D noise
const _p = new Uint8Array(512);
const _perm = new Uint8Array(512);
(function initPerm() {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle with seed
    let s = 42;
    for (let i = 255; i > 0; i--) {
        s = (s * 16807 + 7) % 2147483647;
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
        _p[i] = p[i & 255];
        _perm[i] = _p[i];
    }
})();

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

function grad2d(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : -x;
    const v = h === 0 || h === 3 ? y : -y;
    return u + v;
}

/**
 * 2D Perlin noise, returns [-1, 1]
 */
export function noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = _perm[_perm[X] + Y];
    const ab = _perm[_perm[X] + Y + 1];
    const ba = _perm[_perm[X + 1] + Y];
    const bb = _perm[_perm[X + 1] + Y + 1];

    return lerp(
        lerp(grad2d(aa, xf, yf), grad2d(ba, xf - 1, yf), u),
        lerp(grad2d(ab, xf, yf - 1), grad2d(bb, xf - 1, yf - 1), u),
        v
    );
}

/**
 * Fractal Brownian Motion (layered noise)
 */
export function fbm(x, y, octaves = 4) {
    let val = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
        val += amp * noise2D(x * freq, y * freq);
        freq *= 2;
        amp *= 0.5;
    }
    return val;
}

