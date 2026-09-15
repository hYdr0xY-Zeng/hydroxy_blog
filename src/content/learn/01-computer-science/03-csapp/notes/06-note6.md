---
title: "ch6 - 存储器层次结构"
description: "06-memory-hierarchy"
date: 2026-09-08
tags: ["cs", "csapp", "performance"]
draft: false
---

# 第 6 章：存储器层次结构

> 主题：存储器层次结构 (The Memory Hierarchy)  
> 目标：理解局部性、Cache 组织与失效行为；能从地址拆分和访问轨迹分析性能，并将 Cache 友好原则用于矩阵、Stencil 和科学计算内核。

## 1. 本章核心视角

处理器运算很快，数据移动却往往很慢。存储器层次结构用“小而快的上层存储”缓存“大而慢的下层存储”，以较低成本接近快速存储的访问体验。

~~~mermaid
flowchart TB
    A["寄存器<br/>最快、最小"] --> B["L1 Cache"]
    B --> C["L2 Cache"]
    C --> D["LLC / L3 Cache"]
    D --> E["主存 DRAM"]
    E --> F["SSD / HDD / 网络存储"]
~~~

一般而言，越靠近处理器，容量越小、延迟越低、每字节成本越高；越远离处理器，容量越大、延迟越高。

> **重点**：程序通常不是“访问一个元素”，而是在搬运一个 Cache Line。性能优化的关键，是让被搬来的相邻数据尽量被真正使用。

## 2. 为什么需要层次结构

理想存储器同时拥有寄存器般的速度、磁盘般的容量和磁盘般的成本，但物理实现无法三者兼得。层次结构利用程序访问的局部性，使多数访问命中在较快层。

| 层次 | 常见实现 | 容量量级 | 访问特点 |
|---|---|---:|---|
| 寄存器 | CPU 寄存器文件 | 字节到 KB | 指令直接操作 |
| Cache | SRAM | KB 到数十 MB | 以 Cache Line 为单位缓存 |
| 主存 | DRAM | GB 到 TB | 进程的工作内存 |
| 本地存储 | SSD / HDD | 百 GB 到 TB | 块设备、文件系统 |
| 远端存储 | NAS、对象存储 | 更大 | 网络延迟与带宽参与成本 |

这一章关注 CPU Cache 与主存。虚拟内存把 DRAM 和磁盘组织为另一种层次结构，第九章会系统讨论。

## 3. 局部性：Cache 有效的根源

### 3.1 时间局部性

若一个数据项刚被访问，它不久后再次被访问的概率较高，则具有时间局部性 (Temporal Locality)。

~~~c
int sum = 0;
for (int i = 0; i < n; ++i)
    sum += a[i];
~~~

变量 sum 在每轮循环中被反复使用，通常一直留在寄存器中。

### 3.2 空间局部性

若一个位置被访问，其附近位置不久后也被访问，则具有空间局部性 (Spatial Locality)。

~~~c
for (int i = 0; i < n; ++i)
    sum += a[i];
~~~

C 数组连续存放，访问 a[i] 时载入的 Cache Line 还包含后续多个元素，因此顺序遍历通常高效。

### 3.3 局部性不是算法复杂度

两个都是 O(n) 的循环，Cache 行为可能完全不同：

~~~c
/* 连续访问：空间局部性好 */
for (int i = 0; i < n; ++i)
    sum += a[i];

/* 大步长访问：每次可能只用到一条 Cache Line 的一个元素 */
for (int i = 0; i < n; i += stride)
    sum += a[i];
~~~

渐进复杂度描述工作量随规模的增长，局部性描述同样工作量在真实机器上的数据移动代价。两者都必须分析。

## 4. Cache 的基本组织

Cache 将下层存储划分为固定大小的块 (Block)，同时也称 Cache Line；将其中一部分块的副本保存在上层。

