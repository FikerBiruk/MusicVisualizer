/**
 * Reactive Worlds — Environment backgrounds that animate behind the main visualizer.
 *
 * Worlds: Nebula, Liquid Chrome, Synthwave Grid, City Skyline
 * Each world draws onto the provided 2D context and reacts to audio state.
 */

import { fbm, noise2D } from './noise.js';

// ============================================================================
// NEBULA WORLD — Pulsing cosmic clouds driven by bass
// ============================================================================
class NebulaWorld {
    constructor() {
        this.time = 0;
        // Pre-generate cloud layer positions
        this.layers = [];
        for (let i = 0; i < 5; i++) {
            this.layers.push({
                offsetX: Math.random() * 1000,
                offsetY: Math.random() * 1000,
                speed: 0.02 + Math.random() * 0.03,
                hueShift: Math.random() * 360,
                scale: 2.5 + i * 1.5,
            });
        }
    }

    draw(ctx, w, h, { bass, energy, beatIntensity, palette, dt }) {
        this.time += dt;

        for (const layer of this.layers) {
            const ox = layer.offsetX + this.time * layer.speed * 30;
            const oy = layer.offsetY + this.time * layer.speed * 20;
            const scale = layer.scale;
            const pulseScale = 1 + bass * 0.5 + beatIntensity * 0.3;

            // Sample noise at lower resolution for performance
            const step = 12;
            for (let x = 0; x < w; x += step) {
                for (let y = 0; y < h; y += step) {
                    const nx = (x / w) * scale + ox * 0.01;
                    const ny = (y / h) * scale + oy * 0.01;
                    let n = fbm(nx * pulseScale, ny * pulseScale, 3);
                    n = (n + 1) * 0.5; // normalize 0..1

                    if (n > 0.35) {
                        const alpha = (n - 0.35) * 0.6 * (0.3 + bass * 0.5);
                        const hue = (layer.hueShift + energy * 120 + this.time * 20) % 360;
                        const sat = 60 + beatIntensity * 40;
                        const lum = 20 + n * 40 + beatIntensity * 20;
                        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lum}%, ${Math.min(alpha, 0.25)})`;
                        ctx.fillRect(x, y, step, step);
                    }
                }
            }
        }

        // Bright nebula core in center
        const coreAlpha = 0.05 + bass * 0.1 + beatIntensity * 0.08;
        const coreR = Math.min(w, h) * (0.2 + bass * 0.15);
        const cg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, coreR);
        const hue = (this.time * 30 + energy * 200) % 360;
        cg.addColorStop(0, `hsla(${hue}, 80%, 60%, ${coreAlpha})`);
        cg.addColorStop(0.5, `hsla(${(hue + 40) % 360}, 70%, 40%, ${coreAlpha * 0.4})`);
        cg.addColorStop(1, 'transparent');
        ctx.fillStyle = cg;
        ctx.fillRect(0, 0, w, h);
    }
}

// ============================================================================
// LIQUID CHROME — Reflective metallic surface rippling with amplitude
// ============================================================================
class LiquidChromeWorld {
    constructor() {
        this.time = 0;
    }

    draw(ctx, w, h, { bass, energy, beatIntensity, palette, dt }) {
        this.time += dt;
        const rows = 60;
        const cols = 80;
        const cellW = w / cols;
        const cellH = h / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const nx = c / cols;
                const ny = r / rows;

                // Multiple sine waves for chrome ripple effect
                const ripple1 = Math.sin(nx * 8 + this.time * 2 + bass * 4) * 0.5;
                const ripple2 = Math.sin(ny * 6 - this.time * 1.5 + energy * 3) * 0.5;
                const ripple3 = Math.sin((nx + ny) * 10 + this.time * 3) * 0.3;
                const ripple4 = Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 12 - this.time * 2 + beatIntensity * 5) * 0.4;

                let val = (ripple1 + ripple2 + ripple3 + ripple4) * 0.5 + 0.5;
                val = Math.pow(val, 0.8); // Increase contrast

                // Chrome-like metallic shading
                const lum = Math.floor(val * 100);
                const sat = Math.floor(10 + beatIntensity * 30 + energy * 20);
                const hue = Math.floor(200 + val * 40 + this.time * 10 + bass * 60) % 360;
                const alpha = 0.15 + energy * 0.1;

                ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lum}%, ${alpha})`;
                ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
            }
        }
    }
}

