// 吉他扫弦练习助手 - 事件处理模块
// 功能：按钮、选择器、节拍器、灵敏度等事件绑定

// 导入常量
import {
  DEMO_CLICK_DEBOUNCE,
  MIC_TEST_CHECK_COUNT,
  MIC_TEST_SIGNAL_THRESHOLD,
  MIC_TEST_RESET_DELAY,
  MIC_TEST_VOLUME_SCALE
} from './constants.js';

// ========== 全局引用 ==========
let btnStart = null;
let btnStop = null;
let rhythmSelector = null;
let metronomeToggle = null;
let bpmSlider = null;
let bpmValue = null;
let sensitivitySlider = null;
let sensitivityValueEl = null;
let btnAddRhythm = null;
let btnMicTest = null;
let volumeMeterFillRef = null;

// 状态引用
let currentRhythm = 0;
let isListening = false;

// 演示播放相关
let lastDemoClickTime = 0;
let demoButtonsSetup = false;

// 缓存的 DOM 元素
let chartToggleBtn = null;
let chartSection = null;
let statusIndicatorEl = null;
let statusTextEl = null;

// 回调函数
let onRhythmSelectCallback = null;
let onMetronomeToggleCallback = null;
let onBPMChangeCallback = null;
let onSensitivityChangeCallback = null;
let onStartCallback = null;
let onStopCallback = null;

// ========== 初始化 ==========
/**
 * 初始化事件处理器
 * @param {Object} options - 配置选项
 * @param {HTMLElement} options.btnStart - 开始按钮
 * @param {HTMLElement} options.btnStop - 停止按钮
 * @param {HTMLElement} options.rhythmSelector - 节奏型选择器
 * @param {HTMLElement} options.metronomeToggle - 节拍器开关
 * @param {HTMLElement} options.bpmSlider - BPM 滑块
 * @param {HTMLElement} options.bpmValue - BPM 值显示
 * @param {HTMLElement} options.sensitivitySlider - 灵敏度滑块
 * @param {HTMLElement} options.sensitivityValueEl - 灵敏度值显示
 * @param {HTMLElement} options.btnAddRhythm - 添加节奏型按钮
 * @param {HTMLElement} options.btnMicTest - 麦克风测试按钮
 * @param {HTMLElement} options.volumeMeterFill - 音量指示条
 * @param {Function} options.onRhythmSelect - 节奏型选择回调
 * @param {Function} options.onMetronomeToggle - 节拍器开关回调
 * @param {Function} options.onBPMChange - BPM 变化回调
 * @param {Function} options.onSensitivityChange - 灵敏度变化回调
 * @param {Function} options.onStart - 开始回调
 * @param {Function} options.onStop - 停止回调
 */
export function initEventHandlers(options = {}) {
  btnStart = options.btnStart || null;
  btnStop = options.btnStop || null;
  rhythmSelector = options.rhythmSelector || null;
  metronomeToggle = options.metronomeToggle || null;
  bpmSlider = options.bpmSlider || null;
  bpmValue = options.bpmValue || null;
  sensitivitySlider = options.sensitivitySlider || null;
  sensitivityValueEl = options.sensitivityValueEl || null;
  btnAddRhythm = options.btnAddRhythm || null;
  btnMicTest = options.btnMicTest || null;
  volumeMeterFillRef = options.volumeMeterFill || null;
  
  onRhythmSelectCallback = options.onRhythmSelect || null;
  onMetronomeToggleCallback = options.onMetronomeToggle || null;
  onBPMChangeCallback = options.onBPMChange || null;
  onSensitivityChangeCallback = options.onSensitivityChange || null;
  onStartCallback = options.onStart || null;
  onStopCallback = options.onStop || null;
  
  cacheEventHandlerElements();
  setupButtons();
  setupRhythmSelector();
  setupMetronome();
  setupSensitivity();
  setupAddRhythmCard();
  setupMicTest();
  setupDemoButtons();
  setupChartToggle();
}

