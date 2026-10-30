# 排查记录

开发过程中踩过的坑，以及每个结论的实测依据。这些内容不进 README——README 只描述项目最终状态，这里记录「为什么是这样」。

---

## 1. Hugo 不校验字段缺失，只校验字段值非法

`scripts/check.mjs` 存在的唯一原因。

Hugo 0.169 实测：

| 坏法 | 退出码 | 页面是否生成 | 结果 |
|---|---|---|---|
| `date: 2026.10.28`（点号） | 1 | 是 | 构建失败，CI 能拦住 |
| 整个 `date:` 行删掉 | **0** | 是 | 日期渲染成 `0001.01.01`，静默上线 |
| 整个 `title:` 行删掉 | **0** | 是 | 标题空白，静默上线 |
| `summary` 漏掉 | **0** | 是 | 列表副标题、meta、RSS 同时变空 |
| `tags` 漏掉或写成字符串 | 1 | 否 | 模板炸在 `delimit`，报错指向模板行号，不说哪篇 |

结论：**Hugo 严格校验「字段存在但值非法」，完全不校验「字段不存在」。**

而删掉一行比写错一个字符容易得多，这恰好是 Hugo 不管的那一类。所以用零依赖脚本把这类问题变成硬失败。

```
x content/writing/xxx.md
    date 格式错误：「2026.10.30」。必须是 YYYY-MM-DD，写成点号会被当成零值排到 0001 年
```

---

## 2. class 写了、样式没定义

`npm run audit`（`scripts/audit-classes.mjs`）扫模板，找出 CSS 里完全没有定义的 class。

这类问题不报错，页面上只是那一块退回浏览器默认样式。典型：`.labelrow` 原本只在 `.page-head` 作用域下定义，放到 `.series-head` 里整个失效——标题的字号、字色、字距全丢，但页面照常渲染，肉眼容易漏。

脚本会先剥掉模板里的 `{{ }}`，避免把模板关键字误判成 class；纯语义容器（`.outline`、`.topics`）走白名单，不算缺失。

**它查不出的反方向**：样式写了、HTML 里却没有对应元素。见第 4 条。

---

## 3. 全站横向偏移：真凶是滚动条

现象：**切换页面时页头页脚会左右晃一下**，偏得不多，但来回切能明显感觉到。

### 第一次定位错了

先归因到 `body{min-width:1440px}`：1440 视口扣掉 15px 滚动条只剩 1425，body 仍被顶到 1440 → 横向溢出 → 居中容器错位。

这条**确实存在**（实测每页溢出 15px），但它解释不了现象：旧写法下十页都溢出、都偏同样距离，**页面之间没有差异**，不可能有「晃」。

### 真根因

`--page:1440px` + `margin:0 auto`。只有**视口宽于 1440** 时，居中才产生左右外边距：

| 条件 | `clientWidth`（1920 屏） | 居中左边界 |
|---|---|---|
| 内容高于视口，有滚动条 | 1905 | 232.5 |
| 内容恰好一屏，无滚动条 | 1920 | 240 |

差 **7.5px**。短页面整体偏右，切换时就是那个「晃一下」。

### 修法

```css
html{ overflow-y: scroll; }   /* 滚动条常驻，两态归一 */
```

同时删掉 `body{ min-width: 1440px }`——它在视口不足 1440 时另生一坑。

### A/B 实测

| 条件 | 首页 | `/tags/hugo/` |
|---|---|---|
| 修复后 | hdrL 232.5 · ftrL 280.5 | 232.5 · 280.5 |
| 旧写法 | 232.5 · 280.5 | **240 · 288** |

旧写法下 `hdrL` 与 `ftrL` **同时**偏 7.5px，与「不止内容页，包括页头页脚」的观察一致。

### 测试方法的坑（重要）

无头 chromium 用 **overlay 滚动条**，`clientWidth` 恒等于视口宽，这个 bug **完全测不出来**。第一轮就是在无头模式下测了十页全绿，才误判了一轮。

必须 `HEADFUL=1 npm run align`，才有 Windows 经典 15px 滚动条；并且视口**必须包含 1920**，否则「宽于画布」这个前提不成立，7.5px 差永远不出现。

### 断言要选对不变量

