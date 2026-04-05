// 吉他扫弦练习助手 - 核心音频分析引擎 v2.1
// 模块化重构版本 - 核心逻辑

// ========== 模块导入 ==========
import { saveUserSettings, loadUserSettings, saveHistory, loadHistoryFromStorage, exportUserSettings, importUserSettings } from './storage.js';
import { calculateStabilityScore, getMeasureDuration, checkMeasureUpdate, updateScores, calculateRhythmScore, calculateToneScore, calculateDynamicsScore, updateStabilityScores } from './scoring.js';
import { drawRecorderWaveform, drawSpectrumWaveform, updateScoreRing, drawChordDiagram, drawChordDiagramFallbackSVG, updateChordRecognition, updateTransitionTime } from './ui-renderer.js';

// ========== 和弦识别模块 ==========
let chordDetector = null;
let transitionDetector = null;
let currentTrainingMode = 'preset';
let currentProgression = [];
let currentChordIndex = 0;
let expectedChord = null;
let nextChord = null;
let chordRecognitionEnabled = false;
let lastRecognizedChord = null;
let chordChangeTimeout = null;

let practiceMode = 'rhythm';
let practiceStartTime = 0;
let practiceChordCorrect = 0;
let practiceChordTotal = 0;
let practiceTransitionTimes = [];

// ========== 真实吉他音源 ==========
let guitarSoundfont = null;
let guitarInstrument = null;
let soundfontLoading = false;
let soundfontLoaded = false;

