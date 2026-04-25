// 吉他扫弦练习助手 - 核心入口 v2.1
// 模块化重构版本 - 主入口文件

// ========== 模块导入 ==========
import {
  DEFAULT_BPM,
  DEFAULT_SENSITIVITY,
  AUTO_SAVE_INTERVAL,
  INIT_TUNER_DELAY,
  CANVAS_RESIZE_DEBOUNCE,
  FLUENCY_TIME_EXCELLENT,
  FLUENCY_TIME_GOOD,
  FLUENCY_TIME_FAIR,
  FLUENCY_WEIGHT_TIME,
  FLUENCY_WEIGHT_CONSISTENCY,
  DEBUG
} from './constants.js';

import EventBus, { Events } from './event-bus.js';
import { AppState } from './state-manager.js';

import { saveUserSettings, loadUserSettings, saveHistory, loadHistoryFromStorage, exportUserSettings, importUserSettings } from './storage.js';
import { calculateStabilityScore, getMeasureDuration, checkMeasureUpdate, updateScores, calculateRhythmScore, calculateToneScore, calculateDynamicsScore, calculateTransitionScore, updateStabilityScores } from './scoring.js';
import { drawRecorderWaveform, drawSpectrumWaveform, updateScoreRing, drawChordDiagram, drawChordDiagramFallbackSVG, updateChordRecognition as updateChordRecognitionUI, updateTransitionTime as updateTransitionTimeUI } from './ui-renderer.js';
import { identifyString, playReferenceTone, resetTunerState, initChordbookTuner, startChordbookTuner, stopChordbookTuner } from './tuner.js';
import { updateTunerDisplay, initTunerUI, resetTunerUI } from './tuner-ui.js';
import { initAudioEngine, startListening as audioStartListening, stopListening as audioStopListening, isListeningState, analyzeAudio, getAudioContext, getAnalyser } from './audio-core.js';
import { setCurrentBPM, getCurrentBPM, setMetronomeEnabled, isMetronomeEnabled, startMetronome, stopMetronome, playMetronomeSound } from './audio-metronome.js';
import { getIsPlayingDemo, setIsPlayingDemo, stopDemo, playDemo, loadGuitarSoundfont } from './audio-demo.js';
import { detectStrum, provideFeedback, calculateToneScore as audioCalculateToneScore, getDetectedStrums, getCurrentMeasureStrums, getMeasureHistory, getLastMeasureScores, setLastMeasureScores, getLastScoredMeasureEnd, setLastScoredMeasureEnd, setCurrentMeasureStartTime, getCurrentMeasureStartTime, setCurrentMeasureStrums, setSensitivityLevel, getSensitivityLevel, updateThreshold, resetDetectionSession, getMicDiagnosticStatus } from './audio-detection.js';
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
  generateArrowPattern,
  playCustomRhythmFromList
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

// ========== 调音器状态 ==========
let tunerAnimationFrame = null;
let isTunerListening = false;

// 历史统计
let strumHistory = [];
const MAX_HISTORY = 4;

// 自动保存
let autoSaveIntervalId = null;

// 初始调音器启动定时器
let initTunerTimeoutId = null;
let micStatusLastMessage = '';
let micStatusLastUpdate = 0;

const MIC_STATUS_UI_INTERVAL = 500;

// ========== 缓存 DOM 元素 ==========
const cachedDOM = {
  // 分数元素
  rhythmScore: null,
  toneScore: null,
  dynamicsScore: null,
  transitionScore: null,
  totalScore: null,
  rhythmRing: null,
  toneRing: null,
  dynamicsRing: null,
  transitionRing: null,
  totalRing: null,
  
  // 调音器元素
  tunerNeedle: null,
  tunerStringName: null,
  tunerCents: null,
  tunerFrequency: null,
  tunerTickLeft: null,
  tunerTickMidLeft: null,
  tunerTickCenter: null,
  tunerTickMidRight: null,
  tunerTickRight: null,
  
  // 练习报告元素
  practiceReportModal: null,
  reportDuration: null,
  reportTotalScore: null,
  reportTransitions: null,
  reportAvgTime: null,
  reportAccuracy: null,
  reportFluency: null,
  reportBestTransition: null,
  reportWorstTransition: null,
  
  // 其他常用元素
  feedbackMessage: null,
  loadingOverlay: null,
  volumeMeterFill: null,
  recorderWaveform: null,
  spectrumWaveform: null,
  historyList: null,
  avgScore: null,
  maxScore: null,
  practiceCount: null,
  statsChart: null,
  statusIndicator: null,
  statusText: null
};

/**
 * 安全获取缓存的 DOM 元素，支持 null 检查和动态重新获取
 * @param {string} id - 元素 ID
 * @param {string} selector - CSS 选择器（可选）
 * @returns {HTMLElement|null}
 */
