/**
 * 吉他和弦库 - 基于 chordictionaryjs
 * 
 * 使用 chordictionary 提供：
 * - 和弦指法数据
 * - SVG 指法图生成
 * - 和弦字典查询
 * 
 * @see https://github.com/greird/chordictionary
 */

import Chordictionary from 'chordictionary';

// 初始化和弦字典（单例）
const chordDict = new Chordictionary();

/**
 * 基础和弦列表（首期 10 个）
 */
export const BASIC_CHORDS = [
  { name: 'C', difficulty: 1, label: 'C 大调' },
  { name: 'G', difficulty: 1, label: 'G 大调' },
  { name: 'D', difficulty: 1, label: 'D 大调' },
  { name: 'Am', difficulty: 1, label: 'A 小调' },
  { name: 'Em', difficulty: 1, label: 'E 小调' },
  { name: 'E', difficulty: 2, label: 'E 大调' },
  { name: 'A', difficulty: 2, label: 'A 大调' },
  { name: 'F', difficulty: 3, label: 'F 大调 (简化)' },
  { name: 'Dm', difficulty: 2, label: 'D 小调' },
  { name: 'Cmaj7', difficulty: 2, label: 'C 大七' }
];

/**
 * 获取和弦指法数据
 * @param {string} chordName - 和弦名称 (如 'C', 'Am', 'Dm')
 * @returns {object|null} 和弦指法数据，包含按弦位置等信息
 */
export function getChordData(chordName) {
  try {
    const chord = chordDict.getChord(chordName);
    if (!chord || !chord.positions || chord.positions.length === 0) {
      // 尝试变体名称
      const variations = {
        'Cmaj7': 'Cmaj7',
        'Dm': 'Dm',
        'Em': 'Em',
        'Am': 'Am',
        'E': 'E',
        'A': 'A',
        'F': 'F'
      };
      
      if (variations[chordName]) {
        const variant = chordDict.getChord(variations[chordName]);
        if (variant && variant.positions && variant.positions.length > 0) {
          return variant.positions[0];
        }
      }
      
      return null;
    }
    
    // 返回第一个位置（最常用指法）
    return chord.positions[0];
  } catch (e) {
    console.warn('[ChordLibrary] 获取和弦数据失败:', chordName, e);
    return null;
  }
}

/**
 * 获取和弦指法图 SVG
 * @param {string} chordName - 和弦名称
 * @param {number} width - SVG 宽度 (默认 120)
 * @param {number} height - SVG 高度 (默认 140)
 * @returns {string} SVG 字符串
 */
export function getChordSVG(chordName, width = 120, height = 140) {
  try {
    // chordictionary 的 SVG 生成可能需要特定配置
    const chord = chordDict.getChord(chordName);
    if (!chord || !chord.positions || chord.positions.length === 0) {
      return createFallbackSVG(chordName, width, height);
    }
    
    // 尝试使用 chordictionary 的 SVG 生成
    if (typeof chordDict.getChordSVG === 'function') {
      return chordDict.getChordSVG(chordName, width, height);
    }
    
    // 如果库不支持 SVG 生成，使用备用方案
    return createFallbackSVG(chordName, width, height);
  } catch (e) {
    console.warn('[ChordLibrary] 生成 SVG 失败:', chordName, e);
    return createFallbackSVG(chordName, width, height);
  }
}

/**
 * 备用 SVG 生成（当 chordictionary 不支持时）
 * @param {string} chordName - 和弦名称
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @returns {string} SVG 字符串
 */
function createFallbackSVG(chordName, width, height) {
  const chordData = getChordData(chordName);
  
  if (!chordData) {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${width/2}" y="${height/2}" text-anchor="middle" fill="#666" font-size="14">
        无指法数据
      </text>
    </svg>`;
  }
  
  // 从 chordData 提取按弦位置
  const fingering = chordData.fingers || [0, 0, 0, 0, 0, 0];
  const baseFret = chordData.baseFret || 1;
  
  // 生成 SVG
  const padding = 15;
  const diagramWidth = width - padding * 2;
  const diagramHeight = height - padding * 2 - 20;
  const stringSpacing = diagramWidth / 5;
  const fretSpacing = diagramHeight / 3; // 显示 3 品
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // 绘制品格线
  svg += `<g stroke="#fff" stroke-width="1">`;
  for (let i = 0; i <= 3; i++) {
    const y = padding + i * fretSpacing;
    svg += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}"/>`;
  }
  
  // 绘制琴弦
  for (let i = 0; i < 6; i++) {
    const x = padding + i * stringSpacing;
    svg += `<line x1="${x}" y1="${padding}" x2="${x}" y2="${padding + 3 * fretSpacing}"/>`;
  }
  svg += `</g>`;
  
  // 绘制按弦位置
  svg += `<g fill="#00d9ff">`;
  for (let i = 0; i < 6; i++) {
    const fret = fingering[i] || 0;
    const x = padding + i * stringSpacing;
    
    if (fret === 0) {
      // 空弦 - 圆圈
      svg += `<circle cx="${x}" cy="${padding - 8}" r="5" fill="none" stroke="#fff" stroke-width="1"/>`;
    } else if (fret > 0) {
      // 按弦 - 实心圆
      const y = padding + (fret - 0.5) * fretSpacing;
      svg += `<circle cx="${x}" cy="${y}" r="8"/>`;
    }
  }
  svg += `</g>`;
  
  // 和弦名称
  svg += `<text x="${width/2}" y="${height - 5}" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">${chordName}</text>`;
  
  svg += `</svg>`;
  return svg;
}

