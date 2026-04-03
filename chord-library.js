/**
 * 吉他和弦库 - 内置和弦数据
 * 
 * 提供：
 * - 10 个基础和弦定义
 * - 和弦指法数据
 * - 常用和弦进行预设
 */

/**
 * 基础和弦列表（首期 10 个）
 */
const BASIC_CHORDS = [
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
 * 和弦指法数据（简化版，用于 UI 显示）
 * 格式：[6 弦，5 弦，4 弦，3 弦，2 弦，1 弦]
 * null = 不弹，0 = 空弦，数字 = 按第几品
 */
const CHORD_FINGERINGS = {
  'C':  [null, 3, 2, 0, 1, null],
  'G':  [3, 2, null, null, 3, 3],
  'D':  [null, null, 0, 2, 3, 2],
  'Am': [null, 0, 2, 2, 1, null],
  'Em': [0, 2, 2, 0, 0, 0],
  'E':  [0, 2, 2, 1, 0, 0],
  'A':  [null, 0, 2, 2, 2, null],
  'F':  [1, 3, 3, 2, 1, 1],  // 简化版 F（横按）
  'Dm': [null, null, 0, 2, 3, 1],
  'Cmaj7': [null, 3, 2, 0, 0, null]
};

/**
 * 和弦音符组成
 */
const CHORD_NOTES = {
  'C': ['C3', 'E3', 'G3', 'C4', 'E4'],
  'G': ['G2', 'B2', 'D3', 'G3', 'B3', 'D4'],
  'D': ['D3', 'A3', 'D4', 'F#4', 'A4'],
  'Am': ['A2', 'E3', 'A3', 'C4', 'E4'],
  'Em': ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'],
  'E': ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'],
  'A': ['A2', 'E3', 'A3', 'C#4', 'E4'],
  'F': ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'],
  'Dm': ['D3', 'A3', 'D4', 'F4', 'A4'],
  'Cmaj7': ['C3', 'E3', 'G3', 'B3', 'E4']
};

/**
 * 常用和弦进行预设
 */
const COMMON_PROGRESSIONS = [
  { name: '1645 进行', chords: ['C', 'Am', 'F', 'G'] },
  { name: '4536 进行', chords: ['F', 'G', 'Em', 'Am'] },
  { name: '卡农进行', chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'] },
  { name: '12 小节蓝调', chords: ['C', 'F', 'G'] },
  { name: '初学者练习', chords: ['C', 'G', 'Am', 'Em'] }
];

/**
 * 获取和弦指法数据
 */
function getChordData(chordName) {
  const fingering = CHORD_FINGERINGS[chordName];
  const notes = CHORD_NOTES[chordName];
  const basic = BASIC_CHORDS.find(c => c.name === chordName);
  
  if (!fingering || !notes) return null;
  
  return {
    name: chordName,
    fingering: fingering,
    notes: notes,
    difficulty: basic ? basic.difficulty : 3,
    label: basic ? basic.label : chordName
  };
}

/**
 * 生成简易 SVG 指法图
 */
function getChordSVG(chordName, width = 120, height = 140) {
  const fingering = CHORD_FINGERINGS[chordName];
  if (!fingering) return '';
  
  const strings = 6;
  const frets = 4;
  const padding = 20;
  const stringSpacing = (width - 2 * padding) / (strings - 1);
  const fretSpacing = (height - 2 * padding) / frets;
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // 画品格
  for (let i = 0; i <= frets; i++) {
    const y = padding + i * fretSpacing;
    svg += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#888" stroke-width="1"/>`;
  }
  
  // 画弦
  for (let i = 0; i < strings; i++) {
    const x = padding + i * stringSpacing;
    svg += `<line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" stroke="#888" stroke-width="${i >= 3 ? 1 : 2}"/>`;
  }
  
  // 画按弦点
  for (let i = 0; i < strings; i++) {
    const fret = fingering[i];
    if (fret === null) continue;
    
    const x = padding + i * stringSpacing;
    const y = fret === 0 ? padding - 10 : padding + (fret - 0.5) * fretSpacing;
    
    if (fret === 0) {
      // 空弦圈
      svg += `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="#b866ff" stroke-width="2"/>`;
    } else {
      // 按弦点
      svg += `<circle cx="${x}" cy="${y}" r="8" fill="#b866ff"/>`;
    }
  }
  
  svg += '</svg>';
  return svg;
}

/**
 * 获取和弦音符
 */
function getChordNotes(chordName) {
  return CHORD_NOTES[chordName] || [];
}

/**
 * 验证和弦是否有效
 */
function isValidChord(chordName) {
  return CHORD_FINGERINGS[chordName] !== undefined;
}

/**
 * 获取基础和弦名称列表
 */
function getBasicChordNames() {
  return BASIC_CHORDS.map(c => c.name);
}

/**
 * 获取和弦难度
 */
function getChordDifficulty(chordName) {
  const basic = BASIC_CHORDS.find(c => c.name === chordName);
  return basic ? basic.difficulty : 3;
}

/**
 * 计算和弦转换难度
 */
function calculateTransitionDifficulty(chord1, chord2) {
  const f1 = CHORD_FINGERINGS[chord1];
  const f2 = CHORD_FINGERINGS[chord2];
  
  if (!f1 || !f2) return 5;
  
  let diff = 0;
  for (let i = 0; i < 6; i++) {
    if (f1[i] !== f2[i]) diff++;
  }
  
  return Math.min(5, Math.round(diff / 2));
}

/**
 * 获取常用和弦进行
 */
const COMMON_PROGRESSIONS_MAP = {};
COMMON_PROGRESSIONS.forEach(p => {
  COMMON_PROGRESSIONS_MAP[p.name] = p.chords;
});

function getProgression(name) {
  return COMMON_PROGRESSIONS_MAP[name] || [];
}

function getProgressionNames() {
  return COMMON_PROGRESSIONS.map(p => p.name);
}

// 导出到全局
window.ChordLibrary = {
  BASIC_CHORDS,
  COMMON_PROGRESSIONS,
  getChordData,
  getChordSVG,
  getChordNotes,
  isValidChord,
  getBasicChordNames,
  getChordDifficulty,
  calculateTransitionDifficulty,
  getProgression,
  getProgressionNames
};
