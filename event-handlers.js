// 吉他扫弦练习助手 - 事件处理模块
// 功能：按钮、选择器、节拍器、灵敏度等事件绑定

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

// 状态引用
let currentRhythm = 0;
let isListening = false;

// 演示播放相关
let lastDemoClickTime = 0;
let demoButtonsSetup = false;

// 回调函数
let onRhythmSelectCallback = null;
let onMetronomeToggleCallback = null;
let onBPMChangeCallback = null;
let onSensitivityChangeCallback = null;
let onStartCallback = null;
let onStopCallback = null;

// ========== 初始化 ==========
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
  
  onRhythmSelectCallback = options.onRhythmSelect || null;
  onMetronomeToggleCallback = options.onMetronomeToggle || null;
  onBPMChangeCallback = options.onBPMChange || null;
  onSensitivityChangeCallback = options.onSensitivityChange || null;
  onStartCallback = options.onStart || null;
  onStopCallback = options.onStop || null;
  
  setupButtons();
  setupRhythmSelector();
  setupMetronome();
  setupSensitivity();
  setupAddRhythmCard();
  setupMicTest();
  setupDemoButtons();
  setupChartToggle();
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
      options.forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      currentRhythm = index;
      if (onRhythmSelectCallback) {
        onRhythmSelectCallback(index);
      }
    });
  });
}

export function setCurrentRhythm(index) {
  currentRhythm = index;
  if (rhythmSelector) {
    const options = rhythmSelector.querySelectorAll('.rhythm-option');
    options.forEach((o, i) => o.classList.toggle('active', i === index));
  }
}

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

export function setBPMValue(bpm) {
  if (bpmValue) bpmValue.textContent = bpm;
  if (bpmSlider) bpmSlider.value = bpm;
}

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
    if (now - lastDemoClickTime < 100) return;
    lastDemoClickTime = now;
    
    if (btn.dataset.rhythm !== undefined) {
      const rhythmIndex = parseInt(btn.dataset.rhythm);
      if (window.stopDemo && window.getIsPlayingDemo()) {
        window.stopDemo();
      }
      if (window.playDemo) {
        window.playDemo(rhythmIndex, btn);
      }
      return;
    }
    
    if (btn.dataset.customIndex !== undefined) {
      const customIndex = parseInt(btn.dataset.customIndex);
      if (window.stopDemo && window.getIsPlayingDemo()) {
        window.stopDemo();
      }
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
      
      const volumeMeterFill = document.getElementById('volumeMeterFill');
      
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

// ========== 图表折叠 ==========
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

// ========== 状态更新 ==========
export function updateStatus(status) {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  if (statusIndicator) statusIndicator.className = 'status-indicator ' + status;
  if (statusText) statusText.textContent = status === 'ready' ? '准备就绪' : status === 'listening' ? '正在监听...' : '发生错误';
}

// ========== 导出演示相关 ==========
export function setLastDemoClickTime(time) {
  lastDemoClickTime = time;
}

export function getDemoButtonsSetup() {
  return demoButtonsSetup;
}
