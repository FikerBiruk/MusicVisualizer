/**
 * Music Visualizer v4 — Ultimate Edition
 *
 * Fullscreen canvas, 5 visual modes (Spectrum, Radial, Wave, Galaxy, Hybrid),
 * starfield background, smart particle system, drag-and-drop, glassmorphism UI.
 *
 * NEW in v4:
 * - Reactive Worlds (Nebula, Chrome, Synthwave, City)
 * - Cinematic Camera System
 * - Kaleidoscope & Mirror Effects
 * - Smart Particle Behaviors (cursor orbit, beat scatter, mesh, shapes)
 * - Dynamic Auto-Color Mode
 * - Magic Moments System
 * - Freeze Frame & Slow Motion
 * - Visualizer Composer (mode blending)
 */

import { WorldManager } from './worlds.js';
import { CameraSystem } from './camera.js';
import { PostFXPipeline } from './postfx.js';
import { DynamicColorEngine } from './dynamicColor.js';
import { MagicMomentsSystem } from './magicMoments.js';
import { Composer } from './composer.js';

// ============================================================================
// COLOR PRESETS
// ============================================================================
const COLOR_PRESETS = {
    gradient: ['#ff0000','#ff7f00','#ffff00','#00ff00','#0000ff','#4b0082','#9400d3'],
    fire:     ['#1a0000','#660000','#cc2200','#ff4400','#ff8800','#ffcc00','#ffffaa'],
    ocean:    ['#000d1a','#003366','#0066cc','#00aaff','#00ffff','#66ffff','#ccffff'],
    neon:     ['#ff006e','#fb5607','#ffbe0b','#8338ec','#3a86ff','#06ffa5','#ff006e'],
    aurora:   ['#00ff87','#60efff','#b967ff','#ff6ec7','#00ff87'],
    sunset:   ['#f72585','#b5179e','#7209b7','#560bad','#480ca8','#3a0ca3','#3f37c9','#4361ee','#4cc9f0'],
    mono:     ['#222222','#555555','#888888','#bbbbbb','#eeeeee','#ffffff'],
};

const VISUAL_MODES = ['spectrum','radial','wave','galaxy','hybrid'];

// ============================================================================
// COLOR CACHE
// ============================================================================
const _cc = new Map();
function parseColor(s) {
    if (_cc.has(s)) return _cc.get(s);
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const x = c.getContext('2d'); x.fillStyle = s; x.fillRect(0,0,1,1);
    const d = x.getImageData(0,0,1,1).data;
    const o = { r: d[0], g: d[1], b: d[2] };
    _cc.set(s, o); return o;
}

function lerpColor(palette, t) {
    const v = Math.max(0, Math.min(1, t));
    const idx = v * (palette.length - 1);
    const lo = Math.floor(idx), hi = Math.min(lo + 1, palette.length - 1);
    const f = idx - lo;
    const a = parseColor(palette[lo]), b = parseColor(palette[hi]);
    return {
        r: Math.round(a.r + (b.r - a.r) * f),
        g: Math.round(a.g + (b.g - a.g) * f),
        b: Math.round(a.b + (b.b - a.b) * f),
    };
}

function rgb(c) { return `rgb(${c.r},${c.g},${c.b})`; }
function rgba(c, a) { return `rgba(${c.r},${c.g},${c.b},${a})`; }

// ============================================================================
// AUDIO MANAGER
// ============================================================================
class AudioManager {
    constructor() {
        this.ctx = null; this.analyser = null;
        this.freqData = null; this.timeData = null;
        this.audioEl = null; this.meSrc = null;
        this.msSrc = null; this.gain = null;
        this.source = null; // 'file' | 'mic' | null
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.gain = this.ctx.createGain();
        this.gain.connect(this.ctx.destination);
        this.analyser.connect(this.gain);
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.5;
        this.analyser.minDecibels = -85;
        this.analyser.maxDecibels = -10;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeData = new Uint8Array(this.analyser.fftSize);
    }

    loadFile(file) {
        this.init(); this.disconnectMic();
        if (!this.audioEl) {
            this.audioEl = new Audio();
            this.audioEl.crossOrigin = 'anonymous';
            this.meSrc = this.ctx.createMediaElementSource(this.audioEl);
            this.meSrc.connect(this.analyser);
        }
        if (this.audioEl._url) URL.revokeObjectURL(this.audioEl._url);
        const u = URL.createObjectURL(file);
        this.audioEl._url = u; this.audioEl.src = u;
        this.source = 'file';
    }

    play()  { if (this.audioEl) return this.audioEl.play(); }
    pause() { if (this.audioEl) this.audioEl.pause(); }
    get paused()   { return this.audioEl ? this.audioEl.paused : true; }
    get time()     { return this.audioEl ? this.audioEl.currentTime : 0; }
    set time(v)    { if (this.audioEl) this.audioEl.currentTime = v; }
    get duration() { return this.audioEl ? (this.audioEl.duration || 0) : 0; }
    get vol()      { return this.gain ? this.gain.gain.value : 1; }
    set vol(v)     { if (this.gain) this.gain.gain.value = v; }

    async enableMic() {
        this.init(); this.disconnectMic();
        if (this.audioEl) this.audioEl.pause();

        // Check if getUserMedia is available (requires HTTPS or localhost)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('NOT_SUPPORTED');
        }

        try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.msSrc = this.ctx.createMediaStreamAudioSource(s);
            this.msSrc.connect(this.analyser);
            this.source = 'mic';
        } catch (err) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                throw new Error('DENIED');
            }
            throw new Error('MIC_ERROR: ' + err.message);
        }
    }

    disconnectMic() {
        if (this.msSrc) {
            this.msSrc.mediaStream.getTracks().forEach(t => t.stop());
            this.msSrc.disconnect(); this.msSrc = null;
        }
        if (this.source === 'mic') this.source = this.audioEl ? 'file' : null;
    }

    stop() {
        if (this.audioEl) { this.audioEl.pause(); this.audioEl.currentTime = 0; }
        this.disconnectMic(); this.source = null;
    }

    freq() { if (!this.analyser) return null; this.analyser.getByteFrequencyData(this.freqData); return this.freqData; }
    time_() { if (!this.analyser) return null; this.analyser.getByteTimeDomainData(this.timeData); return this.timeData; }
    async resume() { if (this.ctx?.state === 'suspended') await this.ctx.resume(); }
}

