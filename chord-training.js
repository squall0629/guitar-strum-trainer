// 吉他扫弦练习助手 - 和弦训练模块
// 功能：和弦训练逻辑、和弦转换检测、和弦图绘制

import { drawChordDiagram as drawChordDiagramSVG, drawChordDiagramFallbackSVG as drawChordDiagramFallbackSVGUI } from './ui-renderer.js';
import { isTonalAvailable, ChordDetector as ChordDetectorClass } from './chord-detector.js';
import { AppState } from './state-manager.js';
import { ChordLibrary } from './chord-library.js';
import EventBus, { Events } from './event-bus.js';

// ========== 全局状态 ==========
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
let selectedChordsDelegationReady = false;
let customChordSelectorDelegationReady = false;
let chordTrainingBindingsReady = false;
let practiceModeBindingsReady = false;
let stableRecognitionCandidate = null;
let stableRecognitionFrames = 0;
let stableRecognitionEmittedChord = null;
let lastConfirmedChord = null;
let lastConfirmedChordAt = 0;

const CHORD_STABLE_FRAME_COUNT = 6;
const CHORD_REPEAT_SUPPRESS_MS = 1200;

let practiceMode = 'tuner';  // 默认调音器模式，与 renderer.js 保持一致
let practiceStartTime = 0;
let practiceChordCorrect = 0;
let practiceChordTotal = 0;
let practiceTransitionTimes = [];

// DOM 元素引用
let currentChordDisplay = null;
let nextChordDisplay = null;
let currentChordCanvas = null;
let nextChordCanvas = null;
let recognizedChordEl = null;
let chordConfidenceEl = null;
let transitionTimeEl = null;
let progressionBar = null;
let progressionProgress = null;
let btnSaveProgression = null;
let btnClearProgression = null;
let chordTrainingPanel = null;
let chordDisplayPanel = null;
let practiceModeRhythm = null;
let practiceModeComprehensive = null;
let practiceModeDescription = null;
let modePreset = null;
let modeCustom = null;
let modeFree = null;
let presetSelector = null;
let progressionSelect = null;
let customChordSelector = null;
let selectedChordsDisplay = null;
let currentChordDisplayEl = null;

const cachedProgressionDetail = {
  progressionChords: null,
  progressionDesc: null,
  progressionDetail: null
};

function cacheProgressionDetailElements() {
  cachedProgressionDetail.progressionChords = document.getElementById('progressionChords');
  cachedProgressionDetail.progressionDesc = document.getElementById('progressionDesc');
  cachedProgressionDetail.progressionDetail = document.getElementById('progressionDetail');
}

// ========== TransitionDetector 类 ==========
export class TransitionDetector {
  constructor() {
    this.transitionCount = 0;
    this.transitionTimes = [];
    this.lastChangeTime = 0;
    this.expectedChord = null;
    this.detectedChord = null;
    this.changeDetected = false;
  }
  
  reset() {
    this.transitionCount = 0;
    this.transitionTimes = [];
    this.lastChangeTime = 0;
    this.expectedChord = null;
    this.detectedChord = null;
    this.changeDetected = false;
  }
  
  setExpectedChord(chord) {
    this.expectedChord = chord;
  }
  
  onChordDetected(chord, expectedChord, currentTime) {
    if (!this.expectedChord) {
      this.expectedChord = expectedChord;
      this.detectedChord = chord;
      this.lastChangeTime = currentTime;
      return;
    }
    
    if (chord !== this.detectedChord && chord === this.expectedChord) {
      if (this.lastChangeTime > 0) {
        const transitionTime = currentTime - this.lastChangeTime;
        this.transitionTimes.push(transitionTime);
        this.transitionCount++;
      }
      this.lastChangeTime = currentTime;
      this.detectedChord = chord;
      this.changeDetected = true;
      
      const progression = getCurrentProgression();
      if (progression && progression.length > 0) {
        const currentIndex = progression.indexOf(this.expectedChord);
        const nextIndex = (currentIndex + 1) % progression.length;
        this.expectedChord = progression[nextIndex];
      }
    }
  }
  
  getStats() {
    if (this.transitionTimes.length === 0) {
      return { transitionCount: 0, avgTransitionTime: 0, minTransitionTime: 0, maxTransitionTime: 0 };
    }
    const sum = this.transitionTimes.reduce((a, b) => a + b, 0);
    const avg = sum / this.transitionTimes.length;
    const min = Math.min(...this.transitionTimes);
    const max = Math.max(...this.transitionTimes);
    return { transitionCount: this.transitionCount, avgTransitionTime: avg, minTransitionTime: min, maxTransitionTime: max };
  }
}

