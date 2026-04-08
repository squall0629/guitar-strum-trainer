// 吉他调音器 UI 模块 v2.0
// 指针式表盘渲染 + 平滑过渡动画

// 指针动画状态
const needleAnimation = {
  currentRotation: 0,
  targetRotation: 0,
  animationFrame: null,
  damping: 0.15,
  minStep: 0.3
};

// 每元素颜色动画状态（避免多元素共享状态冲突）
const elementColorStates = new WeakMap();

const COLOR_ANIMATION_DAMPING = 0.12;

// 音名映射（用于刻度显示）
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const cachedTunerTicks = {
  left: null,
  midLeft: null,
  center: null,
  midRight: null,
  right: null
};

function cacheTunerTickElements() {
  cachedTunerTicks.left = document.getElementById('tunerTickLeft');
  cachedTunerTicks.midLeft = document.getElementById('tunerTickMidLeft');
  cachedTunerTicks.center = document.getElementById('tunerTickCenter');
  cachedTunerTicks.midRight = document.getElementById('tunerTickMidRight');
  cachedTunerTicks.right = document.getElementById('tunerTickRight');
}

/**
 * 根据目标频率获取相邻音名
 * @param {string} targetNote - 目标音名（如 'A2'）
 * @returns {Object} {left, center, right} 相邻音名
 */
