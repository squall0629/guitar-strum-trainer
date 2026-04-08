// 吉他扫弦练习助手 - 试听演示模块
// 功能：吉他音源加载、扫弦声音播放、演示播放

import { playMetronomeSound, getCurrentBPM } from './audio-metronome.js';
import { DEBUG } from './constants.js';

// ========== 吉他音源（用于试听演示） ==========
let guitarSoundfont = null;
let soundfontLoading = false;
let soundfontLoaded = false;
let sharedAudioContext = null;

// 演示播放相关
let _isPlayingDemo = false;
let demoTimeout = null;
let demoLoopCount = 0;
let currentDemoRhythmIndex = -1;
let playingCustomBtn = null;
let currentPlayingDemoBtn = null;

// ========== 调试模式（从 constants.js 导入） ==========
// DEBUG 已从 constants.js 导入，直接使用

// ========== 演示状态 ==========
/**
 * 获取是否正在播放演示
 * @returns {boolean} 是否正在播放
 */
export function getIsPlayingDemo() {
  return _isPlayingDemo;
}

/**
 * 设置演示播放状态
 * @param {boolean} val - 是否正在播放
 */
export function setIsPlayingDemo(val) {
  _isPlayingDemo = val;
}

/**
 * 停止演示播放
 */
export function stopDemo() {
  setIsPlayingDemo(false);
  if (demoTimeout) clearTimeout(demoTimeout);
  if (window.customRhythmCleanup) {
    clearTimeout(window.customRhythmCleanup);
    window.customRhythmCleanup = null;
  }
  demoLoopCount = 0;
  currentDemoRhythmIndex = -1;
  currentPlayingDemoBtn = null;
  window.currentPlayingDemoBtn = null;
  
  const allDemoBtns = document.querySelectorAll('.btn-demo');
  allDemoBtns.forEach(btn => {
    if (btn && btn.classList) btn.classList.remove('playing');
    if (btn && btn.textContent !== undefined) btn.textContent = '🔊 试听演示';
  });
  
  const customPlayBtns = document.querySelectorAll('#customRhythmsList .btn-custom-play');
  customPlayBtns.forEach(btn => {
    if (btn.classList.contains('playing')) {
      btn.classList.remove('playing');
      btn.textContent = '🔊 试听';
    }
  });
  
  playingCustomBtn = null;
}

// ========== 吉他音源加载 ==========

/**
 * 加载钢弦吉他音源（用于调音器标准音播放）
 */
export async function loadGuitarSoundfont() {
  if (soundfontLoading || soundfontLoaded) return;
  soundfontLoading = true;
  
  console.log('[AudioDemo] 开始加载钢弦吉他音源...');
  
  try {
    if (typeof window.Soundfont === 'undefined') {
      console.warn('[AudioDemo] Soundfont 未加载，跳过');
      soundfontLoading = false;
      return;
    }
    
    // 创建共享 AudioContext
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // 加载钢弦吉他音源
    guitarSoundfont = await window.Soundfont.instrument(sharedAudioContext, 'acoustic_guitar_steel', {
      soundfont: 'FluidR3_GM',
      gain: 1.5
    });
    
    soundfontLoaded = true;
    
    // 暴露到全局
    window.guitarSoundfont = guitarSoundfont;
    window.guitarAudioContext = sharedAudioContext;
    
    console.log('[AudioDemo] ✓ 钢弦吉他音源加载完成');
  } catch (error) {
    console.error('[AudioDemo] 音源加载失败:', error);
    soundfontLoading = false;
  }
}

// ========== 播放扫弦声音（使用真实吉他音源） ==========
/**
 * 播放扫弦声音
 * @param {string} direction - 扫弦方向 ('D' 下扫, 'U' 上扫)
 * @param {number} duration - 持续时间 (秒)
 * @param {Array} noteVelocities - 各弦力度数组
 * @returns {Promise<void>}
 */
export async function playStrumSound(direction, duration = 0.15, noteVelocities = null) {
  if (!guitarSoundfont) {
    await playStrumSoundSynth(direction, duration);
    return;
  }
  
  const ctx = guitarSoundfont.context;
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  
  const bassNotes = ['E3', 'B3', 'E4'];
  const trebleNotes = ['G#4', 'B4', 'E5'];
  const isDownStrum = direction === 'D';
  
  const bassOrder = isDownStrum ? [...bassNotes] : [...bassNotes].reverse();
  const trebleOrder = isDownStrum ? [...trebleNotes] : [...trebleNotes].reverse();
  
  const bassStrumSpeed = isDownStrum ? 0.008 : 0.012;
  const trebleStrumSpeed = isDownStrum ? 0.004 : 0.006;
  
  let bassVelocity, trebleVelocity;
  if (noteVelocities && Array.isArray(noteVelocities) && noteVelocities.length >= 6) {
    bassVelocity = noteVelocities[0];
    trebleVelocity = noteVelocities[3];
  } else {
    bassVelocity = isDownStrum ? 1.0 : 0.6;
    trebleVelocity = isDownStrum ? 0.3 : 0.2;
  }
  
  const now = ctx.currentTime;
  let currentTime = now;
  
  bassOrder.forEach((note, index) => {
    const delay = index * bassStrumSpeed;
    const randomVelocity = bassVelocity * (0.9 + Math.random() * 0.2);
    guitarSoundfont.play(note, currentTime + delay, { gain: randomVelocity, duration });
  });
  
  const trebleDelay = bassNotes.length * bassStrumSpeed + 0.015;
  trebleOrder.forEach((note, index) => {
    const delay = trebleDelay + (index * trebleStrumSpeed);
    const randomVelocity = trebleVelocity * (0.9 + Math.random() * 0.2);
    guitarSoundfont.play(note, currentTime + delay, { gain: randomVelocity, duration });
  });
}