// ========== 初始化 ==========
export function initChordTraining(options = {}) {
  currentChordDisplay = options.currentChordDisplay || null;
  nextChordDisplay = options.nextChordDisplay || null;
  currentChordCanvas = options.currentChordCanvas || null;
  nextChordCanvas = options.nextChordCanvas || null;
  recognizedChordEl = options.recognizedChordEl || null;
  chordConfidenceEl = options.chordConfidenceEl || null;
  transitionTimeEl = options.transitionTimeEl || null;
  progressionBar = options.progressionBar || null;
  progressionProgress = options.progressionProgress || null;
  btnSaveProgression = options.btnSaveProgression || null;
  btnClearProgression = options.btnClearProgression || null;
  chordTrainingPanel = options.chordTrainingPanel || null;
  chordDisplayPanel = options.chordDisplayPanel || null;
  practiceModeRhythm = options.practiceModeRhythm || null;
  practiceModeComprehensive = options.practiceModeComprehensive || null;
  practiceModeDescription = options.practiceModeDescription || null;
  modePreset = options.modePreset || null;
  modeCustom = options.modeCustom || null;
  modeFree = options.modeFree || null;
  presetSelector = options.presetSelector || null;
  progressionSelect = options.progressionSelect || null;
  customChordSelector = options.customChordSelector || null;
  selectedChordsDisplay = options.selectedChordsDisplay || null;
  currentChordDisplayEl = options.currentChordDisplayEl || null;
  
  cacheProgressionDetailElements();
  setupPracticeMode();
  setupChordTraining();
}

// ========== 和弦检测器初始化 ==========
export function initChordDetector(audioContext, analyser) {
  // 检查 Tonal.js 是否可用
  if (!isTonalAvailable()) {
    console.warn('[ChordTraining] Tonal.js 未加载，和弦识别功能不可用');
    return false;
  }
  if (audioContext && analyser && ChordDetectorClass) {
    chordDetector = new ChordDetectorClass(audioContext, analyser);
    transitionDetector = new TransitionDetector();
    console.log('[ChordTraining] 和弦检测器初始化成功');
    return true;
  }
  console.warn('[ChordTraining] 无法初始化和弦检测器：audioContext 或 analyser 缺失');
  return false;
}

export function getChordDetector() {
  return chordDetector;
}

export function getTransitionDetector() {
  return transitionDetector;
}

export function setChordRecognitionEnabled(enabled) {
  chordRecognitionEnabled = enabled;
}

export function isChordRecognitionEnabled() {
  return chordRecognitionEnabled;
}

// ========== 练习模式 ==========
function setupPracticeMode() {
  if (practiceModeBindingsReady) return;
  if (!practiceModeRhythm || !practiceModeComprehensive) return;
  practiceModeRhythm.addEventListener('click', () => setPracticeMode('rhythm'));
  practiceModeComprehensive.addEventListener('click', () => setPracticeMode('comprehensive'));
  practiceModeBindingsReady = true;
  updatePracticeModeUI();
}

export function setPracticeMode(mode) {
  practiceMode = mode;
  updatePracticeModeUI();
  if (practiceMode === 'rhythm') chordRecognitionEnabled = false;
}

function updatePracticeModeUI() {
  // 调音器模式下，不激活任何练习模式按钮
  const isRhythmMode = practiceMode === 'rhythm';
  const isComprehensiveMode = practiceMode === 'comprehensive';
  if (practiceModeRhythm) practiceModeRhythm.classList.toggle('active', isRhythmMode);
  if (practiceModeComprehensive) practiceModeComprehensive.classList.toggle('active', isComprehensiveMode);
  if (practiceModeDescription) {
    practiceModeDescription.textContent = practiceMode === 'rhythm' ? '💡 纯节奏模式：专注节奏稳定度，任意和弦均可练习' : '💡 综合模式：需要正确和弦转换，同时评估节奏与和弦准确度';
  }
  // 纯节奏模式隐藏和弦训练相关面板（用空字符串恢复 CSS 默认布局）
  const displayStyle = practiceMode === 'comprehensive' ? '' : 'none';
  if (chordTrainingPanel) chordTrainingPanel.style.display = displayStyle;
  if (chordDisplayPanel) chordDisplayPanel.style.display = displayStyle;
}

