---
title: "ch7 - 链接"
description: "07-linking"
date: 2026-09-08
tags: ["cs", "csapp", "system"]
draft: false
---

# 第 7 章：链接

> 主题：链接 (Linking)  
> 目标：理解多个源文件如何变为一个可运行程序，掌握符号解析、重定位、静态库、共享库和运行时动态链接，并能用 ELF 工具定位常见构建与部署问题。

## 1. 本章核心视角

链接器 (Linker) 将独立编译的目标文件和库组合为可执行文件或共享库，同时解决“某个名字指向哪里”和“机器指令中的地址该填什么”两个核心问题。

~~~mermaid
flowchart LR
    A["main.c"] --> C["编译"]
    B["math.c"] --> C
    C --> D["main.o / math.o<br/>可重定位目标文件"]
    D --> E["链接器 ld"]
    F["静态库 .a<br/>共享库 .so"] --> E
    E --> G["可执行文件或共享库"]
    G --> H["加载器"]
    H --> I["进程地址空间"]
~~~

链接不是“编译完成后的附属步骤”。它决定模块边界、依赖版本、符号可见性、启动时间和部署方式；大型仿真软件中，MPI、BLAS、网格库、求解器插件与 GPU 运行库都依赖它。

## 2. 从源文件到进程

以 C 程序为例：

~~~text
源文件 .c
  └─ 预处理器 cpp
       └─ 汇编级文本 .s
            └─ 汇编器 as
                 └─ 可重定位目标文件 .o
                      └─ 链接器 ld
                           └─ 可执行文件 / 共享库
                                └─ 加载器 ld-linux
                                     └─ 进程运行
~~~

| 阶段 | 主要输入 | 主要输出 | 解决的问题 |
|---|---|---|---|
| 预处理 | 源码、头文件 | 展开后的源码 | 宏、include、条件编译 |
| 编译 | C/C++ 源码 | 汇编 | 语法、类型、优化、指令选择 |
| 汇编 | 汇编文本 | .o | 指令编码、节、局部符号 |
| 链接 | .o、库 | 可执行文件或 .so | 跨模块符号与地址 |
| 加载 | 可执行文件、.so | 进程映像 | 映射、动态符号、初始化 |

头文件通常只提供声明；真正的函数或变量定义必须在某个目标文件或库中出现。能通过编译不代表能通过链接。

## 3. ELF 文件与目标文件类型

Linux/Unix 常使用 ELF (Executable and Linkable Format)。常见 ELF 相关文件：

| 类型 | 常见后缀 | 用途 |
|---|---|---|
| 可重定位目标文件 | .o | 尚未确定最终地址，可继续参与链接 |
| 可执行目标文件 | 无固定后缀 | 可由加载器启动 |
| 共享目标文件 | .so | 可被多个进程或模块动态加载 |
| 核心转储 | core | 异常进程的内存快照 |

一个可重定位目标文件通常包含：

| 节 (Section) | 常见内容 |
|---|---|
| .text | 机器代码 |
| .rodata | 只读常量、字符串 |
| .data | 已初始化的全局/静态变量 |
| .bss | 未初始化的全局/静态变量，不占文件实际数据空间 |
| .symtab | 链接器使用的符号表 |
| .rela.text / .rela.data | 重定位记录 |
| .debug_* | 调试信息，通常由 -g 生成 |

可用 readelf 查看，不必猜测：

~~~bash
readelf -h a.o          # ELF 文件头
readelf -S a.o          # Section 表
readelf -s a.o          # 符号表
readelf -r a.o          # 重定位项
~~~

## 4. 符号：跨模块的名字

链接器用符号 (Symbol) 表示函数、全局变量和其他可被引用的实体。对 C 目标文件，常将符号分为：

| 类型 | 含义 | 示例 |
|---|---|---|
| 全局符号 | 本模块定义，其他模块可引用 | 非 static 函数、非 static 全局变量 |
| 外部符号 | 本模块引用，定义在其他模块 | printf、其他 .c 中的函数 |
| 局部符号 | 仅本模块可见 | static 函数、static 全局变量 |

不要把“局部符号”与 C 的局部自动变量混为一谈。普通栈变量通常不作为链接器符号出现。