一开始断言「左边界必须为 0」，这既不对（宽屏下居中就该不是 0），也查不出问题。正确的不变量是**同一视口下所有页面的左边界完全一致**。

---

## 4. 移动端横向溢出的三个来源

现象：390 宽下页面比视口宽，整页可以左右拖。

共同性质：**桌面端用固定宽度或 `white-space:pre` 排版，窄屏没给出口。**

| 元凶 | 症状 | 修法 |
|---|---|---|
| `.entry{width:648px}` | 列表页溢出 94px | 760px 断点下改 `width:100%`，`.entry .meta` 两行堆叠 |
| `.pre{white-space:pre}` | 工具栏长文案不换行，溢出 94px | 全局改 `pre-wrap`：空格照留，放不下才换行 |
| 表格无包裹层 | 宽表格溢出 39px | 加 `layouts/_markup/render-table.html` 包一层 `.tablewrap` |

`.pre` 那一条还有两个同款：`.indexrow .meta .l1/.l2`、`.trace .l1/.l2` 是直接写死 `white-space:pre` 的，不走 `.pre` 类，需要单独改。

### 第三条特别值得记

`.md .tablewrap{overflow-x:auto}` 这段 CSS **早就写好了，但从来没有 render hook 生成那个包裹层**——纯死代码。

`npm run audit` 查不出这类问题：它只查「class 有、样式没有」，而这是「样式有、HTML 没有」，正好是反方向。

### 溢出定位

```bash
npm run overflow               # 默认 390 宽
W=768 HEADFUL=1 npm run overflow
```

列出右边界超过 `clientWidth` 的元素，按超出距离排序。

注意它会把**被 `overflow` 裁剪掉**的宽子元素也报出来（`.tablewrap` 里的表格本身比容器宽是正常的），所以要看最外层那一条。

### 溢出修好之后暴露的问题

列表页其实从来没有移动端版式，只是被溢出掩盖了：`.pill` 被压成竖排单字、`.entry .meta` 两段挤一行断成「来 / MIN」。

在 760px 断点补的规则：`.entry{width:100%}`、`.entry .meta` 改列向堆叠、`.toolbar` 允许换行且 `.note` 独占一行、`.pill` 加 `nowrap`。

---

## 5. baseURL 与预览部署

`hugo.toml` 里写的是生产域名，但 Pages 一次构建会产出三种地址：生产、预览、分支预览。

写死的话，预览部署里的 RSS、sitemap、canonical 全部指向生产站——在预览里点分享链接会跳回主站。

`$CF_PAGES_URL` 是 Pages 注入的、本次部署自己的地址，`--baseURL` 用它可以覆盖配置：

```bash
hugo --baseURL $CF_PAGES_URL
```

实测（`-d .tmp-preview`）：sitemap 与 canonical 都跟着覆盖。本地 `npm run build` 仍用 `hugo.toml` 里的生产域名，不受影响。

前提是模板里所有站内链接都走 `relURL` / `absURL`，没有手写 `/writing/`——否则覆盖了也一样错。

一个经验：部署相关的坑，九成不是「配置项写错了」，而是「本地和构建机不是同一个环境」。版本、时区、Node 版本、环境变量，任何一项不一致都会以一个看起来完全无关的报错出现。看到模板语法错误，先看版本，别急着改语法。

---

## 附：几个模板层的坑

| 现象 | 原因 | 处理 |
|---|---|---|
| `can't evaluate field Fragments` | `.Fragments` 在跨页面上下文取不到 | 用 `findRE .RawContent` + `anchorize` 自己解析标题 |
| `can't evaluate field ByDate in type page.WeightedPages` | 类型是 `WeightedPages`，不是 `Pages` | 改 `$items.Pages.ByDate` |
| `/tags/` 渲染成文章列表 | `layouts/taxonomy.html` 放在根目录，抢了 `_default` 的优先级 | 移入 `layouts/_default/` |
| 中文 URL 被百分号编码 | `permalinks` 用了 `:slug`，取的是标题 | 改 `:contentbasename` |
| 标签名被小写化 | Hugo 规范化 taxonomy term | 用 `$items.Page.LinkTitle` 取回原始大小写 |
| 代码高亮无色 | Chroma 输出短类名（`.n`/`.t`/`.w`/`.l`），CSS 只定义了一部分 | 补齐 `.w`、`.l`、`.ld` 等 |
