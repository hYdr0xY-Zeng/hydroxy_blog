---
title: "动态规划"
description: "动态规划相关板子"
date: 2026-07-02
tags: ["cs", "algorithm", "xcpc", "cpp"]
draft: false
---

# 背包dp

# 状压dp

## 常见集合处理

### 子集枚举
```cpp
for (int s = init_sta; s >= 0; s = init_sta & (s - 1))
```

### 预处理全状态数值
```cpp
// 以求和为例
for (int i = 0; i < maxbit; i++)
{
    int h = 1 << i;
    int v = a[i];
    for (int j = 0; j < h; j++)
    {
        sum[h | j] = sum[j] + v;
    }
}
```