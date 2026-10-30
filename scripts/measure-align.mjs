// 横向对齐实测：验证"页头/页脚"在所有页面左边界一致，且无横向溢出
//
// 用法:
//   npm run align                      # 默认 http://localhost:1414
//   npm run align -- http://127.0.0.1:1313
//
// 说明:
//   本项目零依赖，不装 playwright。若本机没有，先 `npx playwright install chromium`。
//   无头模式用 overlay 滚动条（clientWidth 恒等于视口宽），会掩盖真实现象，
//   要复现 Windows 经典 17px 滚动条必须 HEADFUL=1。
//   BROKEN=1 注入旧写法做 A/B 对照，用来验证修复的因果性，不是日常用。
//
//   注意视口必须包含 1920：--page 是 1440，只有视口宽于画布时 margin:auto
//   才会产生左右外边距，"有滚动条 / 没滚动条"造成的 7.5px 居中差才会显形。
const PW = process.env.PW_PATH || 'playwright';
let chromium;
try {
  ({ chromium } = await import(PW));
} catch {
  console.error(
    '找不到 playwright。请先执行：\n' +
      '  npx playwright install chromium\n' +
      '若 playwright 装在别处，用 PW_PATH 指定入口，例如：\n' +
      '  PW_PATH=file:///C:/path/to/playwright/index.mjs npm run align'
  );
  process.exit(2);
}

const BASE = process.argv[2] || 'http://localhost:1414';

const PAGES = [
  ['首页', '/'],
  ['写作列表', '/writing/'],
  ['文章页', '/writing/astro-to-hugo/'],
  ['归档', '/archive/'],
  ['系列', '/series/' + encodeURIComponent('把这个博客搭起来') + '/'],
  ['标签', '/tags/hugo/'],
  ['标签总览', '/tags/'],
  ['关于', '/about/'],
  ['检索', '/search/'],
  ['404', '/404.html'],
];

// 1920 必测：--page 是 1440，只有视口宽于画布时 margin:auto 才会产生
// 左右外边距，滚动条有无造成的居中差（7.5px）才会显形。
// 390 是移动端断点，主要看横向溢出有没有复发。
const WIDTHS = [1920, 1440, 1423, 390];

const browser = await chromium.launch({
  headless: process.env.HEADFUL ? false : true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
let fail = 0;

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1080 } });
  const page = await ctx.newPage();
  console.log(`\n===== viewport ${w} x 1080 =====`);
  console.log(
    'page'.padEnd(12) +
      'clientW'.padStart(9) +
      'scrollW'.padStart(9) +
      'ovf'.padStart(6) +
      'hdrL'.padStart(8) +
      'ftrL'.padStart(8) +
      'mainL'.padStart(8)
  );

  // 同一视口下所有页面的左边界必须完全一致，否则切换页面会横向晃动
  const seen = new Map();
  const collect = (label, v) => {
    if (!seen.has(label)) seen.set(label, []);
    seen.get(label).push(v);
  };

  for (const [name, path] of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'load' });
    await page.waitForTimeout(120);
    // A/B 对照：BROKEN=1 时还原旧的 body{min-width:1440px} + 滚动条按需出现，
    // 用来复现"短页面比长页面右移"的症状，验证修复的因果性。
    if (process.env.BROKEN) {
      await page.addStyleTag({
        content:
          'html{overflow-y:auto !important;}' +
          'body{min-width:1440px !important;}',
      });
      await page.waitForTimeout(80);
    }
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const left = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return Math.round(el.getBoundingClientRect().left * 10) / 10;
      };
      // 正文主容器的左内边缘（排除 padding 后的内容起点）
      const mainSel =
        '.page-head, .hero, .article-wrap, .arch-body, .series-head, .about-wrap, .results-wrap, .search-head, .wrap, .nf-hero';
      const el = document.querySelector(mainSel);
      const cs = el ? getComputedStyle(el) : null;
      const mainContentLeft = el
        ? Math.round((el.getBoundingClientRect().left + parseFloat(cs.paddingLeft || 0)) * 10) / 10
        : null;
      return {
        clientW: de.clientWidth,
        scrollW: de.scrollWidth,
        hdrL: left('.header .bar'),
        ftrL: left('.footer .fleft'),
        mainL: mainContentLeft,
      };
    });
    const ovf = m.scrollW - m.clientW;
    const f = (v) => (v === null ? '—' : String(v));
    console.log(
      name.padEnd(12) +
        String(m.clientW).padStart(9) +
        String(m.scrollW).padStart(9) +
        String(ovf).padStart(6) +
        f(m.hdrL).padStart(8) +
        f(m.ftrL).padStart(8) +
        f(m.mainL).padStart(8)
    );
    if (ovf > 0) {
      console.log(`   !! ${name} 横向溢出 ${ovf}px`);
      fail++;
    }
    collect('hdrL', m.hdrL);
    collect('ftrL', m.ftrL);
    // mainL 不参与一致性比较：文章页有 232px 左侧留白（版式设计），
    // 与列表页的 48px 不同是预期的，不是偏移。
  }

  for (const [label, vals] of seen) {
    const uniq = [...new Set(vals.filter((v) => v !== null))];
    if (uniq.length > 1) {
      console.log(`   !! ${label} 各页不一致: ${uniq.join(' / ')} → 切换会横向晃动`);
      fail++;
    }
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${fail === 0 ? 'PASS 全部对齐，无溢出' : `FAIL ${fail} 项`}`);
process.exit(fail === 0 ? 0 : 1);
