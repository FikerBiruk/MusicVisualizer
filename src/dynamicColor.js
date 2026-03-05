/**
 * Dynamic Color Logic — Auto Color Mode
 *
 * When active, colors are derived from audio analysis:
 * - Dominant frequency → hue
 * - Beat intensity → saturation bursts
 * - Energy level → gradient animation speed
 * - Silence → fade to monochrome
 *
 * Generates a real-time palette that makes each song feel uniquely colored.
 */

export class DynamicColorEngine {
    constructor() {
        this.enabled = false;
        this.currentHue = 200;
        this.targetHue = 200;
        this.saturation = 70;
        this.targetSaturation = 70;
        this.gradientSpeed = 1;
        this.monoFade = 0;         // 0 = full color, 1 = full monochrome
        this.silenceFrames = 0;
        this.silenceThreshold = 60; // frames of silence before mono fade
        this.palette = [];
        this.time = 0;

        // Energy tracking
        this.energyHistory = [];
        this.energyHistSize = 30;
    }

    /**
     * Update dynamic colors based on audio analysis.
     * @param {Uint8Array} freqData - frequency data
     * @param {number} beatIntensity - 0..1
     * @param {number} bass - 0..1 bass energy
     * @param {number} energy - overall energy
     * @param {number} dt - delta time
     * @returns {string[]} - generated palette array (7 hex-like HSL strings)
     */
    update(freqData, beatIntensity, bass, energy, dt) {
        if (!this.enabled) return null;

        this.time += dt;

        // Track energy
        this.energyHistory.push(energy);
        if (this.energyHistory.length > this.energyHistSize) this.energyHistory.shift();

        // === Dominant frequency → hue ===
        if (freqData) {
            let maxVal = 0, maxIdx = 0;
            const len = Math.min(freqData.length, 256);
            for (let i = 2; i < len; i++) {
                if (freqData[i] > maxVal) {
                    maxVal = freqData[i];
                    maxIdx = i;
                }
            }
            // Map frequency bin to hue (0-360)
            this.targetHue = (maxIdx / len) * 360;
        }

        // Smooth hue transition
        let hueDiff = this.targetHue - this.currentHue;
        // Take shortest path around the color wheel
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        this.currentHue = (this.currentHue + hueDiff * dt * 3 + 360) % 360;

        // === Beat intensity → saturation bursts ===
        this.targetSaturation = 50 + beatIntensity * 50;
        this.saturation += (this.targetSaturation - this.saturation) * dt * 8;

        // === Energy → gradient speed ===
        const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        this.gradientSpeed = 0.5 + avgEnergy * 4;

        // === Silence detection → mono fade ===
        if (energy < 0.03) {
            this.silenceFrames++;
            if (this.silenceFrames > this.silenceThreshold) {
                this.monoFade = Math.min(1, this.monoFade + dt * 0.8);
            }
        } else {
            this.silenceFrames = 0;
            this.monoFade = Math.max(0, this.monoFade - dt * 3);
        }

        // === Generate palette ===
        this.palette = this._generatePalette();
        return this.palette;
    }

    /**
     * Generate a 7-color palette based on current dynamic state.
     */
    _generatePalette() {
        const colors = [];
        const hue = this.currentHue;
        const sat = this.saturation;
        const speed = this.gradientSpeed;
        const mono = this.monoFade;

        for (let i = 0; i < 7; i++) {
            const hueOffset = (i / 7) * 120 * speed + this.time * speed * 20;
            const h = (hue + hueOffset) % 360;
            const s = Math.round(sat * (1 - mono));
            const l = 30 + (i / 6) * 45;

            // Convert HSL to hex-ish string that works with canvas
            colors.push(`hsl(${Math.round(h)}, ${s}%, ${Math.round(l)}%)`);
        }
        return colors;
    }

    /**
     * Get current palette (returns null if not enabled).
     */
    getPalette() {
        return this.enabled ? this.palette : null;
    }
}