// ============================================================================
// SYNTHWAVE GRID — Retro wireframe grid receding to vanishing point
// ============================================================================
class SynthwaveGridWorld {
    constructor() {
        this.time = 0;
        this.gridOffset = 0;
    }

    draw(ctx, w, h, { bass, energy, beatIntensity, palette, dt, timeData }) {
        this.time += dt;
        this.gridOffset = (this.gridOffset + dt * (80 + bass * 200 + beatIntensity * 150)) % 100;

        const horizon = h * 0.45;
        const vanishX = w / 2;

        // Synthwave sun
        const sunR = Math.min(w, h) * 0.12;
        const sunY = horizon - sunR * 0.3;
        const sunGrad = ctx.createRadialGradient(vanishX, sunY, 0, vanishX, sunY, sunR);
        sunGrad.addColorStop(0, `rgba(255, 120, 50, ${0.4 + beatIntensity * 0.3})`);
        sunGrad.addColorStop(0.5, `rgba(255, 50, 100, ${0.3 + beatIntensity * 0.2})`);
        sunGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(vanishX, sunY, sunR, 0, Math.PI * 2);
        ctx.fill();

        // Sun horizontal scan lines
        ctx.save();
        ctx.beginPath();
        ctx.arc(vanishX, sunY, sunR, 0, Math.PI * 2);
        ctx.clip();
        for (let i = 0; i < 8; i++) {
            const y = sunY - sunR + (i + 0.5) * (sunR * 2) / 8;
            const gap = 2 + i * 0.5;
            ctx.fillStyle = `rgba(5, 5, 20, ${0.6 - i * 0.05})`;
            ctx.fillRect(vanishX - sunR, y, sunR * 2, gap);
        }
        ctx.restore();

        // Grid lines
        ctx.strokeStyle = `rgba(255, 50, 200, ${0.2 + energy * 0.3 + beatIntensity * 0.2})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 6 + beatIntensity * 10;
        ctx.shadowColor = `rgba(255, 50, 200, ${0.3 + beatIntensity * 0.3})`;

        // Horizontal grid lines (receding with perspective)
        const gridLines = 20;
        for (let i = 0; i < gridLines; i++) {
            const rawT = (i + this.gridOffset / 100 * (100 / gridLines)) / gridLines;
            const t = rawT % 1;
            const perspY = horizon + Math.pow(t, 1.8) * (h - horizon);
            const spread = 1 + Math.pow(t, 1.2) * 3;

            ctx.beginPath();
            ctx.moveTo(vanishX - w * spread, perspY);
            ctx.lineTo(vanishX + w * spread, perspY);
            ctx.stroke();
        }

        // Vertical grid lines (converging to vanishing point)
        const vLines = 24;
        for (let i = -vLines / 2; i <= vLines / 2; i++) {
            const baseX = vanishX + i * (w / vLines) * 3;
            ctx.beginPath();
            ctx.moveTo(vanishX, horizon);
            ctx.lineTo(baseX, h);
            ctx.stroke();
        }

        // Waveform on the grid surface
        if (timeData) {
            const samples = Math.min(128, timeData.length);
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.4 + beatIntensity * 0.4})`;
            ctx.lineWidth = 2 + beatIntensity * 2;
            ctx.shadowColor = 'rgba(0, 255, 255, 0.5)';
            ctx.shadowBlur = 10 + beatIntensity * 15;
            ctx.beginPath();
            for (let i = 0; i < samples; i++) {
                const x = (i / (samples - 1)) * w;
                const val = (timeData[i] - 128) / 128;
                const perspT = 0.3;
                const baseY = horizon + Math.pow(perspT, 1.8) * (h - horizon);
                const y = baseY + val * 60 * (1 + bass * 2);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
    }
}

// ============================================================================
// CITY SKYLINE — Silhouette with frequency-reactive window lights
// ============================================================================
class CitySkylineWorld {
    constructor() {
        this.buildings = [];
        this.generated = false;
        this.time = 0;
    }

