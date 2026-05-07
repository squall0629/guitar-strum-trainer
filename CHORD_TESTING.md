# 和弦识别功能测试说明 v2.0

**日期**: 2026-04-03  
**版本**: v2.0.0  
**技术方案**: tonaljs + chordictionaryjs + 自研 FFT

---

## 一、技术架构

### 技术栈
| 模块 | 库 | 说明 |
|------|-----|------|
| 音频分析 | Web Audio API | 自研 FFT 频谱分析 |
| 和弦识别 | @tonaljs/chord-detect | tonaljs 和弦检测 |
| 和弦字典 | chordictionaryjs | 指法数据 + SVG 生成 |
| 音高转换 | tonal/Note | 频率→音名转换 |

### 识别流程
```
麦克风输入 → FFT 分析 → 峰值检测 → 提取音符数组
    ↓
@tonaljs/chord-detect → 和弦名称
    ↓
chordictionaryjs → 指法图 SVG
    ↓
Canvas 渲染 → UI 显示
```

---

## 二、新增功能

### 1. 训练模式
- 📖 **预设进行**: 5 个常用和弦进行（1645/4536/卡农/蓝调/初学者）
- ✏️ **自定义**: 从 10 个基础和弦自由选择和弦
- 🎸 **自由练习**: 无限制识别任意和弦

### 2. 和弦库（10 个基础）
| 和弦 | 难度 | 说明 |
|------|------|------|
| C | ⭐ | C 大调 |
| G | ⭐ | G 大调 |
| D | ⭐ | D 大调 |
| Am | ⭐ | A 小调 |
| Em | ⭐ | E 小调 |
| E | ⭐⭐ | E 大调 |
| A | ⭐⭐ | A 大调 |
| F | ⭐⭐⭐ | F 大调 (简化) |
| Dm | ⭐⭐ | D 小调 |
| Cmaj7 | ⭐⭐ | C 大七 |

### 3. 核心功能
- ✅ FFT 频谱分析（2048 点）
- ✅ 峰值检测（提取主要音符）
- ✅ tonaljs 和弦识别
- ✅ chordictionary 指法图 SVG 生成
- ✅ 双匹配验证（tonal + 弦能量）
- ✅ 置信度评估
- ✅ 转换时间检测
- ✅ 实时反馈

---

## 三、测试步骤

### 准备工作
```bash
cd /Users/yang/.openclaw/workspace-se/projects/guitar-strum-trainer
npm install
npm start
```

浏览器打开 http://localhost:3000，允许麦克风访问。

### 测试用例

#### TC-001: 基础和弦识别
**步骤**:
1. 选择"自由练习"模式
2. 清晰弹奏 C 和弦
3. 观察识别结果

**预期**:
- 识别显示"C"
- 置信度 ≥ 75%
- 指法图正确显示

---

#### TC-002: tonaljs 识别准确性
**步骤**:
1. 自由练习模式
2. 依次弹奏：C → G → D → Am → Em
3. 每个和弦保持 2 秒

**预期**:
- 5 个和弦识别准确率 ≥ 80%
- 识别延迟 < 100ms
- 指法图同步更新

---

#### TC-003: 和弦转换检测
**步骤**:
1. 预设进行 → "初学者 C-G"
2. 开始练习
3. 弹奏 C → G → C → G（4 次转换）

**预期**:
- 当前/下一个和弦正确显示
- 转换时间记录在 200-800ms
- 准确率统计正确

---

#### TC-004: 自定义和弦进行
**步骤**:
1. 自定义模式
2. 点击：C → Am → F → G
3. 保存为"我的 1645"
4. 开始练习

**预期**:
- 已选和弦显示正确
- 保存成功
- 练习时按顺序显示

---

#### TC-005: 指法图 SVG 显示
**步骤**:
1. 任意模式
2. 观察所有 10 个和弦的指法图

**预期**:
- SVG 清晰渲染
- 按弦位置准确（蓝点）
- 空弦显示（白圈）
- 不弹的弦显示（红×）

---

