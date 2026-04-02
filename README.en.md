# Guitar Strum Trainer

A desktop practice tool that analyzes guitar strumming rhythm, tone, and dynamics in real-time, providing professional feedback and scoring.

## Features

### Core Features
- **Real-time Audio Analysis** - Low-latency microphone monitoring (<50ms)
- **Multi-dimensional Scoring** - Rhythm accuracy, tone purity, dynamics control
- **Instant Feedback** - Real-time suggestions for every strum
- **Practice Records** - Auto-saves historical scores with trend visualization
- **Smart Metronome** - 40-200 BPM adjustable, accent beat indicators
- **Rhythm Pattern Demos** - 5 rhythm patterns with audio demos for quick learning
- **Sensitivity Adjustment** - 1-100 levels, adaptable to different guitars and environments
- **Score Trend Chart** - Visual history of practice performance over time

### Built-in Rhythm Patterns

| Pattern | Notation | Style |
|---------|----------|-------|
| Eighth + Two Sixteenths | ♪ ♫♫ | Pop, Folk |
| Two Sixteenths + Eighth | ♫♫ ♪ | Pop, Rock |
| Folk Common | D DU UDU | Folk strumming |
| Rock Eighth | DUDUDUDU | Rock, Punk |
| Waltz | D UU D UU | 3/4 time pieces |

## Tech Stack

- **Framework**: Electron 28
- **Audio Processing**: Web Audio API
- **Analysis Algorithms**: 
  - RMS volume detection
  - FFT spectrum analysis
  - Temporal pattern matching with Gaussian scoring
  - Coefficient of variation for dynamics assessment

## Quick Start

```bash
# Install dependencies
npm install

# Start in development mode
npm start

# Build Windows installer
npm run build
```

## System Requirements

- Windows 10/11
- Microphone device
- 4GB+ RAM

## Scoring Algorithm

### Rhythm Accuracy (50% weight)
- Compares user strum intervals against target rhythm patterns
- Uses Gaussian decay scoring for smoother, more accurate evaluation
- Dynamic tolerance based on BPM (slower tempos get wider tolerance)
- Cumulative drift detection penalizes overall timing drift
- ±25% deviation for 60+ score, ±10% for 90+ score

### Tone Purity (30% weight)
- Analyzes high-frequency energy distribution (60%-100% spectrum band)
- Ideal range: 60-200 (bright but not harsh)
- Range-based scoring rather than single-point targeting
- More forgiving for natural tonal variation

### Dynamics Control (20% weight)
- Uses coefficient of variation (CV) for scientific stability measurement
- Accent-aware evaluation for patterns with强弱 variations
- Uniform pattern assessment for even strumming styles
- Absolute strength bonus/penalty for adequate playing force

## Development Log

- **2026-04-02 v1.4**: Score trend chart & algorithm improvements
  - Practice history persistence with localStorage
  - Score trend visualization chart
  - Improved rhythm scoring with Gaussian decay
  - Better tone scoring with range-based evaluation
  - Accent-aware dynamics assessment
  - Statistical summary (average, max, practice count)

- **2026-03-17 v1.2**: Microphone sensitivity adjustment
  - 1-100 level sensitivity control
  - Real-time threshold display
  - Adaptable to different guitars and ambient noise
  - Light/heavy strumming detection

- **2026-03-17 v1.1**: Metronome and demo features
  - Smart metronome (40-200 BPM)
  - Audio rhythm pattern demos
  - Headphone usage tips
  - Improved UI interactions

- **2026-03-17 v1.0**: MVP release
  - Basic audio capture
  - 5 rhythm patterns
  - Real-time scoring system
  - Waveform visualization

## TODO

- [ ] Chord detection support
- [ ] Practice song library
- [ ] Export practice reports
- [ ] Multi-guitar calibration (acoustic/electric)
- [ ] Custom rhythm pattern creation
- [ ] Recording playback feature

---

_Enhancing music practice efficiency through technology!_
