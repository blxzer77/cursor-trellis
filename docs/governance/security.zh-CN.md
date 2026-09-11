# 安全报告

[English](security.md) | 简体中文

疑似漏洞请按 [SECURITY.md](../../SECURITY.md) 的说明私下报告。未披露的安全问题不要公开开 issue，也不要附带 secret、token、私有日志或客户数据。

只提供最少可复现信息：受影响版本、宿主与 mode、不外泄数据的安全步骤、影响和脱敏 Evidence。维护者可能要求通过私密渠道补充材料。我们会确认收到、验证报告、协调修复并约定披露日期；协调前不要发布 exploit。

安全边界包括 credential 处理、Provider 出站、ownership 混淆、路径穿越、不安全 purge 与投影覆盖。probe 成功或宿主 identity 都不是访问他人数据的授权。
