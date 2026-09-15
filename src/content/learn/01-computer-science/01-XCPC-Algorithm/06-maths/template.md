---
title: "数学"
description: "数学相关板子"
date: 2026-07-02
tags: ["cs", "algorithm", "xcpc", "cpp"]
draft: false
---
# 数学

## 数论

## 线性代数

### 异或线性基

```cpp
ll n, a[MAX], base[MAX];

int Gauss()
{
    int k = 1;
    for (int i = 49; i >= 0; i--)
    {
        for (int j = k; j <= n; j++)
        {
            if ((a[j] >> i) & 1) 
            {
                swap(a[j], a[k]);
                break;
            }
        }
        
        //未消元的数第i位都是0, 直接到下一位
        if (((a[k] >> i) & 1) == 0) continue;

        for (int j = 1; j <= n; j++)
        {
            if (j != k && ((a[j] >> i) & 1)) 
            {
                a[j] ^= a[k];
            }
        }
        
        if (k == n) break;
        k++;
    }
    return k;
}

void insert_bs(ll x)
{
    for (int i = 49; i >= 0; i--)
    {
        if (x >> i & 1)
        {
            if (base[i]) x ^= base[i];//消去最高位的1
            else
            {
                base[i] = x;
                break;
            }
        }
    }
}
```

## 组合数学

## 多项式与生成函数

### NTT

```cpp
void NTT(vector<ll>& a, bool invert)
{
    int N = a.size();

    for (int i = 1, j = 0; i < N; i++)
    {
        int bit = N >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) swap(a[i], a[j]);
    }

    for (int len = 2; len <= N; len <<= 1)
    {
        ll wn = qmi(G, (MOD - 1) / len);
        if (invert) wn = qmi(wn);

        for (int i = 0; i < N; i += len)
        {
            ll w = 1;
            for (int j = 0; j < len / 2; j++)
            {
                ll u = a[i + j];
                ll v = mul(a[i + j + len / 2], w);

                a[i + j] = (u + v) % MOD;
                a[i + j + len / 2] = (u - v + MOD) % MOD;

                w = mul(w, wn);
            }
        }
    }

    if (invert)
    {
        ll invN = qmi(N);
        for (auto& x : a) x = mul(x, invN);
    }
}

vector<ll> convolution(vector<ll> a, vector<ll> b)
{
    int need = a.size() + b.size() - 1;

    int N = 1;
    while (N < need) N <<= 1;

    a.resize(N);
    b.resize(N);

    NTT(a, false);
    NTT(b, false);

    for (int i = 0; i < N; i++) a[i] = mul(a[i], b[i]);

    NTT(a, true);
    a.resize(need);

    return a;
}
```

## 杂项

### 格雷码

```cpp
unsigned gray(unsigned n)
{
    return n ^ (n >> 1);
}

unsigned rev_gray(unsigned g)
{
    int res = 0;
    for (; g; g >>= 1) res ^= g;
    return res;
}
```