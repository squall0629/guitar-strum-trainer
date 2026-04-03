// 吉他扫弦练习助手 - 核心音频分析引擎

// ========== 真实吉他音源 (FluidR3 GM - Acoustic Guitar Steel String) ==========
// 使用 soundfont-player 加载 FluidR3 GM 音源，CC0 授权免费商用
let guitarSoundfont = null;
let guitarInstrument = null;
let soundfontLoading = false;
let soundfontLoaded = false;

// 节奏型定义 (单位：毫秒，基于 120BPM)
const RHYTHM_PATTERNS = [
  {
    name: '前八后十六',
    pattern: [500, 250, 250],
    beats: 4,
    description: '↓ ↓↑',
    demo: ['D', 'D', 'U']
  },
  {
    name: '前十六后八',
    pattern: [250, 250, 500],
    beats: 4,
    description: '↓↑ ↓',
    demo: ['D', 'U', 'D']
  },
  {
    name: '民谣常用',
    pattern: [500, 250, 250, 250, 250, 500],
    beats: 4,
    description: '↓ ↓↑↓↑ ↓',
    demo: ['D', 'D', 'U', 'D', 'U', 'D']
  },
  {
    name: '摇滚八分',
    pattern: [250, 250, 250, 250, 250, 250, 250, 250],
    beats: 4,
    description: '↓↑ ↓↑ ↓↑ ↓↑',
    demo: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U']
  },
  {
    name: '华尔兹',
    pattern: [667, 333, 333, 667, 333, 333],
    beats: 3,
    description: '↓ ↑↑ ↓ ↑↑',
    demo: ['D', 'U', 'U', 'D', 'U', 'U']
  }
];

// 节拍器相关
let metronomeEnabled = false;
let currentBPM = 70; // 默认 70 BPM，适合练习
let metronomeInterval = null;
let metronomeBeat = 0;
let audioContextForMetronome = null;

// 演示播放相关
let isPlayingDemo = false;
let demoTimeout = null;
let demoLoopCount = 0;
let currentDemoRhythmIndex = -1;

// 设置灵敏度
let sensitivityLevel = 50; // 1-100
let strumThreshold = 0.15; // 根据灵敏度动态计算

// 全局函数：更新阈值计算
function updateThreshold() {
  // 灵敏度 1-100 映射到阈值 0.30-0.05
  // 灵敏度越高，阈值越低（更容易触发）
  strumThreshold = 0.30 - (sensitivityLevel - 1) * (0.25 / 99);
  strumThreshold = Math.max(0.05, Math.min(0.30, strumThreshold));
  
  const thresholdDisplay = document.getElementById('thresholdDisplay');
  if (thresholdDisplay) {
    thresholdDisplay.textContent = strumThreshold.toFixed(2);
  }
}

// 全局状态
let audioContext = null;
let analyser = null;
let microphone = null;
let isListening = false;
let currentRhythm = 0;
let detectedStrums = [];
let lastStrumTime = 0;
let expectedStrumIndex = 0;
let strumHistory = [];

// DOM 元素（在 init 中初始化）
let btnStart, btnStop, statusIndicator, statusText, rhythmSelector;
let rhythmScoreEl, toneScoreEl, dynamicsScoreEl, totalScoreEl;
let rhythmRingEl, toneRingEl, dynamicsRingEl, totalRingEl;
let feedbackMessage, historyList, canvas, canvasCtx;
let metronomeToggle, bpmSlider, bpmValue, demoButtons, metronomeDot;
let sensitivitySlider, sensitivityValueEl, thresholdDisplay, volumeMeterFill;
let statsChartCanvas, statsChartCtx, avgScoreEl, maxScoreEl, practiceCountEl;
let btnAddRhythm, btnMicTest;

// 版本号
const APP_VERSION = 'v1.8';

