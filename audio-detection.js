/**
 * 吉他扫弦练习助手 - 扫弦检测模块
 * @module audio-detection
 * @description 实现 Spectral Flux 计算、Onset 检测、扫弦识别、音色评分
 */

import { getAudioContext } from './audio-core.js';
import { getCurrentBPM } from './audio-metronome.js';
import { AppState } from './state-manager.js';

// 导入常量
import {
  MAX_HISTORY,
  FLUX_BUFFER_SIZE,
  FLUX_COOLDOWN_FRAMES,
  FLUX_MIN_BUFFER,
  DEFAULT_SENSITIVITY,
  DEFAULT_STRUM_THRESHOLD,
  MIN_STRUM_THRESHOLD,
  MAX_STRUM_THRESHOLD,
  BASE_MIN_STRUM_INTERVAL,
  DETECTED_STRUMS_MAX,
  TONE_MIN_IDEAL,
  TONE_MAX_IDEAL,
  TONE_HIGH,
  TONE_VERY_HIGH,
  AMPLITUDE_WEAK,
  AMPLITUDE_MEDIUM,
  AMPLITUDE_GOOD,
  REFERENCE_BPM,
  FFT_SIZE,
  SPECTRUM_MIN_FREQ,
  SPECTRUM_MAX_FREQ
} from './constants.js';

// ========== 状态变量 ==========

/** @type {number} 当前小节开始时间戳 */
let currentMeasureStartTime = 0;

/** @type {Array} 当前小节的扫弦数据数组 */
let currentMeasureStrums = [];

/** @type {Object} 上次小节评分 */
let lastMeasureScores = { rhythm: 0, tone: 0, dynamics: 0, total: 0 };

/** @type {number} 上次评分的小节结束时间戳 */
let lastScoredMeasureEnd = 0;

/** @type {Object} 评分历史记录 */
let measureHistory = { rhythm: [], tone: [], dynamics: [] };

/** @type {Array} 检测到的扫弦历史 */
let detectedStrums = [];

/** @type {number} 上次扫弦时间 */
let lastStrumTime = 0;

/** @type {number} 期望的扫弦索引（用于节奏反馈） */
let expectedStrumIndex = 0;

/** @type {Array} 扫弦历史记录（用于统计） */
let strumHistory = [];

// Spectral Flux
let previousSpectrum = null;
let fluxBuffer = [];
let fluxBufferSize = FLUX_BUFFER_SIZE;
let fluxThreshold = 0;
let fluxPeakCooldown = 0;

// 灵敏度
let sensitivityLevel = DEFAULT_SENSITIVITY;
let strumThreshold = DEFAULT_STRUM_THRESHOLD;

let lastStrumEventTime = 0;

// 采样率缓存（避免每帧调用 getAudioContext）
let cachedSampleRate = null;

// ========== 灵敏度管理 ==========

/**
 * 更新扫弦检测阈值（根据灵敏度等级）
 * @description 灵敏度 1-100，阈值 0.01-0.30
 */
export function updateThreshold() {
  strumThreshold = MAX_STRUM_THRESHOLD - (sensitivityLevel - 1) * ((MAX_STRUM_THRESHOLD - MIN_STRUM_THRESHOLD) / (MAX_SENSITIVITY - MIN_SENSITIVITY));
  strumThreshold = Math.max(MIN_STRUM_THRESHOLD, Math.min(MAX_STRUM_THRESHOLD, strumThreshold));
  const thresholdDisplay = document.getElementById('thresholdDisplay');
  if (thresholdDisplay) {
    thresholdDisplay.textContent = strumThreshold.toFixed(2);
  }
}

// ========== 灵敏度管理 ==========

/**
 * 设置灵敏度等级
 * @param {number} level - 灵敏度等级 (1-100)
 */
export function setSensitivityLevel(level) {
  sensitivityLevel = level;
  updateThreshold();
  AppState.setSensitivityLevel(level);
}

