/**
 * 吉他和弦库 - 内置和弦数据
 * 
 * 提供：
 * - 10 个基础和弦定义
 * - 和弦指法数据
 * - 常用和弦进行预设
 */

/**
 * 基础和弦列表（首期 10 个 + 转位和弦）
 */
var BASIC_CHORDS = [
  { name: 'C', difficulty: 1, label: 'C 大调' },
  { name: 'G', difficulty: 1, label: 'G 大调' },
  { name: 'D', difficulty: 1, label: 'D 大调' },
  { name: 'Am', difficulty: 1, label: 'A 小调' },
  { name: 'Em', difficulty: 1, label: 'E 小调' },
  { name: 'E', difficulty: 2, label: 'E 大调' },
  { name: 'A', difficulty: 2, label: 'A 大调' },
  { name: 'F', difficulty: 3, label: 'F 大调 (简化)' },
  { name: 'Dm', difficulty: 2, label: 'D 小调' },
  { name: 'Cmaj7', difficulty: 2, label: 'C 大七' },
  { name: 'G/B', difficulty: 2, label: 'G 转位 (低音 B)' },
  { name: 'Am/G', difficulty: 2, label: 'Am 转位 (低音 G)' },
  { name: 'C/E', difficulty: 2, label: 'C 转位 (低音 E)' }
];

/**
 * 和弦指法数据（简化版，用于 UI 显示）
 */
var CHORD_FINGERINGS = {
  'C':  [null, 3, 2, 0, 1, null],
  'G':  [3, 2, null, null, 3, 3],
  'D':  [null, null, 0, 2, 3, 2],
  'Am': [null, 0, 2, 2, 1, null],
  'Em': [0, 2, 2, 0, 0, 0],
  'E':  [0, 2, 2, 1, 0, 0],
  'A':  [null, 0, 2, 2, 2, null],
  'F':  [1, 3, 3, 2, 1, 1],
  'Dm': [null, null, 0, 2, 3, 1],
  'Cmaj7': [null, 3, 2, 0, 0, null],
  'G/B': [null, 2, 0, 0, 0, 3],  // G 和弦第一转位，低音 B
  'Am/G': [3, 0, 2, 2, 1, null],  // Am 和弦，低音 G（3 品）
  'C/E': [0, 3, 2, 0, 1, null]   // C 和弦第一转位，低音 E
};

/**
 * 和弦音符组成
 */
var CHORD_NOTES = {
  'C': ['C3', 'E3', 'G3', 'C4', 'E4'],
  'G': ['G2', 'B2', 'D3', 'G3', 'B3', 'D4'],
  'D': ['D3', 'A3', 'D4', 'F#4', 'A4'],
  'Am': ['A2', 'E3', 'A3', 'C4', 'E4'],
  'Em': ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'],
  'E': ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'],
  'A': ['A2', 'E3', 'A3', 'C#4', 'E4'],
  'F': ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'],
  'Dm': ['D3', 'A3', 'D4', 'F4', 'A4'],
  'Cmaj7': ['C3', 'E3', 'G3', 'B3', 'E4'],
  'G/B': ['B2', 'D3', 'G3', 'B3', 'D4'],  // G 和弦第一转位，B 为低音
  'Am/G': ['G2', 'A3', 'C4', 'E4'],  // Am 和弦，低音 G
  'C/E': ['E3', 'G3', 'C4', 'E4']   // C 和弦第一转位，E 为低音
};

/**
 * 常用和弦进行预设（去重后保留 13 个独特进行）
 */