// 节奏型定义
const RHYTHM_PATTERNS = [
  { name: '前八后十六', pattern: [250, 125, 125], beats: 4, description: '↓ ↓↑', demo: ['D', 'D', 'U'] },
  { name: '前十六后八', pattern: [125, 125, 250], beats: 4, description: '↓↑ ↓', demo: ['D', 'U', 'D'] },
  { name: '民谣常用', pattern: [250, 125, 125, 125, 125, 250], beats: 4, description: '↓ ↓↑↓↑ ↓', demo: ['D', 'D', 'U', 'D', 'U', 'D'] },
  { name: '摇滚八分', pattern: [125, 125, 125, 125, 125, 125, 125, 125], beats: 4, description: '↓↑ ↓↑ ↓↑ ↓↑', demo: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'] },
  { name: '华尔兹', pattern: [333, 167, 167, 333, 167, 167], beats: 3, description: '↓ ↑↑ ↓ ↑↑', demo: ['D', 'U', 'U', 'D', 'U', 'U'] }
];

// 自定义节奏型
let customRhythms = [];
let editingRhythmIndex = -1;
let currentNoteSequence = [];

const NOTE_DURATIONS = {
  'whole': { name: '全音符', ms: 2000 },
  'half': { name: '二分音符', ms: 1000 },
  'quarter': { name: '四分音符', ms: 500 },
  '8th': { name: '八分音符', ms: 250 },
  '16th': { name: '十六分音符', ms: 125 }
};

const PRESET_TEMPLATES = {
  '8th-16th': { name: '前八后十六', notes: [{ duration: '8th', direction: 'D', velocity: 1.0 }, { duration: '16th', direction: 'D', velocity: 0.6 }, { duration: '16th', direction: 'U', velocity: 0.3 }] },
  '16th-8th': { name: '前十六后八', notes: [{ duration: '16th', direction: 'D', velocity: 0.6 }, { duration: '16th', direction: 'U', velocity: 0.3 }, { duration: '8th', direction: 'D', velocity: 1.0 }] },
  'folk': { name: '民谣常用', notes: [{ duration: '8th', direction: 'D', velocity: 1.0 }, { duration: '8th', direction: 'D', velocity: 1.0 }, { duration: '16th', direction: 'U', velocity: 0.3 }, { duration: '16th', direction: 'D', velocity: 0.6 }, { duration: '16th', direction: 'U', velocity: 0.3 }, { duration: '16th', direction: 'D', velocity: 0.6 }] },
  'rock': { name: '摇滚八分', notes: [{ duration: '8th', direction: 'D', velocity: 0.8 }, { duration: '8th', direction: 'U', velocity: 0.5 }, { duration: '8th', direction: 'D', velocity: 0.8 }, { duration: '8th', direction: 'U', velocity: 0.5 }, { duration: '8th', direction: 'D', velocity: 0.8 }, { duration: '8th', direction: 'U', velocity: 0.5 }, { duration: '8th', direction: 'D', velocity: 0.8 }, { duration: '8th', direction: 'U', velocity: 0.5 }] }
};

// 获取当前激活的节奏型
function getActiveRhythm(index) {
  if (index >= 0 && index < RHYTHM_PATTERNS.length) {
    return RHYTHM_PATTERNS[index];
  }
  const customIndex = index - RHYTHM_PATTERNS.length;
  if (customIndex >= 0 && customIndex < customRhythms.length) {
    const rhythm = customRhythms[customIndex];
    if (!rhythm.notes || rhythm.notes.length === 0) return null;
    
    const tempPattern = rhythm.notes.map(note => NOTE_DURATIONS[note.duration]?.ms || 250);
    const tempDemo = rhythm.notes.map(note => note.direction);
    
    const tempDescription = (() => {
      let result = rhythm.notes[0].direction === 'D' ? '↓' : '↑';
      for (let i = 1; i < rhythm.notes.length; i++) {
        const prevDuration = rhythm.notes[i - 1].duration;
        const currDuration = rhythm.notes[i].duration;
        const arrow = rhythm.notes[i].direction === 'D' ? '↓' : '↑';
        const isPrevShort = prevDuration === '16th';
        const isCurrShort = currDuration === '16th';
        if (isPrevShort && isCurrShort) result += arrow;
        else if (isPrevShort || isCurrShort) result += ' ' + arrow;
        else result += '  ' + arrow;
      }
      return result;
    })();
    
    return { name: rhythm.name, pattern: tempPattern, beats: 4, description: tempDescription, demo: tempDemo, isCustom: true, notes: rhythm.notes, customIndex };
  }
  return null;
}

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

function getIsPlayingDemo() { return _isPlayingDemo; }

function setIsPlayingDemo(val) { _isPlayingDemo = val; }

// 灵敏度
let sensitivityLevel = 50;
let strumThreshold = 0.05;

function updateThreshold() {
  strumThreshold = 0.30 - (sensitivityLevel - 1) * (0.29 / 99);
  strumThreshold = Math.max(0.01, Math.min(0.30, strumThreshold));
  const thresholdDisplay = document.getElementById('thresholdDisplay');
  if (thresholdDisplay) thresholdDisplay.textContent = strumThreshold.toFixed(2);
}

// 全局状态
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
let currentRhythm = 0;
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

// 离屏 Canvas 缓冲
let spectrumOffscreenCanvas = null;
let spectrumOffscreenCtx = null;
let spectrumBackgroundDirty = true;
let lastSpectrumCanvasWidth = 0;
let lastSpectrumCanvasHeight = 0;

// Spectral Flux
let previousSpectrum = null;
let fluxBuffer = [];
let fluxBufferSize = 43;
let fluxThreshold = 0;
let fluxPeakCooldown = 0;
const FLUX_COOLDOWN_FRAMES = 3;

// DOM 元素
let btnStart, btnStop, statusIndicator, statusText, rhythmSelector;
let rhythmScoreEl, toneScoreEl, dynamicsScoreEl, totalScoreEl;
let rhythmRingEl, toneRingEl, dynamicsRingEl, totalRingEl;
let feedbackMessage, historyList;
let metronomeToggle, bpmSlider, bpmValue, demoButtons, metronomeDot;
let sensitivitySlider, sensitivityValueEl, thresholdDisplay, volumeMeterFill;
let statsChartCanvas, statsChartCtx, avgScoreEl, maxScoreEl, practiceCountEl;
let btnAddRhythm, btnMicTest;
let practiceReportModal;
let recorderCanvas, recorderCtx;
let recorderWaveformData = [];
const RECORDER_BUFFER_SIZE = 300;
let spectrumCanvas, spectrumCtx;
let spectrumHistory = [];
const SPECTRUM_HISTORY_SIZE = 60;

let modeButtons, modePreset, modeCustom, modeFree;
let presetSelector, progressionSelect;
let customChordSelector, selectedChordsDisplay;
let currentChordDisplay, nextChordDisplay;
let currentChordCanvas, nextChordCanvas;
let recognizedChordEl, chordConfidenceEl;
let transitionTimeEl, progressionBar, progressionProgress;
let btnSaveProgression, btnClearProgression;
let chordTrainingPanel;
let practiceModeRhythm, practiceModeComprehensive, practiceModeDescription;

const DEBUG = false;
const APP_VERSION = 'v2.1';

// 自动保存
let autoSaveIntervalId = null;

// ========== 辅助函数 ==========

function updateStabilityScoresWrapper() {
  updateStabilityScores(measureHistory, calculateStabilityScore, DEBUG);
}

function checkMeasureUpdateWrapper() {
  const result = checkMeasureUpdate(
    isListening, currentMeasureStartTime, currentMeasureStrums, lastScoredMeasureEnd,
    currentBPM, getActiveRhythm, currentRhythm, calculateRhythmScore, calculateToneScore,
    calculateDynamicsScore, measureHistory, MAX_HISTORY, lastMeasureScores,
    rhythmScoreEl, toneScoreEl, dynamicsScoreEl, totalScoreEl,
    rhythmRingEl, toneRingEl, dynamicsRingEl, totalRingEl, updateScoreRing,
    updateStabilityScoresWrapper, DEBUG
  );
  
  if (result) {
    lastMeasureScores = result.lastMeasureScores;
    lastScoredMeasureEnd = result.lastScoredMeasureEnd;
    currentMeasureStartTime = result.currentMeasureStartTime;
    currentMeasureStrums = result.currentMeasureStrums;
  }
}

function updateScoresWrapper() {
  updateScores(lastMeasureScores, rhythmScoreEl, toneScoreEl, dynamicsScoreEl, totalScoreEl, checkMeasureUpdateWrapper);
}

// HTML 转义
function escapeHtml(text) {
  const _escapeHtmlMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const _escapeHtmlRegex = /[&<>"']/g;
  return String(text).replace(_escapeHtmlRegex, m => _escapeHtmlMap[m]);
}

// 生成箭头模式
function generateArrowPattern(notes) {
  if (!notes || notes.length === 0) return '';
  const arrows = notes.map(n => ({ arrow: n.direction === 'D' ? '↓' : '↑', duration: n.duration }));
  let result = arrows[0].arrow;
  for (let i = 1; i < arrows.length; i++) {
    const prevDuration = arrows[i - 1].duration;
    const currDuration = arrows[i].duration;
    const isPrevShort = prevDuration === '16th';
    const isCurrShort = currDuration === '16th';
    if (isPrevShort && isCurrShort) result += arrows[i].arrow;
    else if (isPrevShort || isCurrShort) result += ' ' + arrows[i].arrow;
    else result += '  ' + arrows[i].arrow;
  }
  return result;
}

// 流畅度评分
function calculateFluencyScore(avgTime, transitions, duration) {
  if (transitions.length === 0 || duration === 0) return 0;
  let timeScore = 0;
  if (avgTime > 0) {
    if (avgTime < 300) timeScore = 100;
    else if (avgTime < 500) timeScore = 100 - ((avgTime - 300) / 200) * 30;
    else if (avgTime < 1000) timeScore = 70 - ((avgTime - 500) / 500) * 40;
    else timeScore = Math.max(0, 30 - ((avgTime - 1000) / 1000) * 30);
  }
  let consistencyScore = 0;
  if (transitions.length > 1) {
    const mean = transitions.reduce((a, b) => a + b, 0) / transitions.length;
    const variance = transitions.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / transitions.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;
    consistencyScore = Math.max(0, 100 * Math.exp(-cv * 2));
  }
  return Math.round(timeScore * 0.6 + consistencyScore * 0.4);
}

// ========== 初始化 ==========

function setupPracticeReport() {
  const btnClose1 = document.getElementById('btnCloseReport');
  const btnClose2 = document.getElementById('btnCloseReport2');
  const modal = document.getElementById('practiceReportModal');
  
  if (btnClose1) btnClose1.addEventListener('click', () => modal.style.display = 'none');
  if (btnClose2) btnClose2.addEventListener('click', () => modal.style.display = 'none');
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
}

function showPracticeReport() {
  if (!practiceReportModal) return;
  
  const duration = practiceStartTime > 0 ? Math.round((Date.now() - practiceStartTime) / 1000) : 0;
  const transitionStats = transitionDetector ? transitionDetector.getStats() : null;
  const transitionCount = transitionStats ? transitionStats.transitionCount : 0;
  const avgTransitionTime = transitionStats ? Math.round(transitionStats.avgTransitionTime) : 0;
  const accuracy = practiceChordTotal > 0 ? Math.round((practiceChordCorrect / practiceChordTotal) * 100) : 0;
  const bestTransition = practiceTransitionTimes.length > 0 ? Math.round(Math.min(...practiceTransitionTimes)) : null;
  const worstTransition = practiceTransitionTimes.length > 0 ? Math.round(Math.max(...practiceTransitionTimes)) : null;
  const fluencyScore = (typeof calculateFluencyScore === 'function') ? calculateFluencyScore(avgTransitionTime, practiceTransitionTimes, duration) : 75;
  const totalScore = parseInt(totalScoreEl.textContent) || 0;
  
  document.getElementById('reportDuration').textContent = duration + 's';
  document.getElementById('reportTotalScore').textContent = totalScore;
  
  if (practiceMode === 'comprehensive') {
    document.getElementById('reportTransitions').textContent = transitionCount;
    document.getElementById('reportAvgTime').textContent = avgTransitionTime > 0 ? avgTransitionTime + 'ms' : '--';
    document.getElementById('reportAccuracy').textContent = accuracy > 0 ? accuracy + '%' : '--';
    document.getElementById('reportFluency').textContent = fluencyScore > 0 ? fluencyScore : '--';
    document.getElementById('reportBestTransition').textContent = bestTransition !== null ? Math.round(bestTransition) + 'ms' : '--';
    document.getElementById('reportWorstTransition').textContent = worstTransition !== null ? Math.round(worstTransition) + 'ms' : '--';
  } else {
    document.getElementById('reportTransitions').textContent = '--';
    document.getElementById('reportAvgTime').textContent = '--';
    document.getElementById('reportAccuracy').textContent = '--';
    document.getElementById('reportFluency').textContent = '--';
    document.getElementById('reportBestTransition').textContent = '--';
    document.getElementById('reportWorstTransition').textContent = '--';
  }
  
  if (typeof renderTrendCharts === 'function') renderTrendCharts();
  practiceReportModal.style.display = 'block';
}

function init() {
  // 获取 DOM 元素
  btnStart = document.getElementById('btnStart');
  btnStop = document.getElementById('btnStop');
  statusIndicator = document.getElementById('statusIndicator');
  statusText = document.getElementById('statusText');
  rhythmSelector = document.getElementById('rhythmSelector');
  rhythmScoreEl = document.getElementById('rhythmScore');
  toneScoreEl = document.getElementById('toneScore');
  dynamicsScoreEl = document.getElementById('dynamicsScore');
  totalScoreEl = document.getElementById('totalScore');
  feedbackMessage = document.getElementById('feedbackMessage');
  historyList = document.getElementById('historyList');
  
  recorderCanvas = document.getElementById('recorderWaveform');
  recorderCtx = recorderCanvas ? recorderCanvas.getContext('2d') : null;
  if (recorderCanvas) {
    setTimeout(() => {
      recorderCanvas.width = recorderCanvas.offsetWidth || 600;
      recorderCanvas.height = recorderCanvas.offsetHeight || 120;
    }, 100);
  }
  
  spectrumCanvas = document.getElementById('spectrumWaveform');
  spectrumCtx = spectrumCanvas ? spectrumCanvas.getContext('2d') : null;
  if (spectrumCanvas) {
    setTimeout(() => {
      spectrumCanvas.width = spectrumCanvas.offsetWidth || 600;
      spectrumCanvas.height = spectrumCanvas.offsetHeight || 120;
    }, 100);
  }
  
  metronomeToggle = document.getElementById('metronomeToggle');
  bpmSlider = document.getElementById('bpmSlider');
  bpmValue = document.getElementById('bpmValue');
  demoButtons = document.querySelectorAll('.btn-demo');
  sensitivitySlider = document.getElementById('sensitivitySlider');
  sensitivityValueEl = document.getElementById('sensitivityValue');
  thresholdDisplay = document.getElementById('thresholdDisplay');
  volumeMeterFill = document.getElementById('volumeMeterFill');
  
  statsChartCanvas = document.getElementById('statsChart');
  statsChartCtx = statsChartCanvas ? statsChartCanvas.getContext('2d') : null;
  avgScoreEl = document.getElementById('avgScore');
  maxScoreEl = document.getElementById('maxScore');
  practiceCountEl = document.getElementById('practiceCount');
  
  rhythmRingEl = document.getElementById('rhythmRing');
  toneRingEl = document.getElementById('toneRing');
  dynamicsRingEl = document.getElementById('dynamicsRing');
  totalRingEl = document.getElementById('totalRing');
  
  metronomeDot = document.getElementById('metronomeDot');
  btnAddRhythm = document.getElementById('btnAddRhythm');
  btnMicTest = document.getElementById('btnMicTest');
  
  modePreset = document.getElementById('modePreset');
  modeCustom = document.getElementById('modeCustom');
  modeFree = document.getElementById('modeFree');
  modeButtons = document.querySelectorAll('.mode-btn');
  presetSelector = document.getElementById('presetSelector');
  progressionSelect = document.getElementById('progressionSelect');
  customChordSelector = document.getElementById('customChordSelector');
  selectedChordsDisplay = document.getElementById('selectedChords');
  currentChordDisplay = document.getElementById('currentChordDisplay');
  nextChordDisplay = document.getElementById('nextChordDisplay');
  currentChordCanvas = document.getElementById('currentChordDiagram');
  nextChordCanvas = document.getElementById('nextChordDiagram');
  recognizedChordEl = document.getElementById('recognizedChord');
  chordConfidenceEl = document.getElementById('chordConfidence');
  transitionTimeEl = document.getElementById('transitionTime');
  progressionBar = document.getElementById('progressionBar');
  progressionProgress = document.getElementById('progressionProgress');
  btnSaveProgression = document.getElementById('btnSaveProgression');
  btnClearProgression = document.getElementById('btnClearProgression');
  practiceReportModal = document.getElementById('practiceReportModal');
  chordTrainingPanel = document.querySelector('.chord-training-panel');
  
  practiceModeRhythm = document.getElementById('practiceModeRhythm');
  practiceModeComprehensive = document.getElementById('practiceModeComprehensive');
  practiceModeDescription = document.getElementById('practiceModeDescription');
  
  // 初始化功能
  setupChordTraining();
  setupPracticeMode();
  setupRhythmSelector();
  setupButtons();
  setupMetronome();
  setupDemoButtons();
  setupSensitivity();
  setupAddRhythmCard();
  setupMicTest();
  
  // 加载历史
  strumHistory = loadHistoryFromStorage();
  renderHistory();
  renderStatsChart();
  updateStatus('ready');
  
  loadGuitarSoundfont();
  initCustomRhythms();
  setupChartToggle();
  setupPracticeReport();
}

// ========== 设置函数 ==========

function setupRhythmSelector() {
  const options = rhythmSelector.querySelectorAll('.rhythm-option');
  options.forEach((option, index) => {
    option.addEventListener('click', (e) => {
      if (isListening || e.target.classList.contains('btn-demo')) return;
      options.forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      currentRhythm = index;
      const pattern = getActiveRhythm(index);
      if (pattern) feedbackMessage.textContent = `已选择：${pattern.name} - ${pattern.description}`;
    });
  });
}

function setupMetronome() {
  if (!metronomeToggle || !bpmSlider) return;
  
  metronomeToggle.addEventListener('change', (e) => {
    metronomeEnabled = e.target.checked;
    if (metronomeEnabled && isListening) startMetronome();
    else stopMetronome();
    feedbackMessage.textContent = metronomeEnabled ? `节拍器已开启 - ${currentBPM} BPM` : '节拍器已关闭';
  });
  
  bpmSlider.addEventListener('input', (e) => {
    currentBPM = parseInt(e.target.value);
    bpmValue.textContent = currentBPM;
    if (metronomeEnabled && isListening) { stopMetronome(); startMetronome(); }
  });
}

let lastDemoClickTime = 0;
let demoButtonsSetup = false;

function setupDemoButtons() {
  if (demoButtonsSetup) return;
  
  rhythmSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-demo');
    if (!btn) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const now = Date.now();
    if (now - lastDemoClickTime < 100) return;
    lastDemoClickTime = now;
    
    if (btn.dataset.rhythm !== undefined) {
      const rhythmIndex = parseInt(btn.dataset.rhythm);
      if (getIsPlayingDemo()) stopDemo();
      else playDemo(rhythmIndex, btn);
      return;
    }
    
    if (btn.dataset.customIndex !== undefined) {
      const customIndex = parseInt(btn.dataset.customIndex);
      if (getIsPlayingDemo()) stopDemo();
      else playCustomRhythmFromList(customIndex, btn);
      return;
    }
  });
  
  demoButtonsSetup = true;
}

