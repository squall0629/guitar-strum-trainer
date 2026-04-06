// 吉他调音器核心模块 v1.0
// 基于自相关函数的基频检测算法

// 6 弦标准频率表（Hz）
const STRING_FREQUENCIES = {
  'E2': 82.41,   // 6 弦
  'A2': 110.00,  // 5 弦
  'D3': 146.83,  // 4 弦
  'G3': 196.00,  // 3 弦
  'B3': 246.94,  // 2 弦
  'E4': 329.63   // 1 弦
};

const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const STRING_DISPLAY = ['6 弦 E', '5 弦 A', '4 弦 D', '3 弦 G', '2 弦 B', '1 弦 E'];

// 调音阈值（音分）
const IN_TUNE_CENTS = 5;    // 绿色（准，±5 音分）
const CLOSE_CENTS = 50;     // 橙色（接近，±50 音分）
// >50 音分：红色（不准）

/**
 * 自相关函数找基频（比 FFT 更准）
 * @param {Float32Array} buffer - 时域音频数据
 * @param {number} sampleRate - 采样率
 * @returns {number} 检测到的频率（Hz），0 表示未检测到
 */
export function detectPitch(buffer, sampleRate) {
  const bufferSize = buffer.length;
  
  // 1. 计算 RMS 能量，过滤静音
  let rms = 0;
  for (let i = 0; i < bufferSize; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / bufferSize);
  
  if (rms < 0.01) return 0; // 静音
  
  // 2. 自相关函数
  const correlations = new Float32Array(bufferSize);
  for (let lag = 0; lag < bufferSize; lag++) {
    let correlation = 0;
    for (let i = 0; i < bufferSize - lag; i++) {
      correlation += buffer[i] * buffer[i + lag];
    }
    correlations[lag] = correlation;
  }
  
  // 3. 找第一个峰值（基频周期）
  let maxLag = 0;
  let maxValue = 0;
  
  // 吉他频率范围：82Hz - 330Hz
  // 对应周期：sampleRate/330 - sampleRate/82
  const minLag = Math.floor(sampleRate / 400);  // 最高 400Hz
  const maxLagCheck = Math.floor(sampleRate / 70);  // 最低 70Hz
  
  for (let lag = minLag; lag < Math.min(maxLagCheck, bufferSize); lag++) {
    if (correlations[lag] > maxValue && correlations[lag] > correlations[lag - 1]) {
      // 检查是否是局部最大值
      if (lag + 1 < bufferSize && correlations[lag] > correlations[lag + 1]) {
        maxValue = correlations[lag];
        maxLag = lag;
      }
    }
  }
  
  if (maxLag === 0) return 0;
  
  // 4. 计算频率
  const frequency = sampleRate / maxLag;
  return frequency;
}

/**
 * 计算音分偏差
 * @param {number} detectedFreq - 检测到的频率
 * @param {number} targetFreq - 目标频率
 * @returns {number} 音分偏差（正=偏高，负=偏低）
 */
export function calculateCents(detectedFreq, targetFreq) {
  if (detectedFreq <= 0 || targetFreq <= 0) return 0;
  return 1200 * Math.log2(detectedFreq / targetFreq);
}

/**
 * 识别当前弦
 * @param {number} frequency - 检测到的频率
 * @returns {Object} {stringName, stringIndex, targetFreq, cents, inTune}
 */
export function identifyString(frequency) {
  if (frequency <= 0) {
    return {
      stringName: '--',
      stringIndex: -1,
      targetFreq: 0,
      cents: 0,
      inTune: false,
      status: 'silent'
    };
  }
  
  // 找最接近的弦
  let closestString = null;
  let minDiff = Infinity;
  
  for (let i = 0; i < STRING_NAMES.length; i++) {
    const freq = STRING_FREQUENCIES[STRING_NAMES[i]];
    const diff = Math.abs(frequency - freq);
    if (diff < minDiff) {
      minDiff = diff;
      closestString = {
        name: STRING_NAMES[i],
        index: i,
        freq: freq
      };
    }
  }
  
  if (!closestString) {
    return {
      stringName: '--',
      stringIndex: -1,
      targetFreq: 0,
      cents: 0,
      inTune: false,
      status: 'unknown'
    };
  }
  
  const cents = calculateCents(frequency, closestString.freq);
  const absCents = Math.abs(cents);
  
  // 简化状态：±50 音分内绿色，超过红色
  const status = absCents <= IN_TUNE_CENTS ? 'in-tune' : 'out-of-tune';
  
  return {
    stringName: closestString.name,
    stringDisplay: STRING_DISPLAY[closestString.index],
    stringIndex: closestString.index,
    targetFreq: closestString.freq,
    detectedFreq: frequency,
    cents: Math.round(cents),
    inTune: status === 'in-tune',
    status: status
  };
}

/**
 * 获取弦的显示名称
 * @param {string} stringName - 如 'E2'
 * @returns {string} 如 '6 弦 E'
 */
export function getStringDisplay(stringName) {
  const index = STRING_NAMES.indexOf(stringName);
  return index >= 0 ? STRING_DISPLAY[index] : stringName;
}

/**
 * 获取状态颜色
 * @param {string} status - 'silent' | 'unknown' | 'out-of-tune' | 'in-tune'
 * @returns {string} 颜色代码
 */
export function getStatusColor(status) {
  switch (status) {
    case 'in-tune': return '#2ed573';    // 绿色（±50 音分）
    case 'out-of-tune': return '#ff4757'; // 红色（超过 50 音分）
    default: return '#888888';            // 灰色
  }
}

/**
 * 播放标准音
 * @param {AudioContext} audioContext - 音频上下文
 * @param {number} stringIndex - 弦索引 (0-5)
 * @param {number} duration - 持续时间（秒）
 */
export function playReferenceTone(audioContext, stringIndex, duration = 2) {
  if (stringIndex < 0 || stringIndex >= STRING_NAMES.length) return;
  
  const frequency = STRING_FREQUENCIES[STRING_NAMES[stringIndex]];
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  // 包络：避免爆音
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + duration - 0.1);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// 导出常量
export { STRING_FREQUENCIES, STRING_NAMES, STRING_DISPLAY, IN_TUNE_CENTS, CLOSE_CENTS };
