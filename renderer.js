// 吉他扫弦练习助手 - 核心音频分析引擎 v2.0
// 新增和弦识别与转换训练功能

// ========== 和弦识别模块 ==========
// 和弦检测器和和弦库通过全局对象访问（在 chord-detector.js 和 chord-library.js 中导出到 window）

// 和弦识别全局变量
let chordDetector = null;
let transitionDetector = null;
let currentTrainingMode = 'preset'; // 'preset', 'custom', 'free'
let currentProgression = []; // 当前和弦进行
let currentChordIndex = 0; // 当前和弦索引
let expectedChord = null; // 期望的和弦
let nextChord = null; // 下一个和弦
let chordRecognitionEnabled = false; // 是否启用和弦识别
let lastRecognizedChord = null; // 上次识别的和弦
let chordChangeTimeout = null; // 和弦转换计时器

// 练习模式：'rhythm' = 纯节奏训练, 'comprehensive' = 和弦+节奏综合
let practiceMode = 'rhythm'; // 默认纯节奏训练

// 练习数据统计
let practiceStartTime = 0; // 练习开始时间
let practiceChordCorrect = 0; // 和弦识别正确次数
let practiceChordTotal = 0; // 和弦识别总次数
let practiceTransitionTimes = []; // 每次转换的时间记录

// ========== 真实吉他音源 (FluidR3 GM - Acoustic Guitar Steel String) ==========
// 使用 soundfont-player 加载 FluidR3 GM 音源，CC0 授权免费商用
let guitarSoundfont = null;
let guitarInstrument = null;
let soundfontLoading = false;
let soundfontLoaded = false;

// 节奏型定义 (单位：毫秒，基于 120BPM)
// 120BPM 时：一拍=500ms，四分音符=500ms，八分音符=250ms，十六分音符=125ms
// 注意：此为预设节奏型（只读），自定义节奏型使用 customRhythms 独立管理
const RHYTHM_PATTERNS = [
  {
    name: '前八后十六',
    pattern: [250, 125, 125],  // 八分 + 十六分 + 十六分 = 一拍 (500ms)
    beats: 4,
    description: '↓ ↓↑',
    demo: ['D', 'D', 'U']
  },
  {
    name: '前十六后八',
    pattern: [125, 125, 250],  // 十六分 + 十六分 + 八分 = 一拍 (500ms)
    beats: 4,
    description: '↓↑ ↓',
    demo: ['D', 'U', 'D']
  },
  {
    name: '民谣常用',
    pattern: [250, 125, 125, 125, 125, 250],  // 两拍 (1000ms)
    beats: 4,
    description: '↓ ↓↑↓↑ ↓',
    demo: ['D', 'D', 'U', 'D', 'U', 'D']
  },
  {
    name: '摇滚八分',
    pattern: [125, 125, 125, 125, 125, 125, 125, 125],  // 两拍 (1000ms)
    beats: 4,
    description: '↓↑ ↓↑ ↓↑ ↓↑',
    demo: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U']
  },
  {
    name: '华尔兹',
    pattern: [333, 167, 167, 333, 167, 167],  // 两拍 (1000ms)，3/4 拍
    beats: 3,
    description: '↓ ↑↑ ↓ ↑↑',
    demo: ['D', 'U', 'U', 'D', 'U', 'U']
  }
];

// 获取当前激活的节奏型（支持预设和自定义）
function getActiveRhythm(index) {
if (DEBUG)   console.log('[DEBUG getActiveRhythm] Called with index:', index, 'RHYTHM_PATTERNS.length:', RHYTHM_PATTERNS.length, 'customRhythms.length:', customRhythms.length);
  if (index >= 0 && index < RHYTHM_PATTERNS.length) {
if (DEBUG)     console.log('[DEBUG getActiveRhythm] Returning preset pattern:', RHYTHM_PATTERNS[index].name);
    return RHYTHM_PATTERNS[index];
  }
  const customIndex = index - RHYTHM_PATTERNS.length;
if (DEBUG)   console.log('[DEBUG getActiveRhythm] customIndex:', customIndex);
  if (customIndex >= 0 && customIndex < customRhythms.length) {
    const rhythm = customRhythms[customIndex];
    if (!rhythm.notes || rhythm.notes.length === 0) {
if (DEBUG)       console.log('[DEBUG getActiveRhythm] Custom rhythm has no notes, returning null');
      return null;
    }
    
    const tempPattern = rhythm.notes.map(note => {
      return NOTE_DURATIONS[note.duration]?.ms || 250;
    });
    const tempDemo = rhythm.notes.map(note => note.direction);
    
    const tempDescription = (() => {
      let result = rhythm.notes[0].direction === 'D' ? '↓' : '↑';
      for (let i = 1; i < rhythm.notes.length; i++) {
        const prevDuration = rhythm.notes[i - 1].duration;
        const currDuration = rhythm.notes[i].duration;
        const arrow = rhythm.notes[i].direction === 'D' ? '↓' : '↑';
        const isPrevShort = prevDuration === '16th';
        const isCurrShort = currDuration === '16th';
        if (isPrevShort && isCurrShort) {
          result += arrow;
        } else if (isPrevShort || isCurrShort) {
          result += ' ' + arrow;
        } else {
          result += '  ' + arrow;
        }
      }
      return result;
    })();
    
    return {
      name: rhythm.name,
      pattern: tempPattern,
      beats: 4,
      description: tempDescription,
      demo: tempDemo,
      isCustom: true,
      notes: rhythm.notes,
      customIndex: customIndex
    };
  }
if (DEBUG)   console.log('[DEBUG getActiveRhythm] No matching pattern found, returning null. index:', index);
  return null;
}

// 节拍器相关
let metronomeEnabled = false;
let currentBPM = 70; // 默认 70 BPM，适合练习
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

// 获取 isPlayingDemo 状态
function getIsPlayingDemo() {
  return _isPlayingDemo;
}

// 设置 isPlayingDemo 状态并追踪
function setIsPlayingDemo(val) {
  if (DEBUG) console.log('[GuitarStrumTrainer] isPlayingDemo changed:', val, 'from:', new Error().stack.split('\n')[2]);
  _isPlayingDemo = val;
}

// 设置灵敏度
let sensitivityLevel = 50; // 1-100
let strumThreshold = 0.05; // 根据灵敏度动态计算

// 全局函数：更新阈值计算
function updateThreshold() {
  // 灵敏度 1-100 映射到阈值 0.30-0.01 (更大的范围，效果更明显)
  // 灵敏度越高，阈值越低（更容易触发）
  strumThreshold = 0.30 - (sensitivityLevel - 1) * (0.29 / 99);
  strumThreshold = Math.max(0.01, Math.min(0.30, strumThreshold));
  
  const thresholdDisplay = document.getElementById('thresholdDisplay');
  if (thresholdDisplay) {
    thresholdDisplay.textContent = strumThreshold.toFixed(2);
  }
  
if (DEBUG)   console.log('[DEBUG 灵敏度] 灵敏度:', sensitivityLevel, '→ 阈值:', strumThreshold.toFixed(3));
}

// 计算稳定性评分（基于历史数据）
function calculateStabilityScore(history) {
  if (history.length < MAX_HISTORY) return 0;  // 至少 MAX_HISTORY(10) 个小节才能计算
  
  // 1. 计算平均分
  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  if (avg === 0) return 0;
  
  // 2. 计算标准差（波动程度）
  const variance = history.reduce((sum, score) => {
    return sum + Math.pow(score - avg, 2);
  }, 0) / history.length;
  
  const stdDev = Math.sqrt(variance);
  
  // 3. 计算变异系数 CV
  const cv = stdDev / avg;
  
  // 4. 根据 CV 评分（CV 越小越稳定）
  let score;
  if (cv < 0.10) {
    score = 90 + (0.10 - cv) * 100;  // 90-100 分（非常稳定）
  } else if (cv < 0.20) {
    score = 70 + (0.20 - cv) * 200;  // 70-90 分（较稳定）
  } else if (cv < 0.30) {
    score = 50 + (0.30 - cv) * 200;  // 50-70 分（波动大）
  } else {
    score = Math.max(0, 50 - (cv - 0.30) * 100);  // 0-50 分（很不稳定）
  }
  
  return Math.round(score);
}

// 更新历史稳定性评分
function updateStabilityScores() {
  const rhythmStabilityEl = document.getElementById('rhythmStabilityScore');
  const toneStabilityEl = document.getElementById('toneStabilityScore');
  const dynamicsStabilityEl = document.getElementById('dynamicsStabilityScore');
  const overallStabilityEl = document.getElementById('overallStabilityScore');
  
  // 计算各维度稳定性
  const rhythmStability = calculateStabilityScore(measureHistory.rhythm);
  const toneStability = calculateStabilityScore(measureHistory.tone);
  const dynamicsStability = calculateStabilityScore(measureHistory.dynamics);
  
if (DEBUG)   console.log('[DEBUG 稳定性评分] 历史数据 - 节奏:', measureHistory.rhythm, '音色:', measureHistory.tone, '强弱:', measureHistory.dynamics);
if (DEBUG)   console.log('[DEBUG 稳定性评分] 计算结果 - 节奏:', rhythmStability, '音色:', toneStability, '强弱:', dynamicsStability);
  
  // 综合稳定性（三个维度的平均）
  const overallStability = Math.round((rhythmStability + toneStability + dynamicsStability) / 3);
  
  // 更新显示
  if (rhythmStabilityEl) rhythmStabilityEl.textContent = rhythmStability > 0 ? rhythmStability : '--';
  if (toneStabilityEl) toneStabilityEl.textContent = toneStability > 0 ? toneStability : '--';
  if (dynamicsStabilityEl) dynamicsStabilityEl.textContent = dynamicsStability > 0 ? dynamicsStability : '--';
  if (overallStabilityEl) overallStabilityEl.textContent = overallStability > 0 ? overallStability : '--';
  
  if (measureHistory.rhythm.length >= MAX_HISTORY) {
if (DEBUG)     console.log('[DEBUG 历史稳定性] 节奏:', rhythmStability, '音色:', toneStability, '强弱:', dynamicsStability, '综合:', overallStability);
  }
}

// 计算小节时长（毫秒）
function getMeasureDuration() {
  const pattern = getActiveRhythm(currentRhythm);
  if (!pattern) return 4000;  // 默认 4 秒
  
  // 计算节奏型的总拍数
  const totalBeats = pattern.beats || 4;
  
  // 计算一拍时长（毫秒）
  const beatDuration = (60 / currentBPM) * 1000;
  
  // 小节时长 = 拍数 × 一拍时长
  return totalBeats * beatDuration;
}

// 检查是否需要更新小节评分
function checkMeasureUpdate() {
  if (!isListening) return;
  
  const now = Date.now();
  const measureDuration = getMeasureDuration();
  const timeInMeasure = now - currentMeasureStartTime;
  
  // 防止重复评分：检查是否已经对当前小节评分过
  if (lastScoredMeasureEnd > 0 && now - lastScoredMeasureEnd < measureDuration * 0.5) {
    return;
  }
  
  // 如果当前小节已结束，计算评分并开始新小节
  if (timeInMeasure >= measureDuration && currentMeasureStrums.length >= 2) {
    // 计算小节评分
    const pattern = getActiveRhythm(currentRhythm);
    const rhythmScore = calculateRhythmScore(currentMeasureStrums, pattern);
    const toneScore = calculateToneScore(currentMeasureStrums);
    const dynamicsScore = calculateDynamicsScore(currentMeasureStrums, pattern);
    
    // 计算总分
    const totalScore = Math.round(
      rhythmScore * 0.5 + 
      toneScore * 0.3 + 
      dynamicsScore * 0.2
    );
    
    // 保存评分
    lastMeasureScores = { rhythm: rhythmScore, tone: toneScore, dynamics: dynamicsScore, total: totalScore };
    
    // 添加到历史记录
    measureHistory.rhythm.push(rhythmScore);
    measureHistory.tone.push(toneScore);
    measureHistory.dynamics.push(dynamicsScore);
    
    // 保持最近 10 个小节
    if (measureHistory.rhythm.length > MAX_HISTORY) measureHistory.rhythm.shift();
    if (measureHistory.tone.length > MAX_HISTORY) measureHistory.tone.shift();
    if (measureHistory.dynamics.length > MAX_HISTORY) measureHistory.dynamics.shift();
    
    // 更新显示
    rhythmScoreEl.textContent = rhythmScore;
    toneScoreEl.textContent = toneScore;
    dynamicsScoreEl.textContent = dynamicsScore;
    totalScoreEl.textContent = totalScore;
    
    // 更新评分环颜色
    updateScoreRing(rhythmRingEl, rhythmScoreEl, rhythmScore);
    updateScoreRing(toneRingEl, toneScoreEl, toneScore);
    updateScoreRing(dynamicsRingEl, dynamicsScoreEl, dynamicsScore);
    updateScoreRing(totalRingEl, totalScoreEl, totalScore);
    
    // 更新历史稳定性评分
    updateStabilityScores();
    
if (DEBUG)     console.log('[DEBUG 小节评分] 小节时长:', measureDuration, 'ms, 扫弦数:', currentMeasureStrums.length, '得分:', totalScore);
    
    // 记录评分时间戳，防止重复评分
    lastScoredMeasureEnd = now;
    
    // 开始新小节
    currentMeasureStartTime = now;
    currentMeasureStrums = [];
  }
}

// 全局状态
let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;

// 按小节评分相关
let currentMeasureStartTime = 0;  // 当前小节开始时间
let currentMeasureStrums = [];    // 当前小节的扫弦数据
let lastMeasureScores = { rhythm: 0, tone: 0, dynamics: 0, total: 0 };  // 上次小节评分
let lastScoredMeasureEnd = 0;     // 上次评分的小节结束时间戳（防止重复评分）

// 历史稳定性评分相关
let measureHistory = {
  rhythm: [],    // 节奏评分历史
  tone: [],      // 音色评分历史
  dynamics: []   // 强弱评分历史
};
const MAX_HISTORY = 4;  // 保留最近 4 个小节
let currentRhythm = 0;
let detectedStrums = [];
let lastStrumTime = 0;
let expectedStrumIndex = 0;
let strumHistory = [];

// 预分配的音频缓冲区（避免每帧分配）
let freqDataCache = null;
let timeDataCache = null;

// ========== 性能优化：帧率控制变量 ==========
let lastAnalyzeTime = 0;
const ANALYZE_INTERVAL = 33; // 30 FPS (~33ms)
let lastRecorderDrawTime = 0;
const RECORDER_DRAW_INTERVAL = 100; // 10 FPS (~100ms)
let lastSpectrumDrawTime = 0;
const SPECTRUM_DRAW_INTERVAL = 67; // 15 FPS (~67ms)
let lastRMSForWaveform = 0;
let lastWaveformDrawTime = 0;
const WAVEFORM_REDRAW_INTERVAL = 50; // 20 FPS max for main waveform
let lastStrumEventTime = 0; // Track last strum for waveform redraw trigger

// ========== 离屏 Canvas 缓冲 ==========
let spectrumOffscreenCanvas = null;
let spectrumOffscreenCtx = null;
let spectrumBackgroundDirty = true;
let lastSpectrumCanvasWidth = 0;
let lastSpectrumCanvasHeight = 0;

// ========== Spectral Flux Onset Detection 全局变量 ==========
let previousSpectrum = null;  // 上一帧频谱
let fluxBuffer = [];          // Spectral Flux 缓冲区
let fluxBufferSize = 43;      // 约 1 秒的缓冲区 (43 帧 @ ~43fps)
let fluxThreshold = 0;        // 自适应阈值
let fluxPeakCooldown = 0;     // 峰值检测冷却时间 (帧数)
const FLUX_COOLDOWN_FRAMES = 3;  // 峰值后冷却 3 帧 (~70ms)

// Blob URL 追踪（用于和弦指法图绘制，防止内存泄漏）
let _chordDiagramBlobUrl = null;

// DOM 元素（在 init 中初始化）
let btnStart, btnStop, statusIndicator, statusText, rhythmSelector;
let rhythmScoreEl, toneScoreEl, dynamicsScoreEl, totalScoreEl;
let rhythmRingEl, toneRingEl, dynamicsRingEl, totalRingEl;
let feedbackMessage, historyList, canvas, canvasCtx;
let metronomeToggle, bpmSlider, bpmValue, demoButtons, metronomeDot;
let sensitivitySlider, sensitivityValueEl, thresholdDisplay, volumeMeterFill;
let statsChartCanvas, statsChartCtx, avgScoreEl, maxScoreEl, practiceCountEl;
let btnAddRhythm, btnMicTest;
let practiceReportModal;
let accuracyTrendChartInstance = null;
let transitionTimeTrendChartInstance = null;

// Windows 录音机波形图
let recorderCanvas, recorderCtx;
let recorderWaveformData = [];  // 波形数据缓冲区
const RECORDER_BUFFER_SIZE = 300;  // 波形数据点数
let _diagnosticFrameCounter = 0;  // 诊断日志帧计数器

// 时域频谱图
let spectrumCanvas, spectrumCtx;
let spectrumHistory = [];  // 频谱历史缓冲区（用于 STFT 热力图）
const SPECTRUM_HISTORY_SIZE = 60;  // 保留 60 帧历史（约 1 秒，60 FPS）

