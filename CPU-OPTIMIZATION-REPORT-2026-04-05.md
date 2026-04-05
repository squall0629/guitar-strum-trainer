# CPU 性能优化报告

**日期:** 2026-04-05  
**优化目标:** 降低 CPU 占用率 50%+，保持功能正常，不降低用户体验

---

## 优化实施清单

### ✅ 1. 音频分析节流（60 FPS → 30 FPS）

**位置:** `analyzeAudio()` 函数（line 1508-1521）

**修改内容:**
```javascript
// 性能优化：节流到 30 FPS
const now = performance.now();
const delta = now - lastAnalyzeTime;
if (delta < ANALYZE_INTERVAL) {  // 33ms = 30 FPS
  requestAnimationFrame(analyzeAudio);
  return;
}
lastAnalyzeTime = now;
```

**预期效果:** 音频分析计算量减少 50%

---

### ✅ 2. 主波形图按需绘制

**位置:** `drawWaveform()` 函数（line 1586-1598）

**修改内容:**
```javascript
// 性能优化：只在扫弦事件或 RMS 显著变化时重绘
const now = performance.now();
const rmsChange = Math.abs(rms - lastRMSForWaveform);
const hasStrumEvent = (now - lastStrumEventTime) < 200; // 200ms 内有扫弦
const timeSinceLastDraw = now - lastWaveformDrawTime;

// 重绘条件：扫弦事件、RMS 变化超过 15%、或超过重绘间隔
if (!hasStrumEvent && rmsChange < 0.015 && timeSinceLastDraw < WAVEFORM_REDRAW_INTERVAL) {
  return;  // 跳过绘制
}

lastRMSForWaveform = rms;
lastWaveformDrawTime = now;
```

**新增变量:**
- `lastRMSForWaveform`: 记录上次绘制时的 RMS 值
- `lastWaveformDrawTime`: 记录上次绘制时间
- `WAVEFORM_REDRAW_INTERVAL = 50ms`: 最大重绘频率 20 FPS
- `lastStrumEventTime`: 扫弦事件时间戳（在 `detectStrum` 中更新）

**预期效果:** 静态/低活动状态下波形绘制减少 70%+

---

### ✅ 3. Windows 录音机风格波形节流（60 FPS → 10 FPS）

**位置:** `drawRecorderWaveform()` 函数（line 1642-1648）

**修改内容:**
```javascript
// 性能优化：节流到 10 FPS
const now = performance.now();
if (now - lastRecorderDrawTime < RECORDER_DRAW_INTERVAL) {
  return;
}
lastRecorderDrawTime = now;
```

**新增变量:**
- `lastRecorderDrawTime`: 记录上次绘制时间
- `RECORDER_DRAW_INTERVAL = 100ms`: 10 FPS

**预期效果:** 录音机波形绘制计算减少 83%

---

### ✅ 4. 频谱图优化（15 FPS + 频段限制 + 离屏缓冲）

**位置:** `drawSpectrumWaveform()` 函数（line 1709-1795）

**修改内容:**

#### 4.1 帧率节流
```javascript
// 性能优化：节流到 15 FPS
const now = performance.now();
if (now - lastSpectrumDrawTime < SPECTRUM_DRAW_INTERVAL) {
  return;
}
lastSpectrumDrawTime = now;
```

#### 4.2 频段限制（80Hz-1000Hz）
```javascript
// 性能优化：只处理 80Hz-1000Hz 关键频段（吉他核心频段）
const sampleRate = audioContext ? audioContext.sampleRate : 44100;
const binFrequency = sampleRate / 2048;  // ≈ 21.5Hz/bin
const startBin = Math.max(0, Math.floor(80 / binFrequency));  // ≈ bin 4
const endBin = Math.min(Math.floor(freqData.length / 4), Math.ceil(1000 / binFrequency));  // ≈ bin 47
const freqBins = endBin - startBin;

if (freqBins <= 0) return;
```

#### 4.3 离屏 Canvas 缓冲
```javascript
// 检测 canvas 尺寸变化，重建离屏缓冲
if (spectrumCanvas.width !== lastSpectrumCanvasWidth || spectrumCanvas.height !== lastSpectrumCanvasHeight) {
  spectrumOffscreenCanvas = null;
  spectrumOffscreenCtx = null;
  spectrumBackgroundDirty = true;
  lastSpectrumCanvasWidth = spectrumCanvas.width;
  lastSpectrumCanvasHeight = spectrumCanvas.height;
}

// 创建离屏 Canvas（只创建一次）
if (!spectrumOffscreenCanvas) {
  spectrumOffscreenCanvas = document.createElement('canvas');
  spectrumOffscreenCanvas.width = spectrumCanvas.width;
  spectrumOffscreenCanvas.height = spectrumCanvas.height;
  spectrumOffscreenCtx = spectrumOffscreenCanvas.getContext('2d');
  spectrumBackgroundDirty = true;
}

// 绘制热力图到离屏 Canvas
for (let f = startBin; f < endBin; f++) {
  // ... 绘制到 spectrumOffscreenCtx
}

// 将离屏 Canvas 内容绘制到主 Canvas
spectrumCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
spectrumCtx.drawImage(spectrumOffscreenCanvas, 0, 0);

// 绘制频率刻度标签（只在背景脏时重绘）
if (spectrumBackgroundDirty) {
  spectrumCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  spectrumCtx.font = '10px Arial';
  spectrumCtx.fillText('1kHz', 5, 12);
  spectrumCtx.fillText('80Hz', 5, spectrumCanvas.height - 5);
  spectrumBackgroundDirty = false;
}
```

