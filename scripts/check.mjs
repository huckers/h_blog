#!/usr/bin/env node
/**
 * frontmatter 校验 —— 在 hugo build 之前跑。
 *
 * 存在的理由：Hugo 对 frontmatter 的错误是静默的。
 * date 写成 2026.10.28 → 不报错，文章排到 0001 年；
 * tags 写成字符串 → 不报错，列表页那一列空白；
 * title 里有裸冒号 → 不报错，标题渲染成 map[...]。
 *
 * 这些状态都能构建成功、能上线。所以必须在这里把它们变成硬失败。
 *
 * 零依赖，只用 Node 内置模块。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT_DIR = join(ROOT, 'content', 'writing');

const REQUIRED = ['title', 'date', 'summary', 'tags'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/;

const KNOWN_KEYS = new Set([
  'title', 'date', 'summary', 'tags', 'series', 'seriesOrder',
  'draft', 'featured', 'updated', 'slug', 'description',
]);

const errors = [];
const warnings = [];

function err(file, msg) {
  errors.push({ file, msg });
}
function warn(file, msg) {
  warnings.push({ file, msg });
}

/* ---------- 极简 YAML 解析：只覆盖本博客用到的子集 ---------- */
function unquote(v) {
  const s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseInlineArray(v) {
  const inner = v.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!inner.trim()) return [];
  return inner.split(',').map((x) => unquote(x).trim()).filter(Boolean);
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;

  const out = {};
  const rawValues = {};
  let curKey = null;

  for (const line of m[1].split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;

    const item = line.match(/^\s+-\s+(.*)$/) || line.match(/^-\s+(.*)$/);
    if (item && curKey) {
      if (!Array.isArray(out[curKey])) out[curKey] = [];
      out[curKey].push(unquote(item[1]));
      continue;
    }

    const kv = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (kv) {
      curKey = kv[1];
      const v = kv[2].trim();
      rawValues[curKey] = v;
      if (v === '') out[curKey] = '';
      else if (v.startsWith('[')) out[curKey] = parseInlineArray(v);
      else if (v === 'true') out[curKey] = true;
      else if (v === 'false') out[curKey] = false;
      else out[curKey] = unquote(v);
      continue;
    }

    // 形如 `  key: value` 但没有顶级 key —— 多半是 YAML 被解析成了嵌套结构
    if (/^\s+\S+:/.test(line)) {
      err(curKey || '?', '疑似嵌套映射：值里出现未加引号的 ": "，请给整行值加引号');
    }
  }

  return { data: out, raw: rawValues };
}

/* ---------- 逐文件检查 ---------- */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(CONTENT_DIR);

for (const abs of files) {
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  const name = basename(abs);
  const raw = readFileSync(abs, 'utf8');

  if (!SLUG_RE.test(name)) {
    err(rel, `文件名必须是 ASCII slug（小写字母、数字、连字符），当前是「${name}」。URL 会变成百分号编码。`);
  }

  const fm = parseFrontmatter(raw);
  if (!fm) {
    err(rel, '找不到 frontmatter（文件必须以 --- 开头，且第一段 --- 结束）');
    continue;
  }
  const { data, raw: rawValues } = fm;

  for (const key of REQUIRED) {
    if (!(key in data) || data[key] === '' || data[key] === null) {
      err(rel, `缺少必需字段 ${key}`);
    }
  }

  for (const key of Object.keys(data)) {
    if (!KNOWN_KEYS.has(key)) {
      warn(rel, `未知字段 ${key}（拼错了？Hugo 会静默忽略）`);
    }
  }

  if (data.date && !DATE_RE.test(String(data.date))) {
    err(rel, `date 格式错误：「${data.date}」。必须是 YYYY-MM-DD，写成点号会被当成零值排到 0001 年`);
  }
  if (data.updated && !DATE_RE.test(String(data.updated))) {
    err(rel, `updated 格式错误：「${data.updated}」。必须是 YYYY-MM-DD`);
  }

  if (data.title) {
    const t = String(data.title);
    if (t.length < 4) err(rel, `title 太短（${t.length} 字）`);
    if (t.length > 90) err(rel, `title 太长（${t.length} 字），正文列会被折成四行以上`);
    if (!/^["']/.test(rawValues.title || '') && /:\s/.test(t)) {
      err(rel, 'title 里含未加引号的英文冒号加空格，YAML 会把它解析成嵌套映射。请给整行加引号');
    }
  }

  if (data.summary !== undefined) {
    const s = String(data.summary);
    if (s.length < 10) err(rel, `summary 太短（${s.length} 字），至少 10 字`);
    if (s.length > 300) err(rel, `summary 太长（${s.length} 字），会撑破列表页副标题和 meta description`);
  }

  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      err(rel, 'tags 必须是数组，例如 ["部署", "Hugo"]。写成字符串会让首页「主题」列变成空白');
    } else {
      if (data.tags.length === 0) err(rel, 'tags 不能为空数组，至少写一个');
      if (data.tags.length > 6) warn(rel, `tags 有 ${data.tags.length} 个，建议不超过 6 个`);
      for (const t of data.tags) {
        if (!String(t).trim()) err(rel, 'tags 里有空值');
      }
    }
  }

  if (data.series && !data.seriesOrder) {
    warn(rel, `属于系列「${data.series}」但没有 seriesOrder，系列页会按日期排序`);
  }
  if (data.seriesOrder && !data.series) {
    warn(rel, '有 seriesOrder 但没有 series');
  }

  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();
  if (body.length < 50) {
    err(rel, `正文太短（${body.length} 字符），这个长度不像一篇文章`);
  }
}

/* ---------- 输出 ---------- */
const ok = errors.length === 0;

for (const w of warnings) {
  console.warn(`  ! ${w.file}\n      ${w.msg}`);
}
for (const e of errors) {
  console.error(`  x ${e.file}\n      ${e.msg}`);
}

if (!ok) {
  console.error(`\nfrontmatter 校验失败：${errors.length} 个错误，${files.length} 个文件已检查。`);
  console.error('修好再 build —— 这些错误 Hugo 都不会替你报。\n');
  process.exit(1);
}

console.log(`frontmatter 校验通过：${files.length} 篇${warnings.length ? `，${warnings.length} 个提醒` : ''}`);
