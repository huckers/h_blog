// 截图目检：node scripts/shots.mjs [baseURL]；输出到 .shots/
import { mkdirSync } from 'node:fs';

const PW = process.env.PW_PATH || 'playwright';
let chromium;
try {
  ({ chromium } = await import(PW));
} catch {
  console.error('找不到 playwright，先 npx playwright install chromium');
  process.exit(2);
}

const BASE = process.argv[2] || 'http://localhost:1414';
const OUT = '.shots';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['home', '/'],
  ['writing', '/writing/'],
  ['article', '/writing/astro-to-hugo/'],
  ['archive', '/archive/'],
  ['series', '/series/' + encodeURIComponent('把这个博客搭起来') + '/'],
  ['tag', '/tags/hugo/'],
  ['about', '/about/'],
  ['404', '/404.html'],
];

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

for (const [name, path] of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForTimeout(250);
  // 每页只截首屏（横向对齐看首屏最直观）
  await page.screenshot({ path: `${OUT}/${name}-top.png` });
  console.log(`${OUT}/${name}-top.png`);
}

await browser.close();
