---
title: "Static Search Experiment"
description: "Pagefind 静态搜索实验记录，展示实验复现卡片的写法。"
date: 2026-07-01
tags: ["lab", "search", "pagefind"]
draft: false
---

这个实验用于验证 Astro 静态站在构建后生成 Pagefind 搜索索引。

## Reproduce

```bash
pnpm install
pnpm build
pnpm preview
```

## Environment

- Framework: Astro
- Search: Pagefind
- Output: `dist/pagefind`

## Result

构建完成后，搜索弹窗会从 `/pagefind/pagefind.js` 加载索引。开发模式下如果没有索引，界面会显示提示。