    generateBuildings(w, h) {
        this.buildings = [];
        const count = Math.floor(w / 30) + 10;
        let x = -20;
        for (let i = 0; i < count; i++) {
            const bw = 20 + Math.random() * 50;
            const bh = 60 + Math.random() * (h * 0.35);
            const windows = [];
            const winCols = Math.floor(bw / 12);
            const winRows = Math.floor(bh / 18);
            for (let row = 0; row < winRows; row++) {
                for (let col = 0; col < winCols; col++) {
                    windows.push({
                        rx: (col + 0.5) / winCols, // relative x within building
                        ry: (row + 0.5) / winRows, // relative y within building
                        flickerPhase: Math.random() * Math.PI * 2,
                        flickerSpeed: 0.5 + Math.random() * 3,
                        band: Math.floor(Math.random() * 8), // freq band
                        baseAlpha: 0.1 + Math.random() * 0.3,
                    });
                }
            }
            this.buildings.push({ x, w: bw, h: bh, windows });
            x += bw + 2 + Math.random() * 8;
        }
        this.generated = true;
    }

    draw(ctx, w, h, { bass, energy, beatIntensity, freqData, dt }) {
        this.time += dt;
        if (!this.generated || this.buildings.length === 0) {
            this.generateBuildings(w, h);
        }

        const baseY = h * 0.92;

        // Sky glow behind buildings
        const skyGrad = ctx.createLinearGradient(0, baseY - h * 0.4, 0, baseY);
        skyGrad.addColorStop(0, `rgba(20, 5, 40, ${0.1 + energy * 0.15})`);
        skyGrad.addColorStop(1, `rgba(60, 10, 80, ${0.08 + bass * 0.1})`);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, baseY - h * 0.4, w, h * 0.4);

        for (const b of this.buildings) {
            const bx = b.x;
            const by = baseY - b.h;

            // Building silhouette
            ctx.fillStyle = `rgba(8, 5, 15, 0.9)`;
            ctx.fillRect(bx, by, b.w, b.h);

            // Building outline glow on beat
            if (beatIntensity > 0.3) {
                ctx.strokeStyle = `rgba(100, 50, 200, ${beatIntensity * 0.3})`;
                ctx.lineWidth = 1;
                ctx.strokeRect(bx, by, b.w, b.h);
            }

            // Windows
            for (const win of b.windows) {
                const wx = bx + win.rx * b.w;
                const wy = by + win.ry * b.h;
                const ww = Math.min(6, b.w / 6);
                const wh = Math.min(8, b.h / 12);

                // Frequency-reactive brightness
                let freqVal = 0;
                if (freqData) {
                    const bandIdx = Math.floor((win.band / 8) * Math.min(64, freqData.length));
                    freqVal = freqData[bandIdx] / 255;
                }

                const flicker = Math.sin(this.time * win.flickerSpeed + win.flickerPhase);
                const alpha = win.baseAlpha + freqVal * 0.6 + flicker * 0.1 + beatIntensity * 0.2;

                if (alpha > 0.15) {
                    // Warm window light
                    const hue = 30 + freqVal * 30; // warm yellow to orange
                    const lum = 50 + freqVal * 30;
                    ctx.fillStyle = `hsla(${hue}, 80%, ${lum}%, ${Math.min(alpha, 0.9)})`;
                    ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);

                    // Window glow
                    if (freqVal > 0.5) {
                        ctx.shadowBlur = 4;
                        ctx.shadowColor = `hsla(${hue}, 90%, 60%, 0.5)`;
                        ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
                        ctx.shadowBlur = 0;
                    }
                }
            }
        }

        // Ground line
        ctx.fillStyle = `rgba(100, 50, 200, ${0.15 + beatIntensity * 0.2})`;
        ctx.fillRect(0, baseY, w, 2);
    }
}

// ============================================================================
// WORLD MANAGER — Toggles and manages environment worlds
// ============================================================================
export class WorldManager {
    constructor() {
        this.worlds = {
            nebula: new NebulaWorld(),
            chrome: new LiquidChromeWorld(),
            synthwave: new SynthwaveGridWorld(),
            city: new CitySkylineWorld(),
        };
        this.active = null; // null = no world
    }

    setWorld(name) {
        this.active = name && this.worlds[name] ? name : null;
    }

    draw(ctx, w, h, audioState) {
        if (!this.active || !this.worlds[this.active]) return;
        this.worlds[this.active].draw(ctx, w, h, audioState);
    }

    regenerate(w, h) {
        // Regenerate procedural data on resize
        if (this.worlds.city) this.worlds.city.generated = false;
    }
}

