// 吉他调音器核心模块 v3.0
// 基于 @chordbook/tuner 的 YIN 算法 + 平滑滤波

import { createTuner } from 'https://esm.sh/@chordbook/tuner@0.0.3';

// 导入常量
import {
  GUITAR_STRING_FREQUENCIES,
  GUITAR_MIDI_NOTES,
  TUNER_MIN_FREQ,
  TUNER_MAX_FREQ,
  TUNER_SMOOTHING_ALPHA,
  TUNER_CONFIDENCE_THRESHOLD,
  TUNER_HYSTERESIS_CENTS,
  TUNER_IN_TUNE_CENTS,
  TUNER_CLOSE_CENTS,
  TUNER_UPDATE_INTERVAL,
  TUNER_BUFFER_SIZE,
  TUNER_SMOOTHING_CONSTANT,
  REFERENCE_TONE_GAIN
} from './constants.js';

// 6 弦标准频率表（Hz）
const STRING_FREQUENCIES = GUITAR_STRING_FREQUENCIES;

const STRING_NAMES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const STRING_DISPLAY = ['6 弦 E', '5 弦 A', '4 弦 D', '3 弦 G', '2 弦 B', '1 弦 E'];

// 调音阈值（音分）
const IN_TUNE_CENTS = TUNER_IN_TUNE_CENTS;
const CLOSE_CENTS = TUNER_CLOSE_CENTS;

// 平滑和滤波参数（针对低音弦优化）
const EWMA_ALPHA = TUNER_SMOOTHING_ALPHA;
const CONFIDENCE_THRESHOLD = TUNER_CONFIDENCE_THRESHOLD;
const HYSTERESIS_CENTS = TUNER_HYSTERESIS_CENTS;

const tunerState = {
  smoothedFrequency: 0,
  smoothedCents: 0,
  lastStatus: 'silent',
  lastStringIndex: -1,
  chordbookTuner: null,
  lastPitchResult: null
};

/**
 * 初始化 @chordbook/tuner
 * @param {Function} onPitchDetected - 音高检测回调
 */
export function initChordbookTuner(onPitchDetected) {
  // 停止旧实例（如果存在）
  if (tunerState.chordbookTuner) {
    try {
      tunerState.chordbookTuner.stop();
    } catch (e) {
      // 忽略 stop() 错误（@chordbook/tuner 的已知问题）
      console.warn('[Tuner] stop() error ignored:', e);
    }
    tunerState.chordbookTuner = null;
  }

  tunerState.chordbookTuner = createTuner({
    onNote: (note) => {
      // 将 @chordbook/tuner 的结果转换为内部格式
      const pitchResult = {
        frequency: note.frequency,
        clarity: note.clarity,
        cents: note.cents,
        noteName: note.name,
        octave: note.octave
      };
      tunerState.lastPitchResult = pitchResult;
      if (onPitchDetected) {
        onPitchDetected(pitchResult);
      }
    },
    // 专为吉他优化的参数（特别是低音弦）
    clarityThreshold: CONFIDENCE_THRESHOLD,
    minFrequency: TUNER_MIN_FREQ,
    maxFrequency: TUNER_MAX_FREQ,
    updateInterval: TUNER_UPDATE_INTERVAL,
    bufferSize: TUNER_BUFFER_SIZE,
    smoothingTimeConstant: TUNER_SMOOTHING_CONSTANT
  });

  return tunerState.chordbookTuner;
}

/**
 * 启动调音器监听
 */
export function startChordbookTuner() {
  if (tunerState.chordbookTuner) {
    tunerState.chordbookTuner.start();
  }
}

/**
 * 停止调音器监听
 */
export function stopChordbookTuner() {
  if (tunerState.chordbookTuner) {
    try {
      tunerState.chordbookTuner.stop();
    } catch (e) {
      // 忽略 stop() 错误（@chordbook/tuner 的已知问题）
      console.warn('[Tuner] stop() error ignored:', e);
    }
    tunerState.chordbookTuner = null;
  }
}

/**
 * 重置调音器平滑状态
 */
export function resetTunerState() {
  tunerState.smoothedFrequency = 0;
  tunerState.smoothedCents = 0;
  tunerState.lastStatus = 'silent';
  tunerState.lastStringIndex = -1;
  tunerState.lastPitchResult = null;
}

/**
 * 指数加权移动平均（EWMA）平滑频率
 */
function smoothFrequency(newFreq) {
  if (newFreq <= 0) {
    tunerState.smoothedFrequency = 0;
    return 0;
  }

  if (tunerState.smoothedFrequency === 0) {
    tunerState.smoothedFrequency = newFreq;
    return newFreq;
  }

  tunerState.smoothedFrequency = EWMA_ALPHA * newFreq + (1 - EWMA_ALPHA) * tunerState.smoothedFrequency;
  return tunerState.smoothedFrequency;
}

/**
 * 平滑音分值
 */
