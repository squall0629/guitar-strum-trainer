// 吉他扫弦练习助手 - 全局常量定义
// 集中管理所有硬编码的数值，提高可维护性

// ========== BPM 和节奏常量 ==========
export const DEFAULT_BPM = 70;
export const MIN_BPM = 40;
export const MAX_BPM = 200;

// ========== 时间间隔（毫秒） ==========
export const ANALYZE_INTERVAL = 50;           // 音频分析间隔 (~20fps，降低 CPU 占用)
export const UI_UPDATE_INTERVAL = 100;        // UI 更新间隔 (~10fps，分离音频分析和 UI 渲染)
export const RECORDER_DRAW_INTERVAL = 100;    // 波形绘制间隔 (10fps)
export const SPECTRUM_DRAW_INTERVAL = 67;      // 频谱绘制间隔 (15fps)
export const METRONOME_DOT_TIMEOUT = 150;      // 节拍器光点显示时长
export const TUNER_UPDATE_INTERVAL = 50;       // 调音器更新间隔
export const AUTO_SAVE_INTERVAL = 5000;        // 自动保存间隔
export const INIT_TUNER_DELAY = 500;           // 初始化调音器延迟
export const CANVAS_RESIZE_DEBOUNCE = 250;     // Canvas 调整防抖延迟

// ========== 评分历史常量 ==========
export const MAX_HISTORY = 10;                // 最大历史记录数
export const STABILITY_MIN_HISTORY = 4;        // 计算稳定性所需最小记录数
export const MIN_MEASURE_STRUMS = 1;           // 最少扫弦数才评分

// ========== 音频参数 - Analyser ==========
export const FFT_SIZE = 2048;
export const ANALYSER_SMOOTHING = 0.5;

// ========== 音频参数 - 麦克风增益 ==========
export const MIC_GAIN = 15.0;

// ========== 音频参数 - Canvas 尺寸 ==========
export const DEFAULT_CANVAS_WIDTH = 600;
export const DEFAULT_CANVAS_HEIGHT = 120;

// ========== 音频参数 - 缓冲区 ==========
export const RECORDER_BUFFER_SIZE = 300;
export const SPECTRUM_HISTORY_SIZE = 60;
export const TUNER_BUFFER_SIZE = 8192;

// ========== 音频参数 - Spectral Flux ==========
export const FLUX_BUFFER_SIZE = 43;
export const FLUX_COOLDOWN_FRAMES = 3;
export const FLUX_MIN_BUFFER = 3;

// ========== 灵敏度常量 ==========
export const DEFAULT_SENSITIVITY = 50;
export const MIN_SENSITIVITY = 1;
export const MAX_SENSITIVITY = 100;
export const DEFAULT_STRUM_THRESHOLD = 0.30;
export const MIN_STRUM_THRESHOLD = 0.01;
export const MAX_STRUM_THRESHOLD = 0.30;

// ========== 扫弦检测常量 ==========
export const BASE_MIN_STRUM_INTERVAL = 200;    // 基础最小扫弦间隔 (ms, 120BPM)
export const DETECTED_STRUMS_MAX = 20;         // 检测到的扫弦历史最大数量

// ========== 评分阈值 - 节奏稳定性 ==========
export const CV_EXCELLENT = 0.10;              // 非常稳定 CV < 10%
export const CV_GOOD = 0.20;                   // 较稳定 CV < 20%
export const CV_FAIR = 0.30;                   // 波动大 CV < 30%

// ========== 评分权重 ==========
export const SCORE_WEIGHT_RHYTHM = 0.4;
export const SCORE_WEIGHT_TONE = 0.25;
export const SCORE_WEIGHT_DYNAMICS = 0.15;
export const SCORE_WEIGHT_TRANSITION = 0.2;

// 转换评分权重
export const TRANSITION_WEIGHT_TIME = 0.7;
export const TRANSITION_WEIGHT_ACCURACY = 0.3;