// 和弦训练 DOM 元素
let modeButtons, modePreset, modeCustom, modeFree;
let presetSelector, progressionSelect;
let customChordSelector, selectedChordsDisplay;
let currentChordDisplay, nextChordDisplay;
let currentChordCanvas, nextChordCanvas;
let recognizedChordEl, chordConfidenceEl;
let transitionTimeEl, progressionBar, progressionProgress;
let btnSaveProgression, btnClearProgression;
let chordTrainingPanel;

// 练习模式 DOM 元素
let practiceModeRhythm, practiceModeComprehensive, practiceModeDescription;

// 版本号
const DEBUG = false;  // 生产环境关闭调试日志
const APP_VERSION = 'v2.0';

// 初始化
function setupPracticeReport() {
  const btnClose1 = document.getElementById('btnCloseReport');
  const btnClose2 = document.getElementById('btnCloseReport2');
  const modal = document.getElementById('practiceReportModal');
  
  if (btnClose1) {
    btnClose1.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  if (btnClose2) {
    btnClose2.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
}

/**
 * 显示练习报告弹窗
 */
function showPracticeReport() {
  if (!practiceReportModal) return;
  
  const duration = practiceStartTime > 0 ? Math.round((Date.now() - practiceStartTime) / 1000) : 0;
  
  const transitionStats = transitionDetector ? transitionDetector.getStats() : null;
  const transitionCount = transitionStats ? transitionStats.transitionCount : 0;
  const avgTransitionTime = transitionStats ? Math.round(transitionStats.avgTransitionTime) : 0;
  
  const accuracy = practiceChordTotal > 0 ? Math.round((practiceChordCorrect / practiceChordTotal) * 100) : 0;
  
  const bestTransition = practiceTransitionTimes.length > 0 ? Math.min(...practiceTransitionTimes) : null;
  const worstTransition = practiceTransitionTimes.length > 0 ? Math.max(...practiceTransitionTimes) : null;
  
  const fluencyScore = (typeof calculateFluencyScore === 'function') ? calculateFluencyScore(avgTransitionTime, practiceTransitionTimes, duration) : 75;
  const totalScore = parseInt(totalScoreEl.textContent) || 0;
  
  const reportTransitionsEl = document.getElementById('reportTransitions');
  const reportAvgTimeEl = document.getElementById('reportAvgTime');
  const reportAccuracyEl = document.getElementById('reportAccuracy');
  const reportFluencyEl = document.getElementById('reportFluency');
  const reportBestEl = document.getElementById('reportBestTransition');
  const reportWorstEl = document.getElementById('reportWorstTransition');
  
  document.getElementById('reportDuration').textContent = duration + 's';
  document.getElementById('reportTotalScore').textContent = totalScore;
  
  if (practiceMode === 'comprehensive') {
    reportTransitionsEl.textContent = transitionCount;
    reportAvgTimeEl.textContent = avgTransitionTime > 0 ? avgTransitionTime + 'ms' : '--';
    reportAccuracyEl.textContent = accuracy > 0 ? accuracy + '%' : '--';
    reportFluencyEl.textContent = fluencyScore > 0 ? fluencyScore : '--';
    
    reportBestEl.textContent = bestTransition !== null ? Math.round(bestTransition) + 'ms' : '--';
    reportWorstEl.textContent = worstTransition !== null ? Math.round(worstTransition) + 'ms' : '--';
  } else {
    reportTransitionsEl.textContent = '--';
    reportAvgTimeEl.textContent = '--';
    reportAccuracyEl.textContent = '--';
    reportFluencyEl.textContent = '--';
    
    reportBestEl.textContent = '--';
    reportWorstEl.textContent = '--';
  }
  
  // 渲染趋势图（如果函数存在）
  if (typeof renderTrendCharts === 'function') {
    renderTrendCharts();
  }
  
  practiceReportModal.style.display = 'block';
}

function init() {
  if (DEBUG) console.log(`[GuitarStrumTrainer] ${APP_VERSION} 开始初始化...`);
  
  // 获取所有 DOM 元素
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
  // canvas 已移除 (UI 优化)
  // canvasCtx 已移除 (UI 优化)
  
  // Windows 录音机波形图
  recorderCanvas = document.getElementById('recorderWaveform');
  recorderCtx = recorderCanvas ? recorderCanvas.getContext('2d') : null;
  if (recorderCanvas) {
    // 设置 canvas 实际像素尺寸（和上方波形一致）
    setTimeout(() => {
      recorderCanvas.width = recorderCanvas.offsetWidth || 600;
      recorderCanvas.height = recorderCanvas.offsetHeight || 120;
if (DEBUG)       console.log('[DEBUG Canvas] recorder canvas:', recorderCanvas.width, 'x', recorderCanvas.height);
    }, 100);
  }
  
  // 时域频谱图
  spectrumCanvas = document.getElementById('spectrumWaveform');
  spectrumCtx = spectrumCanvas ? spectrumCanvas.getContext('2d') : null;
  if (spectrumCanvas) {
    setTimeout(() => {
      spectrumCanvas.width = spectrumCanvas.offsetWidth || 600;
      spectrumCanvas.height = spectrumCanvas.offsetHeight || 120;
if (DEBUG)       console.log('[DEBUG Canvas] spectrum canvas:', spectrumCanvas.width, 'x', spectrumCanvas.height);
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
  
  // 历史稳定性评分 DOM 元素
  const rhythmStabilityEl = document.getElementById('rhythmStabilityScore');
  const toneStabilityEl = document.getElementById('toneStabilityScore');
  const dynamicsStabilityEl = document.getElementById('dynamicsStabilityScore');
  const overallStabilityEl = document.getElementById('overallStabilityScore');
  
  metronomeDot = document.getElementById('metronomeDot');
  btnAddRhythm = document.getElementById('btnAddRhythm');
  btnMicTest = document.getElementById('btnMicTest');
  
  // 和弦训练 DOM 元素
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
  
  // 练习模式 DOM 元素
  practiceModeRhythm = document.getElementById('practiceModeRhythm');
  practiceModeComprehensive = document.getElementById('practiceModeComprehensive');
  practiceModeDescription = document.getElementById('practiceModeDescription');
  
  if (DEBUG) console.log('[GuitarStrumTrainer] DOM 元素获取完成', {
    btnStart: !!btnStart,
    btnStop: !!btnStop,
    demoButtons: demoButtons?.length || 0,
    chordElements: !!currentChordDisplay
  });
  
  // 初始化和弦训练功能
  setupChordTraining();
  
  // 初始化练习模式切换
  setupPracticeMode();
  
  setupRhythmSelector();
  setupMetronome();
  setupDemoButtons();
  setupSensitivity();
  setupAddRhythmCard();
  setupMicTest();
  loadHistoryFromStorage();
  renderHistory();
  renderStatsChart();
  updateStatus('ready');
  
  // 预加载吉他音源
  loadGuitarSoundfont();
  
  // 初始化自定义节奏型功能
  initCustomRhythms();
  
  // 初始化图表折叠功能
  setupChartToggle();
  
  // 初始化练习报告模态框
  setupPracticeReport();
  
  if (DEBUG) console.log('[GuitarStrumTrainer] 初始化完成');
}

// 设置节奏型选择
function setupRhythmSelector() {
  const options = rhythmSelector.querySelectorAll('.rhythm-option');
  options.forEach((option, index) => {
    option.addEventListener('click', (e) => {
      if (isListening) return;
      if (e.target.classList.contains('btn-demo')) return; // 防止点击演示按钮时触发
      
      options.forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      currentRhythm = index;
      
      const pattern = getActiveRhythm(index);
      if (!pattern) return;
      feedbackMessage.textContent = `已选择：${pattern.name} - ${pattern.description}`;
    });
  });
}

// 设置节拍器
function setupMetronome() {
  if (!metronomeToggle || !bpmSlider) return;
  
  metronomeToggle.addEventListener('change', (e) => {
    metronomeEnabled = e.target.checked;
    if (metronomeEnabled && isListening) {
      startMetronome();
    } else {
      stopMetronome();
    }
    feedbackMessage.textContent = metronomeEnabled 
      ? `节拍器已开启 - ${currentBPM} BPM (建议戴耳机使用)` 
      : '节拍器已关闭';
  });
  
  bpmSlider.addEventListener('input', (e) => {
    currentBPM = parseInt(e.target.value);
    bpmValue.textContent = currentBPM;
    if (metronomeEnabled && isListening) {
      stopMetronome();
      startMetronome();
    }
  });
}

// 演示按钮点击保护时间戳（防止快速重复点击）
let lastDemoClickTime = 0;

// 设置演示按钮（使用事件委托，避免 cloneNode 导致监听器累积）
let demoButtonsSetup = false;
function setupDemoButtons() {
  if (demoButtonsSetup) return;
  
  rhythmSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-demo');
    if (!btn) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const now = Date.now();
    if (now - lastDemoClickTime < 100) {
      if (DEBUG) console.log('[GuitarStrumTrainer] Demo click too fast, ignoring');
      return;
    }
    lastDemoClickTime = now;
    
    // 预设节奏型
    if (btn.dataset.rhythm !== undefined) {
      const rhythmIndex = parseInt(btn.dataset.rhythm);
      if (DEBUG) console.log('[GuitarStrumTrainer] Demo button clicked:', { rhythmIndex, isPlayingDemo: getIsPlayingDemo() });
      
      if (getIsPlayingDemo()) {
        if (DEBUG) console.log('[GuitarStrumTrainer] Stopping demo...');
        stopDemo();
      } else {
        if (DEBUG) console.log('[GuitarStrumTrainer] Starting demo...');
        playDemo(rhythmIndex, btn);
      }
      return;
    }
    
    // 自定义节奏型
    if (btn.dataset.customIndex !== undefined) {
      const customIndex = parseInt(btn.dataset.customIndex);
      if (DEBUG) console.log('[GuitarStrumTrainer] Custom demo button clicked:', { customIndex, isPlayingDemo: getIsPlayingDemo() });
      
      if (getIsPlayingDemo()) {
        if (DEBUG) console.log('[GuitarStrumTrainer] Stopping custom demo...');
        stopDemo();
      } else {
        if (DEBUG) console.log('[GuitarStrumTrainer] Starting custom demo...');
        playCustomRhythmFromList(customIndex, btn);
      }
      return;
    }
  });
  
  demoButtonsSetup = true;
}

// 播放节拍器声音 - 保留原有简洁的电子滴答声
// 与扫弦音色区分开，使用纯 sine 波确保节拍器声音清晰可辨
function playMetronomeSound(frequency = 1000, duration = 0.05) {
  if (!audioContextForMetronome) {
    audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // 移动端修复：确保 AudioContext 已恢复
  if (audioContextForMetronome.state === 'suspended') {
    audioContextForMetronome.resume().catch(err => {
      console.warn('[GuitarStrumTrainer] AudioContext resume failed:', err);
    });
  }
  
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

// 开始节拍器
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

// 触发节拍器呼吸灯
function triggerMetronomeDot(isAccent) {
  if (!metronomeDot) return;
  metronomeDot.classList.add('accent');
  if (isAccent) {
    metronomeDot.classList.add('accent');
  } else {
    metronomeDot.classList.remove('accent');
  }
  setTimeout(() => {
    metronomeDot.classList.remove('accent');
  }, 150);
}

// 停止节拍器
function stopMetronome() {
  if (metronomeInterval) {
    clearInterval(metronomeInterval);
    metronomeInterval = null;
  }
}


// 播放节奏型演示 - 循环播放版本
async function playDemo(rhythmIndex, btnElement) {
  if (DEBUG) console.log('[GuitarStrumTrainer] playDemo starting, setting isPlayingDemo=true');
  setIsPlayingDemo(true);
  demoLoopCount = 0;
  currentDemoRhythmIndex = rhythmIndex;
  currentPlayingDemoBtn = btnElement;
  
  // 安全地更新按钮状态（兼容虚拟按钮对象）
  if (btnElement && btnElement.classList) {
    btnElement.classList.add('playing');
  }
  if (btnElement && btnElement.textContent !== undefined) {
    btnElement.textContent = '⏹ 停止演示';
  }
  
  const pattern = getActiveRhythm(rhythmIndex);
  if (!pattern) {
    console.error('[GuitarStrumTrainer] 节奏型未找到:', rhythmIndex);
    return;
  }
  let noteIndex = 0;
  
  async function playNextNote() {
    if (DEBUG) console.log('[GuitarStrumTrainer] playNextNote check:', { isPlayingDemo: getIsPlayingDemo(), noteIndex });
    if (!getIsPlayingDemo()) {
      if (DEBUG) console.log('[GuitarStrumTrainer] playNextNote: isPlayingDemo=false, stopping');
      return;
    }
    
    if (DEBUG) console.log('[GuitarStrumTrainer] playNextNote:', { noteIndex, patternLength: pattern.pattern.length });
    
    // 检测一轮结束，开始新一轮
    if (noteIndex > 0 && noteIndex % pattern.pattern.length === 0) {
      demoLoopCount++;
      feedbackMessage.textContent = `演示播放中 - 第 ${demoLoopCount + 1} 轮`;
      if (DEBUG) console.log('[GuitarStrumTrainer] Starting loop', demoLoopCount + 1);
    }
    
    const direction = pattern.demo[noteIndex % pattern.demo.length];
    
    try {
      // 如果是自定义节奏型，传递力度参数
      if (pattern.isCustom && pattern.notes && pattern.notes[noteIndex % pattern.notes.length]) {
        const noteData = pattern.notes[noteIndex % pattern.notes.length];
        await playStrumSound(direction, 0.15, [noteData.velocity, noteData.velocity, noteData.velocity, noteData.velocity, noteData.velocity, noteData.velocity]);
      } else {
        await playStrumSound(direction);
      }
    } catch (err) {
      console.error('[GuitarStrumTrainer] playStrumSound error:', err);
    }
    
    // 视觉反馈 - 添加空值检查（自定义节奏型没有对应的 DOM 元素）
    const options = rhythmSelector.querySelectorAll('.rhythm-option');
    options.forEach(o => o.classList.remove('active'));
    if (options[rhythmIndex]) {
      options[rhythmIndex].classList.add('active');
    }
    
    // 根据当前 BPM 动态计算节拍间隔
    const baseBPM = 120;
    const patternDuration = pattern.pattern[noteIndex % pattern.pattern.length];
    const intervalMs = patternDuration * (baseBPM / currentBPM);
    
    if (DEBUG) console.log('[GuitarStrumTrainer] Scheduling next note:', {
      noteIndex,
      patternDuration,
      baseBPM,
      currentBPM,
      intervalMs,
      isCustom: pattern.isCustom
    });
    
    noteIndex++;
    
    demoTimeout = setTimeout(playNextNote, intervalMs);
  }
  
  feedbackMessage.textContent = `演示播放中 - 第 1 轮`;
  playNextNote();
}

// 停止演示
function stopDemo() {
  if (DEBUG) console.log('[GuitarStrumTrainer] stopDemo called from:', new Error().stack.split('\n')[2]);
  if (DEBUG) console.log('[GuitarStrumTrainer] stopDemo: isPlayingDemo was', getIsPlayingDemo());
  setIsPlayingDemo(false);
  if (demoTimeout) clearTimeout(demoTimeout);
  if (window.customRhythmCleanup) {
    clearTimeout(window.customRhythmCleanup);
    window.customRhythmCleanup = null;
  }
  demoLoopCount = 0;
  currentDemoRhythmIndex = -1;
  
  if (DEBUG) console.log('[GuitarStrumTrainer] stopDemo: clearing timeout and resetting state');
  currentPlayingDemoBtn = null;
  
  // 重置所有演示按钮（动态查询所有 .btn-demo，包括初始和自定义）
  const allDemoBtns = document.querySelectorAll('.btn-demo');
  allDemoBtns.forEach(btn => {
    if (btn && btn.classList) {
      btn.classList.remove('playing');
    }
    if (btn && btn.textContent !== undefined) {
      btn.textContent = '🔊 试听演示';
    }
  });
  
  // 重置自定义节奏型列表中的试听按钮
  const customPlayBtns = document.querySelectorAll('#customRhythmsList .btn-custom-play');
  customPlayBtns.forEach(btn => {
    if (btn.classList.contains('playing')) {
      btn.classList.remove('playing');
      btn.textContent = '🔊 试听';
    }
  });
  
  playingCustomBtn = null;
}

// 设置灵敏度
function setupSensitivity() {
  if (!sensitivitySlider) return;
  
  sensitivitySlider.addEventListener('input', (e) => {
    sensitivityLevel = parseInt(e.target.value);
    if (sensitivityValueEl) {
      sensitivityValueEl.textContent = sensitivityLevel;
    }
    updateThreshold();
    
    // 实时反馈
    if (!isListening) {
      feedbackMessage.textContent = `灵敏度：${sensitivityLevel} (阈值：${strumThreshold.toFixed(2)}) - 开始练习后生效`;
    }
  });
  
  // 初始化阈值
  updateThreshold();
}

// 设置添加节奏型卡片
function setupAddRhythmCard() {
  if (!btnAddRhythm) return;
  btnAddRhythm.addEventListener('click', () => {
    openNewRhythmEditor();
  });
}

// 设置麦克风检测按钮
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
        
        if (volumeMeterFill) {
          volumeMeterFill.style.width = Math.min(100, (avg / 128) * 100) + '%';
        }
        
        if (checkCount < 30) {
          requestAnimationFrame(checkLevel);
        } else {
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

// 设置图表折叠切换
function setupChartToggle() {
  const toggleBtn = document.getElementById('chartToggleBtn');
  const chartSection = document.getElementById('statsChartSection');
  if (!toggleBtn || !chartSection) return;
  
  const collapsed = localStorage.getItem('guitarStrumChartCollapsed') === 'true';
  if (collapsed) {
    chartSection.classList.add('collapsed');
    toggleBtn.textContent = '▶';
  }
  
  toggleBtn.addEventListener('click', () => {
    chartSection.classList.toggle('collapsed');
    const isCollapsed = chartSection.classList.contains('collapsed');
    toggleBtn.textContent = isCollapsed ? '▶' : '▼';
    localStorage.setItem('guitarStrumChartCollapsed', isCollapsed);
  });
}

// ========== 真实吉他音源函数 ==========

// 加载吉他音源 (FluidR3 GM - Acoustic Guitar Steel String)
async function loadGuitarSoundfont() {
  if (soundfontLoading || soundfontLoaded) return;
  
  soundfontLoading = true;
  if (DEBUG) console.log('[GuitarStrumTrainer] 开始加载吉他音源 (FluidR3 GM - 钢弦吉他)...');
  
  try {
    // 检查 Soundfont 全局对象是否存在
    if (typeof window.Soundfont === 'undefined') {
      console.warn('[GuitarStrumTrainer] Soundfont 未加载，使用合成音色');
      soundfontLoading = false;
      return;
    }
    
    // 使用 soundfont-player 加载 Steel String Guitar
    // 音源来自 https://github.com/gleitz/midi-js-soundfonts (FluidR3_GM - 音质更好)
    // 注意：instrument 方法签名是 instrument(audioContext, name, options)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    guitarSoundfont = await window.Soundfont.instrument(audioContext, 'acoustic_guitar_steel', {
      soundfont: 'FluidR3_GM', // FluidR3_GM 音质更温暖自然
      gain: 1.5 // 增加音量
    });
    
    soundfontLoaded = true;
    if (DEBUG) console.log('[GuitarStrumTrainer] ✓ 吉他音源加载完成 (FluidR3_GM)');
    
  } catch (error) {
    console.error('[GuitarStrumTrainer] 音源加载失败:', error);
    console.warn('[GuitarStrumTrainer] 将使用合成音色作为备选');
    soundfontLoading = false;
  }
}

// 播放真实吉他扫弦声音
// 改进点：
// 1. 使用 FluidR3 GM 真实钢弦吉他采样 (CC0 授权)
// 2. 模拟真实扫弦：6 根弦错开 8-15ms，营造从上到下/从下到上的扫弦感
// 3. 下扫 (D) 和上扫 (U) 使用不同的弦组合、力度和速度
// 4. 8 分音符重扫低音区，16 分音符轻扫高音区
// 5. 16 分音符也区分上下扫（下扫更轻，上扫稍强）
// 6. 添加轻微力度变化，让每次扫弦都有细微差别
async function playStrumSound(direction, duration = 0.15, noteVelocities = null) {
  if (DEBUG) console.log('[GuitarStrumTrainer] playStrumSound:', { direction, hasSoundfont: !!guitarSoundfont });
  
  if (!guitarSoundfont) {
    if (DEBUG) console.log('[GuitarStrumTrainer] playStrumSound: using synth fallback');
    await playStrumSoundSynth(direction, duration);
    return;
  }
  
  // 确保 AudioContext 已恢复
  const ctx = guitarSoundfont.context;
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  
  // E 大调和弦：E3, B3, E4, G#4, B4, E5 (标准吉他调弦)
  // 低音区：E3, B3, E4 (3 根弦) - 8 分音符，重扫
  // 高音区：G#4, B4, E5 (3 根弦) - 16 分音符，轻扫
  const bassNotes = ['E3', 'B3', 'E4'];   // 低音区
  const trebleNotes = ['G#4', 'B4', 'E5']; // 高音区
  const isDownStrum = direction === 'D';
  
  // 下扫：低音区 → 高音区
  // 上扫：高音区 → 低音区
  const bassOrder = isDownStrum ? [...bassNotes] : [...bassNotes].reverse();
  const trebleOrder = isDownStrum ? [...trebleNotes] : [...trebleNotes].reverse();
  
  // 扫弦速度参数
  const bassStrumSpeed = isDownStrum ? 0.008 : 0.012;   // 低音区速度 (8 分音符)
  const trebleStrumSpeed = isDownStrum ? 0.004 : 0.006; // 高音区速度 (16 分音符，更快)
  
  // 力度参数 - 低音区重，高音区轻
  // 如果传入了自定义力度参数，使用自定义的；否则使用默认的
  let bassVelocity, trebleVelocity;
  
  if (noteVelocities && Array.isArray(noteVelocities) && noteVelocities.length >= 6) {
    // 使用自定义力度（前 3 个是低音区，后 3 个是高音区）
    bassVelocity = noteVelocities[0];
    trebleVelocity = noteVelocities[3];
  } else {
    // 默认力度
    // 低音区：下扫强 (1.0)，上扫中 (0.6)
    bassVelocity = isDownStrum ? 1.0 : 0.6;
    // 高音区：下扫中 (0.3)，上扫轻 (0.2) - 下扫比上扫重
    trebleVelocity = isDownStrum ? 0.3 : 0.2;
  }
  
  const now = ctx.currentTime;
  let currentTime = now;
  
  // 先扫低音区 (8 分音符，重扫)
  bassOrder.forEach((note, index) => {
    const delay = index * bassStrumSpeed;
    const randomVelocity = bassVelocity * (0.9 + Math.random() * 0.2);
    guitarSoundfont.play(note, currentTime + delay, {
      gain: randomVelocity,
      duration: duration
    });
  });
  
  // 再扫高音区 (16 分音符，轻扫) - 延迟一点，模拟扫弦动作
  const trebleDelay = bassNotes.length * bassStrumSpeed + 0.015; // 低音区扫完后 +15ms
  trebleOrder.forEach((note, index) => {
    const delay = trebleDelay + (index * trebleStrumSpeed);
    const randomVelocity = trebleVelocity * (0.9 + Math.random() * 0.2);
    guitarSoundfont.play(note, currentTime + delay, {
      gain: randomVelocity,
      duration: duration
    });
  });
}

// 备选合成音色 (当音源加载失败时使用) - 增强音量版
async function playStrumSoundSynth(direction, duration = 0.15) {
  if (DEBUG) console.log('[GuitarStrumTrainer] playStrumSoundSynth:', { direction, duration });
  
  if (!audioContextForMetronome) {
    audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
    if (DEBUG) console.log('[GuitarStrumTrainer] Created new AudioContext');
  }
  
  // 移动端修复：确保 AudioContext 已恢复
  if (audioContextForMetronome.state === 'suspended') {
    if (DEBUG) console.log('[GuitarStrumTrainer] Resuming AudioContext...');
    await audioContextForMetronome.resume();
    if (DEBUG) console.log('[GuitarStrumTrainer] AudioContext resumed, state:', audioContextForMetronome.state);
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
  
  // 增强基础音量：0.12 → 0.25 (约 2 倍)
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
      
      osc1.onended = () => {
        osc1.disconnect();
        gain1.disconnect();
      };
      osc2.onended = () => {
        osc2.disconnect();
        gain2.disconnect();
      };
    } catch (e) {
      osc1.disconnect();
      gain1.disconnect();
      osc2.disconnect();
      gain2.disconnect();
      console.error('[GuitarStrumTrainer] Failed to play strum sound:', e);
    }
  });
}

// 设置按钮
function setupButtons() {
  if (!btnStart) {
    console.error('[GuitarStrumTrainer] btnStart 元素未找到');
    return;
  }
  if (!btnStop) {
    console.error('[GuitarStrumTrainer] btnStop 元素未找到');
    return;
  }
  
  btnStart.addEventListener('click', () => {
    if (DEBUG) console.log('[GuitarStrumTrainer] 开始练习按钮被点击');
    startListening();
  });
  
  btnStop.addEventListener('click', () => {
    if (DEBUG) console.log('[GuitarStrumTrainer] 停止按钮被点击');
    stopListening();
  });
  
  if (DEBUG) console.log('[GuitarStrumTrainer] 按钮事件绑定成功');
}

// 设置画布

// 更新状态
function updateStatus(status) {
  statusIndicator.className = 'status-indicator ' + status;
  switch(status) {
    case 'ready':
      statusText.textContent = '准备就绪';
      break;
    case 'listening':
      statusText.textContent = '正在监听...';
      break;
    case 'error':
      statusText.textContent = '发生错误';
      break;
  }
}

// 开始监听
async function startListening() {
if (DEBUG)   console.log('[DEBUG startListening] 开始监听函数被调用');
  try {
    // 检查浏览器支持
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('[DEBUG startListening] 浏览器不支持麦克风访问');
      throw new Error('浏览器不支持麦克风访问');
    }
    
    // 检查是否是 HTTPS 或 localhost
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.error('[DEBUG startListening] 不是 HTTPS 或 localhost', location.protocol, location.hostname);
      throw new Error('麦克风访问需要 HTTPS 连接');
    }
    
    // 请求麦克风权限
if (DEBUG)     console.log('[DEBUG startListening] 请求麦克风权限...');
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0
      } 
    });
    