function getAdjacentNotes(targetNote) {
  // 解析音名和八度
  const match = targetNote.match(/^([A-G][#b]?)(\d)$/);
  if (!match) return { left: '--', center: targetNote, right: '--' };
  
  const [, note, octave] = match;
  const noteIndex = NOTE_NAMES.indexOf(note);
  
  if (noteIndex === -1) return { left: '--', center: targetNote, right: '--' };
  
  // 计算相邻音名（±1 个半音）
  const leftIndex = (noteIndex - 1 + 12) % 12;
  const rightIndex = (noteIndex + 1) % 12;
  
  let leftOctave = parseInt(octave);
  let rightOctave = parseInt(octave);
  
  // 处理八度边界（C 的左边是 B，需要减八度）
  if (leftIndex === 11) leftOctave--;
  if (rightIndex === 0) rightOctave++;
  
  return {
    left: NOTE_NAMES[leftIndex] + leftOctave,
    center: note + octave,
    right: NOTE_NAMES[rightIndex] + rightOctave
  };
}

/**
 * 更新调音器刻度标签（显示相邻音名）
 * @param {string} targetNote - 目标音名（如 'A2'）
 */
function updateTunerTicks(targetNote) {
  console.log('[TunerUI] updateTunerTicks called with:', targetNote);
  
  if (!targetNote || targetNote === '--') {
    if (cachedTunerTicks.left) cachedTunerTicks.left.textContent = '-100';
    if (cachedTunerTicks.midLeft) cachedTunerTicks.midLeft.textContent = '-50';
    if (cachedTunerTicks.center) cachedTunerTicks.center.textContent = '0';
    if (cachedTunerTicks.midRight) cachedTunerTicks.midRight.textContent = '+50';
    if (cachedTunerTicks.right) cachedTunerTicks.right.textContent = '+100';
    console.log('[TunerUI] No target note, showing default numbers');
    return;
  }
  
  const notes = getAdjacentNotes(targetNote);
  console.log('[TunerUI] Adjacent notes:', notes);
  
  if (cachedTunerTicks.left) cachedTunerTicks.left.textContent = notes.left;
  if (cachedTunerTicks.right) cachedTunerTicks.right.textContent = notes.right;
  if (cachedTunerTicks.center) cachedTunerTicks.center.textContent = notes.center;
  if (cachedTunerTicks.midLeft) cachedTunerTicks.midLeft.textContent = '-50';
  if (cachedTunerTicks.midRight) cachedTunerTicks.midRight.textContent = '+50';
}

/**
 * 解析颜色代码为 RGB
 * @param {string} hex - 颜色代码如 '#2ed573'
 * @returns {Object} {r, g, b}
 */
function parseColor(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 136, g: 136, b: 136 };
}

/**
 * RGB 转 CSS 颜色字符串
 * @param {Object} color - {r, g, b}
 * @returns {string} CSS 颜色
 */
function rgbToString(color) {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`;
}

/**
 * 线性插值
 * @param {number} a - 起始值
 * @param {number} b - 目标值
 * @param {number} t - 插值系数 (0-1)
 * @returns {number} 插值结果
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * 从元素当前样式读取颜色
 * @param {HTMLElement} element - 元素
 * @param {string} property - CSS 属性名
 * @returns {Object} {r, g, b}
 */
function readCurrentColor(element, property) {
  const computed = getComputedStyle(element)[property];
  if (computed) {
    const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    }
  }
  return { r: 136, g: 136, b: 136 };
}

/**
 * 指针动画步进
 * @param {HTMLElement} needleEl - 指针元素
 * @param {Function} onStep - 每帧回调
 */
function animateNeedle(needleEl, onStep) {
  if (needleAnimation.animationFrame) {
    cancelAnimationFrame(needleAnimation.animationFrame);
  }
  
  function step() {
    const diff = needleAnimation.targetRotation - needleAnimation.currentRotation;
    
    if (Math.abs(diff) < needleAnimation.minStep) {
      needleAnimation.currentRotation = needleAnimation.targetRotation;
      if (onStep) onStep(needleAnimation.currentRotation);
      needleAnimation.animationFrame = null;
      return;
    }
    
    needleAnimation.currentRotation += diff * needleAnimation.damping;
    if (onStep) onStep(needleAnimation.currentRotation);
    needleAnimation.animationFrame = requestAnimationFrame(step);
  }
  
  needleAnimation.animationFrame = requestAnimationFrame(step);
}

/**
 * 颜色动画步进（每元素独立状态）
 * @param {HTMLElement} element - 要更新颜色的元素
 * @param {string} property - CSS 属性名（如 'backgroundColor'）
 * @param {Object} targetRgb - 目标颜色 RGB
 * @param {boolean} withGlow - 是否添加发光效果
 */
function animateColor(element, property, targetRgb, withGlow = false) {
  let state = elementColorStates.get(element);
  
  if (!state || state.property !== property) {
    const currentColor = readCurrentColor(element, property);
    state = {
      currentColor,
      targetColor: { ...targetRgb },
      animationFrame: null,
      property
    };
    elementColorStates.set(element, state);
  } else {
    state.currentColor = { ...state.currentColor };
    state.targetColor = { ...targetRgb };
  }
  
  if (state.animationFrame) {
    cancelAnimationFrame(state.animationFrame);
  }
  
  const dr = state.targetColor.r - state.currentColor.r;
  const dg = state.targetColor.g - state.currentColor.g;
  const db = state.targetColor.b - state.currentColor.b;
  
  if (Math.abs(dr) < 1 && Math.abs(dg) < 1 && Math.abs(db) < 1) {
    const colorStr = rgbToString(state.targetColor);
    element.style[property] = colorStr;
    if (withGlow) {
      element.style.boxShadow = `0 0 20px ${colorStr}`;
    }
    state.currentColor = { ...state.targetColor };
    return;
  }
  
  function step() {
    const dr2 = state.targetColor.r - state.currentColor.r;
    const dg2 = state.targetColor.g - state.currentColor.g;
    const db2 = state.targetColor.b - state.currentColor.b;
    
    if (Math.abs(dr2) < 1 && Math.abs(dg2) < 1 && Math.abs(db2) < 1) {
      state.currentColor = { ...state.targetColor };
      const colorStr = rgbToString(state.currentColor);
      element.style[property] = colorStr;
      if (withGlow) {
        element.style.boxShadow = `0 0 20px ${colorStr}`;
      }
      state.animationFrame = null;
      return;
    }
    
    state.currentColor.r = lerp(state.currentColor.r, state.targetColor.r, COLOR_ANIMATION_DAMPING);
    state.currentColor.g = lerp(state.currentColor.g, state.targetColor.g, COLOR_ANIMATION_DAMPING);
    state.currentColor.b = lerp(state.currentColor.b, state.targetColor.b, COLOR_ANIMATION_DAMPING);
    
    const colorStr = rgbToString(state.currentColor);
    element.style[property] = colorStr;
    if (withGlow) {
      element.style.boxShadow = `0 0 20px ${colorStr}`;
    }
    
    state.animationFrame = requestAnimationFrame(step);
  }
  
  state.animationFrame = requestAnimationFrame(step);
}

/**
 * 更新调音器表盘（带平滑动画）
 * @param {Object} result - tuner.identifyString() 返回的结果
 * @param {HTMLElement} stringNameEl - 弦名显示元素
 * @param {HTMLElement} centsEl - 音分显示元素
 * @param {HTMLElement} frequencyEl - 频率显示元素
 * @param {SVGElement} needleEl - SVG 指针元素 (<line>)
 */
export function updateTunerDisplay(result, stringNameEl, centsEl, frequencyEl, needleEl) {
  if (!result) return;
  
  const { stringDisplay, stringName, detectedFreq, cents, status, targetFreq } = result;
  const color = getStatusColor(status);
  const targetRgb = parseColor(color);
  
  // 0. 更新刻度标签（显示相邻音名）
  const targetNote = stringName !== '--' ? stringName : null;
  updateTunerTicks(targetNote);
  
  // 1. 更新弦名（带颜色过渡）
  if (stringNameEl) {
    if (stringName === '--') {
      stringNameEl.textContent = '检测中...';
      animateColor(stringNameEl, 'color', { r: 136, g: 136, b: 136 });
    } else {
      stringNameEl.textContent = stringDisplay;
      animateColor(stringNameEl, 'color', targetRgb);
    }
  }
  
  // 2. 更新频率显示
  if (frequencyEl) {
    if (detectedFreq > 0) {
      frequencyEl.textContent = detectedFreq.toFixed(1) + ' Hz';
      animateColor(frequencyEl, 'color', targetRgb);
    } else {
      frequencyEl.textContent = '-- Hz';
      animateColor(frequencyEl, 'color', { r: 136, g: 136, b: 136 });
    }
  }
  
  // 3. 更新音分显示
  if (centsEl) {
    if (stringName !== '--' && detectedFreq > 0) {
      const sign = cents > 0 ? '+' : '';
      centsEl.textContent = `${sign}${cents}`;
      animateColor(centsEl, 'color', targetRgb);
    } else {
      centsEl.textContent = '--';
      animateColor(centsEl, 'color', { r: 136, g: 136, b: 136 });
    }
  }
  
  // 4. 更新指针位置（SVG rotate 动画）
  // 范围：±100 音分（±1 个半音），指针最大旋转±45 度
  if (needleEl) {
    const clampedCents = Math.max(-100, Math.min(100, cents));
    const targetRotation = (clampedCents / 100) * 45;
    
    needleAnimation.targetRotation = targetRotation;
    animateNeedle(needleEl, (rotation) => {
      needleEl.setAttribute('transform', `rotate(${rotation.toFixed(1)})`);
    });
    
    const rgbStr = rgbToString(targetRgb);
    needleEl.style.stroke = rgbStr;
  }
}

/**
 * 重置指针动画状态（模式切换时调用）
 */
export function resetTunerUI() {
  if (needleAnimation.animationFrame) {
    cancelAnimationFrame(needleAnimation.animationFrame);
    needleAnimation.animationFrame = null;
  }
  needleAnimation.currentRotation = 0;
  needleAnimation.targetRotation = 0;
  
  // 重置刻度标签为默认数字
  updateTunerTicks(null);
}

/**
 * 获取状态颜色
 * @param {string} status - 状态
 * @returns {string} 颜色代码
 */
function getStatusColor(status) {
  switch (status) {
    case 'in-tune': return '#2ed573';
    case 'out-of-tune': return '#ff4757';
    default: return '#888888';
  }
}

/**
 * 初始化调音器 UI 事件
 * @param {Function} onPlayTone - 播放参考音回调
 */
export function initTunerUI(onPlayTone) {
  cacheTunerTickElements();
  
  for (let i = 0; i <= 5; i++) {
    const btn = document.getElementById(`btnPlayString${i}`);
    if (btn) {
      btn.addEventListener('click', () => {
        if (onPlayTone) onPlayTone(i);
      });
    }
  }
}