/**
 * 获取当前灵敏度等级
 * @returns {number} 灵敏度等级
 */
export function getSensitivityLevel() {
  return AppState.getSensitivityLevel();
}

/**
 * 设置扫弦阈值
 * @param {number} threshold - 扫弦阈值
 */
export function setStrumThreshold(threshold) {
  strumThreshold = threshold;
}

/**
 * 获取当前扫弦阈值
 * @returns {number} 扫弦阈值
 */
export function getStrumThreshold() {
  return strumThreshold;
}

// ========== 状态管理 ==========
/**
 * 获取已检测的扫弦历史
 * @returns {Array} 扫弦历史数组
 */
export function getDetectedStrums() {
  return detectedStrums;
}

/**
 * 获取当前小节的扫弦数据
 * @returns {Array} 当前小节扫弦数组
 */
export function getCurrentMeasureStrums() {
  return currentMeasureStrums;
}

/**
 * 获取评分历史记录
 * @returns {Object} 评分历史 {rhythm, tone, dynamics}
 */
export function getMeasureHistory() {
  return measureHistory;
}

/**
 * 获取上次小节评分
 * @returns {Object} 上次评分 {rhythm, tone, dynamics, total}
 */
export function getLastMeasureScores() {
  return lastMeasureScores;
}

/**
 * 设置上次小节评分
 * @param {Object} scores - 评分对象
 */
export function setLastMeasureScores(scores) {
  lastMeasureScores = scores;
}

/**
 * 获取上次评分小节结束时间
 * @returns {number} 时间戳
 */
export function getLastScoredMeasureEnd() {
  return lastScoredMeasureEnd;
}

/**
 * 设置上次评分小节结束时间
 * @param {number} time - 时间戳
 */
export function setLastScoredMeasureEnd(time) {
  lastScoredMeasureEnd = time;
}

/**
 * 设置当前小节开始时间
 * @param {number} time - 时间戳
 */
export function setCurrentMeasureStartTime(time) {
  currentMeasureStartTime = time;
}

/**
 * 获取当前小节开始时间
 * @returns {number} 时间戳
 */
export function getCurrentMeasureStartTime() {
  return currentMeasureStartTime;
}

/**
 * 设置当前小节扫弦数据
 * @param {Array} strums - 扫弦数组
 */
export function setCurrentMeasureStrums(strums) {
  currentMeasureStrums = strums;
}

/**
 * 重置频谱通量状态
 */
export function resetFluxState() {
  previousSpectrum = null;
  fluxBuffer = [];
  fluxThreshold = 0;
  fluxPeakCooldown = 0;
}

// ========== Spectral Flux 计算 ==========
/**
 * 计算频谱通量（Spectral Flux）
 * @param {Uint8Array} currentSpectrum - 当前帧频谱
 * @param {Uint8Array} previousSpectrum - 上一帧频谱
 * @returns {number} 频谱通量值（归一化到 80-1000Hz 范围）
 */
export function computeSpectralFlux(currentSpectrum, previousSpectrum) {
  if (!previousSpectrum || currentSpectrum.length !== previousSpectrum.length) {
    return 0;
  }
  
  // 使用缓存的采样率，避免每帧调用 getAudioContext()
  if (!cachedSampleRate) {
    const audioContext = getAudioContext();
    cachedSampleRate = audioContext ? audioContext.sampleRate : 44100;
  }
  
  let flux = 0;
  const binFrequency = cachedSampleRate / FFT_SIZE;
  const startBin = Math.max(0, Math.floor(80 / binFrequency));
  const endBin = Math.min(currentSpectrum.length, Math.ceil(1000 / binFrequency));
  
  for (let i = startBin; i < endBin; i++) {
    const diff = currentSpectrum[i] - previousSpectrum[i];
    if (diff > 0) {
      flux += diff * diff;
    }
  }
  
  const binRange = endBin - startBin;
  if (binRange <= 0) return 0;
  return flux / binRange;
}