// ============================================================================
// BEAT DETECTOR
// ============================================================================
class BeatDetector {
    constructor() {
        this.history = []; this.histSize = 50;
        this.threshold = 1.3; this.lastBeat = 0;
        this.intensity = 0;   // 0..1 decaying
        this.energy = 0;      // current bass energy
        this.isBeat = false;  // true on the frame a beat is detected
    }

    update(freqData, now) {
        if (!freqData) { this.isBeat = false; return false; }
        // Bass energy (first 20%)
        const end = Math.max(4, Math.floor(freqData.length * 0.2));
        let sum = 0;
        for (let i = 0; i < end; i++) { const n = freqData[i] / 255; sum += n * n; }
        this.energy = Math.sqrt(sum / end);

        this.history.push(this.energy);
        if (this.history.length > this.histSize) this.history.shift();

        const short = Math.max(2, Math.floor(this.histSize * 0.1));
        const sAvg = this.history.slice(-short).reduce((a,b)=>a+b,0) / short;
        const lAvg = this.history.reduce((a,b)=>a+b,0) / this.history.length;

        const beat = sAvg > lAvg * this.threshold && now - this.lastBeat > 0.16;
        if (beat) { this.lastBeat = now; this.intensity = 1; }
        this.isBeat = beat;
        return beat;
    }

    decay(dt) { this.intensity = Math.max(0, this.intensity - dt * 5.5); }
    reset() { this.history = []; this.lastBeat = 0; this.intensity = 0; this.isBeat = false; }
}