if (DEBUG)     console.log('[DEBUG startListening] 麦克风权限已获取');
    
    // 创建音频上下文
if (DEBUG)     console.log('[DEBUG startListening] 创建音频上下文...');
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;  // 降低平滑常数，提高响应速度
    
    microphone = audioContext.createMediaStreamSource(stream);
    
    // 增加麦克风增益：创建增益节点并设置为 15.0 倍（大幅提高灵敏度，适应录音回放）
    const micGain = audioContext.createGain();
    micGain.gain.value = 15.0;  // 15 倍增益，适应录音回放
    microphone.connect(micGain);
    micGain.connect(analyser);
    
if (DEBUG)     console.log('[DEBUG startListening] 音频上下文和节点已创建，麦克风增益：15.0x');
    
    isListening = true;
    detectedStrums = [];
    currentMeasureStrums = [];
    lastStrumTime = 0;  // 重置为 0，表示还没有扫弦
    currentMeasureStartTime = Date.now();  // 开始新小节
    expectedStrumIndex = 0;
    
    // 重置历史评分记录
    measureHistory = { rhythm: [], tone: [], dynamics: [] };
    lastMeasureScores = { rhythm: 0, tone: 0, dynamics: 0, total: 0 };
    lastScoredMeasureEnd = 0;
    
    // 重置稳定性评分显示
    const rhythmStabilityEl = document.getElementById('rhythmStabilityScore');
    const toneStabilityEl = document.getElementById('toneStabilityScore');
    const dynamicsStabilityEl = document.getElementById('dynamicsStabilityScore');
    const overallStabilityEl = document.getElementById('overallStabilityScore');
    if (rhythmStabilityEl) rhythmStabilityEl.textContent = '--';
    if (toneStabilityEl) toneStabilityEl.textContent = '--';
    if (dynamicsStabilityEl) dynamicsStabilityEl.textContent = '--';
    if (overallStabilityEl) overallStabilityEl.textContent = '--';
    
if (DEBUG)     console.log('[DEBUG startListening] 状态已重置 - lastStrumTime:', lastStrumTime, 'detectedStrums.length:', detectedStrums.length);
    
    // 重置 Spectral Flux Onset Detection 状态
    previousSpectrum = null;
    fluxBuffer = [];
    fluxThreshold = 0;
    fluxPeakCooldown = 0;
    
    // 重置练习数据统计
    practiceStartTime = Date.now();
    practiceChordCorrect = 0;
    practiceChordTotal = 0;
    practiceTransitionTimes = [];
    
    // 初始化和弦检测器
    initChordDetector();
    resetChordTraining();
    
    // 根据练习模式设置和弦识别
    if (practiceMode === 'comprehensive') {
      chordRecognitionEnabled = true;
    } else {
      chordRecognitionEnabled = false;
    }
    
    btnStart.style.display = 'none';
    btnStop.style.display = 'block';
    updateStatus('listening');
    
    // 如果开启了节拍器，启动节拍器
    if (metronomeEnabled) {
      startMetronome();
      const activeRhythm = getActiveRhythm(currentRhythm);
      feedbackMessage.textContent = `🎯 开始练习：${activeRhythm.name} (节拍器：${currentBPM} BPM)`;
    } else {
      const activeRhythm = getActiveRhythm(currentRhythm);
      feedbackMessage.textContent = `🎯 开始练习：${activeRhythm.name}`;
    }
    
    // 开始分析循环
if (DEBUG)     console.log('[DEBUG startListening] 开始调用 analyzeAudio()');
    analyzeAudio();
if (DEBUG)     console.log('[DEBUG startListening] analyzeAudio() 已启动');
    
  } catch (err) {
    console.error('[GuitarStrumTrainer] 音频初始化失败:', err.name, err.message);
    
    let errorMsg = '❌ 无法访问麦克风';
    
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMsg = '❌ 麦克风权限被拒绝\n\n请在浏览器设置中允许麦克风访问，然后刷新页面';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMsg = '❌ 未找到麦克风设备\n\n请检查麦克风是否已连接';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMsg = '❌ 麦克风被其他程序占用\n\n请关闭其他使用麦克风的程序后重试';
    } else if (err.message.includes('HTTPS')) {
      errorMsg = '❌ 需要 HTTPS 连接\n\n请使用 https:// 开头的网址访问';
    }
    
    feedbackMessage.textContent = errorMsg;
    updateStatus('error');
  }
}

// 停止监听
function stopListening() {
  isListening = false;
  chordRecognitionEnabled = false;
  
  // 重置转换时间记录
  practiceTransitionTimes = [];
  
  // 停止节拍器
  stopMetronome();
  
  // 停止演示
  if (getIsPlayingDemo()) {
    stopDemo();
  }
  
  // 性能优化：清理自动保存定时器，防止内存泄漏
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId);
    autoSaveIntervalId = null;
  }
  
  if (microphone) {
    microphone.mediaStream.getTracks().forEach(track => track.stop());
    microphone.disconnect();
    microphone = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  
  btnStart.style.display = 'block';
  btnStop.style.display = 'none';
  updateStatus('ready');
  
  // 保存历史记录
  if (detectedStrums.length > 0) {
    saveHistory();
  }
  
  // 显示练习报告
  if (detectedStrums.length > 0) {
    showPracticeReport();
  }
  
  // 显示和弦训练统计（仅综合模式）
  if (practiceMode === 'comprehensive' && transitionDetector && transitionDetector.getStats().transitionCount > 0) {
    const stats = transitionDetector.getStats();
    feedbackMessage.textContent = `和弦准确率：${stats.accuracy}% | 平均转换时间：${stats.avgTransitionTime}ms`;
  } else {
    feedbackMessage.textContent = metronomeEnabled 
      ? `练习结束 (节拍器：${currentBPM} BPM)，点击"开始练习"继续`
      : '练习结束，点击"开始练习"继续';
  }
  
  // 重启自动保存定时器（下次开始监听时可用）
  autoSaveIntervalId = setInterval(() => {
    saveUserSettings();
  }, 5000);
}

// 音频分析主循环
function analyzeAudio() {
  if (!isListening) {
if (DEBUG)     console.log('[DEBUG analyzeAudio] isListening=false，停止分析');
    return;
  }
  
  // 性能优化：节流到 30 FPS
  const now = performance.now();
  const delta = now - lastAnalyzeTime;
  if (delta < ANALYZE_INTERVAL) {
    requestAnimationFrame(analyzeAudio);
    return;
  }
  lastAnalyzeTime = now;
  
if (DEBUG)   console.log('[DEBUG analyzeAudio] 开始分析帧...');
  
  const bufferLength = analyser.frequencyBinCount;
  
  // 使用预分配的缓冲区，避免每帧分配
  if (!freqDataCache || freqDataCache.length !== bufferLength) {
    freqDataCache = new Uint8Array(bufferLength);
    timeDataCache = new Uint8Array(bufferLength);
  }
  
  analyser.getByteFrequencyData(freqDataCache);
  analyser.getByteTimeDomainData(timeDataCache);
  
  // 计算 RMS（和波形图、扫弦检测使用相同的数据源）
  let sum = 0;
  for (let i = 0; i < timeDataCache.length; i++) {
    const normalized = (timeDataCache[i] - 128) / 128;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / timeDataCache.length);
  
  // 更新音量电平（使用 RMS，和波形图一致）
  if (volumeMeterFill) {
    // RMS 范围 0-1，映射到 0-100%
    // 根据灵敏度调整显示增益（灵敏度越高，显示越明显）
    const sensitivityGain = 1 + (sensitivityLevel / 100);  // 1.0-2.0 倍增益
    const volumePercent = Math.min(100, rms * sensitivityGain * 100);
    volumeMeterFill.style.width = volumePercent + '%';
  }
  
  // 绘制时域频谱图 - 节流到 15 FPS
  drawSpectrumWaveform(freqDataCache);
  
  // 检测和弦识别
  // processChordRecognition();  // 已禁用，和弦识别在 detectStrum 中执行
  
  // 检测扫弦
  detectStrum(freqDataCache, timeDataCache, rms);
  
  // 更新评分
  updateScores();
  
  requestAnimationFrame(analyzeAudio);
}



