/**
 * Music Visualizer - Main Module
 *
 * A real-time audio visualization engine with beat detection,
 * multiple visual modes, and configurable audio parameters.
 *
 * Architecture:
 * - AudioManager: Web Audio API setup and data extraction
 * - BeatDetector: Energy-based beat detection algorithm
 * - Renderer: Canvas 2D rendering with multiple visual modes
 * - App: Main orchestrator and UI bindings
 */

// ============================================================================
// CONFIGURATION & PRESETS
// ============================================================================

/**
 * Color palette presets for different visual themes.
 * Each palette is an array of CSS colors interpolated based on frequency.
 */
const COLOR_PRESETS = {
    gradient: [
        '#ff0000', '#ff7f00', '#ffff00', '#00ff00',
        '#0000ff', '#4b0082', '#9400d3'
    ],
    fire: [
        '#000000', '#330000', '#660000', '#990000',
        '#cc0000', '#ff3300', '#ff6600', '#ffcc00'
    ],
    ocean: [
        '#001a33', '#003366', '#0066cc', '#00ccff',
        '#00ffff', '#66ffff', '#ccffff'
    ],
    neon: [
        '#ff006e', '#fb5607', '#ffbe0b', '#8338ec',
        '#3a86ff', '#06ffa5', '#ff006e'
    ],
    mono: [
        '#000000', '#333333', '#666666', '#999999',
        '#cccccc', '#ffffff'
    ]
};

/**
 * Visual mode configurations.
 */
const VISUAL_MODES = {
    spectrum: 'spectrum',
    radial: 'radial',
    hybrid: 'hybrid'
};

// ============================================================================
// AUDIO MANAGER
// ============================================================================

/**
 * Manages Web Audio API context, nodes, and data extraction.
 * Supports both file input and microphone input.
 */
class AudioManager {
    constructor() {
        // Initialize lazy: context created on first user interaction
        this.audioContext = null;
        this.analyser = null;
        this.frequencyData = null;
        this.timeDomainData = null;
        this.audioSource = null;
        this.mediaElementAudioSource = null;
        this.mediaStreamAudioSource = null;
        this.currentSource = null; // 'file', 'mic', or null
    }

    /**
     * Initialize AudioContext and analyser node.
     * Must be called in response to user gesture (security requirement).
     */
    initializeContext() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.connect(this.audioContext.destination);

        // Configure analyser with sensible defaults
        this.setFftSize(256);
        this.analyser.smoothingTimeConstant = 0.85;
        this.analyser.minDecibels = -100;
        this.analyser.maxDecibels = -10;
    }

    /**
     * Load and play an audio file.
     * @param {File} file - Audio file from input element
     */
    async loadAudioFile(file) {
        if (!this.audioContext) this.initializeContext();

        // Disconnect existing sources
        this.disconnectAllSources();

        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // Create audio source from buffer
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.analyser);

            this.audioSource = source;
            this.currentSource = 'file';

            return source;
        } catch (error) {
            console.error('Error loading audio file:', error);
            throw error;
        }
    }

    /**
     * Enable microphone input via getUserMedia.
     */
    async enableMicrophone() {
        if (!this.audioContext) this.initializeContext();

        this.disconnectAllSources();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamAudioSource(stream);
            source.connect(this.analyser);

            this.mediaStreamAudioSource = source;
            this.currentSource = 'mic';

            return source;
        } catch (error) {
            console.error('Microphone access denied or unavailable:', error);
            throw error;
        }
    }

    /**
     * Disconnect all audio sources and stop playback.
     */
    disconnectAllSources() {
        if (this.audioSource) {
            this.audioSource.stop(0);
            this.audioSource.disconnect();
            this.audioSource = null;
        }
        if (this.mediaStreamAudioSource) {
            this.mediaStreamAudioSource.disconnect();
            this.mediaStreamAudioSource = null;
        }
        this.currentSource = null;
    }

    /**
     * Set FFT size (must be power of 2, 32 to 32768).
     * @param {number} size - FFT size
     */
    setFftSize(size) {
        if (this.analyser) {
            this.analyser.fftSize = size;
            const bufferLength = this.analyser.frequencyBinCount;
            this.frequencyData = new Uint8Array(bufferLength);
            this.timeDomainData = new Uint8Array(this.analyser.fftSize);
        }
    }

    /**
     * Set smoothing time constant (0–1, higher = more smoothing).
     * @param {number} value - Smoothing constant
     */
    setSmoothing(value) {
        if (this.analyser) {
            this.analyser.smoothingTimeConstant = Math.max(0, Math.min(1, value));
        }
    }

    /**
     * Get frequency data (0–255 range).
     */
    getFrequencyData() {
        if (this.analyser && this.frequencyData) {
            this.analyser.getByteFrequencyData(this.frequencyData);
            return this.frequencyData;
        }
        return null;
    }

    /**
     * Get time-domain data (0–255 range).
     */
    getTimeDomainData() {
        if (this.analyser && this.timeDomainData) {
            this.analyser.getByteTimeDomainData(this.timeDomainData);
            return this.timeDomainData;
        }
        return null;
    }

    /**
     * Get current playback time (file mode only).
     */
    getCurrentTime() {
        return this.audioContext ? this.audioContext.currentTime : 0;
    }

    /**
     * Check if audio is currently playing.
     */
    isPlaying() {
        return this.currentSource !== null &&
               this.audioContext &&
               this.audioContext.state === 'running';
    }

    /**
     * Resume audio context (required after user gesture).
     */
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
}

