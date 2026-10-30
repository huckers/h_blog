# H_BLOG

个人技术博客。Hugo 构建，模板手写，正文 Markdown。

写下 `.md` 文件、推送到远程，就是发布——没有后台、没有数据库、没有第二步。

| 项 | 值 |
|---|---|
| 站点 | <https://huc.site> |
| 源码 | <https://gitee.com/hucker/h_blog> |
| 设计稿 | `prototype/`（当前版本，落地依据）、`site/`（上一版，留档） |

---

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 生成器 | Hugo 0.169 extended | Go Template 手写模板，不用主题 |
| 样式 | 手写 CSS | 无框架，两层：设计系统 + Markdown 映射 |
| 交互 | 原生 JS | 约 250 行，无框架、无依赖 |
| 检索 | 构建期 JSON 索引 | 查询全在浏览器本地完成 |
| 部署 | Cloudflare Pages | 纯静态 |

构建耗时 200ms 量级。全流程零运行时依赖，不需要 `npm install`。

## 功能

### 页面

| 路由 | 内容 |
|---|---|
| `/` | 首页：主稿 + 台账 + 主题/现在/RSS 侧栏 |
| `/writing/` | 文章列表，双栏目录，每页 12 篇 |
| `/writing/:slug/` | 文章页：正文 + 右侧 OUTLINE / RELATED / SHARE |
| `/archive/` | 归档：按年分组，含统计与技术档案 |
| `/series/` | 系列总览 |
| `/series/:term/` | 系列详情：编号 + 分期刻度 + 篇目列表 |
| `/tags/`、`/tags/:term/` | 主题总览与单项 |
| `/about/` | 关于：正文 + 规格表 + 站点信息 |
| `/search/` | 站内检索 |
| `/404.html` | 404 |

同时产出 `index.xml`（RSS）、`index.json`（检索索引）、`sitemap.xml`、`robots.txt`。

### 检索

索引在构建时生成，含标题、URL、日期、标签、摘要和正文前 1500 字。支持：

- 裸词 — 空格分隔即交集
- `"短语"` — 精确匹配
- `tag:部署` — 按主题限定
- 结果按相关度打分，命中词高亮
- 查询同步到 URL（`?q=`），链接可分享
- 任意页面按 <kbd>Cmd/Ctrl</kbd> + <kbd>K</kbd> 直达

### 阅读体验

- `##` 二级标题自动编号 `§ 01`、`§ 02`，锚点由 `anchorize` 生成，与目录一致
- 目录栏跟随阅读位置高亮当前小节
- 代码块深色区块 + 语言标签（取自围栏语言标识）
- 相关阅读按标签交集自动取前 3 篇
- 阅读时长按 400 字/分钟估算
- 一键复制当前链接

### 站点能力

- 全站无追踪脚本、无 Cookie、无外部字体请求
- SEO：canonical、Open Graph、JSON-LD（`Person` + `BlogPosting`）、RSS
- 响应式：1920 / 1440 / 1280 / 768 / 390 均无横向溢出

### 设计系统

纸感暖底色配砖红信号色，正文区浅色、页脚深色。

| 变量 | 值 | 用途 |
|---|---|---|
| `--paper` | `#F2EFE7` | 画布底色 |
| `--ink` | `#16181A` | 标题与主体色块 |
| `--body` | `#3A362F` | 正文 |
| `--muted` | `#5A554C` | 次级文字 |
| `--hair` | `#CBC4B4` | 分隔线 |
| `--signal` | `#C4461F` | 强调、引用条、编号 |
| `--link` | `#23596B` | 行内链接 |

版心 1440px，左右留白 48px；窄屏降至 18px。字族全部走系统字体，中文细字重通过 `@font-face { src: local() }` 绑定本地「微软雅黑 Light」，不加载远程字体。

---

## 目录结构

```
content/
  writing/*.md          文章（唯一的内容源）
  about.md              关于页
  archive.md            归档页      （layout: archive）
  search.md             检索页      （layout: search）

layouts/
  baseof.html           骨架：head + header + main + footer
  home.html             首页
  list.html             文章列表（含分页）
  single.html           文章页（含目录、相关阅读、上下篇）
  404.html              404
  index.json            检索索引（构建期）
  rss.xml               RSS
  _markup/
    render-table.html   表格包裹层，窄屏横向滚动
  _default/
    about.html          关于页
    archive.html        归档页
    search.html         检索页
    terms.html          标签 / 系列总览
    taxonomy.html       标签 / 系列单项
  partials/
    head.html           meta、OG、JSON-LD、CSS 资源管道
    header.html         页头
    footer.html         页脚
    tag-list.html       标签归一（保留大小写）
    readtime.html       阅读时长
    wordcount.html      字数

assets/css/
  proto.css             设计系统：布局、组件、配色
  markdown.css          Markdown 标签 → 视觉映射、Chroma 配色、响应式

static/
  js/app.js             代码块标签、快捷键、目录跟随、复制
  js/search.js          本地检索
  favicon.svg

scripts/
  check.mjs             frontmatter 校验
  hugo.mjs              定位 hugo 二进制并透传参数
  audit-classes.mjs     模板 class 与样式定义的一致性审计
  measure-align.mjs     各页横向对齐检测（需 playwright）
  find-overflow.mjs     窄视口溢出元素定位（需 playwright）
  shots.mjs             批量截首屏（需 playwright）

hugo.toml               站点配置
prototype/  site/       设计稿
```

