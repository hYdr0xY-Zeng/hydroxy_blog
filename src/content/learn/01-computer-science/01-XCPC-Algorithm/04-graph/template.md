---
title: "图论"
description: "图论相关板子"
date: 2026-07-02
tags: ["cs", "algorithm", "xcpc", "cpp"]
draft: false
---
# 图论

## 数组链表

```cpp
struct ALG
{
    int head[MAXN];
    int to[MAXM], nxt[MAXM], val[MAXM];
    int tot = 0;
    

    void add_e(int u, int v, int w)
    {
        to[++tot] = v;
        val[tot] = w;
        nxt[tot] = head[u];
        head[u] = tot;
    }
};
```

## 树论

### 树的性质(直径,中心,重心)

1. 若带有 **负权边** 则不可两遍 dfs 求直径（可dp求）。
2. 若边权均为正，所有**直径的中点**重合。
3. 树的中心不一定唯一，但最多有 2 个，一定位于树的直径上，且这两个中心是相邻的。
4. 树上所有点到其最远点的路径一定交会于树的中心。
5. 当通过在两棵树间连一条边以**合并**为一棵树时，连接两棵树的中心可以使**新树的直径最小**。
6. 树的中心到其他任意节点的距离不超过树直径的一半。
7. 当树以重心为根时，任一真**子树的大小**均不超过原树结点数的一半。
8. 在所有以某个结点为根时的**最大真子树大小**中，以重心为根时所得到的值最小。
9. 在所有以某个结点为根时所有结点的深度和中，以重心为根时**深度和**最小。
10. 树的重心如果不唯一，则恰有 2 个．这两个重心相邻，且删去它们的连边后，树将变为两个大小相同的连通分量。
11. 在一棵树上添加或删除一个叶子，那么它的重心最多只移动一条边的距离。
12. 把两棵树通过一条边相连得到一棵新的树，那么**新树的重心**在连接**原来两棵树的重心的路径**上。
13. 一棵有根树的重心一定在根结点所在的**重链**上．一棵树的重心一定是该树根结点重子结点对应**子树的重心的祖先**。

### lca

```cpp
// 树上倍增
struct ALG
{
    int head[MAXN], val[MAXN];
    int to[MAXM], nxt[MAXM];
    int tot = 0;
    int len = 0;

    int sz[MAXN], dep[MAXN], top[MAXN];
    int stjmp[MAXN][MAXJ];


    void add_e(int u, int v)
    {
        to[++tot] = v;
        nxt[tot] = head[u];
        head[u] = tot;
    }

    void DFS(int f, int u)
    {
        sz[u] = 1;
        dep[u] = dep[f] + 1;

        stjmp[u][0] = f;
        for (int i = 1; i < MAXJ; i++) stjmp[u][i] = stjmp[stjmp[u][i - 1]][i - 1];

        for (int i = head[u]; i ; i = nxt[i])
        {
            int v = to[i];
            if (v == f) continue;
            DFS(u, v, rt);
            sz[u] += sz[v];
        }
    }

    int lca(int u, int v)
    {
        if (dep[u] < dep[v]) swap(u, v);

        for (int i = MAXJ - 1; i >= 0; i--)
        {
            if (dep[stjmp[u][i]] >= dep[v]) u = stjmp[u][i];
            if (dep[u] == dep[v]) break;
        }
        
        if (u == v) return v;

        for (int i = MAXJ - 1; i >= 0; i--)
        {
            if (stjmp[u][i] != stjmp[v][i])
            {
                u = stjmp[u][i];
                v = stjmp[v][i];
            }
        }
        return stjmp[v][0];
    }
}
```

