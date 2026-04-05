// 吉他扫弦练习助手 - 音频分析引擎模块
// 功能：音频分析、扫弦检测、Spectral Flux Onset 检测、音色评分

// ========== 全局状态（音频相关） ==========
let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;

let currentMeasureStartTime = 0;
let currentMeasureStrums = [];
let lastMeasureScores = { rhythm: 0, tone: 0, dynamics: 0, total: 0 };
let lastScoredMeasureEnd = 0;

let measureHistory = { rhythm: [], tone: [], dynamics: [] };
const MAX_HISTORY = 4;
let detectedStrums = [];
let lastStrumTime = 0;
let expectedStrumIndex = 0;
let strumHistory = [];

let freqDataCache = null;
let timeDataCache = null;

// 性能优化
let lastAnalyzeTime = 0;
const ANALYZE_INTERVAL = 33;
let lastRecorderDrawTime = 0;
const RECORDER_DRAW_INTERVAL = 100;
let lastSpectrumDrawTime = 0;
const SPECTRUM_DRAW_INTERVAL = 67;
let lastStrumEventTime = 0;

// Spectral Flux
let previousSpectrum = null;
let fluxBuffer = [];
let fluxBufferSize = 43;
let fluxThreshold = 0;
let fluxPeakCooldown = 0;
const FLUX_COOLDOWN_FRAMES = 3;

// 灵敏度
let sensitivityLevel = 50;
let strumThreshold = 0.05;

// 节拍器相关
let metronomeEnabled = false;
let currentBPM = 70;
let metronomeInterval = null;
let metronomeBeat = 0;
let audioContextForMetronome = null;

// 演示播放相关
let _isPlayingDemo = false;
let demoTimeout = null;
let demoLoopCount = 0;
let currentDemoRhythmIndex = -1;
let playingCustomBtn = null;
let currentPlayingDemoBtn = null;

// 离屏 Canvas 缓冲
let spectrumOffscreenCanvas = null;
let spectrumOffscreenCtx = null;
let spectrumBackgroundDirty = true;
let lastSpectrumCanvasWidth = 0;
let lastSpectrumCanvasHeight = 0;

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

// 调试模式
const DEBUG = false;

// ========== 灵敏度更新 ==========
export function updateThreshold() {
  strumThreshold = 0.30 - (sensitivityLevel - 1) * (0.29 / 99);
  strumThreshold = Math.max(0.01, Math.min(0.30, strumThreshold));
  const thresholdDisplay = document.getElementById('thresholdDisplay');
  if (thresholdDisplay) thresholdDisplay.textContent = strumThreshold.toFixed(2);
}

export function setSensitivityLevel(level) {
  sensitivityLevel = level;
  updateThreshold();
}

export function getSensitivityLevel() {
  return sensitivityLevel;
}

export function setStrumThreshold(threshold) {
  strumThreshold = threshold;
}

export function getStrumThreshold() {
  return strumThreshold;
}

// ========== 演示状态 ==========
export function getIsPlayingDemo() {
  return _isPlayingDemo;
}

export function setIsPlayingDemo(val) {
  _isPlayingDemo = val;
}

export function stopDemo() {
  setIsPlayingDemo(false);
  if (demoTimeout) clearTimeout(demoTimeout);
  if (window.customRhythmCleanup) { clearTimeout(window.customRhythmCleanup); window.customRhythmCleanup = null; }
  demoLoopCount = 0;
  currentDemoRhythmIndex = -1;
  currentPlayingDemoBtn = null;
  
  const allDemoBtns = document.querySelectorAll('.btn-demo');
  allDemoBtns.forEach(btn => {
    if (btn && btn.classList) btn.classList.remove('playing');
    if (btn && btn.textContent !== undefined) btn.textContent = '🔊 试听演示';
  });
  
  const customPlayBtns = document.querySelectorAll('#customRhythmsList .btn-custom-play');
  customPlayBtns.forEach(btn => {
    if (btn.classList.contains('playing')) { btn.classList.remove('playing'); btn.textContent = '🔊 试听'; }
  });
  
  playingCustomBtn = null;
}