function getCachedElement(id, selector = null) {
  const element = cachedDOM[id];
  // 如果缓存中存在且仍在 DOM 中，直接返回
  if (element && document.contains(element)) {
    return element;
  }
  // 否则重新获取并缓存
  const newElement = selector ? document.querySelector(selector) : document.getElementById(id);
  if (newElement) {
    cachedDOM[id] = newElement;
  }
  return newElement;
}

function cacheDOMElements() {
  cachedDOM.rhythmScore = document.getElementById('rhythmScore');
  cachedDOM.toneScore = document.getElementById('toneScore');
  cachedDOM.dynamicsScore = document.getElementById('dynamicsScore');
  cachedDOM.transitionScore = document.getElementById('transitionScore');
  cachedDOM.totalScore = document.getElementById('totalScore');
  cachedDOM.rhythmRing = document.getElementById('rhythmRing');
  cachedDOM.toneRing = document.getElementById('toneRing');
  cachedDOM.dynamicsRing = document.getElementById('dynamicsRing');
  cachedDOM.transitionRing = document.getElementById('transitionRing');
  cachedDOM.totalRing = document.getElementById('totalRing');
  
  cachedDOM.tunerNeedle = document.querySelector('#tunerNeedle');
  cachedDOM.tunerStringName = document.getElementById('tunerStringName');
  cachedDOM.tunerCents = document.getElementById('tunerCents');
  cachedDOM.tunerFrequency = document.getElementById('tunerFrequency');
  cachedDOM.tunerTickLeft = document.getElementById('tunerTickLeft');
  cachedDOM.tunerTickMidLeft = document.getElementById('tunerTickMidLeft');
  cachedDOM.tunerTickCenter = document.getElementById('tunerTickCenter');
  cachedDOM.tunerTickMidRight = document.getElementById('tunerTickMidRight');
  cachedDOM.tunerTickRight = document.getElementById('tunerTickRight');
  
  cachedDOM.practiceReportModal = document.getElementById('practiceReportModal');
  cachedDOM.reportDuration = document.getElementById('reportDuration');
  cachedDOM.reportTotalScore = document.getElementById('reportTotalScore');
  cachedDOM.reportTransitions = document.getElementById('reportTransitions');
  cachedDOM.reportAvgTime = document.getElementById('reportAvgTime');
  cachedDOM.reportAccuracy = document.getElementById('reportAccuracy');
  cachedDOM.reportFluency = document.getElementById('reportFluency');
  cachedDOM.reportBestTransition = document.getElementById('reportBestTransition');
  cachedDOM.reportWorstTransition = document.getElementById('reportWorstTransition');
  
  cachedDOM.feedbackMessage = document.getElementById('feedbackMessage');
  cachedDOM.loadingOverlay = document.getElementById('loadingOverlay');
  cachedDOM.volumeMeterFill = document.getElementById('volumeMeterFill');
  cachedDOM.recorderWaveform = document.getElementById('recorderWaveform');
  cachedDOM.spectrumWaveform = document.getElementById('spectrumWaveform');
  cachedDOM.historyList = document.getElementById('historyList');
  cachedDOM.avgScore = document.getElementById('avgScore');
  cachedDOM.maxScore = document.getElementById('maxScore');
  cachedDOM.practiceCount = document.getElementById('practiceCount');
  cachedDOM.statsChart = document.getElementById('statsChart');
  cachedDOM.statusIndicator = document.getElementById('statusIndicator');
  cachedDOM.statusText = document.getElementById('statusText');
}

// APP_VERSION 已在 constants.js 中定义，这里不再重复

// ========== 练习报告 ==========
function setupPracticeReport() {
  const btnClose1 = document.getElementById('btnCloseReport');
  const btnClose2 = document.getElementById('btnCloseReport2');
  
  if (btnClose1) btnClose1.addEventListener('click', () => cachedDOM.practiceReportModal.style.display = 'none');
  if (btnClose2) btnClose2.addEventListener('click', () => cachedDOM.practiceReportModal.style.display = 'none');
  if (cachedDOM.practiceReportModal) cachedDOM.practiceReportModal.addEventListener('click', (e) => { if (e.target === cachedDOM.practiceReportModal) cachedDOM.practiceReportModal.style.display = 'none'; });
}