// ============================================================================
// BEAT DETECTOR
// ============================================================================

/**
 * Energy-based beat detection.
 * Compares short-term energy average to long-term average.
 * Beat occurs when short > long * threshold.
 */
class BeatDetector {
    constructor(
        historySize = 43, // ~1 second at 43 FPS
        threshold = 1.3
    ) {
        this.historySize = historySize;
        this.threshold = threshold;
        this.energyHistory = [];
        this.beatTime = 0;
        this.beatCooldown = 0; // Prevent multiple beats in quick succession
    }

    /**
     * Compute energy from frequency data (sum of squares).
     * @param {Uint8Array} frequencyData - Frequency bins
     * @returns {number} Normalized energy (0–1)
     */
    computeEnergy(frequencyData) {
        if (!frequencyData) return 0;

        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            const norm = frequencyData[i] / 255;
            sum += norm * norm;
        }
        return Math.sqrt(sum / frequencyData.length);
    }

    /**
     * Check for beat and update history.
     * @param {number} currentEnergy - Energy value (0–1)
     * @param {number} currentTime - Current timestamp in seconds
     * @returns {boolean} True if a beat was detected
     */
    detect(currentEnergy, currentTime) {
        // Add to history
        this.energyHistory.push(currentEnergy);
        if (this.energyHistory.length > this.historySize) {
            this.energyHistory.shift();
        }

        // Compute short-term average (last ~100ms)
        const shortSize = Math.max(2, Math.floor(this.historySize * 0.15));
        const shortAvg = this.energyHistory.slice(-shortSize)
            .reduce((a, b) => a + b, 0) / shortSize;

        // Compute long-term average
        const longAvg = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;

        // Beat detection with cooldown
        const isBeat = shortAvg > longAvg * this.threshold &&
                       currentTime - this.beatTime > 0.2;

        if (isBeat) {
            this.beatTime = currentTime;
            return true;
        }
        return false;
    }

    /**
     * Set beat threshold (typically 1.0–3.0).
     * @param {number} threshold - Beat threshold multiplier
     */
    setThreshold(threshold) {
        this.threshold = Math.max(1.0, Math.min(3.0, threshold));
    }

    /**
     * Reset detector state.
     */
    reset() {
        this.energyHistory = [];
        this.beatTime = 0;
    }
}

// ============================================================================
// RENDERER
// ============================================================================

