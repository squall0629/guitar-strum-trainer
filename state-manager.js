// 吉他扫弦练习助手 - 状态管理模块
// 功能：集中管理应用状态，避免 window 全局变量污染

import EventBus, { Events } from './event-bus.js';

const StateManager = (() => {
  const state = {
    currentBPM: 120,
    metronomeEnabled: false,
    sensitivityLevel: 50,
    currentRhythm: 0,
    currentMode: 'tuner',
    practiceMode: 'tuner',
    isListening: false,
    isPlayingDemo: false,
    practiceStartTime: 0,
    practiceChordCorrect: 0,
    practiceChordTotal: 0,
    practiceTransitionTimes: [],
    guitarSoundfont: null,
    guitarAudioContext: null
  };

  const subscribers = new Map();

  function subscribe(key, callback) {
    if (!subscribers.has(key)) {
      subscribers.set(key, new Set());
    }
    subscribers.get(key).add(callback);
    return () => unsubscribe(key, callback);
  }

  function unsubscribe(key, callback) {
    if (subscribers.has(key)) {
      subscribers.get(key).delete(callback);
    }
  }

  function notify(key) {
    if (subscribers.has(key)) {
      subscribers.get(key).forEach(callback => callback(state[key]));
    }
    EventBus.emit(Events.SENSITIVITY_CHANGE, { key, value: state[key] });
  }

  function get(key) {
    return state[key];
  }

  function set(key, value) {
    if (state[key] !== value) {
      state[key] = value;
      notify(key);
    }
  }

  function getState() {
    return { ...state };
  }

  function setState(updates) {
    Object.keys(updates).forEach(key => {
      if (key in state) {
        set(key, updates[key]);
      }
    });
  }

  return {
    get,
    set,
    getState,
    setState,
    subscribe,
    unsubscribe
  };
})();

export const AppState = {
  getBPM: () => StateManager.get('currentBPM'),
  setBPM: (value) => StateManager.set('currentBPM', value),
  getMetronomeEnabled: () => StateManager.get('metronomeEnabled'),
  setMetronomeEnabled: (value) => StateManager.set('metronomeEnabled', value),
  getSensitivityLevel: () => StateManager.get('sensitivityLevel'),
  setSensitivityLevel: (value) => StateManager.set('sensitivityLevel', value),
  getCurrentRhythm: () => StateManager.get('currentRhythm'),
  setCurrentRhythm: (value) => StateManager.set('currentRhythm', value),
  getCurrentMode: () => StateManager.get('currentMode'),
  setCurrentMode: (value) => StateManager.set('currentMode', value),
  getPracticeMode: () => StateManager.get('practiceMode'),
  setPracticeMode: (value) => StateManager.set('practiceMode', value),
  getIsListening: () => StateManager.get('isListening'),
  setIsListening: (value) => StateManager.set('isListening', value),
  getIsPlayingDemo: () => StateManager.get('isPlayingDemo'),
  setIsPlayingDemo: (value) => StateManager.set('isPlayingDemo', value),
  getPracticeStartTime: () => StateManager.get('practiceStartTime'),
  setPracticeStartTime: (value) => StateManager.set('practiceStartTime', value),
  getPracticeChordStats: () => ({
    correct: StateManager.get('practiceChordCorrect'),
    total: StateManager.get('practiceChordTotal')
  }),
  incrementPracticeChordCorrect: () => StateManager.set('practiceChordCorrect', StateManager.get('practiceChordCorrect') + 1),
  incrementPracticeChordTotal: () => StateManager.set('practiceChordTotal', StateManager.get('practiceChordTotal') + 1),
  getPracticeTransitionTimes: () => StateManager.get('practiceTransitionTimes'),
  addPracticeTransitionTime: (time) => {
    const times = StateManager.get('practiceTransitionTimes');
    times.push(time);
    StateManager.set('practiceTransitionTimes', times);
  },
  getGuitarSoundfont: () => StateManager.get('guitarSoundfont'),
  setGuitarSoundfont: (value) => StateManager.set('guitarSoundfont', value),
  getGuitarAudioContext: () => StateManager.get('guitarAudioContext'),
  setGuitarAudioContext: (value) => StateManager.set('guitarAudioContext', value),
  getState: () => StateManager.getState()
};

export default StateManager;