function showPracticeReport() {
  if (!cachedDOM.practiceReportModal) return;
  
  const duration = getPracticeStartTime() > 0 ? Math.round((Date.now() - getPracticeStartTime()) / 1000) : 0;
  const transitionStats = getTransitionDetector()?.getStats();
  const transitionCount = transitionStats?.transitionCount || 0;
  const avgTransitionTime = transitionStats ? Math.round(transitionStats.avgTransitionTime) : 0;
  const { correct, total } = getPracticeChordStats();
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const practiceTransitionTimes = getPracticeTransitionTimes();
  const bestTransition = practiceTransitionTimes.length > 0 ? Math.round(Math.min(...practiceTransitionTimes)) : null;
  const worstTransition = practiceTransitionTimes.length > 0 ? Math.round(Math.max(...practiceTransitionTimes)) : null;
  const totalScore = parseInt(cachedDOM.totalScore?.textContent) || 0;
  const isComprehensiveMode = AppState.getPracticeMode() === 'comprehensive';
  
  if (cachedDOM.reportDuration) cachedDOM.reportDuration.textContent = duration + 's';
  if (cachedDOM.reportTotalScore) cachedDOM.reportTotalScore.textContent = totalScore;
  
  if (isComprehensiveMode) {
    if (cachedDOM.reportTransitions) cachedDOM.reportTransitions.textContent = transitionCount;
    if (cachedDOM.reportAvgTime) cachedDOM.reportAvgTime.textContent = avgTransitionTime > 0 ? avgTransitionTime + 'ms' : '--';
    if (cachedDOM.reportAccuracy) cachedDOM.reportAccuracy.textContent = accuracy > 0 ? accuracy + '%' : '--';
    if (cachedDOM.reportFluency) cachedDOM.reportFluency.textContent = calculateFluencyScore(avgTransitionTime, practiceTransitionTimes, duration);
    if (cachedDOM.reportBestTransition) cachedDOM.reportBestTransition.textContent = bestTransition !== null ? Math.round(bestTransition) + 'ms' : '--';
    if (cachedDOM.reportWorstTransition) cachedDOM.reportWorstTransition.textContent = worstTransition !== null ? Math.round(worstTransition) + 'ms' : '--';
  } else {
    if (cachedDOM.reportTransitions) cachedDOM.reportTransitions.textContent = '--';
    if (cachedDOM.reportAvgTime) cachedDOM.reportAvgTime.textContent = '--';
    if (cachedDOM.reportAccuracy) cachedDOM.reportAccuracy.textContent = '--';
    if (cachedDOM.reportFluency) cachedDOM.reportFluency.textContent = '--';
    if (cachedDOM.reportBestTransition) cachedDOM.reportBestTransition.textContent = '--';
    if (cachedDOM.reportWorstTransition) cachedDOM.reportWorstTransition.textContent = '--';
  }
  
  if (typeof renderTrendCharts === 'function') renderTrendCharts();
  cachedDOM.practiceReportModal.style.display = 'block';
}