// 初始化
function init() {
  console.log(`[GuitarStrumTrainer] ${APP_VERSION} 开始初始化...`);
  
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
  canvas = document.getElementById('waveform');
  canvasCtx = canvas ? canvas.getContext('2d') : null;
  
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
  
  console.log('[GuitarStrumTrainer] DOM 元素获取完成', {
    btnStart: !!btnStart,
    btnStop: !!btnStop,
    demoButtons: demoButtons?.length || 0
  });
  
  setupRhythmSelector();
  setupButtons();
  setupCanvas();
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
  
  console.log('[GuitarStrumTrainer] 初始化完成');
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
      
      const pattern = RHYTHM_PATTERNS[index];
      feedbackMessage.textContent = `已选择：${pattern.name} - ${pattern.description}`;
    });
  });
  
  // 监听自定义节奏型变化
  const originalRender = renderCustomRhythmsList;
  renderCustomRhythmsList = function() {
    originalRender.apply(this, arguments);
    // 重新绑定选择事件
    const customItems = document.querySelectorAll('#customRhythmsList > div');
    customItems.forEach((item, index) => {
      const selectArea = item.querySelector('div[onclick*="selectCustomRhythm"]');
      if (selectArea) {
        selectArea.addEventListener('click', () => selectCustomRhythm(index));
      }
    });
  };
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

// 设置演示按钮
function setupDemoButtons() {
  demoButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rhythmIndex = parseInt(btn.dataset.rhythm);
      
      if (isPlayingDemo) {
        stopDemo();
      } else {
        playDemo(rhythmIndex, btn);
      }
    });
  });
  
  // 同时绑定自定义节奏型的演示按钮
  const customDemoBtns = document.querySelectorAll('.btn-demo[data-custom]');
  customDemoBtns.forEach(btn => {
    // 移除旧的事件监听器（避免重复绑定）
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const customIndex = parseInt(newBtn.dataset.custom);
      
      if (isPlayingDemo) {
        stopDemo();
      } else {
        playCustomRhythm(customIndex);
      }
    });
  });
}