~~~mermaid
flowchart LR
    A["CPU 访问地址"] --> B["查找 Cache Set"]
    B --> C{"Tag 匹配且有效？"}
    C -->|"命中 Hit"| D["返回 Cache Line 中的数据"]
    C -->|"失效 Miss"| E["从下一层取整条 Block"]
    E --> F["必要时替换旧 Line"]
    F --> D
~~~

一个 Cache 可由三组参数描述：

| 符号 | 含义 |
|---|---|
| B = 2^b | 每个 Cache Block 的字节数 |
| S = 2^s | Cache Set 的数量 |
| E | 每个 Set 中的 Cache Line 数，也称相联度 |

总数据容量为 S × E × B，不包括 Tag、有效位与替换状态等元数据。

## 5. 地址拆分

设机器地址为 m 位，一个地址在 Cache 查找中被拆为：

~~~text
┌──────────── Tag (t bits) ────────────┬ Set index (s bits) ┬ Block offset (b bits) ┐
│                                      │                    │                       │
└──────────────────────────────────────┴────────────────────┴───────────────────────┘

t = m - s - b
~~~

- Block offset：选择 Cache Line 内的具体字节；
- Set index：选择要查询的 Set；
- Tag：区分映射到同一 Set 的不同内存块。

访问时，硬件用 Set index 找到一组候选 Line，再比较 Tag 和有效位。命中后，再依据 Block offset 取出对应字节。

### 5.1 一个计算示例

假设 32 位地址、B = 64 B、S = 256、E = 4：

~~~text
b = log2(64)  = 6
s = log2(256) = 8
t = 32 - 8 - 6 = 18
~~~

所以低 6 位是块内偏移，接下来的 8 位选择 Set，剩余 18 位为 Tag。注意：地址如何拆分只取决于当前 Cache 的 B 和 S，不取决于 E。

## 6. 三种映射方式

### 6.1 直接映射

直接映射 Cache 的 E = 1。每个内存块只能映射到唯一 Set：

$$
\mathrm{set}(block) = block \bmod S
$$

优点是实现简单、命中判断快；缺点是两个频繁访问且映射到同一 Set 的块会互相驱逐，形成冲突失效。

### 6.2 组相联

组相联 Cache 的 E > 1。一个块仍只映射到一个 Set，但可放进该 Set 的任意 Line。它在硬件复杂度与冲突失效之间折中，是现代 CPU Cache 的常见形式。

### 6.3 全相联

全相联 Cache 只有一个 Set，任意块可放在任意 Line。冲突最少，但需要比较大量 Tag，硬件成本高；常见于容量较小的特定结构，例如某些地址转换缓存。

| 组织方式 | E | 优点 | 主要问题 |
|---|---:|---|---|
| 直接映射 | 1 | 简单、快速、低成本 | 容易冲突 |
| 组相联 | 大于 1 | 平衡成本与命中率 | 比较与替换更复杂 |
| 全相联 | 容量个数 | 冲突最少 | 查找硬件昂贵 |

## 7. 命中、失效与替换

### 7.1 失效分类

常用的三类失效 (3C)：

| 类型 | 原因 | 典型改进 |
|---|---|---|
| 强制失效 (Compulsory) | 第一次访问某块，尚未缓存 | 预取、更大 Block；无法完全消除 |
| 容量失效 (Capacity) | 工作集大于 Cache 容量 | 分块、循环融合、减少工作集 |
| 冲突失效 (Conflict) | 多个块映射到相同 Set 并互相替换 | 调整布局、增加相联度、分块 |

在多核系统里还可能有一致性失效：其他核心修改了共享数据，本核心缓存副本失效。这与并发、Cache Coherence 相关，不应误归为普通 3C 失效。

### 7.2 替换策略

Set 已满且发生失效时，需要选一条 Line 驱逐。理想的 LRU (Least Recently Used) 驱逐最久未使用项，但高相联 Cache 中精确实现成本较高，实际硬件常采用近似 LRU、随机或其他策略。

软件不能依赖某种精确替换顺序。优化应减少不必要的工作集和冲突，而不是试图“骗过”某一代 CPU 的替换器。

## 8. 写操作策略

读失效只需取回所需 Block；写操作还涉及下层何时更新。

