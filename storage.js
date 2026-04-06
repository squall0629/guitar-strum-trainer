// 吉他扫弦练习助手 - 用户设置与历史存储模块

/**
 * 保存用户设置到 localStorage
 */
export function saveUserSettings(currentBPM, metronomeEnabled, sensitivityLevel, currentRhythm, customRhythms, DEBUG = false) {
  const settings = {
    bpm: currentBPM,
    metronomeEnabled: metronomeEnabled,
    sensitivityLevel: sensitivityLevel,
    currentRhythm: currentRhythm,
    customRhythms: customRhythms,
    savedAt: Date.now()
  };
  
  try {
    localStorage.setItem('guitarStrumUserSettings', JSON.stringify(settings));
    if (DEBUG) console.log('[GuitarStrumTrainer] 用户设置已保存');
  } catch (e) {
    if (DEBUG) console.warn('无法保存用户设置:', e);
  }
}

/**
 * 从 localStorage 加载用户设置
 * @returns {object} 设置对象
 */
export function loadUserSettings(customRhythmsRef, DEBUG = false) {
  const result = {
    bpm: null,
    metronomeEnabled: null,
    sensitivityLevel: null,
    currentRhythm: null
  };
  
  try {
    const stored = localStorage.getItem('guitarStrumUserSettings');
    if (!stored) return result;
    
    const settings = JSON.parse(stored);
    
    // 恢复自定义节奏型（必须先加载，因为节奏型选择依赖它）
    if (settings.customRhythms && Array.isArray(settings.customRhythms) && settings.customRhythms.length > 0) {
      customRhythmsRef.length = 0;
      customRhythmsRef.push(...settings.customRhythms);
    }
    
    // 恢复 BPM
    if (settings.bpm) {
      result.bpm = settings.bpm;
    }
    
    // 恢复节拍器状态
    if (settings.metronomeEnabled !== undefined) {
      result.metronomeEnabled = settings.metronomeEnabled;
    }
    
    // 恢复灵敏度
    if (settings.sensitivityLevel) {
      result.sensitivityLevel = settings.sensitivityLevel;
    }
    
    // 恢复节奏型选择
    if (settings.currentRhythm !== undefined) {
      result.currentRhythm = settings.currentRhythm;
    }
    
    if (DEBUG) console.log('[GuitarStrumTrainer] 用户设置已加载');
  } catch (e) {
    if (DEBUG) console.warn('无法加载用户设置:', e);
  }
  
  return result;
}

/**
 * 保存历史记录到 localStorage
 */
export function saveHistory(strumHistory, detectedStrums, totalScoreEl, rhythmScoreEl, toneScoreEl, dynamicsScoreEl, 
                            currentRhythm, currentBPM, currentTrainingMode, practiceMode, practiceChordTotal, 
                            practiceChordCorrect, practiceTransitionTimes, transitionDetector, RHYTHM_PATTERNS, 
                            getActiveRhythm, practiceStartTime) {
  const pattern = getActiveRhythm(currentRhythm);
  const totalScore = parseInt(totalScoreEl.textContent);
  const safeTotalScore = isNaN(totalScore) ? 0 : totalScore;
  
  const transitionStats = transitionDetector ? transitionDetector.getStats() : null;
  const transitionCount = transitionStats ? transitionStats.transitionCount : 0;
  const avgTransitionTime = transitionStats ? Math.round(transitionStats.avgTransitionTime) : 0;
  
  const accuracy = practiceChordTotal > 0 ? Math.round((practiceChordCorrect / practiceChordTotal) * 100) : 0;
  
  const bestTransition = practiceTransitionTimes.length > 0 ? Math.round(Math.min(...practiceTransitionTimes)) : 0;
  const worstTransition = practiceTransitionTimes.length > 0 ? Math.round(Math.max(...practiceTransitionTimes)) : 0;
  
  const duration = practiceStartTime > 0 ? Math.round((Date.now() - practiceStartTime) / 1000) : 0;
  
  const historyItem = {
    date: new Date().toISOString(),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    rhythm: pattern.name,
    rhythmIndex: currentRhythm,
    score: safeTotalScore,
    rhythmScore: parseInt(rhythmScoreEl.textContent) || 0,
    toneScore: parseInt(toneScoreEl.textContent) || 0,
    dynamicsScore: parseInt(dynamicsScoreEl.textContent) || 0,
    strums: detectedStrums.length,
    bpm: currentBPM,
    mode: currentTrainingMode,
    practiceMode: practiceMode,
    chordAccuracy: accuracy,
    avgTransitionTime: avgTransitionTime,
    transitionCount: transitionCount,
    bestTransition: bestTransition,
    worstTransition: worstTransition,
    duration: duration
  };
  
  strumHistory.unshift(historyItem);
  if (strumHistory.length > 50) {
    strumHistory.pop();
  }
  
  // 持久化到 localStorage
  try {
    localStorage.setItem('guitarStrumHistory', JSON.stringify(strumHistory));
  } catch (e) {
    if (DEBUG) console.warn('无法保存历史记录:', e);
  }
  
  return historyItem;
}

