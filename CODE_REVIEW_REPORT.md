# 代码审查报告

**项目:** guitar-strum-trainer  
**审查文件:** renderer.js, audio-detection.js, chord-detector.js, chord-training.js  
**审查日期:** 2026-05-07  
**审查者:** 老马 ⚔️

---

## 摘要

项目整体规模约 **~2100 行核心逻辑代码**，架构采用模块化 ES6 + EventBus 模式，核心音频检测基于 Spectral Flux 算法。和弦识别依赖外部 CDN 库 Tonal.js。主要架构清晰，但在代码质量、边界处理、安全性方面存在需要改进的地方。

---

## 🔴 严重问题 (Critical)

### C1. `TransitionDetector` 类重复定义
**文件:** `chord-detector.js:380` 和 `chord-training.js:117`

`TransitionDetector` 被定义为**两个不同的 ES6 Class**：
- `chord-detector.js` 导出 `class TransitionDetector`（有 `getAverageTransitionTime()` 方法）
- `chord-training.js` 导出另一个 `class TransitionDetector`（通过 `getStats()` 提供数据）

`renderer.js` 导入的是 `chord-training.js` 的版本，但 `ChordDetector` 内部使用的是 `chord-detector.js` 的版本。**两个类的接口不一致**，`getAverageTransitionTime()` 只存在于 chord-detector 版本中，会导致 `transitionDetector.getAverageTransitionTime()` 在某些调用路径上失败。

**影响:** 方法不存在时 `TypeError`，或统计数据不一致。

**建议:** 统一为一个 `TransitionDetector` 类，在独立模块中维护。

---

### C2. XSS 安全隐患 — `innerHTML` 直接渲染用户数据
**文件:** `chord-training.js:347` (renderSelectedChords)

```javascript
selectedChordsDisplay.innerHTML = currentProgression.map((chord, index) => `
  <span class="selected-chord-item chord-item" data-chord-index="${index}">
    ${chord}  <!-- ⚠️ 直接插入，未转义 -->
    <button class="btn-remove-chord" data-index="${index}">×</button>
  </span>
`).join('');
```

如果 `chord` 名称被注入恶意内容（如 `<img src=x onerror=alert(1)>`），会直接执行。

**影响:** 存储型 XSS（如果 localStorage 中的自定义和弦名被污染）。

**建议:** 使用 `textContent` 或对变量做 HTML 转义。

---

### C3. Canvas 图表 — 分母为零导致渲染崩溃
**文件:** `renderer.js:renderStatsChart()`

```javascript
statsChartCanvas.width = rect.width * dpr;  // 高 DPI 缩放
// ...
const chartWidth = width - padding.left - padding.right;
// ...
x: padding.left + (chartWidth / (recentHistory.length - 1 || 1)) * index
// ⚠️ 当 recentHistory.length === 1 时，x 坐标全是 padding.left
```

当只有一条历史记录时，图表 x 坐标全部相同，数据点重叠。且当 `recentHistory.length === 0` 时整个图表逻辑被跳过，但数组边界仍可能被意外触发。

**影响:** 图表渲染错误，Canvas 可能抛异常。

**建议:** 
```javascript
const divisor = Math.max(1, recentHistory.length - 1);
const x = padding.left + (chartWidth / divisor) * index;
```

---

### C4. 内存泄漏 — `strumHistory` 数组无上限增长
**文件:** `renderer.js:108` 和 `renderer.js:renderStatsChart()`

```javascript
let strumHistory = [];  // 模块级，无大小限制

// 每次练习记录都 push，无 pop/trim
strumHistory.push({ ... });
```

随着使用时间增长，`strumHistory` 会无限增长，导致内存占用持续上升，最终可能使页面变慢甚至崩溃。

**影响:** 内存持续增长，性能下降。

**建议:** 添加 `MAX_STRUM_HISTORY = 200` 并在 `push` 前检查：
```javascript
if (strumHistory.length >= MAX_STRUM_HISTORY) {
  strumHistory.shift();
}
```

---

## 🟠 高风险问题 (High)

### H1. FFT 频谱大小计算错误
**文件:** `chord-detector.js:extractStringEnergies()`

```javascript
const fftSize = freqData.length * 2;  // ⚠️ 错误
```

`freqData` 是 `Uint8Array`，长度是 `fftSize / 2`（FFT 返回一半 bins）。正确的 fftSize 应该是 `analyser.fftSize`。当前计算会导致 `binSize = sampleRate / (freqData.length * 2)`，比实际偏小一半，从而导致频率计算不准确。

**影响:** 弦频率判断错误，和弦识别准确率下降。

