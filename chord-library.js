/**
 * 吉他和弦库 - 包含 10 个基础和弦的定义
 * 
 * 技术栈：
 * - tonaljs: 和弦理论计算（音符、和弦识别）
 * - chordictionary: 和弦指法图生成（SVG）
 * 
 * 每个和弦包含：
 * - name: 和弦名称
 * - template: 6 根弦的发声状态模板 (从 6 弦到 1 弦：E2/A2/D3/G3/B3/E4)
 *            0=不发声/闷音，1=发声
 * - notes: 和弦包含的音符 (使用 tonaljs 的音高表示法)
 * - fingering: 指法图数据 (用于 UI 显示)
 * - difficulty: 难度等级 (1-3 星)
 */

import { Chord } from 'tonal';
import { Instrument } from 'chordictionary';

// 创建吉他实例（标准调弦 EADGBE，24 品，显示 7 品，最大跨度 4 品）
const guitar = new Instrument('EADGBE', 24, 7, 4);

// 和弦库数据
export const chordData = [
  {
    name: 'C',
    // C 和弦：x32010 (6 弦不弹，5 弦 3 品，4 弦 2 品，3 弦空弦，2 弦 1 品，1 弦空弦)
    template: [0, 1, 1, 1, 1, 1],
    notes: ['C3', 'E3', 'G3', 'C4', 'E4'],
    fingering: {
      strings: [null, 3, 2, 0, 1, null], // 每根弦的按品位置 (null=不弹，0=空弦)
      frets: 3 // 指法图显示的品格数
    },
    difficulty: 1,
    // 使用 tonaljs 验证和弦
    chordInfo: Chord.get('C')
  },
  {
    name: 'G',
    // G 和弦：320003 或 320033 (常见版本)
    template: [1, 1, 1, 1, 1, 1],
    notes: ['G2', 'B2', 'D3', 'G3', 'B3', 'D4'],
    fingering: {
      strings: [3, 2, 0, 0, 0, 3],
      frets: 3
    },
    difficulty: 1,
    chordInfo: Chord.get('G')
  },
  {
    name: 'D',
    // D 和弦：xx0232 (4 弦空弦，3 弦 2 品，2 弦 3 品，1 弦 2 品)
    template: [0, 0, 1, 1, 1, 1],
    notes: ['D3', 'A3', 'D4', 'F#4'],
    fingering: {
      strings: [null, null, 0, 2, 3, 2],
      frets: 3
    },
    difficulty: 1,
    chordInfo: Chord.get('D')
  },
  {
    name: 'Am',
    // Am 和弦：x02210
    template: [0, 1, 1, 1, 1, 1],
    notes: ['A2', 'E3', 'A3', 'C4', 'E4'],
    fingering: {
      strings: [null, 0, 2, 2, 1, null],
      frets: 3
    },
    difficulty: 1,
    chordInfo: Chord.get('Am')
  },
  {
    name: 'Em',
    // Em 和弦：022000 (最简单的小调和弦)
    template: [1, 1, 1, 1, 1, 1],
    notes: ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'],
    fingering: {
      strings: [0, 2, 2, 0, 0, 0],
      frets: 3
    },
    difficulty: 1,
    chordInfo: Chord.get('Em')
  },
  {
    name: 'E',
    // E 和弦：022100
    template: [1, 1, 1, 1, 1, 1],
    notes: ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'],
    fingering: {
      strings: [0, 2, 2, 1, 0, 0],
      frets: 3
    },
    difficulty: 2,
    chordInfo: Chord.get('E')
  },
  {
    name: 'A',
    // A 和弦：x02220
    template: [0, 1, 1, 1, 1, 1],
    notes: ['A2', 'E3', 'A3', 'C#4', 'E4'],
    fingering: {
      strings: [null, 0, 2, 2, 2, null],
      frets: 3
    },
    difficulty: 2,
    chordInfo: Chord.get('A')
  },
  {
    name: 'F',
    // F 和弦 (简化版，无大横按)：xx3210 或 133211(横按)
    // 使用简化版：1 弦空弦，2 弦 1 品，3 弦 2 品，4 弦 3 品
    template: [0, 0, 1, 1, 1, 1],
    notes: ['F3', 'A3', 'C4', 'F4'],
    fingering: {
      strings: [null, null, 3, 2, 1, 0],
      frets: 4
    },
    difficulty: 3,
    chordInfo: Chord.get('F')
  },
  {
    name: 'Dm',
    // Dm 和弦：xx0231
    template: [0, 0, 1, 1, 1, 1],
    notes: ['D3', 'A3', 'D4', 'F4'],
    fingering: {
      strings: [null, null, 0, 2, 3, 1],
      frets: 3
    },
    difficulty: 2,
    chordInfo: Chord.get('Dm')
  },
  {
    name: 'Cmaj7',
    // Cmaj7 和弦：x32000 (C 大七和弦)
    template: [0, 1, 1, 1, 1, 1],
    notes: ['C3', 'E3', 'G3', 'B3', 'E4'],
    fingering: {
      strings: [null, 3, 2, 0, 0, 0],
      frets: 3
    },
    difficulty: 2,
    chordInfo: Chord.get('Cmaj7')
  }
];

