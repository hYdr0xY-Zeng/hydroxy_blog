---
title: "数据结构"
description: "数据结构相关板子"
date: 2026-07-17
tags: ["cs", "algorithm", "xcpc", "cpp"]
draft: false
---

# 并查集

## 路径压缩 + 启发式合并

- 维护元素之间的连通关系，每个集合由一个根节点代表。
- 路径压缩配合按大小合并，单次操作的均摊复杂度为 $O(\alpha(n))$。

```cpp
struct DSU
{
    int fa[MAXN], sz[MAXN];

    // 初始化并查集，每个元素自成一个集合
    void init(int n)
    {
        for (int i = 0; i <= n; i++)
        {
            fa[i] = i;
            sz[i] = 1;
        }
    }

    // 查找元素所在集合的根，并压缩沿途路径
    int find(int a)
    {
        if (a == fa[a]) return a;
        return fa[a] = find(fa[a]);
    }

    // 按集合大小合并；已连通时返回 false
    bool unite(int s1, int s2)
    {
        int f1 = find(s1);
        int f2 = find(s2);
        if (f1 == f2) return false;
        if (sz[f1] < sz[f2]) swap(f1, f2);
        fa[f2] = f1;
        sz[f1] += sz[f2];
        return true;
    }
};
```

## 种类并查集

- 开 $m$（种类数）倍空间，相当于增加一维来表示种类信息。
- 类似 SAT 问题：根据种类关系合并节点；同一个体的不同类型落入同一集合时即产生冲突。

```cpp
// 两个种类的示例
struct DSU
{
    int fa[MAXN << 1];
    int n;

    // 初始化 n 个实体及其对应的另一种类型
    void init(int _n)
    {
        n = _n;
        for (int i = 0; i <= n * 2; i++)
        {
            fa[i] = i;
        }
    }

    // 查找元素所在集合的根，并压缩沿途路径
    int find(int a)
    {
        if (a == fa[a]) return a;
        return fa[a] = find(fa[a]);
    }

    // 添加 s1 与 s2 属于不同种类的约束；冲突时返回 false
    bool unite(int s1, int s2)
    {
        int f01 = find(s1);
        int f02 = find(s2);
        int f11 = find(s1 + n);
        int f12 = find(s2 + n);

        if (f01 == f02 || f11 == f12) return false;
        fa[f02] = f11;
        fa[f12] = f01;
        return true;
    }
};
```

## 带权并查集

- 维护数值的**加减关系**，例如偏移量和距离。
- 扩展权值运算后，也可维护倍数的**比例关系**。
- 对权值取模可维护**循环关系**，例如布尔关系和食物链；种类较多时通常比种类并查集节省空间。

```cpp
struct DSU
{
    int fa[MAXN], sz[MAXN], dis[MAXN];

    // 初始化并查集；dis[x] 表示 x 到父节点的权值差
    void init(int n)
    {
        for (int i = 0; i <= n; i++)
        {
            fa[i] = i;
            sz[i] = 1;
            dis[i] = 0;
        }
    }

    // 查找根节点，同时累加 x 到根的权值差
    int find(int a)
    {
        if (a == fa[a]) return a;
        int tmp = find(fa[a]);
        dis[a] += dis[fa[a]];
        return fa[a] = tmp;
    }

    // 添加 dis[s1] - dis[s2] = w 的约束；矛盾时返回 false
    bool unite(int s1, int s2, int w)
    {
        int f1 = find(s1);
        int f2 = find(s2);
        if (f1 == f2) return (dis[s1] - dis[s2] == w);

        if (sz[f1] < sz[f2])
        {
            swap(f1, f2);
            swap(s1, s2);
            w *= -1;
        }
        fa[f2] = f1;
        dis[f2] = dis[s1] - w - dis[s2];
        sz[f1] += sz[f2];
        return true;
    }
};
```

# ST 表

- 适用于满足可重复贡献性质的静态区间运算，例如 `min`、`max` 和 `gcd`。
- $O(n \log n)$ 预处理，$O(1)$ 查询；不支持在线修改。

```cpp
int ST[MAXS][MAX]; // MAXS = __lg(MAX) + 1

// 初始化第 0 层，并构建所有长度为 2 的幂的区间答案
void build_ST()
{
    for (int i = 1; i <= n; i++) ST[0][i] = a[i];

    int bound = __lg(n);
    for (int i = 1; i <= bound; i++)
    {
        for (int j = 1; j + (1 << i) - 1 <= n; j++)
        {
            ST[i][j] = max(ST[i - 1][j], ST[i - 1][j + (1 << (i - 1))]);
        }
    }
}

// 查询闭区间 [L, R] 的最大值
int query(int L, int R)
{
    int k = __lg(R - L + 1);
    return max(ST[k][L], ST[k][R - (1 << k) + 1]);
}
```

