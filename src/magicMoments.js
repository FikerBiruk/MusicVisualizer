/**
 * Magic Moments System — Detects special musical events and triggers
 * one-time cinematic animations.
 *
 * - Beat drops → ripple flash across screen
 * - Chorus detection → color bloom
 * - Outro → slow particle fade-out
 * - Silence → ambient floating particles
 *
 * All effects are subtle and cinematic, overlaid on the main visualization.
 */

export class MagicMomentsSystem {
    constructor() {
        // Energy tracking for event detection
        this.energyHistory = [];
        this.historySize = 120; // ~2 seconds at 60fps
        this.longHistory = [];
        this.longHistSize = 600; // ~10 seconds

        // Active effects
        this.effects = [];

        // Cooldowns to prevent spam
        this.lastDrop = 0;
        this.lastBloom = 0;
        this.outroStarted = false;
        this.silenceActive = false;

        // Ambient particles for silence
        this.silenceParticles = [];
    }

    /**
     * Analyze audio state and trigger magic moments.
     */
    update(energy, beatIntensity, bass, isBeat, dt, now) {
        // Track energy
        this.energyHistory.push(energy);
        if (this.energyHistory.length > this.historySize) this.energyHistory.shift();
        this.longHistory.push(energy);
        if (this.longHistory.length > this.longHistSize) this.longHistory.shift();

        const avgShort = this._avg(this.energyHistory.slice(-15));
        const avgMed = this._avg(this.energyHistory);
        const avgLong = this._avg(this.longHistory);

        // === BEAT DROP DETECTION ===
        // A drop = sudden energy spike after a dip (build-up → drop)
        if (this.energyHistory.length > 30 && now - this.lastDrop > 3) {
            const recentPeak = this._avg(this.energyHistory.slice(-5));
            const beforeDip = this._avg(this.energyHistory.slice(-30, -15));
            const dipArea = this._avg(this.energyHistory.slice(-15, -5));

            if (recentPeak > 0.5 && dipArea < beforeDip * 0.6 && recentPeak > dipArea * 2) {
                this.lastDrop = now;
                this._triggerRippleFlash();
            }
        }

        // Also trigger a smaller ripple on very strong beats
        if (isBeat && beatIntensity > 0.9 && bass > 0.7 && now - this.lastDrop > 1.5) {
            this.lastDrop = now;
            this._triggerRippleFlash(0.6);
        }

        // === CHORUS DETECTION ===
        // Sustained high energy = chorus
        if (this.energyHistory.length >= 60 && now - this.lastBloom > 8) {
            const last60 = this.energyHistory.slice(-60);
            const highCount = last60.filter(e => e > avgLong * 1.3).length;
            if (highCount > 45) { // 75% of recent frames are high-energy
                this.lastBloom = now;
                this._triggerColorBloom();
            }
        }

        // === OUTRO DETECTION ===
        // Steadily declining energy over long period
        if (this.longHistory.length >= 300 && !this.outroStarted) {
            const firstHalf = this._avg(this.longHistory.slice(0, 150));
            const secondHalf = this._avg(this.longHistory.slice(-150));
            if (firstHalf > 0.3 && secondHalf < firstHalf * 0.4 && secondHalf < 0.15) {
                this.outroStarted = true;
                this._triggerOutroFade();
            }
        }
        // Reset outro flag when energy comes back
        if (energy > 0.4) this.outroStarted = false;

        // === SILENCE → AMBIENT PARTICLES ===
        this.silenceActive = energy < 0.02 && this.energyHistory.length > 30 &&
            this._avg(this.energyHistory.slice(-30)) < 0.03;
        this._updateSilenceParticles(dt);

        // Update active effects
        for (let i = this.effects.length - 1; i >= 0; i--) {
            this.effects[i].life -= dt;
            if (this.effects[i].life <= 0) this.effects.splice(i, 1);
        }
    }

