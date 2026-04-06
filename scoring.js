// 吉他扫弦练习助手 - 评分计算模块

/**
 * 计算稳定性评分（基于历史数据）
 * @param {Array} history - 历史评分数组
 * @returns {number} 稳定性评分 (0-100)
 */
export function calculateStabilityScore(history) {
  const MIN_HISTORY = 4;  // 至少 4 个小节才能计算（近 4 个小节）
  if (history.length < MIN_HISTORY) return 0;
  
  // 1. 计算平均分
  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  if (avg === 0) return 0;
  
  // 2. 计算标准差（波动程度）
  const variance = history.reduce((sum, score) => {
    return sum + Math.pow(score - avg, 2);
  }, 0) / history.length;
  
  const stdDev = Math.sqrt(variance);
  
  // 3. 计算变异系数 CV
  const cv = stdDev / avg;
  
  // 4. 根据 CV 评分（CV 越小越稳定）
  let score;
  if (cv < 0.10) {
    score = 90 + (0.10 - cv) * 100;  // 90-100 分（非常稳定）
  } else if (cv < 0.20) {
    score = 70 + (0.20 - cv) * 200;  // 70-90 分（较稳定）
  } else if (cv < 0.30) {
    score = 50 + (0.30 - cv) * 200;  // 50-70 分（波动大）
  } else {
    score = Math.max(0, 50 - (cv - 0.30) * 100);  // 0-50 分（很不稳定）
  }
  
  return Math.round(score);
}

/**
 * 计算小节时长（毫秒）
 * @param {number} currentBPM - 当前 BPM
 * @param {object} pattern - 节奏型对象
 * @returns {number} 小节时长（毫秒）
 */
export function getMeasureDuration(currentBPM, pattern) {
  if (!pattern) return 4000;  // 默认 4 秒
  
  // 计算节奏型的总拍数
  const totalBeats = pattern.beats || 4;
  
  // 计算一拍时长（毫秒）
  const beatDuration = (60 / currentBPM) * 1000;
  
  // 小节时长 = 拍数 × 一拍时长
  return totalBeats * beatDuration;
}

/**
 * @typedef {Object} MeasureUpdateConfig
 * @property {boolean} isListening - 是否正在监听
 * @property {number} currentMeasureStartTime - 当前小节开始时间
 * @property {Array} currentMeasureStrums - 当前小节扫弦数据
 * @property {number} lastScoredMeasureEnd - 上次评分小节结束时间
 * @property {number} currentBPM - 当前 BPM
 * @property {Function} getActiveRhythm - 获取节奏型函数
 * @property {number} currentRhythm - 当前节奏型索引
 * @property {Function} calculateRhythmScore - 节奏评分函数
 * @property {Function} calculateToneScore - 音色评分函数
 * @property {Function} calculateDynamicsScore - 强弱评分函数
 * @property {Function} calculateTransitionScore - 转换评分函数
 * @property {Object} transitionDetector - 转换检测器实例
 * @property {Object} measureHistory - 评分历史对象
 * @property {number} MAX_HISTORY - 最大历史记录数
 * @property {Object} lastMeasureScores - 上次评分结果
 * @property {HTMLElement} rhythmScoreEl - 节奏评分元素
 * @property {HTMLElement} toneScoreEl - 音色评分元素
 * @property {HTMLElement} dynamicsScoreEl - 强弱评分元素
 * @property {HTMLElement} transitionScoreEl - 转换评分元素
 * @property {HTMLElement} totalScoreEl - 总分元素
 * @property {HTMLElement} rhythmRingEl - 节奏评分环
 * @property {HTMLElement} toneRingEl - 音色评分环
 * @property {HTMLElement} dynamicsRingEl - 强弱评分环
 * @property {HTMLElement} transitionRingEl - 转换评分环
 * @property {HTMLElement} totalRingEl - 总分环
 * @property {Function} updateScoreRing - 更新评分环函数
 * @property {Function} updateStabilityScores - 更新稳定性评分函数
 * @property {boolean} DEBUG - 调试模式
 */

/**
 * 计算转换熟练度评分
 * @param {Array} currentMeasureStrums - 当前小节扫弦数据
 * @param {Object} transitionDetector - 转换检测器实例
 * @param {number} currentBPM - 当前 BPM
 * @param {boolean} DEBUG - 调试模式
 * @returns {number} 转换评分 (0-100)
 */
