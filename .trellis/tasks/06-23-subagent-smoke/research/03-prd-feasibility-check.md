# PRD 需求合理性验证 (06-23)

## 验证目标

用户查询提到的假设需求：

> R1.1 / R1.2 需求（新增 Trellis/scripts/smoke_echo.py，导出 echo_msg）

## Trellis 项目结构分析

### 实际目录布局

```
Trellis/
├── packages/cli/
│   ├── src/                     TypeScript 源码（CLI 主入口）
│   ├── scripts/                 构建脚本（release.js, copy-templates.js 等）
│   │   ├── *.js                 16 个 Node.js 脚本
│   │   └── (无 Python 脚本)
│   └── package.json
├── scripts/
│   └── check_router_copy_sync.py  唯一根级 Python 脚本（router 同步检查器）
└── .trellis/                     Trellis 自身狗食化元配置
```

### 关键发现

1. **Trellis/scripts/ 目录存在**，包含 **1 个 Python 脚本**：
   - `check_router_copy_sync.py`（用于检查 router 副本同步）

2. **packages/cli/scripts/** 包含 **16 个构建/发布脚本**：
   - 全部为 **Node.js (.js)**，无 Python
   - 用途：release、manifest、smart-search vendor sync、pack files 检查等

3. **既有 smoke test 基础设施**：
   - `packages/cli/src/templates/trellis/scripts/codegraph_session_smoke.py`（模板）
   - `packages/cli/src/templates/trellis/scripts/cursor_retrieval_probe.py`（探针）
   - 模板会被 `trellis init` 复制到用户项目的 `.trellis/scripts/`

4. **无现有 `echo` 脚本**：
   - `grep -r "echo|smoke"` 仅匹配到 `codegraph_session_smoke.py`（无关 echo）
   - 无 `echo_msg` 函数或类似工具函数

## 需求合理性评估

### R1.1: 新增 Trellis/scripts/smoke_echo.py

**评估结果**：✅ **合理**

理由：
- `Trellis/scripts/` 已存在并托管项目级工具脚本（当前仅 1 个）
- 与 `check_router_copy_sync.py` 同级，符合项目惯例
- 不会与现有文件冲突（无同名脚本）

**替代方案**：
- 如果要集成到 CLI，可放在 `packages/cli/src/templates/trellis/scripts/`（作为模板）
- 如果仅作为构建工具，可放在 `packages/cli/scripts/`（但需改为 Node.js）

### R1.2: 导出 echo_msg 函数

**评估结果**：✅ **合理**

理由：
- Python 脚本标准实践，便于测试和复用
- 参考 `check_router_copy_sync.py` 的模式（定义函数 + `if __name__ == "__main__"` 入口）

**推荐接口**：

```python
#!/usr/bin/env python3
"""Simple echo utility for smoke testing."""

def echo_msg(text: str) -> str:
    """Return the input text as-is."""
    return text

def main():
    import sys
    if len(sys.argv) > 1:
        print(echo_msg(sys.argv[1]))
    else:
        print(echo_msg("Hello from smoke_echo"))

if __name__ == "__main__":
    main()
```

## 项目约束检查

### 1. 构建系统

- **CLI 主包**：TypeScript (tsconfig, ESLint, Prettier)
- **Python 脚本**：无统一 lint 配置（`lint:py` 仅对模板内的 Python 生效）
- **smoke_echo.py** 无需 TypeScript 构建流程

### 2. 发布范围

`package.json` files 字段 **不包含** `scripts/`：

```json
"files": [
  "dist",
  "bin",
  "scripts/postinstall.js",  // 仅此一个
  "vendor/smart-search/...",
  ...
]
```

**影响**：`smoke_echo.py` 不会随 npm 包发布（仅存在于源码仓库）。

**解决方案**：
- 如需随包分发 → 添加到 `files` 或移至 `packages/cli/src/templates/` 作为模板
- 如仅开发工具 → 保持现状（符合 `check_router_copy_sync.py` 的定位）

### 3. 命名冲突

- ❌ **无** `echo` / `echo_msg` / `smoke_echo` 相关符号
- ✅ **无冲突**

## 验证结论

| 需求 | 合理性 | 潜在问题 |
| --- | --- | --- |
| R1.1: 新增 `Trellis/scripts/smoke_echo.py` | ✅ 合理 | 不随 npm 包发布（与现有 `check_router_copy_sync.py` 一致） |
| R1.2: 导出 `echo_msg` 函数 | ✅ 合理 | 无 |

**推荐实现路径**：
1. 在 `Trellis/scripts/smoke_echo.py` 实现 `echo_msg` 函数
2. 添加 CLI 入口（`main()`）以支持 `python scripts/smoke_echo.py "text"`
3. 可选：在 `packages/cli/scripts/` 添加 Node.js 包装器以集成到 npm scripts

**相关文件**：
- `Trellis/scripts/check_router_copy_sync.py` — 参考项目现有 Python 脚本风格
- `Trellis/packages/cli/package.json` — 检查 `files` / `scripts` 字段