~~~c
/* a.c */
int global_count = 0;        /* 全局符号 */
static int cache_size = 64;  /* 局部符号 */

void solve(void)             /* 全局符号 */
{
    static int calls = 0;    /* 局部符号，静态存储期 */
    int local = 0;           /* 栈变量，不是链接器局部符号 */
    ++calls;
    global_count += local;
}
~~~

## 5. 强符号、弱符号与重名

在传统 C 链接模型中，函数和已初始化全局变量通常是强符号；未初始化全局变量在工具链语义中可能表现为 tentative definition。现代 GCC 默认采用 -fno-common，使多个同名全局变量定义通常直接报错。

应避免依赖工具链对“弱符号”或 common 符号的历史兼容行为。推荐规则很朴素：

1. 一个全局名字只定义一次；
2. 需要跨模块访问时，在头文件中写 extern 声明；
3. 不需要导出的函数和变量加 static；
4. C++ 的全局对象、模板和 inline 规则更复杂，应交给语言和构建系统管理。

~~~c
/* config.h */
extern int max_iter;

/* config.c：唯一的定义 */
int max_iter = 1000;
~~~

~~~c
/* user.c：只声明，不重复定义 */
#include "config.h"
~~~

## 6. 静态链接的两个任务

静态链接器主要完成两件事：

1. 符号解析 (Symbol Resolution)：把每个外部引用绑定到一个定义；
2. 重定位 (Relocation)：将合并后的 Section 放入最终地址空间，并修改指令或数据中的地址字段。

~~~mermaid
flowchart TD
    A["输入 .o 与 .a"] --> B["收集并解析符号"]
    B --> C["合并同类 Section"]
    C --> D["分配最终虚拟地址"]
    D --> E["应用重定位记录"]
    E --> F["生成可执行文件"]
~~~

### 6.1 符号解析

~~~c
/* main.c */
extern int add(int, int);
int main(void) { return add(1, 2); }

/* add.c */
int add(int x, int y) { return x + y; }
~~~

编译 main.c 时，编译器只需知道 add 的类型；链接时才需要找到 add.c 编译得到的定义。若没有传入 add.o 或包含它的库，链接器会报告 undefined reference。

### 6.2 重定位

链接器合并各输入文件的 .text、.data 等 Section 后，代码和数据的最终地址才确定。它遍历重定位条目，修补两类典型引用：

| 引用 | 例子 | 常见处理 |
|---|---|---|
| PC 相对引用 | call 某函数、条件跳转 | 写入目标相对下一条指令的位移 |
| 绝对/数据引用 | 取全局变量地址 | 写入或间接得到最终地址 |

可重定位 .o 中的调用地址常只是占位值；不要用反汇编中尚未重定位的数值推断最终调用目标。

## 7. 用工具观察符号与重定位

~~~bash
gcc -c main.c add.c
nm main.o
nm add.o
readelf -r main.o
objdump -dr main.o
~~~

nm 输出中常见标记：

| 标记 | 含义 |
|---|---|
| T / t | 位于 .text 的全局 / 局部符号 |
| D / d | 位于 .data 的全局 / 局部符号 |
| B / b | 位于 .bss 的全局 / 局部符号 |
| U | 未定义符号，等待其他对象提供 |
| W / w | 弱符号 |

~~~bash
gcc main.o add.o -o app
nm app | grep ' add$'
objdump -d -Mintel app
~~~

分析“未定义引用”时，先用 nm 确认引用方是否显示 U，再确认库或对象是否真的导出了同名且 ABI 兼容的定义。

## 8. 静态库

静态库通常是多个 .o 的归档文件：

~~~bash
gcc -c vec.c mat.c
ar rcs libnumerics.a vec.o mat.o
ranlib libnumerics.a
~~~

链接时可写为：

~~~bash
gcc main.o -L./lib -lnumerics -o solver
~~~

这里 -lnumerics 对应 libnumerics.a 或 libnumerics.so。若两者都存在，默认选择受工具链和选项影响；使用 -static 或明确文件名可改变选择策略。

### 8.1 为什么库顺序重要

