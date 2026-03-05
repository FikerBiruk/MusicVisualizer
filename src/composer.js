/**
 * Visualizer Composer — Blend multiple visualization modes together.
 *
 * Allows layering modes (e.g. Spectrum + Galaxy, Wave + Radial) with
 * adjustable weight sliders for each. Uses offscreen canvases and
 * composite blending for GPU-efficient layering.
 */

export class Composer {
    constructor() {
        this.enabled = false;

        // Mode weights: 0 = off, 1 = full
        this.weights = {
            spectrum: 0,
            radial: 0,
            wave: 0,
            galaxy: 0,
            hybrid: 0,
        };

        // Offscreen canvas for compositing
        this.offscreen = null;
        this.offCtx = null;
        this.lastW = 0;
        this.lastH = 0;
    }

    /**
     * Set weight for a mode.
     */
    setWeight(mode, weight) {
        if (mode in this.weights) {
            this.weights[mode] = Math.max(0, Math.min(1, weight));
        }
    }

    /**
     * Get active modes (weight > 0).
     */
    getActiveModes() {
        return Object.entries(this.weights)
            .filter(([, w]) => w > 0.01)
            .map(([mode, weight]) => ({ mode, weight }));
    }

    /**
     * Ensure offscreen canvas exists.
     */
    _ensureCanvas(w, h) {
        const dpr = window.devicePixelRatio || 1;
        const pw = Math.round(w * dpr);
        const ph = Math.round(h * dpr);
        if (this.lastW !== pw || this.lastH !== ph || !this.offscreen) {
            this.offscreen = document.createElement('canvas');
            this.offscreen.width = pw;
            this.offscreen.height = ph;
            this.offCtx = this.offscreen.getContext('2d');
            this.lastW = pw;
            this.lastH = ph;
        }
    }

    /**
     * Render blended modes.
     * @param {CanvasRenderingContext2D} mainCtx - the main canvas context
     * @param {number} w - logical width
     * @param {number} h - logical height
     * @param {Function} drawMode - function(ctx, modeName) that draws a mode
     */
    render(mainCtx, w, h, drawMode) {
        if (!this.enabled) return false;

        const activeModes = this.getActiveModes();
        if (activeModes.length === 0) return false;

        this._ensureCanvas(w, h);
        const dpr = window.devicePixelRatio || 1;

        for (let i = 0; i < activeModes.length; i++) {
            const { mode, weight } = activeModes[i];

            // Clear offscreen
            this.offCtx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
            this.offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Draw mode to offscreen
            drawMode(this.offCtx, mode);

            // Composite onto main canvas with weight as alpha
            mainCtx.save();
            mainCtx.setTransform(1, 0, 0, 1, 0, 0);
            mainCtx.globalAlpha = weight;
            mainCtx.globalCompositeOperation = i === 0 ? 'source-over' : 'lighter';
            mainCtx.drawImage(this.offscreen, 0, 0);
            mainCtx.restore();
            mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        mainCtx.globalAlpha = 1;
        mainCtx.globalCompositeOperation = 'source-over';
        return true;
    }
}

