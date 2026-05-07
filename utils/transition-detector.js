// 统一的和弦转换检测器 - 从 chord-detector.js 和 chord-training.js 合并
// 合并了两者的接口，提供完整的方法集

/**
 * 和弦转换检测器
 * 用于检测和弦转换时间、计算转换流畅度评分、统计准确率等
 */
export class TransitionDetector {
  constructor() {
    // Core state
    this.lastChord = null;
    this.lastStrumTime = 0;
    this.transitions = [];
    this.strumCount = 0;
    this.correctChords = 0;
    
    // Compatibility with chord-training.js version
    this.transitionCount = 0;
    this.transitionTimes = [];
    this.lastChangeTime = 0;
    this.expectedChord = null;
    this.detectedChord = null;
    this.changeDetected = false;
  }

  /**
   * 处理和弦检测结果
   * @param {string} detectedChord - 检测到的和弦
   * @param {string} expectedChord - 期望的和弦
   * @param {number} timestamp - 时间戳
   */
  onChordDetected(detectedChord, expectedChord, timestamp) {
    if (expectedChord === undefined) expectedChord = null;
    
    this.strumCount++;
    
    if (expectedChord && detectedChord === expectedChord) {
      this.correctChords++;
    }
    
    if (this.lastChord && detectedChord && detectedChord !== this.lastChord) {
      const transitionTime = timestamp - this.lastStrumTime;
      
      this.transitions.push({
        from: this.lastChord,
        to: detectedChord,
        time: transitionTime,
        timestamp: timestamp,
        expected: expectedChord
      });
    }
    
    this.lastChord = detectedChord;
    this.lastStrumTime = timestamp;
  }

  /**
   * 设置期望和弦 (chord-training.js 兼容)
   * @param {string} chord - 期望和弦
   */
  setExpectedChord(chord) {
    this.expectedChord = chord;
  }

  /**
   * 获取平均转换时间
   * @returns {number} 平均转换时间（毫秒）
   */
  getAverageTransitionTime() {
    if (!this.transitions || this.transitions.length === 0) return 0;
    const validTransitions = this.transitions.filter(t => 
      t && typeof t.time === 'number' && !isNaN(t.time) && isFinite(t.time)
    );
    if (validTransitions.length === 0) return 0;
    const sum = validTransitions.reduce((acc, t) => acc + t.time, 0);
    return Math.round(sum / validTransitions.length);
  }

  /**
   * 获取最慢转换
   * @returns {object|null} 最慢的转换记录
   */
  getSlowestTransition() {
    if (this.transitions.length === 0) return null;
    return this.transitions.reduce((max, t) => t.time > max.time ? t : max);
  }

  /**
   * 获取最快转换
   * @returns {object|null} 最快的转换记录
   */
  getFastestTransition() {
    if (this.transitions.length === 0) return null;
    return this.transitions.reduce((min, t) => t.time < min.time ? t : min);
  }

  /**
   * 计算转换流畅度评分
   * @param {number} targetTime - 目标转换时间（毫秒），默认 500ms
   * @returns {number} 流畅度评分 (0-100)
   */
  calculateTransitionScore(targetTime = 500) {
    if (this.transitions.length === 0) return 100;
    
    const avgTime = this.getAverageTransitionTime();
    const deviation = Math.abs(avgTime - targetTime) / targetTime;
    
    const sigma = 0.3;
    const score = 100 * Math.exp(-(deviation * deviation) / (2 * sigma * sigma));
    
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * 获取准确率
   * @returns {number} 准确率 (0-100)
   */
  getAccuracy() {
    if (this.strumCount === 0) return 0;
    return Math.round((this.correctChords / this.strumCount) * 100);
  }

  /**
   * 重置检测器状态
   */
  reset() {
    this.lastChord = null;
    this.lastStrumTime = 0;
    this.transitions = [];
    this.strumCount = 0;
    this.correctChords = 0;
    
    // chord-training.js compatibility
    this.transitionCount = 0;
    this.transitionTimes = [];
    this.lastChangeTime = 0;
    this.expectedChord = null;
    this.detectedChord = null;
    this.changeDetected = false;
  }

  /**
   * 获取完整统计数据
   * @returns {object} 统计数据对象
   */
  getStats() {
    // Merge both interface styles
    const baseStats = {
      strumCount: this.strumCount,
      correctChords: this.correctChords,
      accuracy: this.getAccuracy(),
      transitionCount: this.transitions.length,
      avgTransitionTime: this.getAverageTransitionTime(),
      fastestTransition: this.getFastestTransition(),
      slowestTransition: this.getSlowestTransition(),
      transitions: this.transitions
    };
    
    // chord-training.js style compatibility
    if (this.transitionTimes.length === 0) {
      return { transitionCount: 0, avgTransitionTime: 0, minTransitionTime: 0, maxTransitionTime: 0, ...baseStats };
    }
    const sum = this.transitionTimes.reduce((a, b) => a + b, 0);
    const avg = sum / this.transitionTimes.length;
    const min = Math.min(...this.transitionTimes);
    const max = Math.max(...this.transitionTimes);
    
    return {
      transitionCount: this.transitionCount,
      avgTransitionTime: avg,
      minTransitionTime: min,
      maxTransitionTime: max,
      ...baseStats
    };
  }
}