// ============================================================================
// STARFIELD
// ============================================================================
class Starfield {
    constructor(count = 300) {
        this.stars = [];
        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: Math.random(), y: Math.random(),
                z: Math.random(),
                size: 0.5 + Math.random() * 1.5,
                twinkle: Math.random() * Math.PI * 2,
            });
        }
    }

    draw(ctx, w, h, bassEnergy, bi) {
        const speed = 0.0003 + bassEnergy * 0.002 + bi * 0.004;
        for (const s of this.stars) {
            s.twinkle += 0.02 + bassEnergy * 0.05;
            s.y -= speed * (0.5 + s.z);
            if (s.y < -0.02) { s.y = 1.02; s.x = Math.random(); }

            const alpha = (0.15 + s.z * 0.5) * (0.6 + 0.4 * Math.sin(s.twinkle));
            const sz = s.size * (1 + bi * 0.8);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x * w, s.y * h, sz, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

// ============================================================================
// SMART PARTICLE SYSTEM — Cursor orbit, beat scatter, mesh, shape formation
// ============================================================================
class SmartParticles {
    constructor(max = 500) {
        this.p = [];
        this.max = max;
        // Cursor tracking
        this.cursorX = -1;
        this.cursorY = -1;
        this.cursorActive = false;
        // Behavior flags
        this.meshEnabled = false;
        this.orbitEnabled = true;
        this.shapeMode = 'none'; // 'none' | 'circle' | 'spiral' | 'heart'
        this.meshDist = 100;
        this.shapeTargets = [];
    }

    setCursor(x, y, active) {
        this.cursorX = x; this.cursorY = y; this.cursorActive = active;
    }

    _generateShapeTargets(w, h, count) {
        const targets = [];
        const cx = w / 2, cy = h / 2;
        const r = Math.min(w, h) * 0.25;
        switch (this.shapeMode) {
            case 'circle':
                for (let i = 0; i < count; i++) {
                    const a = (i / count) * Math.PI * 2;
                    targets.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
                }
                break;
            case 'spiral':
                for (let i = 0; i < count; i++) {
                    const t = i / count;
                    const a = t * Math.PI * 6;
                    const sr = t * r;
                    targets.push({ x: cx + Math.cos(a) * sr, y: cy + Math.sin(a) * sr });
                }
                break;
            case 'heart':
                for (let i = 0; i < count; i++) {
                    const t = (i / count) * Math.PI * 2;
                    const scale = r * 0.06;
                    const hx = 16 * Math.pow(Math.sin(t), 3);
                    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
                    targets.push({ x: cx + hx * scale, y: cy + hy * scale });
                }
                break;
        }
        return targets;
    }

    burst(x, y, count, palette, energy) {
        for (let i = 0; i < count && this.p.length < this.max; i++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 60 + Math.random() * 280 * energy;
            this.p.push({
                x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 80*energy,
                life: 1, decay: 0.4 + Math.random() * 0.7,
                size: 1.5 + Math.random() * 3.5,
                color: palette[Math.floor(Math.random()*palette.length)],
            });
        }
    }

    beatScatter(cx, cy, force) {
        for (const p of this.p) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
        }
    }

    ambient(w, h, energy, palette) {
        if (energy < 0.1 || this.p.length >= this.max) return;
        const n = Math.floor(energy * 4);
        for (let i = 0; i < n && this.p.length < this.max; i++) {
            this.p.push({
                x: Math.random()*w, y: h + 4,
                vx: (Math.random()-0.5)*25,
                vy: -(30 + Math.random()*100*energy),
                life: 1, decay: 0.25 + Math.random()*0.35,
                size: 0.8 + Math.random()*2,
                color: palette[Math.floor(Math.random()*palette.length)],
            });
        }
    }

    update(dt, w, h) {
        if (this.shapeMode !== 'none' && this.p.length > 0) {
            this.shapeTargets = this._generateShapeTargets(w, h, this.p.length);
        }
        for (let i = this.p.length - 1; i >= 0; i--) {
            const p = this.p[i];
            // Cursor orbit
            if (this.orbitEnabled && this.cursorActive && this.cursorX > 0) {
                const dx = this.cursorX - p.x;
                const dy = this.cursorY - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 200 && dist > 5) {
                    const force = 150 / (dist + 20);
                    const nx = dx / dist, ny = dy / dist;
                    p.vx += (-ny * force + nx * force * 0.3) * dt;
                    p.vy += (nx * force + ny * force * 0.3) * dt;
                }
            }
            // Shape formation
            if (this.shapeMode !== 'none' && this.shapeTargets[i]) {
                const target = this.shapeTargets[i];
                p.vx += (target.x - p.x) * 2 * dt;
                p.vy += (target.y - p.y) * 2 * dt;
                p.vx *= 0.98; p.vy *= 0.98;
            }
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.vy += 50 * dt; p.vx *= 0.995;
            p.life -= p.decay * dt;
            if (p.life <= 0) this.p.splice(i, 1);
        }
    }

    draw(ctx, w, h) {
        // Draw mesh connections
        if (this.meshEnabled && this.p.length > 1) {
            const dist2 = this.meshDist * this.meshDist;
            const len = Math.min(this.p.length, 150);
            for (let i = 0; i < len; i++) {
                for (let j = i + 1; j < len; j++) {
                    const a = this.p[i], b = this.p[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < dist2) {
                        const d = Math.sqrt(d2);
                        const alpha = (1 - d / this.meshDist) * 0.25 * Math.min(a.life, b.life);
                        const ca = parseColor(a.color);
                        ctx.strokeStyle = rgba(ca, alpha);
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }
        }
        // Draw particles
        for (const p of this.p) {
            const c = parseColor(p.color);
            ctx.globalAlpha = Math.max(0, p.life * p.life);
            ctx.fillStyle = rgb(c);
            ctx.shadowBlur = 6; ctx.shadowColor = rgb(c);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
}

// ============================================================================
// RENDERER
// ============================================================================
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.palette = COLOR_PRESETS.aurora;
        this.paletteName = 'aurora';
        this.mode = 'spectrum';
        this.sensitivity = 1.8;
        this.particles = new SmartParticles();
        this.starfield = new Starfield();
        this.peaks = []; // peak dots per bar
        this.smoothBars = []; // smoothed bar heights
        this.waveHistory = []; // for wave mode trail
        this.time = 0; // accumulated time for animations
        this.lastT = performance.now();

        // New v4 systems
        this.worldManager = new WorldManager();
        this.camera = new CameraSystem();
        this.postfx = new PostFXPipeline();
        this.dynamicColor = new DynamicColorEngine();
        this.magicMoments = new MagicMomentsSystem();
        this.composer = new Composer();

        // Freeze / slow-mo state
        this.frozen = false;
        this.slowMotion = false;
        this.timeScale = 1;
        this.frozenImageData = null;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Track cursor for smart particles
        window.addEventListener('mousemove', (e) => {
            this.particles.setCursor(e.clientX, e.clientY, true);
        });
        window.addEventListener('mouseleave', () => {
            this.particles.setCursor(-1, -1, false);
        });
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.worldManager.regenerate(this.w, this.h);
    }

    setMode(m) { this.mode = m; }
    setPalette(name) {
        this.paletteName = name;
        if (name === 'auto') {
            this.dynamicColor.enabled = true;
        } else {
            this.dynamicColor.enabled = false;
            this.palette = COLOR_PRESETS[name] || COLOR_PRESETS.aurora;
        }
    }

    col(t) { return rgb(lerpColor(this.palette, t)); }
    colObj(t) { return lerpColor(this.palette, t); }

    // ── Spectrum Bars ──────────────────────────────────────────────────
    drawSpectrum(freq, bi, dt, ctx) {
        if (!freq) return;
        ctx = ctx || this.ctx;
        const { w, h } = this;
        const count = Math.min(128, freq.length);
        const gap = 2;
        const bw = (w - gap * count) / count;
        const baseY = h * 0.78;

        while (this.peaks.length < count) this.peaks.push({ h: 0, v: 0 });
        while (this.smoothBars.length < count) this.smoothBars.push(0);

        const boost = 1 + bi * 0.4;

        for (let i = 0; i < count; i++) {
            const raw = freq[i] / 255;
            const wt = i < count*0.2 ? 1.5 : i < count*0.5 ? 1.15 : 0.85;
            const target = Math.pow(raw * wt, 1.5) * this.sensitivity * boost;
            // Smooth bars for fluid motion
            this.smoothBars[i] += (target - this.smoothBars[i]) * Math.min(1, dt * 18);
            const bh = Math.min(this.smoothBars[i] * baseY, baseY - 2);
            const x = i * (bw + gap);
            const t = i / count;
            const c = this.colObj(t);

            // Bar gradient
            const grad = ctx.createLinearGradient(x, baseY, x, baseY - bh);
            grad.addColorStop(0, rgba(c, 0.9));
            grad.addColorStop(1, rgba(c, 0.4));
            ctx.fillStyle = grad;

            // Rounded top
            const r = Math.min(bw / 2, 4);
            if (bh > r) {
                ctx.beginPath();
                ctx.moveTo(x, baseY);
                ctx.lineTo(x, baseY - bh + r);
                ctx.quadraticCurveTo(x, baseY - bh, x + r, baseY - bh);
                ctx.lineTo(x + bw - r, baseY - bh);
                ctx.quadraticCurveTo(x + bw, baseY - bh, x + bw, baseY - bh + r);
                ctx.lineTo(x + bw, baseY);
                ctx.fill();
            } else if (bh > 0) {
                ctx.fillRect(x, baseY - bh, bw, bh);
            }

            // Glow on beat
            if (bi > 0.2) {
                ctx.shadowBlur = 10 * bi;
                ctx.shadowColor = rgb(c);
                ctx.fillRect(x, baseY - bh, bw, 2);
                ctx.shadowBlur = 0;
            }

            // Reflection
            ctx.globalAlpha = 0.08 + bi * 0.04;
            const rGrad = ctx.createLinearGradient(x, baseY, x, baseY + bh * 0.35);
            rGrad.addColorStop(0, rgba(c, 0.3));
            rGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = rGrad;
            ctx.fillRect(x, baseY + 1, bw, bh * 0.35);
            ctx.globalAlpha = 1;

            // Peak dot
            const pk = this.peaks[i];
            if (bh > pk.h) { pk.h = bh; pk.v = 0; }
            else { pk.v += 500 * dt; pk.h -= pk.v * dt; }
            if (pk.h < 0) pk.h = 0;

            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 6; ctx.shadowColor = rgb(c);
            ctx.fillRect(x, baseY - pk.h - 3, bw, 2.5);
            ctx.shadowBlur = 0;
        }
    }

    // ── Radial ─────────────────────────────────────────────────────────
    drawRadial(freq, td, bi, ctx) {
        if (!td) return;
        ctx = ctx || this.ctx;
        const { w, h } = this;
        const cx = w/2, cy = h/2;
        const maxR = Math.min(w, h) * 0.35;
        const boost = 1 + bi * 0.5;

        // Inner glow
        const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.4);
        const ic = this.colObj(0.4);
        ig.addColorStop(0, rgba(ic, 0.06 + bi * 0.06));
        ig.addColorStop(1, 'transparent');
        ctx.fillStyle = ig;
        ctx.fillRect(0, 0, w, h);

        // Frequency ring bars
        if (freq) {
            const bars = Math.min(96, freq.length);
            const barW = (Math.PI * 2) / bars;
            for (let i = 0; i < bars; i++) {
                const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
                const val = Math.pow(freq[i] / 255, 1.6) * this.sensitivity * boost;
                const innerR = maxR * 0.42;
                const outerR = innerR + val * maxR * 0.55;
                const c = this.colObj(i / bars);

                ctx.strokeStyle = rgba(c, 0.6 + bi * 0.3);
                ctx.lineWidth = Math.max(2, (w / bars) * 0.5);
                ctx.shadowBlur = bi > 0.3 ? 8 * bi : 0;
                ctx.shadowColor = rgb(c);
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
                ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
        }

        // Waveform ring
        const samples = Math.min(512, td.length);
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
            const idx = i % samples;
            const angle = (idx / samples) * Math.PI * 2 - Math.PI / 2;
            const val = (td[idx] - 128) / 128;
            const r = maxR * 0.42 + val * maxR * 0.2 * this.sensitivity * boost;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        const sc = this.colObj(0.5 + bi * 0.2);
        ctx.strokeStyle = rgba(sc, 0.8);
        ctx.lineWidth = 1.5 + bi * 2;
        ctx.shadowBlur = 12 + bi * 25; ctx.shadowColor = rgb(sc);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Center circle
        const ccR = maxR * 0.15 + bi * maxR * 0.05;
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, ccR);
        const cc1 = this.colObj(0.3), cc2 = this.colObj(0.7);
        cg.addColorStop(0, rgba(cc1, 0.15 + bi * 0.1));
        cg.addColorStop(1, rgba(cc2, 0));
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(cx, cy, ccR, 0, Math.PI * 2); ctx.fill();
    }

    // ── Wave (terrain waveform) ────────────────────────────────────────
    drawWave(td, freq, bi, ctx) {
        if (!td) return;
        ctx = ctx || this.ctx;
        const { w, h } = this;
        const boost = 1 + bi * 0.3;
        const midY = h * 0.5;

        // Store waveform history for trailing effect
        const pts = [];
        const samples = Math.min(256, td.length);
        for (let i = 0; i < samples; i++) {
            const val = (td[i] - 128) / 128;
            pts.push(val * this.sensitivity * boost);
        }
        this.waveHistory.unshift(pts);
        if (this.waveHistory.length > 12) this.waveHistory.pop();

        // Draw trailing waves (back to front)
        for (let w_i = this.waveHistory.length - 1; w_i >= 0; w_i--) {
            const wave = this.waveHistory[w_i];
            const alpha = (1 - w_i / this.waveHistory.length) * 0.5;
            const yOff = w_i * 6;
            const scale = 1 - w_i * 0.03;
            const c = this.colObj(0.3 + w_i * 0.05);

            ctx.beginPath();
            for (let i = 0; i < wave.length; i++) {
                const x = (i / (wave.length - 1)) * w;
                const y = midY + wave[i] * h * 0.22 * scale + yOff;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.strokeStyle = rgba(c, alpha);
            ctx.lineWidth = w_i === 0 ? 2.5 + bi * 2 : 1;
            if (w_i === 0) { ctx.shadowBlur = 15 + bi * 20; ctx.shadowColor = rgba(c, 0.6); }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Fill under main wave
        if (this.waveHistory[0]) {
            const wave = this.waveHistory[0];
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let i = 0; i < wave.length; i++) {
                const x = (i / (wave.length - 1)) * w;
                const y = midY + wave[i] * h * 0.22;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h); ctx.closePath();
            const fg = ctx.createLinearGradient(0, midY - h*0.2, 0, h);
            const fc = this.colObj(0.5);
            fg.addColorStop(0, rgba(fc, 0.08 + bi * 0.06));
            fg.addColorStop(1, 'transparent');
            ctx.fillStyle = fg; ctx.fill();
        }

        // Frequency overlay as subtle bottom bars
        if (freq) {
            const bars = Math.min(64, freq.length);
            const bw = w / bars;
            for (let i = 0; i < bars; i++) {
                const val = Math.pow(freq[i] / 255, 2) * this.sensitivity * 0.3 * boost;
                const bh = val * h * 0.2;
                const c = this.colObj(i / bars);
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = rgb(c);
                ctx.fillRect(i * bw, h - bh, bw - 1, bh);
            }
            ctx.globalAlpha = 1;
        }
    }

    // ── Galaxy / Starburst ─────────────────────────────────────────────
    drawGalaxy(freq, td, bi, ctx) {
        if (!freq) return;
        ctx = ctx || this.ctx;
        const { w, h } = this;
        const cx = w/2, cy = h/2;
        const maxR = Math.min(w, h) * 0.42;
        const boost = 1 + bi * 0.5;

        // Rotating spiral arms from frequency data
        const arms = 3;
        const binsPerArm = Math.min(48, Math.floor(freq.length / arms));

        for (let arm = 0; arm < arms; arm++) {
            const armOffset = (arm / arms) * Math.PI * 2;
            ctx.beginPath();
            for (let i = 0; i < binsPerArm; i++) {
                const fi = arm * binsPerArm + i;
                const val = Math.pow(freq[fi] / 255, 1.5) * this.sensitivity * boost;
                const progress = i / binsPerArm;
                const spiralAngle = armOffset + progress * Math.PI * 3 + this.time * 0.3;
                const r = maxR * 0.08 + progress * maxR * 0.85;
                const wobble = val * maxR * 0.15;

                const x = cx + Math.cos(spiralAngle) * (r + wobble);
                const y = cy + Math.sin(spiralAngle) * (r + wobble);

                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            const c = this.colObj(arm / arms + this.time * 0.05 % 1);
            ctx.strokeStyle = rgba(c, 0.5 + bi * 0.3);
            ctx.lineWidth = 2 + bi * 2;
            ctx.shadowBlur = 15 + bi * 20; ctx.shadowColor = rgb(c);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Frequency dots orbiting
        const dots = Math.min(96, freq.length);
        for (let i = 0; i < dots; i++) {
            const val = Math.pow(freq[i] / 255, 1.8) * this.sensitivity * boost;
            if (val < 0.05) continue;
            const angle = (i / dots) * Math.PI * 2 + this.time * 0.15 * (1 + i % 3 * 0.3);
            const r = maxR * 0.15 + (i / dots) * maxR * 0.75;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            const c = this.colObj(i / dots);

            ctx.globalAlpha = val * 0.8;
            ctx.fillStyle = rgb(c);
            ctx.shadowBlur = 4 + val * 8; ctx.shadowColor = rgb(c);
            ctx.beginPath();
            ctx.arc(x, y, 1.5 + val * 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;

        // Central orb
        const orbR = maxR * 0.06 + bi * maxR * 0.04;
        const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR * 3);
        const oc = this.colObj(0.5 + this.time * 0.1 % 1);
        og.addColorStop(0, rgba(oc, 0.3 + bi * 0.2));
        og.addColorStop(0.4, rgba(oc, 0.05));
        og.addColorStop(1, 'transparent');
        ctx.fillStyle = og;
        ctx.fillRect(cx - orbR*3, cy - orbR*3, orbR*6, orbR*6);

        ctx.fillStyle = rgba(oc, 0.7 + bi * 0.3);
        ctx.shadowBlur = 20 + bi * 30; ctx.shadowColor = rgb(oc);
        ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }

    // ── Hybrid ─────────────────────────────────────────────────────────
    drawHybrid(freq, td, bi, dt, ctx) {
        if (!freq || !td) return;
        ctx = ctx || this.ctx;
        const { w, h } = this;
        const boost = 1 + bi * 0.4;

        // Bottom bars (compact)
        const count = Math.min(80, freq.length);
        const gap = 1.5;
        const bw = (w - gap * count) / count;
        const baseY = h * 0.88;
        for (let i = 0; i < count; i++) {
            const raw = freq[i] / 255;
            const wt = i < count*0.2 ? 1.4 : 1.0;
            const val = Math.pow(raw * wt, 1.5) * this.sensitivity * 0.5 * boost;
            const bh = Math.min(val * h * 0.35, h * 0.35);
            const x = i * (bw + gap);
            const c = this.colObj(i / count);
            ctx.fillStyle = rgba(c, 0.7 + bi * 0.2);
            ctx.fillRect(x, baseY - bh, bw, bh);
        }

        // Centered radial (compact)
        const cx = w/2, cy = h * 0.38;
        const maxR = Math.min(w, h) * 0.2;
        const samples = Math.min(256, td.length);

        // Ring bars
        const ringBars = Math.min(64, freq.length);
        for (let i = 0; i < ringBars; i++) {
            const angle = (i / ringBars) * Math.PI * 2 - Math.PI/2;
            const val = Math.pow(freq[i] / 255, 1.5) * this.sensitivity * 0.8 * boost;
            const iR = maxR * 0.5;
            const oR = iR + val * maxR * 0.5;
            const c = this.colObj(i / ringBars);
            ctx.strokeStyle = rgba(c, 0.5);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle)*iR, cy + Math.sin(angle)*iR);
            ctx.lineTo(cx + Math.cos(angle)*oR, cy + Math.sin(angle)*oR);
            ctx.stroke();
        }

        // Waveform ring
        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
            const idx = i % samples;
            const angle = (idx / samples) * Math.PI * 2 - Math.PI/2;
            const val = (td[idx] - 128) / 128;
            const r = maxR * 0.5 + val * maxR * 0.18 * this.sensitivity * boost;
            const x = cx + Math.cos(angle)*r;
            const y = cy + Math.sin(angle)*r;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        const sc = this.colObj(0.5);
        ctx.strokeStyle = rgba(sc, 0.7);
        ctx.lineWidth = 1.5 + bi * 1.5;
        ctx.shadowBlur = 10 + bi * 15; ctx.shadowColor = rgb(sc);
        ctx.stroke(); ctx.shadowBlur = 0;
    }

    // ── Draw a mode to a given context (for composer blending) ───────
    drawModeToCtx(ctx, modeName, freq, td, bi, dt) {
        switch (modeName) {
            case 'spectrum': this.drawSpectrum(freq, bi, dt, ctx); break;
            case 'radial':   this.drawRadial(freq, td, bi, ctx); break;
            case 'wave':     this.drawWave(td, freq, bi, ctx); break;
            case 'galaxy':   this.drawGalaxy(freq, td, bi, ctx); break;
            case 'hybrid':   this.drawHybrid(freq, td, bi, dt, ctx); break;
        }
    }

    // ── Main Render ────────────────────────────────────────────────────
    render(freq, td, beat) {
        const now = performance.now();
        const rawDt = Math.min(0.05, (now - this.lastT) / 1000);
        this.lastT = now;

        // Freeze frame: redraw frozen image
        if (this.frozen) {
            if (this.frozenImageData) {
                this.ctx.putImageData(this.frozenImageData, 0, 0);
            }
            return;
        }

        // Apply time scale (slow motion)
        const dt = rawDt * this.timeScale;
        this.time += dt;
        const { w, h } = this;
        const bi = beat.intensity;
        const isBeat = beat.isBeat;

        // Compute bass & overall energy
        let bass = 0;
        let overallEnergy = 0;
        if (freq) {
            const end = Math.max(4, Math.floor(freq.length * 0.12));
            let s = 0; for (let i = 0; i < end; i++) s += freq[i] / 255;
            bass = s / end;
            let totalS = 0;
            for (let i = 0; i < freq.length; i++) totalS += freq[i] / 255;
            overallEnergy = totalS / freq.length;
        }

        // Dynamic color update
        if (this.dynamicColor.enabled) {
            const dynPalette = this.dynamicColor.update(freq, bi, bass, overallEnergy, dt);
            if (dynPalette) this.palette = dynPalette;
        }

        // Camera update
        this.camera.update(dt, this.mode, bi, bass, isBeat);

        // Magic moments update
        this.magicMoments.update(overallEnergy, bi, bass, isBeat, dt, now / 1000);

        // Determine render target (offscreen for post-fx, or direct canvas)
        let renderCtx = this.ctx;
        const postfxActive = this.postfx.isActive();
        if (postfxActive) {
            const offCtx = this.postfx.beginCapture(this.canvas);
            if (offCtx) renderCtx = offCtx;
        }

        // Clear
        renderCtx.clearRect(0, 0, w, h);

        // Dynamic background gradient
        const bg1 = Math.floor(5 + bi * 15 + bass * 8);
        const bg2 = Math.floor(5 + bi * 10 + bass * 5);
        const bg3 = Math.floor(12 + bi * 30 + bass * 15);
        const bgGrad = renderCtx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.7);
        bgGrad.addColorStop(0, `rgb(${bg1},${bg2},${bg3})`);
        bgGrad.addColorStop(1, `rgb(${Math.floor(bg1*0.3)},${Math.floor(bg2*0.3)},${Math.floor(bg3*0.4)})`);
        renderCtx.fillStyle = bgGrad;
        renderCtx.fillRect(0, 0, w, h);

        // Beat flash
        if (bi > 0.05) {
            renderCtx.fillStyle = `rgba(255,255,255,${bi * 0.06})`;
            renderCtx.fillRect(0, 0, w, h);
        }

        // Reactive Worlds (drawn behind visualization)
        const audioState = {
            bass, energy: overallEnergy, beatIntensity: bi,
            palette: this.palette, dt, freqData: freq, timeData: td
        };
        this.worldManager.draw(renderCtx, w, h, audioState);

        // Starfield
        this.starfield.draw(renderCtx, w, h, bass, bi);

        // Apply camera transforms
        this.camera.apply(renderCtx, w, h);

        // Visualization (composer blending or single mode)
        const composerRendered = this.composer.enabled && this.composer.render(
            renderCtx, w, h,
            (ctx, mode) => this.drawModeToCtx(ctx, mode, freq, td, bi, dt)
        );

        if (!composerRendered) {
            switch (this.mode) {
                case 'spectrum': this.drawSpectrum(freq, bi, dt, renderCtx); break;
                case 'radial':   this.drawRadial(freq, td, bi, renderCtx); break;
                case 'wave':     this.drawWave(td, freq, bi, renderCtx); break;
                case 'galaxy':   this.drawGalaxy(freq, td, bi, renderCtx); break;
                case 'hybrid':   this.drawHybrid(freq, td, bi, dt, renderCtx); break;
            }
        }

        // Restore camera transforms
        this.camera.restore(renderCtx);

        // Particles
        if (isBeat && bi > 0.85) {
            const bx = w / 2;
            const by = (this.mode === 'radial' || this.mode === 'galaxy') ? h / 2 : h * 0.75;
            this.particles.burst(bx, by, 12 + Math.floor(bass * 25), this.palette, bass + bi);
            this.particles.beatScatter(w / 2, h / 2, 200 * bi);
        }
        this.particles.ambient(w, h, bass, this.palette);
        this.particles.update(dt, w, h);
        this.particles.draw(renderCtx, w, h);

        // Magic moments overlay
        this.magicMoments.draw(renderCtx, w, h);

        // Camera DOF effect
        this.camera.applyDOF(renderCtx, w, h);

        // Vignette
        const vg = renderCtx.createRadialGradient(w/2, h/2, w * 0.25, w/2, h/2, w * 0.75);
        vg.addColorStop(0, 'transparent');
        vg.addColorStop(1, 'rgba(0,0,0,0.4)');
        renderCtx.fillStyle = vg;
        renderCtx.fillRect(0, 0, w, h);

        // Apply post-fx (kaleidoscope/mirror)
        if (postfxActive) {
            this.postfx.endCapture(this.ctx, w, h);
        }
    }

    /** Capture current frame for freeze. */
    freezeFrame() {
        this.frozen = true;
        const dpr = window.devicePixelRatio || 1;
        this.frozenImageData = this.ctx.getImageData(0, 0, this.w * dpr, this.h * dpr);
    }

    unfreezeFrame() {
        this.frozen = false;
        this.frozenImageData = null;
    }

    toggleSlowMotion() {
        this.slowMotion = !this.slowMotion;
        this.timeScale = this.slowMotion ? 0.25 : 1;
    }
}

// ============================================================================
// APP
// ============================================================================
class App {
    constructor() {
        this.audio = new AudioManager();
        this.beat = new BeatDetector();
        this.renderer = new Renderer(document.getElementById('visualizer-canvas'));
        this.trackName = '';

        this.el = {
            canvas:       document.getElementById('visualizer-canvas'),
            welcome:      document.getElementById('welcome-overlay'),
            dropOverlay:  document.getElementById('drop-overlay'),
            fileInput:    document.getElementById('file-input'),
            fileInput2:   document.getElementById('file-input-2'),
            ctrlToggle:   document.getElementById('controls-toggle'),
            ctrlPanel:    document.getElementById('controls-panel'),
            playerBar:    document.getElementById('player-bar'),
            playPause:    document.getElementById('player-play-pause'),
            iconPlay:     document.getElementById('icon-play'),
            iconPause:    document.getElementById('icon-pause'),
            track:        document.getElementById('player-track'),
            seekInput:    document.getElementById('player-seek'),
            seekProgress: document.getElementById('seek-progress'),
            timeCur:      document.getElementById('player-time-current'),
            timeDur:      document.getElementById('player-time-duration'),
            volIcon:      document.getElementById('player-volume-icon'),
            volRange:     document.getElementById('player-volume'),
            sensitivity:  document.getElementById('sensitivity'),
            beatThreshold:document.getElementById('beat-threshold'),
            micToggle:    document.getElementById('mic-toggle'),
            statusBadge:  document.getElementById('status-badge'),
        };

        this.bind();
    }

    bind() {
        // File inputs
        this.el.fileInput.addEventListener('change', e => this.loadFile(e.target.files[0]));
        this.el.fileInput2.addEventListener('change', e => this.loadFile(e.target.files[0]));

        // Drag & drop
        document.addEventListener('dragover', e => { e.preventDefault(); this.el.dropOverlay.classList.remove('hidden'); });
        document.addEventListener('dragleave', e => {
            if (e.relatedTarget === null) this.el.dropOverlay.classList.add('hidden');
        });
        document.addEventListener('drop', e => {
            e.preventDefault(); this.el.dropOverlay.classList.add('hidden');
            const f = e.dataTransfer.files[0];
            if (f && f.type.startsWith('audio')) this.loadFile(f);
        });

        // Controls panel toggle
        this.el.ctrlToggle.addEventListener('click', () => {
            this.el.ctrlPanel.classList.toggle('hidden');
        });

        // Mode pills
        document.querySelectorAll('.pill[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pill[data-mode]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderer.setMode(btn.dataset.mode);
            });
        });

        // Color swatches
        document.querySelectorAll('.swatch[data-palette]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.swatch').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderer.setPalette(btn.dataset.palette);
            });
        });

        // World pills
        document.querySelectorAll('.pill[data-world]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pill[data-world]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const world = btn.dataset.world;
                this.renderer.worldManager.setWorld(world === 'none' ? null : world);
            });
        });

        // Effect pills (kaleidoscope/mirror)
        document.querySelectorAll('.pill[data-effect]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pill[data-effect]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderer.postfx.setEffect(btn.dataset.effect);
            });
        });

        // Particle behavior pills
        document.querySelectorAll('.pill[data-particle]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pill[data-particle]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.dataset.particle;
                const p = this.renderer.particles;
                p.meshEnabled = false;
                p.shapeMode = 'none';
                p.orbitEnabled = true;
                switch (mode) {
                    case 'orbit': p.orbitEnabled = true; break;
                    case 'mesh': p.meshEnabled = true; break;
                    case 'circle': p.shapeMode = 'circle'; break;
                    case 'spiral': p.shapeMode = 'spiral'; break;
                    case 'heart': p.shapeMode = 'heart'; break;
                }
            });
        });

        // Camera toggle
        const camToggle = document.getElementById('camera-toggle');
        if (camToggle) {
            camToggle.addEventListener('click', () => {
                this.renderer.camera.enabled = !this.renderer.camera.enabled;
                camToggle.classList.toggle('active', this.renderer.camera.enabled);
            });
        }

        // Composer toggle and sliders
        const composerToggle = document.getElementById('composer-toggle');
        if (composerToggle) {
            composerToggle.addEventListener('click', () => {
                this.renderer.composer.enabled = !this.renderer.composer.enabled;
                composerToggle.classList.toggle('active', this.renderer.composer.enabled);
                const composerSliders = document.getElementById('composer-sliders');
                if (composerSliders) composerSliders.classList.toggle('hidden', !this.renderer.composer.enabled);
            });
        }
        document.querySelectorAll('.composer-weight').forEach(slider => {
            slider.addEventListener('input', () => {
                this.renderer.composer.setWeight(slider.dataset.mode, parseFloat(slider.value));
            });
        });

        // Sliders
        this.el.sensitivity.addEventListener('input', e => {
            this.renderer.sensitivity = parseFloat(e.target.value);
        });
        this.el.beatThreshold.addEventListener('input', e => {
            this.beat.threshold = Math.max(1, Math.min(3, parseFloat(e.target.value)));
        });

        // Player
        this.el.playPause.addEventListener('click', () => this.togglePlay());
        this.el.seekInput.addEventListener('input', () => {
            if (this.audio.duration) {
                this.audio.time = (this.el.seekInput.value / 1000) * this.audio.duration;
            }
        });
        this.el.volRange.addEventListener('input', () => {
            this.audio.vol = parseFloat(this.el.volRange.value);
            this.updateVolIcon();
        });
        this.el.volIcon.addEventListener('click', () => {
            if (this.audio.vol > 0) { this._pv = this.audio.vol; this.audio.vol = 0; this.el.volRange.value = 0; }
            else { this.audio.vol = this._pv || 1; this.el.volRange.value = this.audio.vol; }
            this.updateVolIcon();
        });

        // Mic
        this.el.micToggle.addEventListener('click', () => this.toggleMic());

        // Keyboard
        document.addEventListener('keydown', e => this.key(e));

        // Close panel on outside click
        document.addEventListener('click', e => {
            if (!this.el.ctrlPanel.classList.contains('hidden') &&
                !this.el.ctrlPanel.contains(e.target) &&
                !this.el.ctrlToggle.contains(e.target)) {
                this.el.ctrlPanel.classList.add('hidden');
            }
        });
    }

    async loadFile(file) {
        if (!file) return;
        await this.audio.resume();
        this.audio.loadFile(file);
        this.trackName = file.name.replace(/\.[^.]+$/, '');
        this.el.track.textContent = this.trackName;

        // Hide welcome, show player
        this.el.welcome.classList.add('hidden');
        this.el.playerBar.classList.remove('hidden');

        const ae = this.audio.audioEl;
        ae.onloadedmetadata = () => {
            this.el.seekInput.value = 0;
            this.el.seekProgress.style.width = '0%';
            this.el.timeDur.textContent = this.fmt(ae.duration);
        };
        ae.onended = () => this.updatePlayBtn();

        await ae.play().catch(() => {});
        this.updatePlayBtn();
        this.beat.reset();
        this.renderer.magicMoments.reset();
    }

    async togglePlay() {
        if (!this.audio.audioEl) return;
        await this.audio.resume();
        if (this.audio.paused) await this.audio.play().catch(() => {});
        else this.audio.pause();
        this.updatePlayBtn();
    }

    async toggleMic() {
        try {
            await this.audio.resume();
            if (this.audio.source === 'mic') {
                this.audio.disconnectMic();
                this.el.micToggle.classList.remove('active');
            } else {
                await this.audio.enableMic();
                this.el.micToggle.classList.add('active');
                this.el.welcome.classList.add('hidden');
                this.el.playerBar.classList.remove('hidden');
                this.el.track.textContent = '🎤 Microphone Input';
            }
            this.beat.reset();
        } catch (err) {
            if (err.message === 'NOT_SUPPORTED') {
                alert('Microphone requires HTTPS. The mic will work once this is deployed as a website (or use localhost).');
            } else if (err.message === 'DENIED') {
                alert('Microphone access was blocked. Click the lock/camera icon in your address bar to allow microphone access, then try again.');
            } else {
                alert('Could not access microphone: ' + err.message);
            }
        }
    }

    key(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        const modes = VISUAL_MODES;
        switch (e.code) {
            case 'Space': e.preventDefault(); this.togglePlay(); break;
            case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': {
                const i = parseInt(e.code.slice(-1)) - 1;
                if (modes[i]) {
                    this.renderer.setMode(modes[i]);
                    document.querySelectorAll('.pill[data-mode]').forEach(b => b.classList.remove('active'));
                    document.querySelector(`.pill[data-mode="${modes[i]}"]`)?.classList.add('active');
                }
                break;
            }
            case 'ArrowLeft':  if (this.audio.audioEl) this.audio.time = Math.max(0, this.audio.time - 5); break;
            case 'ArrowRight': if (this.audio.audioEl) this.audio.time = Math.min(this.audio.duration, this.audio.time + 5); break;
            case 'KeyF': this.toggleFullscreen(); break;
            case 'KeyS':
                if (e.shiftKey) {
                    this.renderer.toggleSlowMotion();
                    this._updateStatusBadge();
                } else {
                    if (this.renderer.frozen) this.renderer.unfreezeFrame();
                    else this.renderer.freezeFrame();
                    this._updateStatusBadge();
                }
                break;
            case 'Escape':
                if (document.fullscreenElement) document.exitFullscreen();
                else { this.audio.stop(); this.el.micToggle.classList.remove('active'); this.updatePlayBtn(); }
                break;
        }
    }

    _updateStatusBadge() {
        const badge = this.el.statusBadge;
        if (!badge) return;
        if (this.renderer.frozen) {
            badge.textContent = '⏸ FROZEN';
            badge.classList.remove('hidden', 'slowmo');
            badge.classList.add('frozen');
        } else if (this.renderer.slowMotion) {
            badge.textContent = '🐢 SLOW-MO';
            badge.classList.remove('hidden', 'frozen');
            badge.classList.add('slowmo');
        } else {
            badge.classList.add('hidden');
            badge.classList.remove('frozen', 'slowmo');
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    }

    updatePlayBtn() {
        const paused = this.audio.paused;
        this.el.iconPlay.classList.toggle('hidden', !paused);
        this.el.iconPause.classList.toggle('hidden', paused);
    }

    updateVolIcon() {
        const v = this.audio.vol;
        const svg = this.el.volIcon.querySelector('svg');
        // Simple approach: change opacity on mute
        svg.style.opacity = v === 0 ? '0.3' : '1';
    }

    fmt(s) {
        if (!isFinite(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    // ── Loop ───────────────────────────────────────────────────────────
    loop = () => {
        const freq = this.audio.freq();
        const td = this.audio.time_();

        if (freq) this.beat.update(freq, performance.now() / 1000);
        this.beat.decay(1 / 60);

        this.renderer.render(freq, td, this.beat);

        // Sync player bar
        if (this.audio.duration && this.audio.source === 'file') {
            const pct = this.audio.time / this.audio.duration;
            this.el.seekInput.value = pct * 1000;
            this.el.seekProgress.style.width = (pct * 100) + '%';
            this.el.timeCur.textContent = this.fmt(this.audio.time);
        }

        requestAnimationFrame(this.loop);
    };

    start() {
        console.log('Music Visualizer v4 — Ultimate Edition');
        this.loop();
    }
}

// ============================================================================
// INIT
// ============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App().start());
} else {
    new App().start();
}