**建议:**
```javascript
const fftSize = this.analyser.fftSize;  // 直接从 analyser 获取
const binSize = sampleRate / fftSize;
```

同样问题存在于 `detectPeaks()` 方法（chord-detector.js:247）。

---

### H2. 未使用的 `chordChangeTimeout` 造成内存泄漏
**文件:** `chord-training.js:44`

```javascript
let chordChangeTimeout = null;
// ... 被赋值
chordChangeTimeout = setTimeout(() => { ... }, delay);
// ⚠️ 没有任何地方调用 clearTimeout(chordChangeTimeout)
```

**影响:** 每次和弦切换都产生新的 setTimeout，旧的 timer 永不清理。

---

### H3. `provideFeedback` 依赖外部传入的函数引用
**文件:** `audio-detection.js:provideFeedback()` 和 `chord-training.js:showFeedback()`

```javascript
// audio-detection.js
export function provideFeedback(strum, currentRhythm, getActiveRhythmFn) {
  const pattern = getActiveRhythmFn(currentRhythm);  // 运行时动态获取
  // ...
}
```

调用方通过函数参数传递依赖，违反模块内聚性原则。如果传错函数引用，错误会被静默吞掉（返回空字符串）。

**影响:** 难以调试，运行时行为不确定。

**建议:** 通过 EventBus 或直接 import 获取依赖。

---

### H4. `AppState` 状态订阅存在 API 不一致
**文件:** `state-manager.js`

`AppState.getPracticeChordStats()` 返回一个**快照对象**：
```javascript
getPracticeChordStats: () => ({
  correct: StateManager.get('practiceChordCorrect'),
  total: StateManager.get('practiceChordTotal')
})
```

但 `incrementPracticeChordCorrect` 和 `incrementPracticeChordTotal` 是独立导出的方法，调用方拿到快照后无法感知后续变化。

**影响:** 调用方持有的 `correct/total` 数据可能过时。

---

### H5. `resetFluxState()` 不完整
**文件:** `audio-detection.js:resetFluxState()`

```javascript
export function resetFluxState() {
  previousSpectrum = null;
  fluxBuffer = [];
  fluxThreshold = 0;
  fluxPeakCooldown = 0;
  cachedSampleRate = null;  // ✅
  // ⚠️ 缺少 fluxBufferSize 重置
}
```

虽然 `fluxBufferSize` 来自常量，一般不需重置，但如果将来常量被动态修改，这里不一致会产生问题。

---

### H6. 音符频率计算使用硬编码值
**文件:** `chord-detector.js:computeSpectralFlux()`

```javascript
const startBin = Math.max(0, Math.floor(80 / binFrequency));
const endBin = Math.min(currentSpectrum.length, Math.ceil(1000 / binFrequency));
// ⚠️ 硬编码 80Hz 和 1000Hz，而 constants.js 中有 SPECTRUM_MIN_FREQ / SPECTRUM_MAX_FREQ
```

**影响:** 常量定义和实际使用不一致，维护困难。

---

## 🟡 中等风险 (Medium)

### M1. DOM 元素查找无容错 — 多次条件判断
**文件:** `chord-training.js:setupPracticeMode()` 和多处

```javascript
function setupPracticeMode() {
  if (practiceModeBindingsReady) return;
  if (!practiceModeRhythm || !practiceModeComprehensive) return;  // ⚠️ 静默失败
  practiceModeRhythm.addEventListener('click', () => setPracticeMode('rhythm'));
  // ...
}
```

如果元素不存在，函数静默退出，没有任何日志或警告，调试困难。且 `practiceModeRhythm` 等变量在 `initChordTraining(options)` 传入，如果调用时漏传参数，静默失败很难排查。

**建议:** 至少添加 debug 级别的日志：
```javascript
if (!practiceModeRhythm) {
  console.warn('[ChordTraining] practiceModeRhythm not found, skipping setup');
  return;
}
```

---

### M2. `getCachedElement()` 对 detached 节点行为不当
**文件:** `renderer.js:getCachedElement()`

```javascript
function getCachedElement(id, selector = null) {
  const element = cachedDOM[id];
  if (element && document.contains(element)) {
    return element;
  }
  // ...
}
```

`document.contains()` 对已从 DOM 中移除（detached）的节点返回 `false`，缓存的元素会被当作不存在而重新查询。但此时如果新查询也找不到（元素被删除），返回 `null` 可能导致下游代码报错。

---

### M3. StateManager.notify() 触发事件与实际 key 不匹配
**文件:** `state-manager.js:notify()`