传统链接器通常从左到右扫描输入。对象文件会立即加入，静态库中的成员只有在它能解决“此前已经出现的未定义引用”时才被抽取。

~~~text
正确：gcc main.o -lfoo -lbar -o app
风险：gcc -lfoo main.o -lbar -o app
~~~

若 libfoo 依赖 libbar，foo 应在 bar 前面。循环依赖可通过重复库或 GNU ld 的 --start-group / --end-group 处理，但更好的长期方案通常是消除不必要的循环依赖。

### 8.2 静态库的取舍

| 优点 | 代价 |
|---|---|
| 部署时依赖少 | 可执行文件更大 |
| 不依赖运行时共享库版本 | 每个进程可能有一份代码副本 |
| 构建结果容易封装 | 更新库通常需要重新链接 |

静态链接不等于“绝对可移植”。仍可能依赖系统调用、动态加载器、NSS、GPU 驱动或特定 CPU 指令集。

## 9. 共享库与动态链接

共享库由多个进程共享映射，常见后缀为 .so。构建位置无关代码 (PIC) 的共享库：

~~~bash
gcc -fPIC -c numerics.c -o numerics.o
gcc -shared -Wl,-soname,libnumerics.so.1 \
  -o libnumerics.so.1.0 numerics.o
ln -sf libnumerics.so.1.0 libnumerics.so.1
ln -sf libnumerics.so.1 libnumerics.so
~~~

链接应用：

~~~bash
gcc main.o -L. -lnumerics -Wl,-rpath,'$ORIGIN' -o solver
~~~

其中：

| 概念 | 作用 |
|---|---|
| PIC | 代码不假设自己被装载到固定地址 |
| SONAME | 运行时依赖的兼容 ABI 名称，如 libx.so.1 |
| rpath / RUNPATH | 给动态加载器的库搜索路径信息 |
| $ORIGIN | 可执行文件或库所在目录，适合可携带部署 |

生产环境不应随意依赖 LD_LIBRARY_PATH；它易受 shell 环境和部署顺序影响。更稳妥的方案是由包管理器、容器、模块系统或明确的 RUNPATH 管理依赖。

## 10. 动态加载器、GOT 与 PLT

运行可动态链接的 ELF 时，内核先加载解释器（常见为 ld-linux），动态加载器再映射所需共享库、解析符号、执行初始化函数，并将控制权交给程序入口。

~~~mermaid
sequenceDiagram
    participant K as Kernel
    participant L as Dynamic Loader
    participant P as Program
    participant S as Shared Library
    K->>L: Map executable and start interpreter
    L->>S: Map dependent shared libraries
    L->>L: Resolve relocations and run initializers
    L->>P: Transfer control to entry point
    P->>S: Call external function
~~~

位置无关代码通常通过两类表间接访问外部实体：

| 结构 | 作用 |
|---|---|
| GOT (Global Offset Table) | 保存全局数据或函数的运行时地址 |
| PLT (Procedure Linkage Table) | 外部函数调用的跳板，配合 GOT 完成解析 |

延迟绑定 (Lazy Binding) 可以把某些函数的符号解析推迟到第一次调用，减少启动工作；立即绑定则在启动时完成更多解析。具体行为受链接选项和安全策略影响。

> **重点**：GOT/PLT 是实现细节，应用程序不应依赖其具体布局。理解它们的价值在于解释“外部调用为何是一次间接跳转”以及动态链接错误如何出现。

## 11. 运行时加载：dlopen

程序也可在运行时按需加载共享对象，这常用于插件、可选求解器后端或不同硬件实现。

~~~c
#include <dlfcn.h>

void *handle = dlopen("./libkernel.so", RTLD_NOW);
if (handle == NULL)
    /* 处理 dlerror() */;

typedef double (*kernel_fn)(const double *, size_t);
kernel_fn kernel = (kernel_fn)dlsym(handle, "kernel");
if (kernel == NULL)
    /* 处理 dlerror() */;

double result = kernel(data, n);
dlclose(handle);
~~~

链接时通常需要：

~~~bash
gcc app.c -ldl -o app
~~~