function smoothCents(newCents) {
  if (tunerState.smoothedCents === 0 && newCents !== 0) {
    tunerState.smoothedCents = newCents;
    return newCents;
  }
  tunerState.smoothedCents = EWMA_ALPHA * newCents + (1 - EWMA_ALPHA) * tunerState.smoothedCents;
  return tunerState.smoothedCents;
}

/**
 * 带滞回的状态判断
 */
function getStatusWithHysteresis(absCents, currentStatus) {
  if (currentStatus === 'in-tune') {
    if (absCents > IN_TUNE_CENTS + HYSTERESIS_CENTS) {
      return 'out-of-tune';
    }
    return 'in-tune';
  } else {
    if (absCents <= IN_TUNE_CENTS) {
      return 'in-tune';
    }
    return 'out-of-tune';
  }
}

/**
 * 计算音分偏差
 */
export function calculateCents(detectedFreq, targetFreq) {
  if (detectedFreq <= 0 || targetFreq <= 0) return 0;
  return 1200 * Math.log2(detectedFreq / targetFreq);
}

/**
 * 识别当前弦（使用 @chordbook/tuner 的结果）
 * @param {number} frequency - 检测到的频率
 * @param {Object} options - {rms, confidence}
 * @returns {Object} 识别结果
 */
export function identifyString(frequency, options = {}) {
  const { rms = 0, confidence = 0 } = options;
  
  // 使用 @chordbook/tuner 的清晰度作为置信度
  const clarity = confidence || rms;
  
  if (clarity < CONFIDENCE_THRESHOLD || frequency <= 0) {
    return {
      stringName: '--',
      stringIndex: -1,
      targetFreq: 0,
      cents: 0,
      inTune: false,
      status: 'silent',
      shouldUpdate: false,
      detectedFreq: 0
    };
  }
  
  // 频率平滑
  const smoothedFreq = smoothFrequency(frequency);
  
  // 找最接近的弦
  let closestString = null;
  let minDiff = Infinity;
  
  for (let i = 0; i < STRING_NAMES.length; i++) {
    const freq = STRING_FREQUENCIES[STRING_NAMES[i]];
    const diff = Math.abs(smoothedFreq - freq);
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
      status: 'unknown',
      shouldUpdate: false,
      detectedFreq: 0
    };
  }
  
  // 计算音分偏差
  const rawCents = calculateCents(smoothedFreq, closestString.freq);
  const smoothedCentsValue = smoothCents(rawCents);
  const absCents = Math.abs(smoothedCentsValue);
  
  // 滞回状态判断
  const status = getStatusWithHysteresis(absCents, tunerState.lastStatus);
  tunerState.lastStatus = status;
  tunerState.lastStringIndex = closestString.index;
  
  return {
    stringName: closestString.name,
    stringDisplay: STRING_DISPLAY[closestString.index],
    stringIndex: closestString.index,
    targetFreq: closestString.freq,
    detectedFreq: smoothedFreq,
    cents: Math.round(smoothedCentsValue),
    inTune: status === 'in-tune',
    status: status,
    shouldUpdate: true,
    confidence: clarity,
    rms: clarity
  };
}

/**
 * 获取弦的显示名称
 */
export function getStringDisplay(stringName) {
  const index = STRING_NAMES.indexOf(stringName);
  return index >= 0 ? STRING_DISPLAY[index] : stringName;
}

/**
 * 获取状态颜色
 */
export function getStatusColor(status) {
  switch (status) {
    case 'in-tune': return '#2ed573';
    case 'out-of-tune': return '#ff4757';
    default: return '#888888';
  }
}

/**
 * 播放标准音（使用 SoundFont 钢弦吉他）
 */
export async function playReferenceTone(audioContext, stringIndex, duration = 2) {
  if (!audioContext || stringIndex < 0 || stringIndex >= STRING_NAMES.length) return;
  
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch (e) {
      console.warn('[Tuner] AudioContext resume 失败:', e);
      return;
    }
  }
  
  // MIDI 音符编号
  const note = GUITAR_MIDI_NOTES[stringIndex];
  
  // 使用 SoundFont 播放真实钢弦吉他音色
  if (window.guitarSoundfont) {
    try {
      window.guitarSoundfont.play(note, audioContext.currentTime, {
        duration: duration,
        gain: 1.0
      });
      return;
    } catch (e) {
      console.warn('[Tuner] SoundFont 播放失败，降级到正弦波:', e);
    }
  }
  
  // 降级到正弦波
  const frequency = STRING_FREQUENCIES[STRING_NAMES[stringIndex]];
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(REFERENCE_TONE_GAIN, audioContext.currentTime + 0.05);
  gainNode.gain.linearRampToValueAtTime(REFERENCE_TONE_GAIN, audioContext.currentTime + duration - 0.1);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// 导出常量
export { STRING_FREQUENCIES, STRING_NAMES, STRING_DISPLAY, IN_TUNE_CENTS, CLOSE_CENTS };
