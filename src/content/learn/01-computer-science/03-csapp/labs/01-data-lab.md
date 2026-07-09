---
title: "DATA LAB"
description: "前置: ch2"
date: 2026-07-06
tags: ["cs", "csapp"]
draft: false
---
# DATA LAB


## 代码

```c
//1
/* 
 * bitXor - x^y using only ~ and & 
 *   Example: bitXor(4, 5) = 1
 *   Legal ops: ~ &
 *   Max ops: 14
 *   Rating: 1
 */
int bitXor(int x, int y) {
  int z = ~(x & y);
  int a = ~(x & z);
  int b = ~(y & z);
  return ~(a & b);
}
/* 
 * tmin - return minimum two's complement integer 
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 4
 *   Rating: 1
 */
int tmin(void) {
  return 1 << 31;
}
//2
/*
 * isTmax - returns 1 if x is the maximum, two's complement number,
 *     and 0 otherwise 
 *   Legal ops: ! ~ & ^ | +
 *   Max ops: 10
 *   Rating: 1
 */
int isTmax(int x) {
  return (!(~((x + 1) ^ x)) & (!!(x + 1)));
}
/* 
 * allOddBits - return 1 if all odd-numbered bits in word set to 1
 *   where bits are numbered from 0 (least significant) to 31 (most significant)
 *   Examples allOddBits(0xFFFFFFFD) = 0, allOddBits(0xAAAAAAAA) = 1
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 12
 *   Rating: 2
 */
int allOddBits(int x) {
  int msk = 0xAA;
  msk |= msk << 4;
  msk |= msk << 8;
  msk |= msk << 16;
  return !((x & msk) ^ msk);
}
/* 
 * negate - return -x 
 *   Example: negate(1) = -1.
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 5
 *   Rating: 2
 */
int negate(int x) {
  return ~x + 1;
}
//3
/* 
 * isAsciiDigit - return 1 if 0x30 <= x <= 0x39 (ASCII codes for characters '0' to '9')
 *   Example: isAsciiDigit(0x35) = 1.
 *            isAsciiDigit(0x3a) = 0.
 *            isAsciiDigit(0x05) = 0.
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 15
 *   Rating: 3
 */
int isAsciiDigit(int x) {
  int lb = 0x30, ub = 0x39;
  int a = !(x >> 6);
  int b = !((x + (~lb + 1)) >> 31);
  int c = !((ub + (~x + 1)) >> 31);
  return a & b & c;
}
/* 
 * conditional - same as x ? y : z 
 *   Example: conditional(2,4,5) = 4
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 16
 *   Rating: 3
 */
int conditional(int x, int y, int z) {
  int msk = !x;
  msk |= msk << 1;
  msk |= msk << 2;
  msk |= msk << 4;
  msk |= msk << 8;
  msk |= msk << 16;
  return (z & msk) + (y & ~msk);
}
/* 
 * isLessOrEqual - if x <= y  then return 1, else return 0 
 *   Example: isLessOrEqual(4,5) = 1.
 *   Legal ops: ! ~ & ^ | + << >>
 *   Max ops: 24
 *   Rating: 3
 */
int isLessOrEqual(int x, int y) {
  int sx = (x >> 31) & 1;
  int sy = (y >> 31) & 1;
  int diff = y + (~x + 1);
  int sd = (diff >> 31) & 1;
  return (sx & !sy) | (!(sx ^ sy) & !sd);
}
//4
/* 
 * logicalNeg - implement the ! operator, using all of 
 *              the legal operators except !
 *   Examples: logicalNeg(3) = 0, logicalNeg(0) = 1
 *   Legal ops: ~ & ^ | + << >>
 *   Max ops: 12
 *   Rating: 4 
 */
int logicalNeg(int x) {
  return (((~x + 1) | x) >> 31) + 1;
}
/* howManyBits - return the minimum number of bits required to represent x in
 *             two's complement
 *  Examples: howManyBits(12) = 5
 *            howManyBits(298) = 10
 *            howManyBits(-5) = 4
 *            howManyBits(0)  = 1
 *            howManyBits(-1) = 1
 *            howManyBits(0x80000000) = 32
 *  Legal ops: ! ~ & ^ | + << >>
 *  Max ops: 90
 *  Rating: 4
 */
int howManyBits(int x) {
  int mask = x >> 31;
  int u = x ^ mask;
  int n = 0;
  int bit;
  int zero;
  int mask_sel;

  bit = !!(u >> 16); n += bit << 4; u >>= bit << 4;
  bit = !!(u >> 8);  n += bit << 3; u >>= bit << 3;
  bit = !!(u >> 4);  n += bit << 2; u >>= bit << 2;
  bit = !!(u >> 2);  n += bit << 1; u >>= bit << 1;
  bit = !!(u >> 1);  n += bit;      u >>= bit;

  zero = !u;
  mask_sel = ~zero + 1;
  return ((n + 2) & ~mask_sel) | (1 & mask_sel);
}
//float
/* 
 * floatScale2 - Return bit-level equivalent of expression 2*f for
 *   floating point argument f.
 *   Both the argument and result are passed as unsigned int's, but
 *   they are to be interpreted as the bit-level representation of
 *   single-precision floating point values.
 *   When argument is NaN, return argument
 *   Legal ops: Any integer/unsigned operations incl. ||, &&. also if, while
 *   Max ops: 30
 *   Rating: 4
 */
unsigned floatScale2(unsigned uf) {
  unsigned sign = uf & 0x80000000;
  unsigned exp = (uf >> 23) & 0xff;
  unsigned frac = uf & 0x7fffff;

  if (exp == 0xff) return uf;

  if (exp == 0) {
    frac <<= 1;
    if (frac & 0x800000) {
      exp = 1;
      frac &= 0x7fffff;
    }
    return sign | (exp << 23) | frac;
  }

  exp += 1;
  if (exp == 0xff) return sign | 0x7f800000;

  return sign | (exp << 23) | frac;
}
/* 
 * floatFloat2Int - Return bit-level equivalent of expression (int) f
 *   for floating point argument f.
 *   Argument is passed as unsigned int, but
 *   it is to be interpreted as the bit-level representation of a
 *   single-precision floating point value.
 *   Anything out of range (including NaN and infinity) should return
 *   0x80000000u.
 *   Legal ops: Any integer/unsigned operations incl. ||, &&. also if, while
 *   Max ops: 30
 *   Rating: 4
 */
int floatFloat2Int(unsigned uf) {
  int sign = uf >> 31;
  int exp = (uf >> 23) & 0xff;
  unsigned frac = uf & 0x7fffff;
  int E = exp - 127;
  unsigned mant = (1u << 23) | frac;
  unsigned abs;

  if (exp == 0xff) return 0x80000000u;

  if (exp == 0) return 0;

  if (E < 0) return 0;

  if (sign == 0) {

    if (E >= 31)return 0x80000000u;

    if (E < 23) abs = mant >> (23 - E);
    else abs = mant << (E - 23);

    return abs;
  }
  else {
    if (E > 31) return 0x80000000u;

    if (E < 23) abs = mant >> (23 - E);
    else abs = mant << (E - 23);

    if (abs > 0x80000000u) return 0x80000000u;

    return -abs;
  }
}
/* 
 * floatPower2 - Return bit-level equivalent of the expression 2.0^x
 *   (2.0 raised to the power x) for any 32-bit integer x.
 *
 *   The unsigned value that is returned should have the identical bit
 *   representation as the single-precision floating-point number 2.0^x.
 *   If the result is too small to be represented as a denorm, return
 *   0. If too large, return +INF.
 * 
 *   Legal ops: Any integer/unsigned operations incl. ||, &&. Also if, while 
 *   Max ops: 30 
 *   Rating: 4
 */
unsigned floatPower2(int x) {
  if (x < -149) return 0;

  if (x > 127) return 0x7f800000u;

  if (x >= -126) return (x + 127) << 23;

  return 1u << (x + 149);
}

```
---