var COMMON_PROGRESSIONS = [
  // 经典低音下行
  { name: '低音下行', chords: ['C', 'G/B', 'Am', 'Am/G', 'F', 'C/E', 'Dm', 'G'], desc: '经典低音 C→B→A→G→F→E→D→G 下行，抒情必备' },
  // 流行经典
  { name: '流行 1645', chords: ['C', 'Am', 'F', 'G'], desc: '华语流行最经典进行，明亮温暖' },
  { name: '流行 4536', chords: ['F', 'G', 'Em', 'Am'], desc: '日系流行经典，情感丰富' },
  { name: '卡农进行', chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'], desc: '帕赫贝尔卡农，8 和弦循环' },
  // 爵士/蓝调
  { name: '12 小节蓝调', chords: ['C', 'F', 'G'], desc: '蓝调摇滚基础，简单有力' },
  { name: '251 进行', chords: ['Dm', 'G', 'Cmaj7'], desc: '爵士乐核心 ii-V-I 进行' },
  // 小调色彩
  { name: '小调 6415', chords: ['Am', 'F', 'C', 'G'], desc: '小调起始，忧郁深情' },
  // 摇滚/流行
  { name: '流行摇滚', chords: ['C', 'G', 'D', 'Em'], desc: '能量递增，适合摇滚' },
  { name: '抒情流行', chords: ['C', 'Em', 'F', 'G'], desc: '温暖柔和，情绪递进' },
  { name: '动力进行', chords: ['Em', 'C', 'G', 'D'], desc: '积极推动，励志向上' },
  // 风格化进行
  { name: 'R&B 进行', chords: ['Cmaj7', 'Am', 'Dm', 'G'], desc: '七和弦丝滑质感' },
  { name: '民谣常用', chords: ['G', 'D', 'Em', 'C'], desc: '开放和弦，民谣指弹' },
  { name: '初学者练习', chords: ['C', 'G', 'Am', 'Em'], desc: '4 个基础和弦，新手入门' }
];

/**
 * 获取和弦指法数据
 */
var getChordData = function(chordName) {
  var fingering = CHORD_FINGERINGS[chordName];
  var notes = CHORD_NOTES[chordName];
  var basic = BASIC_CHORDS.find(function(c) { return c.name === chordName; });
  
  if (!fingering || !notes) return null;
  
  return {
    name: chordName,
    fingering: fingering,
    notes: notes,
    difficulty: basic ? basic.difficulty : 3,
    label: basic ? basic.label : chordName
  };
};

/**
 * 生成简易 SVG 指法图
 */
var getChordSVG = function(chordName, width, height) {
  if (width === undefined) width = 120;
  if (height === undefined) height = 140;
  
  var fingering = CHORD_FINGERINGS[chordName];
  if (!fingering) return '';
  
  var strings = 6;
  var frets = 4;
  var padding = 20;
  var stringSpacing = (width - 2 * padding) / (strings - 1);
  var fretSpacing = (height - 2 * padding) / frets;
  
  var svg = '<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg">';
  
  // 画品格
  for (var i = 0; i <= frets; i++) {
    var y = padding + i * fretSpacing;
    svg += '<line x1="' + padding + '" y1="' + y + '" x2="' + (width - padding) + '" y2="' + y + '" stroke="#888" stroke-width="1"/>';
  }
  
  // 画弦
  for (var i = 0; i < strings; i++) {
    var x = padding + i * stringSpacing;
    svg += '<line x1="' + x + '" y1="' + padding + '" x2="' + x + '" y2="' + (height - padding) + '" stroke="#888" stroke-width="' + (i >= 3 ? 1 : 2) + '"/>';
  }
  
  // 画按弦点
  for (var i = 0; i < strings; i++) {
    var fret = fingering[i];
    if (fret === null) continue;
    
    var x = padding + i * stringSpacing;
    var y = fret === 0 ? padding - 10 : padding + (fret - 0.5) * fretSpacing;
    
    if (fret === 0) {
      svg += '<circle cx="' + x + '" cy="' + y + '" r="6" fill="none" stroke="#b866ff" stroke-width="2"/>';
    } else {
      svg += '<circle cx="' + x + '" cy="' + y + '" r="8" fill="#b866ff"/>';
    }
  }
  
  svg += '</svg>';
  return svg;
};

/**
 * 获取和弦音符
 */
var getChordNotes = function(chordName) {
  return CHORD_NOTES[chordName] || [];
};

/**
 * 验证和弦是否有效
 */
var isValidChord = function(chordName) {
  return CHORD_FINGERINGS[chordName] !== undefined;
};

/**
 * 获取基础和弦名称列表
 */
var getBasicChordNames = function() {
  return BASIC_CHORDS.map(function(c) { return c.name; });
};

/**
 * 获取和弦难度
 */
var getChordDifficulty = function(chordName) {
  var basic = BASIC_CHORDS.find(function(c) { return c.name === chordName; });
  return basic ? basic.difficulty : 3;
};

/**
 * 计算和弦转换难度
 */
var calculateTransitionDifficulty = function(chord1, chord2) {
  var f1 = CHORD_FINGERINGS[chord1];
  var f2 = CHORD_FINGERINGS[chord2];
  
  if (!f1 || !f2) return 5;
  
  var diff = 0;
  for (var i = 0; i < 6; i++) {
    if (f1[i] !== f2[i]) diff++;
  }
  
  return Math.min(5, Math.round(diff / 2));
};

/**
 * 获取常用和弦进行
 */
var COMMON_PROGRESSIONS_MAP = {};
COMMON_PROGRESSIONS.forEach(function(p) {
  COMMON_PROGRESSIONS_MAP[p.name] = p.chords;
});

var getProgression = function(name) {
  return COMMON_PROGRESSIONS_MAP[name] || [];
};

var getProgressionNames = function() {
  return COMMON_PROGRESSIONS.map(function(p) { return p.name; });
};

// 导出到全局
window.ChordLibrary = {
  BASIC_CHORDS: BASIC_CHORDS,
  COMMON_PROGRESSIONS: COMMON_PROGRESSIONS,
  getChordData: getChordData,
  getChordSVG: getChordSVG,
  getChordNotes: getChordNotes,
  isValidChord: isValidChord,
  getBasicChordNames: getBasicChordNames,
  getChordDifficulty: getChordDifficulty,
  calculateTransitionDifficulty: calculateTransitionDifficulty,
  getProgression: getProgression,
  getProgressionNames: getProgressionNames
};
