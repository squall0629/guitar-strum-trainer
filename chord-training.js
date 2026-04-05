// 吉他扫弦练习助手 - 和弦训练模块
// 功能：和弦训练逻辑、和弦转换检测、和弦图绘制

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

let practiceMode = 'rhythm';
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
      
      const progression = window.guitarTrainer?.getProgression?.();
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
  
  setupPracticeMode();
  setupChordTraining();
}

// ========== 和弦检测器初始化 ==========
export function initChordDetector(audioContext, analyser) {
  if (audioContext && analyser && window.ChordDetector) {
    chordDetector = new window.ChordDetector(audioContext, analyser);
    transitionDetector = new TransitionDetector();
    return true;
  }
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
  if (!practiceModeRhythm || !practiceModeComprehensive) return;
  practiceModeRhythm.addEventListener('click', () => setPracticeMode('rhythm'));
  practiceModeComprehensive.addEventListener('click', () => setPracticeMode('comprehensive'));
  updatePracticeModeUI();
}

export function setPracticeMode(mode) {
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
  
  window.removeChordFromProgression = function(index) {
    if (currentProgression && index >= 0 && index < currentProgression.length) {
      currentProgression.splice(index, 1);
      renderSelectedChords();
      updateChordProgressionDisplay();
    }
  };
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

// ========== 和弦识别更新 ==========
export function updateChordRecognition(chordResult) {
  if (!chordResult || !chordDetector) return;
  
  if (recognizedChordEl) {
    recognizedChordEl.textContent = chordResult.chord;
    recognizedChordEl.style.color = chordResult.chord === expectedChord ? '#00ff00' : '#00d9ff';
  }
  if (chordConfidenceEl) chordConfidenceEl.textContent = `(${Math.round(chordResult.confidence * 100)}%)`;
  if (currentChordDisplayEl) currentChordDisplayEl.textContent = chordResult.chord;
  if (currentChordCanvas && chordResult.chord) drawChordDiagram(currentChordCanvas, chordResult.chord);
  
  if (expectedChord) {
    if (chordResult.chord === expectedChord) {
      showFeedback('✓ 和弦正确！', 'success');
      practiceChordCorrect++;
    } else {
      showFeedback(`⚠ 应该是 ${expectedChord}，检测到 ${chordResult.chord}`, 'warning');
    }
    practiceChordTotal++;
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
  if (!chordResult || !chordDetector) return;
  
  if (recognizedChordEl) {
    recognizedChordEl.textContent = chordResult.chord;
    recognizedChordEl.style.color = chordResult.chord === expectedChord ? '#00ff00' : '#00d9ff';
  }
  if (chordConfidenceEl) chordConfidenceEl.textContent = `(${Math.round(chordResult.confidence * 100)}%)`;
  if (currentChordDisplayEl) currentChordDisplayEl.textContent = chordResult.chord;
  if (currentChordCanvas && chordResult.chord) drawChordDiagram(currentChordCanvas, chordResult.chord);
  
  if (expectedChord) {
    if (chordResult.chord === expectedChord) {
      showFeedback('✓ 和弦正确！', 'success');
      if (transitionDetector) {
        transitionDetector.onChordDetected(chordResult.chord, expectedChord, Date.now());
      }
    } else {
      showFeedback(`⚠ 应该是 ${expectedChord}，检测到 ${chordResult.chord}`, 'warning');
    }
  }
}

function showFeedback(message, type = 'info') {
  const feedbackEl = document.getElementById('feedbackMessage');
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.style.color = type === 'success' ? '#00ff00' : type === 'warning' ? '#ffa502' : type === 'error' ? '#ff4444' : '#888';
  setTimeout(() => { if (feedbackEl.textContent === message) feedbackEl.textContent = ''; }, 3000);
}

// ========== 和弦图绘制 ==========
function drawChordDiagram(canvas, chordName) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const width = canvas.width || 120;
  const height = canvas.height || 150;
  
  ctx.clearRect(0, 0, width, height);
  
  if (!chordName || !window.ChordLibrary || !window.ChordLibrary.getChordFingering) {
    drawChordDiagramFallbackSVG(ctx, width, height, null);
    return;
  }
  
  const fingering = window.ChordLibrary.getChordFingering(chordName);
  if (!fingering) {
    drawChordDiagramFallbackSVG(ctx, width, height, chordName);
    return;
  }
  
  drawChordDiagramFallbackSVG(ctx, width, height, chordName, fingering);
}

function drawChordDiagramFallbackSVG(ctx, width, height, chordName, fingering = null) {
  const padding = 10;
  const diagramWidth = width - padding * 2;
  const diagramHeight = height - padding * 2 - 20;
  
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  
  if (!chordName) {
    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('和弦图', width / 2, height / 2);
    return;
  }
  
  ctx.fillStyle = '#333';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(chordName, width / 2, 18);
  
  const startX = padding + diagramWidth * 0.15;
  const endX = padding + diagramWidth * 0.85;
  const startY = padding + 25;
  const endY = startY + diagramHeight;
  
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  
  const stringSpacing = (endX - startX) / 5;
  const fretSpacing = (endY - startY) / 4;
  
  for (let i = 0; i <= 5; i++) {
    const x = startX + i * stringSpacing;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  
  for (let i = 0; i <= 4; i++) {
    const y = startY + i * fretSpacing;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
  
  const nutThickness = 3;
  ctx.lineWidth = nutThickness;
  ctx.beginPath();
  ctx.moveTo(startX, startY - nutThickness / 2);
  ctx.lineTo(endX, startY - nutThickness / 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  
  if (fingering && fingering.positions) {
    ctx.fillStyle = '#00d9ff';
    fingering.positions.forEach((pos, stringIndex) => {
      if (pos > 0) {
        const x = startX + stringIndex * stringSpacing;
        const y = startY + (pos - 0.5) * fretSpacing;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(pos), x, y);
        ctx.fillStyle = '#00d9ff';
      } else if (pos === 0) {
        const x = startX + stringIndex * stringSpacing;
        ctx.beginPath();
        ctx.arc(x, startY - 8, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  
  ctx.fillStyle = '#666';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  const strings = ['E', 'A', 'D', 'G', 'B', 'e'];
  strings.forEach((s, i) => {
    const x = startX + i * stringSpacing;
    ctx.fillText(s, x, endY + 12);
  });
}

// ========== 重置和弦训练 ==========
export function resetChordTraining() {
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
