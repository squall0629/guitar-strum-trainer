/**
 * 和弦检测器 - 基于 tonaljs chord-detect + 自研 FFT 分析
 * 
 * 技术方案：
 * 1. 音频分析：自己实现（Web Audio API + FFT）
 * 2. 和弦识别：tonaljs (通过 CDN 引入，全局变量 Tonal)
 * 3. 指法图：chord-library.js
 * 
 * 流程：
 * FFT 分析 → 峰值检测 → 提取音符 → tonaljs 识别和弦 → chord-library 获取指法
 */

// 使用全局 Tonal 对象（通过 CDN 引入）
const ChordDetect = Tonal.ChordDetect;
const Note = Tonal.Note;

/**
 * 和弦检测器 - ES6 Class
 */
class ChordDetector {
  /**
   * @param {AudioContext} audioContext - Web Audio API 上下文
   * @param {AnalyserNode} analyser - 音频分析器节点
   */
  constructor(audioContext, analyser) {
    this.audioContext = audioContext;
    this.analyser = analyser;
    
    // 吉他 6 根弦的基频范围 (Hz)
    this.stringRanges = [
      { name: 'E2', min: 80, max: 85, string: 6 },
      { name: 'A2', min: 108, max: 112, string: 5 },
      { name: 'D3', min: 145, max: 150, string: 4 },
      { name: 'G3', min: 195, max: 200, string: 3 },
      { name: 'B3', min: 245, max: 250, string: 2 },
      { name: 'E4', min: 328, max: 332, string: 1 }
    ];
    
    // 检测阈值
    this.threshold = 0.15;
    
    // 置信度阈值
    this.confidenceThreshold = 0.65;
    
    // 噪音门限
    this.noiseGate = 0.05;
    
    // 基础音高参考 (A4 = 440Hz)
    this.A4 = 440;
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
    const fftSize = freqData.length * 2;
    const binSize = sampleRate / fftSize;
    
    return this.stringRanges.map(range => {
      const startBin = Math.floor(range.min / binSize);
      const endBin = Math.floor(range.max / binSize);
      
      const safeStart = Math.max(0, Math.min(startBin, freqData.length - 1));
      const safeEnd = Math.max(safeStart + 1, Math.min(endBin, freqData.length));
      
      let energy = 0;
      for (let i = safeStart; i < safeEnd; i++) {
        energy += freqData[i];
      }
      energy /= (safeEnd - safeStart);
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
   * 峰值检测 - 提取主要音符频率
   * @param {Uint8Array} freqData - FFT 频域数据
   * @returns {Array} 检测到的音符列表
   */
  detectPeaks(freqData) {
    const sampleRate = this.audioContext.sampleRate;
    const fftSize = freqData.length * 2;
    const binSize = sampleRate / fftSize;
    
    const peaks = [];
    const threshold = this.threshold * 255;
    
    // 查找局部峰值
    for (let i = 1; i < freqData.length - 1; i++) {
      if (freqData[i] > freqData[i - 1] && 
          freqData[i] > freqData[i + 1] && 
          freqData[i] > threshold) {
        
        const freq = i * binSize;
        
        // 只关心吉他频率范围 (80Hz - 1000Hz)
        if (freq >= 80 && freq <= 1000) {
          const note = this.freqToNote(freq);
          if (note) {
            peaks.push({
              note: note,
              frequency: freq,
              amplitude: freqData[i] / 255,
              bin: i
            });
          }
        }
      }
    }
    
    // 按振幅排序，取前 6 个
    peaks.sort((a, b) => b.amplitude - a.amplitude);
    return peaks.slice(0, 6);
  }

  /**
   * 将频率转换为音名
   * @param {number} freq - 频率 (Hz)
   * @returns {string|null} 音名
   */
  freqToNote(freq) {
    try {
      const semitonesFromA4 = 12 * (Math.log(freq / this.A4) / Math.LN2);
      const midiNumber = Math.round(semitonesFromA4) + 69;
      return Note.fromMidi(midiNumber);
    } catch (e) {
      return null;
    }
  }

  /**
   * 使用 tonaljs 检测和弦
   * @param {string[]} detectedNotes - 检测到的音符列表
   * @returns {string|null} 识别的和弦名称
   */
  detectChordWithTonal(detectedNotes) {
    if (!detectedNotes || detectedNotes.length === 0) {
      return null;
    }
    
    try {
      const chordName = ChordDetect.detect(detectedNotes);
      
      if (chordName && chordName.length > 0) {
        // 验证是否是基础和弦
        const basicChordNames = window.ChordLibrary.getBasicChordNames();
        
        // 检查是否匹配基础和弦
        for (let j = 0; j < basicChordNames.length; j++) {
          const basicName = basicChordNames[j];
          if (chordName.indexOf(basicName) !== -1 || chordName === basicName) {
            return basicName;
          }
        }
        
        // 如果不完全匹配，返回识别结果
        return chordName;
      }
    } catch (e) {
      if (DEBUG) console.warn('[ChordDetector] tonaljs 和弦识别失败:', e);
    }
    
    return null;
  }

  /**
   * 基于弦能量的辅助识别（验证）
   * @param {Array} stringEnergies - 弦能量
   * @param {string} chordName - 候选和弦
   * @returns {number} 匹配度 (0-1)
   */
  verifyWithStringEnergies(stringEnergies, chordName) {
    const chordData = window.ChordLibrary.getChordData(chordName);
    if (!chordData) return 0;
    
    const fingering = chordData.fingering || [];
    let score = 0;
    let weight = 0;
    
    for (let i = 0; i < 6; i++) {
      const expectedActive = fingering[i] > 0;
      const actualActive = stringEnergies[i].energy > this.threshold;
      const stringWeight = 6 - i;
      
      weight += stringWeight;
      
      if (expectedActive === actualActive) {
        score += stringWeight;
      } else {
        // 不匹配扣分
        if (expectedActive && !actualActive) {
          score -= stringWeight * 0.5;
        } else if (!expectedActive && actualActive) {
          score -= stringWeight * 0.3;
        }
      }
    }
    
    return Math.max(0, score / weight);
  }

  /**
   * 检测和弦 - 主方法
   * @param {Uint8Array} freqData - FFT 频域数据
   * @returns {object|null} 识别结果
   */
  detect(freqData) {
    // 1. 提取弦能量
    const stringEnergies = this.extractStringEnergies(freqData);
    
    // 2. 峰值检测，提取音符
    const detectedPeaks = this.detectPeaks(freqData);
    const detectedNotes = detectedPeaks.map(p => p.note);
    
    if (detectedNotes.length < 2) {
      return null;
    }
    
    // 3. 使用 tonaljs 识别和弦
    let chordName = this.detectChordWithTonal(detectedNotes);
    
    // 4. 如果 tonaljs 无法识别，使用弦能量匹配作为备选
    if (!chordName) {
      chordName = this.detectByStringEnergy(stringEnergies);
    }
    
    // 5. 如果还是没有结果，返回 null
    if (!chordName) {
      return null;
    }
    
    // 6. 验证识别结果
    const verifyScore = this.verifyWithStringEnergies(stringEnergies, chordName);
    
    // 7. 获取和弦数据
    const chordData = window.ChordLibrary.getChordData(chordName);
    const notes = window.ChordLibrary.getChordNotes(chordName);
    
    // 8. 计算置信度
    const confidence = Math.min(1, 
      (detectedPeaks.length / 4) * 0.4 +
      (verifyScore) * 0.4 +
      (notes.length > 0 ? 0.2 : 0)
    );
    
    // 9. 返回结果
    if (confidence >= this.confidenceThreshold) {
      return {
        chord: chordName,
        confidence: Math.round(confidence * 100) / 100,
        method: 'tonal',
        detectedNotes: detectedPeaks.map(p => ({
          note: p.note,
          amplitude: Math.round(p.amplitude * 100) / 100
        })),
        stringEnergies: stringEnergies.map(s => ({
          name: s.name,
          energy: Math.round(s.energy * 100) / 100
        })),
        fingering: chordData ? chordData.fingering : null,
        notes: notes
      };
    }
    
    return null;
  }

  /**
   * 基于弦能量的备选识别方法
   * @param {Array} stringEnergies - 弦能量
   * @returns {string|null} 和弦名称
   */
  detectByStringEnergy(stringEnergies) {
    const activeStrings = stringEnergies.map(s => s.energy > this.threshold);
    
    let bestMatch = null;
    let bestScore = 0;
    
    const basicChords = window.ChordLibrary.BASIC_CHORDS;
    for (let i = 0; i < basicChords.length; i++) {
      const chord = basicChords[i];
      const chordData = window.ChordLibrary.getChordData(chord.name);
      if (!chordData) continue;
      
      const fingering = chordData.fingering || [];
      let score = 0;
      
      for (let j = 0; j < 6; j++) {
        const expectedActive = fingering[j] > 0;
        const actualActive = activeStrings[j];
        
        if (expectedActive === actualActive) {
          score++;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = chord.name;
      }
    }
    
    return bestScore >= 4 ? bestMatch : null;
  }
}

/**
 * 和弦转换检测器 - ES6 Class
 */
class TransitionDetector {
  constructor() {
    this.lastChord = null;
    this.lastStrumTime = 0;
    this.transitions = [];
    this.strumCount = 0;
    this.correctChords = 0;
  }

  /**
   * 处理和弦检测结果
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
   * 获取平均转换时间
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
   */
  getSlowestTransition() {
    if (this.transitions.length === 0) return null;
    return this.transitions.reduce((max, t) => t.time > max.time ? t : max);
  }

  /**
   * 获取最快转换
   */
  getFastestTransition() {
    if (this.transitions.length === 0) return null;
    return this.transitions.reduce((min, t) => t.time < min.time ? t : min);
  }

  /**
   * 计算转换流畅度评分
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
   */
  getAccuracy() {
    if (this.strumCount === 0) return 0;
    return Math.round((this.correctChords / this.strumCount) * 100);
  }

  /**
   * 重置
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
   */
  getStats() {
    return {
      strumCount: this.strumCount,
      correctChords: this.correctChords,
      accuracy: this.getAccuracy(),
      transitionCount: this.transitions.length,
      avgTransitionTime: this.getAverageTransitionTime(),
      fastestTransition: this.getFastestTransition(),
      slowestTransition: this.getSlowestTransition(),
      transitions: this.transitions
    };
  }
}

// 导出到全局（浏览器环境）
window.ChordDetector = ChordDetector;
window.TransitionDetector = TransitionDetector;
