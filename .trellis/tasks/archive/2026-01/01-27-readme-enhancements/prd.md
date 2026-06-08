# README Enhancements

## Goal

优化 Trellis README，参考 CAMEL-AI 和 Eigent 的最佳实践，提升项目可读性和吸引力。

## Requirements

### 1. Design Principles 部分
- 在 "Why Trellis" 之后添加设计理念部分
- 解释 Trellis 的核心设计哲学：
  - Spec Injection（规范注入）
  - Layered Architecture（分层架构）
  - Session Persistence（会话持久化）
  - Team Collaboration（团队协作）

### 2. Roadmap 详细化
- 将现有 Roadmap 改为表格形式
- 添加进度状态标识
- 可选：链接到 GitHub Issues 或 Discord 频道

### 3. Use Cases 详细化
- 为每个用例添加实际的命令/提示词示例
- 展示具体的输入输出效果
- 参考 Eigent 的 "Replay" 风格

### 4. Contributing 部分
- 添加 Contributing 指南链接
- 简要说明如何参与贡献
- 可选：添加 Contributors 可视化

### 5. 多语言支持
- 创建 README_CN.md 中文版本
- 在主 README 添加语言切换链接

### 6. Community 扩展
- 添加更多社区链接（X/Twitter、微信等）
- 统一社区入口展示风格

### 7. Badges 丰富
可添加的 badges：
- 最后提交时间
- CI/CD 状态（如果有）
- 代码覆盖率（如果有）
- 下载量/周活

## Acceptance Criteria

- [ ] Design Principles 部分清晰易懂
- [ ] Roadmap 以表格形式呈现，有状态标识
- [ ] Use Cases 有具体的示例命令/效果
- [ ] Contributing 部分完整
- [ ] README_CN.md 创建完成
- [ ] Community 部分包含多个入口
- [ ] Badges 数量增加至 6+ 个

## Reference

- CAMEL-AI: https://github.com/camel-ai/camel
- Eigent: https://github.com/eigent-ai/eigent

## Technical Notes

- 保持现有结构的简洁风格
- 不要过度膨胀，保持可读性
- 图片资源放在 assets/ 目录