export function getPracticeMode() {
  return practiceMode;
}

export function setPracticeStartTime(time) {
  practiceStartTime = time;
}

export function getPracticeStartTime() {
  return practiceStartTime;
}

export function incrementPracticeChordCorrect() {
  practiceChordCorrect++;
}

export function incrementPracticeChordTotal() {
  practiceChordTotal++;
}

export function getPracticeChordStats() {
  return { correct: practiceChordCorrect, total: practiceChordTotal };
}

export function addPracticeTransitionTime(time) {
  practiceTransitionTimes.push(time);
}

export function getPracticeTransitionTimes() {
  return practiceTransitionTimes;
}

export function resetPracticeStats() {
  practiceStartTime = 0;
  practiceChordCorrect = 0;
  practiceChordTotal = 0;
  practiceTransitionTimes = [];
}

// ========== 和弦训练设置 ==========
function setupChordTraining() {
  if (chordTrainingBindingsReady) return;

  if (modePreset) modePreset.addEventListener('click', () => setTrainingMode('preset'));
  if (modeCustom) modeCustom.addEventListener('click', () => setTrainingMode('custom'));
  if (modeFree) modeFree.addEventListener('click', () => setTrainingMode('free'));
  
  if (progressionSelect) {
    progressionSelect.addEventListener('change', () => {
      const index = parseInt(progressionSelect.value);
      if (ChordLibrary.COMMON_PROGRESSIONS[index]) {
        currentProgression = ChordLibrary.COMMON_PROGRESSIONS[index].chords;
        updateChordProgressionDisplay();
        updateProgressionDetail(index);
        EventBus.emit(Events.PROGRESSION_UPDATE, { progression: currentProgression, index });
      }
    });
    currentProgression = ChordLibrary.COMMON_PROGRESSIONS[0]?.chords || [];
    updateProgressionDetail(0);
  }

  setupCustomChordSelectorDelegation();
  setupSelectedChordsDelegation();
  
  if (btnSaveProgression) btnSaveProgression.addEventListener('click', saveCustomProgression);
  if (btnClearProgression) btnClearProgression.addEventListener('click', () => { currentProgression = []; currentChordIndex = 0; renderSelectedChords(); updateChordProgressionDisplay(); });
  chordTrainingBindingsReady = true;
}

function setupCustomChordSelectorDelegation() {
  if (customChordSelectorDelegationReady || !customChordSelector) return;

  customChordSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.chord-select-btn');
    if (!btn) return;
    addChordToProgression(btn.dataset.chord);
  });

  customChordSelectorDelegationReady = true;
}

function setupSelectedChordsDelegation() {
  if (selectedChordsDelegationReady || !selectedChordsDisplay) return;

  selectedChordsDisplay.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-remove-chord');
    if (!btn) return;
    removeChordFromProgression(parseInt(btn.dataset.index));
  });

  selectedChordsDelegationReady = true;
}

export function getTrainingMode() {
  return currentTrainingMode;
}

export function setTrainingMode(mode) {
  currentTrainingMode = mode;
  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  if (presetSelector) presetSelector.style.display = mode === 'preset' ? 'block' : 'none';
  if (customChordSelector) customChordSelector.style.display = mode === 'custom' ? 'block' : 'none';
  
  if (mode === 'free') {
    currentProgression = [];
    updateChordProgressionDisplay();
  } else if (mode === 'preset' && ChordLibrary.COMMON_PROGRESSIONS[0]) {
    currentProgression = ChordLibrary.COMMON_PROGRESSIONS[0].chords;
    updateChordProgressionDisplay();
  }
}

function addChordToProgression(chordName) {
  if (!currentProgression) currentProgression = [];
  currentProgression.push(chordName);
  renderSelectedChords();
  updateChordProgressionDisplay();
}

export function removeChordFromProgression(index) {
  if (currentProgression && index >= 0 && index < currentProgression.length) {
    currentProgression.splice(index, 1);
    renderSelectedChords();
    updateChordProgressionDisplay();
  }
}

