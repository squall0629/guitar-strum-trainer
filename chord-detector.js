/**
 * 和弦检测器 - 基于 FFT 频谱分析和规则匹配
 * 
 * 功能：
 * 1. FFT 频谱分析 - 从音频数据中提取频率信息
 * 2. 峰值检测 - 识别主要音符频率
 * 3. 和弦匹配 - 与和弦库对比，找到最佳匹配
 * 4. 置信度评估 - 返回识别结果的可信度
 */

import { chordData, findChord, getChordSVG, getChordTabString } from './chord-library.js';
import { Note } from 'tonal';

/**
 * 和弦检测器类
 */
export class ChordDetector {
  /**
   * 构造函数
   * @param {AudioContext} audioContext - Web Audio API 上下文
   * @param {AnalyserNode} analyser - 音频分析器节点
   */
  constructor(audioContext, analyser) {
    this.audioContext = audioContext;
    this.analyser = analyser;
    this.chordLibrary = chordData;
    
    // 6 根吉他的基频范围 (Hz)
    this.stringRanges = [
      { name: 'E2', min: 80, max: 85, string: 6 },    // 6 弦
      { name: 'A2', min: 108, max: 112, string: 5 },  // 5 弦
      { name: 'D3', min: 145, max: 150, string: 4 },  // 4 弦
      { name: 'G3', min: 195, max: 200, string: 3 },  // 3 弦
      { name: 'B3', min: 245, max: 250, string: 2 },  // 2 弦
      { name: 'E4', min: 328, max: 332, string: 1 }   // 1 弦
    ];
    
    // 检测阈值 (可动态调整)
    this.threshold = 0.15;
    
    // 置信度阈值 (低于此值认为识别不可靠)
    this.confidenceThreshold = 0.65;
    
    // 噪音门限 (低于此能量视为噪音)
    this.noiseGate = 0.05;
  }
  
  /**
   * 设置检测阈值
   * @param {number} value - 阈值 (0-1)
   */
  setThreshold(value) {
    this.threshold = Math.max(0.05, Math.min(0.5, value));
  }
  
  /**
   * 从频域数据中提取 6 根弦的能量
   * @param {Uint8Array} freqData - FFT 频域数据
   * @returns {Array} 每根弦的能量值
   */
  extractStringEnergies(freqData) {
    const sampleRate = this.audioContext.sampleRate;
    const fftSize = freqData.length * 2; // FFT size 是数据长度的 2 倍
    const binSize = sampleRate / fftSize; // 每个 bin 代表的频率
    
    return this.stringRanges.map(range => {
      // 计算频率范围对应的 bin 索引
      const startBin = Math.floor(range.min / binSize);
      const endBin = Math.floor(range.max / binSize);
      
      // 确保索引在有效范围内
      const safeStart = Math.max(0, Math.min(startBin, freqData.length - 1));
      const safeEnd = Math.max(safeStart + 1, Math.min(endBin, freqData.length));
      
      // 计算该范围内的平均能量
      let energy = 0;
      for (let i = safeStart; i < safeEnd; i++) {
        energy += freqData[i];
      }
      energy /= (safeEnd - safeStart);
      
      // 归一化到 0-1 范围
      energy = energy / 255;
      
      return {
        name: range.name,
        string: range.string,
        energy: energy,
        minFreq: range.min,
        maxFreq: range.max
      };
    });
  }
  
  /**
   * 检测当前激活的琴弦
   * @param {Array} stringEnergies - 弦能量数组
   * @returns {Array} 布尔数组，表示每根弦是否激活
   */
  detectActiveStrings(stringEnergies) {
    return stringEnergies.map(s => {
      // 能量超过阈值且超过噪音门限
      return s.energy > this.threshold && s.energy > this.noiseGate;
    });
  }
  
  /**
   * 提取检测到的音符 (峰值检测)
   * @param {Uint8Array} freqData - FFT 频域数据
   * @returns {Array} 检测到的音符列表
   */
  extractDetectedNotes(freqData) {
    const sampleRate = this.audioContext.sampleRate;
    const fftSize = freqData.length * 2;
    const binSize = sampleRate / fftSize;
    
    const notes = [];
    const threshold = this.threshold * 255; // 转换回 0-255 范围
    
    // 查找所有峰值
    for (let i = 1; i < freqData.length - 1; i++) {
      // 检查是否是局部峰值
      if (freqData[i] > freqData[i - 1] && 
          freqData[i] > freqData[i + 1] && 
          freqData[i] > threshold) {
        
        const freq = i * binSize;
        
        // 只关心吉他频率范围 (80Hz - 1000Hz)
        if (freq >= 80 && freq <= 1000) {
          // 将频率转换为音名
          const note = this.freqToNote(freq);
          if (note) {
            notes.push({
              note: note,
              frequency: freq,
              amplitude: freqData[i] / 255,
              bin: i
            });
          }
        }
      }
    }
    
    // 按振幅排序，取前 6 个 (吉他最多 6 根弦)
    notes.sort((a, b) => b.amplitude - a.amplitude);
    return notes.slice(0, 6);
  }
  
