# H_BLOG

个人技术博客。Hugo 构建，模板手写，正文 Markdown。

设计稿在 `prototype/`（当前版本，落地依据）和 `site/`（上一版，留档）。

---

## 写一篇文章，然后发布

```bash
npm run new -- content/writing/my-new-post.md   # 从 archetype 生成骨架
npm run dev                                     # 本地预览 http://localhost:1313
npm run build                                   # 校验 + 构建
```

推到 Gitee，Cloudflare Pages 自动构建上线。**没有第二步**——文件落盘就是发布动作。

### frontmatter

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

| 字段 | 必填 | 约束 | 写错的后果 |
|---|---|---|---|
| `title` | 是 | 4–90 字 | 太长会在正文列折成四行；整行漏掉 → 标题空白，不报错 |
| `date` | 是 | `YYYY-MM-DD` | 格式错会被 Hugo 拦住（exit 1）；**整行漏掉不拦**，日期变 0001 |
| `summary` | 是 | 10–300 字 | 漏掉不报错，列表页副标题、meta、RSS 同时变空 |
| `tags` | 是 | 数组，1–6 项 | 漏掉或写成字符串 → 模板报错，但指向模板行号，不说哪篇 |
| `series` / `seriesOrder` | 否 | 成对出现 | 系列页按日期排，不按编号 |

**文件名即 URL**：`my-new-post.md` → `/writing/my-new-post/`。必须是 ASCII slug，中文文件名会让 URL 变成一长串百分号编码。

---

## 校验脚本

`scripts/check.mjs`，零依赖，`npm run build` 会先跑它。

存在的唯一原因：**Hugo 只在「字段存在、值不合法」时报错。**

实测（hugo 0.169）——`date` 写成 `2026.10.30` 会打 ERROR 并返回退出码 1，CI 能拦住。但把 `date` 那一行整个删掉，退出码是 **0**，页面照常生成，日期渲染成 `0001.01.01`，直接上线。`title`、`summary` 同理：漏掉不报错，只是那处变空。

多删一行比写错一个字符容易得多，而这恰好是 Hugo 不管的那一类。

脚本把这些变成硬失败：

```
x content/writing/xxx.md
    date 格式错误：「2026.10.30」。必须是 YYYY-MM-DD，写成点号会被当成零值排到 0001 年
```

---

## 样式审计

```bash
npm run audit
```

扫一遍模板，找出「class 写了、但 CSS 里完全没有定义」的地方。这类问题不会报错，页面上只是那一块退回浏览器默认样式——比如 `.labelrow` 原本只在 `.page-head` 作用域下定义，放到 `series-head` 里就整个失效，标题、字号、字色全丢。

纯语义容器（`.outline`、`.topics`）在脚本里有白名单，不算缺失。

---

## 横向对齐检查

```bash
npm run dev            # 另开一个终端
npm run align          # 默认测 http://localhost:1414
```

这个脚本查的是一件很难靠眼睛发现、但一眼就能感觉到的事：**切换页面时页头页脚会不会左右晃一下**。

判断标准不是「左边界等于 0」，而是「同一视口下十个页面的左边界完全一致」。视口宽于 `--page`（1440px）时，居中容器的左边距是 `(clientWidth - 1440) / 2`，只要各页的 `clientWidth` 不同，这个值就不同。

而 `clientWidth` 会因为**垂直滚动条**而不同：

| 条件 | clientWidth（1920 屏） | 居中左边界 |
|---|---|---|
| 内容高于视口，有滚动条 | 1905 | 232.5 |
| 内容恰好一屏，无滚动条 | 1920 | 240 |

差 **7.5px**。短页面整体偏右，来回切换就是那个"晃一下"。

修法在 `proto.css`：

```css
html{ overflow-y: scroll; }   /* 滚动条常驻，两态归一 */
```

同时删掉了 `body{ min-width: 1440px }`。那一条在视口不足 1440 时（笔记本 1440 屏扣掉 15px 滚动条就只剩 1425）会把 body 顶到 1440，整页横向溢出 15px——每个 `margin:auto` 的容器都跟着错位。

**测的时候必须开有头浏览器**（`HEADFUL=1 npm run align`）。无头模式用 overlay 滚动条，`clientWidth` 恒等于视口宽，症状被完全掩盖——之前就是在无头下测了十页全绿，才误判了一遍。

`BROKEN=1 npm run align` 会把旧写法注回去做 A/B 对照，用来确认修复确实对症，不是顺手改的。

### 溢出定位

```bash
npm run overflow               # 默认 390 宽
W=768 HEADFUL=1 npm run overflow
```