```javascript
function notify(key) {
  if (subscribers.has(key)) {
    subscribers.get(key).forEach(callback => callback(state[key]));
  }
  EventBus.emit(Events.SENSITIVITY_CHANGE, { key, value: state[key] }); // ⚠️ 始终发 SENSITIVITY_CHANGE
}
```

无论哪个 state key 发生变化，都发送 `SENSITIVITY_CHANGE` 事件。这会导致事件订阅者做出错误响应（如 BPM 变化时触发灵敏度更新逻辑）。

**建议:** 根据 key 发送不同事件：
```javascript
EventBus.emit(`STATE_CHANGE_${key.toUpperCase()}`, { key, value: state[key] });
```

---

### M4. 常量定义冗余
**文件:** 多处

多处同时定义了相同含义的常量，如 `FFT_SIZE` 在 `constants.js` 定义，也在 `audio-detection.js` 中通过 import 使用。但在 `chord-detector.js` 中 FFT size 是通过 `freqData.length * 2` 重新推导的，造成逻辑混乱。

**建议:** 统一从 `constants.js` 导出，所有 FFT 相关计算使用同一个值。

---

### M5. Canvas DPR 缩放但未重置变换矩阵
**文件:** `renderer.js:renderStatsChart()`

```javascript
const dpr = window.devicePixelRatio || 1;
statsChartCanvas.width = rect.width * dpr;
statsChartCanvas.height = rect.height * dpr;
statsChartCtx.setTransform(1, 0, 0, 1, 0, 0);
statsChartCtx.scale(dpr, dpr);
```

DPR 缩放是正确的，但每次 resize 都会重新设置，没有检查是否已经设置过。如果页面多次触发 resize，变换可能被重复应用。

---

### M6. `chord-training.js` 的 `setTrainingMode` 没有边界检查
**文件:** `chord-training.js:setTrainingMode()`

```javascript
export function setTrainingMode(mode) {
  currentTrainingMode = mode;  // ⚠️ 任何字符串都接受，无校验
  // ...
}
```

传入非法值（如 `'preset123'`）不会报错，但后续逻辑会异常。

**建议:** 
```javascript
const VALID_MODES = ['preset', 'custom', 'free'];
if (!VALID_MODES.includes(mode)) {
  console.warn(`[ChordTraining] Invalid mode: ${mode}`);
  return;
}
```

---

### M7. `saveCustomProgression` 使用 `prompt()` 阻塞 UI
**文件:** `chord-training.js:saveCustomProgression()`

```javascript
const name = prompt('请输入进行名称:');
if (!name) return;
```

这是浏览器原生弹窗，会阻塞 JS 执行线程，且样式不可定制。如果 prompt 被浏览器或扩展拦截，用户体验会很差。

**建议:** 使用自定义模态输入框替代。

---

## 🟢 低风险问题 (Low)

### L1. 调试日志未完全移除
**文件:** 多处

```javascript
console.warn('[ChordDetector] Tonal.js 未加载...');
console.warn('[ChordTraining] 无法初始化和弦检测器...');
```

生产环境应统一控制 debug 日志（已有 `DEBUG` 常量但未统一使用）。

---

### L2. 变量命名语言混用
部分变量名混用中英文（如 `chordChangeTimeout`、`strumHistory` 用英文，但 `调音器`、`扫弦` 用中文注释），影响代码可读性。

---

### L3. 魔法数字
多处出现未命名常量：

```javascript
// audio-detection.js
const sensitivityFactor = 1.0 - (sensitivityLevel - 1) * (0.5 / 99);  // 魔法数字 0.5, 99

// chord-training.js
const CHORD_STABLE_FRAME_COUNT = 6;  // ✅ 已有命名
const CHORD_REPEAT_SUPPRESS_MS = 1200;  // ✅ 已有命名
// 但以下缺失:
if (absPercent < 10) { ... }  // 硬编码 10, 25
```

---

### L4. `resetDetectionSession` 重置了 `fluxBufferSize` 吗？
**文件:** `audio-detection.js:resetDetectionSession()`

`fluxBufferSize` 赋值为 `FLUX_BUFFER_SIZE`（通过 import），但重置时没有显式重新赋值。如果 `FLUX_BUFFER_SIZE` 常量在运行时被修改（虽然目前没有），状态会不一致。

---

### L5. `AppState` 中 `practiceTransitionTimes` 是引用传递
**文件:** `state-manager.js`

```javascript
getPracticeTransitionTimes: () => StateManager.get('practiceTransitionTimes'),
addPracticeTransitionTime: (time) => {
  const times = StateManager.get('practiceTransitionTimes');
  times.push(time);
  StateManager.set('practiceTransitionTimes', times);
}
```