**新增变量:**
- `lastSpectrumDrawTime`: 记录上次绘制时间
- `SPECTRUM_DRAW_INTERVAL = 67ms`: 15 FPS
- `spectrumOffscreenCanvas`: 离屏缓冲
- `spectrumOffscreenCtx`: 离屏上下文
- `spectrumBackgroundDirty`: 背景脏标记
- `lastSpectrumCanvasWidth/Height`: 尺寸追踪

**预期效果:**
- 绘制频率降低 75%（60→15 FPS）
- 频段计算量减少 80%+（只处理 43 个频段 vs 原来的 256+）
- 离屏缓冲减少重复绘制

---

### ✅ 5. Spectral Flux 频段优化

**位置:** `computeSpectralFlux()` 函数（line 1800-1813）

**修改内容:**
```javascript
// 性能优化：只关注 80Hz-1000Hz 吉他核心频段
const sampleRate = audioContext ? audioContext.sampleRate : 44100;
const binFrequency = sampleRate / 2048;
const startBin = Math.max(0, Math.floor(80 / binFrequency));
const endBin = Math.min(currentSpectrum.length, Math.ceil(1000 / binFrequency));

for (let i = startBin; i < endBin; i++) {
  const diff = currentSpectrum[i] - previousSpectrum[i];
  if (diff > 0) {
    flux += diff * diff;
  }
}
```

**原实现:** 处理 20%-90% 频段（约 180 个 bin）  
**新实现:** 处理 80Hz-1000Hz（约 43 个 bin）

**预期效果:** Spectral Flux 计算量减少 76%

---

### ✅ 6. 定时器清理优化

**位置:** `stopListening()` 函数（line 1462-1476）

**修改内容:**
```javascript
// 性能优化：清理自动保存定时器，防止内存泄漏
if (autoSaveIntervalId) {
  clearInterval(autoSaveIntervalId);
  autoSaveIntervalId = null;
}

// ... 其他清理逻辑 ...

// 重启自动保存定时器（下次开始监听时可用）
autoSaveIntervalId = setInterval(() => {
  saveUserSettings();
}, 5000);
```

**预期效果:** 防止多次停止/开始后定时器累积导致的内存泄漏

---

### ✅ 7. 扫弦事件追踪

**位置:** `detectStrum()` 函数末尾（line 2011-2013）

**修改内容:**
```javascript
// 通知波形图重绘
lastStrumEventTime = now;
```

**作用:** 在检测到扫弦时触发波形图重绘，确保用户看到视觉反馈

---

## 新增全局变量汇总

```javascript
// ========== 性能优化：帧率控制变量 ==========
let lastAnalyzeTime = 0;
const ANALYZE_INTERVAL = 33; // 30 FPS (~33ms)
let lastRecorderDrawTime = 0;
const RECORDER_DRAW_INTERVAL = 100; // 10 FPS (~100ms)
let lastSpectrumDrawTime = 0;
const SPECTRUM_DRAW_INTERVAL = 67; // 15 FPS (~67ms)
let lastRMSForWaveform = 0;
let lastWaveformDrawTime = 0;
const WAVEFORM_REDRAW_INTERVAL = 50; // 20 FPS max for main waveform
let lastStrumEventTime = 0; // Track last strum for waveform redraw trigger

// ========== 离屏 Canvas 缓冲 ==========
let spectrumOffscreenCanvas = null;
let spectrumOffscreenCtx = null;
let spectrumBackgroundDirty = true;
let lastSpectrumCanvasWidth = 0;
let lastSpectrumCanvasHeight = 0;
```

---

## 性能提升预期

| 优化项 | 原频率/计算量 | 新频率/计算量 | 降低比例 |
|--------|--------------|--------------|----------|
| 音频分析 | 60 FPS | 30 FPS | **50%** |
| 主波形图 | 60 FPS | 按需（~10-20 FPS） | **67-83%** |
| 录音机波形 | 60 FPS | 10 FPS | **83%** |
| 频谱图 | 60 FPS | 15 FPS | **75%** |
| 频谱计算 | 256+ bins | 43 bins | **83%** |
| Spectral Flux | ~180 bins | 43 bins | **76%** |

**综合 CPU 占用率预期降低:** **60-70%**

---

## 功能验证清单

- [ ] 和弦识别功能正常
- [ ] 扫弦检测灵敏度无变化
- [ ] 波形图显示正常（扫弦时有明显反馈）
- [ ] 频谱图显示正常（80Hz-1000Hz 频段）
- [ ] 录音机波形滚动正常
- [ ] 节拍器功能正常
- [ ] 自动保存功能正常
- [ ] 停止/开始监听无内存泄漏

---

## 测试建议

1. **Chrome DevTools Performance 面板**
   - 录制 30 秒练习过程
   - 对比优化前后的 FPS、CPU 占用、内存使用

2. **长时间运行测试**
   - 连续运行 10 分钟
   - 检查内存是否稳定（无泄漏）

3. **扫弦响应测试**
   - 快速扫弦后观察波形图响应
   - 确认视觉反馈无明显延迟

---

## 后续优化机会

1. **Web Worker 离屏计算**
   - 将 Spectral Flux 计算移到 Web Worker
   - 避免阻塞主线程

2. **Canvas 分层渲染**
   - 静态背景层（刻度标签）
   - 动态内容层（波形、频谱）

3. **自适应帧率**
   - 根据设备性能动态调整 FPS
   - 低性能设备自动降频

---

**优化完成时间:** 2026-04-05 21:47  
**优化工具:** opencode (qwen3.6-plus-free)  
**修改文件:** `renderer.js`
