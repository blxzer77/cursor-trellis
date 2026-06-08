# 改进问题记录质量 - 学习 Runtime Big Question 模式

## 背景

Trellis 目前在记录问题时效果不如之前的 Runtime 项目。Runtime 的 "Big Question" 记录功能能够产出高质量的问题文档。

## 问题

当前 Trellis 记录的问题内容比较简单/表面，缺乏深度。

## 目标

学习 Runtime 的 Big Question 模式，让 Trellis 能够记录：

1. **错误发生的详细情况** - 完整描述问题现象
2. **完整的 Context** - 相关的代码、配置、环境信息
3. **深入的原因分析** - 不只是表面原因，要挖掘根本原因
4. **解决方案** - 具体的修复方法和验证步骤

## 待确认

- [ ] 获取 Runtime Big Question 的实际例子作为参考
- [ ] 确定这个功能应该用在哪里（/break-loop、Journal、专门的问题库？）
- [ ] 确定触发方式（手动调用、自动检测、或两者都要）

## 参考

需要从 Runtime 项目获取 Big Question 的示例，理解其格式和内容深度。

## 技术方向（初步）

可能的实现方式：
- 增强 `/break-loop` 命令的输出模板
- 创建专门的 `/record-issue` 命令
- 设计结构化的问题记录格式

---

*Created by: kleinhe*
*Assigned to: taosu*