`getPracticeTransitionTimes` 返回数组引用，外部可直接 `push()` 绕过 `addPracticeTransitionTime()`，导致 `StateManager` 感知不到变化（虽然 push 后 `set` 会触发 notify，但时机可能不对）。

---

## 📊 架构改进建议

### 1. 统一 TransitionDetector 架构
当前 `TransitionDetector` 的职责分散在两个文件中。建议将其作为独立模块：

```
utils/
  └── transition-detector.js  // 唯一的 TransitionDetector
```

### 2. 引入 TypeScript
项目复杂度已达到需要类型检查的规模。大量运行时类型相关 bug（如 `setSensitivityLevel(null)`）可以通过 TypeScript 在编译期发现。

### 3. 音频分析模块抽象
`chord-detector.js` 的 `ChordDetector` 和 `audio-detection.js` 都直接操作 Web Audio API，建议抽象为统一接口：

```javascript
class AudioAnalyzer {
  constructor(audioContext, analyser) { ... }
  getFrequencyData() { ... }
  getTimeData() { ... }
  getRMS() { ... }
}
```

### 4. 引入 Web Worker
Spectral Flux 计算和 FFT 分析在主线程执行，如果页面复杂可能导致音频处理抖动。建议将 `detectStrum` 的计算密集部分移到 Web Worker。

### 5. 统一状态管理层
当前 `AppState`（StateManager）、模块级 `let` 变量、EventBus 三套状态管理并存：
- `AppState` 管理全局配置
- 模块级 `let` 管理运行时状态（如 `strumHistory`）
- EventBus 处理跨模块通信

建议明确分层，或引入专门的状态管理库。

---

## 📋 问题汇总

| ID | 严重度 | 文件 | 问题 |
|----|--------|------|------|
| C1 | 🔴 Critical | chord-detector.js, chord-training.js | TransitionDetector 类重复定义，接口不一致 |
| C2 | 🔴 Critical | chord-training.js | XSS：innerHTML 未转义用户数据 |
| C3 | 🔴 Critical | renderer.js | Canvas 分母为零导致渲染崩溃 |
| C4 | 🔴 Critical | renderer.js | strumHistory 无上限增长导致内存泄漏 |
| H1 | 🟠 High | chord-detector.js | FFT 大小计算错误导致频率判断偏差 |
| H2 | 🟠 High | chord-training.js | setTimeout 未清理，内存泄漏 |
| H3 | 🟠 High | audio-detection.js | 依赖注入方式增加调试难度 |
| H4 | 🟠 High | state-manager.js | getPracticeChordStats 返回快照，过时数据 |
| H5 | 🟠 High | audio-detection.js | resetFluxState 不完整 |
| H6 | 🟠 High | chord-detector.js | 频谱范围硬编码，未用常量 |
| M1 | 🟡 Medium | chord-training.js | DOM 查找静默失败 |
| M2 | 🟡 Medium | renderer.js | detached 节点处理不当 |
| M3 | 🟡 Medium | state-manager.js | notify 事件类型不准确 |
| M4 | 🟡 Medium | 多文件 | 常量定义与使用不一致 |
| M5 | 🟡 Medium | renderer.js | Canvas DPR 缩放重复应用 |
| M6 | 🟡 Medium | chord-training.js | setTrainingMode 无边界检查 |
| M7 | 🟡 Medium | chord-training.js | prompt() 阻塞 UI |
| L1 | 🟢 Low | 多文件 | 调试日志残留 |
| L2 | 🟢 Low | 多文件 | 中英命名混用 |
| L3 | 🟢 Low | 多文件 | 魔法数字 |
| L4 | 🟢 Low | audio-detection.js | fluxBufferSize 重置不明确 |
| L5 | 🟢 Low | state-manager.js | 数组引用传递绕过 setter |

---

## ✅ 做得好的地方

1. **模块化架构** — ES6 模块划分清晰，EventBus 解耦了 UI 和逻辑
2. **常量集中管理** — `constants.js` 统一了大部分配置值
3. **Spectral Flux 算法实现** — 核心音频检测算法合理，峰值检测逻辑完善
4. **DOM 缓存机制** — `getCachedElement()` 减少重复查询
5. **自适应阈值** — `computeAdaptiveThreshold()` 能动态调整灵敏度
6. **多层级反馈** — 音色、力度、节奏三重评分体系
7. **DPR 高清屏适配** — Canvas 图表有高清缩放处理

---

_本报告由老马 ⚔️ 生成，如有疑问请查阅对应源文件。_
