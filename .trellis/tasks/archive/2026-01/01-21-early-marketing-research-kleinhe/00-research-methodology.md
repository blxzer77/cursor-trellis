# 竞品早期营销研究 - 研究方法论

## 研究目标

溯源 5 个 AI Coding 竞品的早期营销方式，分析流量暴涨的关键节点，为 Trellis 制定营销策略提供参考。

---

## 研究对象选择标准

1. **开源项目** - 有公开的 GitHub star 数据可追踪
2. **AI Coding 赛道** - 与 Trellis 定位相近
3. **近期增长明显** - 2023-2026 年间有显著增长
4. **不同增长模式** - 覆盖多种营销策略类型

**最终选择:**
| 产品 | 选择原因 |
|------|----------|
| Continue.dev | YC 背景，HN 首发成功案例 |
| OpenCode | SST 品牌借势，终端原生定位 |
| Superpowers | 博客首发 + KOL 放大，无传统渠道 |
| OpenSpec | 概念营销，借势 GitHub 官方 |
| Roo Code | Fork 策略，YouTube 教程矩阵 |

---

## 研究方法

### 1. 时间线溯源

**目标**: 找到产品的最早公开痕迹

**工具与方法**:
- **GitHub Activity** - 仓库创建时间、首次 commit、releases 页面
- **Wayback Machine** - 域名首次上线时间
- **包管理器** - AUR/PyPI/npm 发布日期 (比 GitHub 更早的痕迹)
- **Hacker News 搜索** - `site:news.ycombinator.com + 产品名`

**关键搜索词**:
```
"[产品名] first release"
"[产品名] announcement"
"Show HN: [产品名]"
"Launch HN: [产品名]"
```

### 2. 传播链追踪

**目标**: 重建从首发到爆发的完整路径

**数据源**:
| 平台 | 追踪方法 |
|------|----------|
| Hacker News | 搜索帖子，记录 points 和 comments |
| Twitter/X | 搜索创始人 handle + 产品名 |
| LinkedIn | 搜索创始人/公司早期帖子 |
| YouTube | 搜索早期教程、播客、演示视频 |
| 博客 | Exa AI 语义搜索 |
| Reddit | 搜索产品相关 subreddit |

**传播链模板**:
```
首发渠道 → 第一批用户 → KOL/媒体 → 大规模曝光 → 持续增长
```

### 3. 创始人背景调研

**目标**: 理解创始人品牌对增长的影响

**调研内容**:
- 社交媒体粉丝数 (Twitter, LinkedIn)
- 过往项目/公司 (品牌资产)
- 个人声誉 (Wikipedia, 技术社区知名度)
- KOL 关系网络

### 4. 增长节点识别

**目标**: 找到 star 数暴涨的关键事件

**方法**:
- **star-history.com** - GitHub star 增长曲线
- **关联事件分析** - 将增长节点与外部事件对应
  - 媒体报道日期
  - 播客发布日期
  - 行业大事件 (新模型发布、官方功能发布等)

**增长类型分类**:
| 类型 | 特征 | 代表 |
|------|------|------|
| 爆发型 | 单日/单周暴涨 | OpenCode |
| 延迟爆发 | 蛰伏后突然爆发 | Superpowers |
| 稳健型 | 持续增长无剧烈波动 | Continue |
| 概念型 | 随概念热度波动 | OpenSpec |
| 教程驱动 | YouTube 教程矩阵 | Roo Code |

### 5. 营销策略归纳

**目标**: 提炼可复用的策略模式

**分析维度**:
- 首发渠道选择
- KOL/媒体关系
- 内容营销类型
- 社区建设方式
- 概念/定位绑定
- 时机窗口把握

---

## 研究工具

| 工具 | 用途 |
|------|------|
| **Exa AI 搜索** | 语义搜索早期博客、媒体报道 |
| **Exa Crawling** | 深入抓取关键页面完整内容 |
| **Hacker News Search** | Show HN, Launch HN 帖子及讨论 |
| **GitHub API** | 仓库时间线、releases、activity |
| **YouTube Search** | 早期教程、播客、演示视频 |
| **LinkedIn Search** | 创始人/公司早期帖子 |
| **star-history.com** | GitHub star 增长曲线 |

---

## 研究输出结构

每个产品的研究报告包含:

```markdown
# [产品名] - 早期营销分析

## 基本信息
- 创始人/团队
- 首发时间
- 当前规模
- 核心定位

## 早期营销时间线
| 日期 | 事件 | 效果 |

## 传播链分析
[首发渠道] → [第一批用户] → [KOL/媒体] → [大规模曝光]

## 关键增长策略
1. 策略一
2. 策略二
...

## 核心洞察
- 成功因素
- 可复用经验

## Star 增长数据
| 日期 | Stars | 事件 |
```

---

## 研究局限性

1. **Twitter/X 内容无法直接抓取** - 只能找到链接，无法获取完整内容
2. **Discord 社区数据** - 需要实际加入才能获取早期讨论
3. **精确 star 历史数据** - star-history.com 有采样限制
4. **私下 KOL 联系** - 无法追踪线下沟通

---

## 文件结构

```
21-early-marketing-research/
├── 00-research-methodology.md    # 本文件 - 研究方法论
├── 01-continue.md                # Continue.dev 分析
├── 02-opencode.md                # OpenCode 分析
├── 03-superpowers.md             # Superpowers 分析
├── 04-openspec.md                # OpenSpec 分析
├── 05-roo-code.md                # Roo Code 分析
└── 99-summary.md                 # 总结与 Trellis 建议
```

---

*研究日期: 2026-01-20*