#### TC-006: 置信度反馈
**步骤**:
1. 自由练习
2. 清晰弹奏 C 和弦
3. 轻扫或不完全按住

**预期**:
- 清晰：绿色 ≥80%
- 不清：橙色/红色 <80%

---

## 四、性能指标

### 识别准确率目标
| 和弦 | 目标 | 实际 |
|------|------|------|
| C | ≥85% | 待测 |
| G | ≥85% | 待测 |
| D | ≥85% | 待测 |
| Am | ≥85% | 待测 |
| Em | ≥85% | 待测 |
| E | ≥80% | 待测 |
| A | ≥80% | 待测 |
| F | ≥75% | 待测 |
| Dm | ≥80% | 待测 |
| Cmaj7 | ≥80% | 待测 |

### 系统性能
- 识别延迟：<100ms
- CPU 占用：<15%
- 内存占用：<200MB

---

## 五、调试工具

浏览器控制台（F12）可用命令：

```javascript
// 获取检测器实例
window.guitarTrainer.chordDetector()
window.guitarTrainer.transitionDetector()

// 获取当前进行
window.guitarTrainer.getProgression()

// 获取统计
window.guitarTrainer.getStats()

// 切换模式
window.guitarTrainer.setTrainingMode('free')

// 测试和弦库
import('./chord-library.js').then(lib => {
  console.log(lib.getChordSVG('C'));
  console.log(lib.getChordData('Am'));
});

// 测试 tonaljs 识别
import('@tonaljs/chord-detect').then(({ ChordDetect }) => {
  const chord = ChordDetect.detect(['C3', 'E3', 'G3']);
  console.log('识别结果:', chord); // 'C'
});
```

---

## 六、已知限制

### 当前限制
1. **仅开放和弦**: 不支持横按和弦（F 用简化版）
2. **环境敏感**: 背景噪音影响识别
3. **需要调音**: 吉他音准必须准确
4. **单音识别**: 针对和弦优化

### 改进方向
1. **机器学习**: CNN 模型提高准确率
2. **用户校准**: 录制个人样本
3. **噪音抑制**: 改进预处理
4. **复杂和弦**: 七和弦、九和弦

---

## 七、故障排查

### 问题：和弦识别不响应
**解决**:
1. 检查麦克风权限
2. 调高灵敏度（60-80）
3. 确保吉他音量足够
4. 查看控制台错误

### 问题：识别准确率低
**解决**:
1. 确保吉他已调音
2. 每根弦清晰发声
3. 避免触碰相邻弦
4. 安静环境练习

### 问题：指法图不显示
**解决**:
1. 检查 chordictionary 加载
2. 查看控制台 SVG 错误
3. 刷新页面重试

---

## 八、文件结构

```
guitar-strum-trainer/
├── index.html              # UI（和弦训练区域）
├── renderer.js             # 主逻辑（集成识别）
├── chord-library.js        # 和弦库（chordictionary 封装）
├── chord-detector.js       # 检测器（tonaljs + FFT）
├── package.json            # 依赖配置
└── CHORD_TESTING.md        # 测试文档
```

---

## 九、依赖版本

```json
{
  "tonal": "^6.4.3",
  "@tonaljs/chord-detect": "^4.9.1",
  "chordictionary": "^0.1.0-beta.4",
  "soundfont-player": "^0.12.0"
}
```

---

## 十、验收标准

| 需求 | 要求 | 实现 | 状态 |
|------|------|------|------|
| 和弦识别 | ≥85% | tonaljs+ 验证 | ⏳待测 |
| 识别延迟 | <100ms | RAF 循环 | ✅ |
| 和弦覆盖 | 10 个 | BASIC_CHORDS | ✅ |
| 训练模式 | 3 种 | 预设/自定义/自由 | ✅ |
| 指法图 | SVG | chordictionary | ✅ |
| 转换检测 | 是 | TransitionDetector | ✅ |
| 实时反馈 | 是 | 置信度 + 颜色 | ✅ |

---

**测试开始时间**: 待安排  
**测试负责人**: 老马  
**产品负责人**: 克总

_用代码创造价值，用技术驱动业务！_ ⚔️