// 绘制 Windows 录音机风格波形（使用传入的 RMS 值）- 节流到 10 FPS
let _recorderDrawCount = 0;
function drawRecorderWaveform(timeData, rms) {
  _recorderDrawCount++;
  if (!recorderCanvas || !recorderCtx) {
if (DEBUG)     if (_recorderDrawCount === 1) console.log('[DEBUG drawRecorderWaveform] recorderCanvas missing');
    return;
  }
  if (recorderCanvas.width === 0 || recorderCanvas.height === 0) {
if (DEBUG)     if (_recorderDrawCount <= 5) console.log('[DEBUG drawRecorderWaveform] canvas size is 0:', recorderCanvas.width, 'x', recorderCanvas.height, 'frame:', _recorderDrawCount);
    return;
  }
  
  // 性能优化：节流到 10 FPS
  const now = performance.now();
  if (now - lastRecorderDrawTime < RECORDER_DRAW_INTERVAL) {
    return;
  }
  lastRecorderDrawTime = now;
  
  // 直接使用传入的 RMS 值（和音量指示条一致）
  // 添加到波形缓冲区
  recorderWaveformData.push(rms);
  if (recorderWaveformData.length > RECORDER_BUFFER_SIZE) {
    recorderWaveformData.shift();
  }
  
  // 清空画布
  recorderCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  recorderCtx.fillRect(0, 0, recorderCanvas.width, recorderCanvas.height);
  
  // 绘制波形（从右向左滚动）
  const gradient = recorderCtx.createLinearGradient(0, 0, recorderCanvas.width, 0);
  gradient.addColorStop(0, 'rgba(184, 102, 255, 0.3)');
  gradient.addColorStop(0.5, 'rgba(184, 102, 255, 0.7)');
  gradient.addColorStop(1, 'rgba(184, 102, 255, 1.0)');
  
  recorderCtx.fillStyle = gradient;
  recorderCtx.strokeStyle = '#b866ff';  // 紫色，和上方波形一致
  recorderCtx.lineWidth = 1;
  
  const barWidth = recorderCanvas.width / RECORDER_BUFFER_SIZE;
  const centerY = recorderCanvas.height / 2;
  
  recorderCtx.beginPath();
  
  for (let i = 0; i < recorderWaveformData.length; i++) {
    // 使用 RMS 值作为波形高度（和音量指示条一致）
    const amplitude = recorderWaveformData[i] * centerY * 3;  // 放大波形
    const x = i * barWidth;
    const y = centerY - amplitude;
    const height = amplitude * 2;
    
    // 绘制垂直条
    recorderCtx.fillRect(x, y, barWidth - 1, height);
  }
  
  // 绘制轮廓线
  recorderCtx.stroke();
  
if (DEBUG)   if (_recorderDrawCount <= 3) console.log('[DEBUG drawRecorderWaveform] drawn successfully, frame:', _recorderDrawCount);
}

// 绘制时域频谱图（STFT 短时傅里叶变换 + 彩虹色热力图）- 节流到 15 FPS + 离屏缓冲优化
let _spectrumDrawCount = 0;
function drawSpectrumWaveform(freqData) {
  _spectrumDrawCount++;
  if (!spectrumCanvas || !spectrumCtx) {
if (DEBUG)     if (_spectrumDrawCount === 1) console.log('[DEBUG drawSpectrumWaveform] spectrumCanvas missing');
    return;
  }
  if (spectrumCanvas.width === 0 || spectrumCanvas.height === 0) {
if (DEBUG)     if (_spectrumDrawCount <= 5) console.log('[DEBUG drawSpectrumWaveform] canvas size is 0:', spectrumCanvas.width, 'x', spectrumCanvas.height, 'frame:', _spectrumDrawCount);
    return;
  }
  if (!freqData) {
if (DEBUG)     if (_spectrumDrawCount === 1) console.log('[DEBUG drawSpectrumWaveform] freqData missing');
    return;
  }
  
  // 性能优化：节流到 15 FPS
  const now = performance.now();
  if (now - lastSpectrumDrawTime < SPECTRUM_DRAW_INTERVAL) {
    return;
  }
  lastSpectrumDrawTime = now;
  
  // 检测 canvas 尺寸变化，重建离屏缓冲
  if (spectrumCanvas.width !== lastSpectrumCanvasWidth || spectrumCanvas.height !== lastSpectrumCanvasHeight) {
    spectrumOffscreenCanvas = null;
    spectrumOffscreenCtx = null;
    spectrumBackgroundDirty = true;
    lastSpectrumCanvasWidth = spectrumCanvas.width;
    lastSpectrumCanvasHeight = spectrumCanvas.height;
  }
  
  // 创建离屏 Canvas（只创建一次）
  if (!spectrumOffscreenCanvas) {
    spectrumOffscreenCanvas = document.createElement('canvas');
    spectrumOffscreenCanvas.width = spectrumCanvas.width;
    spectrumOffscreenCanvas.height = spectrumCanvas.height;
    spectrumOffscreenCtx = spectrumOffscreenCanvas.getContext('2d');
    spectrumBackgroundDirty = true;
  }
  
  // 添加当前频谱到历史缓冲区
  spectrumHistory.push(new Uint8Array(freqData));
  if (spectrumHistory.length > SPECTRUM_HISTORY_SIZE) {
    spectrumHistory.shift();
  }
  
  const historyLength = spectrumHistory.length;
  const cellWidth = spectrumCanvas.width / SPECTRUM_HISTORY_SIZE;
  
  // 性能优化：只处理 80Hz-1000Hz 关键频段（吉他核心频段）
  // FFT size = 2048, sampleRate 通常 44100/48000
  // bin 频率 = sampleRate / fftSize ≈ 44100/2048 ≈ 21.5Hz/bin
  // 80Hz ≈ bin 4, 1000Hz ≈ bin 47
  const sampleRate = audioContext ? audioContext.sampleRate : 44100;
  const binFrequency = sampleRate / 2048;
  const startBin = Math.max(0, Math.floor(80 / binFrequency));
  const endBin = Math.min(Math.floor(freqData.length / 4), Math.ceil(1000 / binFrequency));
  const freqBins = endBin - startBin;
  
  if (freqBins <= 0) return;
  
  const cellHeight = spectrumCanvas.height / freqBins;
  
  // 绘制热力图到离屏 Canvas
  for (let t = 0; t < historyLength; t++) {
    const spectrum = spectrumHistory[t];
    const x = t * cellWidth;
    
    for (let f = startBin; f < endBin; f++) {
      const value = spectrum[f];
      const freqIndex = f - startBin;
      const y = spectrumCanvas.height - (freqIndex + 1) * cellHeight;
      
      // 彩虹色映射（根据能量强度）
      const normalizedValue = value / 255;
      const hue = (1 - normalizedValue) * 240;
      const saturation = 80 + normalizedValue * 20;
      const lightness = 40 + normalizedValue * 30;
      const alpha = 0.3 + normalizedValue * 0.7;
      
      spectrumOffscreenCtx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
      spectrumOffscreenCtx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
    }
  }
  
  // 将离屏 Canvas 内容绘制到主 Canvas
  spectrumCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
  spectrumCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  spectrumCtx.fillRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
  spectrumCtx.drawImage(spectrumOffscreenCanvas, 0, 0);
  
  // 绘制频率刻度标签（只在背景脏时重绘）
  if (spectrumBackgroundDirty) {
    spectrumCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    spectrumCtx.font = '10px Arial';
    spectrumCtx.fillText('1kHz', 5, 12);
    spectrumCtx.fillText('80Hz', 5, spectrumCanvas.height - 5);
    spectrumBackgroundDirty = false;
  }
  
if (DEBUG)   if (_spectrumDrawCount <= 3) console.log('[DEBUG drawSpectrumWaveform] drawn successfully, frame:', _spectrumDrawCount);
}

// ========== Spectral Flux Onset Detection 算法实现 ==========

/**
 * 计算 Spectral Flux - 频谱能量变化率
 * 只累加正差异（能量上升部分），对 onset 更敏感
 * 性能优化：只处理 80Hz-1000Hz 吉他核心频段
 * @param {Uint8Array} currentSpectrum - 当前帧频谱
 * @param {Uint8Array} previousSpectrum - 上一帧频谱
 * @returns {number} Spectral Flux 值
 */
function computeSpectralFlux(currentSpectrum, previousSpectrum) {
  if (!previousSpectrum || currentSpectrum.length !== previousSpectrum.length) {
    return 0;
  }
  
  let flux = 0;
  // 性能优化：只关注 80Hz-1000Hz 吉他核心频段
  const sampleRate = audioContext ? audioContext.sampleRate : 44100;
  const binFrequency = sampleRate / 2048;
  const startBin = Math.max(0, Math.floor(80 / binFrequency));
  const endBin = Math.min(currentSpectrum.length, Math.ceil(1000 / binFrequency));
  
  for (let i = startBin; i < endBin; i++) {
    const diff = currentSpectrum[i] - previousSpectrum[i];
    if (diff > 0) {
      flux += diff * diff;  // 平方增强大变化的权重
    }
  }
  
  return flux / (endBin - startBin);  // 归一化
}

/**
 * 自适应阈值计算 - 使用滑动窗口统计
 * @returns {number} 动态阈值
 */
function computeAdaptiveThreshold() {
  if (fluxBuffer.length < 10) {
    return 0.5;  // 初始阈值
  }
  
  // 计算局部均值和标准差
  const recentFlux = fluxBuffer.slice(-Math.min(20, fluxBuffer.length));
  const mean = recentFlux.reduce((a, b) => a + b, 0) / recentFlux.length;
  const variance = recentFlux.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / recentFlux.length;
  const stdDev = Math.sqrt(variance);
  
  // 阈值 = 均值 + 0.5 * 标准差 (保守检测)
  // 根据灵敏度调整：灵敏度越高，阈值越低
  const sensitivityFactor = 1.0 - (sensitivityLevel - 1) * (0.5 / 99);  // 0.5-1.0
  const threshold = mean + sensitivityFactor * stdDev;
  
  return Math.max(0.1, threshold);  // 最小阈值
}

/**
 * 峰值检测 - 检测 Spectral Flux 的局部最大值
 * @param {number} currentFlux - 当前 Flux 值
 * @param {number} threshold - 动态阈值
 * @returns {boolean} 是否检测到峰值
 */
function detectFluxPeak(currentFlux, threshold) {
  // 冷却期检查
  if (fluxPeakCooldown > 0) {
    fluxPeakCooldown--;
    return false;
  }
  
  if (fluxBuffer.length < 3) {
    return false;
  }
  
  // 检查是否为局部最大值
  const prevFlux = fluxBuffer[fluxBuffer.length - 2];
  const prevPrevFlux = fluxBuffer[fluxBuffer.length - 3];
  
  // 峰值条件：当前值 > 前一值 > 前前一值，且超过阈值
  const isRising = currentFlux > prevFlux && prevFlux > prevPrevFlux;
  const isAboveThreshold = currentFlux > threshold;
  
  // 额外检查：峰值应该显著高于前几帧（降低要求：5% 增长即可，适应录音回放）
  const isSignificantPeak = currentFlux > prevFlux * 1.05;  // 至少 5% 增长
  
if (DEBUG)   console.log('[DEBUG detectFluxPeak] flux:', currentFlux.toFixed(2), 'threshold:', threshold.toFixed(2), 'isRising:', isRising, 'isAboveThreshold:', isAboveThreshold, 'isSignificantPeak:', isSignificantPeak, 'result:', isRising && isAboveThreshold && isSignificantPeak);
  
  if (isRising && isAboveThreshold && isSignificantPeak) {
    fluxPeakCooldown = FLUX_COOLDOWN_FRAMES;  // 进入冷却期
    return true;
  }
  
  return false;
}

/**
 * 混合检测策略 - 结合 Spectral Flux 和传统 RMS 检测
 * Spectral Flux 对扫弦 onset 更敏感，RMS 作为辅助验证
 * @param {Uint8Array} freqData - 频域数据
 * @param {Uint8Array} timeData - 时域数据
 * @param {number} rms - RMS 音量
 * @returns {object} 检测结果 { onsets: {flux: bool, rms: bool}, confidence: number }
 */
function detectOnsetWithFlux(freqData, timeData, rms) {
  const now = Date.now();
  
  // 计算 Spectral Flux
  const currentFlux = computeSpectralFlux(freqData, previousSpectrum);
  
  // 更新频谱历史
  if (previousSpectrum === null || previousSpectrum.length !== freqData.length) {
    previousSpectrum = new Uint8Array(freqData.length);
  }
  previousSpectrum.set(freqData);
  
  // 更新 Flux 缓冲区
  fluxBuffer.push(currentFlux);
  if (fluxBuffer.length > fluxBufferSize) {
    fluxBuffer.shift();
  }
  
  // 计算自适应阈值
  fluxThreshold = computeAdaptiveThreshold();
  
  // 检测峰值
  const fluxPeak = detectFluxPeak(currentFlux, fluxThreshold);
  
  // RMS 辅助检测（传统方法）- 根据灵敏度动态调整
  // 灵敏度越高，阈值越低（更容易触发）
  const rmsThreshold = strumThreshold * 1.5;  // 使用动态阈值
  const rmsOnset = rms > rmsThreshold;
  
if (DEBUG)   console.log('[DEBUG detectOnsetWithFlux] rms:', rms.toFixed(3), 'rmsThreshold:', rmsThreshold.toFixed(3), 'rmsOnset:', rmsOnset, 'fluxPeak:', fluxPeak, 'flux:', currentFlux.toFixed(2), 'threshold:', fluxThreshold.toFixed(2));
  
  // 混合策略：
  // 1. Flux 峰值 + RMS 超过 50% 阈值 = 强检测到
  // 2. Flux 峰值 + RMS 超过 30% 阈值 = 中等检测到
  // 3. 仅 RMS 超过阈值 = 弱检测到（传统模式）
  // 最小扫弦间隔根据 BPM 动态调整（基于 120BPM 的 200ms，按比例缩放）
  const baseMinInterval = 200;  // 120BPM 基准
  const minStrumInterval = Math.round(baseMinInterval * (120 / currentBPM));  // 根据 BPM 缩放
  const timeSinceLastStrum = now - lastStrumTime;
  
if (DEBUG)   console.log('[DEBUG 扫弦间隔] BPM:', currentBPM, 'minStrumInterval:', minStrumInterval, 'ms, timeSinceLastStrum:', timeSinceLastStrum);
  
  let onsetDetected = false;
  let confidence = 0;
  
  if (timeSinceLastStrum > minStrumInterval) {
    if (fluxPeak && rms > rmsThreshold * 0.5) {
      onsetDetected = true;
      confidence = 0.9;  // 高置信度
    } else if (fluxPeak && rms > rmsThreshold * 0.3) {
      onsetDetected = true;
      confidence = 0.7;  // 中等置信度
    } else if (rmsOnset && !fluxPeak && timeSinceLastStrum > minStrumInterval * 1.5) {
      onsetDetected = true;
      confidence = 0.5;  // 低置信度（仅 RMS）
    }
  }
  
if (DEBUG)   console.log('[DEBUG detectOnsetWithFlux] timeSinceLastStrum:', timeSinceLastStrum, 'onsetDetected:', onsetDetected, 'confidence:', confidence);
  
  return {
    onset: onsetDetected,
    confidence: confidence,
    flux: currentFlux,
    threshold: fluxThreshold
  };
}

