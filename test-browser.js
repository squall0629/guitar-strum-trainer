const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // 捕获控制台消息
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console', text: msg.text() });
    }
  });
  page.on('pageerror', err => {
    errors.push({ type: 'exception', text: err.message });
  });
  
  console.log('正在加载页面...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 10000 });
  
  // 等待页面完全加载
  await page.waitForTimeout(2000);
  
  // 检查关键元素
  const elements = await page.evaluate(() => {
    return {
      practiceModeRhythm: !!document.getElementById('practiceModeRhythm'),
      practiceModeComprehensive: !!document.getElementById('practiceModeComprehensive'),
      practiceModeDescription: !!document.getElementById('practiceModeDescription'),
      chordTrainingPanel: !!document.querySelector('.chord-training-panel'),
      btnStart: !!document.getElementById('btnStart'),
      chordTrainingPanelVisible: document.querySelector('.chord-training-panel')?.style.display !== 'none'
    };
  });
  
  console.log('\n=== 页面元素检查 ===');
  console.log(JSON.stringify(elements, null, 2));
  
  if (errors.length > 0) {
    console.log('\n=== 发现的错误 ===');
    errors.forEach((e, i) => {
      console.log(`${i + 1}. [${e.type}] ${e.text}`);
    });
  } else {
    console.log('\n=== 未发现控制台错误 ✅ ===');
  }
  
  // 测试模式切换
  console.log('\n=== 测试模式切换 ===');
  await page.click('#practiceModeComprehensive');
  await page.waitForTimeout(500);
  
  const afterClick = await page.evaluate(() => {
    const panel = document.querySelector('.chord-training-panel');
    const desc = document.getElementById('practiceModeDescription').textContent;
    const btnActive = document.getElementById('practiceModeComprehensive').classList.contains('active');
    return {
      chordTrainingPanelVisible: panel?.style.display !== 'none',
      description: desc,
      comprehensiveBtnActive: btnActive
    };
  });
  console.log(JSON.stringify(afterClick, null, 2));
  
  await browser.close();
  
  if (errors.length > 0) {
    console.log('\n❌ 测试失败：发现错误');
    process.exit(1);
  } else {
    console.log('\n✅ 测试通过');
    process.exit(0);
  }
})();