| 策略 | 行为 | 特点 |
|---|---|---|
| Write-through | 每次写 Cache 同时写下一层 | 一致性直观，但写流量大 |
| Write-back | 先只写 Cache，驱逐脏 Line 时再写下一层 | 写流量低，但需 Dirty bit |
| Write-allocate | 写失效时先取回 Block，再写 Cache | 常与 Write-back 搭配 |
| No-write-allocate | 写失效时直接写下一层，不载入 Block | 常与 Write-through 搭配 |

对于连续大数组的“只写一次、不再读取”，把整条 Line 读入后再覆盖可能浪费带宽；现代编译器或 Intrinsics 有时会使用 non-temporal store，但它需要准确的访问语义和测量支持。

## 9. Cache 性能指标

| 指标 | 定义 |
|---|---|
| 命中率 (Hit rate) | 命中次数 / 总访问次数 |
| 失效率 (Miss rate) | 失效次数 / 总访问次数 = 1 - 命中率 |
| 命中时间 (Hit time) | 命中时查找并返回数据的时间 |
| 失效代价 (Miss penalty) | 从下层填充数据额外等待的时间 |

平均内存访问时间 (AMAT) 的基础模型为：

$$
\mathrm{AMAT} = \mathrm{Hit\ time} + \mathrm{Miss\ rate} \times \mathrm{Miss\ penalty}
$$

多级 Cache 中，L1 的失效代价包含继续访问 L2 的时间；L2 的失效再继续传播到 LLC 和 DRAM。AMAT 有助于估算趋势，但真实处理器的乱序执行、预取和多个未完成失效会使单个访问延迟与总程序时间并不一一对应。

## 10. 真实处理器的 Cache 层次

现代多核 CPU 通常每个核心私有 L1 指令 Cache 与数据 Cache，可能还有私有 L2；更低层 LLC 往往由多个核心共享。具体容量、相联度、是否包含上层数据，均依 CPU 型号而定。

~~~mermaid
flowchart TB
    C1["Core 0<br/>Registers"] --> L11["L1I / L1D"]
    C2["Core 1<br/>Registers"] --> L12["L1I / L1D"]
    L11 --> L21["Private or shared L2"]
    L12 --> L22["Private or shared L2"]
    L21 --> LLC["Shared LLC"]
    L22 --> LLC
    LLC --> DRAM["DRAM"]
~~~

不要把“L3 一定包含 L2”当作普遍事实。不同微架构可能采用 inclusive、exclusive 或 non-inclusive 策略，性能分析应以目标机器的文档和测量为准。

## 11. 矩阵访问与行优先布局

C/C++ 多维数组按行优先 (row-major) 排列：

~~~c
double a[ROWS][COLS];
/* a[i][0], a[i][1], ... 在内存中连续 */
~~~

因此内层循环优先递增列下标通常更友好：

~~~c
/* 好：连续读取 */
for (size_t i = 0; i < rows; ++i)
    for (size_t j = 0; j < cols; ++j)
        sum += a[i][j];

/* 差：跨行大步长读取 */
for (size_t j = 0; j < cols; ++j)
    for (size_t i = 0; i < rows; ++i)
        sum += a[i][j];
~~~

第二种写法不一定总慢：若数组很小，整块数据可留在 Cache；若编译器做了变换，差异也可能缩小。问题在于规模增长后，跨步访问更容易浪费每条 Cache Line。

## 12. 矩阵乘法与分块

朴素矩阵乘法的算法复杂度为 O(n^3)，但循环顺序决定访问局部性。

~~~c
/* C[i][j] += A[i][k] * B[k][j] */
for (size_t i = 0; i < n; ++i)
    for (size_t j = 0; j < n; ++j)
        for (size_t k = 0; k < n; ++k)
            c[i][j] += a[i][k] * b[k][j];
~~~

在行优先布局中，b[k][j] 随 k 变化是跨行访问，通常不友好。交换 j 与 k 循环，可让 B 和 C 的内层访问更连续：