// 扫弦检测 - 基于 Spectral Flux 的改进版本
function detectStrum(freqData, timeData, rms) {
  const now = Date.now();
  
  
  // 计算高频能量 (音色指标)
  const highFreqStart = Math.floor(freqData.length * 0.6);
  let highFreqEnergy = 0;
  for (let i = highFreqStart; i < freqData.length; i++) {
    highFreqEnergy += freqData[i];
  }
  highFreqEnergy /= (freqData.length - highFreqStart);
  
  // 计算整体频谱能量（用于诊断麦克风输入）
  let totalSpectrumEnergy = 0;
  for (let i = 0; i < freqData.length; i++) {
    totalSpectrumEnergy += freqData[i];
  }
  totalSpectrumEnergy /= freqData.length;
  
  // 每 60 帧输出一次麦克风输入诊断（约 1 秒）
  if (++_diagnosticFrameCounter % 60 === 0) {
if (DEBUG)     console.log('[DEBUG 麦克风诊断] rms:', rms.toFixed(4), 'totalSpectrumEnergy:', totalSpectrumEnergy.toFixed(1), 'highFreqEnergy:', highFreqEnergy.toFixed(1), 'timeData[0]:', timeData[0]);
  }
  
if (DEBUG)   console.log('[DEBUG detectStrum] rms:', rms.toFixed(3), 'highFreqEnergy:', highFreqEnergy.toFixed(1));
  
  // 使用 Spectral Flux Onset Detection
  const onsetResult = detectOnsetWithFlux(freqData, timeData, rms);
  
if (DEBUG)   console.log('[DEBUG detectStrum] onsetResult:', onsetResult);
  
  // 检测到扫弦
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
    
    // 通知波形图重绘
    lastStrumEventTime = now;
    
    detectedStrums.push(strum);
    
    // 添加到当前小节
    currentMeasureStrums.push(strum);
    
if (DEBUG)     console.log('[DEBUG detectStrum] Strum detected!', {
      strumCount: detectedStrums.length,
      strum: { time: strum.time, amplitude: strum.amplitude, tone: strum.tone, interval: strum.interval },
      detectedStrums: detectedStrums.map(s => ({ tone: s.tone, interval: s.interval, amplitude: s.amplitude }))
    });
    
    // ========== 和弦识别（新增） ==========
    if (chordRecognitionEnabled && chordDetector) {
      const chordResult = chordDetector.detect(freqData);
      if (chordResult) {
        lastRecognizedChord = chordResult.chord;
        
        // 更新 UI 显示
        updateChordDisplay(chordResult, expectedChord, nextChord);
        
        // 记录转换（训练模式下）
        if (transitionDetector && currentTrainingMode !== 'free') {
          transitionDetector.onChordDetected(chordResult.chord, expectedChord, now);
        }
      }
    }
    // ====================================
    lastStrumTime = now;
    
    // 保持最近 20 次扫弦
    if (detectedStrums.length > 20) {
      detectedStrums.shift();
    }
    
    // 实时反馈
    provideFeedback(strum);
    
    // 立即更新评分
    updateScores();
  }
}

// 提供实时反馈
function provideFeedback(strum) {
  const pattern = getActiveRhythm(currentRhythm);
  const expectedInterval = pattern.pattern[expectedStrumIndex];
  
  let feedback = '';
  
  // 节奏反馈 - 使用百分比偏差更直观
  if (strum.interval > 0) {
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
  
  // 音色反馈
  if (strum.tone > 200) {
    feedback += '🎵 音色略刺耳';
  } else if (strum.tone > 150) {
    feedback += '🎵 音色明亮';
  } else if (strum.tone > 60) {
    feedback += '🎵 音色正常';
  } else {
    feedback += '🎵 音色偏闷';
  }
  
  // 强弱反馈
  if (strum.amplitude > 0.25) {
    feedback += ' 💪 力度很好';
  } else if (strum.amplitude > 0.15) {
    feedback += ' 💪 力度适中';
  } else {
    feedback += ' 💪 力度偏弱';
  }
  
  feedbackMessage.textContent = feedback;
  
  // 更新期望的扫弦索引
  expectedStrumIndex = (expectedStrumIndex + 1) % pattern.pattern.length;
}

// 计算评分（按小节更新）
function updateScores() {
  // 显示上次小节的评分（保持显示，不频繁变化）
  rhythmScoreEl.textContent = lastMeasureScores.rhythm > 0 ? lastMeasureScores.rhythm : '--';
  toneScoreEl.textContent = lastMeasureScores.tone > 0 ? lastMeasureScores.tone : '--';
  dynamicsScoreEl.textContent = lastMeasureScores.dynamics > 0 ? lastMeasureScores.dynamics : '--';
  totalScoreEl.textContent = lastMeasureScores.total > 0 ? lastMeasureScores.total : '--';
  
  // 检查是否需要更新小节评分
  checkMeasureUpdate();
}

// 改进的节奏评分算法 - 基于稳定度（考虑节奏型）
function calculateRhythmScore(strums, pattern) {
  if (strums.length < 2) return 0;
  
  // 1. 根据 BPM 缩放理论时值（节奏型定义基于 120BPM）
  const bpmRatio = 120 / currentBPM;
  const expectedPattern = pattern.pattern.map(x => x * bpmRatio);
  const patternLength = expectedPattern.length;
  
if (DEBUG)   console.log('[DEBUG 节奏型] BPM:', currentBPM, 'pattern:', pattern.name, 'expectedPattern:', expectedPattern.map(x => Math.round(x)));
  
  // 2. 按节奏型位置分组
  const groups = Array.from({ length: patternLength }, () => []);
  for (let i = 1; i < strums.length; i++) {
    const groupIndex = (i - 1) % patternLength;
    groups[groupIndex].push(strums[i].interval);
  }
  
  // 3. 每组单独计算 CV
  const cvs = [];
  const groupStats = [];
  for (let i = 0; i < patternLength; i++) {
    if (groups[i].length < 2) {
      cvs.push(0);
      groupStats.push({ avg: 0, stdDev: 0, cv: 0, count: groups[i].length });
      continue;
    }
    
    const avg = groups[i].reduce((a, b) => a + b, 0) / groups[i].length;
    const variance = groups[i].reduce((sum, interval) => sum + Math.pow(interval - avg, 2), 0) / groups[i].length;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? stdDev / avg : 0;
    
    cvs.push(cv);
    groupStats.push({ avg, stdDev, cv, count: groups[i].length });
  }
  
  // 4. 计算平均 CV（排除样本不足的组）
  const validCvs = cvs.filter((cv, i) => groupStats[i].count >= 2);
  if (validCvs.length === 0) return 0;
  
  const avgCV = validCvs.reduce((a, b) => a + b, 0) / validCvs.length;
  
  // 5. 根据平均 CV 评分
  let score;
  if (avgCV < 0.10) {
    score = 90 + (0.10 - avgCV) * 100;  // 90-100 分
  } else if (avgCV < 0.20) {
    score = 70 + (0.20 - avgCV) * 200;  // 70-90 分
  } else if (avgCV < 0.30) {
    score = 60 + (0.30 - avgCV) * 100;  // 60-70 分
  } else {
    score = Math.max(0, 60 - (avgCV - 0.30) * 100);  // 0-60 分
  }
  
if (DEBUG)   console.log('[DEBUG 节奏稳定度] 分组统计:', groupStats.map((s, i) => `位置${i}: avg=${Math.round(s.avg)}ms, cv=${(s.cv * 100).toFixed(1)}%`).join(' | '));
if (DEBUG)   console.log('[DEBUG 节奏稳定度] 平均 CV:', (avgCV * 100).toFixed(1) + '%, 得分:', Math.round(score));
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

// 改进的音色评分算法
function calculateToneScore(strums) {
  if (strums.length === 0) {
if (DEBUG)     console.log('[DEBUG calculateToneScore] No strums, returning 0');
    return 0;
  }
  
  let totalScore = 0;
  const scores = [];
  
  for (const strum of strums) {
    const tone = strum.tone;
    
    // 使用范围评分而非单点评分
    // 理想范围: 60-200 (更宽容)
    const idealMin = 60;
    const idealMax = 200;
    const idealCenter = (idealMin + idealMax) / 2;
    const range = (idealMax - idealMin) / 2;
    
    let score;
    if (tone >= idealMin && tone <= idealMax) {
      // 在理想范围内，根据距离中心的远近评分
      const distanceFromCenter = Math.abs(tone - idealCenter);
      score = 100 - (distanceFromCenter / range) * 40; // 范围内最低 60 分
    } else {
      // 在理想范围外，线性衰减
      const distanceOutside = tone < idealMin ? idealMin - tone : tone - idealMax;
      score = Math.max(0, 60 - (distanceOutside / 5) * 60);
    }
    scores.push(score);
    totalScore += score;
  }
  
  const result = Math.round(totalScore / strums.length);
if (DEBUG)   console.log('[DEBUG calculateToneScore] strums:', strums.length, 'tones:', strums.map(s => s.tone), 'individualScores:', scores.map(s => Math.round(s)), 'result:', result);
  return result;
}

// 改进的强弱评分算法
function calculateDynamicsScore(strums, pattern) {
  if (strums.length < 2) return 0;
  
  const amplitudes = strums.map(s => s.amplitude);
  
  // 计算归一化振幅 (相对于最大值)
  const maxAmp = Math.max(...amplitudes);
  const minAmp = Math.min(...amplitudes);
  const ampRange = maxAmp - minAmp || 1; // 避免除零
  
  // 检查是否有预期的强弱模式 (某些节奏型有重音)
  const hasAccentPattern = pattern.demo.some(d => d !== pattern.demo[0]);
  
  if (hasAccentPattern) {
    // 对于有强弱变化的节奏型，检查是否符合预期模式
    return calculateAccentAwareDynamics(strums, pattern);
  } else {
    // 对于均匀节奏型，评估稳定性
    return calculateUniformDynamics(amplitudes);
  }
}

// 考虑重音模式的强弱评分
function calculateAccentAwareDynamics(strums, pattern) {
  let totalScore = 0;
  const count = Math.min(strums.length, pattern.pattern.length * 2); // 至少评估两个循环
  
  for (let i = 0; i < count; i++) {
    const patternIndex = i % pattern.pattern.length;
    const expectedDirection = pattern.demo[patternIndex];
    const actualAmp = strums[i].amplitude;
    
    // 下扫通常应该更强
    const expectedStrong = expectedDirection === 'D';
    
    // 计算相对于平均值的偏差
    const avgAmp = strums.slice(0, count).reduce((a, b) => a + b.amplitude, 0) / count;
    const isActuallyStrong = actualAmp > avgAmp;
    
    // 如果预期和实际一致，根据偏差程度评分
    if (expectedStrong === isActuallyStrong) {
      const deviation = Math.abs(actualAmp - avgAmp) / avgAmp;
      totalScore += Math.max(80, 100 - deviation * 50);
    } else {
      // 不一致时，根据偏差程度扣分
      const deviation = Math.abs(actualAmp - avgAmp) / avgAmp;
      totalScore += Math.max(30, 70 - deviation * 100);
    }
  }
  
  return Math.round(Math.max(0, Math.min(100, totalScore / count)));
}

// 均匀节奏型的强弱评分
function calculateUniformDynamics(amplitudes) {
  const avgAmp = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
  
  // 使用变异系数 (CV) 而非原始方差，更科学
  const stdDev = Math.sqrt(
    amplitudes.reduce((sum, a) => sum + Math.pow(a - avgAmp, 2), 0) / amplitudes.length
  );
  const coefficientOfVariation = avgAmp > 0 ? stdDev / avgAmp : 0;
  
  // CV < 0.1 表示非常稳定 (90-100 分)
  // CV > 0.5 表示非常不稳定 (0-30 分)
  const score = 100 * Math.exp(-coefficientOfVariation * 3);
  
  // 同时检查绝对力度 (不能太轻)
  const avgAmplitude = avgAmp;
  let dynamicsBonus = 0;
  if (avgAmplitude > 0.2) {
    dynamicsBonus = 10; // 力度充足的奖励
  } else if (avgAmplitude < 0.1) {
    dynamicsBonus = -15; // 力度不足的惩罚
  }
  
  return Math.round(Math.max(0, Math.min(100, score + dynamicsBonus)));
}

// 更新评分样式
function updateScoreStyle(element, score) {
  element.classList.remove('excellent', 'good', 'poor');
  if (score >= 80) {
    element.classList.add('excellent');
  } else if (score >= 60) {
    element.classList.add('good');
  } else {
    element.classList.add('poor');
  }
}

// 更新圆环进度条
function updateScoreRing(ringEl, valueEl, score) {
  if (!ringEl || !valueEl) return;
  
  if (typeof score !== 'number' || isNaN(score)) {
    ringEl.setAttribute('stroke-dashoffset', 0);
    ringEl.setAttribute('stroke', '#555');
    return;
  }
  
  const circumference = parseFloat(ringEl.getAttribute('stroke-dasharray'));
  const offset = circumference - (score / 100) * circumference;
  ringEl.setAttribute('stroke-dashoffset', offset);
  
  let color;
  if (score >= 80) {
    color = '#2ed573';
  } else if (score >= 60) {
    color = '#ffa502';
  } else {
    color = '#ff4757';
  }
  ringEl.setAttribute('stroke', color);
  
  valueEl.textContent = score;
  valueEl.style.color = color;
}

// 保存历史记录
function saveHistory() {
  const pattern = getActiveRhythm(currentRhythm);
  const totalScore = parseInt(totalScoreEl.textContent);
  const safeTotalScore = isNaN(totalScore) ? 0 : totalScore;
  
  const transitionStats = transitionDetector ? transitionDetector.getStats() : null;
  const transitionCount = transitionStats ? transitionStats.transitionCount : 0;
  const avgTransitionTime = transitionStats ? Math.round(transitionStats.avgTransitionTime) : 0;
  
  const accuracy = practiceChordTotal > 0 ? Math.round((practiceChordCorrect / practiceChordTotal) * 100) : 0;
  
  const bestTransition = practiceTransitionTimes.length > 0 ? Math.round(Math.min(...practiceTransitionTimes)) : 0;
  const worstTransition = practiceTransitionTimes.length > 0 ? Math.round(Math.max(...practiceTransitionTimes)) : 0;
  
  const duration = practiceStartTime > 0 ? Math.round((Date.now() - practiceStartTime) / 1000) : 0;
  
  const historyItem = {
    date: new Date().toISOString(),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    rhythm: pattern.name,
    rhythmIndex: currentRhythm,
    score: safeTotalScore,
    rhythmScore: parseInt(rhythmScoreEl.textContent) || 0,
    toneScore: parseInt(toneScoreEl.textContent) || 0,
    dynamicsScore: parseInt(dynamicsScoreEl.textContent) || 0,
    strums: detectedStrums.length,
    bpm: currentBPM,
    mode: currentTrainingMode,
    practiceMode: practiceMode,
    chordAccuracy: accuracy,
    avgTransitionTime: avgTransitionTime,
    transitionCount: transitionCount,
    bestTransition: bestTransition,
    worstTransition: worstTransition,
    duration: duration
  };
  
  strumHistory.unshift(historyItem);
  if (strumHistory.length > 50) {
    strumHistory.pop();
  }
  
  // 持久化到 localStorage
  try {
    localStorage.setItem('guitarStrumHistory', JSON.stringify(strumHistory));
  } catch (e) {
    console.warn('无法保存历史记录:', e);
  }
  
  renderHistory();
  renderStatsChart();
}

// 从 localStorage 加载历史记录
function loadHistoryFromStorage() {
  try {
    const stored = localStorage.getItem('guitarStrumHistory');
    if (stored) {
      strumHistory = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('无法加载历史记录:', e);
    strumHistory = [];
  }
}

// 渲染历史记录
function renderHistory() {
  historyList.innerHTML = strumHistory.map(item => {
    const modeLabel = item.mode === 'preset' ? '📖' : item.mode === 'custom' ? '✏️' : item.mode === 'free' ? '🎸' : '';
    const practiceModeLabel = item.practiceMode === 'comprehensive' ? '🎸综合' : '🥁节奏';
    // 纯节奏模式不显示和弦相关信息
    const accuracyInfo = item.practiceMode === 'comprehensive' && item.chordAccuracy ? ` | 准确率${item.chordAccuracy}%` : '';
    const transTimeInfo = item.practiceMode === 'comprehensive' && item.avgTransitionTime ? ` | 转换${item.avgTransitionTime}ms` : '';
    return `
      <div class="history-item">
        <span class="time">${item.time} - ${item.rhythm} ${modeLabel} ${practiceModeLabel}</span>
        <span class="score">${item.score}分 (${item.strums}次扫弦${accuracyInfo}${transTimeInfo})</span>
      </div>
    `;
  }).join('');
}

// 窗口大小改变时调整画布
window.addEventListener('resize', () => {
  // canvas 已移除
  if (recorderCanvas) {
    recorderCanvas.width = recorderCanvas.offsetWidth;
    recorderCanvas.height = recorderCanvas.offsetHeight;
  }
  if (spectrumCanvas) {
    spectrumCanvas.width = spectrumCanvas.offsetWidth;
    spectrumCanvas.height = spectrumCanvas.offsetHeight;
  }
  if (statsChartCanvas) {
    statsChartCanvas.width = statsChartCanvas.offsetWidth;
    statsChartCanvas.height = statsChartCanvas.offsetHeight;
    renderStatsChart();
  }
});

// 渲染统计图表
function renderStatsChart() {
  if (!statsChartCtx || strumHistory.length === 0) {
    if (avgScoreEl) avgScoreEl.textContent = '--';
    if (maxScoreEl) maxScoreEl.textContent = '--';
    if (practiceCountEl) practiceCountEl.textContent = '0';
    return;
  }
  
  // 设置画布分辨率
  const dpr = window.devicePixelRatio || 1;
  const rect = statsChartCanvas.getBoundingClientRect();
  statsChartCanvas.width = rect.width * dpr;
  statsChartCanvas.height = rect.height * dpr;
  
  // 重置变换矩阵，防止缩放累积
  statsChartCtx.setTransform(1, 0, 0, 1, 0, 0);
  statsChartCtx.scale(dpr, dpr);
  
  const width = rect.width;
  const height = rect.height;
  const padding = { top: 20, right: 20, bottom: 30, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // 清空画布
  statsChartCtx.clearRect(0, 0, width, height);
  
  // 获取最近 20 条记录 (按时间正序)
  const recentHistory = strumHistory.slice(0, 20).reverse();
  
  // 计算统计数据
  const scores = recentHistory.map(h => h.score);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const maxScore = Math.max(...scores);
  
  // 更新统计信息
  if (avgScoreEl) avgScoreEl.textContent = avgScore;
  if (maxScoreEl) maxScoreEl.textContent = maxScore;
  if (practiceCountEl) practiceCountEl.textContent = strumHistory.length;
  
  // 绘制网格线
  statsChartCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  statsChartCtx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    statsChartCtx.beginPath();
    statsChartCtx.moveTo(padding.left, y);
    statsChartCtx.lineTo(width - padding.right, y);
    statsChartCtx.stroke();
    
    // Y 轴标签
    const value = 100 - (100 / 4) * i;
    statsChartCtx.fillStyle = '#666';
    statsChartCtx.font = '10px sans-serif';
    statsChartCtx.textAlign = 'right';
    statsChartCtx.fillText(Math.round(value), padding.left - 5, y + 4);
  }
  
  // 绘制数据点
  const points = recentHistory.map((item, index) => {
    const x = padding.left + (chartWidth / (recentHistory.length - 1 || 1)) * index;
    const y = padding.top + chartHeight - (item.score / 100) * chartHeight;
    return { x, y, score: item.score, rhythm: item.rhythm, date: item.date };
  });
  
  // 绘制渐变填充区域
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
  
  // 绘制连线
  if (points.length > 1) {
    statsChartCtx.beginPath();
    statsChartCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      statsChartCtx.lineTo(points[i].x, points[i].y);
    }
    statsChartCtx.strokeStyle = '#b866ff';
    statsChartCtx.lineWidth = 2;
    statsChartCtx.stroke();
  }
  
  // 绘制平均分线
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
  
  // 绘制数据点
  points.forEach((p, i) => {
    statsChartCtx.beginPath();
    statsChartCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    
    // 根据分数设置颜色
    if (p.score >= 80) {
      statsChartCtx.fillStyle = '#2ed573';
    } else if (p.score >= 60) {
      statsChartCtx.fillStyle = '#ffa502';
    } else {
      statsChartCtx.fillStyle = '#ff4757';
    }
    statsChartCtx.fill();
    statsChartCtx.strokeStyle = '#1a1a2e';
    statsChartCtx.lineWidth = 2;
    statsChartCtx.stroke();
  });
  
  // X 轴标签 (显示部分日期)
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
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      statsChartCtx.fillText(label, x, height - padding.bottom + 15);
    }
  }
}