```cpp
// tarjan离线
int n, m, s;

struct ALG
{
    // 原树
    int head[MAXN];
    int to[MAXM], nxt[MAXM];
    int cnt = 0;

    // 询问图
    int qhead[MAXN];
    int qto[MAXM], qnxt[MAXM], qid[MAXM];
    int qcnt = 0;

    int fa[MAXN];
    bool vis[MAXN];
    int ans[MAXN];

    void add_e(int u, int v)
    {
        to[++cnt] = v;
        nxt[cnt] = head[u];
        head[u] = cnt;
    }

    void add_q(int u, int v, int id)
    {
        qto[++qcnt] = v;
        qid[qcnt] = id;
        qnxt[qcnt] = qhead[u];
        qhead[u] = qcnt;
    }

    int find(int u)
    {
        if (fa[u] == u) return u;
        return fa[u] = find(fa[u]);
    }

    void tarjan(int u)
    {
        vis[u] = true;

        for (int i = head[u]; i; i = nxt[i])
        {
            int v = to[i];
            if (vis[v]) continue;

            tarjan(v);

            // v 的整棵子树处理完成后，
            // 将 v 所在集合并到 u
            fa[v] = u;
        }

        for (int i = qhead[u]; i; i = qnxt[i])
        {
            int v = qto[i];

            if (vis[v])
            {
                ans[qid[i]] = find(v);
            }
        }
    }

    void init()
    {
        for (int i = 1; i <= n; i++)
        {
            fa[i] = i;
        }
    }

} g;

void solve()
{
    cin >> n >> m >> s;

    for (int i = 1, u, v; i < n; i++)
    {
        cin >> u >> v;
        g.add_e(u, v);
        g.add_e(v, u);
    }

    for (int i = 1, u, v; i <= m; i++)
    {
        cin >> u >> v;
        g.add_q(u, v, i);
        g.add_q(v, u, i);
    }

    g.init();
    g.tarjan(s);

    for (int i = 1; i <= m; i++)
    {
        cout << g.ans[i] << '\n';
    }
}
```

> 重链剖分法见下

### 重链剖分

> 重链剖分往往出现在涉及**路径**上数据维护的题目中
> 重链数据合并时注意**数据的方向**，可以封装一个数据类，重载 + 用来表示数据的合并，在线段树里亦可以使用。

```cpp
struct Decompose
{
    int head[MAXN], val[MAXN];
    int to[MAXM], nxt[MAXM];
    int tot = 0;

    int fa[MAXN], sz[MAXN], dep[MAXN], hev[MAXN];
    int top[MAXN], dfn[MAXN], rnk[MAXN], stp;

    void add_e(int u, int v)
    {
        to[++tot] = v;
        nxt[tot] = head[u];
        head[u] = tot;
    }

    void DFS1(int f, int u)
    {
        sz[u] = 1;
        fa[u] = f;
        dep[u] = dep[f] + 1;
        int mv = 0;
        for (int i = head[u]; i ; i = nxt[i])
        {
            int v = to[i];
            if (v == f) continue;
            DFS1(u, v);
            sz[u] += sz[v];
            if (sz[v] > sz[mv]) mv = v;
        }
        hev[u] = mv;
    }
    
    void DFS2(int u, int t)
    {
        top[u] = t;
        dfn[u] = ++stp;
        rnk[stp] = u;
        if (hev[u]) DFS2(hev[u], t);
        for (int i = head[u]; i ; i = nxt[i])
        {
            int v = to[i];
            if (v == fa[u] || v == hev[u]) continue;
            DFS2(v, v);
        }
    }

    void build()
    {
        DFS1(0, 1);
        DFS2(1, 1);
    }

    int lca(int u, int v)
    {
        while (top[u] != top[v])
        {
            if (dep[top[u]] < dep[top[v]]) swap(u, v);
            u = fa[top[u]];
        }
        return (dep[u] < dep[v]) ? u : v;
    }

} g;
```

### 长链剖分

> 注意长剖跳转根节点的复杂度是 $ O(\sqrt n) $
> 下面是 LA 问题的模板