## 总结

### 1. 当前完成状态

| 检查项 | 结果 | 说明 |
|---|---:|---|
| `btest` 正确性测试 | `36/36` | 所有函数在测试用例下结果正确 |
| `dlc` 规则检查 | 通过 | 符合 Data Lab 的操作符和语法限制 |

当前代码已经同时通过 `btest` 和 `dlc`，可以作为规则检查通过版继续复盘和提交。

### 2. 整数题核心思路

| 函数 | 核心技巧 | 关键点 |
|---|---|---|
| `bitXor` | 德摩根律 | 用 `~` 和 `&` 拼出异或 |
| `tmin` | 最高位置 1 | `1 << 31` 得到补码最小值 |
| `isTmax` | `TMax + 1 == TMin`，且 `TMax ^ TMin == -1` | 额外排除 `x == -1` |
| `allOddBits` | 构造 `0xAAAAAAAA` 掩码 | 检查所有奇数位是否都为 1 |
| `negate` | 补码取负 | `-x == ~x + 1` |
| `isAsciiDigit` | 上下界检查 | 判断 `0x30 <= x <= 0x39` |
| `conditional` | 全 0 / 全 1 掩码选择 | 用掩码模拟 `x ? y : z` |
| `isLessOrEqual` | 分类讨论符号 | 异号时看符号，同号时看 `y - x` |
| `logicalNeg` | 0 和非 0 的符号特征 | 非 0 时 `x | -x` 的最高位一定为 1 |
| `howManyBits` | 二分查找最高有效位 | 先把负数变成对应的非负形态，再定位最高位 |

### 3. 浮点题核心思路

| 函数 | 分类方式 | 关键处理 |
|---|---|---|
| `floatScale2` | 按 `exp` 分为 NaN/Inf、非规格化数、规格化数 | 非规格化数左移 `frac`，规格化数 `exp + 1` |
| `floatFloat2Int` | 根据 `exp` 得到真实指数 `E = exp - 127` | `E < 0` 返回 0，溢出/NaN/Inf 返回 `0x80000000u` |
| `floatPower2` | 根据指数范围分为太小、非规格化、规格化、太大 | `x < -149` 为 0，`x > 127` 为 `+INF` |

浮点题的主线是固定的：

```text
uf = sign | exp | frac

sign = uf >> 31
exp  = (uf >> 23) & 0xff
frac = uf & 0x7fffff
```

然后按 `exp` 分类：

| `exp` | 含义 |
|---|---|
| `0` | 零或非规格化数 |
| `1..254` | 规格化数 |
| `255` | NaN 或无穷 |