function playMetronomeSound(frequency = 1000, duration = 0.05) {
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

function startMetronome() {
  if (metronomeInterval) clearInterval(metronomeInterval);
  const beatInterval = (60 / currentBPM) * 1000;
  metronomeBeat = 0;
  playMetronomeSound(1200, 0.05);
  triggerMetronomeDot(true);
  
  metronomeInterval = setInterval(() => {
    metronomeBeat++;
    const activeRhythm = getActiveRhythm(currentRhythm);
    const beats = activeRhythm ? activeRhythm.beats : 4;
    const isAccent = metronomeBeat % beats === 0;
    playMetronomeSound(isAccent ? 1200 : 800, 0.05);
    triggerMetronomeDot(isAccent);
  }, beatInterval);
}

function triggerMetronomeDot(isAccent) {
  if (!metronomeDot) return;
  metronomeDot.classList.add('accent');
  setTimeout(() => metronomeDot.classList.remove('accent'), 150);
}

function stopMetronome() {
  if (metronomeInterval) { clearInterval(metronomeInterval); metronomeInterval = null; }
}

async function playDemo(rhythmIndex, btnElement) {
  setIsPlayingDemo(true);
  demoLoopCount = 0;
  currentDemoRhythmIndex = rhythmIndex;
  currentPlayingDemoBtn = btnElement;
  
  if (btnElement && btnElement.classList) btnElement.classList.add('playing');
  if (btnElement && btnElement.textContent !== undefined) btnElement.textContent = '⏹ 停止演示';
  
  const pattern = getActiveRhythm(rhythmIndex);
  if (!pattern) return;
  
  let noteIndex = 0;
  
  async function playNextNote() {
    if (!getIsPlayingDemo()) return;
    if (noteIndex > 0 && noteIndex % pattern.pattern.length === 0) {
      demoLoopCount++;
      feedbackMessage.textContent = `演示播放中 - 第 ${demoLoopCount + 1} 轮`;
    }
    
    const direction = pattern.demo[noteIndex % pattern.demo.length];
    try {
      if (pattern.isCustom && pattern.notes && pattern.notes[noteIndex % pattern.notes.length]) {
        const noteData = pattern.notes[noteIndex % pattern.notes.length];
        await playStrumSound(direction, 0.15, [noteData.velocity, noteData.velocity, noteData.velocity, noteData.velocity, noteData.velocity, noteData.velocity]);
      } else {
        await playStrumSound(direction);
      }
    } catch (err) { console.error(err); }
    
    const options = rhythmSelector.querySelectorAll('.rhythm-option');
    options.forEach(o => o.classList.remove('active'));
    if (options[rhythmIndex]) options[rhythmIndex].classList.add('active');
    
    const baseBPM = 120;
    const patternDuration = pattern.pattern[noteIndex % pattern.pattern.length];
    const intervalMs = patternDuration * (baseBPM / currentBPM);
    
    noteIndex++;
    demoTimeout = setTimeout(playNextNote, intervalMs);
  }
  
  feedbackMessage.textContent = `演示播放中 - 第 1 轮`;
  playNextNote();
}

function stopDemo() {
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

function setupSensitivity() {
  if (!sensitivitySlider) return;
  sensitivitySlider.addEventListener('input', (e) => {
    sensitivityLevel = parseInt(e.target.value);
    if (sensitivityValueEl) sensitivityValueEl.textContent = sensitivityLevel;
    updateThreshold();
    if (!isListening) feedbackMessage.textContent = `灵敏度：${sensitivityLevel} - 开始练习后生效`;
  });
  updateThreshold();
}

function setupAddRhythmCard() {
  if (!btnAddRhythm) return;
  btnAddRhythm.addEventListener('click', () => openNewRhythmEditor());
}

function setupMicTest() {
  if (!btnMicTest) return;
  btnMicTest.addEventListener('click', async () => {
    try {
      btnMicTest.textContent = '⏳ 检测中...';
      btnMicTest.disabled = true;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const testCtx = new (window.AudioContext || window.webkitAudioContext)();
      const testSource = testCtx.createMediaStreamSource(stream);
      const testAnalyser = testCtx.createAnalyser();
      testAnalyser.fftSize = 256;
      testSource.connect(testAnalyser);
      
      const data = new Uint8Array(testAnalyser.frequencyBinCount);
      let maxLevel = 0;
      let checkCount = 0;
      
      function checkLevel() {
        testAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        maxLevel = Math.max(maxLevel, avg);
        checkCount++;
        
        if (volumeMeterFill) volumeMeterFill.style.width = Math.min(100, (avg / 128) * 100) + '%';
        
        if (checkCount < 30) { requestAnimationFrame(checkLevel); }
        else {
          stream.getTracks().forEach(t => t.stop());
          testCtx.close();
          
          if (maxLevel > 10) {
            btnMicTest.textContent = '✓ 正常';
            btnMicTest.style.borderColor = '#2ed573';
            btnMicTest.style.color = '#2ed573';
          } else {
            btnMicTest.textContent = '✗ 无信号';
            btnMicTest.style.borderColor = '#ff4757';
            btnMicTest.style.color = '#ff4757';
          }
          
          btnMicTest.disabled = false;
          setTimeout(() => {
            btnMicTest.textContent = '🎤 检测';
            btnMicTest.style.borderColor = '';
            btnMicTest.style.color = '';
            if (volumeMeterFill) volumeMeterFill.style.width = '0%';
          }, 3000);
        }
      }
      
      checkLevel();
    } catch (err) {
      btnMicTest.textContent = '✗ 拒绝';
      btnMicTest.style.borderColor = '#ff4757';
      btnMicTest.style.color = '#ff4757';
      btnMicTest.disabled = false;
      setTimeout(() => {
        btnMicTest.textContent = '🎤 检测';
        btnMicTest.style.borderColor = '';
        btnMicTest.style.color = '';
      }, 3000);
    }
  });
}

function setupChartToggle() {
  const toggleBtn = document.getElementById('chartToggleBtn');
  const chartSection = document.getElementById('statsChartSection');
  if (!toggleBtn || !chartSection) return;
  
  const collapsed = localStorage.getItem('guitarStrumChartCollapsed') === 'true';
  if (collapsed) { chartSection.classList.add('collapsed'); toggleBtn.textContent = '▶'; }
  
  toggleBtn.addEventListener('click', () => {
    chartSection.classList.toggle('collapsed');
    const isCollapsed = chartSection.classList.contains('collapsed');
    toggleBtn.textContent = isCollapsed ? '▶' : '▼';
    localStorage.setItem('guitarStrumChartCollapsed', isCollapsed);
  });
}

function setupButtons() {
  if (!btnStart || !btnStop) return;
  btnStart.addEventListener('click', () => startListening());
  btnStop.addEventListener('click', () => stopListening());
}

function updateStatus(status) {
  statusIndicator.className = 'status-indicator ' + status;
  statusText.textContent = status === 'ready' ? '准备就绪' : status === 'listening' ? '正在监听...' : '发生错误';
}

// ========== 音频处理 ==========

async function startListening() {
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
    
    document.getElementById('rhythmStabilityScore').textContent = '--';
    document.getElementById('toneStabilityScore').textContent = '--';
    document.getElementById('dynamicsStabilityScore').textContent = '--';
    document.getElementById('overallStabilityScore').textContent = '--';
    
    previousSpectrum = null;
    fluxBuffer = [];
    fluxThreshold = 0;
    fluxPeakCooldown = 0;
    
    practiceStartTime = Date.now();
    practiceChordCorrect = 0;
    practiceChordTotal = 0;
    practiceTransitionTimes = [];
    
    initChordDetector();
    resetChordTraining();
    
    chordRecognitionEnabled = practiceMode === 'comprehensive';
    
    btnStart.style.display = 'none';
    btnStop.style.display = 'block';
    updateStatus('listening');
    
    const activeRhythm = getActiveRhythm(currentRhythm);
    feedbackMessage.textContent = metronomeEnabled ? `🎯 开始练习：${activeRhythm.name} (节拍器：${currentBPM} BPM)` : `🎯 开始练习：${activeRhythm.name}`;
    
    analyzeAudio();
  } catch (err) {
    console.error('[GuitarStrumTrainer] 音频初始化失败:', err);
    feedbackMessage.textContent = '❌ 无法访问麦克风';
    updateStatus('error');
  }
}

function stopListening() {
  isListening = false;
  chordRecognitionEnabled = false;
  practiceTransitionTimes = [];
  stopMetronome();
  if (getIsPlayingDemo()) stopDemo();
  
  if (autoSaveIntervalId) { clearInterval(autoSaveIntervalId); autoSaveIntervalId = null; }
  
  if (microphone) { microphone.mediaStream.getTracks().forEach(track => track.stop()); microphone.disconnect(); microphone = null; }
  if (audioContext) { audioContext.close(); audioContext = null; }
  
  btnStart.style.display = 'block';
  btnStop.style.display = 'none';
  updateStatus('ready');
  
  if (detectedStrums.length > 0) {
    saveHistory(strumHistory, detectedStrums, totalScoreEl, rhythmScoreEl, toneScoreEl, dynamicsScoreEl, 
                currentRhythm, currentBPM, currentTrainingMode, practiceMode, practiceChordTotal, 
                practiceChordCorrect, practiceTransitionTimes, transitionDetector, RHYTHM_PATTERNS, 
                getActiveRhythm, practiceStartTime);
    showPracticeReport();
  }
  
  feedbackMessage.textContent = metronomeEnabled ? `练习结束 (节拍器：${currentBPM} BPM)` : '练习结束，点击"开始练习"继续';
  
  autoSaveIntervalId = setInterval(() => saveUserSettings(currentBPM, metronomeEnabled, sensitivityLevel, currentRhythm, customRhythms, DEBUG), 5000);
}

function analyzeAudio() {
  if (!isListening) return;
  
  const now = performance.now();
  const delta = now - lastAnalyzeTime;
  if (delta < ANALYZE_INTERVAL) { requestAnimationFrame(analyzeAudio); return; }
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
  
  drawRecorderWaveform(recorderCanvas, recorderCtx, recorderWaveformData, timeDataCache, rms, RECORDER_BUFFER_SIZE, RECORDER_DRAW_INTERVAL, DEBUG);
  drawSpectrumWaveform(spectrumCanvas, spectrumCtx, freqDataCache, spectrumHistory, SPECTRUM_HISTORY_SIZE, SPECTRUM_DRAW_INTERVAL, audioContext, DEBUG);
  
  detectStrum(freqDataCache, timeDataCache, rms);
  updateScoresWrapper();
  
  requestAnimationFrame(analyzeAudio);
}

function computeSpectralFlux(currentSpectrum, previousSpectrum) {
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

function detectFluxPeak(currentFlux, threshold) {
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

function detectOnsetWithFlux(freqData, timeData, rms) {
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

function detectStrum(freqData, timeData, rms) {
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
    
    if (chordRecognitionEnabled && chordDetector) {
      const chordResult = chordDetector.detect(freqData);
      if (chordResult) {
        lastRecognizedChord = chordResult.chord;
        updateChordDisplay(chordResult, expectedChord, nextChord);
        if (transitionDetector && currentTrainingMode !== 'free') {
          transitionDetector.onChordDetected(chordResult.chord, expectedChord, now);
        }
      }
    }
    
    lastStrumTime = now;
    if (detectedStrums.length > 20) detectedStrums.shift();
    provideFeedback(strum);
    updateScoresWrapper();
  }
}

function provideFeedback(strum) {
  const pattern = getActiveRhythm(currentRhythm);
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
  
  feedbackMessage.textContent = feedback;
  expectedStrumIndex = (expectedStrumIndex + 1) % pattern.pattern.length;
}

// ========== 音源加载 ==========

async function loadGuitarSoundfont() {
  if (soundfontLoading || soundfontLoaded) return;
  soundfontLoading = true;
  
  try {
    if (typeof window.Soundfont === 'undefined') { soundfontLoading = false; return; }
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    guitarSoundfont = await window.Soundfont.instrument(audioCtx, 'acoustic_guitar_steel', { soundfont: 'FluidR3_GM', gain: 1.5 });
    soundfontLoaded = true;
  } catch (error) {
    console.error('[GuitarStrumTrainer] 音源加载失败:', error);
    soundfontLoading = false;
  }
}

async function playStrumSound(direction, duration = 0.15, noteVelocities = null) {
  if (!guitarSoundfont) { await playStrumSoundSynth(direction, duration); return; }
  
  const ctx = guitarSoundfont.context;
  if (ctx.state === 'suspended') await ctx.resume();
  
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

async function playStrumSoundSynth(direction, duration = 0.15) {
  if (!audioContextForMetronome) {
    audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContextForMetronome.state === 'suspended') await audioContextForMetronome.resume();
  
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
    } catch (e) {
      osc1.disconnect(); gain1.disconnect(); osc2.disconnect(); gain2.disconnect();
    }
  });
}

// ========== 自定义节奏型 ==========

function initCustomRhythms() {
  loadCustomRhythms();
  loadUserSettingsFromStorage();
  renderCustomRhythmsList();
  setupCustomRhythmButtons();
}

function loadCustomRhythms() {
  try {
    const stored = localStorage.getItem('guitarStrumCustomRhythms');
    if (stored) customRhythms = JSON.parse(stored);
  } catch (e) { customRhythms = []; }
}

function saveCustomRhythms() {
  try { localStorage.setItem('guitarStrumCustomRhythms', JSON.stringify(customRhythms)); } catch (e) {}
}

function renderCustomRhythmsList() {
  const container = document.getElementById('customRhythmsList');
  if (!container) return;
  
  if (customRhythms.length === 0) {
    container.innerHTML = '<div style="color: #888; padding: 20px; text-align: center;">暂无自定义节奏型，点击"+"创建</div>';
    return;
  }
  
  container.innerHTML = customRhythms.map((rhythm, index) => {
    const pattern = rhythm.notes ? generateArrowPattern(rhythm.notes) : '';
    return `
      <div style="padding: 15px; background: rgba(184, 102, 255, 0.08); border: 1px solid rgba(184, 102, 255, 0.25); border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div style="cursor: pointer; flex: 1;" onclick="selectCustomRhythm(${index})">
          <div style="font-weight: bold; color: #b866ff; margin-bottom: 5px;">${escapeHtml(rhythm.name)}</div>
          <div style="color: #888; font-size: 1.1em; font-family: monospace; letter-spacing: 2px;">${pattern}</div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="editCustomRhythm(${index}); event.stopPropagation();" style="padding: 8px 16px; background: #ffa502; color: white; border: none; border-radius: 8px; cursor: pointer;">✏️ 编辑</button>
          <button class="btn-custom-play" data-custom-index="${index}" style="padding: 8px 16px; background: #2ed573; color: white; border: none; border-radius: 8px; cursor: pointer;">🔊 试听</button>
          <button onclick="deleteCustomRhythm(${index}); event.stopPropagation();" style="padding: 8px 16px; background: #ff4757; color: white; border: none; border-radius: 8px; cursor: pointer;">🗑 删除</button>
        </div>
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.btn-custom-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const now = Date.now();
      if (now - lastDemoClickTime < 100) return;
      lastDemoClickTime = now;
      const customIndex = parseInt(btn.dataset.customIndex);
      if (getIsPlayingDemo()) stopDemo();
      else playCustomRhythmFromList(customIndex, btn);
    });
  });
  
  syncCustomRhythmsToSelector();
}

function syncCustomRhythmsToSelector() {
  const rhythmSelector = document.getElementById('rhythmSelector');
  if (!rhythmSelector) return;
  
  rhythmSelector.querySelectorAll('.custom-rhythm-option').forEach(el => el.remove());
  
  customRhythms.forEach((rhythm, index) => {
    const arrowPattern = generateArrowPattern(rhythm.notes);
    const option = document.createElement('div');
    option.className = 'rhythm-option custom-rhythm-option';
    option.dataset.customIndex = index;
    option.innerHTML = `<div class="name">${escapeHtml(rhythm.name)}</div><div class="pattern">${arrowPattern}</div><button class="btn-demo" data-custom-index="${index}">🔊 试听演示</button>`;
    option.addEventListener('click', (e) => { if (e.target.classList.contains('btn-demo')) return; selectCustomRhythm(index); });
    rhythmSelector.appendChild(option);
  });
  
  setupDemoButtons();
}

function selectCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  const rhythm = customRhythms[index];
  if (!rhythm.notes || rhythm.notes.length === 0) return;
  
  currentRhythm = RHYTHM_PATTERNS.length + index;
  
  const options = document.querySelectorAll('.rhythm-option');
  options.forEach(o => o.classList.remove('active'));
  
  const customOption = document.querySelector(`.custom-rhythm-option[data-custom-index="${index}"]`);
  if (customOption) customOption.classList.add('active');
  
  const tempDemo = rhythm.notes.map(note => note.direction);
  feedbackMessage.textContent = `已选择：${rhythm.name} - ${tempDemo.join(' ')}`;
}

function setupCustomRhythmButtons() {
  const btnNew = document.getElementById('btnNewRhythm');
  const btnExport = document.getElementById('btnExportSettings');
  const btnImport = document.getElementById('btnImportSettings');
  const btnSave = document.getElementById('btnSaveRhythm');
  const btnCancel = document.getElementById('btnCancelEdit');
  const btnAddNote = document.getElementById('btnAddNote');
  const importInput = document.getElementById('importFileInput');
  
  if (btnNew) btnNew.addEventListener('click', openNewRhythmEditor);
  if (btnExport) btnExport.addEventListener('click', () => exportUserSettings(currentBPM, metronomeEnabled, sensitivityLevel, customRhythms, DEBUG));
  if (btnImport) btnImport.addEventListener('click', () => importInput.click());
  if (importInput) importInput.addEventListener('change', (e) => importUserSettings(e, customRhythms, {
    saveCustomRhythms,
    updateUI: (bpm, metronome, sensitivity) => {
      if (bpm) { currentBPM = bpm; const slider = document.getElementById('bpmSlider'); const val = document.getElementById('bpmValue'); if (slider) slider.value = bpm; if (val) val.textContent = bpm; }
      if (metronome !== null) { metronomeEnabled = metronome; const toggle = document.getElementById('metronomeToggle'); if (toggle) toggle.checked = metronome; }
      if (sensitivity) { sensitivityLevel = sensitivity; const slider = document.getElementById('sensitivitySlider'); const val = document.getElementById('sensitivityValue'); if (slider) slider.value = sensitivity; if (val) val.textContent = sensitivity; updateThreshold(); }
    },
    renderCustomRhythmsList
  }, DEBUG));
  if (btnSave) btnSave.addEventListener('click', saveRhythmEditor);
  if (btnCancel) btnCancel.addEventListener('click', closeRhythmEditor);
  if (btnAddNote) btnAddNote.addEventListener('click', addNoteToSequence);
  
  document.querySelectorAll('.btnPreset').forEach(btn => {
    btn.addEventListener('click', (e) => loadPresetTemplate(e.target.dataset.preset));
  });
}

function openNewRhythmEditor() {
  editingRhythmIndex = -1;
  currentNoteSequence = [];
  document.getElementById('rhythmNameInput').value = '';
  document.getElementById('rhythmEditorModal').style.display = 'block';
  renderNoteSequenceEditor();
}

function editCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  editingRhythmIndex = index;
  const rhythm = customRhythms[index];
  document.getElementById('rhythmNameInput').value = rhythm.name;
  currentNoteSequence = JSON.parse(JSON.stringify(rhythm.notes || []));
  document.getElementById('rhythmEditorModal').style.display = 'block';
  renderNoteSequenceEditor();
}

function deleteCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  if (!confirm('确定要删除这个节奏型吗？')) return;
  customRhythms.splice(index, 1);
  saveCustomRhythms();
  renderCustomRhythmsList();
}

function playCustomRhythmFromList(index, btn) {
  if (index < 0 || index >= customRhythms.length) return;
  const rhythm = customRhythms[index];
  if (!rhythm.notes || rhythm.notes.length === 0) return;
  if (getIsPlayingDemo()) { stopDemo(); return; }
  
  const rhythmIndex = RHYTHM_PATTERNS.length + index;
  playingCustomBtn = btn;
  if (btn && btn.classList) btn.classList.add('playing');
  if (btn && btn.textContent !== undefined) btn.textContent = '⏹ 停止演示';
  playDemo(rhythmIndex, btn);
  
  window.customRhythmCleanup = setTimeout(() => { if (getIsPlayingDemo()) stopDemo(); playingCustomBtn = null; }, 10000);
}

function renderNoteSequenceEditor() {
  const container = document.getElementById('noteSequenceEditor');
  if (!container) return;
  if (currentNoteSequence.length === 0) {
    container.innerHTML = '<div style="color: #888; width: 100%; text-align: center; padding: 20px;">点击"添加音符"或选择预设模板开始</div>';
    return;
  }
  container.innerHTML = currentNoteSequence.map((note, index) => `
    <div style="display: flex; gap: 5px; align-items: center; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 8px;">
      <span style="color: #888; font-size: 0.8em;">#${index + 1}</span>
      <select onchange="updateNote(${index}, 'duration', this.value)" style="padding: 5px; background: #1a1a2e; border: 1px solid #00d9ff; border-radius: 4px; color: white;">
        ${Object.entries(NOTE_DURATIONS).map(([key, val]) => `<option value="${key}" ${note.duration === key ? 'selected' : ''}>${val.name}</option>`).join('')}
      </select>
      <select onchange="updateNote(${index}, 'direction', this.value)" style="padding: 5px; background: #1a1a2e; border: 1px solid #00d9ff; border-radius: 4px; color: white;">
        <option value="D" ${note.direction === 'D' ? 'selected' : ''}>下扫 (D)</option>
        <option value="U" ${note.direction === 'U' ? 'selected' : ''}>上扫 (U)</option>
      </select>
      <input type="range" min="0.1" max="1.0" step="0.1" value="${note.velocity || 0.5}" onchange="updateNote(${index}, 'velocity', parseFloat(this.value))" style="width: 80px;">
      <span style="color: #00d9ff; min-width: 30px;">${Math.round((note.velocity || 0.5) * 100)}%</span>
      <button onclick="removeNote(${index})" style="padding: 5px 10px; background: #ff4757; color: white; border: none; border-radius: 4px; cursor: pointer;">✕</button>
    </div>
  `).join('');
}

function addNoteToSequence() {
  currentNoteSequence.push({ duration: '8th', direction: 'D', velocity: 0.8 });
  renderNoteSequenceEditor();
}

function updateNote(index, field, value) {
  if (index < 0 || index >= currentNoteSequence.length) return;
  currentNoteSequence[index][field] = value;
  renderNoteSequenceEditor();
}

function removeNote(index) {
  if (index < 0 || index >= currentNoteSequence.length) return;
  currentNoteSequence.splice(index, 1);
  renderNoteSequenceEditor();
}

function loadPresetTemplate(presetKey) {
  const template = PRESET_TEMPLATES[presetKey];
  if (!template) return;
  document.getElementById('rhythmNameInput').value = template.name;
  currentNoteSequence = JSON.parse(JSON.stringify(template.notes));
  renderNoteSequenceEditor();
}

function saveRhythmEditor() {
  const name = document.getElementById('rhythmNameInput').value.trim();
  if (!name) { alert('请输入节奏型名称'); return; }
  if (currentNoteSequence.length === 0) { alert('请至少添加一个音符'); return; }
  
  const rhythm = { name, notes: JSON.parse(JSON.stringify(currentNoteSequence)), createdAt: Date.now() };
  if (editingRhythmIndex >= 0) customRhythms[editingRhythmIndex] = rhythm;
  else customRhythms.push(rhythm);
  
  saveCustomRhythms();
  closeRhythmEditor();
  renderCustomRhythmsList();
  setupDemoButtons();
}

function closeRhythmEditor() {
  document.getElementById('rhythmEditorModal').style.display = 'none';
  editingRhythmIndex = -1;
  currentNoteSequence = [];
}

function loadUserSettingsFromStorage() {
  const settings = loadUserSettings(customRhythms, DEBUG);
  if (settings.bpm) {
    currentBPM = settings.bpm;
    const slider = document.getElementById('bpmSlider');
    const val = document.getElementById('bpmValue');
    if (slider) slider.value = currentBPM;
    if (val) val.textContent = currentBPM;
  }
  if (settings.metronomeEnabled !== null) {
    metronomeEnabled = settings.metronomeEnabled;
    const toggle = document.getElementById('metronomeToggle');
    if (toggle) toggle.checked = metronomeEnabled;
  }
  if (settings.sensitivityLevel) {
    sensitivityLevel = settings.sensitivityLevel;
    const slider = document.getElementById('sensitivitySlider');
    const val = document.getElementById('sensitivityValue');
    if (slider) slider.value = sensitivityLevel;
    if (val) val.textContent = sensitivityLevel;
    updateThreshold();
  }
  if (settings.currentRhythm !== null) {
    currentRhythm = settings.currentRhythm;
    const options = document.querySelectorAll('.rhythm-option');
    options.forEach((o, i) => o.classList.toggle('active', i === currentRhythm));
  }
}

// ========== 渲染历史统计 ==========

function renderHistory() {
  historyList.innerHTML = strumHistory.map(item => {
    const modeLabel = item.mode === 'preset' ? '📖' : item.mode === 'custom' ? '✏️' : item.mode === 'free' ? '🎸' : '';
    const practiceModeLabel = item.practiceMode === 'comprehensive' ? '🎸综合' : '🥁节奏';
    const accuracyInfo = item.practiceMode === 'comprehensive' && item.chordAccuracy ? ` | 准确率${item.chordAccuracy}%` : '';
    const transTimeInfo = item.practiceMode === 'comprehensive' && item.avgTransitionTime ? ` | 转换${item.avgTransitionTime}ms` : '';
    return `<div class="history-item"><span class="time">${item.time} - ${item.rhythm} ${modeLabel} ${practiceModeLabel}</span><span class="score">${item.score}分 (${item.strums}次扫弦${accuracyInfo}${transTimeInfo})</span></div>`;
  }).join('');
}

function renderStatsChart() {
  if (!statsChartCtx || strumHistory.length === 0) {
    if (avgScoreEl) avgScoreEl.textContent = '--';
    if (maxScoreEl) maxScoreEl.textContent = '--';
    if (practiceCountEl) practiceCountEl.textContent = '0';
    return;
  }
  
  const dpr = window.devicePixelRatio || 1;
  const rect = statsChartCanvas.getBoundingClientRect();
  statsChartCanvas.width = rect.width * dpr;
  statsChartCanvas.height = rect.height * dpr;
  statsChartCtx.setTransform(1, 0, 0, 1, 0, 0);
  statsChartCtx.scale(dpr, dpr);
  
  const width = rect.width;
  const height = rect.height;
  const padding = { top: 20, right: 20, bottom: 30, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  statsChartCtx.clearRect(0, 0, width, height);
  
  const recentHistory = strumHistory.slice(0, 20).reverse();
  const scores = recentHistory.map(h => h.score);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const maxScore = Math.max(...scores);
  
  if (avgScoreEl) avgScoreEl.textContent = avgScore;
  if (maxScoreEl) maxScoreEl.textContent = maxScore;
  if (practiceCountEl) practiceCountEl.textContent = strumHistory.length;
  
  statsChartCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  statsChartCtx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    statsChartCtx.beginPath();
    statsChartCtx.moveTo(padding.left, y);
    statsChartCtx.lineTo(width - padding.right, y);
    statsChartCtx.stroke();
    statsChartCtx.fillStyle = '#666';
    statsChartCtx.font = '10px sans-serif';
    statsChartCtx.textAlign = 'right';
    statsChartCtx.fillText(Math.round(100 - (100 / 4) * i), padding.left - 5, y + 4);
  }
  
  const points = recentHistory.map((item, index) => ({
    x: padding.left + (chartWidth / (recentHistory.length - 1 || 1)) * index,
    y: padding.top + chartHeight - (item.score / 100) * chartHeight,
    score: item.score
  }));
  
  if (points.length > 1) {
    const gradient = statsChartCtx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(184, 102, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(184, 102, 255, 0.02)');
    statsChartCtx.beginPath();
    statsChartCtx.moveTo(points[0].x, height - padding.bottom);
    points.forEach(p => statsChartCtx.lineTo(p.x, p.y));
    statsChartCtx.lineTo(points[points.length - 1].x, height - padding.bottom);
    statsChartCtx.closePath();
    statsChartCtx.fillStyle = gradient;
    statsChartCtx.fill();
  }
  
  if (points.length > 1) {
    statsChartCtx.beginPath();
    statsChartCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) statsChartCtx.lineTo(points[i].x, points[i].y);
    statsChartCtx.strokeStyle = '#b866ff';
    statsChartCtx.lineWidth = 2;
    statsChartCtx.stroke();
  }
  
  if (points.length > 1) {
    const avgY = padding.top + chartHeight - (avgScore / 100) * chartHeight;
    statsChartCtx.beginPath();
    statsChartCtx.moveTo(padding.left, avgY);
    statsChartCtx.lineTo(width - padding.right, avgY);
    statsChartCtx.strokeStyle = 'rgba(255, 165, 2, 0.6)';
    statsChartCtx.lineWidth = 1.5;
    statsChartCtx.setLineDash([6, 4]);
    statsChartCtx.stroke();
    statsChartCtx.setLineDash([]);
    statsChartCtx.fillStyle = '#ffa502';
    statsChartCtx.font = 'bold 10px sans-serif';
    statsChartCtx.textAlign = 'left';
    statsChartCtx.fillText(`平均 ${avgScore}`, padding.left + 4, avgY - 5);
  }
  
  points.forEach(p => {
    statsChartCtx.beginPath();
    statsChartCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    statsChartCtx.fillStyle = p.score >= 80 ? '#2ed573' : p.score >= 60 ? '#ffa502' : '#ff4757';
    statsChartCtx.fill();
    statsChartCtx.strokeStyle = '#1a1a2e';
    statsChartCtx.lineWidth = 2;
    statsChartCtx.stroke();
  });
  
  if (recentHistory.length > 1) {
    statsChartCtx.fillStyle = '#666';
    statsChartCtx.font = '9px sans-serif';
    statsChartCtx.textAlign = 'center';
    const labelCount = Math.min(5, recentHistory.length);
    const step = Math.floor(recentHistory.length / labelCount);
    for (let i = 0; i < recentHistory.length; i += step) {
      const item = recentHistory[i];
      const x = padding.left + (chartWidth / (recentHistory.length - 1)) * i;
      const date = new Date(item.date);
      statsChartCtx.fillText(`${date.getMonth() + 1}/${date.getDate()}`, x, height - padding.bottom + 15);
    }
  }
}

function renderTrendCharts() {
  if (typeof Chart === 'undefined') return;
  const recentHistory = strumHistory.slice(0, 10).reverse();
  if (recentHistory.length === 0) return;
  
  const labels = recentHistory.map((_, i) => `#${i + 1}`);
  const accuracies = recentHistory.map(h => h.chordAccuracy || 0);
  const avgTimes = recentHistory.map(h => h.avgTransitionTime || 0);
  
  // 渲染图表逻辑保持不变...
}

// ========== 和弦训练功能 ==========

function setupPracticeMode() {
  if (!practiceModeRhythm || !practiceModeComprehensive) return;
  practiceModeRhythm.addEventListener('click', () => setPracticeMode('rhythm'));
  practiceModeComprehensive.addEventListener('click', () => setPracticeMode('comprehensive'));
  updatePracticeModeUI();
}

function setPracticeMode(mode) {
  practiceMode = mode;
  updatePracticeModeUI();
  if (practiceMode === 'rhythm') chordRecognitionEnabled = false;
}

function updatePracticeModeUI() {
  if (practiceModeRhythm) practiceModeRhythm.classList.toggle('active', practiceMode === 'rhythm');
  if (practiceModeComprehensive) practiceModeComprehensive.classList.toggle('active', practiceMode === 'comprehensive');
  if (practiceModeDescription) {
    practiceModeDescription.textContent = practiceMode === 'rhythm' ? '💡 纯节奏模式：专注节奏准确度，任意和弦均可练习' : '💡 综合模式：需要正确和弦转换，同时评估节奏与和弦准确度';
  }
  if (chordTrainingPanel) chordTrainingPanel.style.display = practiceMode === 'comprehensive' ? 'block' : 'none';
}

function setupChordTraining() {
  if (modePreset) modePreset.addEventListener('click', () => setTrainingMode('preset'));
  if (modeCustom) modeCustom.addEventListener('click', () => setTrainingMode('custom'));
  if (modeFree) modeFree.addEventListener('click', () => setTrainingMode('free'));
  
  if (progressionSelect) {
    progressionSelect.addEventListener('change', () => {
      const index = parseInt(progressionSelect.value);
      if (window.ChordLibrary.COMMON_PROGRESSIONS[index]) {
        currentProgression = window.ChordLibrary.COMMON_PROGRESSIONS[index].chords;
        updateChordProgressionDisplay();
        updateProgressionDetail(index);
      }
    });
    currentProgression = window.ChordLibrary.COMMON_PROGRESSIONS[0].chords;
    updateProgressionDetail(0);
  }
  
  document.querySelectorAll('.chord-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => addChordToProgression(e.target.dataset.chord));
  });
  
  if (btnSaveProgression) btnSaveProgression.addEventListener('click', saveCustomProgression);
  if (btnClearProgression) btnClearProgression.addEventListener('click', () => { currentProgression = []; currentChordIndex = 0; renderSelectedChords(); updateChordProgressionDisplay(); });
}

function setTrainingMode(mode) {
  currentTrainingMode = mode;
  modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  if (presetSelector) presetSelector.style.display = mode === 'preset' ? 'block' : 'none';
  if (customChordSelector) customChordSelector.style.display = mode === 'custom' ? 'block' : 'none';
  
  if (mode === 'free') {
    currentProgression = [];
    updateChordProgressionDisplay();
  } else if (mode === 'preset' && window.ChordLibrary.COMMON_PROGRESSIONS[0]) {
    currentProgression = window.ChordLibrary.COMMON_PROGRESSIONS[0].chords;
    updateChordProgressionDisplay();
  }
}

function addChordToProgression(chordName) {
  if (!currentProgression) currentProgression = [];
  currentProgression.push(chordName);
  renderSelectedChords();
  updateChordProgressionDisplay();
}

function renderSelectedChords() {
  if (!selectedChordsDisplay) return;
  if (currentProgression.length === 0) {
    selectedChordsDisplay.innerHTML = '<span style="color: #666; font-style: italic;">点击选择和弦</span>';
    return;
  }
  selectedChordsDisplay.innerHTML = currentProgression.map((chord, index) => `
    <span style="background: rgba(0,217,255,0.2); padding: 5px 10px; border-radius: 5px; display: inline-flex; align-items: center; gap: 5px;">
      ${chord}
      <button onclick="window.removeChordFromProgression(${index})" style="background: none; border: none; color: #ff4757; cursor: pointer; font-size: 1.2em;">×</button>
    </span>
  `).join('');
}

window.removeChordFromProgression = function(index) {
  if (currentProgression && index >= 0 && index < currentProgression.length) {
    currentProgression.splice(index, 1);
    renderSelectedChords();
    updateChordProgressionDisplay();
  }
};

function saveCustomProgression() {
  if (currentProgression.length === 0) { alert('请先选择和弦！'); return; }
  const name = prompt('请输入进行名称:');
  if (!name) return;
  const saved = JSON.parse(localStorage.getItem('guitar-custom-progressions') || '[]');
  saved.push({ name, chords: [...currentProgression], createdAt: new Date().toISOString() });
  localStorage.setItem('guitar-custom-progressions', JSON.stringify(saved));
  alert(`"${name}" 已保存！`);
}

function updateChordProgressionDisplay() {
  if (!currentChordDisplay || !nextChordDisplay) return;
  if (currentProgression.length === 0 || currentTrainingMode === 'free') {
    currentChordDisplay.textContent = '--';
    nextChordDisplay.textContent = '--';
    if (currentChordCanvas) drawChordDiagram(currentChordCanvas, null);
    if (nextChordCanvas) drawChordDiagram(nextChordCanvas, null);
    return;
  }
  
  currentChordIndex = currentChordIndex % currentProgression.length;
  expectedChord = currentProgression[currentChordIndex];
  nextChord = currentProgression[(currentChordIndex + 1) % currentProgression.length];
  
  currentChordDisplay.textContent = expectedChord;
  nextChordDisplay.textContent = nextChord;
  
  if (currentChordCanvas) drawChordDiagram(currentChordCanvas, expectedChord);
  if (nextChordCanvas) drawChordDiagram(nextChordCanvas, nextChord);
  
  if (progressionBar && progressionProgress) {
    const progress = ((currentChordIndex) / currentProgression.length) * 100;
    progressionBar.style.width = `${progress}%`;
    progressionProgress.textContent = `${currentChordIndex + 1}/${currentProgression.length}`;
  }
}

function updateProgressionDetail(index) {
  const progressionChordsEl = document.getElementById('progressionChords');
  const progressionDescEl = document.getElementById('progressionDesc');
  const progressionDetailEl = document.getElementById('progressionDetail');
  
  if (!progressionChordsEl || !progressionDescEl) return;
  
  const progression = window.ChordLibrary.COMMON_PROGRESSIONS[index];
  if (progression) {
    progressionChordsEl.textContent = progression.chords.join(' → ');
    progressionDescEl.textContent = progression.desc;
    if (progressionDetailEl) progressionDetailEl.style.display = 'block';
  } else {
    progressionChordsEl.textContent = '点击选择和弦或选择预设进行';
    progressionDescEl.textContent = '';
    if (progressionDetailEl) progressionDetailEl.style.display = 'none';
  }
}

function updateChordDisplay(chordResult, expectedChord, nextChord) {
  if (recognizedChordEl) {
    recognizedChordEl.textContent = chordResult.chord;
    recognizedChordEl.style.color = chordResult.chord === expectedChord ? '#00ff00' : '#00d9ff';
  }
  if (chordConfidenceEl) chordConfidenceEl.textContent = `(${Math.round(chordResult.confidence * 100)}%)`;
  if (currentChordDisplayEl) currentChordDisplayEl.textContent = chordResult.chord;
  if (currentChordCanvas && chordResult.chord) drawChordDiagram(currentChordCanvas, chordResult.chord);
  
  if (expectedChord) {
    if (chordResult.chord === expectedChord) showFeedback('✓ 和弦正确！', 'success');
    else showFeedback(`⚠ 应该是 ${expectedChord}，检测到 ${chordResult.chord}`, 'warning');
  }
}

function showFeedback(message, type = 'info') {
  const feedbackEl = document.getElementById('feedbackMessage');
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.style.color = type === 'success' ? '#00ff00' : type === 'warning' ? '#ffa502' : type === 'error' ? '#ff4444' : '#888';
  setTimeout(() => { if (feedbackEl.textContent === message) feedbackEl.textContent = ''; }, 3000);
}

function initChordDetector() {
  if (audioContext && analyser) {
    chordDetector = new window.ChordDetector(audioContext, analyser);
    transitionDetector = new window.TransitionDetector();
    chordRecognitionEnabled = practiceMode === 'comprehensive';
  }
}

function resetChordTraining() {
  chordRecognitionEnabled = false;
  currentTrainingMode = 'preset';
  currentProgression = [];
  currentChordIndex = 0;
  expectedChord = null;
  nextChord = null;
  lastRecognizedChord = null;
  if (transitionDetector) transitionDetector.reset();
  
  if (recognizedChordEl) recognizedChordEl.textContent = '--';
  if (currentChordDisplay) currentChordDisplay.textContent = '--';
  if (nextChordDisplay) nextChordDisplay.textContent = '--';
}

// 窗口大小调整
window.addEventListener('resize', () => {
  if (recorderCanvas) { recorderCanvas.width = recorderCanvas.offsetWidth; recorderCanvas.height = recorderCanvas.offsetHeight; }
  if (spectrumCanvas) { spectrumCanvas.width = spectrumCanvas.offsetWidth; spectrumCanvas.height = spectrumCanvas.offsetHeight; }
  if (statsChartCanvas) { statsChartCanvas.width = statsChartCanvas.offsetWidth; statsChartCanvas.height = statsChartCanvas.offsetHeight; renderStatsChart(); }
});

// 启动
document.addEventListener('DOMContentLoaded', () => {
  try { init(); } catch (error) { console.error('[GuitarStrumTrainer] 初始化失败:', error); }
});

// 导出到全局
window.guitarTrainer = { chordDetector: () => chordDetector, transitionDetector: () => transitionDetector, getProgression: () => currentProgression, setTrainingMode };
