// 吉他扫弦练习助手 - 自定义节奏型管理模块
// 功能：自定义节奏型的渲染、保存、删除、编辑

import { playDemo, getIsPlayingDemo, stopDemo } from './audio-demo.js';
import { AppState } from './state-manager.js';
import EventBus, { Events } from './event-bus.js';

// ========== 全局状态 ==========
const RHYTHM_PATTERNS = [
  { name: '前八后十六', pattern: [250, 125, 125], beats: 4, description: '↓ ↓↑', demo: ['D', 'D', 'U'] },
  { name: '前十六后八', pattern: [125, 125, 250], beats: 4, description: '↓↑ ↓', demo: ['D', 'U', 'D'] },
  { name: '民谣常用', pattern: [250, 125, 125, 125, 125, 250], beats: 4, description: '↓ ↓↑↓↑ ↓', demo: ['D', 'D', 'U', 'D', 'U', 'D'] },
  { name: '摇滚八分', pattern: [125, 125, 125, 125, 125, 125, 125, 125], beats: 4, description: '↓↑ ↓↑ ↓↑ ↓↑', demo: ['D', 'U', 'D', 'U', 'D', 'U', 'D', 'U'] },
  { name: '华尔兹', pattern: [333, 167, 167, 333, 167, 167], beats: 3, description: '↓ ↑↑ ↓ ↑↑', demo: ['D', 'U', 'U', 'D', 'U', 'U'] }
];

const NOTE_DURATIONS = {
  'whole': { name: '全音符', ms: 2000 },
  'half': { name: '二分音符', ms: 1000 },
  'quarter': { name: '四分音符', ms: 500 },
  '8th': { name: '八分音符', ms: 250 },
  '16th': { name: '十六分音符', ms: 125 }
};

const PRESET_TEMPLATES = {
  '8th-16th': { name: '前八后十六', notes: [{ duration: '8th', direction: 'D', velocity: 1.0 }, { duration: '16th', direction: 'D', velocity: 0.6 }, { duration: '16th', direction: 'U', velocity: 0.3 }] },
  '16th-8th': { name: '前十六后八', notes: [{ duration: '16th', direction: 'D', velocity: 0.6 }, { duration: '16th', direction: 'U', velocity: 0.3 }, { duration: '8th', direction: 'D', velocity: 1.0 }] },
  'folk': { name: '民谣常用', notes: [{ duration: '8th', direction: 'D', velocity: 1.0 }, { duration: '8th', direction: 'D', velocity: 1.0 }, { duration: '16th', direction: 'U', velocity: 0.3 }, { duration: '16th', direction: 'D', velocity: 0.6 }, { duration: '16th', direction: 'U', velocity: 0.3 }, { duration: '16th', direction: 'D', velocity: 0.6 }] },
  'rock': { name: '摇滚八分', notes: [{ duration: '8th', direction: 'D', velocity: 0.8 }, { duration: '8th', direction: 'U', velocity: 0.5 }, { duration: '8th', direction: 'D', velocity: 0.8 }, { duration: '8th', direction: 'U', velocity: 0.5 }, { duration: '8th', direction: 'D', velocity: 0.8 }, { duration: '8th', direction: 'U', velocity: 0.5 }, { duration: '8th', direction: 'D', velocity: 0.8 }, { duration: '8th', direction: 'U', velocity: 0.5 }] }
};

let customRhythms = [];
let editingRhythmIndex = -1;
let currentNoteSequence = [];
let customRhythmsListContainer = null;
let noteSequenceEditorContainer = null;
let customRhythmDelegationReady = false;
let noteEditorDelegationReady = false;
let rhythmSelectorDelegationReady = false;

// DOM 元素引用
let btnAddRhythm = null;
let rhythmSelector = null;

// ========== 辅助函数 ==========
/**
 * HTML 转义函数
 * @param {string} text - 待转义文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  const _escapeHtmlMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const _escapeHtmlRegex = /[&<>"']/g;
  return String(text).replace(_escapeHtmlRegex, m => _escapeHtmlMap[m]);
}

/**
 * 根据音符数组生成箭头模式字符串
 * @param {Array} notes - 音符数组
 * @returns {string} 箭头模式字符串
 */
export function generateArrowPattern(notes) {
  if (!notes || notes.length === 0) return '';
  const arrows = notes.map(n => ({ arrow: n.direction === 'D' ? '↓' : '↑', duration: n.duration }));
  let result = arrows[0].arrow;
  for (let i = 1; i < arrows.length; i++) {
    const prevDuration = arrows[i - 1].duration;
    const currDuration = arrows[i].duration;
    const isPrevShort = prevDuration === '16th';
    const isCurrShort = currDuration === '16th';
    if (isPrevShort && isCurrShort) result += arrows[i].arrow;
    else if (isPrevShort || isCurrShort) result += ' ' + arrows[i].arrow;
    else result += '  ' + arrows[i].arrow;
  }
  return result;
}