// ========== 播放扫弦声音（合成器 fallback） ==========
async function playStrumSoundSynth(direction, duration = 0.15) {
  let audioContextForMetronome = null;
  if (!window.audioContextForMetronome) {
    window.audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
  }
  audioContextForMetronome = window.audioContextForMetronome;
  
  if (audioContextForMetronome.state === 'suspended') {
    try {
      await audioContextForMetronome.resume();
    } catch (err) {
      if (DEBUG) console.error('[playStrumSoundSynth] AudioContext resume 失败:', err);
      return;
    }
  }
  
  const ctx = audioContextForMetronome;
  const now = ctx.currentTime;
  const baseChord = [164.81, 246.94, 329.63, 415.30, 493.88, 659.25];
  const isDownStrum = direction === 'D';
  const strumDelay = isDownStrum ? 0.008 : 0.012;
  const brightness = isDownStrum ? 1.0 : 0.7;
  const attackTime = 0.005;
  const decayTime = 0.08;
  const sustainLevel = 0.3;
  const releaseTime = duration * 0.6;
  
  const baseVolume = 0.25 * brightness;
  const harmonic2Volume = 0.08 * brightness;
  
  baseChord.forEach((baseFreq, stringIndex) => {
    const jitter = 1 + (Math.random() - 0.5) * 0.01;
    const freq = baseFreq * jitter;
    const startTime = now + (stringIndex * strumDelay);
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    
    try {
      osc1.type = 'triangle';
      osc1.frequency.value = freq;
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      osc2.type = 'sawtooth';
      osc2.frequency.value = freq * 2.0;
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      const peakTime = startTime + attackTime;
      const sustainTime = startTime + attackTime + decayTime;
      const endTime = startTime + duration;
      
      gain1.gain.setValueAtTime(0.001, startTime);
      gain1.gain.linearRampToValueAtTime(baseVolume, peakTime);
      gain1.gain.exponentialRampToValueAtTime(baseVolume * sustainLevel, sustainTime);
      gain1.gain.setValueAtTime(baseVolume * sustainLevel, endTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, endTime + releaseTime);
      
      gain2.gain.setValueAtTime(0.001, startTime);
      gain2.gain.linearRampToValueAtTime(harmonic2Volume, peakTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, sustainTime + releaseTime * 0.5);
      
      osc1.start(startTime);
      osc1.stop(endTime + releaseTime + 0.01);
      osc2.start(startTime);
      osc2.stop(sustainTime + releaseTime * 0.5 + 0.01);
      
      osc1.onended = () => { osc1.disconnect(); gain1.disconnect(); };
      osc2.onended = () => { osc2.disconnect(); gain2.disconnect(); };
    } catch (err) {
      if (DEBUG) console.error('[playStrumSoundSynth] 播放失败:', err);
    }
  });
}

// ========== 试听演示功能（完整版） ==========
/**
 * 播放节奏型演示
 * @param {number} rhythmIndex - 节奏型索引
 * @param {HTMLElement} btn - 播放按钮元素
 * @param {Function} getActiveRhythmFn - 获取节奏型函数
 * @returns {Promise<void>}
 */
export async function playDemo(rhythmIndex, btn, getActiveRhythmFn) {
  if (!btn || !getActiveRhythmFn) return;
  
  // 如果正在播放其他演示，先停止
  if (_isPlayingDemo) {
    stopDemo();
  }
  
  const rhythm = getActiveRhythmFn(rhythmIndex);
  if (!rhythm || !rhythm.pattern || !rhythm.demo) return;
  
  setIsPlayingDemo(true);
  currentDemoRhythmIndex = rhythmIndex;
  currentPlayingDemoBtn = btn;
  window.currentPlayingDemoBtn = btn;
  
  // 更新按钮状态
  if (btn.classList) btn.classList.add('playing');
  if (btn.textContent !== undefined) btn.textContent = '⏹ 停止演示';
  
  let noteIndex = 0;
  
  async function playNextNote() {
    if (!_isPlayingDemo) return;
    
    const direction = rhythm.demo[noteIndex % rhythm.demo.length];
    try {
      if (rhythm.isCustom && rhythm.notes && rhythm.notes[noteIndex % rhythm.notes.length]) {
        const noteData = rhythm.notes[noteIndex % rhythm.notes.length];
        await playStrumSound(direction, 0.15, [
          noteData.velocity,
          noteData.velocity,
          noteData.velocity,
          noteData.velocity,
          noteData.velocity,
          noteData.velocity
        ]);
      } else {
        await playStrumSound(direction);
      }
    } catch (err) {
      if (DEBUG) console.error('[playDemo] 播放失败:', err);
    }
    
    const baseBPM = 120;
    const patternDuration = rhythm.pattern[noteIndex % rhythm.pattern.length];
    const intervalMs = patternDuration * (baseBPM / getCurrentBPM());
    
    noteIndex++;
    demoTimeout = setTimeout(playNextNote, intervalMs);
  }
  
  playNextNote();
}
