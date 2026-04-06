// 吉他扫弦练习助手 - 节拍器模块
// 功能：节拍器声音生成、节奏控制、BPM 管理

let audioContextForMetronome = null;
let metronomeEnabled = false;
let currentBPM = 70;
let metronomeInterval = null;
let metronomeBeat = 0;

// ========== 节拍器声音生成 ==========
export function playMetronomeSound(frequency = 1000, duration = 0.05) {
  if (!audioContextForMetronome) {
    audioContextForMetronome = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContextForMetronome.state === 'suspended') {
    audioContextForMetronome.resume().catch(err => console.warn(err));
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

// ========== 节拍器控制 ==========
export function startMetronome(getActiveRhythmFn, currentDemoRhythmIndex = -1) {
  if (metronomeInterval) {
    clearInterval(metronomeInterval);
  }
  
  const beatInterval = (60 / currentBPM) * 1000;
  metronomeBeat = 0;
  
  // 首拍重音
  playMetronomeSound(1200, 0.05);
  triggerMetronomeDot(true);
  
  metronomeInterval = setInterval(() => {
    metronomeBeat++;
    const activeRhythm = getActiveRhythmFn ? getActiveRhythmFn(currentDemoRhythmIndex) : null;
    const beats = activeRhythm ? activeRhythm.beats : 4;
    const isAccent = metronomeBeat % beats === 0; // 每小节第一拍重音
    
    playMetronomeSound(isAccent ? 1200 : 800, 0.05);
    triggerMetronomeDot(isAccent);
  }, beatInterval);
}

function triggerMetronomeDot(isAccent) {
  const metronomeDot = document.getElementById('metronomeDot');
  if (!metronomeDot) return;
  
  metronomeDot.classList.add('accent');
  setTimeout(() => metronomeDot.classList.remove('accent'), 150);
}

export function stopMetronome() {
  if (metronomeInterval) {
    clearInterval(metronomeInterval);
    metronomeInterval = null;
  }
}

export function setMetronomeEnabled(enabled) {
  metronomeEnabled = enabled;
}

export function isMetronomeEnabled() {
  return metronomeEnabled;
}

export function setCurrentBPM(bpm) {
  currentBPM = bpm;
}

export function getCurrentBPM() {
  return currentBPM;
}