function cacheEventHandlerElements() {
  chartToggleBtn = document.getElementById('chartToggleBtn');
  chartSection = document.getElementById('statsChartSection');
  statusIndicatorEl = document.getElementById('statusIndicator');
  statusTextEl = document.getElementById('statusText');
}

// ========== 开始/停止按钮 ==========
function setupButtons() {
  if (!btnStart || !btnStop) return;
  btnStart.addEventListener('click', () => {
    if (onStartCallback) onStartCallback();
  });
  btnStop.addEventListener('click', () => {
    if (onStopCallback) onStopCallback();
  });
}

/**
 * 更新监听状态显示
 * @param {boolean} listening - 是否正在监听
 */
export function updateListeningState(listening) {
  isListening = listening;
  if (btnStart && btnStop) {
    btnStart.style.display = listening ? 'none' : 'block';
    btnStop.style.display = listening ? 'block' : 'none';
  }
}

// ========== 节奏型选择器 ==========
function setupRhythmSelector() {
  if (!rhythmSelector) return;
  const options = rhythmSelector.querySelectorAll('.rhythm-option');
  options.forEach((option, index) => {
    option.addEventListener('click', (e) => {
      if (isListening || e.target.classList.contains('btn-demo')) return;
      selectRhythm(option, index);
    });
    
    // 键盘支持（Enter 或 Space 激活）
    option.addEventListener('keydown', (e) => {
      if (isListening || e.target.classList.contains('btn-demo')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectRhythm(option, index);
      }
    });
  });
}

function selectRhythm(option, index) {
  const options = rhythmSelector.querySelectorAll('.rhythm-option');
  options.forEach(o => {
    o.classList.remove('active');
    o.setAttribute('aria-pressed', 'false');
  });
  option.classList.add('active');
  option.setAttribute('aria-pressed', 'true');
  currentRhythm = index;
  if (onRhythmSelectCallback) {
    onRhythmSelectCallback(index);
  }
}

/**
 * 设置当前选中的节奏型
 * @param {number} index - 节奏型索引
 */
export function setCurrentRhythm(index) {
  currentRhythm = index;
  if (rhythmSelector) {
    const options = rhythmSelector.querySelectorAll('.rhythm-option');
    options.forEach((o, i) => o.classList.toggle('active', i === index));
  }
}

/**
 * 获取当前选中的节奏型索引
 * @returns {number} 节奏型索引
 */
export function getCurrentRhythm() {
  return currentRhythm;
}

// ========== 节拍器设置 ==========
function setupMetronome() {
  if (!metronomeToggle || !bpmSlider) return;
  
  metronomeToggle.addEventListener('change', (e) => {
    if (onMetronomeToggleCallback) {
      onMetronomeToggleCallback(e.target.checked);
    }
  });
  
  bpmSlider.addEventListener('input', (e) => {
    const newBPM = parseInt(e.target.value);
    if (bpmValue) bpmValue.textContent = newBPM;
    if (onBPMChangeCallback) {
      onBPMChangeCallback(newBPM);
    }
  });
}

/**
 * 设置 BPM 值显示
 * @param {number} bpm - BPM 值
 */
export function setBPMValue(bpm) {
  if (bpmValue) bpmValue.textContent = bpm;
  if (bpmSlider) bpmSlider.value = bpm;
}

/**
 * 设置节拍器开关状态
 * @param {boolean} checked - 是否选中
 */
export function setMetronomeChecked(checked) {
  if (metronomeToggle) metronomeToggle.checked = checked;
}

