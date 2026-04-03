/**
 * 和弦库测试脚本
 * 用于验证 chordictionary 集成是否正常
 */

import { chordData, findChord, getChordSVG, getChordData, getChordNames } from './chord-library.js';

console.log('=== 和弦库测试 ===\n');

// 测试 1: 获取所有和弦名称
console.log('1. 支持和弦列表:');
const chordNames = getChordNames();
console.log('   ', chordNames.join(', '));
console.log('   总数:', chordNames.length, '\n');

// 测试 2: 查找特定和弦
console.log('2. 查找 C 和弦:');
const cChord = findChord('C');
if (cChord) {
  console.log('   名称:', cChord.name);
  console.log('   模板:', cChord.template.join(''));
  console.log('   音符:', cChord.notes.join(', '));
  console.log('   指法:', cChord.fingering.strings.join(', '));
  console.log('   难度:', '⭐'.repeat(cChord.difficulty));
} else {
  console.log('   ❌ 未找到 C 和弦');
}
console.log();

// 测试 3: 获取和弦指法数据
console.log('3. 获取 G 和弦指法数据:');
const gData = getChordData('G');
if (gData) {
  console.log('   名称:', gData.name);
  console.log('   TAB:', gData.tab);
  console.log('   指法:', gData.fingering);
} else {
  console.log('   ❌ 获取失败');
}
console.log();

// 测试 4: 生成和弦指法数据
console.log('4. 获取 Am 和弦指法数据:');
try {
  const amData = getChordSVG('Am');
  if (amData) {
    console.log('   ✓ 指法数据获取成功');
    console.log('   名称:', amData.name);
    console.log('   TAB:', amData.tab);
    console.log('   指法:', amData.fingering.strings.join(', '));
    console.log('   品格数:', amData.fingering.frets);
    console.log('   HTML 布局:', amData.layout ? '✓ 已生成' : '✗ 未生成');
  } else {
    console.log('   ❌ 数据为 null');
  }
} catch (e) {
  console.log('   ❌ 错误:', e.message);
}
console.log();

// 测试 5: 遍历所有和弦
console.log('5. 遍历所有和弦获取指法数据:');
let successCount = 0;
let failCount = 0;

chordNames.forEach(name => {
  try {
    const data = getChordSVG(name);
    if (data && data.fingering) {
      successCount++;
      console.log(`   ✓ ${name}: ${data.fingering.strings.join('')}`);
    } else {
      failCount++;
      console.log(`   ❌ ${name}: 数据不完整`);
    }
  } catch (e) {
    failCount++;
    console.log(`   ❌ ${name}: ${e.message}`);
  }
});

console.log('\n=== 测试结果 ===');
console.log(`成功：${successCount}/${chordNames.length}`);
console.log(`失败：${failCount}/${chordNames.length}`);
console.log(`成功率：${Math.round(successCount / chordNames.length * 100)}%`);

if (failCount === 0) {
  console.log('\n✅ 所有测试通过！');
} else {
  console.log('\n⚠️ 部分测试失败，请检查日志');
}