动态加载将一部分链接错误延后到运行时，因此插件接口必须定义清楚的 ABI、版本号、错误处理与生命周期。C++ 跨编译器或跨标准库边界直接传递 STL 容器、异常或虚函数对象，兼容风险较高；稳定插件 ABI 常使用 C 风格边界。

## 12. 位置无关可执行文件与地址随机化

现代 Linux 发行版常默认构建 PIE (Position-Independent Executable)，配合 ASLR (Address Space Layout Randomization) 使程序每次运行的装载基址可能不同。

~~~bash
gcc -fPIE -pie main.c -o app-pie
readelf -h app-pie
~~~

这能提高利用固定地址的攻击难度，也意味着调试、反汇编与漏洞分析中看到的运行时地址不一定等于文件中的静态虚拟地址。

## 13. C++ 的额外链接问题

### 13.1 名字改编与 extern "C"

C++ 为支持重载，会对符号名进行名字改编 (Name Mangling)。C 库接口若要被 C++ 调用，头文件通常需要：

~~~cpp
#ifdef __cplusplus
extern "C" {
#endif

int c_api_init(int mode);

#ifdef __cplusplus
}
#endif
~~~

这只解决符号名规则，不会自动解决数据布局、异常、RTTI 或标准库 ABI 的兼容性。

### 13.2 One Definition Rule

C++ 的 One Definition Rule (ODR) 要求实体在整个程序中的定义满足一致性要求。头文件中放非 inline 函数或非 inline 全局变量定义，常会导致 multiple definition；模板和 inline 定义则通常必须放在头文件中供各编译单元实例化。

### 13.3 ABI 兼容性

编译器版本、标准库实现、编译选项和宏都可能影响 ABI。对长期维护的科学计算软件，应记录：

- 编译器与版本；
- C++ 标准与标准库；
- OpenMP、MPI、CUDA/HIP 等运行时；
- BLAS/LAPACK、HDF5、NetCDF 等依赖版本；
- CPU 架构与编译目标选项。

“可以链接成功”只说明名字和符号满足，不能保证数据布局或运行时行为兼容。

## 14. 面向高性能计算与工业仿真的链接实践

### 14.1 构建可复现环境

求解器往往依赖 MPI、线性代数库、网格库、I/O 库与加速器运行时。不同组合即使 API 相同，也可能因 ABI 或线程运行时冲突而表现不同。

建议把编译器、依赖版本、构建选项和运行模块写入构建元数据：

~~~text
compiler: GCC 14.x
mpi: Open MPI 5.x
blas: OpenBLAS / vendor BLAS
build type: Release
flags: -O3 -march=...
~~~

这里的 ... 应由目标集群的实际 CPU 与部署策略决定，不能照搬开发机选项。

### 14.2 避免混用 MPI 与 OpenMP 运行时

多套 MPI、OpenMP 或 C++ 标准库同时进入一个进程，可能导致符号冲突、线程行为异常或性能退化。可用以下命令检查动态依赖：

~~~bash
ldd ./solver
readelf -d ./solver | grep -E 'NEEDED|RPATH|RUNPATH'
~~~

ldd 会执行动态加载器的一部分逻辑；面对不可信二进制文件时，应优先使用 readelf 等纯解析工具。

### 14.3 插件和后端

将不同湍流模型、线性求解器或 GPU 后端做成插件，可减少主程序的链接负担并支持按需部署。但插件边界应保持小而稳定：

| 建议 | 原因 |
|---|---|
| 导出少量明确的 C ABI 函数 | 降低 C++ ABI 耦合 |
| 显式传入版本和能力描述 | 及早拒绝不兼容插件 |
| 由创建方释放资源 | 避免跨运行时 allocator |
| 错误码或字符串由接口约定管理 | 避免跨库抛异常 |
| 记录插件依赖与构建信息 | 便于复现实验和排障 |

## 15. 常见链接错误的定位