// ========== 节拍器 ==========
export function playMetronomeSound(frequency = 1000, duration = 0.05) {
  if (!audioContextForMetronome) audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContextForMetronome.state === 'suspended') audioContextForMetronome.resume().catch(err => console.warn(err));
  
  const oscillator = audioContextForMetronome.createOscillator();
  const gainNode = audioContextForMetronome.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContextForMetronome.destination);
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  gainNode.gain.setValueAtTime(0.3, audioContextForMetronome.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextForMetronome.currentTime + duration);
  oscillator.start(audioContextForMetronome.currentTime);
  oscillator.stop(audioContextForMetronome.currentTime + duration);
}

export function startMetronome() {
  if (metronomeInterval) clearInterval(metronomeInterval);
  const beatInterval = (60 / currentBPM) * 1000;
  metronomeBeat = 0;
  playMetronomeSound(1200, 0.05);
  triggerMetronomeDot(true);
  
  metronomeInterval = setInterval(() => {
    metronomeBeat++;
    const activeRhythm = getActiveRhythmCallback ? getActiveRhythmCallback(currentDemoRhythmIndex) : null;
    const beats = activeRhythm ? activeRhythm.beats : 4;
    const isAccent = metronomeBeat % beats === 0;
    playMetronomeSound(isAccent ? 1200 : 800, 0.05);
    triggerMetronomeDot(isAccent);
  }, beatInterval);
}

function triggerMetronomeDot(isAccent) {
  const metronomeDot = document.getElementById('metronomeDot');
  if (!metronomeDot) return;
  metronomeDot.classList.add('accent');
  setTimeout(() => metronomeDot.classList.remove('accent'), 150);
}

export function stopMetronome() {
  if (metronomeInterval) { clearInterval(metronomeInterval); metronomeInterval = null; }
}

export function setMetronomeEnabled(enabled) {
  metronomeEnabled = enabled;
}

export function isMetronomeEnabled() {
  return metronomeEnabled;
}

export function setCurrentBPM(bpm) {
  currentBPM = bpm;
}

export function getCurrentBPM() {
  return currentBPM;
}

// ========== 音频处理核心 ==========

export async function startListening() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('浏览器不支持麦克风访问');
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') throw new Error('麦克风访问需要 HTTPS 连接');
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: 0 } });
    
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
    detectedStrums = [];
    currentMeasureStrums = [];
    lastStrumTime = 0;
    currentMeasureStartTime = Date.now();
    expectedStrumIndex = 0;
    
    measureHistory = { rhythm: [], tone: [], dynamics: [] };
    lastMeasureScores = { rhythm: 0, tone: 0, dynamics: 0, total: 0 };
    lastScoredMeasureEnd = 0;
    
    previousSpectrum = null;
    fluxBuffer = [];
    fluxThreshold = 0;
    fluxPeakCooldown = 0;
    
    return true;
  } catch (err) {
    console.error('[AudioEngine] 音频初始化失败:', err);
    return false;
  }
}

export function stopListening() {
  isListening = false;
  stopMetronome();
  if (getIsPlayingDemo()) stopDemo();
  
  if (microphone) { microphone.mediaStream.getTracks().forEach(track => track.stop()); microphone.disconnect(); microphone = null; }
  if (audioContext) { audioContext.close(); audioContext = null; }
}

export function isListeningState() {
  return isListening;
}

export function getDetectedStrums() {
  return detectedStrums;
}

export function getCurrentMeasureStrums() {
  return currentMeasureStrums;
}

export function getMeasureHistory() {
  return measureHistory;
}

export function getLastMeasureScores() {
  return lastMeasureScores;
}

export function setLastMeasureScores(scores) {
  lastMeasureScores = scores;
}

export function getLastScoredMeasureEnd() {
  return lastScoredMeasureEnd;
}

export function setLastScoredMeasureEnd(time) {
  lastScoredMeasureEnd = time;
}

export function setCurrentMeasureStartTime(time) {
  currentMeasureStartTime = time;
}

export function getCurrentMeasureStartTime() {
  return currentMeasureStartTime;
}

export function setCurrentMeasureStrums(strums) {
  currentMeasureStrums = strums;
}