/**
 * 从 localStorage 加载历史记录
 * @returns {Array} 历史记录数组
 */
export function loadHistoryFromStorage() {
  try {
    const stored = localStorage.getItem('guitarStrumHistory');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    if (DEBUG) console.warn('无法加载历史记录:', e);
  }
  return [];
}

/**
 * 导出用户设置为 JSON 文件
 */
export function exportUserSettings(currentBPM, metronomeEnabled, sensitivityLevel, customRhythms, DEBUG = false) {
  const settings = {
    bpm: currentBPM,
    metronomeEnabled: metronomeEnabled,
    sensitivityLevel: sensitivityLevel,
    customRhythms: customRhythms,
    exportedAt: new Date().toISOString()
  };
  
  const dataStr = JSON.stringify(settings, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `guitar-strum-settings-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
  if (DEBUG) console.log('[GuitarStrumTrainer] 设置已导出');
}

/**
 * 导入用户设置从 JSON 文件
 */
export function importUserSettings(event, customRhythmsRef, callbacks, DEBUG = false) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const settings = JSON.parse(e.target.result);
      
      // 数据类型和范围验证
      if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
        throw new Error('设置数据格式无效');
      }
      
      // 验证 customRhythms
      if (settings.customRhythms !== undefined) {
        if (!Array.isArray(settings.customRhythms)) {
          throw new Error('customRhythms 必须是数组');
        }
        for (let i = 0; i < settings.customRhythms.length; i++) {
          const rhythm = settings.customRhythms[i];
          if (typeof rhythm !== 'object' || rhythm === null) {
            throw new Error(`customRhythms[${i}] 格式无效`);
          }
          if (typeof rhythm.name !== 'string' || rhythm.name.length === 0) {
            throw new Error(`customRhythms[${i}].name 必须是有效字符串`);
          }
          if (rhythm.notes !== undefined) {
            if (!Array.isArray(rhythm.notes)) {
              throw new Error(`customRhythms[${i}].notes 必须是数组`);
            }
            for (let j = 0; j < rhythm.notes.length; j++) {
              const note = rhythm.notes[j];
              if (typeof note !== 'object' || note === null) {
                throw new Error(`customRhythms[${i}].notes[${j}] 格式无效`);
              }
              if (!['D', 'U'].includes(note.direction)) {
                throw new Error(`customRhythms[${i}].notes[${j}].direction 必须是 'D' 或 'U'`);
              }
              if (!['8th', '16th'].includes(note.duration)) {
                throw new Error(`customRhythms[${i}].notes[${j}].duration 必须是 '8th' 或 '16th'`);
              }
            }
          }
        }
        customRhythmsRef.length = 0;
        customRhythmsRef.push(...settings.customRhythms);
        if (callbacks.saveCustomRhythms) callbacks.saveCustomRhythms();
      }
      
      // 验证并导入 BPM（范围 30-300）
      let bpm = null;
      if (settings.bpm !== undefined) {
        const bpmNum = Number(settings.bpm);
        if (typeof bpmNum !== 'number' || isNaN(bpmNum) || bpmNum < 30 || bpmNum > 300) {
          throw new Error('bpm 必须是 30-300 之间的数字');
        }
        bpm = bpmNum;
      }
      
      // 验证并导入 metronomeEnabled
      let metronomeEnabled = null;
      if (settings.metronomeEnabled !== undefined) {
        if (typeof settings.metronomeEnabled !== 'boolean') {
          throw new Error('metronomeEnabled 必须是布尔值');
        }
        metronomeEnabled = settings.metronomeEnabled;
      }
      
      // 验证并导入 sensitivityLevel（范围 1-100）
      let sensitivityLevel = null;
      if (settings.sensitivityLevel !== undefined) {
        const sens = Number(settings.sensitivityLevel);
        if (typeof sens !== 'number' || isNaN(sens) || sens < 1 || sens > 100) {
          throw new Error('sensitivityLevel 必须是 1-100 之间的数字');
        }
        sensitivityLevel = sens;
      }
      
      // 更新 UI
      if (callbacks.updateUI) {
        callbacks.updateUI(bpm, metronomeEnabled, sensitivityLevel);
      }
      
      if (callbacks.renderCustomRhythmsList) {
        callbacks.renderCustomRhythmsList();
      }
      
      alert('设置导入成功！');
    } catch (err) {
      alert('导入失败：' + (err.message || '文件格式错误'));
      if (DEBUG) console.error('导入设置失败:', err);
    }
  };
  reader.readAsText(file);
  
  // 清空文件输入，允许重复导入同一文件
  event.target.value = '';
}