/**
 * Canvas 2D renderer for multiple visualization modes.
 * Handles all drawing, color interpolation, and layout logic.
 */
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.colorPalette = COLOR_PRESETS.gradient;
        this.visualMode = VISUAL_MODES.spectrum;
        this.sensitivity = 1.0;

        // Resize canvas to match display size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * Resize canvas to match container size.
     */
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    /**
     * Set color palette from preset name.
     * @param {string} presetName - Preset key
     */
    setColorPalette(presetName) {
        this.colorPalette = COLOR_PRESETS[presetName] || COLOR_PRESETS.gradient;
    }

    /**
     * Set visual mode.
     * @param {string} mode - Visual mode key
     */
    setVisualMode(mode) {
        this.visualMode = mode;
    }

    /**
     * Interpolate color from palette based on normalized value (0–1).
     * @param {number} value - Value between 0 and 1
     * @returns {string} CSS color string
     */
    interpolateColor(value) {
        const v = Math.max(0, Math.min(1, value));
        const idx = v * (this.colorPalette.length - 1);
        const lower = Math.floor(idx);
        const upper = Math.min(lower + 1, this.colorPalette.length - 1);
        const t = idx - lower;

        // Simple linear interpolation between two colors
        const c1 = this.parseColor(this.colorPalette[lower]);
        const c2 = this.parseColor(this.colorPalette[upper]);

        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);

        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Parse hex or rgb color to { r, g, b } object.
     * @param {string} colorStr - CSS color string
     * @returns {object} { r, g, b } object with 0–255 values
     */
    parseColor(colorStr) {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = colorStr;
        ctx.fillRect(0, 0, 1, 1);
        const imageData = ctx.getImageData(0, 0, 1, 1).data;
        return { r: imageData[0], g: imageData[1], b: imageData[2] };
    }

    /**
     * Render spectrum bars visualization.
     * @param {Uint8Array} frequencyData - Frequency bins
     * @param {boolean} isBeat - Whether a beat is detected
     */
    renderSpectrum(frequencyData, isBeat) {
        if (!frequencyData) return;

        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        const barCount = Math.min(128, frequencyData.length);
        const barWidth = width / barCount;

        // Clear background
        this.ctx.fillStyle = 'rgba(10, 10, 25, 0.3)';
        this.ctx.fillRect(0, 0, width, height);

        // Draw bars
        for (let i = 0; i < barCount; i++) {
            const value = frequencyData[i] / 255;
            const amplifiedValue = Math.pow(value, 0.5) * this.sensitivity;
            const barHeight = amplifiedValue * height;

            const hue = i / barCount;
            this.ctx.fillStyle = this.interpolateColor(hue);

            // Add glow on beat
            if (isBeat) {
                this.ctx.shadowBlur = 20;
                this.ctx.shadowColor = this.ctx.fillStyle;
            } else {
                this.ctx.shadowBlur = 5;
                this.ctx.shadowColor = this.ctx.fillStyle;
            }

            this.ctx.fillRect(
                i * barWidth,
                height - barHeight,
                barWidth * 0.8,
                barHeight
            );
        }

        this.ctx.shadowBlur = 0;
    }

    /**
     * Render radial waveform visualization.
     * @param {Uint8Array} timeDomainData - Time-domain samples
     * @param {boolean} isBeat - Whether a beat is detected
     */
    renderRadial(timeDomainData, isBeat) {
        if (!timeDomainData) return;

        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2 - 20;

        // Clear background
        this.ctx.fillStyle = 'rgba(10, 10, 25, 0.3)';
        this.ctx.fillRect(0, 0, width, height);

        // Draw waveform as radial line
        this.ctx.beginPath();
        const sampleCount = Math.min(512, timeDomainData.length);
        for (let i = 0; i < sampleCount; i++) {
            const angle = (i / sampleCount) * Math.PI * 2;
            const value = (timeDomainData[i] - 128) / 128;
            const radius = maxRadius + value * maxRadius * 0.5 * this.sensitivity;

            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();

        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
        gradient.addColorStop(0, this.interpolateColor(0.3));
        gradient.addColorStop(1, this.interpolateColor(0.9));

        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = 0.7;
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;

        this.ctx.strokeStyle = this.interpolateColor(0.6);
        this.ctx.lineWidth = isBeat ? 3 : 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        if (isBeat) {
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = this.ctx.strokeStyle;
        }
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    /**
     * Render hybrid visualization (spectrum + radial).
     * @param {Uint8Array} frequencyData - Frequency bins
     * @param {Uint8Array} timeDomainData - Time-domain samples
     * @param {boolean} isBeat - Whether a beat is detected
     */
    renderHybrid(frequencyData, timeDomainData, isBeat) {
        if (!frequencyData || !timeDomainData) return;

        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        // Clear background
        this.ctx.fillStyle = 'rgba(10, 10, 25, 0.3)';
        this.ctx.fillRect(0, 0, width, height);

        // Draw spectrum in lower half
        const barCount = Math.min(64, frequencyData.length);
        const barWidth = width / barCount;
        for (let i = 0; i < barCount; i++) {
            const value = frequencyData[i] / 255;
            const amplifiedValue = Math.pow(value, 0.5) * this.sensitivity * 0.5;
            const barHeight = amplifiedValue * (height / 2);

            const hue = i / barCount;
            this.ctx.fillStyle = this.interpolateColor(hue);
            this.ctx.globalAlpha = 0.8;
            this.ctx.fillRect(
                i * barWidth,
                height - barHeight,
                barWidth * 0.9,
                barHeight
            );
        }
        this.ctx.globalAlpha = 1.0;

        // Draw radial waveform in upper half
        const centerX = width / 2;
        const centerY = height / 4;
        const maxRadius = Math.min(width, height) / 4 - 10;

        this.ctx.beginPath();
        const sampleCount = Math.min(256, timeDomainData.length);
        for (let i = 0; i < sampleCount; i++) {
            const angle = (i / sampleCount) * Math.PI * 2;
            const value = (timeDomainData[i] - 128) / 128;
            const radius = maxRadius + value * maxRadius * 0.3 * this.sensitivity;

            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();

        this.ctx.strokeStyle = this.interpolateColor(0.5);
        this.ctx.lineWidth = isBeat ? 2.5 : 1.5;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
    }

    /**
     * Main render dispatch.
     * @param {Uint8Array} frequencyData - Frequency bins
     * @param {Uint8Array} timeDomainData - Time-domain samples
     * @param {boolean} isBeat - Whether a beat is detected
     */
    render(frequencyData, timeDomainData, isBeat) {
        switch (this.visualMode) {
            case VISUAL_MODES.spectrum:
                this.renderSpectrum(frequencyData, isBeat);
                break;
            case VISUAL_MODES.radial:
                this.renderRadial(timeDomainData, isBeat);
                break;
            case VISUAL_MODES.hybrid:
                this.renderHybrid(frequencyData, timeDomainData, isBeat);
                break;
        }
    }
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

/**
 * Main application orchestrator.
 * Manages UI bindings, animation loop, and state.
 */
class VisualizerApp {
    constructor() {
        // Core components
        this.audioManager = new AudioManager();
        this.beatDetector = new BeatDetector(43, 1.3);
        this.renderer = new Renderer(document.getElementById('visualizer-canvas'));

        // UI state
        this.isPlaying = false;
        this.frameCount = 0;
        this.fpsTime = performance.now();

        // DOM elements
        this.elements = {
            fileInput: document.getElementById('file-input'),
            micToggle: document.getElementById('mic-toggle'),
            playPause: document.getElementById('play-pause'),
            visualMode: document.getElementById('visual-mode'),
            colorPreset: document.getElementById('color-preset'),
            fftSize: document.getElementById('fft-size'),
            fftValue: document.getElementById('fft-value'),
            smoothing: document.getElementById('smoothing'),
            smoothingValue: document.getElementById('smoothing-value'),
            sensitivity: document.getElementById('sensitivity'),
            sensitivityValue: document.getElementById('sensitivity-value'),
            beatThreshold: document.getElementById('beat-threshold'),
            beatThresholdValue: document.getElementById('beat-threshold-value'),
            fpsDisplay: document.getElementById('fps'),
            beatIndicator: document.getElementById('beat-indicator')
        };

        this.setupEventListeners();
    }

    /**
     * Attach all event listeners to UI controls.
     */
    setupEventListeners() {
        // File input
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Microphone toggle
        this.elements.micToggle.addEventListener('click', () => this.toggleMicrophone());

        // Play/pause
        this.elements.playPause.addEventListener('click', () => this.togglePlayPause());

        // Visual mode
        this.elements.visualMode.addEventListener('change', (e) => {
            this.renderer.setVisualMode(e.target.value);
        });

        // Color preset
        this.elements.colorPreset.addEventListener('change', (e) => {
            this.renderer.setColorPalette(e.target.value);
        });

        // FFT size
        this.elements.fftSize.addEventListener('input', (e) => {
            const exponent = parseInt(e.target.value);
            const size = Math.pow(2, exponent);
            this.audioManager.setFftSize(size);
            this.elements.fftValue.textContent = size;
        });

        // Smoothing
        this.elements.smoothing.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.audioManager.setSmoothing(value);
            this.elements.smoothingValue.textContent = value.toFixed(2);
        });

        // Sensitivity
        this.elements.sensitivity.addEventListener('input', (e) => {
            this.renderer.sensitivity = parseFloat(e.target.value);
            this.elements.sensitivityValue.textContent = e.target.value;
        });

        // Beat threshold
        this.elements.beatThreshold.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.beatDetector.setThreshold(value);
            this.elements.beatThresholdValue.textContent = value.toFixed(1);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    /**
     * Handle audio file selection.
     * @param {Event} event - File input change event
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Resume audio context (may be suspended)
            await this.audioManager.resume();

            // Load and play audio
            const source = await this.audioManager.loadAudioFile(file);
            source.start(0);

            this.isPlaying = true;
            this.updatePlayPauseButton();
            this.beatDetector.reset();
        } catch (error) {
            alert('Error loading audio file. Make sure it\'s a valid audio file.');
            console.error(error);
        }
    }

    /**
     * Toggle microphone input.
     */
    async toggleMicrophone() {
        try {
            // Resume audio context
            await this.audioManager.resume();

            if (this.audioManager.currentSource === 'mic') {
                // Disable microphone
                this.audioManager.disconnectAllSources();
                this.elements.micToggle.classList.remove('active');
                this.isPlaying = false;
            } else {
                // Enable microphone
                await this.audioManager.enableMicrophone();
                this.elements.micToggle.classList.add('active');
                this.isPlaying = true;
            }

            this.updatePlayPauseButton();
            this.beatDetector.reset();
        } catch (error) {
            alert('Microphone access denied. Please allow microphone access and try again.');
            console.error(error);
        }
    }

    /**
     * Toggle play/pause for file playback.
     */
    async togglePlayPause() {
        if (this.audioManager.currentSource !== 'file') return;

        await this.audioManager.resume();

        if (this.isPlaying) {
            this.audioManager.audioSource.stop(0);
            this.isPlaying = false;
        } else {
            const file = this.elements.fileInput.files[0];
            if (file) {
                const source = await this.audioManager.loadAudioFile(file);
                source.start(0);
                this.isPlaying = true;
            }
        }

        this.updatePlayPauseButton();
    }

    /**
     * Update play/pause button appearance and enable state.
     */
    updatePlayPauseButton() {
        if (this.audioManager.currentSource === 'file') {
            this.elements.playPause.disabled = false;
            this.elements.playPause.textContent = this.isPlaying ? '⏸ Pause' : '▶ Play';
        } else {
            this.elements.playPause.disabled = true;
            this.elements.playPause.textContent = '▶ Play';
        }
    }

    /**
     * Handle keyboard shortcuts.
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboard(event) {
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.togglePlayPause();
                break;
            case 'Digit1':
                this.renderer.setVisualMode(VISUAL_MODES.spectrum);
                this.elements.visualMode.value = VISUAL_MODES.spectrum;
                break;
            case 'Digit2':
                this.renderer.setVisualMode(VISUAL_MODES.radial);
                this.elements.visualMode.value = VISUAL_MODES.radial;
                break;
            case 'Digit3':
                this.renderer.setVisualMode(VISUAL_MODES.hybrid);
                this.elements.visualMode.value = VISUAL_MODES.hybrid;
                break;
            case 'KeyR':
                this.beatDetector.reset();
                break;
            case 'Escape':
                this.audioManager.disconnectAllSources();
                this.isPlaying = false;
                this.elements.micToggle.classList.remove('active');
                this.updatePlayPauseButton();
                break;
        }
    }

    /**
     * Update FPS counter (60 times per second).
     */
    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        if (now - this.fpsTime >= 1000) {
            this.elements.fpsDisplay.textContent = this.frameCount;
            this.frameCount = 0;
            this.fpsTime = now;
        }
    }

    /**
     * Main animation loop.
     * Called 60 times per second via requestAnimationFrame.
     */
    animationLoop() {
        // Get audio data
        const frequencyData = this.audioManager.getFrequencyData();
        const timeDomainData = this.audioManager.getTimeDomainData();

        // Detect beat
        let isBeat = false;
        if (frequencyData) {
            const energy = this.beatDetector.computeEnergy(frequencyData);
            isBeat = this.beatDetector.detect(energy, performance.now() / 1000);
        }

        // Update beat indicator
        this.elements.beatIndicator.textContent = isBeat ? '●' : '○';
        this.elements.beatIndicator.style.color = isBeat ? '#ff0000' : '#00ff00';

        // Render visualization
        this.renderer.render(frequencyData, timeDomainData, isBeat);

        // Update FPS counter
        this.updateFPS();

        // Continue loop
        requestAnimationFrame(() => this.animationLoop());
    }

    /**
     * Start the application.
     */
    start() {
        console.log('Music Visualizer initialized and running...');
        this.animationLoop();
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new VisualizerApp();
        app.start();
    });
} else {
    const app = new VisualizerApp();
    app.start();
}