| 现象 | 常见原因 | 首先检查 |
|---|---|---|
| undefined reference | 漏传 .o / 库、库顺序错误、符号名不匹配 | 编译命令、nm、链接顺序 |
| multiple definition | 同一全局定义出现在多个编译单元 | 头文件是否含定义、是否缺 static / extern |
| cannot find -lfoo | -L 路径错误或库名不符合 libfoo.so / libfoo.a | 文件名、搜索路径 |
| error while loading shared libraries | 运行时找不到 .so 或 SONAME 不匹配 | ldd、RUNPATH、安装路径 |
| symbol lookup error | 找到库但缺少所需导出符号 | readelf -s、版本与 ABI |
| relocation ... against ... | 非 PIC 目标试图进入共享库等 | 是否用 -fPIC 重编 |
| 运行崩溃但链接通过 | ABI、数据布局、线程运行时或库版本冲突 | 编译器/依赖矩阵、调试器 |

定位顺序建议：

~~~mermaid
flowchart TD
    A["保存完整编译/链接命令"] --> B["确认是编译期、链接期还是运行期错误"]
    B --> C["用 nm/readelf 检查符号定义与引用"]
    C --> D["检查库顺序、-L、RUNPATH 与 SONAME"]
    D --> E["检查编译器、ABI 和运行时版本"]
    E --> F["最小复现并修正构建描述"]
~~~

## 16. 常用命令速查

| 命令 | 用途 |
|---|---|
| gcc -c a.c | 只编译汇编，不链接，生成 a.o |
| gcc a.o b.o -o app | 链接对象文件 |
| ar rcs libx.a x.o | 创建或更新静态库 |
| nm -C file | 查看符号；-C 对 C++ 符号反改编 |
| readelf -S/-s/-r/-d file | 查看 Section、符号、重定位、动态段 |
| objdump -dr file | 反汇编并显示重定位信息 |
| ldd app | 查看运行时共享库依赖 |
| LD_DEBUG=libs ./app | 观察动态加载器的库搜索过程 |
| patchelf --print-rpath app | 查看 RPATH/RUNPATH（若已安装 patchelf） |

当构建系统生成的命令过长时，可开启 verbose 模式，例如 Make 的 V=1、Ninja 的 -v 或 CMake 的 CMAKE_VERBOSE_MAKEFILE。真正的链接命令比 IDE 的概述更有诊断价值。

## 17. 常见坑

| 坑 | 正确理解 |
|---|---|
| include 了头文件就“链接了库” | 头文件只提供声明，库或 .o 才提供定义 |
| 所有 undefined reference 都是函数没实现 | 也可能是名称改编、ABI、库顺序或条件编译问题 |
| 把全局变量定义放进头文件 | 通常应放唯一 .c/.cc，头文件用 extern 声明 |
| 静态库放在命令最前面 | 静态库通常应放在引用它的对象之后 |
| 编译通过就等于程序可部署 | 运行时仍可能找不到共享库或加载了错误版本 |
| 依赖 LD_LIBRARY_PATH 就万事大吉 | 环境不稳定，容易污染其他程序 |
| C++ 与 C 的 extern "C" 能解决所有兼容性 | 它只解决符号名，不保证完整 ABI |
| 链接同一 MPI 库就不会出问题 | 多个运行时、编译器与线程库仍可能冲突 |
| 直接手改二进制地址即可修复重定位 | 应修复源代码、链接脚本或构建配置 |
| 只看 ldd 判断不可信文件 | 可能触发加载器行为，优先用 readelf 静态检查 |

## 18. 本章复习路线

~~~mermaid
flowchart LR
    A["区分编译、汇编、链接、加载"] --> B["理解 ELF Section 与符号"]
    B --> C["掌握符号解析与重定位"]
    C --> D["理解静态库扫描顺序"]
    D --> E["理解共享库、PIC、GOT/PLT"]
    E --> F["能排查构建与部署依赖"]
~~~

本章最终应能回答：

1. .o、.a、.so 和可执行文件在链接阶段分别扮演什么角色？
2. 编译器已经知道函数原型，为何链接器还会报告 undefined reference？
3. 符号解析和重定位分别解决什么问题？
4. 为什么静态库的链接顺序会影响是否成功？
5. PIC、GOT、PLT 和动态加载器如何配合支持共享库？
6. 为什么共享库能链接成功，却在运行时找不到或发生 symbol lookup error？
7. 对 MPI、BLAS 和插件化求解器，如何减少 ABI 与运行环境的不确定性？
