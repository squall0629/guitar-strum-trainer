/**
 * HTML 转义，防止 XSS
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 导入和弦库
import { ChordLibrary } from './chord-library.js';

// 导入常量
import {
  RECORDER_DRAW_INTERVAL,
  SPECTRUM_DRAW_INTERVAL,
  SPECTRUM_MIN_FREQ,
  SPECTRUM_MAX_FREQ,
  SCORE_COLOR_EXCELLENT,
  SCORE_COLOR_GOOD,
  TRANSITION_TIME_EXCELLENT,
  TRANSITION_TIME_GOOD,
  CHORD_CONFIDENCE_HIGH,
  CHORD_CONFIDENCE_MEDIUM,
  FFT_SIZE,
  DEBUG
} from './constants.js';

/**
 * 绘制 Windows 录音机风格波形（使用传入的 RMS 值）- 节流到 10 FPS
 */
export function drawRecorderWaveform(recorderCanvas, recorderCtx, recorderWaveformData, timeData, rms,
                                     RECORDER_BUFFER_SIZE, RECORDER_DRAW_INTERVAL, DEBUG = false) {
  if (!recorderCanvas || !recorderCtx) {
    return;
  }
  if (recorderCanvas.width === 0 || recorderCanvas.height === 0) {
    return;
  }
  
  // 性能优化：节流到 10 FPS
  const now = performance.now();
  if (now - recorderCanvas._lastRecorderDrawTime < RECORDER_DRAW_INTERVAL) {
    return;
  }
  recorderCanvas._lastRecorderDrawTime = now;
  
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
}

/**
 * 绘制时域频谱图（STFT 短时傅里叶变换 + 彩虹色热力图）- 节流到 15 FPS + 离屏缓冲优化
 */
export function drawSpectrumWaveform(spectrumCanvas, spectrumCtx, freqData, spectrumHistory,
                                     SPECTRUM_HISTORY_SIZE, SPECTRUM_DRAW_INTERVAL, audioContext,
                                     DEBUG = false) {
  if (!spectrumCanvas || !spectrumCtx) {
    return;
  }
  if (spectrumCanvas.width === 0 || spectrumCanvas.height === 0) {
    return;
  }
  if (!freqData) {
    return;
  }
  
  // 性能优化：节流到 15 FPS
  const now = performance.now();
  if (now - spectrumCanvas._lastSpectrumDrawTime < SPECTRUM_DRAW_INTERVAL) {
    return;
  }
  spectrumCanvas._lastSpectrumDrawTime = now;
  
  // 检测 canvas 尺寸变化，重建离屏缓冲
  if (spectrumCanvas.width !== spectrumCanvas._lastSpectrumCanvasWidth || 
      spectrumCanvas.height !== spectrumCanvas._lastSpectrumCanvasHeight) {
    spectrumCanvas._spectrumOffscreenCanvas = null;
    spectrumCanvas._spectrumOffscreenCtx = null;
    spectrumCanvas._spectrumBackgroundDirty = true;
    spectrumCanvas._lastSpectrumCanvasWidth = spectrumCanvas.width;
    spectrumCanvas._lastSpectrumCanvasHeight = spectrumCanvas.height;
  }
  
  // 创建离屏 Canvas（只创建一次）
  if (!spectrumCanvas._spectrumOffscreenCanvas) {
    spectrumCanvas._spectrumOffscreenCanvas = document.createElement('canvas');
    spectrumCanvas._spectrumOffscreenCanvas.width = spectrumCanvas.width;
    spectrumCanvas._spectrumOffscreenCanvas.height = spectrumCanvas.height;
    spectrumCanvas._spectrumOffscreenCtx = spectrumCanvas._spectrumOffscreenCanvas.getContext('2d');
    spectrumCanvas._spectrumBackgroundDirty = true;
  }
  
  // 添加当前频谱到历史缓冲区（使用预分配环形缓冲区，避免每帧 GC）
  if (!spectrumCanvas._spectrumRingBuffer) {
    spectrumCanvas._spectrumRingBuffer = [];
    for (let i = 0; i < SPECTRUM_HISTORY_SIZE; i++) {
      spectrumCanvas._spectrumRingBuffer.push(new Uint8Array(freqData.length));
    }
    spectrumCanvas._spectrumRingHead = 0;
    spectrumCanvas._spectrumRingCount = 0;
  }
  const head = spectrumCanvas._spectrumRingHead;
  spectrumCanvas._spectrumRingBuffer[head].set(freqData);
  spectrumCanvas._spectrumRingHead = (head + 1) % SPECTRUM_HISTORY_SIZE;
  spectrumCanvas._spectrumRingCount = Math.min(spectrumCanvas._spectrumRingCount + 1, SPECTRUM_HISTORY_SIZE);
  
  // 重建 spectrumHistory 为当前环形缓冲区的视图
  spectrumHistory.length = 0;
  for (let i = 0; i < spectrumCanvas._spectrumRingCount; i++) {
    const idx = (head - spectrumCanvas._spectrumRingCount + i + SPECTRUM_HISTORY_SIZE) % SPECTRUM_HISTORY_SIZE;
    spectrumHistory.push(spectrumCanvas._spectrumRingBuffer[idx]);
  }
  if (spectrumHistory.length > SPECTRUM_HISTORY_SIZE) {
    spectrumHistory.shift();
  }
  
  const historyLength = spectrumHistory.length;
  const cellWidth = spectrumCanvas.width / SPECTRUM_HISTORY_SIZE;
  
  // 性能优化：只处理 80Hz-1000Hz 关键频段（吉他核心频段）
  const sampleRate = audioContext ? audioContext.sampleRate : 44100;
  const binFrequency = sampleRate / FFT_SIZE;
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
      
      spectrumCanvas._spectrumOffscreenCtx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
      spectrumCanvas._spectrumOffscreenCtx.fillRect(x, y, cellWidth + 1, cellHeight + 1);
    }
  }
  
  // 将离屏 Canvas 内容绘制到主 Canvas
  spectrumCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
  spectrumCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  spectrumCtx.fillRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
  spectrumCtx.drawImage(spectrumCanvas._spectrumOffscreenCanvas, 0, 0);
  
  // 绘制频率刻度标签（只在背景脏时重绘）
  if (spectrumCanvas._spectrumBackgroundDirty) {
    spectrumCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    spectrumCtx.font = '10px Arial';
    spectrumCtx.fillText('1kHz', 5, 12);
    spectrumCtx.fillText('80Hz', 5, spectrumCanvas.height - 5);
    spectrumCanvas._spectrumBackgroundDirty = false;
  }
}