# 树状数组

- 当前模板维护加法前缀和，支持 $O(\log n)$ 单点加与区间求和。
- 对差分数组使用同一模板，可实现区间加与单点查询。

```cpp
template <typename T>
struct BidxTree
{
    T t[MAX];

    // 返回 x 在二进制表示中的最低位 1 所对应的值
    int lowbit(int x)
    {
        return x & -x;
    }

    // 将位置 pos 的值增加 mdf
    void change(int pos, T mdf)
    {
        while (pos <= N)
        {
            t[pos] += mdf;
            pos += lowbit(pos);
        }
    }

    // 查询闭区间 [1, pos] 的元素和
    T prefix_sum(int pos)
    {
        T ans = 0;
        while (pos)
        {
            ans += t[pos];
            pos -= lowbit(pos);
        }
        return ans;
    }

    // 查询闭区间 [l, r] 的元素和
    T query(int l, int r)
    {
        return prefix_sum(r) - prefix_sum(l - 1);
    }
};
BidxTree<ll> bit;
```

# 线段树

## 普通版

- 通过分治维护区间信息；本模板支持区间加和区间求和。
- 懒标记仅在访问子区间前下传，修改与查询的复杂度均为 $O(\log n)$。

```cpp
struct SGT
{
    struct NODE
    {
        ll data;
        ll lazy;
    } tr[MAX << 2];

    // 用两个子节点的信息更新当前节点
    void pullup(int id)
    {
        tr[id].data = tr[id << 1].data + tr[id << 1 | 1].data;
    }

    // 为当前节点对应区间整体增加 k，并累积懒标记
    void update(int id, int l, int r, ll k)
    {
        tr[id].data += k * (r - l + 1);
        tr[id].lazy += k;
    }

    // 根据原数组递归建树，并清空所有懒标记
    void build(int l, int r, int rt)
    {
        tr[rt].lazy = 0;
        if (l == r)
        {
            tr[rt].data = a[l];
            return;
        }
        int mid = l + (r - l) / 2;
        build(l, mid, rt << 1);
        build(mid + 1, r, rt << 1 | 1);
        pullup(rt);
    }

    // 将当前节点的懒标记下传到两个子节点
    void pushdown(int id, int l, int r)
    {
        int mid = l + (r - l) / 2;
        update(id << 1, l, mid, tr[id].lazy);
        update(id << 1 | 1, mid + 1, r, tr[id].lazy);
        tr[id].lazy = 0;
    }

    // 将目标区间 [l, r] 内的元素整体增加 k
    void modify(int l, int r, ll k, int u, int cl, int cr)
    {
        if (l <= cl && cr <= r)
        {
            update(u, cl, cr, k);
            return;
        }

        if (tr[u].lazy) pushdown(u, cl, cr);

        int mid = cl + (cr - cl) / 2;
        if (l <= mid) modify(l, r, k, u << 1, cl, mid);
        if (r > mid) modify(l, r, k, u << 1 | 1, mid + 1, cr);
        pullup(u);
    }

    // 查询目标区间 [l, r] 的元素和
    ll query(int l, int r, int u, int cl, int cr)
    {
        if (l <= cl && cr <= r)
        {
            return tr[u].data;
        }

        if (tr[u].lazy) pushdown(u, cl, cr);

        int mid = cl + (cr - cl) / 2;
        ll ret = 0;
        if (l <= mid) ret += query(l, r, u << 1, cl, mid);
        if (r > mid) ret += query(l, r, u << 1 | 1, mid + 1, cr);
        return ret;
    }
};
```

## 动态开点 + 标记永久化

- 仅为被访问的区间创建节点，适用于值域很大但操作较少的场景。
- 懒标记永久保留在当前节点，查询时累加祖先标记，无须向下创建空节点。
- 单次修改和查询复杂度为 $O(\log U)$，空间复杂度为 $O(q \log U)$，其中 $U$ 为值域大小。