export function calculateTransitionScore(currentMeasureStrums, transitionDetector, currentBPM, DEBUG = false) {
  if (!transitionDetector) return 0;
  
  const stats = transitionDetector.getStats();
  if (stats.transitionCount === 0) return 0;
  
  // 1. 转换时间评分（基于平均转换时间与目标时间的偏差）
  // 目标转换时间：300ms（优秀）- 800ms（及格）
  const targetTime = 300; // 理想转换时间 (ms)
  const maxTime = 800;    // 最大可接受转换时间 (ms)
  const avgTime = stats.avgTransitionTime;
  
  let timeScore;
  if (avgTime <= targetTime) {
    timeScore = 100;
  } else if (avgTime >= maxTime) {
    timeScore = 0;
  } else {
    // 线性衰减
    timeScore = 100 * (1 - (avgTime - targetTime) / (maxTime - targetTime));
  }
  
  // 2. 转换准确率评分（基于正确转换的比例）
  // 注意：这里使用 transitionCount 作为已完成的转换次数
  // 如果需要准确率，需要在 TransitionDetector 中添加准确/错误计数
  const accuracyScore = 100; // 暂时假设所有转换都是正确的
  
  // 3. 综合评分（时间 70% + 准确率 30%）
  const score = Math.round(timeScore * 0.7 + accuracyScore * 0.3);
  
  if (DEBUG) {
    console.log('[DEBUG 转换评分] 转换次数:', stats.transitionCount, '平均时间:', Math.round(avgTime) + 'ms', '时间分:', Math.round(timeScore), '准确率分:', accuracyScore, '总分:', score);
  }
  
  return Math.min(100, Math.max(0, score));
}

/**
 * 检查是否需要更新小节评分
 * @param {MeasureUpdateConfig} config - 配置对象
 * @returns {Object|undefined} 评分结果对象
 */
export function checkMeasureUpdate(config) {
  const {
    isListening,
    currentBPM,
    getActiveRhythm,
    currentRhythm,
    calculateRhythmScore,
    calculateToneScore,
    calculateDynamicsScore,
    calculateTransitionScore,
    transitionDetector,
    measureHistory,
    MAX_HISTORY,
    lastMeasureScores,
    rhythmScoreEl,
    toneScoreEl,
    dynamicsScoreEl,
    transitionScoreEl,
    totalScoreEl,
    rhythmRingEl,
    toneRingEl,
    dynamicsRingEl,
    transitionRingEl,
    totalRingEl,
    updateScoreRing,
    updateStabilityScores,
    DEBUG = false
  } = config;
  
  // 需要修改的变量用 let 声明
  let { currentMeasureStartTime, currentMeasureStrums, lastScoredMeasureEnd } = config;

  if (!isListening) return;

  const now = Date.now();
  const pattern = getActiveRhythm(currentRhythm);
  const measureDuration = getMeasureDuration(currentBPM, pattern);
  const timeInMeasure = now - currentMeasureStartTime;

  // 防止重复评分：检查是否已经对当前小节评分过
  if (lastScoredMeasureEnd > 0 && now - lastScoredMeasureEnd < measureDuration * 0.5) {
    if (DEBUG) console.log('[DEBUG] 跳过：防止重复评分');
    return;
  }

  // 如果当前小节已结束，计算评分并开始新小节
  if (timeInMeasure >= measureDuration && currentMeasureStrums.length >= 1) {
    if (!pattern || !pattern.pattern) {
      if (DEBUG) console.log('[DEBUG] 跳过评分：pattern 为空');
      return;
    }
    if (DEBUG) console.log('[DEBUG] 开始评分！小节时长:', measureDuration, '扫弦数:', currentMeasureStrums.length);
    
    // 计算小节评分
    const rhythmScore = calculateRhythmScore(currentMeasureStrums, pattern, currentBPM);
    const toneScore = calculateToneScore(currentMeasureStrums);
    const dynamicsScore = calculateDynamicsScore(currentMeasureStrums, pattern);
    const transitionScore = calculateTransitionScore(currentMeasureStrums, transitionDetector, currentBPM, DEBUG);

    // 计算总分（新权重：节奏 40% + 音色 25% + 强弱 15% + 转换 20%）
    const totalScore = Math.round(
      rhythmScore * 0.4 +
      toneScore * 0.25 +
      dynamicsScore * 0.15 +
      transitionScore * 0.2
    );

    // 保存评分
    lastMeasureScores.rhythm = rhythmScore;
    lastMeasureScores.tone = toneScore;
    lastMeasureScores.dynamics = dynamicsScore;
    lastMeasureScores.transition = transitionScore;
    lastMeasureScores.total = totalScore;

    // 添加到历史记录
    measureHistory.rhythm.push(rhythmScore);
    measureHistory.tone.push(toneScore);
    measureHistory.dynamics.push(dynamicsScore);

    // 保持最近 MAX_HISTORY 个小节
    if (measureHistory.rhythm.length > MAX_HISTORY) measureHistory.rhythm.shift();
    if (measureHistory.tone.length > MAX_HISTORY) measureHistory.tone.shift();
    if (measureHistory.dynamics.length > MAX_HISTORY) measureHistory.dynamics.shift();

    // 更新显示
    rhythmScoreEl.textContent = rhythmScore;
    toneScoreEl.textContent = toneScore;
    dynamicsScoreEl.textContent = dynamicsScore;
    if (transitionScoreEl) transitionScoreEl.textContent = transitionScore > 0 ? transitionScore : '--';
    totalScoreEl.textContent = totalScore;

    // 更新评分环颜色
    updateScoreRing(rhythmRingEl, rhythmScoreEl, rhythmScore);
    updateScoreRing(toneRingEl, toneScoreEl, toneScore);
    updateScoreRing(dynamicsRingEl, dynamicsScoreEl, dynamicsScore);
    if (transitionRingEl) updateScoreRing(transitionRingEl, transitionScoreEl, transitionScore);
    updateScoreRing(totalRingEl, totalScoreEl, totalScore);

    // 更新历史稳定性评分
    if (updateStabilityScores) {
      updateStabilityScores(measureHistory, calculateStabilityScore, DEBUG);
    }

    if (DEBUG) {
      console.log('[DEBUG 小节评分] 小节时长:', measureDuration, 'ms, 扫弦数:', currentMeasureStrums.length, '得分:', totalScore);
    }

    // 记录评分时间戳，防止重复评分
    lastScoredMeasureEnd = now;

    // 开始新小节
    currentMeasureStartTime = now;
    currentMeasureStrums = [];

    return {
      rhythmScore,
      toneScore,
      dynamicsScore,
      transitionScore,
      totalScore,
      lastMeasureScores,
      lastScoredMeasureEnd,
      currentMeasureStartTime,
      currentMeasureStrums
    };
  }
}

