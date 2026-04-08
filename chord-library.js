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
  { name: 'Fm', difficulty: 3, label: 'F 小调' },
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
  'Fm': [1, 3, 3, 1, 1, 1],  // F 小调
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
  'Fm': ['F2', 'Ab3', 'C4', 'F4'],  // F 小调
  'Dm': ['D3', 'A3', 'D4', 'F4', 'A4'],
  'Cmaj7': ['C3', 'E3', 'G3', 'B3', 'E4'],
  'G/B': ['B2', 'D3', 'G3', 'B3', 'D4'],  // G 和弦第一转位，B 为低音
  'Am/G': ['G2', 'A3', 'C4', 'E4'],  // Am 和弦，低音 G
  'C/E': ['E3', 'G3', 'C4', 'E4']   // C 和弦第一转位，E 为低音
};

/**
 * 常用和弦进行预设（共 17 个独特进行，含周杰伦经典）
 */
var COMMON_PROGRESSIONS = [
  // 经典低音下行
  { name: '低音下行 (8-7-6-5-4-3-2-5)', chords: ['C', 'G/B', 'Am', 'Am/G', 'F', 'C/E', 'Dm', 'G'], desc: '经典低音 C→B→A→G→F→E→D→G 下行，抒情必备' },
  // 流行经典
  { name: '流行 1645 (1-6-4-5)', chords: ['C', 'Am', 'F', 'G'], desc: '华语流行最经典进行，明亮温暖' },
  { name: '流行 4536 (4-5-3-6)', chords: ['F', 'G', 'Em', 'Am'], desc: '日系流行经典，情感丰富' },
  { name: '卡农进行 (1-5-6-3-4-1-4-5)', chords: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'], desc: '帕赫贝尔卡农，8 和弦循环' },
  // 周杰伦经典
  { name: '周杰伦 4536251 (4-5-3-6-2-5-1)', chords: ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C'], desc: '《青花瓷》《彩虹》完整版，周杰伦抒情招牌' },
  { name: '周杰伦 6451 (6-4-5-1)', chords: ['Am', 'F', 'G', 'C'], desc: '《七里香》副歌，经典收尾进行' },
  { name: '周杰伦 1645 变体 (1-6-4-4m)', chords: ['C', 'Am', 'F', 'Fm'], desc: '《龙卷风》大→小转换，遗憾惋惜感' },
  { name: '和声小调 TSD (6-2-3-6)', chords: ['Am', 'Dm', 'E', 'Am'], desc: '《夜的第七章》快歌，Hip-Hop 风格' },
  // 爵士/蓝调
  { name: '12 小节蓝调 (1-4-5)', chords: ['C', 'F', 'G'], desc: '蓝调摇滚基础，简单有力' },
  { name: '251 进行 (2-5-1)', chords: ['Dm', 'G', 'Cmaj7'], desc: '爵士乐核心 ii-V-I 进行' },
  // 小调色彩
  { name: '小调 6415 (6-4-1-5)', chords: ['Am', 'F', 'C', 'G'], desc: '小调起始，忧郁深情' },
  // 摇滚/流行
  { name: '流行摇滚 (1-5-2-3)', chords: ['C', 'G', 'D', 'Em'], desc: '能量递增，适合摇滚' },
  { name: '抒情流行 (1-3-4-5)', chords: ['C', 'Em', 'F', 'G'], desc: '温暖柔和，情绪递进' },
  { name: '动力进行 (3-1-5-2)', chords: ['Em', 'C', 'G', 'D'], desc: '积极推动，励志向上' },
  // 风格化进行
  { name: 'R&B 进行 (1-6-2-5)', chords: ['Cmaj7', 'Am', 'Dm', 'G'], desc: '七和弦丝滑质感' },
  { name: '民谣常用 (5-2-3-1)', chords: ['G', 'D', 'Em', 'C'], desc: '开放和弦，民谣指弹' },
  { name: '初学者练习 (1-5-6-3)', chords: ['C', 'G', 'Am', 'Em'], desc: '4 个基础和弦，新手入门' }
];

/**
 * 获取和弦指法数据
 * @param {string} chordName - 和弦名称
 * @returns {Object|null} 和弦数据对象
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
 * 生成和弦指法图 SVG
 * @param {string} chordName - 和弦名称
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @returns {string} SVG 字符串
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
 * @param {string} chordName - 和弦名称
 * @returns {Array} 音符数组
 */
var getChordNotes = function(chordName) {
  return CHORD_NOTES[chordName] || [];
};

/**
 * 验证和弦是否有效
 * @param {string} chordName - 和弦名称
 * @returns {boolean} 是否有效
 */
var isValidChord = function(chordName) {
  return CHORD_FINGERINGS[chordName] !== undefined;
};

/**
 * 获取基础和弦名称列表
 * @returns {Array} 和弦名称数组
 */
var getBasicChordNames = function() {
  return BASIC_CHORDS.map(function(c) { return c.name; });
};

/**
 * 获取和弦难度
 * @param {string} chordName - 和弦名称
 * @returns {number} 难度等级 (1-3)
 */
var getChordDifficulty = function(chordName) {
  var basic = BASIC_CHORDS.find(function(c) { return c.name === chordName; });
  return basic ? basic.difficulty : 3;
};

/**
 * 计算和弦转换难度
 * @param {string} chord1 - 起始和弦
 * @param {string} chord2 - 目标和弦
 * @returns {number} 转换难度 (1-5)
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

/**
 * 获取和弦进行
 * @param {string} name - 和弦进行名称
 * @returns {Array} 和弦数组
 */
var getProgression = function(name) {
  return COMMON_PROGRESSIONS_MAP[name] || [];
};

/**
 * 获取和弦进行名称列表
 * @returns {Array} 名称数组
 */
var getProgressionNames = function() {
  return COMMON_PROGRESSIONS.map(function(p) { return p.name; });
};

// 导出到全局
window.ChordLibrary = {
  BASIC_CHORDS: BASIC_CHORDS,
  COMMON_PROGRESSIONS: COMMON_PROGRESSIONS,
  findChord: getChordData,
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