```cpp
template <typename T>
struct dynamic_SGT
{
    struct sgt_node
    {
        int lch, rch;
        int lbd, rbd;
        T data, lazy;

        // 构造一个边界、子节点和标记均为空的节点
        sgt_node()
        {
            lch = rch = lbd = rbd = 0;
            data = lazy = 0;
        }
    } tr[MAXQ * (__lg(MAXN) + 1) * 2];

    int tot;

    // 清空指定节点，保证节点复用时不残留旧状态
    void reset_node(int u)
    {
        tr[u] = sgt_node();
    }

    // 初始化值域 [1, n]；可在多组数据间重复调用
    void init(int n)
    {
        tot = 1;
        reset_node(1);
        tr[1].lbd = 1;
        tr[1].rbd = n;
    }

    // 创建并初始化 u 的左子节点
    void newlch(int u)
    {
        int v = ++tot;
        reset_node(v);
        tr[u].lch = v;
        tr[v].lbd = tr[u].lbd;
        tr[v].rbd = tr[u].lbd + (tr[u].rbd - tr[u].lbd) / 2;
    }

    // 创建并初始化 u 的右子节点
    void newrch(int u)
    {
        int v = ++tot;
        reset_node(v);
        tr[u].rch = v;
        tr[v].lbd = tr[u].lbd + (tr[u].rbd - tr[u].lbd) / 2 + 1;
        tr[v].rbd = tr[u].rbd;
    }

    // 将目标区间 [l, r] 内的元素整体增加 k
    void modify(int l, int r, int u, T k)
    {
        int cl = tr[u].lbd, cr = tr[u].rbd;
        if (l <= cl && cr <= r)
        {
            tr[u].lazy += k;
            tr[u].data += k * (cr - cl + 1);
            return;
        }

        int mid = cl + (cr - cl) / 2;
        if (mid >= l)
        {
            if (!tr[u].lch) newlch(u);
            modify(l, r, tr[u].lch, k);
        }
        if (mid < r)
        {
            if (!tr[u].rch) newrch(u);
            modify(l, r, tr[u].rch, k);
        }
        tr[u].data = tr[u].lazy * (cr - cl + 1)
                   + tr[tr[u].lch].data + tr[tr[u].rch].data;
    }

    // 查询区间和；k 为祖先标记之和，首次调用时应传入 0
    T query(int l, int r, int u, T k)
    {
        int cl = tr[u].lbd, cr = tr[u].rbd;
        if (l <= cl && cr <= r)
        {
            return tr[u].data + k * (cr - cl + 1);
        }

        k += tr[u].lazy;
        int mid = cl + (cr - cl) / 2;
        T res = 0;
        if (mid >= l)
        {
            if (!tr[u].lch) res += (min(r, mid) - max(l, cl) + 1) * k;
            else res += query(l, r, tr[u].lch, k);
        }
        if (mid < r)
        {
            if (!tr[u].rch) res += (min(r, cr) - max(l, mid + 1) + 1) * k;
            else res += query(l, r, tr[u].rch, k);
        }
        return res;
    }
};
```

## 可持久化线段树（主席树）

- 每次修改仅复制根到目标叶子的路径，保留历史版本，单次修改新增 $O(\log n)$ 个节点。
- 当前模板实现单点赋值与单点查询：以 `root[0] = build(1, n)` 建立初始版本，再保存每次 `modify` 返回的新根。

```cpp
template <typename T>
struct pst_SGT
{
    struct sgt_node
    {
        int lch, rch;
        T data;

        // 构造一个不含子节点且数据为零的节点
        sgt_node()
        {
            lch = rch = 0;
            data = 0;
        }
    } tr[MAXN * 23];

    int root[MAXN];
    int tot = 0;

    // 根据原数组建立初始版本，并返回该版本的根
    int build(int l, int r)
    {
        int u = ++tot;
        if (l == r)
        {
            tr[u].data = a[l];
            return u;
        }

        int mid = l + (r - l) / 2;
        tr[u].lch = build(l, mid);
        tr[u].rch = build(mid + 1, r);
        return u;
    }

    // 在旧版本 u 上将位置 p 赋值为 k，并返回新版本的根
    int modify(int p, T k, int u, int l, int r)
    {
        int rt = ++tot;
        tr[rt] = tr[u];
        if (l == r)
        {
            tr[rt].data = k;
            return rt;
        }

        int mid = l + (r - l) / 2;
        if (p <= mid) tr[rt].lch = modify(p, k, tr[rt].lch, l, mid);
        else tr[rt].rch = modify(p, k, tr[rt].rch, mid + 1, r);
        return rt;
    }

    // 查询版本 u 中位置 p 的值
    T query(int p, int u, int l, int r)
    {
        if (l == r)
        {
            return tr[u].data;
        }

        int mid = l + (r - l) / 2;
        if (p <= mid) return query(p, tr[u].lch, l, mid);
        return query(p, tr[u].rch, mid + 1, r);
    }
};
```