  /**
   * 将频率转换为音名
   * @param {number} freq - 频率 (Hz)
   * @returns {string|null} 音名 (如 "C3", "E2")
   */
  freqToNote(freq) {
    try {
      // 使用 tonaljs 的 Note 模块
      // 计算与 A4 (440Hz) 的半音距离
      const semitonesFromA4 = 12 * Math.log2(freq / 440);
      const midiNumber = Math.round(semitonesFromA4) + 69; // A4 = MIDI 69
      
      // 转换为音名
      return Note.fromMidi(midiNumber);
    } catch (e) {
      return null;
    }
  }
  
  /**
   * 比较激活状态与和弦模板的匹配度
   * @param {Array} active - 当前激活状态 [true/false, ...]
   * @param {Array} template - 和弦模板 [0/1, ...]
   * @returns {number} 匹配度 (0-1)
   */
  compareTemplate(active, template) {
    let matches = 0;
    let weight = 0;
    
    for (let i = 0; i < 6; i++) {
      // 给低音弦更高的权重 (6 弦、5 弦更重要)
      const stringWeight = 6 - i;
      weight += stringWeight;
      
      const isActive = active[i];
      const shouldBeActive = template[i] === 1;
      
      if (isActive === shouldBeActive) {
        matches += stringWeight;
      } else {
        // 如果不匹配，扣分
        // 应该是发声但没检测到：可能是按弦不实
        // 应该不发声但检测到：可能是闷音不好
        if (shouldBeActive && !isActive) {
          matches -= stringWeight * 0.5;
        } else if (!shouldBeActive && isActive) {
          matches -= stringWeight * 0.3;
        }
      }
    }
    
    return Math.max(0, matches / weight);
  }
  
  /**
   * 基于音符的匹配 (更精确的方法)
   * @param {Array} detectedNotes - 检测到的音符列表
   * @param {object} chord - 和弦对象
   * @returns {number} 匹配度 (0-1)
   */
  compareNotes(detectedNotes, chord) {
    if (!chord.notes || chord.notes.length === 0) {
      return 0;
    }
    
    const expectedNotes = new Set(chord.notes);
    let matches = 0;
    let totalWeight = 0;
    
    detectedNotes.forEach(detected => {
      const noteName = detected.note;
      if (expectedNotes.has(noteName)) {
        // 按振幅加权
        matches += detected.amplitude;
        totalWeight += detected.amplitude;
      } else {
        // 检测到非和弦内音，可能是杂音
        totalWeight += detected.amplitude * 0.5;
      }
    });
    
    // 基础匹配度
    let baseScore = totalWeight > 0 ? matches / totalWeight : 0;
    
    // 考虑音符数量匹配
    const noteCountRatio = Math.min(1, detectedNotes.length / expectedNotes.size);
    
    // 综合评分
    return baseScore * 0.7 + noteCountRatio * 0.3;
  }
  
  /**
   * 检测和弦
   * @param {Uint8Array} freqData - FFT 频域数据
   * @returns {object|null} 识别结果 {chord, confidence, method}
   */
  detect(freqData) {
    // 1. 提取弦能量
    const stringEnergies = this.extractStringEnergies(freqData);
    
    // 2. 检测激活的弦
    const activeStrings = this.detectActiveStrings(stringEnergies);
    
    // 3. 提取检测到的音符
    const detectedNotes = this.extractDetectedNotes(freqData);
    
    // 4. 与和弦库匹配
    let bestMatch = null;
    let bestScore = 0;
    let bestMethod = 'template';
    
    for (const chord of this.chordLibrary) {
      // 方法 1: 模板匹配
      const templateScore = this.compareTemplate(activeStrings, chord.template);
      
      // 方法 2: 音符匹配
      const noteScore = this.compareNotes(detectedNotes, chord);
      
      // 综合两种方法的评分 (模板匹配权重更高，因为更稳定)
      const combinedScore = templateScore * 0.6 + noteScore * 0.4;
      
      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestMatch = chord;
        bestMethod = combinedScore > 0.8 ? 'both' : (templateScore > noteScore ? 'template' : 'note');
      }
    }
    
