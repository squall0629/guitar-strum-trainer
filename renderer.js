// 吉他扫弦练习助手 - 核心入口 v2.1
// 模块化重构版本 - 主入口文件

// ========== 模块导入 ==========
import { saveUserSettings, loadUserSettings, saveHistory, loadHistoryFromStorage, exportUserSettings, importUserSettings } from './storage.js';
import { calculateStabilityScore, getMeasureDuration, checkMeasureUpdate, updateScores, calculateRhythmScore, calculateToneScore, calculateDynamicsScore, updateStabilityScores } from './scoring.js';
import { drawRecorderWaveform, drawSpectrumWaveform, updateScoreRing, drawChordDiagram, drawChordDiagramFallbackSVG, updateChordRecognition, updateTransitionTime } from './ui-renderer.js';

import {
  initAudioEngine,
  startListening as audioStartListening,
  stopListening as audioStopListening,
  isListeningState,
  analyzeAudio,
  detectStrum,
  provideFeedback,
  calculateToneScore as audioCalculateToneScore,
  setCurrentBPM,
  getCurrentBPM,
  setMetronomeEnabled,
  isMetronomeEnabled,
  startMetronome,
  stopMetronome,
  playMetronomeSound,
  getIsPlayingDemo,
  setIsPlayingDemo,
  stopDemo,
  resetFluxState,
  getDetectedStrums,
  getCurrentMeasureStrums,
  getMeasureHistory,
  getLastMeasureScores,
  setLastMeasureScores,
  getLastScoredMeasureEnd,
  setLastScoredMeasureEnd,
  setCurrentMeasureStartTime,
  getCurrentMeasureStartTime,
  setCurrentMeasureStrums,
  setSensitivityLevel,
  updateThreshold,
  getAudioContext,
  getAnalyser
} from './audio-engine.js';

import {
  initChordTraining,
  initChordDetector,
  getChordDetector,
  getTransitionDetector,
  setChordRecognitionEnabled,
  isChordRecognitionEnabled,
  setPracticeMode,
  getPracticeMode,
  setPracticeStartTime,
  getPracticeStartTime,
  resetPracticeStats,
  getPracticeChordStats,
  getPracticeTransitionTimes,
  updateChordProgressionDisplay,
  updateChordDisplay,
  updateChordRecognition,
  updateTransitionTime as updateTransitionTimeDisplay,
  resetChordTraining,
  getCurrentProgression,
  setTrainingMode as setChordTrainingMode
} from './chord-training.js';

import {
  initCustomRhythms,
  getActiveRhythm,
  getRhythmPatterns,
  renderCustomRhythmsList,
  exportCustomRhythms,
  importCustomRhythms,
  generateArrowPattern
} from './custom-rhythms.js';

import {
  initEventHandlers,
  updateListeningState,
  setCurrentRhythm,
  getCurrentRhythm,
  setBPMValue,
  setMetronomeChecked,
  setSensitivityValue,
  updateStatus
} from './event-handlers.js';

// ========== 全局状态 ==========
let currentRhythm = 0;
let currentBPM = 70;
let metronomeEnabled = false;
let sensitivityLevel = 50;
let practiceMode = 'rhythm';

// 历史统计
let strumHistory = [];
const MAX_HISTORY = 4;

// 练习报告
let practiceReportModal = null;

// 自动保存
let autoSaveIntervalId = null;

// 调试模式
const DEBUG = false;
const APP_VERSION = 'v2.1';

// ========== 练习报告 ==========
function setupPracticeReport() {
  practiceReportModal = document.getElementById('practiceReportModal');
  const btnClose1 = document.getElementById('btnCloseReport');
  const btnClose2 = document.getElementById('btnCloseReport2');
  
  if (btnClose1) btnClose1.addEventListener('click', () => practiceReportModal.style.display = 'none');
  if (btnClose2) btnClose2.addEventListener('click', () => practiceReportModal.style.display = 'none');
  if (practiceReportModal) practiceReportModal.addEventListener('click', (e) => { if (e.target === practiceReportModal) practiceReportModal.style.display = 'none'; });
}