// ========== 获取激活的节奏型 ==========
/**
 * 获取指定索引的节奏型
 * @param {number} index - 节奏型索引
 * @returns {Object|null} 节奏型对象
 */
export function getActiveRhythm(index) {
  if (index >= 0 && index < RHYTHM_PATTERNS.length) {
    return RHYTHM_PATTERNS[index];
  }
  const customIndex = index - RHYTHM_PATTERNS.length;
  if (customIndex >= 0 && customIndex < customRhythms.length) {
    const rhythm = customRhythms[customIndex];
    if (!rhythm.notes || rhythm.notes.length === 0) return null;
    
    const tempPattern = rhythm.notes.map(note => NOTE_DURATIONS[note.duration]?.ms || 250);
    const tempDemo = rhythm.notes.map(note => note.direction);
    
    const tempDescription = (() => {
      let result = rhythm.notes[0].direction === 'D' ? '↓' : '↑';
      for (let i = 1; i < rhythm.notes.length; i++) {
        const prevDuration = rhythm.notes[i - 1].duration;
        const currDuration = rhythm.notes[i].duration;
        const arrow = rhythm.notes[i].direction === 'D' ? '↓' : '↑';
        const isPrevShort = prevDuration === '16th';
        const isCurrShort = currDuration === '16th';
        if (isPrevShort && isCurrShort) result += arrow;
        else if (isPrevShort || isCurrShort) result += ' ' + arrow;
        else result += '  ' + arrow;
      }
      return result;
    })();
    
    return { name: rhythm.name, pattern: tempPattern, beats: 4, description: tempDescription, demo: tempDemo, isCustom: true, notes: rhythm.notes, customIndex };
  }
  return null;
}

/**
 * 获取预置节奏型列表
 * @returns {Array} 预置节奏型数组
 */
export function getRhythmPatterns() {
  return RHYTHM_PATTERNS;
}

/**
 * 获取音符时值映射
 * @returns {Object} 音符时值映射
 */
export function getNoteDurations() {
  return NOTE_DURATIONS;
}

/**
 * 获取预设模板列表
 * @returns {Object} 预设模板对象
 */
export function getPresetTemplates() {
  return PRESET_TEMPLATES;
}

/**
 * 获取自定义节奏型列表
 * @returns {Array} 自定义节奏型数组
 */
export function getCustomRhythms() {
  return customRhythms;
}

/**
 * 设置自定义节奏型列表
 * @param {Array} rhythms - 节奏型数组
 */
export function setCustomRhythms(rhythms) {
  customRhythms = rhythms;
}

// ========== 初始化 ==========
/**
 * 初始化自定义节奏型模块
 * @param {Object} options - 配置选项
 * @param {HTMLElement} options.btnAddRhythm - 添加按钮
 * @param {HTMLElement} options.rhythmSelector - 节奏型选择器
 */
export function initCustomRhythms(options = {}) {
  btnAddRhythm = options.btnAddRhythm || null;
  rhythmSelector = options.rhythmSelector || null;
  
  loadCustomRhythms();
  renderCustomRhythmsList();
  setupCustomRhythmButtons();
}

function loadCustomRhythms() {
  try {
    const stored = localStorage.getItem('guitarStrumCustomRhythms');
    if (stored) customRhythms = JSON.parse(stored);
  } catch (e) { customRhythms = []; }
}

function saveCustomRhythms() {
  try { localStorage.setItem('guitarStrumCustomRhythms', JSON.stringify(customRhythms)); } catch (e) {}
}

// ========== 渲染自定义节奏型列表 ==========
/**
 * 渲染自定义节奏型列表到 DOM
 */