function renderSelectedChords() {
  if (!selectedChordsDisplay) return;
  if (currentProgression.length === 0) {
    selectedChordsDisplay.innerHTML = '<span class="selected-chords-empty">点击选择和弦</span>';
    return;
  }
  selectedChordsDisplay.innerHTML = currentProgression.map((chord, index) => `
    <span class="selected-chord-item chord-item" data-chord-index="${index}">
      ${chord}
      <button class="btn-remove-chord" data-index="${index}">×</button>
    </span>
  `).join('');
}

function saveCustomProgression() {
  if (currentProgression.length === 0) { alert('请先选择和弦！'); return; }
  const name = prompt('请输入进行名称:');
  if (!name) return;
  const saved = JSON.parse(localStorage.getItem('guitar-custom-progressions') || '[]');
  saved.push({ name, chords: [...currentProgression], createdAt: new Date().toISOString() });
  localStorage.setItem('guitar-custom-progressions', JSON.stringify(saved));
  alert(`"${name}" 已保存！`);
}

// ========== 和弦显示更新 ==========
export function updateChordProgressionDisplay() {
  if (!currentChordDisplay || !nextChordDisplay) return;
  if (currentProgression.length === 0 || currentTrainingMode === 'free') {
    currentChordDisplay.textContent = '--';
    nextChordDisplay.textContent = '--';
    if (currentChordCanvas) drawChordDiagramSVG(currentChordCanvas, null);
    if (nextChordCanvas) drawChordDiagramSVG(nextChordCanvas, null);
    return;
  }
  
  currentChordIndex = currentChordIndex % currentProgression.length;
  expectedChord = currentProgression[currentChordIndex];
  nextChord = currentProgression[(currentChordIndex + 1) % currentProgression.length];
  
  currentChordDisplay.textContent = expectedChord;
  nextChordDisplay.textContent = nextChord;
  
  if (currentChordCanvas) drawChordDiagramSVG(currentChordCanvas, expectedChord);
  if (nextChordCanvas) drawChordDiagramSVG(nextChordCanvas, nextChord);
  
  if (progressionBar && progressionProgress) {
    const progress = ((currentChordIndex) / currentProgression.length) * 100;
    progressionBar.style.width = `${progress}%`;
    progressionProgress.textContent = `${currentChordIndex + 1}/${currentProgression.length}`;
  }
}

function updateProgressionDetail(index) {
  if (!cachedProgressionDetail.progressionChords || !cachedProgressionDetail.progressionDesc) return;
  
  const progression = ChordLibrary.COMMON_PROGRESSIONS[index];
  if (progression) {
    cachedProgressionDetail.progressionChords.textContent = progression.chords.join(' → ');
    cachedProgressionDetail.progressionDesc.textContent = progression.desc;
    if (cachedProgressionDetail.progressionDetail) cachedProgressionDetail.progressionDetail.style.display = 'block';
  } else {
    cachedProgressionDetail.progressionChords.textContent = '点击选择和弦或选择预设进行';
    cachedProgressionDetail.progressionDesc.textContent = '';
    if (cachedProgressionDetail.progressionDetail) cachedProgressionDetail.progressionDetail.style.display = 'none';
  }
}

// ========== 和弦识别更新 ==========
export function updateChordRecognition(chordResult) {
  const stableResult = getStableChordResult(chordResult);
  if (!stableResult || !chordDetector) return;
  
  if (recognizedChordEl) {
    recognizedChordEl.textContent = stableResult.chord;
    recognizedChordEl.style.color = stableResult.chord === expectedChord ? '#00ff00' : '#00d9ff';
  }
  if (chordConfidenceEl) chordConfidenceEl.textContent = `(${Math.round(stableResult.confidence * 100)}%)`;
  if (currentChordDisplayEl) currentChordDisplayEl.textContent = stableResult.chord;
  if (currentChordCanvas && stableResult.chord) drawChordDiagramSVG(currentChordCanvas, stableResult.chord);
  
  if (expectedChord) {
    if (stableResult.chord === expectedChord) {
      showFeedback('✓ 和弦正确！', 'success');
      if (shouldCountConfirmedChord(stableResult.chord)) {
        practiceChordCorrect++;
        practiceChordTotal++;
      }
    } else {
      showFeedback(`⚠ 应该是 ${expectedChord}，检测到 ${stableResult.chord}`, 'warning');
      if (shouldCountConfirmedChord(stableResult.chord)) {
        practiceChordTotal++;
      }
    }
  }
}