~~~c
for (size_t i = 0; i < n; ++i)
    for (size_t k = 0; k < n; ++k) {
        double aik = a[i][k];
        for (size_t j = 0; j < n; ++j)
            c[i][j] += aik * b[k][j];
    }
~~~

### 12.1 分块 (Blocking / Tiling)

当矩阵大到无法同时装入 Cache 时，将矩阵划为小块，使一个子块在被驱逐前完成更多计算：

~~~c
for (size_t ii = 0; ii < n; ii += BS)
    for (size_t kk = 0; kk < n; kk += BS)
        for (size_t jj = 0; jj < n; jj += BS)
            for (size_t i = ii; i < min(ii + BS, n); ++i)
                for (size_t k = kk; k < min(kk + BS, n); ++k) {
                    double aik = a[i][k];
                    for (size_t j = jj; j < min(jj + BS, n); ++j)
                        c[i][j] += aik * b[k][j];
                }
~~~

块大小 BS 受元素大小、Cache 容量、相联冲突、寄存器数量与多线程共享行为影响，不存在适用于所有机器的固定神奇数字。高性能 BLAS 库会进一步做多级分块、寄存器分块与 SIMD 微内核。

> **注意**：上例展示访问思想。实际内核还要处理 C 初始值、边界块、对齐、向量化和数值验证。

## 13. 面向 Stencil 与仿真内核的局部性

二维或三维 Stencil 每次更新一个网格点，读取附近邻居。它的算术量有限，通常比矩阵乘法更接近内存带宽受限。

~~~c
for (size_t i = 1; i + 1 < ny; ++i)
    for (size_t j = 1; j + 1 < nx; ++j)
        next[i][j] = 0.25 * (
            cur[i - 1][j] + cur[i + 1][j] +
            cur[i][j - 1] + cur[i][j + 1]);
~~~

对于船海工业仿真中的有限差分、有限体积和波场传播，可优先检查：

| 现象 | 可能原因 | 常见方向 |
|---|---|---|
| 网格增大后性能突然下降 | 工作集越过某级 Cache 容量 | 时间/空间分块 |
| 多个临时场数组很慢 | 反复读写 DRAM | 循环融合、减少临时数组 |
| SIMD 未生效 | 内层访问不连续、存在别名或分支 | 调整布局、restrict、掩码 |
| 多线程越多越不线性 | 带宽饱和、NUMA、伪共享 | 绑核、首触碰、分区 |
| 同一数据被多次扫描 | 时间局部性不足 | 调整算子调度、融合阶段 |

### 13.1 数组结构与结构体数组

若一个内核每次只需要速度分量 u，结构体数组 (AoS) 会连带搬入 v、w、压力等不需要字段；数组结构 (SoA) 更容易获得连续有效访问。

~~~c
/* AoS */
struct Cell { double u, v, w, p; } cell[N];

/* SoA */
struct Field { double u[N], v[N], w[N], p[N]; } field;
~~~

AoS 对“一次需要同一单元全部字段”的操作也有优势。数据布局必须匹配热点访问模式，而不是机械追随某一种范式。

### 13.2 多线程：伪共享

不同线程写入彼此独立的变量，若变量恰好落在同一 Cache Line，仍会触发 Cache Line 在核心间反复失效，这称为伪共享 (False Sharing)。

~~~text
Thread 0 写 counters[0] ─┐
                          ├─ 同一 Cache Line → 一致性流量
Thread 1 写 counters[1] ─┘
~~~

常见缓解方法是让线程写入独占的连续大区间、对独立频繁写变量做填充或对齐、并在最终阶段归约。填充会增加内存占用，应先用 Profiling 确认问题。

## 14. 预取、带宽与延迟隐藏

硬件预取器会识别规则的顺序或固定步长访问，提前把后续 Cache Line 拉近处理器。它对线性数组扫描很有效，对链表、哈希表、稀疏矩阵的间接寻址效果有限。

乱序执行和多条独立加载可以隐藏一部分内存延迟，但无法凭空增加 DRAM 带宽。对带宽受限的循环，减少传输字节数往往比增加算术操作更重要。

