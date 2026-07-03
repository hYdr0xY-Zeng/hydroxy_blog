---
title: "字符串"
description: "串串的板子"
date: 2026-07-02
tags: ["cs", "algorithm", "xcpc", "cpp"]
draft: false
---
# 字符串

## C标准库

以下摘自[OIWiki_标准库](https://oi-wiki.org/string/lib-func/)

-   `strlen(const char *str)`：返回从 `str[0]` 开始直到 `'\0'` 的字符数．注意，未开启 O2 优化时，该操作写在循环条件中复杂度是 $\Theta(N)$ 的．
-   `strcmp(const char *str1, const char *str2)`：按照字典序比较 `str1 str2` 若 `str1` 字典序小返回负值，两者一样返回 `0`，`str1` 字典序更大则返回正值．请注意，不要简单的认为返回值只有 `0`、`1`、`-1` 三种，在不同平台下的返回值都遵循正负，但并非都是 `0`、`1`、`-1`．
-   `strcpy(char *str, const char *src)`: 把 `src` 中的字符复制到 `str` 中，`str`  `src` 均为字符数组头指针，返回值为 `str` 包含空终止符号 `'\0'`．
-   `strncpy(char *str, const char *src, int cnt)`：复制至多 `cnt` 个字符到 `str` 中，若 `src` 终止而数量未达 `cnt` 则写入空字符到 `str` 直至写入总共 `cnt` 个字符．
-   `strcat(char *str1, const char *str2)`: 将 `str2` 接到 `str1` 的结尾，用 `*str2` 替换 `str1` 末尾的 `'\0'` 返回 `str1`．
-   `strstr(char *str1, const char *str2)`：若 `str2` 是 `str1` 的子串，则返回 `str2` 在 `str1` 的首次出现的地址；如果 `str2` 不是 `str1` 的子串，则返回 `NULL`．
-   `strchr(const char *str, int c)`：找到在字符串 `str` 中第一次出现字符 `c` 的位置，并返回这个位置的地址．如果未找到该字符则返回 `NULL`．
-   `strrchr(const char *str, int c)`：找到在字符串 `str` 中最后一次出现字符 `c` 的位置，并返回这个位置的地址．如果未找到该字符则返回 `NULL`．

---

## Hash

为方便计算, 以下代码均取字符串起始下标为 1 `scanf("%s", s + 1);`, 考虑效率, 以下代码均为自然溢出实现.

```cpp
//单值计算
ull get_hash(char *s)
{
    ull res = 0;
    for (int i = 1; s[i]; i++) res = res * B + (ull)s[i];
    return res;
}

//前缀hash
void get_hash(vector<ull> &hs, char *s)
{
    powB[0] = 1;//同时做预处理
    for (int i = 1; s[i]; i++)
    {
        hs[i] = hs[i - 1] * B + (ull)s[i];
        powB[i] = powB[i - 1] * B;
    }
}

//子串hash
ull get_sub(vector<ull> &hs, int l, int r)
{
    return hs[r] - hs[l - 1] * powB[r - l + 1];
}
```

---

## 字符串函数

### 前缀函数 $\pi$

```cpp
// 0起始
void get_pi(vector<int> &pi, char *s, int len)
{
    pi[0] = 0;
    for (int i = 1; i < len; i++)
    {
        int j = pi[i - 1];
        while (j > 0 && s[i] != s[j]) j = pi[j - 1];
        if (s[i] == s[j]) j++;
        pi[i] = j;
    }
}
```
### Z函数

```cpp
void get_z(vector<int> &z, char *s, int len)
{
    z[0] = 0;//0 和 len 均可以
    int l = 0, r = 0;
    for (int i = 1; i < len; i++)
    {
        if (i <= r) z[i] = min(r - i + 1, z[i - l]);
        while (s[i + z[i]] == s[z[i]]) z[i]++;
        if (i + z[i] - 1 > r)
        {
            l = i;
            r = i + z[i] - 1;
        }
    }
}
```
### Manacher
```cpp
void get_d(vector<int> &d, char *s, int len)
{
    d[1] = 1;
    int l = 1, r = 1;
    for (int i = 1; i <= len; i++)
    {
        if (i <= r) d[i] = min(d[l + r - i], r - i + 1);
        while (s[i + d[i]] == s[i - d[i]]) d[i]++; //这里不用写上下界, 前有'$'后有'\0'
        if (i + d[i] - 1 > r)
        {
            l = i - d[i] + 1;
            r = i + d[i] - 1;
        }
    }
}
//字符串预处理
void solve()
{
    scanf("%s", a + 1)
    int len = strlen(a + 1), k = 1;
    s[0] = '$', s[1] = '#';
    for (int i = 1; i <= len; i++)
    {
        s[++k] = a[i];
        s[++k] = '#';
    }
    s[k + 1] = '\0';
    len = k;
    vector<int> d(len + 5);
    get_d(d, s, len);
    /* code */
}
```

### 后缀数组SA

### 一些衍生字符串函数
前缀border个数(前置z函数)
```cpp
void get_bd(vector<int> &bd, vector<int> &z)
{
    bd[0] = 0;
    for (int i = 0; i < len; i++)
    {
        bd[i]++;
        bd[i + z[i]]--;
        //bd[i + min(i, z[i])]--; 可求不重叠border数
    }
    for (int i = 1; i < len; i++) bd[i] += bd[i - 1];
}
```
前缀最短非空border(前置前缀函数)
```cpp
void get_pis(vector<int> &pis)
{
    for (int i = 1; i < n; i++)
    {
        int j = i + 1;
        while (pis[j - 1]) j = pis[j - 1];
        if (pis[i]) pis[i] = j;//路径压缩
    }
}
```
---

## 字符串数据结构

### Trie (01_Trie)

```cpp
struct Trie
{
    int nex[MAXN][26], cnt;
    bool exist[MAXN];

    void insert(char *s)
    {
        int p = 0;
        for (int i = 0; s[i]; i++)
        {
            int c = s[i] - 'a';
            if (!nex[p][c]) nex[p][c] = ++cnt;
            p = nex[p][c];
        }
        exist[p] = true;
    }

    bool query(char *s)
    {
        int p = 0;
        for (int i = 0; s[i]; i++)
        {
            int c = s[i] - 'a';
            if (!nex[p][c]) return false;
            p = nex[p][c];
        }
        return exist[p];
    }
} trie;


struct Trie_01
{
    int nex[MAXN][2], cnt;

    void insert(int x)
    {
        int p = 0;
        for (int i = 30; i >= 0; i--)
        {
            int j = x >> i & 1;
            if (!nex[p][j]) nex[p][j] = ++cnt;
            p = nex[p][j];
        }
    }

    //max XOR pair
    int query(int x)
    {
        int p = 0, res = 0;
        for (int i = 30; i >= 0; i--)
        {
            int j = x >> i & 1;
            if (nex[p][j ^ 1])
            {
                res |= 1 << i;
                p = nex[p][j ^ 1];
            }
            else p = nex[p][j];
        }
        return res;
    }
    //求 min XOR pair 记得先query，再insert
} trie;
```

### AC自动机 (KMP自动机)

```cpp
struct AC_Node
{
    int son[26];
    int idx;
    int fail;
    int ans;

    AC_Node()
    {
        idx = fail = ans = 0;
        memset(son, 0, sizeof(son));
    }
};

//前向星
struct ALG
{
    int head[MAXN];
    int to[MAXN], nxt[MAXN];
    int cnt;

    ALG()
    {
        memset(head, 0, sizeof(head));
        cnt = 0;
    }

    void add_edge(int u, int v)
    {
        to[++cnt] = v;
        nxt[cnt] = head[u];
        head[u] = cnt;
    }
};

struct AC_ATM
{
    AC_Node tr[MAXN];
    ALG ft;
    int tot, pid;
    int ans[MAX];

    AC_ATM()
    {
        tot = pid = 0;
        memset(ans, 0, sizeof(ans));
    }
    
    void insert(char *s, int &id)
    {
        int p = 0;
        for (int i = 0; s[i]; i++)
        {
            int &nex = tr[p].son[s[i] - 'a'];
            if (!nex) nex = ++tot;
            p = nex;
        }

        //deal with repeat pattern string
        if (!tr[p].idx) tr[p].idx = ++pid;
        id = tr[p].idx;
    }

    void build()
    {
        queue<int> q;
        for (int i = 0; i < 26; i++)
        {
            int v = tr[0].son[i];
            if(!v) continue;
            q.emplace(v);
            ft.add_edge(0, v);
        }

        while (!q.empty())
        {
            int u = q.front();
            q.pop();
            for (int i = 0; i < 26; i++)
            {
                if (tr[u].son[i])
                {
                    tr[tr[u].son[i]].fail = tr[tr[u].fail].son[i];
                    ft.add_edge(tr[tr[u].fail].son[i], tr[u].son[i]);
                    q.emplace(tr[u].son[i]);
                }
                else tr[u].son[i] = tr[tr[u].fail].son[i];
            }
        }
    }

    void query(char *s)
    {
        int p = 0;
        for (int i = 0; s[i]; i++)
        {
            p = tr[p].son[s[i] - 'a'];
            tr[p].ans++;
        }
    }

    void DFS_ft(int u)
    {
        for (int i = ft.head[u]; i; i = ft.nxt[i])
        {
            DFS_ft(ft.to[i]);
            tr[u].ans += tr[ft.to[i]].ans;
        }
        ans[tr[u].idx] = tr[u].ans;
    }

} AC;

// 附上TOPO写法，需额外维护in
// void TOPO()
// {
//     queue<int> q;
//     for (int i = 0; i <= tot; i++)
//     {
//         if (!tr[i].in) q.emplace(i);
//     }
//     while (!q.empty())
//     {
//         int u = q.front(), v = tr[u].fail;
//         q.pop();
//         ans[tr[u].idx] = tr[u].ans;
//         tr[v].in--;
//         tr[v].ans += tr[u].ans;
//         if (!tr[v].in) q.emplace(v);
//     }
// }
```

### SAM

不会

---

## 其他算法

### 最小表示法

```cpp
int k = 0, i = 0, j = 1;
while (k < n && i < n && j < n)
{
    if (sec[(i + k) % n] == sec[(j + k) % n]) k++;
    else
    {
        sec[(i + k) % n] > sec[(j + k) % n] ? i = i + k + 1 : j = j + k + 1;
        if (i == j) i++;
        k = 0;
    }
}
i = min(i, j);
```

### Lyndon 分解

```cpp
vector<string> duval(string const& s)
{
    int n = s.size(), i = 0;
    vector<string> fac;
    while (i < n)
    {
        int j = i + 1, k = i;
        while (j < n && s[k] <= s[j])
        {
            if (s[k] < s[j]) k = i;
            else k++, j++;
        }
        while (i <= k)
        {
            fac.push_back(s.substr(i, j - k));
            i += j - k;
        }
    }
    return fac;
}
```
---