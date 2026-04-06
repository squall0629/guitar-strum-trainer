// 吉他调音器 UI 模块 v1.0
// 指针式表盘渲染

/**
 * 更新调音器表盘
 * @param {Object} result - tuner.identifyString() 返回的结果
 * @param {HTMLElement} stringNameEl - 弦名显示元素
 * @param {HTMLElement} centsEl - 音分显示元素
 * @param {HTMLElement} frequencyEl - 频率显示元素
 * @param {HTMLElement} needleEl - 指针元素
 * @param {HTMLElement} statusLightEl - 状态灯元素
 */
export function updateTunerDisplay(result, stringNameEl, centsEl, frequencyEl, needleEl, statusLightEl) {
  if (!result) return;
  
  const { stringDisplay, stringName, detectedFreq, cents, status } = result;
  const color = getStatusColor(status);
  
  // 1. 更新弦名
  if (stringNameEl) {
    if (stringName === '--') {
      stringNameEl.textContent = '检测中...';
      stringNameEl.style.color = '#888';
    } else {
      stringNameEl.textContent = stringDisplay;
      stringNameEl.style.color = color;
    }
  }
  
  // 2. 更新频率显示
  if (frequencyEl) {
    if (detectedFreq > 0) {
      frequencyEl.textContent = detectedFreq.toFixed(1) + ' Hz';
      frequencyEl.style.color = color;
    } else {
      frequencyEl.textContent = '-- Hz';
      frequencyEl.style.color = '#888';
    }
  }
  
  // 3. 更新音分显示
  if (centsEl) {
    if (stringName !== '--' && detectedFreq > 0) {
      const sign = cents > 0 ? '+' : '';
      centsEl.textContent = `${sign}${cents} 音分`;
      centsEl.style.color = color;
    } else {
      centsEl.textContent = '--';
      centsEl.style.color = '#888';
    }
  }
  
  // 4. 更新指针位置（-50 到 +50 音分范围）
  if (needleEl) {
    const clampedCents = Math.max(-50, Math.min(50, cents));
    // 指针旋转角度：-50 音分 = -45 度，+50 音分 = +45 度
    const rotation = (clampedCents / 50) * 45;
    needleEl.style.transform = `rotate(${rotation}deg)`;
    needleEl.style.backgroundColor = color;
  }
  
  // 5. 更新状态灯颜色
  if (statusLightEl) {
    statusLightEl.style.backgroundColor = color;
    statusLightEl.style.boxShadow = `0 0 20px ${color}`;
  }
}

/**
 * 获取状态颜色
 * @param {string} status - 状态
 * @returns {string} 颜色代码
 */
function getStatusColor(status) {
  switch (status) {
    case 'in-tune': return '#2ed573';    // 绿色
    case 'close': return '#ffa502';      // 橙色
    case 'out-of-tune': return '#ff4757'; // 红色
    default: return '#888888';            // 灰色
  }
}

/**
 * 初始化调音器 UI 事件
 * @param {Function} onPlayTone - 播放参考音回调
 */
export function initTunerUI(onPlayTone) {
  // 6 弦参考音按钮
  for (let i = 0; i <= 5; i++) {
    const btn = document.getElementById(`btnPlayString${i}`);
    if (btn) {
      btn.addEventListener('click', () => {
        if (onPlayTone) onPlayTone(i);
      });
    }
  }
}
