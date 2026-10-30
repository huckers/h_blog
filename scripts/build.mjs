#!/usr/bin/env node
/**
 * 构建入口。本地和 Cloudflare 共用这一条命令，不用在 dashboard 里写条件语句。
 *
 * baseURL 的处理是这里存在的理由：
 *   本地构建              → hugo.toml 里的生产域名
 *   Workers Builds        → hugo.toml 里的生产域名（生产与预览都用）
 *   Pages 生产分支        → hugo.toml 里的生产域名
 *   Pages 预览/分支预览   → $CF_PAGES_URL（本次部署自己的哈希域名）
 *
 * 为什么 Workers 不用部署地址覆盖：官方文档列出的 Workers Builds 默认变量只有
 *   CI / WORKERS_CI / WORKERS_CI_BUILD_UUID / WORKERS_CI_COMMIT_SHA / WORKERS_CI_BRANCH，
 * 没有「本次部署 URL」。预览地址是部署时才分配的，构建期拿不到。
 * 预览继续用生产域名的 canonical，副作用是预览页不会被当成独立页面收录——这是想要的结果。
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- 1. frontmatter 校验，不通过就中断 ---------- */
const checked = spawnSync(process.execPath, [join(ROOT, 'scripts', 'check.mjs')], {
  stdio: 'inherit',
  cwd: ROOT,
});
if (checked.status !== 0) {
  console.error('\nfrontmatter 校验未通过，构建中止。');
  process.exit(checked.status ?? 1);
}

/* ---------- 2. 决定 baseURL ---------- */
function readProdBaseURL() {
  const toml = readFileSync(join(ROOT, 'hugo.toml'), 'utf8');
  const m = toml.match(/^\s*baseURL\s*=\s*"([^"]+)"/m);
  return m ? m[1] : null;
}

const PROD_BRANCH = process.env.PROD_BRANCH || 'main';
const onPages = Boolean(process.env.CF_PAGES);
const onWorkers = Boolean(process.env.WORKERS_CI);
const branch = process.env.CF_PAGES_BRANCH || process.env.WORKERS_CI_BRANCH || '';
const prodURL = readProdBaseURL();

const args = ['build', '--cleanDestinationDir'];
let note;
let effective = prodURL;

if (onPages && branch && branch !== PROD_BRANCH && process.env.CF_PAGES_URL) {
  effective = process.env.CF_PAGES_URL;
  args.push('--baseURL', effective);
  note = `Pages 预览部署 · 分支 ${branch} · baseURL = $CF_PAGES_URL`;
} else if (onPages) {
  if (prodURL) args.push('--baseURL', prodURL);
  note = `Pages 生产部署 · 分支 ${branch || PROD_BRANCH} · baseURL = hugo.toml`;
} else if (onWorkers) {
  if (prodURL) args.push('--baseURL', prodURL);
  note = `Workers Builds · 分支 ${branch || PROD_BRANCH} · baseURL = hugo.toml`;
} else {
  note = `本地构建 · baseURL = hugo.toml`;
}

console.log(`\n[build] ${note}${effective ? `（${effective}）` : ''}`);

/* ---------- 3. 找 hugo 并构建 ---------- */
const candidates = [
  process.env.HUGO_BIN,
  join(homedir(), '.hugo-bin', 'hugo.exe'),
  join(homedir(), '.hugo-bin', 'hugo'),
  'hugo',
].filter(Boolean);

for (const bin of candidates) {
  if (bin !== 'hugo' && !existsSync(bin)) continue;
  const r = spawnSync(bin, args, { stdio: 'inherit', cwd: ROOT });
  if (r.error && r.error.code === 'ENOENT') continue;
  process.exit(r.status ?? 1);
}

console.error(`
找不到 hugo。

安装（任选一种）：
  winget install Hugo.Hugo.Extended
  或下载 https://github.com/gohugoio/hugo/releases 解压到 ~/.hugo-bin/

也可以设置环境变量 HUGO_BIN 指向 hugo 可执行文件。
`);
process.exit(1);