// 流畅度评分
function calculateFluencyScore(avgTime, transitions, duration) {
  if (transitions.length === 0 || duration === 0) return '--';
  let timeScore = 0;
  if (avgTime > 0) {
    if (avgTime < FLUENCY_TIME_EXCELLENT) timeScore = 100;
    else if (avgTime < FLUENCY_TIME_GOOD) timeScore = 100 - ((avgTime - FLUENCY_TIME_EXCELLENT) / (FLUENCY_TIME_GOOD - FLUENCY_TIME_EXCELLENT)) * 30;
    else if (avgTime < FLUENCY_TIME_FAIR) timeScore = 70 - ((avgTime - FLUENCY_TIME_GOOD) / (FLUENCY_TIME_FAIR - FLUENCY_TIME_GOOD)) * 40;
    else timeScore = Math.max(0, 30 - ((avgTime - FLUENCY_TIME_FAIR) / 1000) * 30);
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
  updateScores(
    getLastMeasureScores(),
    cachedDOM.rhythmScore, cachedDOM.toneScore, cachedDOM.dynamicsScore, cachedDOM.transitionScore, cachedDOM.totalScore,
    () => checkMeasureUpdateWrapper()
  );
}

function checkMeasureUpdateWrapper() {
  const result = checkMeasureUpdate({
    isListening: isListeningState(),
    currentMeasureStartTime: getCurrentMeasureStartTime(),
    currentMeasureStrums: getCurrentMeasureStrums(),
    lastScoredMeasureEnd: getLastScoredMeasureEnd(),
    currentBPM: AppState.getBPM(),
    getActiveRhythm: getActiveRhythm,
    currentRhythm: AppState.getCurrentRhythm(),
    calculateRhythmScore: calculateRhythmScore,
    calculateToneScore: calculateToneScore,
    calculateDynamicsScore: calculateDynamicsScore,
    calculateTransitionScore: calculateTransitionScore,
    transitionDetector: getTransitionDetector(),
    measureHistory: getMeasureHistory(),
    MAX_HISTORY: MAX_HISTORY,
    lastMeasureScores: getLastMeasureScores(),
    rhythmScoreEl: cachedDOM.rhythmScore,
    toneScoreEl: cachedDOM.toneScore,
    dynamicsScoreEl: cachedDOM.dynamicsScore,
    transitionScoreEl: cachedDOM.transitionScore,
    totalScoreEl: cachedDOM.totalScore,
    rhythmRingEl: cachedDOM.rhythmRing,
    toneRingEl: cachedDOM.toneRing,
    dynamicsRingEl: cachedDOM.dynamicsRing,
    transitionRingEl: cachedDOM.transitionRing,
    totalRingEl: cachedDOM.totalRing,
    updateScoreRing: updateScoreRing,
    updateStabilityScores: () => updateStabilityScores(getMeasureHistory(), calculateStabilityScore, DEBUG),
    DEBUG: DEBUG
  });
  
  if (result) {
    setLastMeasureScores(result.lastMeasureScores);
    setLastScoredMeasureEnd(result.lastScoredMeasureEnd);
    setCurrentMeasureStartTime(result.currentMeasureStartTime);
    setCurrentMeasureStrums(result.currentMeasureStrums);
  }
}

function setFeedbackMessage(message) {
  if (cachedDOM.feedbackMessage) {
    cachedDOM.feedbackMessage.textContent = message;
  }
}

function setLoadingOverlayState(visible, title = '正在请求麦克风权限...', subtitle = '请在浏览器弹窗中点击"允许"') {
  if (!cachedDOM.loadingOverlay) return;

  cachedDOM.loadingOverlay.style.display = visible ? 'flex' : 'none';
  const loadingTexts = cachedDOM.loadingOverlay.querySelectorAll('div');
  if (loadingTexts[2]) loadingTexts[2].textContent = title;
  if (loadingTexts[3]) loadingTexts[3].textContent = subtitle;
}

function updateMicStatusUI(force = false) {
  const now = Date.now();
  if (!force && now - micStatusLastUpdate < MIC_STATUS_UI_INTERVAL) return;
  micStatusLastUpdate = now;

  if (!isListeningState()) return;

  const micStatus = getMicDiagnosticStatus();
  if (micStatus.level === 'noise' || micStatus.level === 'clipping') {
    updateStatus('warning', micStatus.message);
    if (micStatus.message && micStatus.message !== micStatusLastMessage) {
      setFeedbackMessage(`⚠️ ${micStatus.message}`);
      micStatusLastMessage = micStatus.message;
    }
    return;
  }

  if (micStatus.level === 'low-input' || micStatus.level === 'strong-input') {
    updateStatus('listening', micStatus.message);
    return;
  }

  micStatusLastMessage = '';
  updateStatus('listening');
}

// ========== 调音器独立监听 ==========
async function startTunerListening() {
  if (isTunerListening) {
    console.log('[Renderer] 调音器已在监听中');
    return true;
  }
  
  console.log('[Renderer] startTunerListening 开始...');
  
  try {
    setLoadingOverlayState(true, '正在请求麦克风...', '请在浏览器弹窗中点击"允许"');
    setFeedbackMessage('正在请求麦克风...');
    updateStatus('busy', '正在请求麦克风...');
    
    const success = await audioStartListening();
    console.log('[Renderer] audioStartListening 返回:', success);
    
    setLoadingOverlayState(false);
    
    if (!success) {
      console.warn('[Renderer] 麦克风访问失败，audioStartListening 返回 false');
      if (cachedDOM.tunerStringName) cachedDOM.tunerStringName.textContent = '❌ 无法访问麦克风';
      updateStatus('error');
      return false;
    }
    
    console.log('[Renderer] ✓ 麦克风访问成功，启动调音器...');
    isTunerListening = true;
    
    initChordbookTuner((pitchResult) => {
      if (!isTunerListening || AppState.getCurrentMode() !== 'tuner') return;
      
      try {
        if (!pitchResult?.frequency) {
          throw new Error('无效的音高检测结果');
        }
        const result = identifyString(pitchResult.frequency, { 
          rms: pitchResult.clarity, 
          confidence: pitchResult.clarity 
        });
        updateTunerDisplay(result, cachedDOM.tunerStringName, cachedDOM.tunerCents, cachedDOM.tunerFrequency, cachedDOM.tunerNeedle);
      } catch (err) {
        console.error('[Tuner] 音高识别失败:', err);
        if (cachedDOM.tunerStringName) {
          cachedDOM.tunerStringName.textContent = '⚠️ 识别错误';
        }
        if (cachedDOM.tunerCents) {
          cachedDOM.tunerCents.textContent = '--';
        }
        if (cachedDOM.tunerFrequency) {
          cachedDOM.tunerFrequency.textContent = '-- Hz';
        }
      }
    });
    
    startChordbookTuner();
    console.log('[Renderer] ✓ 调音器启动成功');
    updateStatus('ready', '调音器已就绪');
    setFeedbackMessage('调音器已就绪');
    return true;
  } catch (err) {
    setLoadingOverlayState(false);
    console.error('[Renderer] startTunerListening 异常:', err);
    if (cachedDOM.tunerStringName) cachedDOM.tunerStringName.textContent = '❌ 麦克风访问失败';
    updateStatus('error');
    return false;
  }
}

function stopTunerListening() {
  if (!isTunerListening) return;
  
  if (tunerAnimationFrame) {
    cancelAnimationFrame(tunerAnimationFrame);
    tunerAnimationFrame = null;
  }
  
  isTunerListening = false;
  
  // 停止 @chordbook/tuner
  stopChordbookTuner();
  
  audioStopListening();
}

function startAutoSave() {
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId);
  }
  autoSaveIntervalId = setInterval(() => {
    saveUserSettings(AppState.getBPM(), AppState.getMetronomeEnabled(), AppState.getSensitivityLevel(), AppState.getCurrentRhythm(), exportCustomRhythms(), DEBUG);
  }, AUTO_SAVE_INTERVAL);
}