列出窄视口下右边界超过 `clientWidth` 的元素，按超出距离排序。页面报"横向溢出 Npx"时用它找元凶。

注意它会把**被 `overflow` 裁剪掉**的宽子元素也报出来（比如 `.tablewrap` 里的表格本身比容器宽是正常的），所以看的是最外层那一条。

### 移动端溢出的三个来源

都是同一个性质：**桌面端用固定宽度或 `white-space:pre` 排版，窄屏没给出口**。

| 元凶 | 症状 | 修法 |
|---|---|---|
| `.entry{width:648px}` | 列表页溢出 94px | 760px 断点下改 `width:100%`，`.entry .meta` 两行堆叠 |
| `.pre{white-space:pre}` | 工具栏长文案不换行，溢出 94px | 全局改 `pre-wrap`：空格照留，放不下才换行 |
| 表格无包裹层 | 宽表格溢出 39px | 加 `layouts/_markup/render-table.html` 包一层 `.tablewrap` |

第三条值得记一笔：`.md .tablewrap{overflow-x:auto}` 这段 CSS **早就写好了**，但从来没有 render hook 生成那个包裹层，所以是纯死代码。CSS 有、HTML 没有，`npm run audit` 也查不出来（它只查反方向：class 有、样式没有）。

---

## 部署到 Cloudflare Pages

| 配置项 | 值 |
|---|---|
| Build command | `node scripts/check.mjs && hugo --baseURL $CF_PAGES_URL` |
| Build output directory | `public` |
| 环境变量 `HUGO_VERSION` | `0.169.0`（必须设，且 **Preview 环境也要单独设**） |

`HUGO_VERSION` 不能省。不设的话 Pages 会用一个很老的默认版本，模板里用到 `.Fragments`、新模板查找规则之类的新 API 就会直接报错，而报错信息指向模板文件，不指向版本。

构建命令前挂 `check.mjs` 是为了让校验在 CI 上也生效——只在本地跑没有意义，文章是推上去才上线的。

### baseURL 为什么要覆盖

`hugo.toml` 里写的是生产域名 `https://huc.site/`，但 Pages 一次构建会产出三种地址：生产、预览、分支预览。写死的话，预览部署里的 RSS、sitemap、canonical 全部指向生产站——你在预览里点分享链接，跳回主站。

`$CF_PAGES_URL` 是 Pages 注入的、本次部署自己的地址，`--baseURL` 用它可以覆盖掉配置里的值。**前提是模板里所有站内链接都走 `relURL` / `absURL`，没有手写 `/writing/`**，否则覆盖了也一样错。

本地构建照旧用 `hugo.toml` 里的生产域名，跑 `npm run build` 不受影响。

---

## 目录

```
content/writing/      文章（唯一的内容源）
content/about.md      关于页
content/archive.md    归档页（layout: archive）
content/search.md     检索页（layout: search）
layouts/              Go Template
  baseof.html         骨架
  home.html           首页
  single.html         文章页
  list.html           列表页
  _markup/
    render-table.html 表格包 .tablewrap（窄屏横向滚动）
  _default/           terms / taxonomy / archive / search / about
  partials/           header / footer / head / tag-list / readtime
assets/css/
  proto.css           设计系统（从 prototype 迁来，改了字体加载）
  markdown.css        Markdown 正文排版 + Chroma 配色 + 响应式
scripts/
  check.mjs           frontmatter 校验
  hugo.mjs            找 hugo 二进制并透传参数
  audit-classes.mjs   模板 class 是否都有样式定义
  measure-align.mjs   各页横向对齐实测（需 playwright）
  find-overflow.mjs   窄视口下定位撑宽页面的元素（需 playwright）
  shots.mjs           批量截首屏到 .shots/（需 playwright）
```

## 排版约定

写文章时不用记 CSS 类，Markdown 标签会自动映射到设计稿的视觉：

- `##` 二级标题 → 自动编号成 `§ 01`、`§ 02`（CSS counter，不用手写）
- 围栏代码块 → 深色区块 + 顶部语言标签（JS 注入，语言必须标）
- `>` 引用 → 左侧信号红条 + NOTE 卡片
- `-` 列表 → 红色长破折号
- `1.` 列表 → 衬线体红色序号
- 表格 → 1px 细线，等宽表头

## 本地没有 hugo 时

```bash
winget install Hugo.Hugo.Extended
# 或下载 https://github.com/gohugoio/hugo/releases 解压到 ~/.hugo-bin/
```

`scripts/hugo.mjs` 会按 `HUGO_BIN` → `~/.hugo-bin/` → `PATH` 的顺序找。