```cpp
template<typename T>
struct pst_SGT
{
    struct sgt_node
    {
        int lch, rch;
        T data;

        sgt_node()
        {
            lch = rch = 0;
            data = 0;
        }
    } tr[MAXN * 22];

    int root[MAXN];
    int tot = 0;

    int build(int l, int r)
    {
        int u = ++tot;
        //tr[u].data = 0;
        if (l == r)
        {
            return u;
        }

        int mid = l + (r - l) / 2;
        tr[u].lch = build(l, mid);
        tr[u].rch = build(mid + 1, r);
        return u;
    }

    int insert(int p, int u, int l ,int r)
    {
        int rt = ++tot;
        tr[rt] = tr[u];
        tr[rt].data++;
        if (l == r)
        {
            return rt;
        }

        int mid = l + (r - l) / 2;
        if (p <= mid) tr[rt].lch = insert(p, tr[rt].lch, l, mid);
        else tr[rt].rch = insert(p, tr[rt].rch, mid + 1, r);
        return rt;
    }

    //ql ~ qr 第k小
    T query(int k, int lrt, int rrt, int l, int r)
    {
        if (l == r)
        {
            return l;
        }

        int lsz = tr[tr[rrt].lch].data - tr[tr[lrt].lch].data;
        int mid = l + (r - l) / 2;
        if (lsz >= k) return query(k, tr[lrt].lch, tr[rrt].lch, l, mid);
        else return query(k - lsz, tr[lrt].rch, tr[rrt].rch, mid + 1, r);
    }
};
```

# 二叉搜索树与平衡树

## 普通平衡树

- AVL 树同时维护二叉搜索树性质与高度平衡，任意节点两棵子树的高度差不超过 $1$。
- 重复键由 `cnt` 计数；插入、删除、排名、选择、前驱和后继操作的复杂度均为 $O(\log n)$。

