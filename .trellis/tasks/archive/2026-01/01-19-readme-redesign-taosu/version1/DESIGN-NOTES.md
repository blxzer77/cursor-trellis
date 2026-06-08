# Version 1 设计说明

> 基于 15 个竞品分析的 README 重构方案

---

## 设计决策

### 1. 标语选择

**最终选择：** "Structure. Guide. Ship."（3 词）

**对比：**
| 来源 | 标语 | 字数 |
|------|------|------|
| Acontext | "Store, Observe, Learn" | 3 |
| MemU | "Agent Memory for AI" | 4 |
| OpenSpec | "A lightweight spec-driven framework" | 5 |
| Claude-Cowork | 18 词描述句 | 18 |

**理由：**
- 3 词三动词结构，节奏感强
- 对应 Trellis 三大功能：structure（规范）→ guide（引导）→ ship（交付）
- 保留原有 "Structure" 的藤架隐喻

---

### 2. 结构设计

**参考竞品：** BMAD-METHOD、OpenSpec、Acontext

**采用结构：**
```
1. Banner + 徽章
2. 一句话标语 + 诗意副标语
3. Why Trellis?（问题驱动）
4. Quick Start（3 步骤）
5. Core Concepts（三支柱 + 表格）
6. Slash Commands（表格）
7. Multi-Agent Pipeline（流程图）
8. Project Structure（目录树）
9. How It Works（分段详解）
10. Configuration（配置示例）
11. Comparison（竞品对比）
12. Documentation links
13. Community links
14. License
```

**关键改进：**
- "Why" 先于 "How"（学 BMAD-METHOD）
- 表格驱动信息呈现（学 BMAD-METHOD）
- 三支柱架构（学 Acontext "Store/Observe/Learn"）
- 竞品对比表（学 OpenSpec）

---

### 3. 长度控制

| 版本 | 行数 | 定位 |
|------|------|------|
| 原 README | ~820 行 | 完整文档 |
| Version 1 | ~300 行 | 入口页面 |

**理由：**
- 学 OpenSpec 模式：README 做入口，详细文档分离
- 降低首次阅读门槛
- 详细内容保留在原 README（可移至 docs/）

---

### 4. 视觉元素

**徽章（4 个）：**
- npm version
- MIT License
- Claude Code Compatible
- Cursor Compatible

**对比竞品：**
| 竞品 | 徽章数 |
|------|--------|
| BMAD-METHOD | 4 |
| Acontext | 5+ |
| Claude-Cowork | 3+ |

**流程图：**
- ASCII 流程图（Multi-Agent Pipeline）
- 不依赖外部图片
- 兼容所有 Markdown 渲染器

---

### 5. 差异化定位

**对比表设计：**

| vs | Trellis 优势 |
|-----|-------------|
| Planning-with-Files | 项目级 vs 会话级，多 Agent，规范系统 |
| BMAD-METHOD | 轻量 vs 重型，渐进学习曲线 |

**核心差异化：**
- 不是"又一个 Planning 工具"，是"项目级工作流模板"
- 不是"完整方法论框架"，是"轻量级模板层"

---

### 6. 多语言策略

**采用：** 英文 + 中文双版本（学 Claude-Cowork）

**文件结构：**
```
README.md      # 英文版
README-zh.md   # 中文版
```

**语言切换链接：**
```markdown
English | [中文](./README-zh.md)
```

---

## 待改进项

1. **Logo/Banner** — 当前无自定义 banner，可后续添加
2. **GIF 演示** — 可添加 `/parallel` 工作流演示 GIF
3. **社区链接** — 需确认 GitHub org URL
4. **贡献指南** — 需要创建 CONTRIBUTING.md

---

## 竞品借鉴总结

| 竞品 | 借鉴点 |
|------|--------|
| BMAD-METHOD | "Why" 先于 "How"、表格驱动、轨道对比 |
| OpenSpec | 简洁入口 + 文档分离、问题导向文案 |
| Acontext | 三支柱架构、多语言目录结构 |
| Planning-with-Files | RAM vs Disk 比喻、When to Use/Skip |
| Claude-Cowork | 双语 README、emoji 章节标记 |
| MemU | 简短标语、对比式表述 |