    // 5. 返回结果 (需超过置信度阈值)
    if (bestScore >= this.confidenceThreshold && bestMatch) {
      // 使用 chordictionary 生成 SVG 指法图
      let svg = null;
      try {
        svg = getChordSVG(bestMatch.name);
      } catch (e) {
        console.warn('[ChordDetector] SVG generation error:', e);
      }
      
      return {
        chord: bestMatch.name,
        confidence: Math.round(bestScore * 100) / 100,
        method: bestMethod,
        activeStrings: activeStrings,
        stringEnergies: stringEnergies.map(s => ({
          name: s.name,
          energy: Math.round(s.energy * 100) / 100
        })),
        detectedNotes: detectedNotes.map(n => ({
          note: n.note,
          amplitude: Math.round(n.amplitude * 100) / 100
        })),
        svg: svg,
        fingering: bestMatch.fingering,
        tab: getChordTabString(bestMatch)
      };
    }
    
    return null;
  }
  
  /**
   * 批量检测 (用于调试/校准)
   * @param {Array} freqDataArray - 多个频域数据样本
   * @returns {object} 统计结果
   */
  detectBatch(freqDataArray) {
    const results = {};
    
    freqDataArray.forEach(data => {
      const result = this.detect(data);
      if (result) {
        if (!results[result.chord]) {
          results[result.chord] = { count: 0, totalConfidence: 0 };
        }
        results[result.chord].count++;
        results[result.chord].totalConfidence += result.confidence;
      }
    });
    
    // 计算平均置信度
    Object.keys(results).forEach(chord => {
      results[chord].avgConfidence = 
        Math.round(results[chord].totalConfidence / results[chord].count * 100) / 100;
    });
    
    return results;
  }
}

/**
 * 和弦转换检测器
 * 追踪和弦变化和转换时间
 */
export class TransitionDetector {
  constructor() {
    this.lastChord = null;
    this.lastStrumTime = 0;
    this.transitions = [];
    this.strumCount = 0;
    this.correctChords = 0;
  }
  
  /**
   * 处理和弦检测结果
   * @param {string|null} detectedChord - 识别到的和弦
   * @param {string|null} expectedChord - 期望的和弦 (训练模式下)
   * @param {number} timestamp - 时间戳 (毫秒)
   */
  onChordDetected(detectedChord, expectedChord = null, timestamp) {
    this.strumCount++;
    
    // 检查是否准确
    if (expectedChord && detectedChord === expectedChord) {
      this.correctChords++;
    }
    
    // 检测和弦转换
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
   * 获取平均转换时间
   * @returns {number} 平均转换时间 (ms)
   */
  getAverageTransitionTime() {
    if (this.transitions.length === 0) return 0;
    const sum = this.transitions.reduce((acc, t) => acc + t.time, 0);
    return Math.round(sum / this.transitions.length);
  }
  
  /**
   * 获取最慢的转换
   * @returns {object|null} 最慢的转换信息
   */
  getSlowestTransition() {
    if (this.transitions.length === 0) return null;
    return this.transitions.reduce((max, t) => t.time > max.time ? t : max);
  }
  
  /**
   * 获取最快的转换
   * @returns {object|null} 最快的转换信息
   */
  getFastestTransition() {
    if (this.transitions.length === 0) return null;
    return this.transitions.reduce((min, t) => t.time < min.time ? t : min);
  }
  
  /**
   * 计算转换流畅度评分
   * @param {number} targetTime - 目标转换时间 (ms)
   * @returns {number} 评分 (0-100)
   */
  calculateTransitionScore(targetTime = 500) {
    if (this.transitions.length === 0) return 100;
    
    const avgTime = this.getAverageTransitionTime();
    const deviation = Math.abs(avgTime - targetTime) / targetTime;
    
    // 高斯衰减评分
    const sigma = 0.3; // 30% 容差
    const score = 100 * Math.exp(-(deviation * deviation) / (2 * sigma * sigma));
    
    return Math.round(Math.max(0, Math.min(100, score)));
  }
  
  /**
   * 获取和弦准确率
   * @returns {number} 准确率 (0-100)
   */
  getAccuracy() {
    if (this.strumCount === 0) return 0;
    return Math.round((this.correctChords / this.strumCount) * 100);
  }
  
  /**
   * 重置检测器
   */
  reset() {
    this.lastChord = null;
    this.lastStrumTime = 0;
    this.transitions = [];
    this.strumCount = 0;
    this.correctChords = 0;
  }
  
  /**
   * 获取统计数据
   * @returns {object} 统计信息
   */
  getStats() {
    return {
      strumCount: this.strumCount,
      correctChords: this.correctChords,
      accuracy: this.getAccuracy(),
      transitionCount: this.transitions.length,
      avgTransitionTime: this.getAverageTransitionTime(),
      fastestTransition: this.getFastestTransition(),
      slowestTransition: this.getSlowestTransition()
    };
  }
}

export default { ChordDetector, TransitionDetector };
