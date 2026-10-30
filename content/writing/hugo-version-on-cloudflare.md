---
title: Cloudflare Pages 上的 Hugo 永远是旧的，除非你亲手钉住它
date: 2026-10-30
summary: 本地 hugo 0.169 构建正常，推上去却报模板语法错误。查了两小时才发现，Cloudflare Pages 给你的 Hugo 不是你以为的那个版本。
tags: ["部署", "Hugo", "Cloudflare"]
series: "把这个博客搭起来"
seriesOrder: 2
featured: true
---

本地 `hugo` 跑得干干净净，`hugo server` 里每个页面都对。`git push` 之后，Cloudflare Pages 的构建日志第一行就红了：

```text
Error: failed to load modules: ...
ERROR render of "page" failed: ...: execute of template failed:
template: _default/single.html:12:14: executing ... at <.Fragments>: can't evaluate field Fragments
```

`.Fragments` 是 Hugo 0.111 才有的东西。本地 0.169 认它，构建机不认——说明构建机上跑的根本不是 0.169。

## 默认版本不会告诉你它有多老

Cloudflare 的框架列表里，Hugo 的构建命令就是 `hugo`，输出目录 `public`，看起来什么都不用配。但官方文档在「Use a specific or newer Hugo version」一节里只写了一句：

> To use a specific or newer version of Hugo, create the `HUGO_VERSION` environment variable in your Pages project > **Settings** > **Environment variables**.

它没说默认给的是哪个版本。我去翻构建日志，才在开头几行看到实际的版本号——比我本地低了十几个小版本，`Fragments`、`page.Store`、新的模板查找规则全都不在。

这件事麻烦的地方在于**它不会在构建开始时告诉你版本不匹配**。你要等到某个模板真的用到了新 API，才会以"模板语法错误"的形式炸给你，报错信息指向模板文件，而不是版本。

## 把它钉住

在 Pages 项目里加一个环境变量，值写成你本地验证过的版本：

| 配置项 | 值 | 位置 |
|---|---|---|
| `HUGO_VERSION` | `0.169.0` | Settings → Environment variables → Production |
| 构建命令 | `hugo` | Settings → Build configuration |
| 输出目录 | `public` | 同上 |

注意**预览环境是独立的一套变量**。只配了 Production，`preview` 分支照样用默认版本，于是你会遇到"主站正常、PR 预览挂掉"这种更让人困惑的状态。官方文档也提了这一句：

> If you plan to use preview deployments, make sure you also add environment variables to your **Preview** environment.

## 顺便把 baseURL 也解决掉

Hugo 的 `baseURL` 写在 `hugo.toml` 里，但 Pages 的实际域名有生产、预览、分支预览三种，写死了就有一半是错的。官方给的做法是把 `CF_PAGES_URL` 传进去：

```bash
hugo -b $CF_PAGES_URL
```

用这个的前提是模板里所有链接都走 `relURL` / `absURL`，而不是手写 `/posts/xxx`。我一开始有十几处硬编码的 `/writing/`，换成 `relURL` 之后才敢开这个参数——否则预览环境的链接会指向 `file://` 或者干脆 404。

> 一个经验：部署相关的坑，九成不是"配置项写错了"，而是"本地和构建机不是同一个环境"。版本、时区、Node 版本、环境变量，任何一项不一致都会以一个看起来完全无关的报错出现。看到模板语法错误，先看版本，别急着改语法。
