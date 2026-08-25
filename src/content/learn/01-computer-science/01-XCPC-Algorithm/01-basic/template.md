---
title: "竞赛基础"
description: "竞赛常用基础内容"
date: 2026-07-17
tags: ["cs", "algorithm", "xcpc", "cpp"]
draft: false
---

# FASTIO(模拟输入输出流)

> 注意调试的时候不要开快读

```cpp
#include <bits/stdc++.h>
#define FASTIO
#ifdef FASTIO
namespace fio
{
    class Input
    {
    private:
        static constexpr int BUF_SIZE = 1 << 20;
        char buf[BUF_SIZE];
        char *p1, *p2;
        FILE *fp;

        inline char getc()
        {
            return p1 == p2 ? (p2 = (p1 = buf) + fread(buf, 1, BUF_SIZE, fp), p1 == p2 ? EOF : *p1++) : *p1++;
        }

    public:
        Input(FILE *stream = stdin) : p1(buf), p2(buf), fp(stream) {}

        template<typename T, typename = std::enable_if_t<std::is_integral_v<T>>>
        Input& operator>>(T &x)
        {
            x = 0;
            bool neg = false;
            int c = getc();
            while (c != EOF && (c < '0' || c > '9'))
            {
                if (c == '-') neg = true;
                c = getc();
            }
            while (c != EOF && c >= '0' && c <= '9')
            {
                x = x * 10 + (c - '0');
                c = getc();
            }
            if (neg) x = -x;
            return *this;
        }

        Input& operator>>(std::string &s)
        {
            s.clear();
            int c = getc();
            while (c <= ' ' && c != EOF) c = getc();
            while (c > ' ' && c != EOF)
            {
                s.push_back(c);
                c = getc();
            }
            return *this;
        }

        Input& operator>>(char *s)
        {
            int c = getc();
            while (c <= ' ' && c != EOF) c = getc();
            while (c > ' ' && c != EOF)
            {
                *s++ = c;
                c = getc();
            }
            *s = '\0';
            return *this;
        }

        Input& operator>>(char &c)
        {
            int ch = getc();
            while (ch != EOF && (ch <= ' ')) ch = getc();
            if (ch != EOF) c = static_cast<char>(ch);
            return *this;
        }

        bool getline(std::string &s)
        {
            s.clear();
            int c = getc();
            if (c == EOF) return false;
            while (c != '\n' && c != EOF)
            {
                s.push_back(c);
                c = getc();
            }
            return true;
        }
    };

    class Output
    {
    private:
        static constexpr int BUF_SIZE = 1 << 20;
        char buf[BUF_SIZE];
        char *ptr;
        FILE *fp;
        inline void flush()
        {
            if (ptr != buf) fwrite(buf, 1, ptr - buf, fp);
            ptr = buf;
        }

        inline void putc(char c)
        {
            if (ptr == buf + BUF_SIZE) flush();
            *ptr++ = c;
        }

        template<typename T>
        void write_int(T x)
        {
            if (x == 0)
            {
                putc('0');
                return;
            }
            if (x < 0) putc('-'), x = -x;
            char tmp[20];
            int len = 0;
            while (x) {
                tmp[len++] = '0' + (x % 10);
                x /= 10;
            }
            while (len--) putc(tmp[len]);
        }

    public:
        Output(FILE *stream = stdout) : ptr(buf), fp(stream) {}
        ~Output() { flush(); }

        template<typename T, typename = std::enable_if_t<std::is_integral_v<T>>>
        Output& operator<<(T x)
        {
            write_int(x);
            return *this;
        }

        Output& operator<<(const std::string &s)
        {
            for (char c : s) putc(c);
            return *this;
        }

        Output& operator<<(const char *s)
        {
            while (*s) putc(*s++);
            return *this;
        }

        Output& operator<<(char c)
        {
            putc(c);
            return *this;
        }

        Output& operator<<(Output& (*manip)(Output&))
        {
            return manip(*this);
        }

        void flush_buffer() { flush(); }
    };

    inline Output& endl(Output &out)
    {
        out << '\n';
        out.flush_buffer();
        return out;
    }

    Input cin(stdin);
    Output cout(stdout);

    inline void getline(Input &in, std::string &line)
    {
        in.getline(line);
    }
}
#endif
```
---

# 取模基础

## 1. 基础四则运算

```cpp
inline ll add(ll a, ll b)
{
    a += b;
    if (a >= MOD) a -= MOD;
    return a;
}

inline ll sub(ll a, ll b)
{
    a -= b;
    if (a < 0) a += MOD;
    return a;
}

inline ll mul(ll a, ll b)
{
    return a * b % MOD;
}
```

## 2. 快速幂 & 逆元（处理除法）
**费马小定理**：当 MOD 为质数时，`a` 的逆元为 `pow(a, MOD-2)`。

```cpp
ll qmi(ll a, ll b = MOD - 2)
{
    ll res = 1;
    while (b)
    {
        if (b & 1) res = mul(res, a);
        a = mul(a, a);
        b >>= 1;
    }
    return res;
}

inline ll div_mod(ll a, ll b)
{
    return mul(a, qmi(b));
}
```

## 3. 组合数预处理
若题目涉及大量组合数 `C(n, k)`，务必预处理阶乘和逆元（线性递推，避免每次快速幂的 log）。

```cpp
const int N = 1e6 + 5;
ll fact[N], invfact[N];

void init_comb(int n)
{
    fact[0] = 1;
    for (int i = 1; i <= n; i++) fact[i] = mul(fact[i-1], i);
    
    invfact[n] = qmi(fact[n]); // 求最大阶乘的逆元
    for (int i = n; i >= 1; i--) invfact[i-1] = mul(invfact[i], i);
}

inline ll C(ll n, ll k)
{
    if (k < 0 || k > n) return 0;
    return mul(fact[n], mul(invfact[k], invfact[n-k]));
}
```

## 4. 线性递推逆元（单点求逆常用）
求 `1` 到 `n` 每个数的逆元，复杂度 O(n)：

```cpp
int inv[N];
inv[1] = 1;
for (int i = 2; i <= n; i++)
{
    inv[i] = MOD - 1LL * (MOD / i) * inv[MOD % i] % MOD;
}
```

## 5. 大数读入取模（字符串输入）
当输入数字远超 `long long` 范围时，边读边取模：

```cpp
ll read_mod(string &s)
{
    ll res = 0;
    for (char c : s) res = (1LL * res * 10 + (c - '0')) % MOD;
    return res;
}
```

---