/**
 * 获取和弦的音符组成
 * @param {string} chordName - 和弦名称
 * @returns {string[]} 音符数组 (如 ['C', 'E', 'G'])
 */
export function getChordNotes(chordName) {
  try {
    const chord = chordDict.getChord(chordName);
    if (chord && chord.notes) {
      return chord.notes;
    }
    return [];
  } catch (e) {
    console.warn('[ChordLibrary] 获取和弦音符失败:', chordName, e);
    return [];
  }
}

/**
 * 验证和弦名称是否有效
 * @param {string} chordName - 和弦名称
 * @returns {boolean} 是否有效
 */
export function isValidChord(chordName) {
  try {
    const chord = chordDict.getChord(chordName);
    return !!(chord && chord.positions && chord.positions.length > 0);
  } catch (e) {
    return false;
  }
}

/**
 * 获取所有基础和弦名称
 * @returns {string[]} 和弦名称数组
 */
export function getBasicChordNames() {
  return BASIC_CHORDS.map(c => c.name);
}

/**
 * 获取和弦难度
 * @param {string} chordName - 和弦名称
 * @returns {number} 难度等级 (1-3)
 */
export function getChordDifficulty(chordName) {
  const chord = BASIC_CHORDS.find(c => c.name === chordName);
  return chord ? chord.difficulty : 2;
}

/**
 * 计算两个和弦之间的转换难度
 * @param {string} chord1 - 第一个和弦
 * @param {string} chord2 - 第二个和弦
 * @returns {object} 难度评分和详细信息
 */
export function calculateTransitionDifficulty(chord1, chord2) {
  const data1 = getChordData(chord1);
  const data2 = getChordData(chord2);
  
  if (!data1 || !data2) {
    return { difficulty: 5, commonFingers: 0, fingerMovement: 0 };
  }
  
  const fingers1 = data1.fingers || [];
  const fingers2 = data2.fingers || [];
  
  let commonFingers = 0;
  let fingerMovement = 0;
  
  for (let i = 0; i < 6; i++) {
    const f1 = fingers1[i] || 0;
    const f2 = fingers2[i] || 0;
    
    if (f1 > 0 && f2 > 0) {
      if (f1 === f2) {
        commonFingers++;
      } else {
        fingerMovement += Math.abs(f1 - f2);
      }
    } else if (f1 === 0 && f2 > 0) {
      fingerMovement += 2;
    } else if (f1 > 0 && f2 === 0) {
      fingerMovement += 2;
    }
  }
  
  const difficulty = Math.min(10, fingerMovement / 2 - commonFingers);
  
  return {
    difficulty: Math.round(difficulty * 10) / 10,
    commonFingers,
    fingerMovement
  };
}

/**
 * 常用和弦进行预设
 */
export const COMMON_PROGRESSIONS = [
  {
    name: '流行 1645',
    chords: ['C', 'Am', 'F', 'G'],
    description: '最常用的流行进行'
  },
  {
    name: '流行 4536',
    chords: ['F', 'G', 'Em', 'Am'],
    description: '华语流行经典'
  },
  {
    name: '卡农进行',
    chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'],
    description: '经典卡农变体'
  },
  {
    name: '蓝调 12 小节',
    chords: ['C', 'F', 'G'],
    description: '基础蓝调进行'
  },
  {
    name: '初学者 C-G',
    chords: ['C', 'G'],
    description: '最简单的两和弦转换'
  }
];

/**
 * 获取预设进行
 * @param {number} index - 预设索引
 * @returns {object|null} 进行信息
 */
export function getProgression(index) {
  return COMMON_PROGRESSIONS[index] || null;
}

/**
 * 获取所有预设进行名称
 * @returns {string[]} 进行名称数组
 */
export function getProgressionNames() {
  return COMMON_PROGRESSIONS.map(p => p.name);
}

// 导出 chordictionary 实例（供高级用法）
export { chordDict };

export default {
  chordDict,
  BASIC_CHORDS,
  getChordData,
  getChordSVG,
  getChordNotes,
  isValidChord,
  getBasicChordNames,
  getChordDifficulty,
  calculateTransitionDifficulty,
  COMMON_PROGRESSIONS,
  getProgression,
  getProgressionNames
};