// 启动 - 确保 DOM 加载完成后再初始化
document.addEventListener('DOMContentLoaded', () => {
  if (DEBUG) console.log('[GuitarStrumTrainer] DOMContentLoaded 触发');
  try {
    init();
    if (DEBUG) console.log('[GuitarStrumTrainer] 初始化成功');
  } catch (error) {
    console.error('[GuitarStrumTrainer] 初始化失败:', error);
  }
});
// ========== 自定义节奏型功能 ==========

// 自定义节奏型数据
let customRhythms = [];
let editingRhythmIndex = -1;
let currentNoteSequence = [];

// 音符时值定义（毫秒，基于 120BPM）
const NOTE_DURATIONS = {
  'whole': { name: '全音符', ms: 2000 },
  'half': { name: '二分音符', ms: 1000 },
  'quarter': { name: '四分音符', ms: 500 },
  '8th': { name: '八分音符', ms: 250 },
  '16th': { name: '十六分音符', ms: 125 }
};

// 预设模板
const PRESET_TEMPLATES = {
  '8th-16th': {
    name: '前八后十六',
    notes: [
      { duration: '8th', direction: 'D', velocity: 1.0 },
      { duration: '16th', direction: 'D', velocity: 0.6 },
      { duration: '16th', direction: 'U', velocity: 0.3 }
    ]
  },
  '16th-8th': {
    name: '前十六后八',
    notes: [
      { duration: '16th', direction: 'D', velocity: 0.6 },
      { duration: '16th', direction: 'U', velocity: 0.3 },
      { duration: '8th', direction: 'D', velocity: 1.0 }
    ]
  },
  'folk': {
    name: '民谣常用',
    notes: [
      { duration: '8th', direction: 'D', velocity: 1.0 },
      { duration: '8th', direction: 'D', velocity: 1.0 },
      { duration: '16th', direction: 'U', velocity: 0.3 },
      { duration: '16th', direction: 'D', velocity: 0.6 },
      { duration: '16th', direction: 'U', velocity: 0.3 },
      { duration: '16th', direction: 'D', velocity: 0.6 }
    ]
  },
  'rock': {
    name: '摇滚八分',
    notes: [
      { duration: '8th', direction: 'D', velocity: 0.8 },
      { duration: '8th', direction: 'U', velocity: 0.5 },
      { duration: '8th', direction: 'D', velocity: 0.8 },
      { duration: '8th', direction: 'U', velocity: 0.5 },
      { duration: '8th', direction: 'D', velocity: 0.8 },
      { duration: '8th', direction: 'U', velocity: 0.5 },
      { duration: '8th', direction: 'D', velocity: 0.8 },
      { duration: '8th', direction: 'U', velocity: 0.5 }
    ]
  }
};

// 初始化自定义节奏型功能
function initCustomRhythms() {
  loadCustomRhythms();
  loadUserSettings();
  renderCustomRhythmsList();
  setupCustomRhythmButtons();
}

// 从 localStorage 加载自定义节奏型
function loadCustomRhythms() {
  try {
    const stored = localStorage.getItem('guitarStrumCustomRhythms');
    if (stored) {
      customRhythms = JSON.parse(stored);
    }
  } catch (e) {
    console.warn('无法加载自定义节奏型:', e);
    customRhythms = [];
  }
}

// 保存自定义节奏型到 localStorage
function saveCustomRhythms() {
  try {
    localStorage.setItem('guitarStrumCustomRhythms', JSON.stringify(customRhythms));
  } catch (e) {
    console.warn('无法保存自定义节奏型:', e);
  }
}

// 渲染自定义节奏型列表
// 生成带时值间隔的箭头模式（公共函数）
function generateArrowPattern(notes) {
  if (!notes || notes.length === 0) return '';
  
  const arrows = notes.map(n => ({
    arrow: n.direction === 'D' ? '↓' : '↑',
    duration: n.duration
  }));
  
  let result = arrows[0].arrow;
  for (let i = 1; i < arrows.length; i++) {
    const prevDuration = arrows[i - 1].duration;
    const currDuration = arrows[i].duration;
    
    // 根据时值决定间隔：8 分和 16 分之间用宽间隔，两个 16 分之间用窄间隔
    // 8th=八分音符，16th=十六分音符
    const isPrevShort = prevDuration === '16th';
    const isCurrShort = currDuration === '16th';
    
    if (isPrevShort && isCurrShort) {
      // 两个 16 分音符之间：窄间隔（不换行，直接连）
      result += arrows[i].arrow;
    } else if (isPrevShort || isCurrShort) {
      // 8 分和 16 分之间：中等间隔（一个空格）
      result += ' ' + arrows[i].arrow;
    } else {
      // 两个 8 分或更长：宽间隔（两个空格）
      result += '  ' + arrows[i].arrow;
    }
  }
  return result;
}

function renderCustomRhythmsList() {
  const container = document.getElementById('customRhythmsList');
  if (!container) return;
  
  if (customRhythms.length === 0) {
    container.innerHTML = '<div style="color: #888; padding: 20px; text-align: center;">暂无自定义节奏型，点击"+"创建</div>';
    return;
  }
  
  container.innerHTML = customRhythms.map((rhythm, index) => {
    const noteCount = rhythm.notes ? rhythm.notes.length : 0;
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
  
  // 绑定自定义列表中的试听按钮事件
  container.querySelectorAll('.btn-custom-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      // 防止快速重复点击（100ms 内只响应一次）
      const now = Date.now();
      if (now - lastDemoClickTime < 100) {
        if (DEBUG) console.log('[GuitarStrumTrainer] Custom list click too fast, ignoring');
        return;
      }
      lastDemoClickTime = now;
      
      const customIndex = parseInt(btn.dataset.customIndex);
      
      if (DEBUG) console.log('[GuitarStrumTrainer] Custom list play button clicked:', { customIndex, isPlayingDemo: getIsPlayingDemo() });
      
      if (getIsPlayingDemo()) {
        if (DEBUG) console.log('[GuitarStrumTrainer] Stopping custom list demo...');
        stopDemo();
      } else {
        if (DEBUG) console.log('[GuitarStrumTrainer] Starting custom list demo...');
        playCustomRhythmFromList(customIndex, btn);
      }
    });
  });
  
  // 同时在主节奏型列表中显示自定义节奏型
  syncCustomRhythmsToSelector();
}

// 同步自定义节奏型到主节奏型选择器
function syncCustomRhythmsToSelector() {
  const rhythmSelector = document.getElementById('rhythmSelector');
  if (!rhythmSelector) return;
  
  // 移除现有的自定义节奏型选项
  const existingCustom = rhythmSelector.querySelectorAll('.custom-rhythm-option');
  existingCustom.forEach(el => el.remove());
  
  // 添加自定义节奏型选项
  customRhythms.forEach((rhythm, index) => {
    const arrowPattern = generateArrowPattern(rhythm.notes);
    const option = document.createElement('div');
    option.className = 'rhythm-option custom-rhythm-option';
    option.dataset.customIndex = index;
    option.innerHTML = `
      <div class="name">${escapeHtml(rhythm.name)}</div>
      <div class="pattern">${arrowPattern}</div>
      <button class="btn-demo" data-custom-index="${index}">🔊 试听演示</button>
    `;
    option.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-demo')) return;
      selectCustomRhythm(index);
    });
    rhythmSelector.appendChild(option);
  });
  
  // 重新绑定所有演示按钮事件（包括新增的自定义按钮）
  setupDemoButtons();
  
  if (DEBUG) console.log('[GuitarStrumTrainer] 自定义节奏型已同步到主列表:', customRhythms.length);
}

// 选择自定义节奏型
function selectCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  
  const rhythm = customRhythms[index];
  if (!rhythm.notes || rhythm.notes.length === 0) return;
  
  // 使用独立索引管理（预设数量 + 自定义索引）
  currentRhythm = RHYTHM_PATTERNS.length + index;
  
  // 更新 UI 选中状态（包括主列表和自定义列表）
  const options = document.querySelectorAll('.rhythm-option');
  options.forEach(o => o.classList.remove('active'));
  
  // 高亮对应的自定义节奏型选项
  const customOption = document.querySelector(`.custom-rhythm-option[data-custom-index="${index}"]`);
  if (customOption) {
    customOption.classList.add('active');
  }
  
  const tempDemo = rhythm.notes.map(note => note.direction);
  feedbackMessage.textContent = `已选择：${rhythm.name} - ${tempDemo.join(' ')}`;
  
  if (DEBUG) console.log('[GuitarStrumTrainer] 已选择自定义节奏型:', rhythm.name);
}

// 设置自定义节奏型按钮
function setupCustomRhythmButtons() {
  const btnNew = document.getElementById('btnNewRhythm');
  const btnExport = document.getElementById('btnExportSettings');
  const btnImport = document.getElementById('btnImportSettings');
  const btnSave = document.getElementById('btnSaveRhythm');
  const btnCancel = document.getElementById('btnCancelEdit');
  const btnAddNote = document.getElementById('btnAddNote');
  const importInput = document.getElementById('importFileInput');
  
  if (btnNew) btnNew.addEventListener('click', openNewRhythmEditor);
  if (btnExport) btnExport.addEventListener('click', exportUserSettings);
  if (btnImport) btnImport.addEventListener('click', () => importInput.click());
  if (importInput) importInput.addEventListener('change', importUserSettings);
  if (btnSave) btnSave.addEventListener('click', saveRhythmEditor);
  if (btnCancel) btnCancel.addEventListener('click', closeRhythmEditor);
  if (btnAddNote) btnAddNote.addEventListener('click', addNoteToSequence);
  
  // 预设模板按钮
  document.querySelectorAll('.btnPreset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const preset = e.target.dataset.preset;
      loadPresetTemplate(preset);
    });
  });
}

// 打开新建节奏型编辑器
function openNewRhythmEditor() {
  editingRhythmIndex = -1;
  currentNoteSequence = [];
  document.getElementById('rhythmNameInput').value = '';
  document.getElementById('rhythmEditorModal').style.display = 'block';
  renderNoteSequenceEditor();
}

// 编辑自定义节奏型
function editCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  
  editingRhythmIndex = index;
  const rhythm = customRhythms[index];
  document.getElementById('rhythmNameInput').value = rhythm.name;
  currentNoteSequence = JSON.parse(JSON.stringify(rhythm.notes || []));
  document.getElementById('rhythmEditorModal').style.display = 'block';
  renderNoteSequenceEditor();
}

// 删除自定义节奏型
function deleteCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  if (!confirm('确定要删除这个节奏型吗？')) return;
  
  customRhythms.splice(index, 1);
  saveCustomRhythms();
  renderCustomRhythmsList();
}

// 播放自定义节奏型（从自定义列表中的按钮调用）
function playCustomRhythmFromList(index, btn) {
  if (index < 0 || index >= customRhythms.length) return;
  
  const rhythm = customRhythms[index];
  if (!rhythm.notes || rhythm.notes.length === 0) return;
  
  // 如果已经在播放，点击则停止
  if (getIsPlayingDemo()) {
    stopDemo();
    return;
  }
  
  // 使用独立索引管理（预设数量 + 自定义索引）
  const rhythmIndex = RHYTHM_PATTERNS.length + index;
  
  // 保存真实按钮引用
  playingCustomBtn = btn;
  
  // 更新按钮状态
  if (btn && btn.classList) {
    btn.classList.add('playing');
  }
  if (btn && btn.textContent !== undefined) {
    btn.textContent = '⏹ 停止演示';
  }
  
  // 播放演示 - 传递真实按钮对象和节奏索引
  playDemo(rhythmIndex, btn);
  
  // 播放完成后清理（10 秒后或手动停止）
  const cleanupTimeout = setTimeout(() => {
    if (getIsPlayingDemo()) {
      stopDemo();
    }
    playingCustomBtn = null;
  }, 10000); // 10 秒后自动停止
  
  // 保存清理函数引用，可以在 stopDemo 中清除
  window.customRhythmCleanup = cleanupTimeout;
}

// 播放自定义节奏型（保留旧函数名兼容，优先使用主选择器中的按钮）
function playCustomRhythm(index) {
  if (DEBUG) console.log('[GuitarStrumTrainer] playCustomRhythm called with index:', index);
  // 优先查找主选择器中的按钮（.btn-demo[data-custom-index]）
  let btn = document.querySelector(`.btn-demo[data-custom-index="${index}"]`);
  // 如果找不到，再查找自定义列表中的按钮
  if (!btn) {
    btn = document.querySelector(`.btn-custom-play[data-custom-index="${index}"]`);
  }
  if (btn) {
    if (DEBUG) console.log('[GuitarStrumTrainer] playCustomRhythm found button, calling playCustomRhythmFromList');
    playCustomRhythmFromList(index, btn);
  } else {
    console.warn('[GuitarStrumTrainer] playCustomRhythm: button not found for index', index);
  }
}

