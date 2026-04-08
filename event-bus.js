// 吉他扫弦练习助手 - 事件总线模块
// 功能：发布/订阅模式，解耦模块循环依赖

const EventBus = (() => {
  const listeners = new Map();

  function on(event, callback) {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);
    return () => off(event, callback);
  }

  function off(event, callback) {
    if (listeners.has(event)) {
      listeners.get(event).delete(callback);
    }
  }

  function emit(event, data) {
    if (listeners.has(event)) {
      listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[EventBus] Event ${event} error:`, err);
        }
      });
    }
  }

  function once(event, callback) {
    const wrapper = (data) => {
      off(event, wrapper);
      callback(data);
    };
    return on(event, wrapper);
  }

  function clear(event) {
    if (event) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  }

  return { on, off, emit, once, clear };
})();

export const Events = {
  SENSITIVITY_CHANGE: 'sensitivity:change',
  SENSITIVITY_GET: 'sensitivity:get',
  BPM_CHANGE: 'bpm:change',
  METRONOME_TOGGLE: 'metronome:toggle',
  RHYTHM_SELECT: 'rhythm:select',
  LISTENING_START: 'listening:start',
  LISTENING_STOP: 'listening:stop',
  LISTENING_STATE: 'listening:state',
  STRUM_DETECTED: 'strum:detected',
  SCORE_UPDATE: 'score:update',
  MODE_CHANGE: 'mode:change',
  DEMO_PLAY: 'demo:play',
  DEMO_STOP: 'demo:stop',
  DEMO_STATE: 'demo:state',
  AUDIO_CONTEXT_GET: 'audio:context:get',
  AUDIO_ANALYSER_GET: 'audio:analyser:get',
  CHORD_DETECTED: 'chord:detected',
  PROGRESSION_UPDATE: 'progression:update',
  SETTINGS_LOAD: 'settings:load',
  SETTINGS_SAVE: 'settings:save',
  STATUS_UPDATE: 'status:update'
};

export default EventBus;