```cpp
int high[MAXN]; // 预处理最高有效位 high[i] = high[i / 2] + 1;

struct Decompose
{
    int head[MAXN];
    int to[MAXM], nxt[MAXM];
    int tot = 0;

    int dep[MAXN], len[MAXN], son[MAXN];
    int top[MAXN], dfn[MAXN], stp = 0;
    int root;

    int stjmp[MAXN][MAXJ];
    int dw[MAXN], up[MAXN];

    int val[MAXN];

    void add_e(int u, int v)
    {
        to[++tot] = v;
        nxt[tot] = head[u];
        head[u] = tot;
    }

    void DFS1(int u)
    {
        dep[u] = dep[stjmp[u][0]] + 1;

        for (int p = 1; p < MAXJ; p++) stjmp[u][p] = stjmp[stjmp[u][p - 1]][p - 1];

        int mv = 0;
        for (int i = head[u]; i ; i = nxt[i])
        {
            int v = to[i];
            DFS1(v);
            if (len[v] > len[mv]) mv = v;
        }
        son[u] = mv;
        len[u] = len[mv] + 1;
    }

    void DFS2(int u, int t)
    {
        top[u] = t;
        dfn[u] = ++stp;
        dw[stp] = u;
        if (!son[u]) return;
        DFS2(son[u], t);
        for (int i = head[u]; i ; i = nxt[i])
        {
            int v = to[i];
            if (v == son[u]) continue;
            DFS2(v, v);
        }
    }

    void prepare()
    {
        DFS1(root);
        DFS2(root, root);

        for (int u = 1; u <= n; u++)
        {
            if (top[u] != u) continue;
            for (int i = 0, v = u; v && i < len[u]; i++, v = stjmp[v][0])
            {
                up[dfn[u] + i] = v;
            }
        }
    }

    int query(int x, int k)
    {
        if (k == 0) return x;

        int h = high[k];
        if (k == 1 << h) return stjmp[x][h];

        x = stjmp[x][h];
        k -= 1 << h;
        k -= dep[x] - dep[top[x]];
        x = top[x];
        return (k >= 0) ? up[dfn[x] + k] : dw[dfn[x] - k];
    }

} g;

```

### 树上启发式合并

> 特征为静态数据查询，不支持修改操作。
> 
> 小集合并大集合的思想更重要——每个点最多遍历 $ O(\log n) $ 次，所以可以放心大胆遍历轻链，dsu on tree具备很灵活的数据维护能力。
> 
> 可以与树dp混用，但要注意数据更新顺序，尤其注意需要跨子树合并答案时。

```cpp
struct DSU_on_tree
{
    int head[MAXN];
    int to[MAXM], nxt[MAXM], val[MAXM];
    int tot = 0;

    // 重链剖分
    int fa[MAXN], sz[MAXN], dep[MAXN], hev[MAXN];

    /* data */

    void add_e(int u, int v, int w)
    {
        to[++tot] = v;
        val[tot] = w;
        nxt[tot] = head[u];
        head[u] = tot;
    }

    void DFS1(int f, int u)
    {
        sz[u] = 1;
        fa[u] = f;
        int mv = 0;
        for (int i = head[u]; i ; i = nxt[i])
        {
            int v = to[i];
            if (v == f) continue;
            dep[v] = dep[u] + 1;
            DFS1(v);
            sz[u] += sz[v];
            if (sz[v] > sz[mv]) mv = v;
        }
        hev[u] = mv;
    }

    void effect(int u)
    {
        /* data maintenance */

        for (int i = head[u]; i ; i = nxt[i])
        {
            int v = to[i];
            if (v == fa[u]) continue;
            effect(v);
        }
    }

    void cancel(int u)
    {
        /* data maintenance */
        
        for (int i = head[u]; i ; i = nxt[i])
        {
            int v = to[i];
            if (v == fa[u]) continue;
            cancel(v);
        }
    }

    void DFS2(int u, int keep)
    {
        for (int i = head[u]; i ; i = nxt[i])
        {
            int v = to[i];
            if (v == hev[u] || v == fa[u]) continue;
            DFS2(v, 0);
        }

        if (hev[u]) DFS2(hev[u], 1);

        /* data maintenance */
        
        for (int i = head[u]; i; i = nxt[i])
        {
            int v = to[i];
            if (v == hev[u] || v == fa[u]) continue;
            effect(v);
        }

        if (!keep) cancel(u);
    }

} g;
```

### 虚树

### 树分治

## 最短路

### Dijkstra

### Floyd

### SPFA

## 生成树

### Prim

### Kruskal

## 连通性

### Tarjan缩点

## 2-SAT

## 欧拉回路

## 网络流
