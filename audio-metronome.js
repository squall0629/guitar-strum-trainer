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
export function playMetronomeSound(frequency = METRONOME_NORMAL_FREQ, duration = METRONOME_DURATION) {
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
  
  gainNode.gain.setValueAtTime(METRONOME_GAIN, audioContextForMetronome.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextForMetronome.currentTime + duration);
  
  oscillator.start(audioContextForMetronome.currentTime);
  oscillator.stop(audioContextForMetronome.currentTime + duration);
}

// ========== 节拍器控制 ==========
/**
 * 启动节拍器
 * @param {Function} getActiveRhythmFn - 获取当前节奏型函数
 * @param {number} currentDemoRhythmIndex - 当前演示节奏型索引
 */
export function startMetronome(getActiveRhythmFn, currentDemoRhythmIndex = -1) {
  if (metronomeInterval) {
    clearInterval(metronomeInterval);
  }
  
  const currentBPM = AppState.getBPM();
  const beatInterval = (60 / currentBPM) * 1000;
  metronomeBeat = 0;
  
  // 首拍重音
  playMetronomeSound(METRONOME_ACCENT_FREQ, METRONOME_DURATION);
  triggerMetronomeDot(true);
  
  metronomeInterval = setInterval(() => {
    metronomeBeat++;
    const activeRhythm = getActiveRhythmFn ? getActiveRhythmFn(currentDemoRhythmIndex) : null;
    const beats = activeRhythm ? activeRhythm.beats : 4;
    const isAccent = metronomeBeat % beats === 0; // 每小节第一拍重音
    
    playMetronomeSound(isAccent ? METRONOME_ACCENT_FREQ : METRONOME_NORMAL_FREQ, METRONOME_DURATION);
    triggerMetronomeDot(isAccent);
  }, beatInterval);
}

function triggerMetronomeDot(isAccent) {
  const metronomeDot = document.getElementById('metronomeDot');
  if (!metronomeDot) return;
  
  // 清理之前的定时器，防止泄漏
  if (metronomeDotTimeout) {
    clearTimeout(metronomeDotTimeout);
  }
  
  metronomeDot.classList.add('accent');
  metronomeDotTimeout = setTimeout(() => {
    metronomeDot.classList.remove('accent');
    metronomeDotTimeout = null;
  }, METRONOME_DOT_TIMEOUT);
}

/**
 * 停止节拍器
 */
export function stopMetronome() {
  if (metronomeInterval) {
    clearInterval(metronomeInterval);
    metronomeInterval = null;
  }
  // 清理指示灯定时器
  if (metronomeDotTimeout) {
    clearTimeout(metronomeDotTimeout);
    metronomeDotTimeout = null;
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