```cpp
template <typename T>
struct AVL
{
    struct NODE
    {
        T key;
        int cnt;
        int lch, rch;
        int sz, hei;
    } tr[MAXN];

    int tot, root;

    // 清空节点池及根节点；len 应覆盖本轮可能使用的节点数
    void clear(int len)
    {
        tot = root = 0;
        for (int i = 0; i <= len; i++) tr[i] = { 0, 0, 0, 0, 0, 0 };
    }

    // 根据两个子节点重新计算当前节点的大小与高度
    void update(int u)
    {
        int l = tr[u].lch, r = tr[u].rch;
        tr[u].sz = tr[l].sz + tr[r].sz + tr[u].cnt;
        tr[u].hei = max(tr[r].hei, tr[l].hei) + 1;
    }

    // 对以 u 为根的子树执行左旋，并返回新根
    int L_rot(int u)
    {
        int r = tr[u].rch;
        tr[u].rch = tr[r].lch;
        tr[r].lch = u;
        update(u);
        update(r);
        return r;
    }

    // 对以 u 为根的子树执行右旋，并返回新根
    int R_rot(int u)
    {
        int l = tr[u].lch;
        tr[u].lch = tr[l].rch;
        tr[l].rch = u;
        update(u);
        update(l);
        return l;
    }

    // 根据平衡因子旋转失衡子树，并返回调整后的根
    int maintain(int u)
    {
        int l = tr[u].lch, r = tr[u].rch;
        int lh = tr[l].hei, rh = tr[r].hei;
        if (lh - rh > 1)
        {
            if (tr[tr[l].lch].hei >= tr[tr[l].rch].hei)
            {
                u = R_rot(u);
            }
            else
            {
                tr[u].lch = L_rot(l);
                u = R_rot(u);
            }
        }
        else if (rh - lh > 1)
        {
            if (tr[tr[r].rch].hei >= tr[tr[r].lch].hei)
            {
                u = L_rot(u);
            }
            else
            {
                tr[u].rch = R_rot(r);
                u = L_rot(u);
            }
        }
        return u;
    }

    // 向以 u 为根的子树插入 val，并返回调整后的根
    int insert(int u, T val)
    {
        if (u == 0)
        {
            tr[++tot].key = val;
            tr[tot].cnt = tr[tot].sz = tr[tot].hei = 1;
            return tot;
        }
        if (val == tr[u].key) tr[u].cnt++;
        else if (val < tr[u].key) tr[u].lch = insert(tr[u].lch, val);
        else tr[u].rch = insert(tr[u].rch, val);
        update(u);
        return maintain(u);
    }

    // 向整棵树插入 val
    void insert(T val) { root = insert(root, val); }

    // 移除以 u 为根的子树中编号为 id 的最左节点
    int remove_most_left(int u, int id)
    {
        if (u == id) return tr[u].rch;
        else
        {
            tr[u].lch = remove_most_left(tr[u].lch, id);
            update(u);
            return maintain(u);
        }
    }

    // 从以 u 为根的子树中删除一个 val，并返回调整后的根
    int remove(int u, T val)
    {
        if (u == 0) return 0;
        if (val < tr[u].key) tr[u].lch = remove(tr[u].lch, val);
        else if (val > tr[u].key) tr[u].rch = remove(tr[u].rch, val);
        else
        {
            if (tr[u].cnt > 1) tr[u].cnt--;
            else if (!tr[u].lch && !tr[u].rch) return 0;
            else if (tr[u].lch && !tr[u].rch) u = tr[u].lch;
            else if (!tr[u].lch && tr[u].rch) u = tr[u].rch;
            else
            {
                int alt = tr[u].rch;
                while (tr[alt].lch) alt = tr[alt].lch;
                tr[u].rch = remove_most_left(tr[u].rch, alt);
                tr[alt].lch = tr[u].lch;
                tr[alt].rch = tr[u].rch;
                u = alt;
            }
        }
        update(u);
        return maintain(u);
    }

    // 从整棵树中删除一个 val；不存在时保持不变
    void remove(T val) { root = remove(root, val); }

    // 统计以 u 为根的子树中严格小于 num 的元素数
    int q_rank(int u, T num)
    {
        if (u == 0) return 0;
        int l = tr[u].lch, r = tr[u].rch;
        if (num <= tr[u].key) return q_rank(l, num);
        return q_rank(r, num) + tr[l].sz + tr[u].cnt;
    }

    // 查询 num 的排名，排名从 1 开始
    int q_rank(T num) { return q_rank(root, num) + 1; }

    // 查询以 u 为根的子树中第 x 小的元素；要求 1 <= x <= size
    T q_xth(int u, int x)
    {
        int l = tr[u].lch, r = tr[u].rch;
        if (x <= tr[l].sz) return q_xth(l, x);
        if (x > tr[l].sz + tr[u].cnt) return q_xth(r, x - tr[l].sz - tr[u].cnt);
        return tr[u].key;
    }

    // 查询整棵树中第 x 小的元素；要求 1 <= x <= size
    T q_xth(int x) { return q_xth(root, x); }

    // 查询以 u 为根的子树中严格小于 num 的最大值
    T q_prev(int u, T num)
    {
        if (u == 0) return numeric_limits<T>::lowest();
        int l = tr[u].lch, r = tr[u].rch;
        if (num <= tr[u].key) return q_prev(l, num);
        return max(tr[u].key, q_prev(r, num));
    }

    // 查询 num 的前驱；不存在时返回类型最小值
    T q_prev(T num) { return q_prev(root, num); }

    // 查询以 u 为根的子树中严格大于 num 的最小值
    T q_post(int u, T num)
    {
        if (u == 0) return numeric_limits<T>::max();
        int l = tr[u].lch, r = tr[u].rch;
        if (num >= tr[u].key) return q_post(r, num);
        return min(tr[u].key, q_post(l, num));
    }

    // 查询 num 的后继；不存在时返回类型最大值
    T q_post(T num) { return q_post(root, num); }
};
```

## 笛卡尔树

- 节点下标满足 BST 性质，节点值满足大根堆或小根堆性质。
- 树不保证平衡，但可用单调栈在 $O(n)$ 时间内构建；本模板构建小根笛卡尔树。
- 构建完成后，根节点编号保存在哨兵节点的 `tr[0].rch` 中。

```cpp
struct Cartesian
{
    struct NODE
    {
        int lch, rch;
    } tr[MAX];
    int tot;

    // 按下标顺序构建小根笛卡尔树
    void build()
    {
        vector<int> stk(n + 5);
        int top = 0;
        for (int i = 1; i <= n; i++)
        {
            int beg = top;
            while (top && a[stk[top]] > a[i]) top--;
            tr[stk[top]].rch = i;
            if (top < beg) tr[i].lch = stk[top + 1];
            stk[++top] = i;
        }
    }
} cart;
```