function computeAdaptiveThreshold() {
  if (fluxBuffer.length < 10) return 0.5;
  
  const recentFlux = fluxBuffer.slice(-Math.min(20, fluxBuffer.length));
  const mean = recentFlux.reduce((a, b) => a + b, 0) / recentFlux.length;
  const variance = recentFlux.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / recentFlux.length;
  const stdDev = Math.sqrt(variance);
  const sensitivityFactor = 1.0 - (sensitivityLevel - 1) * (0.5 / 99);
  
  return Math.max(0.1, mean + sensitivityFactor * stdDev);
}

/**
 * 检测频谱通量峰值
 * @param {number} currentFlux - 当前频谱通量
 * @param {number} threshold - 检测阈值
 * @returns {boolean} 是否检测到峰值
 */
export function detectFluxPeak(currentFlux, threshold) {
  if (fluxPeakCooldown > 0) {
    fluxPeakCooldown--;
    return false;
  }
  
  if (fluxBuffer.length < FLUX_MIN_BUFFER) return false;
  
  const prevFlux = fluxBuffer[fluxBuffer.length - 2];
  const prevPrevFlux = fluxBuffer[fluxBuffer.length - 3];
  
  const isRising = currentFlux > prevFlux && prevFlux > prevPrevFlux;
  const isAboveThreshold = currentFlux > threshold;
  const isSignificantPeak = currentFlux > prevFlux * 1.05;
  
  if (isRising && isAboveThreshold && isSignificantPeak) {
    fluxPeakCooldown = FLUX_COOLDOWN_FRAMES;
    return true;
  }
  
  return false;
}

// ========== Onset 检测 ==========
/**
 * 使用频谱通量检测 onset
 * @param {Uint8Array} freqData - 频域数据
 * @param {Uint8Array} timeData - 时域数据
 * @param {number} rms - 均方根振幅
 * @returns {Object} 检测结果 {onset, confidence, flux, threshold}
 */
export function detectOnsetWithFlux(freqData, timeData, rms) {
  const now = Date.now();
  const currentFlux = computeSpectralFlux(freqData, previousSpectrum);
  
  if (previousSpectrum === null || previousSpectrum.length !== freqData.length) {
    previousSpectrum = new Uint8Array(freqData.length);
  }
  previousSpectrum.set(freqData);
  
  fluxBuffer.push(currentFlux);
  if (fluxBuffer.length > fluxBufferSize) {
    fluxBuffer.shift();
  }
  
  fluxThreshold = computeAdaptiveThreshold();
  const fluxPeak = detectFluxPeak(currentFlux, fluxThreshold);
  
  const rmsThreshold = strumThreshold * 1.5;
  const rmsOnset = rms > rmsThreshold;
  
  const minStrumInterval = Math.round(BASE_MIN_STRUM_INTERVAL * (REFERENCE_BPM / getCurrentBPM()));
  const timeSinceLastStrum = now - lastStrumTime;
  
  let onsetDetected = false;
  let confidence = 0;
  
  if (timeSinceLastStrum > minStrumInterval) {
    if (fluxPeak && rms > rmsThreshold * 0.5) {
      onsetDetected = true;
      confidence = 0.9;
    } else if (fluxPeak && rms > rmsThreshold * 0.3) {
      onsetDetected = true;
      confidence = 0.7;
    } else if (rmsOnset && !fluxPeak && timeSinceLastStrum > minStrumInterval * 1.5) {
      onsetDetected = true;
      confidence = 0.5;
    }
  }
  
  return { onset: onsetDetected, confidence, flux: currentFlux, threshold: fluxThreshold };
}

// ========== 扫弦检测 ==========
/**
 * 扫弦检测主函数
 * @description 使用频谱通量和 RMS 检测吉他扫弦事件
 * @param {Uint8Array} freqData - 频域数据
 * @param {Uint8Array} timeData - 时域数据
 * @param {number} rms - 均方根振幅
 * @returns {{onset: boolean, flux: number, threshold: number, confidence: number}} 检测结果
 */
