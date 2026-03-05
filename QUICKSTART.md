# Music Visualizer - Quick Start Guide

## 📁 Project Structure

```
MusicVisualizer/
├── index.html              ← Open this in your browser
├── style.css               ← Styling (dark theme, responsive)
├── src/
│   └── visualizer.js       ← Main application logic (1300+ lines, fully commented)
├── README.md               ← Full documentation
└── QUICKSTART.md           ← This file
```

## 🚀 Get Running in 30 Seconds

### Fastest Way: Direct Browser

1. **Open** `index.html` in your browser (Chrome/Firefox/Safari/Edge)
2. **Click** "Load Audio File" and pick an MP3 or WAV from your computer
3. **Click** ▶ Play or press **Space**
4. **Enjoy** the visualization! 🎵

### Better Way: Local Server (Recommended for Microphone)

#### Windows - Python 3 (built-in on most modern Windows):
```powershell
cd C:\Users\fiker\StudioProjects\MusicVisualizer
python -m http.server 8000
```
Then open **http://localhost:8000** in your browser.

#### Windows - Node.js (if installed):
```powershell
npx http-server
```
Then open **http://localhost:8080** in your browser.

## 🎹 Controls Cheat Sheet

| Key | Action |
|-----|--------|
| **Space** | Play/Pause audio |
| **1** | Switch to Spectrum Bars |
| **2** | Switch to Radial Waveform |
| **3** | Switch to Hybrid Mode |
| **R** | Reset beat detector |
| **Esc** | Stop everything |

### Sliders

- **FFT Size**: More detail = slower (try 256–2048 to start)
- **Sensitivity**: Make visuals bigger/smaller
- **Smoothing**: Smoother animation (try 0.85)
- **Beat Threshold**: Lower = more beat detections

### Dropdowns

- **Color Palette**: Rainbow, Fire, Ocean, Neon, Monochrome
- **Visual Mode**: Spectrum, Radial, or Hybrid

## 📊 Understanding the Visualization

### Spectrum Bars
- Each vertical bar = one frequency bin
- Height = how loud that frequency is right now
- Color = which frequency (left=bass, right=treble)
- Glow = beat detected!

### Radial Waveform
- Circle = one cycle of audio (360°)
- Wiggly line = actual waveform
- Wiggle size = amplitude (loudness)

### Hybrid
- Bottom half = spectrum (frequency detail)
- Top half = waveform (time detail)

## 💡 How Beat Detection Works

```
Pseudo-code:
1. Get energy from current frame = sqrt(mean(all frequencies²))
2. Keep history of last ~1 second of energy
3. Short-term average = last 6-7 frames
4. Long-term average = all frames in history
5. Beat? → YES if short > long × threshold
6. Cooldown: wait 200ms before next beat
```

**Result**: Detects drums, kicks, and energy spikes automatically

## 🎨 Try These Settings

### Preset 1: "Bass Bumper"
- Visual Mode: **Spectrum**
- Color: **Fire**
- FFT Size: **512** (balance of detail vs speed)
- Sensitivity: **1.5** (emphasize the kick)
- Smoothing: **0.9** (very smooth)
- Beat Threshold: **1.2** (trigger on heavy beats)

### Preset 2: "High-Frequency Sparkle"
- Visual Mode: **Radial**
- Color: **Neon**
- FFT Size: **4096** (max detail)
- Sensitivity: **2.0** (amplify)
- Smoothing: **0.7** (responsive)
- Beat Threshold: **1.5** (selective)

### Preset 3: "Hypnotic"
- Visual Mode: **Hybrid**
- Color: **Ocean**
- FFT Size: **256** (lower detail = faster)
- Sensitivity: **0.8** (subtle)
- Smoothing: **0.95** (very smooth, dreamy)
- Beat Threshold: **1.0** (every bump)

## ⚡ Performance Tips

| FPS Low? | Try This |
|----------|----------|
| < 30 FPS | Reduce FFT to 256 or 512 |
| Still slow | Use Spectrum Bars only |
| Still low | Close other browser tabs |

**Target**: 60 FPS (watch top-right corner)

## 🔧 Customize

### Add a New Color Palette

Edit `src/visualizer.js` line 29:

```javascript
const COLOR_PRESETS = {
    // ... existing ...
    myColors: ['#ff00ff', '#00ffff', '#ffff00', '#ff0000']
};
```

Then add to `index.html` line 48:
```html
<option value="myColors">My Colors</option>
```

### Adjust Beat Sensitivity Globally

In `src/visualizer.js`, search for `new BeatDetector(43, 1.3)` and change:
- First number (43): history size → larger = slower beats
- Second number (1.3): threshold → smaller = more beats

## 🐛 Troubleshooting

### "Nothing playing"
- Check browser volume (top-right speaker icon)
- Try a different audio file (MP3 or WAV)
- Check browser console (F12 → Console tab) for errors

### "Microphone not working"
- Click "Enable Microphone" and grant permission
- Check browser mic settings (Chrome: Settings → Privacy)
- Try using `http://localhost:8000` instead of opening file directly

### "Stuttering / Low FPS"
- Lower FFT Size slider to 256 or 512
- Switch to Spectrum Bars mode
- Close other tabs

### "Beat detection not working"
- Increase "Beat Threshold" slider
- Make sure audio is actually playing
- Try pressing R to reset detector

## 📝 Code Overview

**src/visualizer.js** (fully commented, ~1300 lines):

1. **COLOR_PRESETS** (line 23): Define color schemes
2. **AudioManager** (line 48): Web Audio API wrapper
   - `loadAudioFile()`: Load MP3/WAV
   - `enableMicrophone()`: Stream live input
   - `getFrequencyData()`: FFT data
   - `getTimeDomainData()`: Waveform data
3. **BeatDetector** (line 185): Beat detection algorithm
   - `computeEnergy()`: Calculate frame energy
   - `detect()`: Check for beats
4. **Renderer** (line 224): Canvas 2D drawing
   - `renderSpectrum()`: Vertical bars
   - `renderRadial()`: Circular waveform
   - `renderHybrid()`: Both combined
   - `interpolateColor()`: Smooth color gradients
5. **VisualizerApp** (line 396): Main orchestrator
   - `setupEventListeners()`: Keyboard + UI
   - `animationLoop()`: 60 FPS render loop

## 🎯 Next Steps

1. **First run**: Load a song, pick "Rainbow Gradient" + "Spectrum", enjoy!
2. **Experiment**: Try different presets, audio files, visual modes
3. **Customize**: Add your own color palettes or visual modes (see README.md)
4. **Share**: Show it to friends! Works great on any modern browser
5. **Extend**: Dive into the code and add WebGL shaders, 3D, recording, etc.

## 📚 Resources

- **Web Audio API docs**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **Canvas 2D docs**: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
- **Beat detection theory**: https://en.wikipedia.org/wiki/Onset_detection
- **FFT explanation**: https://en.wikipedia.org/wiki/Fast_Fourier_transform

## ✨ Stretch Goals

- [ ] **WebGL version**: GPU-accelerated rendering for thousands of particles
- [ ] **Recording**: Save visualization as MP4 video
- [ ] **3D mode**: Three.js integration with 3D geometry
- [ ] **Advanced beat**: Tempo detection, BPM sync
- [ ] **Effects**: Audio filters (reverb, echo, distortion)
- [ ] **Presets**: Save/load custom configurations

---

**Questions?** Check the full **README.md** for detailed documentation and debugging tips.

**Ready to visualize?** Open **index.html** in your browser! 🚀🎵