// 渲染音符序列编辑器
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
        ${Object.entries(NOTE_DURATIONS).map(([key, val]) => 
          `<option value="${key}" ${note.duration === key ? 'selected' : ''}>${val.name}</option>`
        ).join('')}
      </select>
      <select onchange="updateNote(${index}, 'direction', this.value)" style="padding: 5px; background: #1a1a2e; border: 1px solid #00d9ff; border-radius: 4px; color: white;">
        <option value="D" ${note.direction === 'D' ? 'selected' : ''}>下扫 (D)</option>
        <option value="U" ${note.direction === 'U' ? 'selected' : ''}>上扫 (U)</option>
      </select>
      <input type="range" min="0.1" max="1.0" step="0.1" value="${note.velocity || 0.5}" 
        onchange="updateNote(${index}, 'velocity', parseFloat(this.value))" 
        style="width: 80px;">
      <span style="color: #00d9ff; min-width: 30px;">${Math.round((note.velocity || 0.5) * 100)}%</span>
      <button onclick="removeNote(${index})" style="padding: 5px 10px; background: #ff4757; color: white; border: none; border-radius: 4px; cursor: pointer;">✕</button>
    </div>
  `).join('');
}

// 添加音符到序列
function addNoteToSequence() {
  currentNoteSequence.push({
    duration: '8th',
    direction: 'D',
    velocity: 0.8
  });
  renderNoteSequenceEditor();
}

// 更新音符
function updateNote(index, field, value) {
  if (index < 0 || index >= currentNoteSequence.length) return;
  currentNoteSequence[index][field] = value;
  renderNoteSequenceEditor();
}

// 删除音符
function removeNote(index) {
  if (index < 0 || index >= currentNoteSequence.length) return;
  currentNoteSequence.splice(index, 1);
  renderNoteSequenceEditor();
}

// 加载预设模板
function loadPresetTemplate(presetKey) {
  const template = PRESET_TEMPLATES[presetKey];
  if (!template) return;
  
  document.getElementById('rhythmNameInput').value = template.name;
  currentNoteSequence = JSON.parse(JSON.stringify(template.notes));
  renderNoteSequenceEditor();
}

// 保存节奏型编辑器
function saveRhythmEditor() {
  const name = document.getElementById('rhythmNameInput').value.trim();
  if (!name) {
    alert('请输入节奏型名称');
    return;
  }
  
  if (currentNoteSequence.length === 0) {
    alert('请至少添加一个音符');
    return;
  }
  
  const rhythm = {
    name: name,
    notes: JSON.parse(JSON.stringify(currentNoteSequence)),
    createdAt: Date.now()
  };
  
  if (editingRhythmIndex >= 0) {
    // 更新现有节奏型
    customRhythms[editingRhythmIndex] = rhythm;
  } else {
    // 添加新节奏型
    customRhythms.push(rhythm);
  }
  
  saveCustomRhythms();
  closeRhythmEditor();
  renderCustomRhythmsList();
  
  // 重新绑定演示按钮事件
  setupDemoButtons();
  
  if (DEBUG) console.log('[GuitarStrumTrainer] 节奏型已保存:', name);
}

// 关闭节奏型编辑器
function closeRhythmEditor() {
  document.getElementById('rhythmEditorModal').style.display = 'none';
  editingRhythmIndex = -1;
  currentNoteSequence = [];
}

// ========== 用户设置保存/加载 ==========

// 保存用户设置
function saveUserSettings() {
  const settings = {
    bpm: currentBPM,
    metronomeEnabled: metronomeEnabled,
    sensitivityLevel: sensitivityLevel,
    currentRhythm: currentRhythm,
    customRhythms: customRhythms,
    savedAt: Date.now()
  };
  
  try {
    localStorage.setItem('guitarStrumUserSettings', JSON.stringify(settings));
    if (DEBUG) console.log('[GuitarStrumTrainer] 用户设置已保存');
  } catch (e) {
    console.warn('无法保存用户设置:', e);
  }
}

// 加载用户设置
function loadUserSettings() {
  try {
    const stored = localStorage.getItem('guitarStrumUserSettings');
    if (!stored) return;
    
    const settings = JSON.parse(stored);
    
    // 恢复自定义节奏型（必须先加载，因为节奏型选择依赖它）
    if (settings.customRhythms && Array.isArray(settings.customRhythms) && settings.customRhythms.length > 0) {
      customRhythms = settings.customRhythms;
    }
    
    // 恢复 BPM
    if (settings.bpm) {
      currentBPM = settings.bpm;
      const bpmSlider = document.getElementById('bpmSlider');
      const bpmValue = document.getElementById('bpmValue');
      if (bpmSlider) bpmSlider.value = currentBPM;
      if (bpmValue) bpmValue.textContent = currentBPM;
    }
    
    // 恢复节拍器状态
    if (settings.metronomeEnabled !== undefined) {
      metronomeEnabled = settings.metronomeEnabled;
      const metronomeToggle = document.getElementById('metronomeToggle');
      if (metronomeToggle) metronomeToggle.checked = metronomeEnabled;
    }
    
    // 恢复灵敏度
    if (settings.sensitivityLevel) {
      sensitivityLevel = settings.sensitivityLevel;
      const sensitivitySlider = document.getElementById('sensitivitySlider');
      const sensitivityValueEl = document.getElementById('sensitivityValue');
      if (sensitivitySlider) sensitivitySlider.value = sensitivityLevel;
      if (sensitivityValueEl) sensitivityValueEl.textContent = sensitivityLevel;
      updateThreshold();
    }
    
    // 恢复节奏型选择（此时 customRhythms 已加载，maxRhythmIndex 计算正确）
    const maxRhythmIndex = RHYTHM_PATTERNS.length + customRhythms.length;
    if (settings.currentRhythm !== undefined && settings.currentRhythm < maxRhythmIndex) {
      currentRhythm = settings.currentRhythm;
      const options = document.querySelectorAll('.rhythm-option');
      options.forEach((o, i) => {
        o.classList.toggle('active', i === currentRhythm);
      });
    }
    
    if (DEBUG) console.log('[GuitarStrumTrainer] 用户设置已加载');
  } catch (e) {
    console.warn('无法加载用户设置:', e);
  }
}

// 导出用户设置
function exportUserSettings() {
  const settings = {
    bpm: currentBPM,
    metronomeEnabled: metronomeEnabled,
    sensitivityLevel: sensitivityLevel,
    customRhythms: customRhythms,
    exportedAt: new Date().toISOString()
  };
  
  const dataStr = JSON.stringify(settings, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `guitar-strum-settings-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
  if (DEBUG) console.log('[GuitarStrumTrainer] 设置已导出');
}

// 导入用户设置
function importUserSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const settings = JSON.parse(e.target.result);
      
      // 数据类型和范围验证
      if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
        throw new Error('设置数据格式无效');
      }
      
      // 验证 customRhythms
      if (settings.customRhythms !== undefined) {
        if (!Array.isArray(settings.customRhythms)) {
          throw new Error('customRhythms 必须是数组');
        }
        for (let i = 0; i < settings.customRhythms.length; i++) {
          const rhythm = settings.customRhythms[i];
          if (typeof rhythm !== 'object' || rhythm === null) {
            throw new Error(`customRhythms[${i}] 格式无效`);
          }
          if (typeof rhythm.name !== 'string' || rhythm.name.length === 0) {
            throw new Error(`customRhythms[${i}].name 必须是有效字符串`);
          }
          if (rhythm.notes !== undefined) {
            if (!Array.isArray(rhythm.notes)) {
              throw new Error(`customRhythms[${i}].notes 必须是数组`);
            }
            for (let j = 0; j < rhythm.notes.length; j++) {
              const note = rhythm.notes[j];
              if (typeof note !== 'object' || note === null) {
                throw new Error(`customRhythms[${i}].notes[${j}] 格式无效`);
              }
              if (!['D', 'U'].includes(note.direction)) {
                throw new Error(`customRhythms[${i}].notes[${j}].direction 必须是 'D' 或 'U'`);
              }
              if (!['8th', '16th'].includes(note.duration)) {
                throw new Error(`customRhythms[${i}].notes[${j}].duration 必须是 '8th' 或 '16th'`);
              }
            }
          }
        }
        customRhythms = settings.customRhythms;
        saveCustomRhythms();
      }
      
      // 验证并导入 BPM（范围 30-300）
      if (settings.bpm !== undefined) {
        const bpm = Number(settings.bpm);
        if (typeof bpm !== 'number' || isNaN(bpm) || bpm < 30 || bpm > 300) {
          throw new Error('bpm 必须是 30-300 之间的数字');
        }
        currentBPM = bpm;
      }
      
      // 验证并导入 metronomeEnabled
      if (settings.metronomeEnabled !== undefined) {
        if (typeof settings.metronomeEnabled !== 'boolean') {
          throw new Error('metronomeEnabled 必须是布尔值');
        }
        metronomeEnabled = settings.metronomeEnabled;
      }
      
      // 验证并导入 sensitivityLevel（范围 1-100）
      if (settings.sensitivityLevel !== undefined) {
        const sens = Number(settings.sensitivityLevel);
        if (typeof sens !== 'number' || isNaN(sens) || sens < 1 || sens > 100) {
          throw new Error('sensitivityLevel 必须是 1-100 之间的数字');
        }
        sensitivityLevel = sens;
      }
      
      // 更新 UI
      const bpmSlider = document.getElementById('bpmSlider');
      const bpmValue = document.getElementById('bpmValue');
      if (bpmSlider) bpmSlider.value = currentBPM;
      if (bpmValue) bpmValue.textContent = currentBPM;
      
      const metronomeToggle = document.getElementById('metronomeToggle');
      if (metronomeToggle) metronomeToggle.checked = metronomeEnabled;
      
      const sensitivitySlider = document.getElementById('sensitivitySlider');
      const sensitivityValueEl = document.getElementById('sensitivityValue');
      if (sensitivitySlider) sensitivitySlider.value = sensitivityLevel;
      if (sensitivityValueEl) sensitivityValueEl.textContent = sensitivityLevel;
      updateThreshold();
      
      renderCustomRhythmsList();
      
      alert('设置导入成功！');
    } catch (err) {
      alert('导入失败：' + (err.message || '文件格式错误'));
      console.error('导入设置失败:', err);
    }
  };
  reader.readAsText(file);
  
  // 清空文件输入，允许重复导入同一文件
  event.target.value = '';
}

// HTML 转义（使用字符串替换，避免 DOM 创建开销）
function escapeHtml(text) {
  const _escapeHtmlMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const _escapeHtmlRegex = /[&<>"']/g;
  return String(text).replace(_escapeHtmlRegex, m => _escapeHtmlMap[m]);
}

// ========== 和弦识别 UI 更新（新增） ==========

/**
 * 更新和弦显示区域
 * @param {object} chordResult - 和弦识别结果 {chord, confidence, svg, ...}
 * @param {string|null} expectedChord - 期望的和弦
 * @param {string|null} nextChord - 下一个和弦
 */
function updateChordDisplay(chordResult, expectedChord, nextChord) {
  // 更新识别结果
  const recognizedChordEl = document.getElementById('recognizedChord');
  const chordConfidenceEl = document.getElementById('chordConfidence');
  const currentChordDisplayEl = document.getElementById('currentChordDisplay');
  const currentChordDiagramEl = document.getElementById('currentChordDiagram');
  
  if (recognizedChordEl) {
    recognizedChordEl.textContent = chordResult.chord;
    recognizedChordEl.style.color = chordResult.chord === expectedChord ? '#00ff00' : '#00d9ff';
  }
  
  if (chordConfidenceEl) {
    chordConfidenceEl.textContent = `(${Math.round(chordResult.confidence * 100)}%)`;
  }
  
  if (currentChordDisplayEl) {
    currentChordDisplayEl.textContent = chordResult.chord;
  }
  
  // 绘制和弦指法图（使用 SVG）
  if (currentChordDiagramEl && chordResult.chord) {
    drawChordDiagram(currentChordDiagramEl, chordResult.chord);
  }
  
  // 检查是否准确
  if (expectedChord && chordResult.chord === expectedChord) {
    showFeedback('✓ 和弦正确！', 'success');
  } else if (expectedChord) {
    showFeedback(`⚠ 应该是 ${expectedChord}，检测到 ${chordResult.chord}`, 'warning');
  }
}

/**
 * 在容器上绘制和弦指法图（SVG）
 * @param {HTMLElement} container - 容器元素（div）
 * @param {object} chordData - 和弦数据（包含 fingering.strings 和 fingering.frets）
 */
function drawChordDiagramOnContainer(container, chordData) {
  if (!container || !chordData || !chordData.name) return;
  
  // 使用已有的 drawChordDiagram 函数
  drawChordDiagram(container, chordData.name);
}

/**
 * 更新下一个和弦显示
 * @param {string} chordName - 和弦名称
 * @param {number} countdown - 倒计时（秒）
 */
function updateNextChordDisplay(chordName, countdown) {
  const nextChordDisplayEl = document.getElementById('nextChordDisplay');
  const nextChordDiagramEl = document.getElementById('nextChordDiagram');
  const chordTimerEl = document.getElementById('chordTimer');
  
  if (nextChordDisplayEl) {
    nextChordDisplayEl.textContent = chordName || '--';
  }
  
  if (chordTimerEl) {
    if (countdown !== undefined) {
      chordTimerEl.innerHTML = `切换：<span style="color: #ffa502; font-weight: bold;">${countdown.toFixed(1)}s</span>`;
    } else {
      chordTimerEl.innerHTML = `切换时间：<span id="transitionTime">--</span> ms`;
    }
  }
  
  // 绘制下一个和弦的指法图（使用 SVG）
  if (nextChordDiagramEl && chordName) {
    drawChordDiagram(nextChordDiagramEl, chordName);
  }
}

/**
 * 显示反馈消息
 * @param {string} message - 反馈文案
 * @param {string} type - 类型：'success' | 'warning' | 'error'
 */
function showFeedback(message, type = 'info') {
  const feedbackEl = document.getElementById('feedbackMessage');
  if (!feedbackEl) return;
  
  feedbackEl.textContent = message;
  feedbackEl.style.color = type === 'success' ? '#00ff00' : 
                            type === 'warning' ? '#ffa502' : 
                            type === 'error' ? '#ff4444' : '#888';
  
  // 3 秒后清除
  setTimeout(() => {
    if (feedbackEl.textContent === message) {
      feedbackEl.textContent = '';
    }
  }, 3000);
}

/**
 * 初始化和弦训练模式
 * @param {string} mode - 模式：'preset' | 'custom' | 'free'
 * @param {Array} progression - 和弦进行数组
 */
function initChordTraining(mode, progression) {
  currentTrainingMode = mode;
  currentProgression = progression || [];
  currentChordIndex = 0;
  
  if (chordDetector && analyser && audioContext) {
    chordRecognitionEnabled = true;
  }
  
  if (currentProgression.length > 0) {
    expectedChord = currentProgression[0];
    nextChord = currentProgression[1] || currentProgression[0];
    
    // 更新 UI
    const currentChordDisplayEl = document.getElementById('currentChordDisplay');
    if (currentChordDisplayEl) {
      currentChordDisplayEl.textContent = expectedChord;
    }
    
    updateNextChordDisplay(nextChord);
    
    if (DEBUG) console.log('[ChordTraining] 初始化完成:', mode, progression);
  }
}

/**
 * 切换到下一个和弦
 */
function nextChordInProgression() {
  if (currentProgression.length === 0) return;
  
  currentChordIndex = (currentChordIndex + 1) % currentProgression.length;
  expectedChord = currentProgression[currentChordIndex];
  nextChord = currentProgression[(currentChordIndex + 1) % currentProgression.length];
  
  updateNextChordDisplay(nextChord);
  
  if (DEBUG) console.log('[ChordTraining] 切换到和弦:', expectedChord);
}

/**
 * 重置和弦训练
 */
function resetChordTraining() {
  chordRecognitionEnabled = false;
  currentTrainingMode = 'preset';
  currentProgression = [];
  currentChordIndex = 0;
  expectedChord = null;
  nextChord = null;
  lastRecognizedChord = null;
  
  if (transitionDetector) {
    transitionDetector.reset();
  }
  
  // 清空 UI 显示
  const recognizedChordEl = document.getElementById('recognizedChord');
  const currentChordDisplayEl = document.getElementById('currentChordDisplay');
  const nextChordDisplayEl = document.getElementById('nextChordDisplay');
  
  if (recognizedChordEl) recognizedChordEl.textContent = '--';
  if (currentChordDisplayEl) currentChordDisplayEl.textContent = '--';
  if (nextChordDisplayEl) nextChordDisplayEl.textContent = '--';
  
  if (DEBUG) console.log('[ChordTraining] 已重置');
}

// 自动保存设置（定期）
let autoSaveIntervalId = setInterval(() => {
  saveUserSettings();
}, 5000); // 每 5 秒自动保存

// 页面卸载时清理自动保存定时器
window.addEventListener('beforeunload', () => {
  clearInterval(autoSaveIntervalId);
});

// ========== 和弦训练功能 ==========

/**
 * 设置练习模式切换
 */
function setupPracticeMode() {
  if (!practiceModeRhythm || !practiceModeComprehensive) return;
  
  practiceModeRhythm.addEventListener('click', () => setPracticeMode('rhythm'));
  practiceModeComprehensive.addEventListener('click', () => setPracticeMode('comprehensive'));
  
  // 初始化显示
  updatePracticeModeUI();
}

/**
 * 设置练习模式
 * @param {string} mode - 'rhythm' 纯节奏训练 | 'comprehensive' 和弦+节奏综合
 */
function setPracticeMode(mode) {
  practiceMode = mode;
  updatePracticeModeUI();
  if (DEBUG) console.log('[PracticeMode] 练习模式已切换:', mode);
}

/**
 * 更新练习模式 UI 显示
 */
function updatePracticeModeUI() {
  // 更新按钮状态
  if (practiceModeRhythm) {
    practiceModeRhythm.classList.toggle('active', practiceMode === 'rhythm');
  }
  if (practiceModeComprehensive) {
    practiceModeComprehensive.classList.toggle('active', practiceMode === 'comprehensive');
  }
  
  // 更新描述文字
  if (practiceModeDescription) {
    if (practiceMode === 'rhythm') {
      practiceModeDescription.textContent = '💡 纯节奏模式：专注节奏准确度，任意和弦均可练习';
    } else {
      practiceModeDescription.textContent = '💡 综合模式：需要正确和弦转换，同时评估节奏与和弦准确度';
    }
  }
  
  // 条件显示和弦训练面板
  if (chordTrainingPanel) {
    chordTrainingPanel.style.display = practiceMode === 'comprehensive' ? 'block' : 'none';
  }
  
  // 纯节奏模式关闭和弦识别
  if (practiceMode === 'rhythm') {
    chordRecognitionEnabled = false;
  }
}

/**
 * 设置和弦训练功能
 */
function setupChordTraining() {
  if (DEBUG) console.log('[ChordTraining] 初始化和弦训练功能...');
  
  // 模式切换
  if (modePreset) {
    modePreset.addEventListener('click', () => setTrainingMode('preset'));
  }
  if (modeCustom) {
    modeCustom.addEventListener('click', () => setTrainingMode('custom'));
  }
  if (modeFree) {
    modeFree.addEventListener('click', () => setTrainingMode('free'));
  }
  
  // 预设进行选择
  if (progressionSelect) {
    progressionSelect.addEventListener('change', () => {
      const index = parseInt(progressionSelect.value);
      if (window.ChordLibrary.COMMON_PROGRESSIONS[index]) {
        currentProgression = window.ChordLibrary.COMMON_PROGRESSIONS[index].chords;
        updateChordProgressionDisplay();
        updateProgressionDetail(index);
        if (DEBUG) console.log('[ChordTraining] 预设进行已选择:', currentProgression);
      }
    });
    // 初始化默认预设
    currentProgression = window.ChordLibrary.COMMON_PROGRESSIONS[0].chords;
    updateProgressionDetail(0);
  }
  
  // 自定义和弦选择按钮
  document.querySelectorAll('.chord-select-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const chordName = e.target.dataset.chord;
      addChordToProgression(chordName);
    });
  });
  
  // 保存进行
  if (btnSaveProgression) {
    btnSaveProgression.addEventListener('click', saveCustomProgression);
  }
  
  // 清空进行
  if (btnClearProgression) {
    btnClearProgression.addEventListener('click', () => {
      currentProgression = [];
      currentChordIndex = 0;
      renderSelectedChords();
      updateChordProgressionDisplay();
    });
  }
  
  // 初始化和弦检测器（需要 audioContext 和 analyser）
  // 在 startListening 时初始化
  
  if (DEBUG) console.log('[ChordTraining] 和弦训练功能初始化完成');
}