export function renderCustomRhythmsList() {
  const container = document.getElementById('customRhythmsList');
  if (!container) return;
  customRhythmsListContainer = container;
  
  if (customRhythms.length === 0) {
    container.innerHTML = '<div class="custom-rhythm-empty">暂无自定义节奏型，点击"+"创建</div>';
    return;
  }
  
  container.innerHTML = customRhythms.map((rhythm, index) => {
    const pattern = rhythm.notes ? generateArrowPattern(rhythm.notes) : '';
    return `
      <div class="rhythm-item" data-rhythm-index="${index}">
        <div class="rhythm-item-content" data-action="select-rhythm" role="button" tabindex="0">
          <div class="rhythm-item-title">${escapeHtml(rhythm.name)}</div>
          <div class="rhythm-item-pattern">${pattern}</div>
        </div>
        <div class="rhythm-item-actions">
          <button class="rhythm-action-btn rhythm-action-edit btn-edit-rhythm" data-edit-index="${index}">✏️ 编辑</button>
          <button class="rhythm-action-btn rhythm-action-play btn-custom-play" data-custom-index="${index}">🔊 试听</button>
          <button class="rhythm-action-btn rhythm-action-delete btn-delete-rhythm" data-delete-index="${index}">🗑 删除</button>
        </div>
      </div>
    `;
  }).join('');
  
  syncCustomRhythmsToSelector();
}

// ========== 试听自定义节奏型 ==========
/**
 * 从列表播放自定义节奏型
 * @param {number} index - 节奏型索引
 * @param {HTMLElement} btn - 播放按钮
 */
export function playCustomRhythmFromList(index, btn) {
  if (index < 0 || index >= customRhythms.length) return;
  const rhythm = customRhythms[index];
  if (!rhythm.notes || rhythm.notes.length === 0) return;
  if (AppState.getIsPlayingDemo()) { stopDemo(); return; }
  
  const rhythmIndex = RHYTHM_PATTERNS.length + index;
  if (btn && btn.classList) btn.classList.add('playing');
  if (btn && btn.textContent !== undefined) btn.textContent = '⏹ 停止演示';
  
  playDemo(rhythmIndex, btn, getActiveRhythm);
  
  window.customRhythmCleanup = setTimeout(() => { if (AppState.getIsPlayingDemo()) stopDemo(); }, 10000);
}

function syncCustomRhythmsToSelector() {
  if (!rhythmSelector) return;
  
  rhythmSelector.querySelectorAll('.custom-rhythm-option').forEach(el => el.remove());
  
  customRhythms.forEach((rhythm, index) => {
    const arrowPattern = generateArrowPattern(rhythm.notes);
    const option = document.createElement('div');
    option.className = 'rhythm-option custom-rhythm-option';
    option.dataset.customIndex = index;
    option.innerHTML = `<div class="name">${escapeHtml(rhythm.name)}</div><div class="pattern">${arrowPattern}</div><button class="btn-demo" data-custom-index="${index}">🔊 试听演示</button>`;
    rhythmSelector.appendChild(option);
  });
}

export function selectCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  const rhythm = customRhythms[index];
  if (!rhythm.notes || rhythm.notes.length === 0) return;
  
  const options = document.querySelectorAll('.rhythm-option');
  options.forEach(o => o.classList.remove('active'));
  
  const customOption = document.querySelector(`.custom-rhythm-option[data-custom-index="${index}"]`);
  if (customOption) customOption.classList.add('active');
  
  const tempDemo = rhythm.notes.map(note => note.direction);
  const feedbackMessage = document.getElementById('feedbackMessage');
  if (feedbackMessage) feedbackMessage.textContent = `已选择：${rhythm.name} - ${tempDemo.join(' ')}`;
  
  EventBus.emit(Events.RHYTHM_SELECT, { index, rhythm });
}

// ========== 设置自定义节奏型按钮 ==========
function setupCustomRhythmButtons() {
  const btnNew = document.getElementById('btnNewRhythm');
  const btnExport = document.getElementById('btnExportSettings');
  const btnImport = document.getElementById('btnImportSettings');
  const btnSave = document.getElementById('btnSaveRhythm');
  const btnCancel = document.getElementById('btnCancelEdit');
  const btnAddNote = document.getElementById('btnAddNote');
  const importInput = document.getElementById('importFileInput');
  
  if (btnNew) btnNew.addEventListener('click', openNewRhythmEditor);
  if (btnExport) btnExport.addEventListener('click', () => {
    exportUserSettings(70, false, 50, customRhythms, false);
  });
  if (btnImport) btnImport.addEventListener('click', () => importInput.click());
  if (importInput) importInput.addEventListener('change', (e) => {
    importUserSettings(e, customRhythms, {
      saveCustomRhythms,
      updateUI: (bpm, metronome, sensitivity) => {
        if (bpm) {
          const slider = document.getElementById('bpmSlider');
          const val = document.getElementById('bpmValue');
          if (slider) slider.value = bpm;
          if (val) val.textContent = bpm;
        }
        if (metronome !== null) {
          const toggle = document.getElementById('metronomeToggle');
          if (toggle) toggle.checked = metronome;
        }
        if (sensitivity) {
          const slider = document.getElementById('sensitivitySlider');
          const val = document.getElementById('sensitivityValue');
          if (slider) slider.value = sensitivity;
          if (val) val.textContent = sensitivity;
          updateThreshold();
        }
      },
      renderCustomRhythmsList
    }, false);
  });
  if (btnSave) btnSave.addEventListener('click', saveRhythmEditor);
  if (btnCancel) btnCancel.addEventListener('click', closeRhythmEditor);
  if (btnAddNote) btnAddNote.addEventListener('click', addNoteToSequence);
  setupCustomRhythmDelegation();
  setupNoteEditorDelegation();
  setupRhythmSelectorDelegation();
  
  document.querySelectorAll('.btnPreset').forEach(btn => {
    btn.addEventListener('click', (e) => loadPresetTemplate(e.target.dataset.preset));
  });
}