/**
 * 获取和弦库中的所有和弦名称
 */
export function getChordNames() {
  return chordData.map(chord => chord.name);
}

/**
 * 根据名称查找和弦
 * @param {string} name - 和弦名称
 * @returns {object|null} 和弦对象，未找到返回 null
 */
export function findChord(name) {
  return chordData.find(chord => chord.name === name) || null;
}

/**
 * 获取和弦的指法图字符串表示
 * @param {object} chord - 和弦对象
 * @returns {string} 指法图字符串 (如 "x32010")
 */
export function getChordTabString(chord) {
  return chord.fingering.strings.map(fret => {
    if (fret === null) return 'x';
    return fret.toString();
  }).join('');
}

/**
 * 使用 chordictionary 获取和弦信息
 * @param {string} tab - 指法图字符串 (如 "x32010")
 * @returns {object} 和弦信息（名称、音符等）
 */
export function getChordInfoFromTab(tab) {
  try {
    return guitar.getChordInfo(tab);
  } catch (e) {
    console.warn('[ChordLibrary] getChordInfo error:', e);
    return null;
  }
}

/**
 * 使用 chordictionary 生成和弦 HTML 指法图
 * @param {string} tab - 指法图字符串 (如 "x32010")
 * @param {string} chordName - 和弦名称（用于显示）
 * @returns {string} HTML 字符串
 */
export function getChordLayoutFromTab(tab, chordName = '') {
  try {
    const info = guitar.getChordInfo(tab);
    if (info) {
      return guitar.getChordLayout(tab, info.chords[0]);
    }
    return null;
  } catch (e) {
    console.warn('[ChordLibrary] getChordLayout error:', e);
    return null;
  }
}

/**
 * 获取和弦指法数据（使用 chordictionary 验证）
 * @param {string} chordName - 和弦名称
 * @returns {object|null} 指法数据
 */
export function getChordData(chordName) {
  const chord = findChord(chordName);
  if (!chord) return null;
  
  const tab = getChordTabString(chord);
  const info = getChordInfoFromTab(tab);
  
  return {
    name: chordName,
    tab: tab,
    info: info,
    fingering: chord.fingering,
    layout: info ? getChordLayoutFromTab(tab, chordName) : null
  };
}

/**
 * 获取和弦指法图数据（用于 canvas 绘制）
 * @param {string} chordName - 和弦名称
 * @returns {object|null} 指法图数据（strings, frets）
 */
export function getChordSVG(chordName) {
  // 注意：chordictionary 不直接支持 SVG，返回指法数据供 canvas 绘制
  const chord = findChord(chordName);
  if (!chord) return null;
  
  return {
    name: chordName,
    tab: getChordTabString(chord),
    fingering: chord.fingering,
    // 返回 HTML 布局（可选）
    layout: getChordLayoutFromTab(getChordTabString(chord), chordName)
  };
}

/**
 * 计算两个和弦之间的转换难度
 * @param {string} chord1 - 第一个和弦名称
 * @param {string} chord2 - 第二个和弦名称
 * @returns {object} 包含难度评分和共同手指位置信息
 */
export function calculateTransitionDifficulty(chord1, chord2) {
  const c1 = findChord(chord1);
  const c2 = findChord(chord2);
  
  if (!c1 || !c2) {
    return { difficulty: 0, commonFingers: 0, fingerMovement: 0 };
  }
  
  let commonFingers = 0;
  let fingerMovement = 0;
  
  // 比较每根弦的按品位置
  for (let i = 0; i < 6; i++) {
    const fret1 = c1.fingering.strings[i];
    const fret2 = c2.fingering.strings[i];
    
    if (fret1 !== null && fret2 !== null) {
      if (fret1 === fret2) {
        commonFingers++; // 同一位置，手指不用移动
      } else {
        fingerMovement += Math.abs(fret1 - fret2); // 计算移动距离
      }
    } else if (fret1 === null && fret2 !== null) {
      fingerMovement += 2; // 从不弹到按弦
    } else if (fret1 !== null && fret2 === null) {
      fingerMovement += 2; // 从按弦到不弹
    }
  }
  
  // 难度评分 (0-10，越低越简单)
  const difficulty = Math.min(10, fingerMovement / 2 - commonFingers);
  
  return {
    difficulty: Math.round(difficulty * 10) / 10,
    commonFingers,
    fingerMovement
  };
}

/**
 * 获取常用和弦进行预设
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

export default chordData;