// ========== 转换时间更新 ==========
export function updateTransitionTime() {
  if (!transitionDetector || !transitionTimeEl) return;
  const stats = transitionDetector.getStats();
  if (stats.avgTransitionTime > 0) {
    transitionTimeEl.textContent = Math.round(stats.avgTransitionTime) + 'ms';
  }
}

// ========== 和弦显示更新（包含反馈） ==========
export function updateChordDisplay(chordResult) {
  const stableResult = getStableChordResult(chordResult);
  if (!stableResult || !chordDetector) return;
  
  if (recognizedChordEl) {
    recognizedChordEl.textContent = stableResult.chord;
    recognizedChordEl.style.color = stableResult.chord === expectedChord ? '#00ff00' : '#00d9ff';
  }
  if (chordConfidenceEl) chordConfidenceEl.textContent = `(${Math.round(stableResult.confidence * 100)}%)`;
  if (currentChordDisplayEl) currentChordDisplayEl.textContent = stableResult.chord;
  if (currentChordCanvas && stableResult.chord) drawChordDiagramSVG(currentChordCanvas, stableResult.chord);
  
  if (expectedChord) {
    if (stableResult.chord === expectedChord) {
      showFeedback('✓ 和弦正确！', 'success');
      if (transitionDetector) {
        transitionDetector.onChordDetected(stableResult.chord, expectedChord, Date.now());
      }
    } else {
      showFeedback(`⚠ 应该是 ${expectedChord}，检测到 ${stableResult.chord}`, 'warning');
    }
  }
}

function getStableChordResult(chordResult) {
  if (!chordResult?.chord) return null;

  if (stableRecognitionCandidate === chordResult.chord) {
    stableRecognitionFrames++;
  } else {
    stableRecognitionCandidate = chordResult.chord;
    stableRecognitionFrames = 1;
    if (stableRecognitionEmittedChord !== chordResult.chord) {
      stableRecognitionEmittedChord = null;
    }
  }

  if (stableRecognitionFrames < CHORD_STABLE_FRAME_COUNT) {
    return null;
  }

  if (stableRecognitionEmittedChord === chordResult.chord) {
    return null;
  }

  lastRecognizedChord = chordResult.chord;
  stableRecognitionEmittedChord = chordResult.chord;
  return chordResult;
}

function shouldCountConfirmedChord(chordName) {
  const now = Date.now();
  if (lastConfirmedChord === chordName && now - lastConfirmedChordAt < CHORD_REPEAT_SUPPRESS_MS) {
    return false;
  }

  lastConfirmedChord = chordName;
  lastConfirmedChordAt = now;
  return true;
}

function showFeedback(message, type = 'info') {
  const feedbackEl = document.getElementById('feedbackMessage');
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.style.color = type === 'success' ? '#00ff00' : type === 'warning' ? '#ffa502' : type === 'error' ? '#ff4444' : '#888';
  setTimeout(() => { if (feedbackEl.textContent === message) feedbackEl.textContent = ''; }, 3000);
}

// ========== 和弦图绘制（使用 ui-renderer.js 的 SVG 版本） ==========
// drawChordDiagram 和 drawChordDiagramFallbackSVG 已从 ui-renderer.js 导入
// 直接使用导入的函数，支持 div 容器元素

// ========== 重置和弦训练 ==========
export function resetChordTraining() {
  chordRecognitionEnabled = false;
  currentTrainingMode = 'preset';
  currentProgression = [];
  currentChordIndex = 0;
  expectedChord = null;
  nextChord = null;
  lastRecognizedChord = null;
  stableRecognitionCandidate = null;
  stableRecognitionFrames = 0;
  stableRecognitionEmittedChord = null;
  lastConfirmedChord = null;
  lastConfirmedChordAt = 0;
  if (transitionDetector) transitionDetector.reset();
  
  if (recognizedChordEl) recognizedChordEl.textContent = '--';
  if (currentChordDisplay) currentChordDisplay.textContent = '--';
  if (nextChordDisplay) nextChordDisplay.textContent = '--';
}

export function getCurrentProgression() {
  return currentProgression;
}

export function setCurrentProgression(progression) {
  currentProgression = progression;
}

export function getCurrentChordIndex() {
  return currentChordIndex;
}

export function setCurrentChordIndex(index) {
  currentChordIndex = index;
}

export function getExpectedChord() {
  return expectedChord;
}

export function getNextChord() {
  return nextChord;
}
