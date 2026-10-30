// 找出在窄视口下把页面撑宽的元素
const PW = process.env.PW_PATH || 'playwright';
const { chromium } = await import(PW);
const BASE = process.env.BASE || 'http://localhost:1414';
const W = Number(process.env.W || 390);

const PAGES = [
  ['首页', '/'],
  ['写作列表', '/writing/'],
  ['文章页', '/writing/astro-to-hugo/'],
];

const browser = await chromium.launch({
  headless: process.env.HEADFUL ? false : true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const ctx = await browser.newContext({ viewport: { width: W, height: 900 } });
const page = await ctx.newPage();

for (const [name, path] of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  // 用真实 clientWidth 做基准，而不是视口宽：无头是 overlay 滚动条，
  // 两者相等，症状会被掩盖。
  const clientW = await page.evaluate(() => document.documentElement.clientWidth);
  const bad = await page.evaluate((vw) => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const right = r.left + r.width;
      if (right > vw + 0.5) {
        const cs = getComputedStyle(el);
        // 只报"自身就是元凶"的：父元素没溢出，或自身有固定宽度
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 40),
          left: Math.round(r.left),
          right: Math.round(right),
          w: Math.round(r.width),
          cssW: cs.width,
          overflowX: cs.overflowX,
          pos: cs.position,
          depth: (() => {
            let d = 0,
              p = el;
            while ((p = p.parentElement)) d++;
            return d;
          })(),
        });
      }
    }
    return out.sort((a, b) => b.right - a.right).slice(0, 12);
  }, clientW);

  console.log(`\n===== ${name} @ 视口${W} / clientW${clientW} =====`);
  if (!bad.length) console.log('  无溢出元素');
  for (const b of bad) {
    console.log(
      `  d${b.depth} ${b.tag}.${b.cls} x:${b.left}→${b.right} w:${b.w} cssW:${b.cssW} ovf:${b.overflowX} pos:${b.pos}`
    );
  }
}

await browser.close();