// ========== 音色评分阈值 ==========
export const TONE_MIN_IDEAL = 60;
export const TONE_MAX_IDEAL = 200;
export const TONE_HIGH = 150;
export const TONE_VERY_HIGH = 200;

// ========== 力度评分阈值 ==========
export const AMPLITUDE_WEAK = 0.1;
export const AMPLITUDE_MEDIUM = 0.15;
export const AMPLITUDE_GOOD = 0.2;
export const AMPLITUDE_STRONG = 0.25;

// ========== 转换时间评分阈值 ==========
export const TRANSITION_TARGET_MS = 300;       // 目标转换时间 (优秀)
export const TRANSITION_MAX_MS = 800;         // 最大可接受转换时间

// ========== 调音器常量 ==========
export const TUNER_MIN_FREQ = 65;
export const TUNER_MAX_FREQ = 400;
export const TUNER_SMOOTHING_ALPHA = 0.25;
export const TUNER_CONFIDENCE_THRESHOLD = 0.75;
export const TUNER_HYSTERESIS_CENTS = 15;
export const TUNER_IN_TUNE_CENTS = 10;
export const TUNER_CLOSE_CENTS = 100;
export const TUNER_SMOOTHING_CONSTANT = 0.92;

// 吉他标准调弦频率
export const GUITAR_STRING_FREQUENCIES = {
  'E2': 82.41,   // 6 弦
  'A2': 110.00,  // 5 弦
  'D3': 146.83,  // 4 弦
  'G3': 196.00,  // 3 弦
  'B3': 246.94,  // 2 弦
  'E4': 329.63   // 1 弦
};

export const GUITAR_MIDI_NOTES = [40, 45, 50, 55, 59, 64]; // E2=40, A2=45, D3=50, G3=55, B3=59, E4=64

// ========== 节拍器常量 ==========
export const METRONOME_ACCENT_FREQ = 1200;
export const METRONOME_NORMAL_FREQ = 800;
export const METRONOME_DURATION = 0.05;        // 秒
export const METRONOME_GAIN = 0.3;

// 参考音音量
export const REFERENCE_TONE_GAIN = 0.3;

// ========== 频谱图常量 ==========
export const SPECTRUM_MIN_FREQ = 80;           // 频谱下限 (Hz)
export const SPECTRUM_MAX_FREQ = 1000;        // 频谱上限 (Hz)

// ========== UI 阈值 - 分数颜色 ==========
export const SCORE_COLOR_EXCELLENT = 80;
export const SCORE_COLOR_GOOD = 60;

// ========== UI 阈值 - 转换时间颜色 ==========
export const TRANSITION_TIME_EXCELLENT = 300;
export const TRANSITION_TIME_GOOD = 500;

// ========== UI 阈值 - 和弦识别置信度 ==========
export const CHORD_CONFIDENCE_HIGH = 0.8;
export const CHORD_CONFIDENCE_MEDIUM = 0.65;

// ========== 流畅度评分常量 ==========
export const FLUENCY_TIME_EXCELLENT = 300;
export const FLUENCY_TIME_GOOD = 500;
export const FLUENCY_TIME_FAIR = 1000;
export const FLUENCY_WEIGHT_TIME = 0.6;
export const FLUENCY_WEIGHT_CONSISTENCY = 0.4;

// ========== 参考 BPM（用于缩放计算） ==========
export const REFERENCE_BPM = 120;

// ========== 重播防抖 ==========
export const DEMO_CLICK_DEBOUNCE = 100;

// ========== 麦克风测试常量 ==========
export const MIC_TEST_CHECK_COUNT = 30;
export const MIC_TEST_SIGNAL_THRESHOLD = 10;
export const MIC_TEST_RESET_DELAY = 3000;
export const MIC_TEST_VOLUME_SCALE = 128;

// ========== 调试模式 ==========
export const DEBUG = false;
export const APP_VERSION = 'v2.1';