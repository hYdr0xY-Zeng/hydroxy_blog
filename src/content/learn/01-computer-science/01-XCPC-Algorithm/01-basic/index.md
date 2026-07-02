---
title: "Process Scheduling"
description: "操作系统进程调度笔记示例，展示长文、代码块、标签和目录。"
date: 2026-07-01
tags: ["os", "note", "scheduler"]
draft: false
---

进程调度负责在可运行任务之间分配 CPU 时间。它连接了吞吐量、响应时间、公平性和系统开销。

## 关键目标

- **响应时间**：交互式任务希望尽快得到反馈。
- **吞吐量**：批处理任务希望单位时间内完成更多工作。
- **公平性**：不同进程不应长期饥饿。
- **开销控制**：上下文切换不能过于频繁。

## 简化模型

下面是一段非常小的伪代码，用来描述轮转调度的形状。

```ts
type Task = {
  id: string;
  remaining: number;
};

export function roundRobin(queue: Task[], quantum: number) {
  const timeline: string[] = [];

  while (queue.length > 0) {
    const task = queue.shift()!;
    const slice = Math.min(task.remaining, quantum);
    timeline.push(`${task.id}:${slice}`);
    task.remaining -= slice;

    if (task.remaining > 0) {
      queue.push(task);
    }
  }

  return timeline;
}
```

## 复习问题

1. 时间片过大会发生什么？
2. 时间片过小会带来什么额外成本？
3. 为什么交互式系统更关心响应时间？
