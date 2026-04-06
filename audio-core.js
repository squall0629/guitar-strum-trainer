// 吉他扫弦练习助手 - 音频核心模块
// 功能：AudioContext 管理、麦克风输入、基础状态管理

// ========== 全局状态（音频相关） ==========
let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;

// 性能优化
let lastAnalyzeTime = 0;
const ANALYZE_INTERVAL = 33;

// DOM 元素引用
let volumeMeterFill = null;
let recorderCanvas = null;
let recorderCtx = null;
let recorderWaveformData = [];
const RECORDER_BUFFER_SIZE = 300;
let spectrumCanvas = null;
let spectrumCtx = null;
let spectrumHistory = [];
const SPECTRUM_HISTORY_SIZE = 60;

// 回调函数引用
let getActiveRhythmCallback = null;
let updateScoreRingCallback = null;
let detectStrumCallback = null;

// 调试模式
const DEBUG = false;

// ========== 音频处理核心 ==========
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
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;
    
    microphone = audioContext.createMediaStreamSource(stream);
    const micGain = audioContext.createGain();
    micGain.gain.value = 15.0;
    microphone.connect(micGain);
    micGain.connect(analyser);
    
    isListening = true;
    
    return true;
  } catch (err) {
    console.error('[AudioCore] 音频初始化失败:', err);
    return false;
  }
}

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

export function isListeningState() {
  return isListening;
}

// ========== 音频分析主循环 ==========
export function analyzeAudio(updateScoresCallback, drawRecorderWaveformCallback, drawSpectrumWaveformCallback, detectStrumCallback) {
  if (!isListening) return;
  
  const now = performance.now();
  const delta = now - lastAnalyzeTime;
  if (delta < ANALYZE_INTERVAL) {
    requestAnimationFrame(() => analyzeAudio(updateScoresCallback, drawRecorderWaveformCallback, drawSpectrumWaveformCallback, detectStrumCallback));
    return;
  }
  lastAnalyzeTime = now;
  
  const bufferLength = analyser.frequencyBinCount;
  const freqDataCache = new Uint8Array(bufferLength);
  const timeDataCache = new Uint8Array(bufferLength);
  
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
  
  if (volumeMeterFill) {
    const sensitivityLevel = window.getSensitivityLevel ? window.getSensitivityLevel() : 50;
    const sensitivityGain = 1 + (sensitivityLevel / 100);
    volumeMeterFill.style.width = Math.min(100, rms * sensitivityGain * 100) + '%';
  }
  
  if (drawRecorderWaveformCallback) {
    drawRecorderWaveformCallback(recorderCanvas, recorderCtx, recorderWaveformData, timeDataCache, rms, RECORDER_BUFFER_SIZE, 100, DEBUG);
  }
  
  if (drawSpectrumWaveformCallback) {
    drawSpectrumWaveformCallback(spectrumCanvas, spectrumCtx, freqDataCache, spectrumHistory, SPECTRUM_HISTORY_SIZE, 67, audioContext, DEBUG);
  }
  
  requestAnimationFrame(() => analyzeAudio(updateScoresCallback, drawRecorderWaveformCallback, drawSpectrumWaveformCallback, detectStrumCallback));
}

// ========== 初始化 ==========
export function initAudioEngine(options = {}) {
  volumeMeterFill = options.volumeMeterFill || null;
  recorderCanvas = options.recorderCanvas || null;
  recorderCtx = options.recorderCtx || null;
  spectrumCanvas = options.spectrumCanvas || null;
  spectrumCtx = options.spectrumCtx || null;
  getActiveRhythmCallback = options.getActiveRhythm || null;
  
  if (recorderCanvas) {
    setTimeout(() => {
      recorderCanvas.width = recorderCanvas.offsetWidth || 600;
      recorderCanvas.height = recorderCanvas.offsetHeight || 120;
    }, 100);
  }
  
  if (spectrumCanvas) {
    setTimeout(() => {
      spectrumCanvas.width = spectrumCanvas.offsetWidth || 600;
      spectrumCanvas.height = spectrumCanvas.offsetHeight || 120;
    }, 100);
  }
}

// ========== 导出音频上下文（用于和弦检测） ==========
export function getAudioContext() {
  return audioContext;
}

export function getAnalyser() {
  return analyser;
}
