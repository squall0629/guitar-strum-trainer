// 吉他扫弦练习助手 - 核心音频分析引擎

// 节奏型定义 (单位：毫秒，基于 120BPM)
const RHYTHM_PATTERNS = [
  {
    name: '前八后十六',
    pattern: [500, 250, 250], // 八分 + 十六分 + 十六分
    beats: 4,
    description: '♪ ♫♫',
    demo: ['D', 'D', 'D']
  },
  {
    name: '前十六后八',
    pattern: [250, 250, 500], // 十六分 + 十六分 + 八分
    beats: 4,
    description: '♫♫ ♪',
    demo: ['D', 'D', 'D']
  },
  {
    name: '民谣常用',
    pattern: [500, 250, 250, 250, 250, 500], // 下 下上 上下上
    beats: 4,
    description: 'D DU UDU',
    demo: ['D', 'D', 'U', 'U', 'D', 'U']
  },
  {
    name: '摇滚八分',
    pattern: [250, 250, 250, 250, 250, 250, 250, 250], // 8 个八分音符
    beats: 4,
    description: 'DUDUDUDU',
    demo: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U']
  },
  {
    name: '华尔兹',
    pattern: [667, 333, 333, 667, 333, 333], // 3/4 拍
    beats: 3,
    description: 'D UU D UU',
    demo: ['D', 'U', 'U', 'D', 'U', 'U']
  }
];

// 节拍器相关
let metronomeEnabled = false;
let currentBPM = 120;
let metronomeInterval = null;
let metronomeBeat = 0;
let audioContextForMetronome = null;

// 演示播放相关
let isPlayingDemo = false;
let demoTimeout = null;

// 灵敏度相关
let sensitivityLevel = 50; // 1-100
let strumThreshold = 0.15; // 根据灵敏度动态计算

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
let feedbackMessage, historyList, canvas, canvasCtx;
let metronomeToggle, bpmSlider, bpmValue, demoButtons;
let sensitivitySlider, sensitivityValue, thresholdDisplay;
let statsChartCanvas, statsChartCtx, avgScoreEl, maxScoreEl, practiceCountEl;

// 版本号
const APP_VERSION = 'v1.3';

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
  sensitivityValue = document.getElementById('sensitivityValue');
  thresholdDisplay = document.getElementById('thresholdDisplay');
  
  statsChartCanvas = document.getElementById('statsChart');
  statsChartCtx = statsChartCanvas ? statsChartCanvas.getContext('2d') : null;
  avgScoreEl = document.getElementById('avgScore');
  maxScoreEl = document.getElementById('maxScore');
  practiceCountEl = document.getElementById('practiceCount');
  
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
  loadHistoryFromStorage();
  renderHistory();
  renderStatsChart();
  updateStatus('ready');
  
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
}

// 播放节拍器声音
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
  
  const beatInterval = (60 / currentBPM) * 1000; // 毫秒
  metronomeBeat = 0;
  
  playMetronomeSound(1200, 0.05); // 第一拍高音
  
  metronomeInterval = setInterval(() => {
    metronomeBeat++;
    const isAccent = metronomeBeat % RHYTHM_PATTERNS[currentRhythm].beats === 0;
    playMetronomeSound(isAccent ? 1200 : 800, 0.05);
  }, beatInterval);
}

// 停止节拍器
function stopMetronome() {
  if (metronomeInterval) {
    clearInterval(metronomeInterval);
    metronomeInterval = null;
  }
}

// 播放扫弦演示声音
function playStrumSound(direction, duration = 0.1) {
  if (!audioContextForMetronome) {
    audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // 创建多个振荡器模拟扫弦的和弦效果
  const frequencies = direction === 'D' ? [329.63, 440, 554.37, 659.25] : [659.25, 554.37, 440, 329.63];
  
  frequencies.forEach((freq, index) => {
    const oscillator = audioContextForMetronome.createOscillator();
    const gainNode = audioContextForMetronome.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextForMetronome.destination);
    
    oscillator.frequency.value = freq;
    oscillator.type = 'triangle';
    
    const startTime = audioContextForMetronome.currentTime + (index * 0.02);
    gainNode.gain.setValueAtTime(0.15, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  });
}

// 播放节奏型演示
function playDemo(rhythmIndex, btnElement) {
  isPlayingDemo = true;
  btnElement.classList.add('playing');
  btnElement.textContent = '⏹ 停止演示';
  
  const pattern = RHYTHM_PATTERNS[rhythmIndex];
  const baseBPM = 120;
  let noteIndex = 0;
  
  function playNextNote() {
    if (!isPlayingDemo) return;
    
    const direction = pattern.demo[noteIndex % pattern.demo.length];
    playStrumSound(direction);
    
    // 视觉反馈
    const options = rhythmSelector.querySelectorAll('.rhythm-option');
    options.forEach(o => o.classList.remove('active'));
    options[rhythmIndex].classList.add('active');
    
    const intervalMs = (60 / baseBPM) * pattern.pattern[noteIndex % pattern.pattern.length];
    noteIndex++;
    
    demoTimeout = setTimeout(playNextNote, intervalMs);
  }
  
  playNextNote();
  
  // 3 秒后自动停止
  setTimeout(() => {
    if (isPlayingDemo) stopDemo();
  }, 3000);
}

// 停止演示
function stopDemo() {
  isPlayingDemo = false;
  if (demoTimeout) clearTimeout(demoTimeout);
  
  demoButtons.forEach(btn => {
    btn.classList.remove('playing');
    btn.textContent = '🔊 试听演示';
  });
}

// 设置灵敏度
function setupSensitivity() {
  if (!sensitivitySlider) return;
  
  // 更新阈值计算
  function updateThreshold() {
    // 灵敏度 1-100 映射到阈值 0.30-0.05
    // 灵敏度越高，阈值越低（更容易触发）
    strumThreshold = 0.30 - (sensitivityLevel - 1) * (0.25 / 99);
    strumThreshold = Math.max(0.05, Math.min(0.30, strumThreshold));
    
    if (thresholdDisplay) {
      thresholdDisplay.textContent = strumThreshold.toFixed(2);
    }
  }
  
  sensitivitySlider.addEventListener('input', (e) => {
    sensitivityLevel = parseInt(e.target.value);
    if (sensitivityValue) {
      sensitivityValue.textContent = sensitivityLevel;
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
    // 请求麦克风权限
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      } 
    });
    
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
    console.error('音频初始化失败:', err);
    feedbackMessage.textContent = '❌ 无法访问麦克风，请检查权限设置';
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
  canvasCtx.strokeStyle = '#00d9ff';
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
  
  // 更新样式
  updateScoreStyle(rhythmScoreEl, rhythmScore);
  updateScoreStyle(toneScoreEl, toneScore);
  updateScoreStyle(dynamicsScoreEl, dynamicsScore);
  updateScoreStyle(totalScoreEl, totalScore);
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
    gradient.addColorStop(0, 'rgba(0, 217, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 217, 255, 0.02)');
    
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
    statsChartCtx.strokeStyle = '#00d9ff';
    statsChartCtx.lineWidth = 2;
    statsChartCtx.stroke();
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