/**
 * 更新圆环进度条
 */
export function updateScoreRing(ringEl, valueEl, score) {
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

/**
 * 绘制和弦指法图 - 纯 SVG 渲染（适配 Retina 屏幕）
 * @param {HTMLElement} container - SVG 容器元素（div）
 * @param {string} chordName - 和弦名称 (如 'C', 'Am')
 */
export function drawChordDiagram(container, chordName) {
  if (!container) return;
  
  // 获取容器尺寸（支持 devicePixelRatio 适配）
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const width = Math.floor(rect.width * dpr);
  const height = Math.floor(rect.height * dpr);
  
  if (!chordName) {
    // 显示空状态
    container.innerHTML = '';
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;';
    div.textContent = '未选择和弦';
    container.appendChild(div);
    return;
  }
  
  try {
    // 使用 chordictionary 生成 SVG
    const svgString = ChordLibrary.getChordSVG(chordName, width, height);
    
    // 安全地插入 SVG（清理潜在危险内容）
    container.innerHTML = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = svgString;
    while (tempDiv.firstChild) {
      container.appendChild(tempDiv.firstChild);
    }
    
    // 确保 SVG 适配容器
    const svg = container.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
  } catch (e) {
    if (DEBUG) console.warn('[ChordDiagram] SVG 生成失败，使用备用方案:', e);
    drawChordDiagramFallbackSVG(container, chordName);
  }
}

/**
 * 备用和弦指法图绘制（SVG 版本）
 * @param {HTMLElement} container - SVG 容器元素（div）
 * @param {string} chordName - 和弦名称
 */
export function drawChordDiagramFallbackSVG(container, chordName) {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const width = Math.floor(rect.width * dpr);
  const height = Math.floor(rect.height * dpr);
  
  const chordData = ChordLibrary.getChordData(chordName);
  
  if (!chordData) {
    container.innerHTML = '';
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;';
    div.textContent = '无指法数据';
    container.appendChild(div);
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
  
  // 和弦名称（转义防止 XSS）
  svg += `<text x="${width / 2}" y="${height - 5 * dpr}" fill="#fff" font-size="${12 * dpr}" font-weight="bold" text-anchor="middle" font-family="Microsoft YaHei">${escapeHtml(chordName)}</text>`;
  
  svg += `</svg>`;
  
  // 安全地插入 SVG（使用 DOM 方法）
  container.innerHTML = '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = svg;
  while (tempDiv.firstChild) {
    container.appendChild(tempDiv.firstChild);
  }
}

/**
 * 更新和弦识别结果显示
 * @param {object} result - 识别结果 {chord, confidence}
 */
export function updateChordRecognition(recognizedChordEl, chordConfidenceEl, result) {
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
export function updateTransitionTime(transitionTimeEl, timeMs) {
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
