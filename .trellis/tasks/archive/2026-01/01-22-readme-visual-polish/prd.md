# README 视觉优化与衔接改进

## Goal

优化 Trellis README 的视觉效果和段落衔接，保持现有架构和价值主张不变。

## Reference Repos

分析了以下三个优秀 README 的视觉风格：
- [VidBee](https://github.com/nexmoe/VidBee) - Logo + Badges、Emoji 标题、感谢依赖
- [Mastra](https://github.com/mastra-ai/mastra) - 精简 badges、清晰结构
- [AionUi](https://github.com/iOfficeAI/AionUi) - Hero 图、Quick Nav、对比表、Star History

## Requirements

### 1. 视觉增强

- [ ] 添加 Badges 行 (npm version, license, stars, discord)
- [ ] 优化标题层级和 Emoji 使用（参考 VidBee 风格）
- [ ] 添加 Quick Navigation 锚点目录（参考 AionUi）
- [ ] 修复图片链接（当前 attachment: 格式无法渲染）
- [ ] 完善 License 和 Community 部分

### 2. 衔接优化

- [ ] 优化开头语 "Wild AI ships nothing" → 更直观的 tagline
- [ ] 各 section 之间添加过渡语或视觉分隔
- [ ] Use Cases 部分增加引导性描述
- [ ] FAQ 部分优化排版（可考虑折叠格式）

### 3. 清理占位符

- [ ] 移除或替换 `<!-- TODO: GIF -->` 占位符
- [ ] 修复 Engineering Docs Notion 链接
- [ ] 补全 Discord 链接

## Non-Goals

- 不改动核心价值主张内容
- 不改动 Project Structure 架构描述
- 不新增 Features（保持现有功能描述）

## Acceptance Criteria

- [ ] README 在 GitHub 上正确渲染
- [ ] 所有链接可点击且有效（或标记为 coming soon）
- [ ] 视觉风格与参考 repo 水平相当
- [ ] 保持简洁，不过度装饰

## Technical Notes

- Badges 使用 shields.io
- 图片暂用占位符或移除（待后续补充 GIF）
- Star History 可使用 star-history.com