    /**
     * Draw magic moment effects.
     */
    draw(ctx, w, h) {
        for (const fx of this.effects) {
            const progress = 1 - fx.life / fx.maxLife;

            switch (fx.type) {
                case 'ripple':
                    this._drawRipple(ctx, w, h, fx, progress);
                    break;
                case 'bloom':
                    this._drawBloom(ctx, w, h, fx, progress);
                    break;
                case 'outroFade':
                    this._drawOutroFade(ctx, w, h, fx, progress);
                    break;
            }
        }

        // Silence ambient particles
        if (this.silenceActive) {
            this._drawSilenceParticles(ctx, w, h);
        }
    }

    // ── Effect Triggers ─────────────────────────────────────────────

    _triggerRippleFlash(intensity = 1) {
        this.effects.push({
            type: 'ripple',
            life: 1.2,
            maxLife: 1.2,
            intensity,
            x: 0.3 + Math.random() * 0.4,
            y: 0.3 + Math.random() * 0.4,
        });
    }

    _triggerColorBloom() {
        this.effects.push({
            type: 'bloom',
            life: 2.5,
            maxLife: 2.5,
            hue: Math.random() * 360,
        });
    }

    _triggerOutroFade() {
        this.effects.push({
            type: 'outroFade',
            life: 5,
            maxLife: 5,
        });
    }

    // ── Effect Renderers ────────────────────────────────────────────

    _drawRipple(ctx, w, h, fx, progress) {
        const cx = fx.x * w;
        const cy = fx.y * h;
        const maxR = Math.max(w, h) * 1.2;
        const r = progress * maxR;
        const alpha = (1 - progress) * 0.3 * fx.intensity;
        const ringWidth = 30 + (1 - progress) * 60;

        // Ripple ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = ringWidth * (1 - progress);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Inner flash (only early in the animation)
        if (progress < 0.15) {
            const flashAlpha = (1 - progress / 0.15) * 0.15 * fx.intensity;
            ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
            ctx.fillRect(0, 0, w, h);
        }
    }

    _drawBloom(ctx, w, h, fx, progress) {
        // Color bloom — warm saturated glow that fades in then out
        const fadeIn = Math.min(1, progress * 4);
        const fadeOut = Math.max(0, 1 - (progress - 0.5) * 2);
        const alpha = fadeIn * fadeOut * 0.08;

        const hue = fx.hue;
        const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
        gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, ${alpha})`);
        gradient.addColorStop(0.4, `hsla(${(hue + 30) % 360}, 90%, 50%, ${alpha * 0.6})`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    _drawOutroFade(ctx, w, h, fx, progress) {
        // Gentle fade overlay
        const alpha = progress * 0.15;
        ctx.fillStyle = `rgba(5, 5, 16, ${alpha})`;
        ctx.fillRect(0, 0, w, h);
    }

    // ── Silence Ambient Particles ───────────────────────────────────

    _updateSilenceParticles(dt) {
        // Spawn gentle floating particles during silence
        if (this.silenceActive && this.silenceParticles.length < 30) {
            if (Math.random() < 0.05) {
                this.silenceParticles.push({
                    x: Math.random(),
                    y: 1.1,
                    vx: (Math.random() - 0.5) * 0.02,
                    vy: -(0.01 + Math.random() * 0.03),
                    size: 1 + Math.random() * 3,
                    alpha: 0.1 + Math.random() * 0.3,
                    hue: 200 + Math.random() * 60,
                });
            }
        }

        for (let i = this.silenceParticles.length - 1; i >= 0; i--) {
            const p = this.silenceParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Gentle sine wave motion
            p.x += Math.sin(p.y * 10 + p.hue) * 0.0005;

            if (p.y < -0.05 || !this.silenceActive) {
                p.alpha -= dt * 0.5;
                if (p.alpha <= 0) this.silenceParticles.splice(i, 1);
            }
        }
    }

    _drawSilenceParticles(ctx, w, h) {
        for (const p of this.silenceParticles) {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = `hsl(${p.hue}, 40%, 60%)`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = `hsl(${p.hue}, 50%, 50%)`;
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    // ── Helpers ──────────────────────────────────────────────────────

    _avg(arr) {
        if (!arr.length) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    reset() {
        this.energyHistory = [];
        this.longHistory = [];
        this.effects = [];
        this.silenceParticles = [];
        this.outroStarted = false;
    }
}