/**
 * 设置训练模式
 * @param {string} mode - 'preset', 'custom', 或 'free'
 */
function setTrainingMode(mode) {
  currentTrainingMode = mode;
  
  // 更新按钮状态
  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  
  // 显示/隐藏选择器
  if (presetSelector) {
    presetSelector.style.display = mode === 'preset' ? 'block' : 'none';
  }
  if (customChordSelector) {
    customChordSelector.style.display = mode === 'custom' ? 'block' : 'none';
  }
  
  // 自由练习模式隐藏详情
  const progressionDetailEl = document.getElementById('progressionDetail');
  
  // 自由练习模式不需要预设
  if (mode === 'free') {
    currentProgression = [];
    updateChordProgressionDisplay();
    if (progressionDetailEl) progressionDetailEl.style.display = 'none';
  } else if (mode === 'preset' && window.ChordLibrary.COMMON_PROGRESSIONS[0]) {
    currentProgression = window.ChordLibrary.COMMON_PROGRESSIONS[0].chords;
    updateChordProgressionDisplay();
    if (progressionDetailEl) progressionDetailEl.style.display = 'block';
  }
  
  if (DEBUG) console.log('[ChordTraining] 训练模式已切换:', mode);
}

/**
 * 添加和弦到进行
 * @param {string} chordName - 和弦名称
 */
function addChordToProgression(chordName) {
  if (!currentProgression) {
    currentProgression = [];
  }
  currentProgression.push(chordName);
  renderSelectedChords();
  updateChordProgressionDisplay();
}

/**
 * 渲染已选和弦
 */
function renderSelectedChords() {
  if (!selectedChordsDisplay) return;
  
  if (currentProgression.length === 0) {
    selectedChordsDisplay.innerHTML = '<span style="color: #666; font-style: italic;">点击选择和弦</span>';
    return;
  }
  
  selectedChordsDisplay.innerHTML = currentProgression.map((chord, index) => `
    <span style="background: rgba(0,217,255,0.2); padding: 5px 10px; border-radius: 5px; display: inline-flex; align-items: center; gap: 5px;">
      ${chord}
      <button onclick="removeChordFromProgression(${index})" style="background: none; border: none; color: #ff4757; cursor: pointer; font-size: 1.2em;">×</button>
    </span>
  `).join('');
}

/**
 * 从进行中和弦移除
 * @param {number} index - 索引
 */
window.removeChordFromProgression = function(index) {
  if (currentProgression && index >= 0 && index < currentProgression.length) {
    currentProgression.splice(index, 1);
    renderSelectedChords();
    updateChordProgressionDisplay();
  }
};

/**
 * 保存自定义进行
 */
function saveCustomProgression() {
  if (currentProgression.length === 0) {
    alert('请先选择和弦！');
    return;
  }
  
  const name = prompt('请输入进行名称（例如：我的 1645）:');
  if (!name) return;
  
  // 保存到 localStorage
  const saved = JSON.parse(localStorage.getItem('guitar-custom-progressions') || '[]');
  saved.push({
    name: name,
    chords: [...currentProgression],
    createdAt: new Date().toISOString()
  });
  localStorage.setItem('guitar-custom-progressions', JSON.stringify(saved));
  
  alert(`"${name}" 已保存！`);
  if (DEBUG) console.log('[ChordTraining] 自定义进行已保存:', name);
}

/**
 * 更新和弦显示
 */
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
  
  // 绘制指法图（SVG）
  if (currentChordCanvas) drawChordDiagram(currentChordCanvas, expectedChord);
  if (nextChordCanvas) drawChordDiagram(nextChordCanvas, nextChord);
  
  // 更新进度
  if (progressionBar && progressionProgress) {
    const progress = ((currentChordIndex) / currentProgression.length) * 100;
    progressionBar.style.width = `${progress}%`;
    progressionProgress.textContent = `${currentChordIndex + 1}/${currentProgression.length}`;
  }
}

/**
 * 更新和弦进行详情显示
 * @param {number} index - 和弦进行索引
 */
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

/**
 * 绘制和弦指法图 - 纯 SVG 渲染（适配 Retina 屏幕）
 * @param {HTMLElement} container - SVG 容器元素（div）
 * @param {string} chordName - 和弦名称 (如 'C', 'Am')
 */
function drawChordDiagram(container, chordName) {
  if (!container) return;
  
  // 获取容器尺寸（支持 devicePixelRatio 适配）
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const width = Math.floor(rect.width * dpr);
  const height = Math.floor(rect.height * dpr);
  
  if (!chordName) {
    // 显示空状态
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">未选择和弦</div>';
    return;
  }
  
  try {
    // 使用 chordictionary 生成 SVG
    const svgString = window.ChordLibrary.getChordSVG(chordName, width, height);
    
    // 直接插入 SVG（避免 Canvas 位图渲染导致的模糊）
    container.innerHTML = svgString;
    
    // 确保 SVG 适配容器
    const svg = container.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      // 不设置 display，让 CSS 控制居中
    }
  } catch (e) {
    console.warn('[ChordDiagram] SVG 生成失败，使用备用方案:', e);
    drawChordDiagramFallbackSVG(container, chordName);
  }
}

/**
 * 备用和弦指法图绘制（Canvas）
 * @param {HTMLCanvasElement} canvas - Canvas 元素
 * @param {string} chordName - 和弦名称
 */
/**
 * 备用和弦指法图绘制（SVG 版本）
 * @param {HTMLElement} container - SVG 容器元素（div）
 * @param {string} chordName - 和弦名称
 */
function drawChordDiagramFallbackSVG(container, chordName) {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const width = Math.floor(rect.width * dpr);
  const height = Math.floor(rect.height * dpr);
  
  const chordData = window.ChordLibrary.getChordData(chordName);
  
  if (!chordData) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">无指法数据</div>';
    return;
  }
  
  const fingering = chordData.fingering || [0, 0, 0, 0, 0, 0];
  const padding = 15 * dpr;
  const diagramWidth = width - padding * 2;
  const diagramHeight = height - padding * 2 - 20 * dpr;
  const stringSpacing = diagramWidth / 5;
  const fretSpacing = diagramHeight / 3;
  
  // 生成 SVG
  let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // 绘制品格（水平线）
  svg += `<g stroke="#fff" stroke-width="${1 * dpr}">`;
  for (let i = 0; i <= 3; i++) {
    const y = padding + i * fretSpacing;
    svg += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}"/>`;
  }
  svg += `</g>`;
  
  // 绘制琴弦（垂直线）
  svg += `<g stroke="#fff" stroke-width="${1 * dpr}">`;
  for (let i = 0; i < 6; i++) {
    const x = padding + i * stringSpacing;
    svg += `<line x1="${x}" y1="${padding}" x2="${x}" y2="${padding + 3 * fretSpacing}"/>`;
  }
  svg += `</g>`;
  
  // 绘制按弦位置
  for (let i = 0; i < 6; i++) {
    const fret = fingering[i] || 0;
    const x = padding + i * stringSpacing;
    
    if (fret === 0) {
      // 空弦（空心圆）
      svg += `<circle cx="${x}" cy="${padding - 8 * dpr}" r="${5 * dpr}" fill="none" stroke="#fff" stroke-width="${1.5 * dpr}"/>`;
    } else if (fret > 0) {
      // 按弦（实心圆）
      const y = padding + (fret - 0.5) * fretSpacing;
      svg += `<circle cx="${x}" cy="${y}" r="${8 * dpr}" fill="#00d9ff"/>`;
    }
  }
  
  // 和弦名称
  svg += `<text x="${width / 2}" y="${height - 5 * dpr}" fill="#fff" font-size="${12 * dpr}" font-weight="bold" text-anchor="middle" font-family="Microsoft YaHei">${chordName}</text>`;
  
  svg += `</svg>`;
  container.innerHTML = svg;
}

/**
 * 更新和弦识别结果显示
 * @param {object} result - 识别结果
 */
function updateChordRecognition(result) {
  if (!recognizedChordEl || !chordConfidenceEl) return;
  
  if (result) {
    recognizedChordEl.textContent = result.chord;
    chordConfidenceEl.textContent = `(${Math.round(result.confidence * 100)}%)`;
    
    // 颜色反馈
    if (result.confidence >= 0.8) {
      recognizedChordEl.style.color = '#2ed573'; // 绿色 - 高置信度
    } else if (result.confidence >= 0.65) {
      recognizedChordEl.style.color = '#ffa502'; // 橙色 - 中等置信度
    } else {
      recognizedChordEl.style.color = '#ff4757'; // 红色 - 低置信度
    }
  } else {
    recognizedChordEl.textContent = '--';
    chordConfidenceEl.textContent = '(--%)';
    recognizedChordEl.style.color = '#888';
  }
}

/**
 * 更新转换时间显示
 * @param {number} timeMs - 转换时间（毫秒）
 */
function updateTransitionTime(timeMs) {
  if (!transitionTimeEl) return;
  
  if (timeMs) {
    transitionTimeEl.textContent = timeMs;
    
    // 颜色反馈
    if (timeMs < 300) {
      transitionTimeEl.style.color = '#2ed573'; // 优秀
    } else if (timeMs < 500) {
      transitionTimeEl.style.color = '#ffa502'; // 良好
    } else {
      transitionTimeEl.style.color = '#ff4757'; // 需改进
    }
  } else {
    transitionTimeEl.textContent = '--';
    transitionTimeEl.style.color = '#888';
  }
}

/**
 * 初始化和弦检测器
 */
function initChordDetector() {
  if (audioContext && analyser) {
    chordDetector = new window.ChordDetector(audioContext, analyser);
    transitionDetector = new window.TransitionDetector();
    // 根据练习模式决定是否启用和弦识别
    chordRecognitionEnabled = practiceMode === 'comprehensive';
    if (DEBUG) console.log('[ChordTraining] 和弦检测器已初始化, chordRecognitionEnabled:', chordRecognitionEnabled);
  }
}

/**
 * 处理和弦识别
 */
function processChordRecognition() {
  if (!chordRecognitionEnabled || !chordDetector) return;
  
  const bufferLength = analyser.frequencyBinCount;
  const freqData = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(freqData);
  
  const result = chordDetector.detect(freqData);
  
  if (result) {
    // 更新识别显示
    updateChordRecognition(result);
    
    // 提前声明 isCorrect，使其在后续反馈逻辑中可用
    let isCorrect = false;
    
    // 在训练模式下检查是否匹配期望和弦
    if (currentTrainingMode !== 'free' && expectedChord) {
      isCorrect = result.chord === expectedChord;
      
      // 记录和弦识别统计
      practiceChordTotal++;
      if (isCorrect) {
        practiceChordCorrect++;
      }
    
      // 检测和弦转换
      if (transitionDetector) {
        transitionDetector.onChordDetected(result.chord, expectedChord, Date.now());
        
        // 记录转换时间到练习数据
        const stats = transitionDetector.getStats();
        if (stats.transitionCount > 0) {
          const lastTransition = stats.transitions[stats.transitionCount - 1];
          practiceTransitionTimes.push(lastTransition.time);
          if (practiceTransitionTimes.length > 100) {
            practiceTransitionTimes.shift();
          }
        }
      
      // 如果识别正确且是当前期望和弦，更新进度
      if (isCorrect && result.chord === expectedChord) {
        // 检查是否需要切换到下一个和弦
        if (lastRecognizedChord !== expectedChord) {
          // 新的和弦被正确识别
          currentChordIndex = (currentChordIndex + 1) % currentProgression.length;
          updateChordProgressionDisplay();
          
          // 显示转换时间
          const stats = transitionDetector.getStats();
          if (stats.transitionCount > 0) {
            const lastTransition = stats.transitions[stats.transitionCount - 1];
            updateTransitionTime(lastTransition.time);
          }
        }
      }
    }
    
    // 实时反馈 - 根据练习模式调整
    if (practiceMode === 'comprehensive') {
      if (isCorrect) {
        feedbackMessage.textContent = `✓ ${result.chord} 和弦正确！ (${Math.round(result.confidence * 100)}%)`;
      } else {
        feedbackMessage.textContent = `⚠ 应该是 ${expectedChord}，检测到 ${result.chord}`;
      }
    } else if (currentTrainingMode === 'free') {
      // 自由练习模式
      feedbackMessage.textContent = `识别：${result.chord} (${Math.round(result.confidence * 100)}%)`;
    }
    
    lastRecognizedChord = result.chord;
  } else {
    updateChordRecognition(null);
    if (chordRecognitionEnabled) {
      feedbackMessage.textContent = '🎸 弹奏和弦...';
    }
  }
}

/**
 * 重置和弦训练状态
 */
function resetChordTraining() {
  currentChordIndex = 0;
  lastRecognizedChord = null;
  if (transitionDetector) {
    transitionDetector.reset();
  }
  updateChordProgressionDisplay();
  updateChordRecognition(null);
  updateTransitionTime(null);
}

/**
 * 获取和弦训练统计数据
 */
function getChordTrainingStats() {
  if (!transitionDetector) return null;
  
  return transitionDetector.getStats();
}

/**
 * 计算流畅度评分
 */
function calculateFluencyScore(avgTime, transitions, duration) {
  if (transitions.length === 0 || duration === 0) return 0;
  
  let timeScore = 0;
  if (avgTime > 0) {
    if (avgTime < 300) {
      timeScore = 100;
    } else if (avgTime < 500) {
      timeScore = 100 - ((avgTime - 300) / 200) * 30;
    } else if (avgTime < 1000) {
      timeScore = 70 - ((avgTime - 500) / 500) * 40;
    } else {
      timeScore = Math.max(0, 30 - ((avgTime - 1000) / 1000) * 30);
    }
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

/**
 * 渲染趋势图表（使用 Chart.js）
 */
function renderTrendCharts() {
  if (typeof Chart === 'undefined') {
    console.warn('[GuitarStrumTrainer] Chart.js 未加载，跳过趋势图表');
    return;
  }
  
  const recentHistory = strumHistory.slice(0, 10).reverse();
  
  if (recentHistory.length === 0) {
    return;
  }
  
  const labels = recentHistory.map((_, i) => `#${i + 1}`);
  const accuracies = recentHistory.map(h => h.chordAccuracy || 0);
  const avgTimes = recentHistory.map(h => h.avgTransitionTime || 0);
  
  if (accuracyTrendChartInstance) {
    accuracyTrendChartInstance.destroy();
  }
  
  const accuracyCtx = document.getElementById('accuracyTrendChart');
  if (accuracyCtx) {
    accuracyTrendChartInstance = new Chart(accuracyCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '和弦准确率 (%)',
          data: accuracies,
          borderColor: '#2ed573',
          backgroundColor: 'rgba(46, 213, 115, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#2ed573',
          pointBorderColor: '#1a1a2e',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#888' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#666' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            min: 0,
            max: 100,
            ticks: { color: '#666' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }
  
  if (transitionTimeTrendChartInstance) {
    transitionTimeTrendChartInstance.destroy();
  }
  
  const timeCtx = document.getElementById('transitionTimeTrendChart');
  if (timeCtx) {
    transitionTimeTrendChartInstance = new Chart(timeCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '平均转换时间 (ms)',
          data: avgTimes,
          borderColor: '#ffa502',
          backgroundColor: 'rgba(255, 165, 2, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#ffa502',
          pointBorderColor: '#1a1a2e',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#888' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#666' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            min: 0,
            ticks: { color: '#666' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }
}

// 导出到全局作用域以便调试
window.guitarTrainer = {
  chordDetector: () => chordDetector,
  transitionDetector: () => transitionDetector,
  getProgression: () => currentProgression,
  getStats: getChordTrainingStats,
  setTrainingMode: setTrainingMode
};
}