## 构建管线

```
content/writing/*.md
   │  frontmatter 校验（check.mjs，不通过则中断）
   ▼
Hugo
   ├─ Go Template 渲染  →  HTML
   ├─ Chroma 高亮       →  class 输出，配色由 markdown.css 接管
   ├─ Taxonomies        →  /tags/ /series/
   └─ 资源管道           →  CSS minify + fingerprint
   ▼
public/  →  Cloudflare Pages
```

模板层次：`baseof.html` 定义骨架，各页面用 `{{ define "main" }}` 填充；导航、页脚、meta 全部走 `partials/`。

样式分两层：`proto.css` 只管设计系统（版心、网格、组件），`markdown.css` 只管把裸 HTML 标签映射成设计稿的样子。写文章时不需要记 CSS 类。

---

## 使用

### 环境要求

Hugo 0.169 extended。`scripts/hugo.mjs` 按 `HUGO_BIN` → `~/.hugo-bin/` → `PATH` 顺序查找。

```bash
winget install Hugo.Hugo.Extended
# 或下载 https://github.com/gohugoio/hugo/releases 解压到 ~/.hugo-bin/
```

Node.js 仅用于校验脚本，无第三方依赖。

### 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 本地预览 <http://localhost:1313>，含草稿 |
| `npm run build` | 校验 + 构建到 `public/` |
| `npm run check` | 只跑 frontmatter 校验 |
| `npm run new -- content/writing/xxx.md` | 从 archetype 生成文章骨架 |
| `npm run audit` | 检查模板 class 是否都有样式定义 |
| `npm run align` | 各页横向对齐检测（需先起服务，需 playwright） |
| `npm run overflow` | 定位窄视口撑宽页面的元素 |
| `npm run preview` | 本地预览（不含草稿） |

### 写一篇文章

```bash
npm run new -- content/writing/my-new-post.md
npm run dev
```

**文件名即 URL**：`my-new-post.md` → `/writing/my-new-post/`。必须是 ASCII slug——中文文件名会让 URL 变成一长串百分号编码。

#### frontmatter

```yaml
---
title: Cloudflare Pages 上的 Hugo 永远是旧的，除非你亲手钉住它
date: 2026-10-30
summary: 一句话说清这篇解决什么问题，会进列表页、meta description 和 RSS。
tags: ["部署", "Hugo"]
series: "把这个博客搭起来"      # 可选
seriesOrder: 2                 # 可选
featured: true                 # 可选，首页主稿
draft: false                   # 可选，true 则只在 dev 可见
---
```

| 字段 | 必填 | 约束 |
|---|---|---|
| `title` | 是 | 4–90 字 |
| `date` | 是 | `YYYY-MM-DD` |
| `summary` | 是 | 10–300 字 |
| `tags` | 是 | 数组，1–6 项 |
| `series` / `seriesOrder` | 否 | 成对出现 |
| `featured` | 否 | 布尔，首页主稿 |
| `draft` | 否 | 布尔 |

`npm run build` 会先跑 `scripts/check.mjs`，字段缺失、格式错误、`title` 含裸冒号都会中断构建。

### 排版约定

写文章时不用记 CSS 类，Markdown 标签自动映射到设计稿的视觉：

- `##` 二级标题 → 自动编号 `§ 01`、`§ 02`（CSS counter，不用手写）
- 围栏代码块 → 深色区块 + 顶部语言标签（语言必须标）
- `>` 引用 → 左侧信号红条 + NOTE 卡片
- `-` 列表 → 红色长破折号
- `1.` 列表 → 衬线体红色序号
- 表格 → 1px 细线、等宽表头；窄屏横向滚动

---

## 部署

Cloudflare Pages，从 Gitee 仓库自动构建。

| 配置项 | 值 |
|---|---|
| Build command | `node scripts/check.mjs && hugo --baseURL $CF_PAGES_URL` |
| Build output directory | `public` |
| 环境变量 `HUGO_VERSION` | `0.169.0`（Preview 环境需单独再设一次） |

`HUGO_VERSION` 必须显式设置，否则 Pages 会使用自带的旧版本。

`--baseURL $CF_PAGES_URL` 用本次部署自己的地址覆盖 `hugo.toml` 里的生产域名，使预览部署的 RSS、sitemap、canonical 指向预览站而非生产站。前提是所有站内链接都走 `relURL` / `absURL`。

自定义域名在 Pages 项目里添加，再按提示配置 DNS 记录；域名变更时同步修改 `hugo.toml` 的 `baseURL`。

---

## 授权

**分层授权：文字 CC BY-NC 4.0，代码 MIT。**

| 对象 | 许可证 | 覆盖范围 |
|---|---|---|
| 文字 | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) | `content/`、`prototype/`、`site/` |
| 代码 | [MIT](./LICENSE-CODE) | `layouts/`、`scripts/`、`assets/css/`、`static/js/`、正文代码块 |

文字部分的授权说明见 [LICENSE](./LICENSE)，代码部分的全文见 [LICENSE-CODE](./LICENSE-CODE)。

许可证参数在 `hugo.toml`：

```toml
license        = "CC BY-NC 4.0"
licenseUrl     = "https://creativecommons.org/licenses/by-nc/4.0/"
codeLicense    = "MIT"
codeLicenseUrl = "https://gitee.com/hucker/h_blog/blob/main/LICENSE-CODE"
```

页脚与关于页规格表的许可证均带 `rel="license"` 链接。