function stopAutoSave() {
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId);
    autoSaveIntervalId = null;
  }
}

function saveSettingsNow() {
  saveUserSettings(AppState.getBPM(), AppState.getMetronomeEnabled(), AppState.getSensitivityLevel(), AppState.getCurrentRhythm(), exportCustomRhythms(), DEBUG);
}

function startPracticeSessionState() {
  const sessionStartTime = Date.now();
  resetDetectionSession();
  resetPracticeStats();
  setPracticeStartTime(sessionStartTime);
  setCurrentMeasureStartTime(sessionStartTime);
}

function stopPracticeSession() {
  stopAutoSave();
  saveSettingsNow();
  setChordRecognitionEnabled(false);
  stopMetronome();
  if (getIsPlayingDemo()) stopDemo();
  audioStopListening();
  resetDetectionSession();
  updateListeningState(false);
  micStatusLastMessage = '';
  if (AppState.getCurrentMode() !== 'tuner') {
    updateStatus('ready');
  }
}

// ========== 开始/停止监听（练习模式） ==========
async function startListening() {
  try {
    setLoadingOverlayState(true, '正在请求麦克风...', '请在浏览器弹窗中点击"允许"');
    setFeedbackMessage('正在请求麦克风...');
    updateStatus('busy', '正在请求麦克风...');

    const success = await audioStartListening();
    
    setLoadingOverlayState(false);
    
    if (!success) {
      updateStatus('error');
      setFeedbackMessage('❌ 无法访问麦克风');
      return;
    }

    startPracticeSessionState();
    initChordDetector(getAudioContext(), getAnalyser());
    setChordRecognitionEnabled(AppState.getPracticeMode() === 'comprehensive');
    resetChordTraining();
    
    updateListeningState(true);
    updateStatus('listening');
    startAutoSave();
    
    const activeRhythm = getActiveRhythm(AppState.getCurrentRhythm());
    if (cachedDOM.feedbackMessage) {
      cachedDOM.feedbackMessage.textContent = AppState.getMetronomeEnabled()
        ? `🎯 开始练习：${activeRhythm.name} (节拍器：${AppState.getBPM()} BPM)`
        : `🎯 开始练习：${activeRhythm.name}`;
    }

    if (AppState.getMetronomeEnabled()) startMetronome(getActiveRhythm, AppState.getCurrentRhythm());
    
    const recorderCanvas = cachedDOM.recorderWaveform;
    const recorderCtx = recorderCanvas?.getContext('2d');
    const spectrumCanvas = cachedDOM.spectrumWaveform;
    const spectrumCtx = spectrumCanvas?.getContext('2d');
    
    analyzeAudio(
      () => updateScoresWrapper(),
      (canvas, ctx, data, timeData, rms, bufferSize, drawInterval, debug) =>
        drawRecorderWaveform(canvas, ctx, data, timeData, rms, bufferSize, drawInterval, debug),
      (canvas, ctx, freqData, history, historySize, drawInterval, audioCtx, debug) =>
        drawSpectrumWaveform(canvas, ctx, freqData, history, historySize, drawInterval, audioCtx, debug),
      (freqData, timeData, rms) => {
        const detectionResult = detectStrum(freqData, timeData, rms);
        updateMicStatusUI();
        return detectionResult;
      }
    );
  } catch (err) {
    setLoadingOverlayState(false);
    updateStatus('error');
    setFeedbackMessage('❌ 启动失败: ' + err.message);
    console.error('[Renderer] startListening 失败:', err);
  }
}