export function resetFluxState() {
  previousSpectrum = null;
  fluxBuffer = [];
  fluxThreshold = 0;
  fluxPeakCooldown = 0;
}

// ========== 音频分析主循环 ==========
export function analyzeAudio(updateScoresCallback, drawRecorderWaveformCallback, drawSpectrumWaveformCallback) {
  if (!isListening) return;
  
  const now = performance.now();
  const delta = now - lastAnalyzeTime;
  if (delta < ANALYZE_INTERVAL) { requestAnimationFrame(() => analyzeAudio(updateScoresCallback, drawRecorderWaveformCallback, drawSpectrumWaveformCallback)); return; }
  lastAnalyzeTime = now;
  
  const bufferLength = analyser.frequencyBinCount;
  if (!freqDataCache || freqDataCache.length !== bufferLength) {
    freqDataCache = new Uint8Array(bufferLength);
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
  
  if (volumeMeterFill) {
    const sensitivityGain = 1 + (sensitivityLevel / 100);
    volumeMeterFill.style.width = Math.min(100, rms * sensitivityGain * 100) + '%';
  }
  
  if (drawRecorderWaveformCallback) {
    drawRecorderWaveformCallback(recorderCanvas, recorderCtx, recorderWaveformData, timeDataCache, rms, RECORDER_BUFFER_SIZE, RECORDER_DRAW_INTERVAL, DEBUG);
  }
  
  if (drawSpectrumWaveformCallback) {
    drawSpectrumWaveformCallback(spectrumCanvas, spectrumCtx, freqDataCache, spectrumHistory, SPECTRUM_HISTORY_SIZE, SPECTRUM_DRAW_INTERVAL, audioContext, DEBUG);
  }
  
  detectStrum(freqDataCache, timeDataCache, rms);
  if (updateScoresCallback) updateScoresCallback();
  
  requestAnimationFrame(() => analyzeAudio(updateScoresCallback, drawRecorderWaveformCallback, drawSpectrumWaveformCallback));
}

// ========== Spectral Flux 计算 ==========
export function computeSpectralFlux(currentSpectrum, previousSpectrum) {
  if (!previousSpectrum || currentSpectrum.length !== previousSpectrum.length) return 0;
  let flux = 0;
  const sampleRate = audioContext ? audioContext.sampleRate : 44100;
  const binFrequency = sampleRate / 2048;
  const startBin = Math.max(0, Math.floor(80 / binFrequency));
  const endBin = Math.min(currentSpectrum.length, Math.ceil(1000 / binFrequency));
  for (let i = startBin; i < endBin; i++) {
    const diff = currentSpectrum[i] - previousSpectrum[i];
    if (diff > 0) flux += diff * diff;
  }
  return flux / (endBin - startBin);
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

export function detectFluxPeak(currentFlux, threshold) {
  if (fluxPeakCooldown > 0) { fluxPeakCooldown--; return false; }
  if (fluxBuffer.length < 3) return false;
  const prevFlux = fluxBuffer[fluxBuffer.length - 2];
  const prevPrevFlux = fluxBuffer[fluxBuffer.length - 3];
  const isRising = currentFlux > prevFlux && prevFlux > prevPrevFlux;
  const isAboveThreshold = currentFlux > threshold;
  const isSignificantPeak = currentFlux > prevFlux * 1.05;
  if (isRising && isAboveThreshold && isSignificantPeak) { fluxPeakCooldown = FLUX_COOLDOWN_FRAMES; return true; }
  return false;
}

// ========== Onset 检测 ==========
export function detectOnsetWithFlux(freqData, timeData, rms) {
  const now = Date.now();
  const currentFlux = computeSpectralFlux(freqData, previousSpectrum);
  
  if (previousSpectrum === null || previousSpectrum.length !== freqData.length) {
    previousSpectrum = new Uint8Array(freqData.length);
  }
  previousSpectrum.set(freqData);
  
  fluxBuffer.push(currentFlux);
  if (fluxBuffer.length > fluxBufferSize) fluxBuffer.shift();
  
  fluxThreshold = computeAdaptiveThreshold();
  const fluxPeak = detectFluxPeak(currentFlux, fluxThreshold);
  
  const rmsThreshold = strumThreshold * 1.5;
  const rmsOnset = rms > rmsThreshold;
  
  const baseMinInterval = 200;
  const minStrumInterval = Math.round(baseMinInterval * (120 / currentBPM));
  const timeSinceLastStrum = now - lastStrumTime;
  
  let onsetDetected = false;
  let confidence = 0;
  
  if (timeSinceLastStrum > minStrumInterval) {
    if (fluxPeak && rms > rmsThreshold * 0.5) { onsetDetected = true; confidence = 0.9; }
    else if (fluxPeak && rms > rmsThreshold * 0.3) { onsetDetected = true; confidence = 0.7; }
    else if (rmsOnset && !fluxPeak && timeSinceLastStrum > minStrumInterval * 1.5) { onsetDetected = true; confidence = 0.5; }
  }
  
  return { onset: onsetDetected, confidence, flux: currentFlux, threshold: fluxThreshold };
}

// ========== 扫弦检测 ==========
export function detectStrum(freqData, timeData, rms) {
  const now = Date.now();
  
  const highFreqStart = Math.floor(freqData.length * 0.6);
  let highFreqEnergy = 0;
  for (let i = highFreqStart; i < freqData.length; i++) highFreqEnergy += freqData[i];
  highFreqEnergy /= (freqData.length - highFreqStart);
  
  const onsetResult = detectOnsetWithFlux(freqData, timeData, rms);
  
  if (onsetResult.onset) {
    const strum = { time: now, amplitude: rms, tone: highFreqEnergy, interval: lastStrumTime > 0 ? now - lastStrumTime : 0, flux: onsetResult.flux, fluxThreshold: onsetResult.threshold, confidence: onsetResult.confidence };
    lastStrumEventTime = now;
    detectedStrums.push(strum);
    currentMeasureStrums.push(strum);
    lastStrumTime = now;
    if (detectedStrums.length > 20) detectedStrums.shift();
  }
  
  return onsetResult;
}

// ========== 音色评分 ==========
export function calculateToneScore(strum) {
  if (!strum) return 0;
  const tone = strum.tone;
  if (tone > 200) return Math.max(0, 100 - (tone - 200) * 0.5);
  if (tone > 150) return 85 + (200 - tone) * 0.3;
  if (tone > 60) return 90 + (150 - tone) * 0.1;
  return Math.max(0, 90 - (60 - tone) * 0.5);
}

// ========== 反馈提供 ==========
export function provideFeedback(strum, currentRhythm, getActiveRhythmFn) {
  const pattern = getActiveRhythmFn(currentRhythm);
  const expectedInterval = pattern.pattern[expectedStrumIndex];
  let feedback = '';
  
  if (strum.interval > 0) {
    const diff = strum.interval - expectedInterval;
    const percentDiff = (diff / expectedInterval) * 100;
    const absPercent = Math.abs(percentDiff);
    if (absPercent < 10) feedback = '✓ 完美! ';
    else if (absPercent < 25) feedback = (diff > 0 ? '⏱ 稍慢 ' : '⚡ 稍快 ') + Math.round(absPercent) + '% ';
    else feedback = (diff > 0 ? '⏱ 太慢 ' : '⚡ 太快 ') + Math.round(absPercent) + '% ';
  }
  
  if (strum.tone > 200) feedback += '🎵 音色略刺耳';
  else if (strum.tone > 150) feedback += '🎵 音色明亮';
  else if (strum.tone > 60) feedback += '🎵 音色正常';
  else feedback += '🎵 音色偏闷';
  
  if (strum.amplitude > 0.25) feedback += ' 💪 力度很好';
  else if (strum.amplitude > 0.15) feedback += ' 💪 力度适中';
  else feedback += ' 💪 力度偏弱';
  
  const feedbackMessage = document.getElementById('feedbackMessage');
  if (feedbackMessage) feedbackMessage.textContent = feedback;
  
  expectedStrumIndex = (expectedStrumIndex + 1) % pattern.pattern.length;
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
  
  updateThreshold();
}

// ========== 导出音频上下文（用于和弦检测） ==========
export function getAudioContext() {
  return audioContext;
}

export function getAnalyser() {
  return analyser;
}
