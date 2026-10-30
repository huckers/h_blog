#!/usr/bin/env node
/**
 * 找 hugo 并透传参数。
 *
 * 为什么需要这一层：Hugo 是单二进制，不走 npm，所以不一定在 PATH 上。
 * 这里按 HUGO_BIN → ~/.hugo-bin/ → PATH 的顺序找，找到就执行。
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);

const candidates = [
  process.env.HUGO_BIN,
  join(homedir(), '.hugo-bin', 'hugo.exe'),
  join(homedir(), '.hugo-bin', 'hugo'),
  'hugo',
].filter(Boolean);

for (const bin of candidates) {
  if (bin !== 'hugo' && !existsSync(bin)) continue;
  const r = spawnSync(bin, args, { stdio: 'inherit' });
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
