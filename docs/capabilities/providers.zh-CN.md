# Middleware Provider

[English](providers.md) | 简体中文

Provider 是通过项目 Middleware 配置解析的独立安装集成。Provider 具有 origin、version、授权、binding、readiness、freshness、assurance 与隐私策略；每个字段都是有边界的 evidence。

## 解析清单

1. 项目显式选择 capability 与 Provider。
2. manifest 有效，并声明允许的 intent 与策略上限。
3. binding 将 intent 连接到本宿主和本项目。
4. runtime fact 与有时间边界的 probe 建立 readiness 和 freshness。
5. 凭据留在宿主 secret store 或环境中；receipt 只写安全引用和脱敏结果。
6. 检查不通过时，resolver 报告 `selected`、`fallback`、`degraded` 或 `unsupported`，并给出 user action。

Pactile 不自动安装 MCP package、不复制 API key，也不因全局配置恰好出现某个名称就选择 Provider。可选 Provider 不可用时，本地 exact capability 仍可工作。

## Evidence 与失败

保留 manifest identifier、Provider version、probe 时间、状态与受限 error code。不要在项目 ledger 保存 token 值或任意 Provider 输出。probe 过期或失败会降低结论，不能用改变请求 intent 的静默 fallback 掩盖。intent 级证明见[检索](retrieval.zh-CN.md)，数据流见[隐私](privacy-and-permissions.zh-CN.md)。
