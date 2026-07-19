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
