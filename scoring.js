// 吉他扫弦练习助手 - 评分计算模块

/**
 * 计算稳定性评分（基于历史数据）
 * @param {Array} history - 历史评分数组
 * @returns {number} 稳定性评分 (0-100)
 */
export function calculateStabilityScore(history) {
  const MIN_HISTORY = 10;
  if (history.length < MIN_HISTORY) return 0;  // 至少 10 个小节才能计算
  
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
 * 检查是否需要更新小节评分
 */
export function checkMeasureUpdate(isListening, currentMeasureStartTime, currentMeasureStrums, lastScoredMeasureEnd,
                                   currentBPM, getActiveRhythm, currentRhythm, calculateRhythmScore, calculateToneScore,
                                   calculateDynamicsScore, measureHistory, MAX_HISTORY, lastMeasureScores,
                                   rhythmScoreEl, toneScoreEl, dynamicsScoreEl, totalScoreEl,
                                   rhythmRingEl, toneRingEl, dynamicsRingEl, totalRingEl, updateScoreRing,
                                   updateStabilityScores, DEBUG = false) {
  if (!isListening) return;
  
  const now = Date.now();
  const pattern = getActiveRhythm(currentRhythm);
  const measureDuration = getMeasureDuration(currentBPM, pattern);
  const timeInMeasure = now - currentMeasureStartTime;
  
  // 调试日志
  console.log('[DEBUG checkMeasureUpdate] isListening:', isListening, 'timeInMeasure:', timeInMeasure, 'measureDuration:', measureDuration, 'strums:', currentMeasureStrums.length);
  
  // 防止重复评分：检查是否已经对当前小节评分过
  if (lastScoredMeasureEnd > 0 && now - lastScoredMeasureEnd < measureDuration * 0.5) {
    console.log('[DEBUG] 跳过：防止重复评分');
    return;
  }
  
  // 如果当前小节已结束，计算评分并开始新小节
  if (timeInMeasure >= measureDuration && currentMeasureStrums.length >= 1) {
    console.log('[DEBUG] 开始评分！小节时长:', measureDuration, '扫弦数:', currentMeasureStrums.length);
    // 计算小节评分
    const rhythmScore = calculateRhythmScore(currentMeasureStrums, pattern, currentBPM);
    const toneScore = calculateToneScore(currentMeasureStrums);
    const dynamicsScore = calculateDynamicsScore(currentMeasureStrums, pattern);
    
    // 计算总分
    const totalScore = Math.round(
      rhythmScore * 0.5 + 
      toneScore * 0.3 + 
      dynamicsScore * 0.2
    );
    
    // 保存评分
    lastMeasureScores.rhythm = rhythmScore;
    lastMeasureScores.tone = toneScore;
    lastMeasureScores.dynamics = dynamicsScore;
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
    totalScoreEl.textContent = totalScore;
    
    // 更新评分环颜色
    updateScoreRing(rhythmRingEl, rhythmScoreEl, rhythmScore);
    updateScoreRing(toneRingEl, toneScoreEl, toneScore);
    updateScoreRing(dynamicsRingEl, dynamicsScoreEl, dynamicsScore);
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
 */
export function updateScores(lastMeasureScores, rhythmScoreEl, toneScoreEl, dynamicsScoreEl, totalScoreEl,
                            checkMeasureUpdateFn) {
  // 显示上次小节的评分（保持显示，不频繁变化）
  rhythmScoreEl.textContent = lastMeasureScores.rhythm > 0 ? lastMeasureScores.rhythm : '--';
  toneScoreEl.textContent = lastMeasureScores.tone > 0 ? lastMeasureScores.tone : '--';
  dynamicsScoreEl.textContent = lastMeasureScores.dynamics > 0 ? lastMeasureScores.dynamics : '--';
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
  
  // 计算各维度稳定性
  const rhythmStability = calculateStabilityScoreFn(measureHistory.rhythm);
  const toneStability = calculateStabilityScoreFn(measureHistory.tone);
  const dynamicsStability = calculateStabilityScoreFn(measureHistory.dynamics);
  
  if (DEBUG) {
    console.log('[DEBUG 稳定性评分] 历史数据 - 节奏:', measureHistory.rhythm, '音色:', measureHistory.tone, '强弱:', measureHistory.dynamics);
    console.log('[DEBUG 稳定性评分] 计算结果 - 节奏:', rhythmStability, '音色:', toneStability, '强弱:', dynamicsStability);
  }
  
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
