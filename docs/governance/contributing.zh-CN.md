# 贡献指南

[English](contributing.md) | 简体中文

贡献应留下小而可审阅的 change set，并提供维护者可以复现的 Evidence。简短清单见根目录 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

## 开发路径

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
```

针对修改文件运行最接近的 focused test。完整 Core 与 CLI suite 是最终发布 preflight；未运行时不要声称已运行。

## 变更与审查边界

- 持久工作保留 Task PRD、写集与 acceptance Evidence。
- 除非 Task 明确拥有，否则保留用户、外部、borrowed 与历史文件。
- 不要提交 credential、token、私有日志、个人生成状态或无关仓库变更。
- 宿主或 Provider 工作应在验证记录中写明 mode、readiness、freshness、assurance 与安全 fallback。
- Reviewer 只读检查 diff 与 Evidence；修复回到 Execute。

问题请使用[支持](../../SUPPORT.md)，私有漏洞请见[安全](security.zh-CN.md)。Pull request 应使用仓库模板。