function showPracticeReport() {
  if (!practiceReportModal) return;
  
  const duration = getPracticeStartTime() > 0 ? Math.round((Date.now() - getPracticeStartTime()) / 1000) : 0;
  const transitionStats = getTransitionDetector()?.getStats();
  const transitionCount = transitionStats?.transitionCount || 0;
  const avgTransitionTime = transitionStats ? Math.round(transitionStats.avgTransitionTime) : 0;
  const { correct, total } = getPracticeChordStats();
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const practiceTransitionTimes = getPracticeTransitionTimes();
  const bestTransition = practiceTransitionTimes.length > 0 ? Math.round(Math.min(...practiceTransitionTimes)) : null;
  const worstTransition = practiceTransitionTimes.length > 0 ? Math.round(Math.max(...practiceTransitionTimes)) : null;
  const totalScoreEl = document.getElementById('totalScore');
  const totalScore = parseInt(totalScoreEl?.textContent) || 0;
  
  document.getElementById('reportDuration').textContent = duration + 's';
  document.getElementById('reportTotalScore').textContent = totalScore;
  
  if (practiceMode === 'comprehensive') {
    document.getElementById('reportTransitions').textContent = transitionCount;
    document.getElementById('reportAvgTime').textContent = avgTransitionTime > 0 ? avgTransitionTime + 'ms' : '--';
    document.getElementById('reportAccuracy').textContent = accuracy > 0 ? accuracy + '%' : '--';
    document.getElementById('reportFluency').textContent = calculateFluencyScore(avgTransitionTime, practiceTransitionTimes, duration);
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

// 流畅度评分
function calculateFluencyScore(avgTime, transitions, duration) {
  if (transitions.length === 0 || duration === 0) return '--';
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

// ========== 更新包装函数 ==========
function updateScoresWrapper() {
  const rhythmScoreEl = document.getElementById('rhythmScore');
  const toneScoreEl = document.getElementById('toneScore');
  const dynamicsScoreEl = document.getElementById('dynamicsScore');
  const totalScoreEl = document.getElementById('totalScore');
  const rhythmRingEl = document.getElementById('rhythmRing');
  const toneRingEl = document.getElementById('toneRing');
  const dynamicsRingEl = document.getElementById('dynamicsRing');
  const totalRingEl = document.getElementById('totalRing');
  
  updateScores(
    getLastMeasureScores(),
    rhythmScoreEl, toneScoreEl, dynamicsScoreEl, totalScoreEl,
    () => checkMeasureUpdateWrapper()
  );
}

function checkMeasureUpdateWrapper() {
  const rhythmScoreEl = document.getElementById('rhythmScore');
  const toneScoreEl = document.getElementById('toneScore');
  const dynamicsScoreEl = document.getElementById('dynamicsScore');
  const totalScoreEl = document.getElementById('totalScore');
  const rhythmRingEl = document.getElementById('rhythmRing');
  const toneRingEl = document.getElementById('toneRing');
  const dynamicsRingEl = document.getElementById('dynamicsRing');
  const totalRingEl = document.getElementById('totalRing');
  
  const result = checkMeasureUpdate(
    isListeningState(),
    getCurrentMeasureStartTime(),
    getCurrentMeasureStrums(),
    getLastScoredMeasureEnd(),
    currentBPM,
    getActiveRhythm,
    currentRhythm,
    calculateRhythmScore,
    calculateToneScore,
    calculateDynamicsScore,
    getMeasureHistory(),
    MAX_HISTORY,
    getLastMeasureScores(),
    rhythmScoreEl, toneScoreEl, dynamicsScoreEl, totalScoreEl,
    rhythmRingEl, toneRingEl, dynamicsRingEl, totalRingEl,
    updateScoreRing,
    () => updateStabilityScores(getMeasureHistory(), calculateStabilityScore, DEBUG),
    DEBUG
  );
  
  if (result) {
    setLastMeasureScores(result.lastMeasureScores);
    setLastScoredMeasureEnd(result.lastScoredMeasureEnd);
    setCurrentMeasureStartTime(result.currentMeasureStartTime);
    setCurrentMeasureStrums(result.currentMeasureStrums);
  }
}

// ========== 开始/停止监听 ==========
async function startListening() {
  const success = await audioStartListening();
  if (!success) {
    updateStatus('error');
    const feedbackMessage = document.getElementById('feedbackMessage');
    if (feedbackMessage) feedbackMessage.textContent = '❌ 无法访问麦克风';
    return;
  }
  
  resetFluxState();
  setPracticeStartTime(Date.now());
  resetPracticeStats();
  initChordDetector(getAudioContext(), getAnalyser());
  setChordRecognitionEnabled(practiceMode === 'comprehensive');
  resetChordTraining();
  
  updateListeningState(true);
  updateStatus('listening');
  
  const activeRhythm = getActiveRhythm(currentRhythm);
  const feedbackMessage = document.getElementById('feedbackMessage');
  if (feedbackMessage) {
    feedbackMessage.textContent = metronomeEnabled
      ? `🎯 开始练习：${activeRhythm.name} (节拍器：${currentBPM} BPM)`
      : `🎯 开始练习：${activeRhythm.name}`;
  }
  
  if (metronomeEnabled) startMetronome();
  
  const volumeMeterFill = document.getElementById('volumeMeterFill');
  const recorderCanvas = document.getElementById('recorderWaveform');
  const recorderCtx = recorderCanvas?.getContext('2d');
  const spectrumCanvas = document.getElementById('spectrumWaveform');
  const spectrumCtx = spectrumCanvas?.getContext('2d');
  
  analyzeAudio(
    () => updateScoresWrapper(),
    (canvas, ctx, data, timeData, rms, bufferSize, drawInterval, debug) =>
      drawRecorderWaveform(canvas, ctx, data, timeData, rms, bufferSize, drawInterval, debug),
    (canvas, ctx, freqData, history, historySize, drawInterval, audioCtx, debug) =>
      drawSpectrumWaveform(canvas, ctx, freqData, history, historySize, drawInterval, audioCtx, debug)
  );
}

function stopListening() {
  setChordRecognitionEnabled(false);
  stopMetronome();
  if (getIsPlayingDemo()) stopDemo();
  
  audioStopListening();
  updateListeningState(false);
  updateStatus('ready');
  
  const detectedStrums = getDetectedStrums();
  if (detectedStrums.length > 0) {
    const totalScoreEl = document.getElementById('totalScore');
    const rhythmScoreEl = document.getElementById('rhythmScore');
    const toneScoreEl = document.getElementById('toneScore');
    const dynamicsScoreEl = document.getElementById('dynamicsScore');
    
    saveHistory(
      strumHistory,
      detectedStrums,
      totalScoreEl,
      rhythmScoreEl,
      toneScoreEl,
      dynamicsScoreEl,
      currentRhythm,
      currentBPM,
      'preset',
      practiceMode,
      getPracticeChordStats().total,
      getPracticeChordStats().correct,
      getPracticeTransitionTimes(),
      getTransitionDetector(),
      getRhythmPatterns(),
      getActiveRhythm,
      getPracticeStartTime()
    );
    showPracticeReport();
  }
  
  const feedbackMessage = document.getElementById('feedbackMessage');
  if (feedbackMessage) {
    feedbackMessage.textContent = metronomeEnabled
      ? `练习结束 (节拍器：${currentBPM} BPM)`
      : '练习结束，点击"开始练习"继续';
  }
  
  autoSaveIntervalId = setInterval(() => {
    saveUserSettings(currentBPM, metronomeEnabled, sensitivityLevel, currentRhythm, exportCustomRhythms(), DEBUG);
  }, 5000);
}

// ========== 渲染历史统计 ==========
function renderHistory() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;
  
  historyList.innerHTML = strumHistory.map(item => {
    const modeLabel = item.mode === 'preset' ? '📖' : item.mode === 'custom' ? '✏️' : item.mode === 'free' ? '🎸' : '';
    const practiceModeLabel = item.practiceMode === 'comprehensive' ? '🎸综合' : '🥁节奏';
    const accuracyInfo = item.practiceMode === 'comprehensive' && item.chordAccuracy ? ` | 准确率${item.chordAccuracy}%` : '';
    const transTimeInfo = item.practiceMode === 'comprehensive' && item.avgTransitionTime ? ` | 转换${item.avgTransitionTime}ms` : '';
    return `<div class="history-item"><span class="time">${item.time} - ${item.rhythm} ${modeLabel} ${practiceModeLabel}</span><span class="score">${item.score}分 (${item.strums}次扫弦${accuracyInfo}${transTimeInfo})</span></div>`;
  }).join('');
}

function renderStatsChart() {
  const statsChartCanvas = document.getElementById('statsChart');
  const statsChartCtx = statsChartCanvas?.getContext('2d');
  const avgScoreEl = document.getElementById('avgScore');
  const maxScoreEl = document.getElementById('maxScore');
  const practiceCountEl = document.getElementById('practiceCount');
  
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
  
  // 绘制图表...
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
}

function renderTrendCharts() {
  if (typeof Chart === 'undefined') return;
  const recentHistory = strumHistory.slice(0, 10).reverse();
  if (recentHistory.length === 0) return;
  // 渲染图表逻辑...
}

// ========== 初始化 ==========
function init() {
  // 获取 DOM 元素
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const rhythmSelector = document.getElementById('rhythmSelector');
  const metronomeToggle = document.getElementById('metronomeToggle');
  const bpmSlider = document.getElementById('bpmSlider');
  const bpmValue = document.getElementById('bpmValue');
  const sensitivitySlider = document.getElementById('sensitivitySlider');
  const sensitivityValueEl = document.getElementById('sensitivityValue');
  const btnAddRhythm = document.getElementById('btnAddRhythm');
  const btnMicTest = document.getElementById('btnMicTest');
  const volumeMeterFill = document.getElementById('volumeMeterFill');
  const recorderCanvas = document.getElementById('recorderWaveform');
  const recorderCtx = recorderCanvas?.getContext('2d');
  const spectrumCanvas = document.getElementById('spectrumWaveform');
  const spectrumCtx = spectrumCanvas?.getContext('2d');
  
  // 初始化音频引擎
  initAudioEngine({
    volumeMeterFill,
    recorderCanvas,
    recorderCtx,
    spectrumCanvas,
    spectrumCtx,
    getActiveRhythm
  });
  
  // 初始化事件处理
  initEventHandlers({
    btnStart,
    btnStop,
    rhythmSelector,
    metronomeToggle,
    bpmSlider,
    bpmValue,
    sensitivitySlider,
    sensitivityValueEl,
    btnAddRhythm,
    btnMicTest,
    onRhythmSelect: (index) => {
      currentRhythm = index;
      const pattern = getActiveRhythm(index);
      const feedbackMessage = document.getElementById('feedbackMessage');
      if (feedbackMessage && pattern) feedbackMessage.textContent = `已选择：${pattern.name} - ${pattern.description}`;
    },
    onMetronomeToggle: (enabled) => {
      metronomeEnabled = enabled;
      setMetronomeEnabled(enabled);
      const feedbackMessage = document.getElementById('feedbackMessage');
      if (feedbackMessage) feedbackMessage.textContent = enabled ? `节拍器已开启 - ${currentBPM} BPM` : '节拍器已关闭';
      if (enabled && isListeningState()) startMetronome();
      else stopMetronome();
    },
    onBPMChange: (bpm) => {
      currentBPM = bpm;
      setCurrentBPM(bpm);
      if (metronomeEnabled && isListeningState()) { stopMetronome(); startMetronome(); }
    },
    onSensitivityChange: (level) => {
      sensitivityLevel = level;
      setSensitivityLevel(level);
      const feedbackMessage = document.getElementById('feedbackMessage');
      if (feedbackMessage && !isListeningState()) feedbackMessage.textContent = `灵敏度：${level} - 开始练习后生效`;
    },
    onStart: () => audioStartListening(),
    onStop: () => audioStopListening()
  });
  
  // 初始化和弦训练
  initChordTraining({
    currentChordDisplay: document.getElementById('currentChordDisplay'),
    nextChordDisplay: document.getElementById('nextChordDisplay'),
    currentChordCanvas: document.getElementById('currentChordDiagram'),
    nextChordCanvas: document.getElementById('nextChordDiagram'),
    recognizedChordEl: document.getElementById('recognizedChord'),
    chordConfidenceEl: document.getElementById('chordConfidence'),
    transitionTimeEl: document.getElementById('transitionTime'),
    progressionBar: document.getElementById('progressionBar'),
    progressionProgress: document.getElementById('progressionProgress'),
    btnSaveProgression: document.getElementById('btnSaveProgression'),
    btnClearProgression: document.getElementById('btnClearProgression'),
    chordTrainingPanel: document.querySelector('.chord-training-panel'),
    practiceModeRhythm: document.getElementById('practiceModeRhythm'),
    practiceModeComprehensive: document.getElementById('practiceModeComprehensive'),
    practiceModeDescription: document.getElementById('practiceModeDescription'),
    modePreset: document.getElementById('modePreset'),
    modeCustom: document.getElementById('modeCustom'),
    modeFree: document.getElementById('modeFree'),
    presetSelector: document.getElementById('presetSelector'),
    progressionSelect: document.getElementById('progressionSelect'),
    customChordSelector: document.getElementById('customChordSelector'),
    selectedChordsDisplay: document.getElementById('selectedChords'),
    currentChordDisplayEl: document.getElementById('currentChordDisplay')
  });
  
  // 初始化自定义节奏型
  initCustomRhythms({
    btnAddRhythm,
    rhythmSelector
  });
  
  // 加载历史
  strumHistory = loadHistoryFromStorage();
  renderHistory();
  renderStatsChart();
  updateStatus('ready');
  
  setupPracticeReport();
}

// ========== 窗口大小调整 ==========
window.addEventListener('resize', () => {
  const recorderCanvas = document.getElementById('recorderWaveform');
  const spectrumCanvas = document.getElementById('spectrumWaveform');
  const statsChartCanvas = document.getElementById('statsChart');
  
  if (recorderCanvas) { recorderCanvas.width = recorderCanvas.offsetWidth; recorderCanvas.height = recorderCanvas.offsetHeight; }
  if (spectrumCanvas) { spectrumCanvas.width = spectrumCanvas.offsetWidth; spectrumCanvas.height = spectrumCanvas.offsetHeight; }
  if (statsChartCanvas) { statsChartCanvas.width = statsChartCanvas.offsetWidth; statsChartCanvas.height = statsChartCanvas.offsetHeight; renderStatsChart(); }
});

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', () => {
  try { init(); } catch (error) { console.error('[GuitarStrumTrainer] 初始化失败:', error); }
});

// ========== 导出到全局 ==========
window.guitarTrainer = {
  chordDetector: getChordDetector,
  transitionDetector: getTransitionDetector,
  getProgression: getCurrentProgression,
  setTrainingMode: setChordTrainingMode,
  exportUserSettings,
  importUserSettings,
  getIsPlayingDemo,
  stopDemo
};