/**
 * 更新评分显示
 * @param {Object} lastMeasureScores - 上次评分结果
 * @param {HTMLElement} rhythmScoreEl - 节奏评分元素
 * @param {HTMLElement} toneScoreEl - 音色评分元素
 * @param {HTMLElement} dynamicsScoreEl - 强弱评分元素
 * @param {HTMLElement} transitionScoreEl - 转换评分元素
 * @param {HTMLElement} totalScoreEl - 总分元素
 * @param {Function} checkMeasureUpdateFn - 检查小节更新函数
 */
export function updateScores(lastMeasureScores, rhythmScoreEl, toneScoreEl, dynamicsScoreEl, transitionScoreEl, totalScoreEl,
                            checkMeasureUpdateFn) {
  // 显示上次小节的评分（保持显示，不频繁变化）
  rhythmScoreEl.textContent = lastMeasureScores.rhythm > 0 ? lastMeasureScores.rhythm : '--';
  toneScoreEl.textContent = lastMeasureScores.tone > 0 ? lastMeasureScores.tone : '--';
  dynamicsScoreEl.textContent = lastMeasureScores.dynamics > 0 ? lastMeasureScores.dynamics : '--';
  if (transitionScoreEl) transitionScoreEl.textContent = (lastMeasureScores.transition || 0) > 0 ? lastMeasureScores.transition : '--';
  totalScoreEl.textContent = lastMeasureScores.total > 0 ? lastMeasureScores.total : '--';
  
  // 检查是否需要更新小节评分
  if (checkMeasureUpdateFn) {
    checkMeasureUpdateFn();
  }
}

/**
 * 改进的节奏评分算法 - 基于稳定度（考虑节奏型）
 * @param {Array} strums - 扫弦数据数组
 * @param {object} pattern - 节奏型对象
 * @param {number} currentBPM - 当前 BPM
 * @returns {number} 节奏评分 (0-100)
 */
