# Music Visualizer

A real-time audio visualization engine built with the **Web Audio API** and **Canvas 2D**. Capture audio from files or your microphone, detect beats, and render smooth, responsive visuals with multiple color palettes and visualization modes.

## Features

- **Audio Input**: Load local MP3/WAV files or stream from microphone
- **Real-Time FFT Analysis**: Configurable FFT size (32–16384 bins) and smoothing
- **Beat Detection**: Energy-based algorithm detects beats in real-time
- **Multiple Visualizations**:
  - Spectrum Bars: Frequency bins mapped to vertical bars with color gradients
  - Radial Waveform: Time-domain waveform drawn in circular layout
  - Hybrid Mode: Combines spectrum and radial for richer visuals
- **Color Palettes**: Rainbow, Fire, Ocean, Neon, Monochrome presets
- **Sensitivity Control**: Adjust visual amplitude and beat responsiveness
- **Keyboard Shortcuts**: Space (play/pause), 1/2/3 (modes), R (reset), Esc (stop)
- **Responsive Design**: Works on desktop and tablet (Canvas resizes automatically)
- **No Dependencies**: Pure JavaScript, no build tools required

## Quick Start

### Option 1: Open Directly in Browser

1. Navigate to the project folder: `MusicVisualizer/`
2. Open `index.html` in your web browser (Chrome, Firefox, Edge, Safari)
3. Click **Load Audio File** and select an MP3 or WAV
4. Click **▶ Play** or press **Space** to start
5. Adjust **Sensitivity**, **FFT Size**, and **Color Palette** in real-time

**Note**: Due to browser security (CORS), opening `file://` URLs may limit microphone access. Use a local server for full functionality (see below).

### Option 2: Run with Local Server (Recommended)

#### Using Python 3:
```bash
cd C:\Users\fiker\StudioProjects\MusicVisualizer
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

#### Using Node.js (http-server):
```bash
npx http-server
```
Then open `http://localhost:8080` in your browser.

#### Using Node.js (built-in):
```bash
node -e "require('http').createServer((req, res) => { \
  const fs = require('fs'); \
  const url = require('url').parse(req.url).pathname; \
  const file = decodeURIComponent(url === '/' ? 'index.html' : url.substring(1)); \
  try { \
    res.end(fs.readFileSync(file)); \
  } catch(e) { \
    res.writeHead(404); res.end('Not found'); \
  } \
}).listen(8000, () => console.log('http://localhost:8000'))"
```

## File Structure

```
MusicVisualizer/
├── index.html              # UI template: file input, controls, canvas
├── style.css               # Responsive styling with dark theme
├── src/
│   └── visualizer.js       # Main application (Audio, Beat Detection, Rendering)
└── README.md               # This file
```

## How It Works

### Audio Pipeline

1. **AudioManager** initializes the **Web Audio API** context on first user gesture
2. User loads a file or enables microphone → audio routed to **AnalyserNode**
3. AnalyserNode computes frequency domain (FFT) and time-domain data each frame
4. Data exposed as `getByteFrequencyData()` and `getByteTimeDomainData()`

### Beat Detection Algorithm

**Energy-based detection** with history:

```
1. Compute current frame energy: sqrt(mean(frequency_bins²))
2. Keep rolling history of last ~1 second of energy values
3. Short-term avg = mean(last 6-7 frames)
4. Long-term avg = mean(all history)
5. Beat detected when: short_avg > long_avg × threshold
6. Cooldown: prevent multiple beats within 200ms
```

This approach is lightweight and responsive to energy spikes (drums, kicks).

### Visual Rendering

**Spectrum Bars**:
- Maps frequency bins to vertical bars
- Width = FFT bins / display width
- Height = normalized amplitude × sensitivity
- Color = hue based on frequency (rainbow gradient)
- Glow effect on beat detection

**Radial Waveform**:
- Time-domain samples drawn as polar coordinates
- Angle = sample index / total samples (360°)
- Radius = center + (normalized amplitude × max_radius × sensitivity)
- Filled circle with stroke outline
- Animated waveform flows continuously

**Hybrid Mode**:
- Spectrum bars in lower half (compact)
- Radial waveform in upper half (detailed)
- Useful for detailed analysis and aesthetics

## Controls & Keyboard Shortcuts

### UI Controls

| Control | Effect |
|---------|--------|
| **Load Audio File** | Select MP3/WAV from disk |
| **🎤 Enable Microphone** | Stream live audio input |
| **▶ Play** | Start/resume file playback |
| **Visual Mode** | Switch between Spectrum/Radial/Hybrid |
| **Color Palette** | Change color scheme (Rainbow, Fire, Ocean, Neon, Mono) |
| **FFT Size** | Frequency resolution (more bins = more detail, slower) |
| **Smoothing** | Frequency smoothing (0–0.99, higher = smoother) |
| **Sensitivity** | Boost visual amplitude (0.1–5.0) |
| **Beat Threshold** | Sensitivity of beat detection (1.0–3.0) |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Space** | Play/Pause (file mode) |
| **1** | Spectrum Bars mode |
| **2** | Radial Waveform mode |
| **3** | Hybrid mode |
| **R** | Reset beat detector history |
| **Esc** | Stop audio and reset |

## Configuration

All parameters are **configurable in real-time** via UI sliders and dropdowns:

- **FFT Size**: 2^5 (32) to 2^14 (16384) frequency bins
  - Smaller = faster, lower detail
  - Larger = slower, high-frequency detail
- **Smoothing**: 0–0.99
  - 0 = no smoothing (jittery, responsive)
  - 0.85+ = smooth, lag behind audio peaks
- **Sensitivity**: 0.1–5.0
  - < 1 = dampens visuals
  - > 1 = amplifies visuals
- **Beat Threshold**: 1.0–3.0
  - Lower = more beats detected
  - Higher = only strong kicks/drums trigger beats

## Extending the Visualizer

### Adding New Color Palettes

Edit `COLOR_PRESETS` in `src/visualizer.js`:

```javascript
const COLOR_PRESETS = {
    // ...existing presets...
    custom: [
        '#ff00ff', '#00ffff', '#ffff00', '#ff0000'
    ]
};
```

Then add an option to `<select id="color-preset">` in `index.html`:

```html
<option value="custom">Custom Palette</option>
```

### Adding New Visual Modes

1. Add a new rendering function to the `Renderer` class:

```javascript
renderCustom(frequencyData, timeDomainData, isBeat) {
    // Your custom rendering logic here
}
```

2. Update the `render()` dispatch method:

```javascript
case 'custom':
    this.renderCustom(frequencyData, timeDomainData, isBeat);
    break;
```

3. Add mode to `VISUAL_MODES` object and update HTML `<select>`:

```html
<option value="custom">Custom Mode</option>
```

### Adjusting Beat Detection Sensitivity

In `VisualizerApp.start()`, change `BeatDetector` initialization:

```javascript
this.beatDetector = new BeatDetector(
    43,   // history size (frames) - increase for slower response
    1.3   // threshold - decrease for more beats
);
```

### Performance Tuning

- **Reduce FFT size** if frame rate drops below 30 FPS
- **Increase smoothing** to reduce flickering
- **Use Spectrum Bars** instead of Radial for lower-end devices
- Monitor **FPS display** in top-right corner

## Debugging Tips

1. **Check Console**: Open DevTools (F12) → Console tab for errors
2. **Audio Debugging**:
   - Verify file loads: check `AudioManager.audioContext.state`
   - Test mic access: grant permission or check browser settings
   - View frequency data: add `console.log(frequencyData)` in render loop
3. **Performance**:
   - Monitor FPS (target: 60)
   - Check CPU usage: DevTools → Performance tab
   - Profile animation loop with DevTools Profiler
4. **Visual Debugging**:
   - Beat indicator (●○) should pulse with drums
   - Spectrum bars should respond within 1 frame (16ms)
   - Canvas should resize smoothly on window resize
5. **Audio Context Issues**:
   - Some browsers require user gesture to play audio
   - Microphone requires HTTPS or localhost
   - Check browser console for specific errors

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Recommended |
| Firefox | ✅ Full | Excellent performance |
| Safari | ✅ Full | Use webkit prefix for AudioContext |
| Edge | ✅ Full | Chromium-based |
| Opera | ✅ Full | Similar to Chrome |
| IE 11 | ❌ None | Web Audio API not supported |

## Future Enhancements

### Stretch Goal: WebGL Shaders

Replace Canvas 2D rendering with WebGL for GPU-accelerated visuals:

```javascript
class WebGLRenderer {
    constructor(canvas) {
        this.gl = canvas.getContext('webgl2');
        this.program = this.createShaderProgram(vertexShader, fragmentShader);
    }
    
    render(frequencyData) {
        // GPU-accelerated rendering with shaders
    }
}
```

**Benefits**: Thousands of particles, complex effects, 4K resolution at 60 FPS

**Example shaders**: ray marching, particle systems, post-processing (bloom, distortion)

### Other Ideas

- **Recording**: Capture visualization as MP4 video
- **3D Mode**: Three.js integration for 3D geometry
- **Advanced Beat**: Tempo detection, beat subdivision, polyrhythmic analysis
- **Effects**: Reverb, echo, distortion audio effects
- **Presets**: Save/load configurations (localStorage)
- **Mobile Touch**: Swipe controls, accelerometer input
- **Multiplayer**: OSC or WebSocket sync across devices

## Troubleshooting

### "No audio"
- Check file format (MP3, WAV, OGG supported)
- Verify browser volume is not muted
- Check DevTools Console for errors
- Try a different audio file

### "Microphone not working"
- Grant permission when browser asks
- Check browser mic settings (Settings → Privacy → Microphone)
- Use HTTPS or `localhost:8000`
- Some browsers disable mic on `file://` URLs

### "Visualizer frozen"
- Check if audio file is actually playing
- Try refreshing page
- Reduce FFT size to improve performance
- Check if browser tab is active (some browsers throttle background tabs)

### "Low FPS / stuttering"
- Reduce FFT size (try 512 or 1024)
- Switch to Spectrum Bars mode
- Close other resource-heavy tabs
- Disable browser extensions

## Credits

- **Web Audio API**: MDN Web Docs
- **Canvas 2D**: Modern browser standard
- **Beat Detection**: Energy-based onset detection (common in music analysis)
- **UI Design**: Inspired by modern music production software (Ableton, Logic)

## License

Open source. Free to use, modify, and distribute.

---

**Happy visualizing!** 🎵✨

Have fun experimenting with different audio files, color palettes, and visual modes. The visualizer is designed for quick iteration—tweak sensitivity and FFT size while music plays to find the perfect look.

