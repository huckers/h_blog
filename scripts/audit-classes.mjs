/**
 * 一次性审计：模板里用到、但 CSS 里完全没有定义的 class。
 * 用来发现"以为写了样式其实没写"的地方。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const htmlFiles = walk('layouts').filter((f) => f.endsWith('.html'));
const cssText = ['assets/css/proto.css', 'assets/css/markdown.css']
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const used = new Map(); // class -> 首次出现的文件
for (const f of htmlFiles) {
  const src = readFileSync(f, 'utf8');
  // 先把 {{ ... }} 剥掉，否则 class="{{ if $x }}on{{ end }}" 会被拆成 if / on / end
  const cleaned = src.replace(/\{\{[\s\S]*?\}\}/g, ' ');
  for (const m of cleaned.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      const name = c.trim();
      if (!name || /[{}${}]/.test(name)) continue;
      if (!used.has(name)) used.set(name, relative('.', f));
    }
  }
}

const defined = new Set();
for (const m of cssText.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) defined.add(m[1]);

// 纯语义容器：布局由父级 flex 管，不需要自己的样式
const WHITELIST = new Set(['outline', 'topics']);

const missing = [...used.entries()]
  .filter(([name]) => !defined.has(name) && !WHITELIST.has(name))
  .sort((a, b) => a[0].localeCompare(b[0]));

if (!missing.length) {
  console.log('全部 class 都有样式定义');
} else {
  console.log(`有 ${missing.length} 个 class 在模板里用了但没有样式定义：\n`);
  for (const [name, file] of missing) console.log(`  .${name}    ← ${file}`);
}
