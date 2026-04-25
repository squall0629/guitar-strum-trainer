// 吉他扫弦练习助手 - 节拍器模块
// 功能：节拍器声音生成、节奏控制、BPM 管理

// 导入常量
import {
  DEFAULT_BPM,
  METRONOME_ACCENT_FREQ,
  METRONOME_NORMAL_FREQ,
  METRONOME_DURATION,
  METRONOME_GAIN,
  METRONOME_DOT_TIMEOUT,
  DEBUG
} from './constants.js';

import { AppState } from './state-manager.js';

// 调试模式（使用 constants.js 中的 DEBUG）

let audioContextForMetronome = null;
let metronomeEnabled = false;
let metronomeInterval = null;
let metronomeBeat = 0;
let metronomeDotTimeout = null;  // 追踪节拍器指示灯定时器
let metronomeNextBeatTime = 0;
let metronomeSchedulerActive = false;
let metronomeVisualTimers = [];

const METRONOME_LOOKAHEAD_MS = 25;
const METRONOME_SCHEDULE_AHEAD_TIME = 0.1;

// 导出所有定时器 ID 以便统一清理
export function getMetronomeTimers() {
  return { metronomeInterval, metronomeDotTimeout };
}

// ========== 节拍器声音生成 ==========
/**
 * 播放节拍器声音
 * @param {number} frequency - 频率 (Hz)
 * @param {number} duration - 持续时间 (秒)
 */
export function playMetronomeSound(frequency = METRONOME_NORMAL_FREQ, duration = METRONOME_DURATION, startTime = null) {
  if (!audioContextForMetronome) {
    audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContextForMetronome.state === 'suspended') {
    audioContextForMetronome.resume().catch(err => { if (DEBUG) console.warn(err); });
  }
  
  const oscillator = audioContextForMetronome.createOscillator();
  const gainNode = audioContextForMetronome.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContextForMetronome.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  const playTime = typeof startTime === 'number'
    ? Math.max(startTime, audioContextForMetronome.currentTime)
    : audioContextForMetronome.currentTime;
  
  gainNode.gain.setValueAtTime(METRONOME_GAIN, playTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, playTime + duration);
  
  oscillator.start(playTime);
  oscillator.stop(playTime + duration);
}

// ========== 节拍器控制 ==========
/**
 * 启动节拍器
 * @param {Function} getActiveRhythmFn - 获取当前节奏型函数
 * @param {number} currentDemoRhythmIndex - 当前演示节奏型索引
 */
export function startMetronome(getActiveRhythmFn, currentDemoRhythmIndex = -1) {
  stopMetronome();
  ensureMetronomeContext();
  metronomeBeat = 0;
  metronomeSchedulerActive = true;
  metronomeNextBeatTime = audioContextForMetronome.currentTime + 0.05;

  const scheduler = () => {
    if (!metronomeSchedulerActive || !audioContextForMetronome) return;

    while (metronomeNextBeatTime < audioContextForMetronome.currentTime + METRONOME_SCHEDULE_AHEAD_TIME) {
      const activeRhythm = getActiveRhythmFn ? getActiveRhythmFn(currentDemoRhythmIndex) : null;
      const beats = activeRhythm ? activeRhythm.beats : 4;
      const isAccent = metronomeBeat % beats === 0;

      scheduleMetronomeBeat(metronomeNextBeatTime, isAccent);
      metronomeBeat++;
      metronomeNextBeatTime += 60 / AppState.getBPM();
    }

    metronomeInterval = setTimeout(scheduler, METRONOME_LOOKAHEAD_MS);
  };

  scheduler();
}

function ensureMetronomeContext() {
  if (!audioContextForMetronome) {
    audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContextForMetronome.state === 'suspended') {
    audioContextForMetronome.resume().catch(err => { if (DEBUG) console.warn(err); });
  }
}

function scheduleMetronomeBeat(beatTime, isAccent) {
  playMetronomeSound(
    isAccent ? METRONOME_ACCENT_FREQ : METRONOME_NORMAL_FREQ,
    METRONOME_DURATION,
    beatTime
  );
  triggerMetronomeDot(isAccent, beatTime);
}

function triggerMetronomeDot(isAccent, beatTime = null) {
  const metronomeDot = document.getElementById('metronomeDot');
  if (!metronomeDot || !audioContextForMetronome) return;

  const delay = beatTime
    ? Math.max(0, (beatTime - audioContextForMetronome.currentTime) * 1000)
    : 0;

  const triggerTimer = setTimeout(() => {
    metronomeVisualTimers = metronomeVisualTimers.filter(timerId => timerId !== triggerTimer);
    if (!metronomeSchedulerActive && beatTime !== null) return;

    if (metronomeDotTimeout) {
      clearTimeout(metronomeDotTimeout);
    }

    metronomeDot.classList.add('accent');
    metronomeDotTimeout = setTimeout(() => {
      metronomeDot.classList.remove('accent');
      metronomeDotTimeout = null;
    }, METRONOME_DOT_TIMEOUT);
  }, delay);

  metronomeVisualTimers.push(triggerTimer);
}

/**
 * 停止节拍器
 */
export function stopMetronome() {
  metronomeSchedulerActive = false;
  if (metronomeInterval) {
    clearTimeout(metronomeInterval);
    metronomeInterval = null;
  }
  if (metronomeVisualTimers.length > 0) {
    metronomeVisualTimers.forEach(timerId => clearTimeout(timerId));
    metronomeVisualTimers = [];
  }
  // 清理指示灯定时器
  if (metronomeDotTimeout) {
    clearTimeout(metronomeDotTimeout);
    metronomeDotTimeout = null;
  }
  const metronomeDot = document.getElementById('metronomeDot');
  if (metronomeDot) {
    metronomeDot.classList.remove('accent');
  }
}

/**
 * 统一清理所有节拍器定时器（用于应用卸载时）
 */
export function cleanupAllMetronomeTimers() {
  stopMetronome();
  if (audioContextForMetronome && audioContextForMetronome.state !== 'closed') {
    try {
      audioContextForMetronome.close();
    } catch (e) {
      console.warn('[Metronome] AudioContext 清理失败:', e);
    }
    audioContextForMetronome = null;
  }
}

/**
 * 设置节拍器启用状态
 * @param {boolean} enabled - 是否启用
 */
export function setMetronomeEnabled(enabled) {
  metronomeEnabled = enabled;
}

/**
 * 获取节拍器启用状态
 * @returns {boolean} 是否启用
 */
export function isMetronomeEnabled() {
  return metronomeEnabled;
}

/**
 * 设置当前 BPM
 * @param {number} bpm - BPM 值
 */
export function setCurrentBPM(bpm) {
  AppState.setBPM(bpm);
}

/**
 * 获取当前 BPM
 * @returns {number} BPM 值
 */
export function getCurrentBPM() {
  return AppState.getBPM();
}