function setupCustomRhythmDelegation() {
  if (customRhythmDelegationReady) return;
  customRhythmsListContainer = document.getElementById('customRhythmsList');
  if (!customRhythmsListContainer) return;

  customRhythmsListContainer.addEventListener('click', (e) => {
    const item = e.target.closest('.rhythm-item');
    if (!item) return;

    if (e.target.closest('.btn-edit-rhythm')) {
      editCustomRhythm(parseInt(e.target.closest('.btn-edit-rhythm').dataset.editIndex));
      return;
    }

    if (e.target.closest('.btn-delete-rhythm')) {
      deleteCustomRhythm(parseInt(e.target.closest('.btn-delete-rhythm').dataset.deleteIndex));
      return;
    }

    const playBtn = e.target.closest('.btn-custom-play');
    if (playBtn) {
      e.preventDefault();
      playCustomRhythmFromList(parseInt(playBtn.dataset.customIndex), playBtn);
      return;
    }

    if (e.target.closest('.rhythm-item-content')) {
      selectCustomRhythm(parseInt(item.dataset.rhythmIndex));
    }
  });

  customRhythmsListContainer.addEventListener('keydown', (e) => {
    const content = e.target.closest('.rhythm-item-content');
    if (!content || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    const item = content.closest('.rhythm-item');
    if (item) {
      selectCustomRhythm(parseInt(item.dataset.rhythmIndex));
    }
  });

  customRhythmDelegationReady = true;
}

function setupRhythmSelectorDelegation() {
  if (rhythmSelectorDelegationReady || !rhythmSelector) return;

  rhythmSelector.addEventListener('click', (e) => {
    const option = e.target.closest('.custom-rhythm-option');
    if (!option || e.target.closest('.btn-demo')) return;
    selectCustomRhythm(parseInt(option.dataset.customIndex));
  });

  rhythmSelector.addEventListener('keydown', (e) => {
    const option = e.target.closest('.custom-rhythm-option');
    if (!option || e.target.closest('.btn-demo')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectCustomRhythm(parseInt(option.dataset.customIndex));
    }
  });

  rhythmSelectorDelegationReady = true;
}

// ========== 节奏型编辑器 ==========

function renderNoteSequenceEditor() {
  const container = document.getElementById('noteSequenceEditor');
  if (!container) return;
  noteSequenceEditorContainer = container;
  if (currentNoteSequence.length === 0) {
    container.innerHTML = '<div class="note-editor-empty">点击"添加音符"或选择预设模板开始</div>';
    return;
  }
  container.innerHTML = currentNoteSequence.map((note, index) => `
    <div class="note-item" data-note-index="${index}">
      <span class="note-index-label">#${index + 1}</span>
      <select class="note-duration-select" data-note-index="${index}">
        ${Object.entries(NOTE_DURATIONS).map(([key, val]) => `<option value="${key}" ${note.duration === key ? 'selected' : ''}>${val.name}</option>`).join('')}
      </select>
      <select class="note-direction-select" data-note-index="${index}">
        <option value="D" ${note.direction === 'D' ? 'selected' : ''}>下扫 (D)</option>
        <option value="U" ${note.direction === 'U' ? 'selected' : ''}>上扫 (U)</option>
      </select>
      <input type="range" class="note-velocity-input" data-note-index="${index}" min="0.1" max="1.0" step="0.1" value="${note.velocity || 0.5}">
      <span class="note-velocity-display">${Math.round((note.velocity || 0.5) * 100)}%</span>
      <button class="btn-remove-note" data-note-index="${index}">✕</button>
    </div>
  `).join('');
}

function setupNoteEditorDelegation() {
  if (noteEditorDelegationReady) return;
  noteSequenceEditorContainer = document.getElementById('noteSequenceEditor');
  if (!noteSequenceEditorContainer) return;

  noteSequenceEditorContainer.addEventListener('change', (e) => {
    const target = e.target;
    const noteIndex = parseInt(target.dataset.noteIndex);
    if (target.classList.contains('note-duration-select')) {
      updateNote(noteIndex, 'duration', target.value);
    } else if (target.classList.contains('note-direction-select')) {
      updateNote(noteIndex, 'direction', target.value);
    } else if (target.classList.contains('note-velocity-input')) {
      updateNote(noteIndex, 'velocity', parseFloat(target.value));
    }
  });

  noteSequenceEditorContainer.addEventListener('input', (e) => {
    const target = e.target;
    if (!target.classList.contains('note-velocity-input')) return;
    const display = target.closest('.note-item')?.querySelector('.note-velocity-display');
    if (display) {
      display.textContent = Math.round(parseFloat(target.value) * 100) + '%';
    }
  });

  noteSequenceEditorContainer.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.btn-remove-note');
    if (!removeBtn) return;
    removeNote(parseInt(removeBtn.dataset.noteIndex));
  });

  noteEditorDelegationReady = true;
}

