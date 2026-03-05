/**
 * Cinematic Camera System — Subtle camera motion on the canvas.
 *
 * - Slow orbital rotation for radial modes
 * - Zoom pulses on strong beats
 * - Screen shake on heavy bass drops
 * - Depth-of-field blur that increases with intensity
 *
 * All transforms applied via ctx.save/restore in the render pipeline.
 */

export class CameraSystem {
    constructor() {
        this.enabled = false;

        // Orbital rotation
        this.rotation = 0;         // current rotation in radians
        this.rotationSpeed = 0.08; // radians per second (very slow)

        // Zoom
        this.zoom = 1;
        this.targetZoom = 1;
        this.baseZoom = 1;

        // Shake
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeIntensity = 0;

        // DOF blur
        this.dofBlur = 0;
        this.targetDof = 0;

        // Smooth tracking
        this.smoothRotation = 0;
    }

    /**
     * Update camera state each frame.
     * @param {number} dt - delta time in seconds
     * @param {string} mode - current visual mode
     * @param {number} beatIntensity - 0..1 beat intensity
     * @param {number} bass - 0..1 bass energy
     * @param {boolean} isBeat - true on beat frames
     */
    update(dt, mode, beatIntensity, bass, isBeat) {
        if (!this.enabled) {
            // Smoothly return to defaults
            this.rotation *= 0.95;
            this.zoom += (1 - this.zoom) * 0.1;
            this.shakeX *= 0.9;
            this.shakeY *= 0.9;
            this.dofBlur *= 0.9;
            return;
        }

        // Orbital rotation (mainly for radial/galaxy modes)
        const rotModes = { radial: 1, galaxy: 1, hybrid: 0.5 };
        const rotFactor = rotModes[mode] || 0.15;
        this.rotation += this.rotationSpeed * rotFactor * dt;
        // Keep within bounds
        if (this.rotation > Math.PI * 2) this.rotation -= Math.PI * 2;

        // Zoom pulse on beat
        if (isBeat && beatIntensity > 0.5) {
            this.targetZoom = this.baseZoom + beatIntensity * 0.06;
        }
        this.zoom += (this.targetZoom - this.zoom) * dt * 8;
        this.targetZoom += (this.baseZoom - this.targetZoom) * dt * 4;

        // Screen shake on heavy bass
        if (isBeat && bass > 0.5) {
            this.shakeIntensity = bass * 6;
        }
        if (this.shakeIntensity > 0.1) {
            this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= Math.pow(0.05, dt); // exponential decay
        } else {
            this.shakeX *= 0.9;
            this.shakeY *= 0.9;
            this.shakeIntensity = 0;
        }

        // DOF blur increases with intensity
        this.targetDof = beatIntensity * 1.5 + bass * 0.5;
        this.dofBlur += (this.targetDof - this.dofBlur) * dt * 3;
    }

    /**
     * Apply camera transforms to canvas context.
     * Call before drawing; call restore() after.
     */
    apply(ctx, w, h) {
        ctx.save();

        const cx = w / 2;
        const cy = h / 2;

        // Apply shake offset
        ctx.translate(this.shakeX, this.shakeY);

        // Apply rotation around center
        if (Math.abs(this.rotation) > 0.001) {
            ctx.translate(cx, cy);
            ctx.rotate(this.rotation);
            ctx.translate(-cx, -cy);
        }

        // Apply zoom around center
        if (Math.abs(this.zoom - 1) > 0.001) {
            ctx.translate(cx, cy);
            ctx.scale(this.zoom, this.zoom);
            ctx.translate(-cx, -cy);
        }
    }

    /**
     * Restore canvas context after camera transforms.
     */
    restore(ctx) {
        ctx.restore();
    }

    /**
     * Apply DOF blur effect as a vignette-style edge blur.
     * Uses canvas filter for performance.
     */
    applyDOF(ctx, w, h) {
        if (this.dofBlur < 0.1) return;

        // Edge blur via radial gradient mask + slight blur
        const blurAmount = Math.min(this.dofBlur, 3);
        const edgeAlpha = blurAmount * 0.03;

        // Subtle radial darkening to simulate DOF
        const dg = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.6);
        dg.addColorStop(0, 'transparent');
        dg.addColorStop(1, `rgba(5, 5, 20, ${edgeAlpha})`);
        ctx.fillStyle = dg;
        ctx.fillRect(0, 0, w, h);
    }
}