可用算术强度做初步判断：

$$
\mathrm{Arithmetic\ Intensity}
= \frac{\mathrm{operations}}{\mathrm{bytes\ transferred}}
$$

- 算术强度低：优先考虑访存、数据复用与循环融合；
- 算术强度高：更可能受 SIMD 或计算吞吐限制；
- 真实传输字节数取决于 Cache 行为，不能只数源代码中的变量个数。

这与第五章的 Roofline 视角相连：性能上界由计算峰值与可用内存带宽共同决定。

## 15. 如何观察 Cache 行为

### 15.1 基础工具

~~~bash
perf stat -r 5 \
  -e cycles,instructions,cache-references,cache-misses \
  ./solver
~~~

不同 CPU 可用的事件名称和含义不同。通用 cache-misses 往往较粗略；需要分析 L1、L2、LLC 或带宽时，应查阅本机 PMU 事件并使用对应工具。

### 15.2 Cachegrind 与访问轨迹

Valgrind 的 Cachegrind 可用模拟方式统计指令和数据访问，适合教学与小规模对比：

~~~bash
valgrind --tool=cachegrind ./program
cg_annotate cachegrind.out.*
~~~

它不等同于真实硬件：现代预取、乱序、多核一致性和具体替换策略都难以完整模拟。它适合解释“访问模式是否明显变好”，不适合直接预测真实运行时间。

### 15.3 Cache Lab

CSAPP 的 Cache Lab 通常包括两部分：

| 部分 | 任务 | 核心能力 |
|---|---|---|
| Part A | 模拟给定 s、E、b 的 Cache | 地址拆分、命中、替换与统计 |
| Part B | 优化矩阵转置 | 分块、对角线冲突和访问轨迹分析 |

转置的难点不在公式，而在读 A 与写 B 的访问如何映射到相同 Set。小块分块可使源块和目标块同时留在 Cache，显著降低冲突与容量失效。

## 16. 常见坑

| 坑 | 正确理解 |
|---|---|
| Cache 容量等于所有可用内存 | Cache 只是主存的高速副本，容量小得多 |
| 命中率高就一定快 | 还要看失效代价、带宽、依赖与计算量 |
| 连续访问一定无失效 | 首次访问仍会有强制失效，工作集过大仍会发生容量失效 |
| 增大 Block 一定更好 | Block 太大可能搬入无用数据并增加失效代价 |
| 相联度越高一定更快 | 硬件查找成本、功耗和命中时间也会增加 |
| 只用 3C 解释所有多核问题 | 一致性失效与伪共享属于另一类关键因素 |
| 矩阵转置只需交换两层循环 | 还需考虑读写映射冲突与分块大小 |
| 分块大小照抄网上常数 | 应匹配元素类型、Cache、线程数和目标机器 |
| 看到 Cache Miss 就盲目预取 | 随机访问预取可能污染 Cache、占用带宽 |
| 把 Cachegrind 数据当硬件真相 | 它是简化模型，必须用真实计数器复核 |

## 17. 本章复习路线

~~~mermaid
flowchart LR
    A["掌握时间/空间局部性"] --> B["会拆分 Tag、Set、Offset"]
    B --> C["能手算命中、失效与替换"]
    C --> D["分析矩阵访问和分块"]
    D --> E["连接到 Stencil、带宽与多线程"]
    E --> F["用工具验证访问假设"]
~~~

本章最终应能回答：

1. 为什么 Cache 要以 Block 而非单个字节作为传输单位？
2. 给定 m、s、E、b，如何计算 Cache 容量并拆分地址？
3. 强制、容量与冲突失效分别意味着什么？
4. 为什么行优先语言中内层循环通常应遍历最后一维？
5. 分块为何能改善矩阵乘法或转置的性能？
6. 为什么一个 Stencil 内核常受内存带宽而非浮点峰值限制？
7. 多线程程序中，伪共享为何会让“互不写同一变量”的线程仍然变慢？