export function calculateRhythmScore(strums, pattern, currentBPM, DEBUG = false) {
  if (strums.length < 2) return 0;
  if (!pattern || !pattern.pattern) return 50;
  
  // 1. 根据 BPM 缩放理论时值（节奏型定义基于 120BPM）
  const bpmRatio = 120 / currentBPM;
  const expectedPattern = pattern.pattern.map(x => x * bpmRatio);
  const patternLength = expectedPattern.length;
  
  if (DEBUG) {
    console.log('[DEBUG 节奏型] BPM:', currentBPM, 'pattern:', pattern.name, 'expectedPattern:', expectedPattern.map(x => Math.round(x)));
  }
  
  // 2. 按节奏型位置分组
  const groups = Array.from({ length: patternLength }, () => []);
  for (let i = 1; i < strums.length; i++) {
    const groupIndex = (i - 1) % patternLength;
    groups[groupIndex].push(strums[i].interval);
  }
  
  // 3. 每组单独计算 CV
  const cvs = [];
  const groupStats = [];
  for (let i = 0; i < patternLength; i++) {
    if (groups[i].length < 1) {
      cvs.push(0);
      groupStats.push({ avg: 0, stdDev: 0, cv: 0, count: groups[i].length });
      continue;
    }
    
    const avg = groups[i].reduce((a, b) => a + b, 0) / groups[i].length;
    const variance = groups[i].reduce((sum, interval) => sum + Math.pow(interval - avg, 2), 0) / groups[i].length;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? stdDev / avg : 0;
    
    cvs.push(cv);
    groupStats.push({ avg, stdDev, cv, count: groups[i].length });
  }
  
  // 4. 计算平均 CV（有 1 个样本就算有效，没有样本的组排除）
  const validCvs = cvs.filter((cv, i) => groupStats[i].count >= 1);
  if (validCvs.length === 0) return 50; // 没有数据时给中等分数
  
  const avgCV = validCvs.reduce((a, b) => a + b, 0) / validCvs.length;
  
  // 5. 根据平均 CV 评分
  let score;
  if (avgCV < 0.10) {
    score = 90 + (0.10 - avgCV) * 100;  // 90-100 分
  } else if (avgCV < 0.20) {
    score = 70 + (0.20 - avgCV) * 200;  // 70-90 分
  } else if (avgCV < 0.30) {
    score = 60 + (0.30 - avgCV) * 100;  // 60-70 分
  } else {
    score = Math.max(0, 60 - (avgCV - 0.30) * 100);  // 0-60 分
  }
  
  if (DEBUG) {
    console.log('[DEBUG 节奏稳定度] 分组统计:', groupStats.map((s, i) => `位置${i}: avg=${Math.round(s.avg)}ms, cv=${(s.cv * 100).toFixed(1)}%`).join(' | '));
    console.log('[DEBUG 节奏稳定度] 平均 CV:', (avgCV * 100).toFixed(1) + '%, 得分:', Math.round(score));
  }
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * 改进的音色评分算法
 * @param {Array} strums - 扫弦数据数组
 * @returns {number} 音色评分 (0-100)
 */
export function calculateToneScore(strums, DEBUG = false) {
  if (strums.length === 0) {
    if (DEBUG) console.log('[DEBUG calculateToneScore] No strums, returning 0');
    return 0;
  }
  
  let totalScore = 0;
  const scores = [];
  
  for (const strum of strums) {
    const tone = strum.tone;
    
    // 使用范围评分而非单点评分
    // 理想范围：60-200 (更宽容)
    const idealMin = 60;
    const idealMax = 200;
    const idealCenter = (idealMin + idealMax) / 2;
    const range = (idealMax - idealMin) / 2;
    
    let score;
    if (tone >= idealMin && tone <= idealMax) {
      // 在理想范围内，根据距离中心的远近评分
      const distanceFromCenter = Math.abs(tone - idealCenter);
      score = 100 - (distanceFromCenter / range) * 40; // 范围内最低 60 分
    } else {
      // 在理想范围外，线性衰减
      const distanceOutside = tone < idealMin ? idealMin - tone : tone - idealMax;
      score = Math.max(0, 60 - (distanceOutside / 5) * 60);
    }
    scores.push(score);
    totalScore += score;
  }
  
  const result = Math.round(totalScore / strums.length);
  if (DEBUG) {
    console.log('[DEBUG calculateToneScore] strums:', strums.length, 'tones:', strums.map(s => s.tone), 'individualScores:', scores.map(s => Math.round(s)), 'result:', result);
  }
  return result;
}

/**
 * 改进的强弱评分算法
 * @param {Array} strums - 扫弦数据数组
 * @param {object} pattern - 节奏型对象
 * @returns {number} 强弱评分 (0-100)
 */
export function calculateDynamicsScore(strums, pattern) {
  if (strums.length < 2) return 0;
  if (!pattern || !pattern.demo || !pattern.pattern) return 50;
  
  const amplitudes = strums.map(s => s.amplitude);
  
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

/**
 * 考虑重音模式的强弱评分
 */
function calculateAccentAwareDynamics(strums, pattern) {
  let totalScore = 0;
  const count = Math.min(strums.length, pattern.pattern.length * 2);
  
  for (let i = 0; i < count; i++) {
    const patternIndex = i % pattern.pattern.length;
    const expectedDirection = pattern.demo[patternIndex];
    const actualAmp = strums[i].amplitude;
    
    // 下扫通常应该更强
    const expectedStrong = expectedDirection === 'D';
    
    // 计算相对于平均值的偏差
    const avgAmp = strums.slice(0, count).reduce((a, b) => a + b.amplitude, 0) / count;
    const isActuallyStrong = actualAmp > avgAmp;
    
    // 如果预期和实际一致，根据偏差程度评分
    if (expectedStrong === isActuallyStrong) {
      const deviation = Math.abs(actualAmp - avgAmp) / avgAmp;
      totalScore += Math.max(80, 100 - deviation * 50);
    } else {
      // 不一致时，根据偏差程度扣分
      const deviation = Math.abs(actualAmp - avgAmp) / avgAmp;
      totalScore += Math.max(30, 70 - deviation * 100);
    }
  }
  
  return Math.round(Math.max(0, Math.min(100, totalScore / count)));
}

/**
 * 均匀节奏型的强弱评分
 */
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
  let dynamicsBonus = 0;
  if (avgAmplitude > 0.2) {
    dynamicsBonus = 10; // 力度充足的奖励
  } else if (avgAmplitude < 0.1) {
    dynamicsBonus = -15; // 力度不足的惩罚
  }
  
  return Math.round(Math.max(0, Math.min(100, score + dynamicsBonus)));
}

/**
 * 更新历史稳定性评分
 */
export function updateStabilityScores(measureHistory, calculateStabilityScoreFn, DEBUG = false) {
  const rhythmStabilityEl = document.getElementById('rhythmStabilityScore');
  const toneStabilityEl = document.getElementById('toneStabilityScore');
  const dynamicsStabilityEl = document.getElementById('dynamicsStabilityScore');
  const overallStabilityEl = document.getElementById('overallStabilityScore');
  
  // 调试日志：显示历史数据长度
  if (DEBUG) console.log('[DEBUG 稳定性] 历史数据长度 - 节奏:', measureHistory.rhythm.length, '音色:', measureHistory.tone.length, '强弱:', measureHistory.dynamics.length);
  
  // 计算各维度稳定性
  const rhythmStability = calculateStabilityScoreFn(measureHistory.rhythm);
  const toneStability = calculateStabilityScoreFn(measureHistory.tone);
  const dynamicsStability = calculateStabilityScoreFn(measureHistory.dynamics);
  
  if (DEBUG) console.log('[DEBUG 稳定性] 计算结果 - 节奏:', rhythmStability, '音色:', toneStability, '强弱:', dynamicsStability);
  
  // 综合稳定性（三个维度的平均）
  const overallStability = Math.round((rhythmStability + toneStability + dynamicsStability) / 3);
  
  // 更新显示
  if (rhythmStabilityEl) rhythmStabilityEl.textContent = rhythmStability > 0 ? rhythmStability : '--';
  if (toneStabilityEl) toneStabilityEl.textContent = toneStability > 0 ? toneStability : '--';
  if (dynamicsStabilityEl) dynamicsStabilityEl.textContent = dynamicsStability > 0 ? dynamicsStability : '--';
  if (overallStabilityEl) overallStabilityEl.textContent = overallStability > 0 ? overallStability : '--';
  
  if (measureHistory.rhythm.length >= 10 && DEBUG) {
    console.log('[DEBUG 历史稳定性] 节奏:', rhythmStability, '音色:', toneStability, '强弱:', dynamicsStability, '综合:', overallStability);
  }
}
