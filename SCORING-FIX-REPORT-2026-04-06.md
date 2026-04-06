# 评分系统修复报告 - 2026-04-06

## 问题描述

**症状**：所有分数都显示"--"，评分系统没有工作

## 问题诊断

### 根本原因

通过 opencode 诊断，发现以下关键问题：

1. **致命问题**：`analyzeAudio` 函数中**没有调用 `detectStrum`**
   - 位置：`audio-core.js` 第 89-132 行
   - 影响：扫弦数据从未被收集到 `currentMeasureStrums` 数组
   - 结果：`currentMeasureStrums` 始终为空数组 `[]`

2. **连锁问题**：`checkMeasureUpdate` 无法触发评分
   - 条件：`currentMeasureStrums.length >= 2`（修改前）
   - 现实：数组长度始终为 0
   - 结果：评分函数永远不会被调用

3. **评分门槛过高**：
   - `calculateRhythmScore` 要求每组至少 2 个样本才计算 CV
   - 实际演奏中很难满足这个条件
   - 导致即使有数据也返回 0 分

4. **稳定性评分门槛过高**：
   - `calculateStabilityScore` 要求 10 个小节历史
   - 但 `audio-detection.js` 中 `MAX_HISTORY = 4`
   - 配置不一致

### 问题链路

```
analyzeAudio 循环
  ↓ (缺少 detectStrum 调用)
currentMeasureStrums = []
  ↓ (长度 < 2)
checkMeasureUpdate 不触发
  ↓
评分函数不执行
  ↓
UI 显示 "--"
```

## 修复方案

### 1. audio-core.js - 添加扫弦检测调用

**修改位置**：第 28 行、第 91 行、第 116-119 行、第 135 行

```javascript
// 添加全局变量
let detectStrumCallback = null;

// 修改函数签名
export function analyzeAudio(updateScoresCallback, drawRecorderWaveformCallback, drawSpectrumWaveformCallback, detectStrumCallback) {
  // ...
  
  // 在音频分析循环中调用扫弦检测
  if (detectStrumCallback) {
    detectStrumCallback(freqDataCache, timeDataCache, rms);
  }
  
  // ...
}
```

### 2. renderer.js - 传递回调函数

**修改位置**：第 248 行

```javascript
analyzeAudio(
  () => updateScoresWrapper(),
  (canvas, ctx, data, timeData, rms, bufferSize, drawInterval, debug) =>
    drawRecorderWaveform(canvas, ctx, data, timeData, rms, bufferSize, drawInterval, debug),
  (canvas, ctx, freqData, history, historySize, drawInterval, audioCtx, debug) =>
    drawSpectrumWaveform(canvas, ctx, freqData, history, historySize, drawInterval, audioCtx, debug),
  (freqData, timeData, rms) => detectStrum(freqData, timeData, rms)  // 新增
);
```

### 3. scoring.js - 降低评分门槛

**修改 1**：第 79 行 - 小节评分门槛

```javascript
// 修改前
if (timeInMeasure >= measureDuration && currentMeasureStrums.length >= 2) {

// 修改后
if (timeInMeasure >= measureDuration && currentMeasureStrums.length >= 1) {
```

**修改 2**：第 199-214 行 - 节奏评分算法优化

```javascript
// 修改前
if (groups[i].length < 2) {
  cvs.push(0);
  // ...
}

// 修改后
if (groups[i].length < 1) {
  cvs.push(0);
  // ...
}

// 修改前
const validCvs = cvs.filter((cv, i) => groupStats[i].count >= 2);
if (validCvs.length === 0) return 0;

// 修改后
const validCvs = cvs.filter((cv, i) => groupStats[i].count >= 1);
if (validCvs.length === 0) return 50; // 没有数据时给中等分数
```

**修改 3**：第 9 行 - 变量命名优化

```javascript
// 修改前
const MAX_HISTORY = 10;
if (history.length < MAX_HISTORY) return 0;

// 修改后
const MIN_HISTORY = 10;
if (history.length < MIN_HISTORY) return 0;
```

### 4. audio-detection.js - 统一配置

**修改位置**：第 14 行

```javascript
// 修改前
const MAX_HISTORY = 4;

// 修改后
const MAX_HISTORY = 10;
```

## 修复效果

### 修复前数据流

```
音频输入 → FFT 分析 → ❌ 未调用 detectStrum
                     ↓
              currentMeasureStrums = []
                     ↓
              checkMeasureUpdate 不触发
                     ↓
              分数显示 "--"
```

### 修复后数据流

```
音频输入 → FFT 分析 → ✅ detectStrum 被调用
                     ↓
              currentMeasureStrums.push(strum)
                     ↓
              小节结束 (>=1 个扫弦)
                     ↓
              calculateRhythmScore/Tone/Dynamics
                     ↓
              更新 UI 显示分数
```

## 测试建议

### 1. 基础测试
- [ ] 开始练习后，扫弦时能看到扫弦数据被收集
- [ ] 一个小节结束后，能看到评分显示（不再是"--"）
- [ ] 连续练习时，分数会随表现变化

### 2. 节奏评分测试
- [ ] 即使只扫弦 1 次，也能获得基础分数
- [ ] 稳定的节奏能获得更高分数（80-100）
- [ ] 不稳定的节奏分数较低（40-70）

### 3. 稳定性评分测试
- [ ] 前 9 个小节：稳定性显示"--"（数据不足）
- [ ] 第 10 个小节后：显示稳定性评分
- [ ] 持续稳定练习：稳定性分数逐渐上升至 90+

### 4. 边界情况测试
- [ ] 完全不扫弦：小节结束后显示 0 分或 50 分
- [ ] 只扫弦 1 次：能正常评分
- [ ] 快速扫弦：能正确识别并评分

## 代码提交

- **Commit**: `005174f`
- **消息**: `修复评分系统：所有分数显示--的问题`
- **文件**: 
  - `audio-core.js` (+7 行)
  - `renderer.js` (+2 行)
  - `scoring.js` (+6 行，-6 行)
  - `audio-detection.js` (+1 行，-1 行)
- **推送**: 已推送到 GitHub 和 Vercel

## 经验教训

1. **数据流验证**：音频处理链路中，每个环节都要验证数据是否正确传递
2. **回调函数完整性**：多模块协作时，确保所有必要的回调都被正确传递和调用
3. **门槛设置合理**：评分算法的门槛要适应实际使用场景，不能过于理想化
4. **配置统一管理**：`MAX_HISTORY` 这样的常量应该统一定义，避免多处不一致

## 后续优化建议

1. **调试模式增强**：添加 `DEBUG` 日志，显示每个小节的扫弦数量
2. **实时反馈**：在扫弦时提供即时视觉反馈（如闪一下）
3. **评分可视化**：显示每个维度的得分构成，帮助用户理解评分逻辑
4. **练习建议**：根据评分提供针对性改进建议

---

**修复完成时间**: 2026-04-06 11:34
**修复工具**: opencode (qwen3.6-plus-free)
**修复人员**: 老马 ⚔️