export function detectStrum(freqData, timeData, rms) {
  const now = Date.now();
  
  const highFreqStart = Math.floor(freqData.length * 0.6);
  let highFreqEnergy = 0;
  for (let i = highFreqStart; i < freqData.length; i++) {
    highFreqEnergy += freqData[i];
  }
  highFreqEnergy /= (freqData.length - highFreqStart);
  
  const onsetResult = detectOnsetWithFlux(freqData, timeData, rms);
  
  if (onsetResult.onset) {
    const strum = {
      time: now,
      amplitude: rms,
      tone: highFreqEnergy,
      interval: lastStrumTime > 0 ? now - lastStrumTime : 0,
      flux: onsetResult.flux,
      fluxThreshold: onsetResult.threshold,
      confidence: onsetResult.confidence
    };
    
    lastStrumEventTime = now;
    detectedStrums.push(strum);
    currentMeasureStrums.push(strum);
    lastStrumTime = now;
    
    if (detectedStrums.length > DETECTED_STRUMS_MAX) {
      detectedStrums.shift();
    }
  }
  
  return onsetResult;
}

// ========== 音色评分 ==========
export function calculateToneScore(strum) {
  if (!strum) return 0;
  
  const tone = strum.tone;
  if (tone > TONE_VERY_HIGH) {
    return Math.max(0, 100 - (tone - TONE_VERY_HIGH) * 0.5);
  }
  if (tone > TONE_HIGH) {
    return 85 + (TONE_VERY_HIGH - tone) * 0.3;
  }
  if (tone > TONE_MIN_IDEAL) {
    return 90 + (TONE_HIGH - tone) * 0.1;
  }
  return Math.max(0, 90 - (TONE_MIN_IDEAL - tone) * 0.5);
}

// ========== 反馈提供 ==========
export function provideFeedback(strum, currentRhythm, getActiveRhythmFn) {
  const pattern = getActiveRhythmFn(currentRhythm);
  if (!pattern || !pattern.pattern || pattern.pattern.length === 0) return;
  const expectedInterval = pattern.pattern[expectedStrumIndex];
  let feedback = '';
  
  if (strum.interval > 0 && expectedInterval > 0) {
    const diff = strum.interval - expectedInterval;
    const percentDiff = (diff / expectedInterval) * 100;
    const absPercent = Math.abs(percentDiff);
    
    if (absPercent < 10) {
      feedback = '✓ 完美! ';
    } else if (absPercent < 25) {
      feedback = (diff > 0 ? '⏱ 稍慢 ' : '⚡ 稍快 ') + Math.round(absPercent) + '% ';
    } else {
      feedback = (diff > 0 ? '⏱ 太慢 ' : '⚡ 太快 ') + Math.round(absPercent) + '% ';
    }
  }
  
  if (strum.tone > TONE_VERY_HIGH) {
    feedback += '🎵 音色略刺耳';
  } else if (strum.tone > TONE_HIGH) {
    feedback += '🎵 音色明亮';
  } else if (strum.tone > TONE_MIN_IDEAL) {
    feedback += '🎵 音色正常';
  } else {
    feedback += '🎵 音色偏闷';
  }
  
  if (strum.amplitude > AMPLITUDE_GOOD) {
    feedback += ' 💪 力度很好';
  } else if (strum.amplitude > AMPLITUDE_MEDIUM) {
    feedback += ' 💪 力度适中';
  } else {
    feedback += ' 💪 力度偏弱';
  }
  
  const feedbackMessage = document.getElementById('feedbackMessage');
  if (feedbackMessage) {
    feedbackMessage.textContent = feedback;
  }
  
  expectedStrumIndex = (expectedStrumIndex + 1) % pattern.pattern.length;
}
