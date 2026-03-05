/**
 * Post-Processing Effects Pipeline — Kaleidoscope & Mirror Effects
 *
 * Uses an offscreen canvas to capture the rendered frame, then applies
 * mirror/kaleidoscope transformations and composites back.
 *
 * Effects: none, hmirror, vmirror, quad (4-way), octo (8-way kaleidoscope)
 */

export class PostFXPipeline {
    constructor() {
        this.effect = 'none'; // 'none' | 'hmirror' | 'vmirror' | 'quad' | 'octo'
        this.offscreen = null;
        this.offCtx = null;
        this.lastW = 0;
        this.lastH = 0;
    }

    setEffect(name) {
        this.effect = name || 'none';
    }

    /**
     * Ensure offscreen canvas matches dimensions.
     */
    _ensureCanvas(w, h) {
        if (this.lastW !== w || this.lastH !== h || !this.offscreen) {
            this.offscreen = document.createElement('canvas');
            this.offscreen.width = w;
            this.offscreen.height = h;
            this.offCtx = this.offscreen.getContext('2d');
            this.lastW = w;
            this.lastH = h;
        }
    }

    /**
     * Check if an effect is active.
     */
    isActive() {
        return this.effect !== 'none';
    }

    /**
     * Begin capture — returns the offscreen context to render into.
     * The main render should draw to this context instead of the real canvas.
     */
    beginCapture(realCanvas) {
        if (!this.isActive()) return null;
        const w = realCanvas.width;
        const h = realCanvas.height;
        this._ensureCanvas(w, h);
        this.offCtx.clearRect(0, 0, w, h);

        // Copy the transform from real canvas
        const dpr = window.devicePixelRatio || 1;
        this.offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return this.offCtx;
    }

    /**
     * End capture — apply the effect and composite onto the real canvas context.
     */
    endCapture(realCtx, w, h) {
        if (!this.isActive() || !this.offscreen) return;

        const src = this.offscreen;
        const dpr = window.devicePixelRatio || 1;
        const pw = src.width;   // pixel dimensions
        const ph = src.height;

        realCtx.save();
        realCtx.setTransform(1, 0, 0, 1, 0, 0); // reset to pixel coords

        switch (this.effect) {
            case 'hmirror':
                this._horizontalMirror(realCtx, src, pw, ph);
                break;
            case 'vmirror':
                this._verticalMirror(realCtx, src, pw, ph);
                break;
            case 'quad':
                this._quadKaleidoscope(realCtx, src, pw, ph);
                break;
            case 'octo':
                this._octoKaleidoscope(realCtx, src, pw, ph);
                break;
        }

        realCtx.restore();
        // Restore the DPR transform for subsequent draws
        realCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /**
     * Horizontal mirror — top half is reflected to bottom.
     */
    _horizontalMirror(ctx, src, w, h) {
        const halfH = Math.floor(h / 2);

        // Draw top half normally
        ctx.drawImage(src, 0, 0, w, halfH, 0, 0, w, halfH);

        // Draw mirrored bottom half
        ctx.save();
        ctx.translate(0, h);
        ctx.scale(1, -1);
        ctx.drawImage(src, 0, 0, w, halfH, 0, 0, w, halfH);
        ctx.restore();
    }

    /**
     * Vertical mirror — left half is reflected to right.
     */
    _verticalMirror(ctx, src, w, h) {
        const halfW = Math.floor(w / 2);

        // Draw left half normally
        ctx.drawImage(src, 0, 0, halfW, h, 0, 0, halfW, h);

        // Draw mirrored right half
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(src, 0, 0, halfW, h, 0, 0, halfW, h);
        ctx.restore();
    }

    /**
     * 4-way kaleidoscope — top-left quadrant reflected across both axes.
     */
    _quadKaleidoscope(ctx, src, w, h) {
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);

        // Top-left (original)
        ctx.drawImage(src, 0, 0, halfW, halfH, 0, 0, halfW, halfH);

        // Top-right (h-flip)
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(src, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
        ctx.restore();

        // Bottom-left (v-flip)
        ctx.save();
        ctx.translate(0, h);
        ctx.scale(1, -1);
        ctx.drawImage(src, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
        ctx.restore();

        // Bottom-right (both flipped)
        ctx.save();
        ctx.translate(w, h);
        ctx.scale(-1, -1);
        ctx.drawImage(src, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
        ctx.restore();
    }

    /**
     * 8-way kaleidoscope — slice a 45° wedge from top-left, rotate/reflect 8 times.
     */
    _octoKaleidoscope(ctx, src, w, h) {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.max(w, h);

        for (let i = 0; i < 8; i++) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate((i * Math.PI) / 4);

            // Alternate between normal and mirrored wedges
            if (i % 2 === 1) {
                ctx.scale(1, -1);
            }

            // Clip to a 45° wedge
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(r, 0);
            ctx.arc(0, 0, r, 0, Math.PI / 4);
            ctx.closePath();
            ctx.clip();

            // Draw the source offset to center
            ctx.drawImage(src, -cx, -cy);
            ctx.restore();
        }
    }
}