function stopListening() {
  const detectedStrums = getDetectedStrums();
  stopPracticeSession();
  
  if (detectedStrums.length > 0) {
    saveHistory(
      strumHistory,
      detectedStrums,
      cachedDOM.totalScore,
      cachedDOM.rhythmScore,
      cachedDOM.toneScore,
      cachedDOM.dynamicsScore,
      AppState.getCurrentRhythm(),
      AppState.getBPM(),
      'preset',
      AppState.getPracticeMode(),
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
  
  if (cachedDOM.feedbackMessage) {
    cachedDOM.feedbackMessage.textContent = AppState.getMetronomeEnabled()
      ? `练习结束 (节拍器：${AppState.getBPM()} BPM)`
      : '练习结束，点击"开始练习"继续';
  }
}

// ========== 渲染历史统计 ==========
function renderHistory() {
  if (!cachedDOM.historyList) return;
  
  cachedDOM.historyList.innerHTML = strumHistory.map(item => {
    const modeLabel = item.mode === 'preset' ? '📖' : item.mode === 'custom' ? '✏️' : item.mode === 'free' ? '🎸' : '';
    const isComprehensiveMode = item.practiceMode === 'comprehensive';
    const practiceModeLabel = isComprehensiveMode ? '🎸综合' : '🥁节奏';
    const accuracyInfo = isComprehensiveMode && item.chordAccuracy ? ` | 准确率${item.chordAccuracy}%` : '';
    const transTimeInfo = isComprehensiveMode && item.avgTransitionTime ? ` | 转换${item.avgTransitionTime}ms` : '';
    return `<div class="history-item"><span class="time">${item.time} - ${item.rhythm} ${modeLabel} ${practiceModeLabel}</span><span class="score">${item.score}分 (${item.strums}次扫弦${accuracyInfo}${transTimeInfo})</span></div>`;
  }).join('');
}

function renderStatsChart() {
  const statsChartCanvas = cachedDOM.statsChart;
  const statsChartCtx = statsChartCanvas?.getContext('2d');
  
  if (!statsChartCtx || strumHistory.length === 0) {
    if (cachedDOM.avgScore) cachedDOM.avgScore.textContent = '--';
    if (cachedDOM.maxScore) cachedDOM.maxScore.textContent = '--';
    if (cachedDOM.practiceCount) cachedDOM.practiceCount.textContent = '0';
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
  
  if (cachedDOM.avgScore) cachedDOM.avgScore.textContent = avgScore;
  if (cachedDOM.maxScore) cachedDOM.maxScore.textContent = maxScore;
  if (cachedDOM.practiceCount) cachedDOM.practiceCount.textContent = strumHistory.length;
  
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
  // 缓存 DOM 元素
  cacheDOMElements();
  
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
    volumeMeterFill: cachedDOM.volumeMeterFill,
    onRhythmSelect: (index) => {
      AppState.setCurrentRhythm(index);
      const pattern = getActiveRhythm(index);
      if (cachedDOM.feedbackMessage && pattern) cachedDOM.feedbackMessage.textContent = `已选择：${pattern.name} - ${pattern.description}`;
    },
    onMetronomeToggle: (enabled) => {
      AppState.setMetronomeEnabled(enabled);
      setMetronomeEnabled(enabled);
      if (cachedDOM.feedbackMessage) cachedDOM.feedbackMessage.textContent = enabled ? `节拍器已开启 - ${AppState.getBPM()} BPM` : '节拍器已关闭';
      if (enabled && isListeningState()) startMetronome(getActiveRhythm, AppState.getCurrentRhythm());
      else stopMetronome();
    },
    onBPMChange: (bpm) => {
      AppState.setBPM(bpm);
      setCurrentBPM(bpm);
      if (AppState.getMetronomeEnabled() && isListeningState()) { stopMetronome(); startMetronome(getActiveRhythm, AppState.getCurrentRhythm()); }
    },
    onSensitivityChange: (level) => {
      AppState.setSensitivityLevel(level);
      setSensitivityLevel(level);
      if (cachedDOM.feedbackMessage && !isListeningState()) cachedDOM.feedbackMessage.textContent = `灵敏度：${level} - 开始练习后生效`;
    },
    onStart: () => startListening(),
    onStop: () => stopListening()
  });
  
  // 初始化模式切换
  const modeTuner = document.getElementById('modeTuner');
  const modeRhythm = document.getElementById('practiceModeRhythm');
  const modeComprehensive = document.getElementById('practiceModeComprehensive');
  const modeBtns = [modeTuner, modeRhythm, modeComprehensive];
  
  // 初始化时所有按钮都不高亮，等待用户点击
  modeBtns.forEach(btn => {
    if (!btn) return;
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
  });
  
  modeBtns.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', async () => {
      modeBtns.forEach(b => {
        if (b) {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        }
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      
      const tunerPanel = document.getElementById('tunerPanel');
      const chordModePanel = document.getElementById('chordModePanel');
      const chordDisplayPanel = document.getElementById('chordDisplayPanel');
      const practicePanel = document.getElementById('practicePanel');
      const scorePanel = document.getElementById('scorePanel');
      const practiceModeDesc = document.getElementById('practiceModeDescription');
      
      if (btn.id === 'modeTuner') {
        setFeedbackMessage('正在停止练习...');
        updateStatus('busy', '正在停止练习...');
        AppState.setCurrentMode('tuner');
        AppState.setPracticeMode('tuner');
        // 显示调音器面板
        tunerPanel.style.display = 'block';
        // 隐藏其他面板
        chordModePanel.style.display = 'none';
        chordDisplayPanel.style.display = 'none';
        practicePanel.style.display = 'none';
        scorePanel.style.display = 'none';
        practiceModeDesc.textContent = '💡 调音器模式：6 弦音准检测，±5 音分精度';
        // 重置调音器状态
        resetTunerState();
        resetTunerUI();
        // 预加载吉他音源（首次进入调音器模式时）
        if (!window.guitarSoundfont) {
          loadGuitarSoundfont();
        }
        // 停止练习模式监听
        stopPracticeSession();
        if (isTunerListening) {
          stopTunerListening();
        }
        // 启动调音器监听（用户点击后主动触发，符合浏览器安全策略）
        if (cachedDOM.tunerStringName) cachedDOM.tunerStringName.textContent = '检测中...';
        const tunerReady = await startTunerListening();
        if (tunerReady) {
          setFeedbackMessage('调音器已就绪');
        }
        // 初始化琴弦按钮点击事件（确保每次进入调音器模式都能点击）
        initTunerUI(async (stringIndex) => {
          try {
            let audioCtx = getAudioContext();
            if (!audioCtx) {
              await initAudioEngine();
              audioCtx = getAudioContext();
            }
            if (audioCtx && audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }
            if (audioCtx) {
              await playReferenceTone(audioCtx, stringIndex, 2);
            }
          } catch (err) {
            console.error('[Renderer] 播放标准音失败:', err);
          }
        });
      } else if (btn.id === 'practiceModeRhythm') {
        AppState.setCurrentMode('rhythm');
        AppState.setPracticeMode('rhythm');
        setFeedbackMessage('已切换到纯节奏训练');
        // 显示练习面板
        tunerPanel.style.display = 'none';
        chordModePanel.style.display = 'none';
        chordDisplayPanel.style.display = 'none';
        practicePanel.style.display = 'block';
        scorePanel.style.display = 'block';
        practiceModeDesc.textContent = '💡 纯节奏模式：专注节奏稳定度，任意和弦均可练习';
        // 停止调音器监听
        stopTunerListening();
        setPracticeMode('rhythm');
      } else if (btn.id === 'practiceModeComprehensive') {
        AppState.setCurrentMode('comprehensive');
        AppState.setPracticeMode('comprehensive');
        setFeedbackMessage('已切换到和弦 + 节奏综合训练');
        // 显示和弦训练面板
        tunerPanel.style.display = 'none';
        chordModePanel.style.display = 'block';
        chordDisplayPanel.style.display = 'block';
        practicePanel.style.display = 'block';
        scorePanel.style.display = 'block';
        practiceModeDesc.textContent = '💡 综合模式：需要正确和弦转换，同时评估节奏与和弦准确度';
        // 停止调音器监听
        stopTunerListening();
        setPracticeMode('comprehensive');
      }
    });
  });
  
  // 初始化调音器 UI（参考音播放）
  initTunerUI(async (stringIndex) => {
    try {
      let audioCtx = getAudioContext();
      if (!audioCtx) {
        await initAudioEngine();
        audioCtx = getAudioContext();
      }
      
      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      
      if (audioCtx) {
        await playReferenceTone(audioCtx, stringIndex, 2);
      }
    } catch (err) {
      console.error('[Renderer] 播放标准音失败:', err);
    }
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
    chordTrainingPanel: document.getElementById('chordModePanel'),
    chordDisplayPanel: document.getElementById('chordDisplayPanel'),
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
  
  // 加载吉他音源（用于试听演示）
  loadGuitarSoundfont();
  
  // 加载历史
  strumHistory = loadHistoryFromStorage();
  renderHistory();
  renderStatsChart();
  
  // 加载并恢复用户设置
  const savedSettings = loadUserSettings(getRhythmPatterns(), DEBUG);
  if (savedSettings.bpm !== null) {
    AppState.setBPM(savedSettings.bpm);
    setCurrentBPM(savedSettings.bpm);
    setBPMValue(savedSettings.bpm);
  }
  if (savedSettings.metronomeEnabled !== null) {
    AppState.setMetronomeEnabled(savedSettings.metronomeEnabled);
    setMetronomeEnabled(savedSettings.metronomeEnabled);
    setMetronomeChecked(savedSettings.metronomeEnabled);
  }
  if (savedSettings.sensitivityLevel !== null) {
    AppState.setSensitivityLevel(savedSettings.sensitivityLevel);
    setSensitivityLevel(savedSettings.sensitivityLevel);
    setSensitivityValue(savedSettings.sensitivityLevel);
  }
  if (savedSettings.currentRhythm !== null) {
    AppState.setCurrentRhythm(savedSettings.currentRhythm);
    setCurrentRhythm(savedSettings.currentRhythm);
  }
  
  // 初始化面板显示状态（默认调音器模式）
  const tunerPanel = document.getElementById('tunerPanel');
  const chordModePanel = document.getElementById('chordModePanel');
  const chordDisplayPanel = document.getElementById('chordDisplayPanel');
  const practicePanel = document.getElementById('practicePanel');
  const scorePanel = document.getElementById('scorePanel');
  
  // 默认显示调音器面板，隐藏其他面板
  if (tunerPanel) tunerPanel.style.display = 'block';
  if (chordModePanel) chordModePanel.style.display = 'none';
  if (chordDisplayPanel) chordDisplayPanel.style.display = 'none';
  if (practicePanel) practicePanel.style.display = 'none';
  if (scorePanel) scorePanel.style.display = 'none';
  
  // 页面加载时显示调音器为就绪状态
  console.log('[Renderer] 调音器就绪，等待用户选择模式...');
  if (cachedDOM.tunerStringName) cachedDOM.tunerStringName.textContent = '就绪';
  
  // 立即更新状态为 ready
  updateStatus('ready');
  
  setupPracticeReport();
}

// ========== 窗口大小调整（带防抖） ==========
let resizeDebounceTimer = null;
window.addEventListener('resize', () => {
  if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = setTimeout(() => {
    const recorderCanvas = document.getElementById('recorderWaveform');
    const spectrumCanvas = document.getElementById('spectrumWaveform');
    const statsChartCanvas = document.getElementById('statsChart');
    
    if (recorderCanvas) { recorderCanvas.width = recorderCanvas.offsetWidth; recorderCanvas.height = recorderCanvas.offsetHeight; }
    if (spectrumCanvas) { spectrumCanvas.width = spectrumCanvas.offsetWidth; spectrumCanvas.height = spectrumCanvas.offsetHeight; }
    if (statsChartCanvas) { statsChartCanvas.width = statsChartCanvas.offsetWidth; statsChartCanvas.height = statsChartCanvas.offsetHeight; renderStatsChart(); }
  }, CANVAS_RESIZE_DEBOUNCE);
});

// ========== 启动 ==========
document.addEventListener('DOMContentLoaded', () => {
  try { init(); } catch (error) { if (DEBUG) console.error('[GuitarStrumTrainer] 初始化失败:', error); }
});

// ========== 全局错误边界处理 ==========
window.onerror = function(message, source, lineno, colno, error) {
  const errorMsg = `[全局错误] ${message}`;
  const location = source ? `${source}:${lineno}:${colno}` : '未知位置';
  console.error(errorMsg, '\n位置:', location, '\n堆栈:', error?.stack || '无堆栈信息');
  
  if (cachedDOM.feedbackMessage) {
    cachedDOM.feedbackMessage.textContent = '⚠️ 发生错误，请刷新页面重试';
  }
  
  if (cachedDOM.loadingOverlay) {
    cachedDOM.loadingOverlay.style.display = 'none';
  }
  
  return false;
};

window.onunhandledrejection = function(event) {
  const reason = event.reason;
  const errorMsg = reason instanceof Error ? reason.message : String(reason);
  const errorStack = reason instanceof Error ? reason.stack : '无堆栈信息';
  
  console.error('[未处理的Promise拒绝]', errorMsg, '\n堆栈:', errorStack);
  
  if (cachedDOM.feedbackMessage) {
    cachedDOM.feedbackMessage.textContent = '⚠️ 发生异步错误，请刷新页面重试';
  }
  
  if (cachedDOM.loadingOverlay) {
    cachedDOM.loadingOverlay.style.display = 'none';
  }
  
  event.preventDefault();
};

// ========== 页面卸载清理 ==========
function cleanupAllTimers() {
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId);
    autoSaveIntervalId = null;
  }
  if (initTunerTimeoutId) {
    clearTimeout(initTunerTimeoutId);
    initTunerTimeoutId = null;
  }
  if (resizeDebounceTimer) {
    clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = null;
  }
  if (tunerAnimationFrame) {
    cancelAnimationFrame(tunerAnimationFrame);
    tunerAnimationFrame = null;
  }
  if (getIsPlayingDemo()) stopDemo();
  stopMetronome();
  stopTunerListening();
  audioStopListening();
}

// 清理用户交互监听器（防止内存泄漏）
function cleanupUserInteractionListeners() {
  const userInteractionEvents = ['click', 'touchstart', 'keydown'];
  const handleUserInteraction = () => {};
  userInteractionEvents.forEach(event => {
    document.removeEventListener(event, handleUserInteraction);
  });
}

window.addEventListener('beforeunload', () => {
  cleanupUserInteractionListeners();
  cleanupAllTimers();
});
window.addEventListener('pagehide', () => {
  cleanupUserInteractionListeners();
  cleanupAllTimers();
});
