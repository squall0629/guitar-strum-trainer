// 吉他扫弦练习助手 - 音频核心模块
// 功能：AudioContext 管理、麦克风输入、基础状态管理

// 导入常量
import {
  ANALYZE_INTERVAL,
  RECORDER_BUFFER_SIZE,
  SPECTRUM_HISTORY_SIZE,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  FFT_SIZE,
  ANALYSER_SMOOTHING,
  MIC_GAIN,
  SPECTRUM_DRAW_INTERVAL,
  DEBUG
} from './constants.js';

// ========== 全局状态（音频相关） ==========
let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;

// 性能优化
let lastAnalyzeTime = 0;

// DOM 元素引用
let volumeMeterFill = null;
let recorderCanvas = null;
let recorderCtx = null;
let recorderWaveformData = [];
let spectrumCanvas = null;
let spectrumCtx = null;
let spectrumHistory = [];

// 音频分析缓存（避免每帧分配）
let freqDataCache = null;
let timeDataCache = null;

// 回调函数引用
let getActiveRhythmCallback = null;
let updateScoreRingCallback = null;
let detectStrumCallback = null;

// ========== 音频处理核心 ==========
/**
 * 启动音频监听（麦克风输入）
 * @returns {Promise<boolean>} 是否成功启动
 */
export async function startListening() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('浏览器不支持麦克风访问');
    }
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      throw new Error('麦克风访问需要 HTTPS 连接');
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0
      }
    });
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
    
    microphone = audioContext.createMediaStreamSource(stream);
    const micGain = audioContext.createGain();
    micGain.gain.value = MIC_GAIN;
    microphone.connect(micGain);
    micGain.connect(analyser);
    
    isListening = true;
    
    return true;
  } catch (err) {
    if (DEBUG) console.error('[AudioCore] 音频初始化失败:', err);
    return false;
  }
}

/**
 * 停止音频监听
 */
export function stopListening() {
  isListening = false;
  
  if (microphone) {
    microphone.mediaStream.getTracks().forEach(track => track.stop());
    microphone.disconnect();
    microphone = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

/**
 * 获取当前监听状态
 * @returns {boolean} 是否正在监听
 */
export function isListeningState() {
  return isListening;
}

// ========== 音频分析主循环 ==========
/**
 * 音频分析主循环
 * @param {Function} updateScoresCallback - 更新评分回调
 * @param {Function} drawRecorderWaveformCallback - 绘制波形回调
 * @param {Function} drawSpectrumWaveformCallback - 绘制频谱回调
 * @param {Function} detectStrumCallback - 扫弦检测回调
 * @param {Function} tunerCallback - 调音器回调
 */
export function analyzeAudio(updateScoresCallback, drawRecorderWaveformCallback, drawSpectrumWaveformCallback, detectStrumCallback, tunerCallback) {
  if (!isListening) return;
  
  const now = performance.now();
  const delta = now - lastAnalyzeTime;
  if (delta < ANALYZE_INTERVAL) {
    requestAnimationFrame(() => analyzeAudio(updateScoresCallback, drawRecorderWaveformCallback, drawSpectrumWaveformCallback, detectStrumCallback, tunerCallback));
    return;
  }
  lastAnalyzeTime = now;
  
  // 初始化缓存（首次调用时）
  const bufferLength = analyser.frequencyBinCount;
  if (!freqDataCache || freqDataCache.length !== bufferLength) {
    freqDataCache = new Uint8Array(bufferLength);
  }
  if (!timeDataCache || timeDataCache.length !== bufferLength) {
    timeDataCache = new Uint8Array(bufferLength);
  }
  
  analyser.getByteFrequencyData(freqDataCache);
  analyser.getByteTimeDomainData(timeDataCache);
  
  let sum = 0;
  for (let i = 0; i < timeDataCache.length; i++) {
    const normalized = (timeDataCache[i] - 128) / 128;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / timeDataCache.length);
  
  // 调用扫弦检测
  if (detectStrumCallback) {
    detectStrumCallback(freqDataCache, timeDataCache, rms);
  }
  
  // 调用调音器检测（如果启用）
  if (tunerCallback) {
    tunerCallback(timeDataCache, audioContext.sampleRate);
  }
  
  // 调用小节评分更新（每帧检查）
  if (updateScoresCallback) {
    updateScoresCallback();
  }
  
  if (volumeMeterFill) {
    const sensitivityLevel = window.getSensitivityLevel ? window.getSensitivityLevel() : 50;
    const sensitivityGain = 1 + (sensitivityLevel / 100);
    volumeMeterFill.style.width = Math.min(100, rms * sensitivityGain * 100) + '%';
  }
  
  if (drawRecorderWaveformCallback) {
    drawRecorderWaveformCallback(recorderCanvas, recorderCtx, recorderWaveformData, timeDataCache, rms, RECORDER_BUFFER_SIZE, 100, DEBUG);
  }
  
  if (drawSpectrumWaveformCallback) {
    drawSpectrumWaveformCallback(spectrumCanvas, spectrumCtx, freqDataCache, spectrumHistory, SPECTRUM_HISTORY_SIZE, SPECTRUM_DRAW_INTERVAL, audioContext, DEBUG);
  }
  
  requestAnimationFrame(() => analyzeAudio(updateScoresCallback, drawRecorderWaveformCallback, drawSpectrumWaveformCallback, detectStrumCallback));
}

// ========== 初始化 ==========
/**
 * 初始化音频引擎
 * @param {Object} options - 配置选项
 * @param {HTMLElement} options.volumeMeterFill - 音量指示条元素
 * @param {HTMLCanvasElement} options.recorderCanvas - 录音波形 Canvas
 * @param {CanvasRenderingContext2D} options.recorderCtx - 录音波形 Context
 * @param {HTMLCanvasElement} options.spectrumCanvas - 频谱 Canvas
 * @param {CanvasRenderingContext2D} options.spectrumCtx - 频谱 Context
 * @param {Function} options.getActiveRhythm - 获取当前节奏型函数
 * @returns {void}
 */
export function initAudioEngine(options = {}) {
  volumeMeterFill = options.volumeMeterFill || null;
  recorderCanvas = options.recorderCanvas || null;
  recorderCtx = options.recorderCtx || null;
  spectrumCanvas = options.spectrumCanvas || null;
  spectrumCtx = options.spectrumCtx || null;
  getActiveRhythmCallback = options.getActiveRhythm || null;
  
  if (recorderCanvas) {
    setTimeout(() => {
      recorderCanvas.width = recorderCanvas.offsetWidth || DEFAULT_CANVAS_WIDTH;
      recorderCanvas.height = recorderCanvas.offsetHeight || DEFAULT_CANVAS_HEIGHT;
    }, 100);
  }
  
  if (spectrumCanvas) {
    setTimeout(() => {
      spectrumCanvas.width = spectrumCanvas.offsetWidth || DEFAULT_CANVAS_WIDTH;
      spectrumCanvas.height = spectrumCanvas.offsetHeight || DEFAULT_CANVAS_HEIGHT;
    }, 100);
  }
}

// ========== 导出音频上下文（用于和弦检测） ==========
/**
 * 获取 AudioContext 实例
 * @returns {AudioContext|null} AudioContext 实例
 */
export function getAudioContext() {
  return audioContext;
}

/**
 * 获取 AnalyserNode 实例
 * @returns {AnalyserNode|null} AnalyserNode 实例
 */
export function getAnalyser() {
  return analyser;
}