function addNoteToSequence() {
  currentNoteSequence.push({ duration: '8th', direction: 'D', velocity: 0.8 });
  renderNoteSequenceEditor();
}

function loadPresetTemplate(presetKey) {
  const template = PRESET_TEMPLATES[presetKey];
  if (!template) return;
  const nameInput = document.getElementById('rhythmNameInput');
  if (nameInput) nameInput.value = template.name;
  currentNoteSequence = JSON.parse(JSON.stringify(template.notes));
  renderNoteSequenceEditor();
}

function saveRhythmEditor() {
  const nameInput = document.getElementById('rhythmNameInput');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) { alert('请输入节奏型名称'); return; }
  if (currentNoteSequence.length === 0) { alert('请至少添加一个音符'); return; }
  
  const rhythm = { name, notes: JSON.parse(JSON.stringify(currentNoteSequence)), createdAt: Date.now() };
  if (editingRhythmIndex >= 0) customRhythms[editingRhythmIndex] = rhythm;
  else customRhythms.push(rhythm);
  
  saveCustomRhythms();
  closeRhythmEditor();
  renderCustomRhythmsList();
  EventBus.emit(Events.SCORE_UPDATE, { customRhythms });
}

function closeRhythmEditor() {
  const modal = document.getElementById('rhythmEditorModal');
  if (modal) modal.style.display = 'none';
  editingRhythmIndex = -1;
  currentNoteSequence = [];
}

// ========== 导出函数 ==========
export function openNewRhythmEditor() {
  editingRhythmIndex = -1;
  currentNoteSequence = [];
  const nameInput = document.getElementById('rhythmNameInput');
  if (nameInput) nameInput.value = '';
  const modal = document.getElementById('rhythmEditorModal');
  if (modal) modal.style.display = 'block';
  renderNoteSequenceEditor();
  EventBus.emit(Events.MODE_CHANGE, { mode: 'rhythm-editor', isNew: true });
}

export function editCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  editingRhythmIndex = index;
  const rhythm = customRhythms[index];
  const nameInput = document.getElementById('rhythmNameInput');
  if (nameInput) nameInput.value = rhythm.name;
  currentNoteSequence = JSON.parse(JSON.stringify(rhythm.notes || []));
  const modal = document.getElementById('rhythmEditorModal');
  if (modal) modal.style.display = 'block';
  renderNoteSequenceEditor();
  EventBus.emit(Events.MODE_CHANGE, { mode: 'rhythm-editor', isNew: false, index });
}

export function deleteCustomRhythm(index) {
  if (index < 0 || index >= customRhythms.length) return;
  if (!confirm('确定要删除这个节奏型吗？')) return;
  customRhythms.splice(index, 1);
  saveCustomRhythms();
  renderCustomRhythmsList();
  EventBus.emit(Events.SCORE_UPDATE, { customRhythms });
}

export function updateNote(index, field, value) {
  if (index < 0 || index >= currentNoteSequence.length) return;
  currentNoteSequence[index][field] = value;
  renderNoteSequenceEditor();
}

export function removeNote(index) {
  if (index < 0 || index >= currentNoteSequence.length) return;
  currentNoteSequence.splice(index, 1);
  renderNoteSequenceEditor();
}

export function exportCustomRhythms() {
  return JSON.parse(JSON.stringify(customRhythms));
}

export function importCustomRhythms(rhythms) {
  customRhythms = JSON.parse(JSON.stringify(rhythms));
  saveCustomRhythms();
  renderCustomRhythmsList();
}