// 播放节拍器声音 - 保留原有简洁的电子滴答声
// 与扫弦音色区分开，使用纯 sine 波确保节拍器声音清晰可辨
function playMetronomeSound(frequency = 1000, duration = 0.05) {
  if (!audioContextForMetronome) {
    audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
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
    const isAccent = metronomeBeat % RHYTHM_PATTERNS[currentRhythm].beats === 0;
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

// 播放扫弦演示声音 - 改进版：更真实的吉他音色
// 改进点：
// 1. 使用基频 + 泛音叠加模拟吉他和弦
// 2. 添加 ADSR 包络 (Attack, Decay, Sustain, Release) 让声音更自然
// 3. 使用 triangle 和 sawtooth 波形混合代替单一 sine
// 4. 添加轻微频率抖动 (±0.5%) 模拟真实吉他弦的不完美
// 5. 下扫 (D) 和上扫 (U) 使用不同的音色处理
function playStrumSound(direction, duration = 0.15) {
  if (!audioContextForMetronome) {
    audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  const ctx = audioContextForMetronome;
  const now = ctx.currentTime;
  
  // 基础和弦频率 (E 大调和弦: E3, B3, E4, G#4, B4, E5)
  const baseChord = [164.81, 246.94, 329.63, 415.30, 493.88, 659.25];
  
  // 根据扫弦方向调整延迟和音色
  const isDownStrum = direction === 'D';
  const strumDelay = isDownStrum ? 0.008 : 0.012; // 下扫更快，上扫稍慢
  const brightness = isDownStrum ? 1.0 : 0.7; // 下扫更明亮，上扫柔和
  
  // ADSR 包络参数
  const attackTime = 0.005;    // 5ms 快速起音
  const decayTime = 0.08;      // 80ms 衰减
  const sustainLevel = 0.3;    // 延 sustain 电平 30%
  const releaseTime = duration * 0.6; // 释放时间
  
  // 为每根弦创建声音
  baseChord.forEach((baseFreq, stringIndex) => {
    // 频率抖动: ±0.5% 模拟真实吉他
    const jitter = 1 + (Math.random() - 0.5) * 0.01;
    const freq = baseFreq * jitter;
    
    // 每根弦的起始时间错开，模拟扫弦效果
    const startTime = now + (stringIndex * strumDelay);
    
    // --- 基频振荡器 (triangle 波形) ---
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.value = freq;
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // --- 二次泛音 (sawtooth 波形，音量较低) ---
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.value = freq * 2.0; // 二次谐波
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    // --- 三次泛音 (triangle 波形，更弱) ---
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.value = freq * 3.0; // 三次谐波
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    
    // 音量分配: 基频最强，泛音递减
    const baseVolume = 0.12 * brightness;
    const harmonic2Volume = 0.04 * brightness;
    const harmonic3Volume = 0.02 * brightness;
    
    // 应用 ADSR 包络到基频
    const peakTime = startTime + attackTime;
    const sustainTime = startTime + attackTime + decayTime;
    const endTime = startTime + duration;
    
    gain1.gain.setValueAtTime(0.001, startTime);
    gain1.gain.linearRampToValueAtTime(baseVolume, peakTime);
    gain1.gain.exponentialRampToValueAtTime(baseVolume * sustainLevel, sustainTime);
    gain1.gain.setValueAtTime(baseVolume * sustainLevel, endTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, endTime + releaseTime);
    
    // 泛音衰减更快
    gain2.gain.setValueAtTime(0.001, startTime);
    gain2.gain.linearRampToValueAtTime(harmonic2Volume, peakTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, sustainTime + releaseTime * 0.5);
    
    gain3.gain.setValueAtTime(0.001, startTime);
    gain3.gain.linearRampToValueAtTime(harmonic3Volume, peakTime);
    gain3.gain.exponentialRampToValueAtTime(0.001, sustainTime + releaseTime * 0.3);
    
    // 启动和停止所有振荡器
    osc1.start(startTime);
    osc1.stop(endTime + releaseTime + 0.01);
    
    osc2.start(startTime);
    osc2.stop(sustainTime + releaseTime * 0.5 + 0.01);
    
    osc3.start(startTime);
    osc3.stop(sustainTime + releaseTime * 0.3 + 0.01);
  });
}

// 播放节奏型演示 - 循环播放版本
function playDemo(rhythmIndex, btnElement) {
  isPlayingDemo = true;
  demoLoopCount = 0;
  currentDemoRhythmIndex = rhythmIndex;
  
  // 安全地更新按钮状态（兼容虚拟按钮对象）
  if (btnElement && btnElement.classList) {
    btnElement.classList.add('playing');
  }
  if (btnElement && btnElement.textContent !== undefined) {
    btnElement.textContent = '⏹ 停止演示';
  }
  
  const pattern = RHYTHM_PATTERNS[rhythmIndex];
  if (!pattern) {
    console.error('[GuitarStrumTrainer] 节奏型未找到:', rhythmIndex);
    return;
  }
  let noteIndex = 0;
  
  function playNextNote() {
    if (!isPlayingDemo) return;
    
    // 检测一轮结束，开始新一轮
    if (noteIndex > 0 && noteIndex % pattern.pattern.length === 0) {
      demoLoopCount++;
      feedbackMessage.textContent = `演示播放中 - 第 ${demoLoopCount + 1} 轮`;
    }
    
    const direction = pattern.demo[noteIndex % pattern.demo.length];
    
    // 如果是自定义节奏型，传递力度参数
    if (pattern.isCustom && pattern.notes && pattern.notes[noteIndex % pattern.notes.length]) {
      const noteData = pattern.notes[noteIndex % pattern.notes.length];
      playStrumSound(direction, 0.15, [noteData.velocity, noteData.velocity, noteData.velocity, noteData.velocity, noteData.velocity, noteData.velocity]);
    } else {
      playStrumSound(direction);
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
    
    noteIndex++;
    
    demoTimeout = setTimeout(playNextNote, intervalMs);
  }
  
  feedbackMessage.textContent = `演示播放中 - 第 1 轮`;
  playNextNote();
}

// 停止演示
function stopDemo() {
  isPlayingDemo = false;
  if (demoTimeout) clearTimeout(demoTimeout);
  if (window.customRhythmCleanup) {
    clearTimeout(window.customRhythmCleanup);
    window.customRhythmCleanup = null;
  }
  demoLoopCount = 0;
  currentDemoRhythmIndex = -1;
  
  // 重置所有演示按钮（包括自定义节奏型按钮）
  demoButtons.forEach(btn => {
    if (btn && btn.classList) {
      btn.classList.remove('playing');
    }
    if (btn && btn.textContent !== undefined) {
      btn.textContent = '🔊 试听演示';
    }
  });
  
  // 重置自定义节奏型按钮
  const customPlayBtns = document.querySelectorAll('#customRhythmsList button[onclick*="playCustomRhythm"]');
  customPlayBtns.forEach(btn => {
    if (btn.classList.contains('playing')) {
      btn.classList.remove('playing');
      btn.textContent = '🔊 试听';
    }
  });
  
  playingCustomBtn = null;
  
  // 清理临时节奏型
  if (RHYTHM_PATTERNS.length > 5) {
    RHYTHM_PATTERNS.pop();
  }
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

// ========== 真实吉他音源函数 ==========

// 加载吉他音源 (FluidR3 GM - Acoustic Guitar Steel String)
async function loadGuitarSoundfont() {
  if (soundfontLoading || soundfontLoaded) return;
  
  soundfontLoading = true;
  console.log('[GuitarStrumTrainer] 开始加载吉他音源 (FluidR3 GM - 钢弦吉他)...');
  
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
    console.log('[GuitarStrumTrainer] ✓ 吉他音源加载完成 (FluidR3_GM)');
    
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
function playStrumSound(direction, duration = 0.15, noteVelocities = null) {
  if (!guitarSoundfont) {
    // 如果音源未加载，使用备选合成音色
    playStrumSoundSynth(direction, duration);
    return;
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
  
  const now = guitarSoundfont.context.currentTime;
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

// 备选合成音色 (当音源加载失败时使用)
function playStrumSoundSynth(direction, duration = 0.15) {
  if (!audioContextForMetronome) {
    audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
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
  
  baseChord.forEach((baseFreq, stringIndex) => {
    const jitter = 1 + (Math.random() - 0.5) * 0.01;
    const freq = baseFreq * jitter;
    const startTime = now + (stringIndex * strumDelay);
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.value = freq;
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.value = freq * 2.0;
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    const baseVolume = 0.12 * brightness;
    const harmonic2Volume = 0.04 * brightness;
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
    console.log('[GuitarStrumTrainer] 开始练习按钮被点击');
    startListening();
  });
  
  btnStop.addEventListener('click', () => {
    console.log('[GuitarStrumTrainer] 停止按钮被点击');
    stopListening();
  });
  
  console.log('[GuitarStrumTrainer] 按钮事件绑定成功');
}

// 设置画布
function setupCanvas() {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}

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
  try {
    // 检查浏览器支持
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('浏览器不支持麦克风访问');
    }
    
    // 检查是否是 HTTPS 或 localhost
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      throw new Error('麦克风访问需要 HTTPS 连接');
    }
    
    // 请求麦克风权限
    console.log('[GuitarStrumTrainer] 请求麦克风权限...');
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0
      } 
    });
    
    console.log('[GuitarStrumTrainer] 麦克风权限已获取');
    
    // 创建音频上下文
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    
    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    
    isListening = true;
    detectedStrums = [];
    lastStrumTime = 0;
    expectedStrumIndex = 0;
    
    btnStart.style.display = 'none';
    btnStop.style.display = 'block';
    updateStatus('listening');
    
    // 如果开启了节拍器，启动节拍器
    if (metronomeEnabled) {
      startMetronome();
      feedbackMessage.textContent = `🎯 开始练习：${RHYTHM_PATTERNS[currentRhythm].name} (节拍器：${currentBPM} BPM)`;
    } else {
      feedbackMessage.textContent = `🎯 开始练习：${RHYTHM_PATTERNS[currentRhythm].name}`;
    }
    
    // 开始分析循环
    analyzeAudio();
    
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
  
  // 停止节拍器
  stopMetronome();
  
  // 停止演示
  if (isPlayingDemo) {
    stopDemo();
  }
  
  if (microphone) {
    microphone.disconnect();
  }
  if (audioContext) {
    audioContext.close();
  }
  
  btnStart.style.display = 'block';
  btnStop.style.display = 'none';
  updateStatus('ready');
  
  // 保存历史记录
  if (detectedStrums.length > 0) {
    saveHistory();
  }
  
  feedbackMessage.textContent = metronomeEnabled 
    ? `练习结束 (节拍器：${currentBPM} BPM)，点击"开始练习"继续`
    : '练习结束，点击"开始练习"继续';
}

// 音频分析主循环
function analyzeAudio() {
  if (!isListening) return;
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const timeData = new Uint8Array(bufferLength);
  
  analyser.getByteFrequencyData(dataArray);
  analyser.getByteTimeDomainData(timeData);
  
  // 更新音量电平
  if (volumeMeterFill) {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avg = sum / dataArray.length;
    volumeMeterFill.style.width = Math.min(100, (avg / 128) * 100) + '%';
  }
  
  // 绘制波形
  drawWaveform(timeData);
  
  // 检测扫弦
  detectStrum(dataArray, timeData);
  
  // 更新评分
  updateScores();
  
  requestAnimationFrame(analyzeAudio);
}

// 绘制波形
function drawWaveform(timeData) {
  canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  
  canvasCtx.lineWidth = 2;
  canvasCtx.strokeStyle = '#b866ff';
  canvasCtx.beginPath();
  
  const sliceWidth = canvas.width / timeData.length;
  let x = 0;
  
  for (let i = 0; i < timeData.length; i++) {
    const v = timeData[i] / 128.0;
    const y = (v * canvas.height) / 2;
    
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
    
    x += sliceWidth;
  }
  
  canvasCtx.stroke();
}

// 扫弦检测
function detectStrum(freqData, timeData) {
  const now = Date.now();
  
  // 计算音量 (RMS)
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const normalized = (timeData[i] - 128) / 128;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / timeData.length);
  
  // 计算高频能量 (音色指标)
  const highFreqStart = Math.floor(freqData.length * 0.6);
  let highFreqEnergy = 0;
  for (let i = highFreqStart; i < freqData.length; i++) {
    highFreqEnergy += freqData[i];
  }
  highFreqEnergy /= (freqData.length - highFreqStart);
  
  // 最小扫弦间隔 (ms)
  const MIN_STRUM_INTERVAL = 100;
  
  // 使用动态阈值（根据用户设置的灵敏度）
  if (rms > strumThreshold && now - lastStrumTime > MIN_STRUM_INTERVAL) {
    // 检测到扫弦
    const strum = {
      time: now,
      amplitude: rms,
      tone: highFreqEnergy,
      interval: lastStrumTime > 0 ? now - lastStrumTime : 0
    };
    
    detectedStrums.push(strum);
    lastStrumTime = now;
    
    // 保持最近 20 次扫弦
    if (detectedStrums.length > 20) {
      detectedStrums.shift();
    }
    
    // 实时反馈
    provideFeedback(strum);
  }
}

// 提供实时反馈
function provideFeedback(strum) {
  const pattern = RHYTHM_PATTERNS[currentRhythm];
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

// 计算评分
function updateScores() {
  if (detectedStrums.length < 2) {
    rhythmScoreEl.textContent = '--';
    toneScoreEl.textContent = '--';
    dynamicsScoreEl.textContent = '--';
    totalScoreEl.textContent = '--';
    return;
  }
  
  const pattern = RHYTHM_PATTERNS[currentRhythm];
  
  // 节奏评分 - 改进版
  const rhythmScore = calculateRhythmScore(detectedStrums, pattern);
  
  // 音色评分 - 改进版
  const toneScore = calculateToneScore(detectedStrums);
  
  // 强弱评分 - 改进版
  const dynamicsScore = calculateDynamicsScore(detectedStrums, pattern);
  
  // 总分 (加权平均)
  const totalScore = Math.round(
    rhythmScore * 0.5 + 
    toneScore * 0.3 + 
    dynamicsScore * 0.2
  );
  
  // 更新显示
  rhythmScoreEl.textContent = rhythmScore;
  toneScoreEl.textContent = toneScore;
  dynamicsScoreEl.textContent = dynamicsScore;
  totalScoreEl.textContent = totalScore;
  
  // 更新圆环
  updateScoreRing(rhythmRingEl, rhythmScoreEl, rhythmScore);
  updateScoreRing(toneRingEl, toneScoreEl, toneScore);
  updateScoreRing(dynamicsRingEl, dynamicsScoreEl, dynamicsScore);
  updateScoreRing(totalRingEl, totalScoreEl, totalScore);
}

// 改进的节奏评分算法
function calculateRhythmScore(strums, pattern) {
  if (strums.length < 2) return 0;
  
  let totalScore = 0;
  let validStrums = 0;
  
  // 计算预期的累计时间
  let expectedCumulativeTime = 0;
  let actualCumulativeTime = 0;
  
  for (let i = 1; i < strums.length; i++) {
    const expectedInterval = pattern.pattern[(i - 1) % pattern.pattern.length];
    const actualInterval = strums[i].interval;
    
    // 基于 BPM 的动态容差 (BPM 越低容差越大)
    const bpmFactor = 120 / currentBPM;
    const baseTolerance = expectedInterval * 0.25;
    const dynamicTolerance = baseTolerance * Math.sqrt(bpmFactor);
    
    // 计算偏差百分比
    const deviation = Math.abs(actualInterval - expectedInterval);
    const deviationPercent = deviation / expectedInterval;
    
    // 使用高斯衰减函数，提供更平滑的评分
    // σ = 0.15 表示 15% 偏差时得分约 60 分
    const sigma = 0.15;
    const score = 100 * Math.exp(-(deviationPercent * deviationPercent) / (2 * sigma * sigma));
    
    totalScore += Math.max(0, Math.min(100, score));
    validStrums++;
    
    // 累计时间跟踪 (检测整体节奏漂移)
    expectedCumulativeTime += expectedInterval;
    actualCumulativeTime += actualInterval;
  }
  
  // 累计漂移惩罚
  const cumulativeDrift = Math.abs(actualCumulativeTime - expectedCumulativeTime);
  const maxExpectedTime = expectedCumulativeTime;
  const driftPenalty = Math.min(20, (cumulativeDrift / maxExpectedTime) * 100);
  
  const baseScore = validStrums > 0 ? totalScore / validStrums : 0;
  return Math.round(Math.max(0, Math.min(100, baseScore - driftPenalty)));
}

// 改进的音色评分算法
function calculateToneScore(strums) {
  if (strums.length === 0) return 0;
  
  let totalScore = 0;
  
  for (const strum of strums) {
    const tone = strum.tone;
    
    // 使用范围评分而非单点评分
    // 理想范围: 60-200 (更宽容)
    const idealMin = 60;
    const idealMax = 200;
    const idealCenter = (idealMin + idealMax) / 2;
    const range = (idealMax - idealMin) / 2;
    
    if (tone >= idealMin && tone <= idealMax) {
      // 在理想范围内，根据距离中心的远近评分
      const distanceFromCenter = Math.abs(tone - idealCenter);
      const score = 100 - (distanceFromCenter / range) * 20; // 范围内最低 80 分
      totalScore += score;
    } else {
      // 在理想范围外，线性衰减
      const distanceOutside = tone < idealMin ? idealMin - tone : tone - idealMax;
      const score = Math.max(0, 80 - (distanceOutside / 50) * 80);
      totalScore += score;
    }
  }
  
  return Math.round(totalScore / strums.length);
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
    
    // 如果预期和实际一致，得分高
    if (expectedStrong === isActuallyStrong) {
      totalScore += 90 + (Math.random() * 10); // 90-100 分
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
  let力度Bonus = 0;
  if (avgAmplitude > 0.2) {
    力度Bonus = 10; // 力度充足的奖励
  } else if (avgAmplitude < 0.1) {
    力度Bonus = -15; // 力度不足的惩罚
  }
  
  return Math.round(Math.max(0, Math.min(100, score + 力度Bonus)));
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
  
  if (typeof score === 'number') {
    valueEl.textContent = score;
    valueEl.style.color = color;
  }
}

// 保存历史记录
function saveHistory() {
  const pattern = RHYTHM_PATTERNS[currentRhythm];
  const totalScore = parseInt(totalScoreEl.textContent) || 0;
  
  const historyItem = {
    date: new Date().toISOString(),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    rhythm: pattern.name,
    rhythmIndex: currentRhythm,
    score: totalScore,
    rhythmScore: parseInt(rhythmScoreEl.textContent) || 0,
    toneScore: parseInt(toneScoreEl.textContent) || 0,
    dynamicsScore: parseInt(dynamicsScoreEl.textContent) || 0,
    strums: detectedStrums.length,
    bpm: currentBPM
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
  historyList.innerHTML = strumHistory.map(item => `
    <div class="history-item">
      <span class="time">${item.time} - ${item.rhythm}</span>
      <span class="score">${item.score}分 (${item.strums}次扫弦)</span>
    </div>
  `).join('');
}

// 窗口大小改变时调整画布
window.addEventListener('resize', () => {
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
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
  console.log('[GuitarStrumTrainer] DOMContentLoaded 触发');
  try {
    init();
    console.log('[GuitarStrumTrainer] 初始化成功');
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
function renderCustomRhythmsList() {
  const container = document.getElementById('customRhythmsList');
  if (!container) return;
  
  if (customRhythms.length === 0) {
    container.innerHTML = '<div style="color: #888; padding: 20px; text-align: center;">暂无自定义节奏型，点击"+"创建</div>';
    return;
  }
  
  container.innerHTML = customRhythms.map((rhythm, index) => {
    const noteCount = rhythm.notes ? rhythm.notes.length : 0;
    const pattern = rhythm.notes ? rhythm.notes.map(n => n.direction === 'D' ? '↓' : '↑').join(' ') : '';
    return `
      <div style="padding: 15px; background: rgba(184, 102, 255, 0.08); border: 1px solid rgba(184, 102, 255, 0.25); border-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
        <div style="cursor: pointer; flex: 1;" onclick="selectCustomRhythm(${index})">
          <div style="font-weight: bold; color: #b866ff; margin-bottom: 5px;">${escapeHtml(rhythm.name)}</div>
          <div style="color: #888; font-size: 1.1em; font-family: monospace; letter-spacing: 2px;">${pattern}</div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="editCustomRhythm(${index}); event.stopPropagation();" style="padding: 8px 16px; background: #ffa502; color: white; border: none; border-radius: 8px; cursor: pointer;">✏️ 编辑</button>
          <button onclick="playCustomRhythm(${index}); event.stopPropagation();" style="padding: 8px 16px; background: #2ed573; color: white; border: none; border-radius: 8px; cursor: pointer;">🔊 试听</button>
          <button onclick="deleteCustomRhythm(${index}); event.stopPropagation();" style="padding: 8px 16px; background: #ff4757; color: white; border: none; border-radius: 8px; cursor: pointer;">🗑 删除</button>
        </div>
      </div>
    `;
  }).join('');
  
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
    const arrowPattern = rhythm.notes.map(n => n.direction === 'D' ? '↓' : '↑').join(' ');
    const option = document.createElement('div');
    option.className = 'rhythm-option custom-rhythm-option';
    option.dataset.customIndex = index;
    option.innerHTML = `
      <div class="name">${escapeHtml(rhythm.name)}</div>
      <div class="pattern">${arrowPattern}</div>
      <button class="btn-demo" data-custom="${index}">🔊 试听演示</button>
    `;
    option.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-demo')) return;
      selectCustomRhythm(index);
    });
    rhythmSelector.appendChild(option);
  });
  
  // 重新绑定所有演示按钮事件（包括新增的自定义按钮）
  setupDemoButtons();
  
  // 绑定自定义试听按钮事件
  rhythmSelector.querySelectorAll('.btn-demo[data-custom]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const customIndex = parseInt(btn.dataset.custom);
      playCustomRhythm(customIndex);
    });
  });
  
  console.log('[GuitarStrumTrainer] 自定义节奏型已同步到主列表:', customRhythms.length);
}

// 选择自定义节奏型
function selectCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  
  const rhythm = customRhythms[index];
  if (!rhythm.notes || rhythm.notes.length === 0) return;
  
  // 转换为标准节奏型格式
  const tempPattern = rhythm.notes.map(note => {
    const durationMs = NOTE_DURATIONS[note.duration]?.ms || 250;
    // 根据当前 BPM 调整时值（基于 120BPM 的原始时值）
    return durationMs * (120 / currentBPM);
  });
  
  const tempDemo = rhythm.notes.map(note => note.direction);
  
  // 临时添加到 RHYTHM_PATTERNS 末尾
  const tempIndex = RHYTHM_PATTERNS.length;
  const tempRhythm = {
    name: rhythm.name,
    pattern: tempPattern,
    beats: 4,
    description: rhythm.notes.map(n => n.direction === 'D' ? '↓' : '↑').join(' '),
    demo: tempDemo,
    isCustom: true
  };
  RHYTHM_PATTERNS.push(tempRhythm);
  
  // 选择这个节奏型
  currentRhythm = tempIndex;
  
  // 更新 UI 选中状态（包括主列表和自定义列表）
  const options = document.querySelectorAll('.rhythm-option');
  options.forEach(o => o.classList.remove('active'));
  
  // 高亮对应的自定义节奏型选项
  const customOption = document.querySelector(`.custom-rhythm-option[data-custom-index="${index}"]`);
  if (customOption) {
    customOption.classList.add('active');
  }
  
  feedbackMessage.textContent = `已选择：${rhythm.name} - ${tempDemo.join(' ')}`;
  
  console.log('[GuitarStrumTrainer] 已选择自定义节奏型:', rhythm.name);
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

// 播放自定义节奏型
let playingCustomBtn = null; // 跟踪当前播放的自定义节奏型按钮

function playCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  
  const rhythm = customRhythms[index];
  if (!rhythm.notes || rhythm.notes.length === 0) return;
  
  // 如果已经在播放，点击则停止
  if (isPlayingDemo && playingCustomBtn) {
    stopDemo();
    return;
  }
  
  // 转换为标准节奏型格式
  const tempPattern = rhythm.notes.map(note => {
    const durationMs = NOTE_DURATIONS[note.duration]?.ms || 250;
    // 根据当前 BPM 调整时值（基于 120BPM 的原始时值）
    return durationMs * (120 / currentBPM);
  });
  
  const tempDemo = rhythm.notes.map(note => note.direction);
  
  // 临时添加到 RHYTHM_PATTERNS
  const tempIndex = RHYTHM_PATTERNS.length;
  const tempRhythm = {
    name: rhythm.name,
    pattern: tempPattern,
    beats: 4,
    description: rhythm.notes.map(n => n.direction === 'D' ? '↓' : '↑').join(' '),
    demo: tempDemo,
    isCustom: true
  };
  RHYTHM_PATTERNS.push(tempRhythm);
  
  // 找到被点击的按钮
  const clickedBtn = event.target;
  playingCustomBtn = clickedBtn;
  
  // 更新按钮状态
  if (clickedBtn && clickedBtn.classList) {
    clickedBtn.classList.add('playing');
  }
  if (clickedBtn && clickedBtn.textContent !== undefined) {
    clickedBtn.textContent = '⏹ 停止演示';
  }
  
  // 播放演示
  playDemo(tempIndex, {
    dataset: { rhythm: tempIndex },
    classList: {
      add: function() {},
      remove: function() {},
      toggle: function() {}
    },
    textContent: ''
  });
  
  // 播放完成后清理（10 秒后或手动停止）
  const cleanupTimeout = setTimeout(() => {
    if (isPlayingDemo) {
      stopDemo();
    }
    playingCustomBtn = null;
  }, 10000); // 10 秒后自动停止
  
  // 保存清理函数引用，可以在 stopDemo 中清除
  window.customRhythmCleanup = cleanupTimeout;
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
  
  console.log('[GuitarStrumTrainer] 节奏型已保存:', name);
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
    console.log('[GuitarStrumTrainer] 用户设置已保存');
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
    
    // 恢复节奏型选择
    if (settings.currentRhythm !== undefined && settings.currentRhythm < RHYTHM_PATTERNS.length) {
      currentRhythm = settings.currentRhythm;
      const options = document.querySelectorAll('.rhythm-option');
      options.forEach((o, i) => {
        o.classList.toggle('active', i === currentRhythm);
      });
    }
    
    // 恢复自定义节奏型
    if (settings.customRhythms && Array.isArray(settings.customRhythms)) {
      customRhythms = settings.customRhythms;
    }
    
    console.log('[GuitarStrumTrainer] 用户设置已加载');
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
  console.log('[GuitarStrumTrainer] 设置已导出');
}

// 导入用户设置
function importUserSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const settings = JSON.parse(e.target.result);
      
      // 导入自定义节奏型
      if (settings.customRhythms && Array.isArray(settings.customRhythms)) {
        customRhythms = settings.customRhythms;
        saveCustomRhythms();
      }
      
      // 导入其他设置
      if (settings.bpm) currentBPM = settings.bpm;
      if (settings.metronomeEnabled !== undefined) metronomeEnabled = settings.metronomeEnabled;
      if (settings.sensitivityLevel) sensitivityLevel = settings.sensitivityLevel;
      
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
      alert('导入失败：文件格式错误');
      console.error('导入设置失败:', err);
    }
  };
  reader.readAsText(file);
  
  // 清空文件输入，允许重复导入同一文件
  event.target.value = '';
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 自动保存设置（定期）
setInterval(() => {
  saveUserSettings();
}, 5000); // 每 5 秒自动保存