// ========== 演示按钮 ==========
function setupDemoButtons() {
  if (demoButtonsSetup) return;
  
  if (!rhythmSelector) return;
  
  rhythmSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-demo');
    if (!btn) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const now = Date.now();
    if (now - lastDemoClickTime < DEMO_CLICK_DEBOUNCE) return;
    lastDemoClickTime = now;
    
    if (btn.dataset.rhythm !== undefined) {
      const rhythmIndex = parseInt(btn.dataset.rhythm);
      
      // 如果点击的是正在播放的同一个按钮，只停止不播放
      if (window.getIsPlayingDemo() && window.currentPlayingDemoBtn === btn) {
        if (window.stopDemo) window.stopDemo();
        return;
      }
      
      // 否则先停止当前播放，再播放新的
      if (window.stopDemo) window.stopDemo();
      if (window.playDemo) {
        window.playDemo(rhythmIndex, btn);
      }
      return;
    }
    
    if (btn.dataset.customIndex !== undefined) {
      const customIndex = parseInt(btn.dataset.customIndex);
      
      // 如果点击的是正在播放的同一个按钮，只停止不播放
      if (window.getIsPlayingDemo() && window.currentPlayingDemoBtn === btn) {
        if (window.stopDemo) window.stopDemo();
        return;
      }
      
      // 否则先停止当前播放，再播放新的
      if (window.stopDemo) window.stopDemo();
      if (window.playCustomRhythmFromList) {
        window.playCustomRhythmFromList(customIndex, btn);
      }
      return;
    }
  });
  
  demoButtonsSetup = true;
}

// ========== 灵敏度设置 ==========
function setupSensitivity() {
  if (!sensitivitySlider) return;
  sensitivitySlider.addEventListener('input', (e) => {
    const level = parseInt(e.target.value);
    if (sensitivityValueEl) sensitivityValueEl.textContent = level;
    if (onSensitivityChangeCallback) {
      onSensitivityChangeCallback(level);
    }
  });
}

/**
 * 设置灵敏度值
 * @param {number} level - 灵敏度等级
 */
export function setSensitivityValue(level) {
  if (sensitivityValueEl) sensitivityValueEl.textContent = level;
  if (sensitivitySlider) sensitivitySlider.value = level;
}

// ========== 添加节奏型卡片 ==========
function setupAddRhythmCard() {
  if (!btnAddRhythm) return;
  btnAddRhythm.addEventListener('click', () => {
    if (window.openNewRhythmEditor) {
      window.openNewRhythmEditor();
    }
  });
}

// ========== 麦克风测试 ==========
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
        
        if (volumeMeterFillRef) volumeMeterFillRef.style.width = Math.min(100, (avg / MIC_TEST_VOLUME_SCALE) * 100) + '%';
        
        if (checkCount < MIC_TEST_CHECK_COUNT) { requestAnimationFrame(checkLevel); }
        else {
          stream.getTracks().forEach(t => t.stop());
          testCtx.close();
          
          if (maxLevel > MIC_TEST_SIGNAL_THRESHOLD) {
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
            if (volumeMeterFillRef) volumeMeterFillRef.style.width = '0%';
          }, MIC_TEST_RESET_DELAY);
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

// ========== 图表折叠 ==========
function setupChartToggle() {
  if (!chartToggleBtn || !chartSection) return;
  
  const collapsed = localStorage.getItem('guitarStrumChartCollapsed') === 'true';
  if (collapsed) { chartSection.classList.add('collapsed'); chartToggleBtn.textContent = '▶'; }
  
  chartToggleBtn.addEventListener('click', () => {
    chartSection.classList.toggle('collapsed');
    const isCollapsed = chartSection.classList.contains('collapsed');
    chartToggleBtn.textContent = isCollapsed ? '▶' : '▼';
    localStorage.setItem('guitarStrumChartCollapsed', isCollapsed);
  });
}

// ========== 状态更新 ==========
/**
 * 更新状态显示
 * @param {string} status - 状态 ('ready', 'listening', 'error')
 */
export function updateStatus(status) {
  if (statusIndicatorEl) statusIndicatorEl.className = 'status-indicator ' + status;
  if (statusTextEl) statusTextEl.textContent = status === 'ready' ? '准备就绪' : status === 'listening' ? '正在监听...' : '发生错误';
}

// ========== 导出演示相关 ==========
/**
 * 设置最后演示点击时间
 * @param {number} time - 时间戳
 */
export function setLastDemoClickTime(time) {
  lastDemoClickTime = time;
}

/**
 * 获取演示按钮是否已设置
 * @returns {boolean} 是否已设置
 */
export function getDemoButtonsSetup() {
  return demoButtonsSetup;
}
