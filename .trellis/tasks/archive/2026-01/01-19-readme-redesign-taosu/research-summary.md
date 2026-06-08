# Research Summary: AI Coding Tools Marketing & Website Strategies

> Research Date: 2026-01-19
> Purpose: Inform Trellis README redesign

---

## Executive Summary

All successful AI coding tools have:
1. **A dedicated website** (not just GitHub)
2. **Clear positioning** (slogan 4-8 words)
3. **Visual demos** (GIF on first screen)
4. **Low-friction install** (one command)
5. **Community channels** (Discord + GitHub)

---

## Project Analysis

### 1. Aider (aider.chat) - 39K stars

**Positioning**: "AI pair programming in your terminal"

**Website Strategy**:
- Social proof metrics prominently displayed (39K stars, 4.1M installs, 15B tokens/week)
- Pure open-source, users pay LLM providers directly
- Documentation with built-in RAG search (`/help` command)
- No paid advertising, 100% community-driven growth

**Monetization**: None (free open-source, users pay API costs)

**Key Features Highlighted**:
- Cloud and local LLMs
- Maps your codebase
- 100+ code languages
- Git integration
- Voice-to-code
- Linting & testing

**CTA Flow**: Homepage → Get Started → Documentation → Install via pip

---

### 2. Continue.dev - 31K stars

**Positioning**: "Ship faster with Continuous AI"

**Website Strategy**:
- Multi-domain architecture (www, docs, hub, blog, changelog, resources)
- Three product entry points: Mission Control (GUI), CLI, CI/CD
- Freemium model with clear upgrade path
- "Continuous AI" concept as thought leadership

**Monetization**:
- Solo: Free
- Team: $10/developer/month
- Enterprise: Custom

**Key Features**:
- Mission Control (GUI dashboard)
- CLI for terminal workflows
- CI/CD integration
- Cloud Agents (async background tasks)
- IDE Extensions

**CTA Flow**: Multiple paths - Kick off agent (GUI) / Build with CLI / Deploy in CI

---

### 3. Cursor - 32K stars, $200M+ ARR

**Positioning**: "Built to make you extraordinarily productive, Cursor is the best way to code with AI"

**Website Strategy**:
- **Zero advertising spend** - pure Product-Led Growth (PLG)
- Download-first CTA, no signup required
- Privacy-first messaging (SOC 2 certified)
- Closed-source product, but documentation is open-source

**Monetization**:
- Hobby: Free (limited)
- Pro: $20/month
- Pro+: $60/month
- Ultra: $200/month
- Teams: $40/user/month
- Enterprise: Custom

**Key Features**:
- AI-native IDE (VS Code fork)
- Tab completion (custom model)
- Agent mode
- Codebase indexing
- Privacy Mode

**CTA Flow**: Homepage → Download (no signup) → Install → Free tier → Hit limits → Upgrade

---

### 4. Cline (cline.bot) - 57K stars

**Positioning**: "The Open Coding Agent"

**Website Strategy**:
- **Contrarian pricing** - no AI markup, transparent token costs
- Open-source core, enterprise governance layer
- Learning hub ("AI Coding University")
- GitHub fastest-growing AI project 2025 (4704% YoY)

**Monetization**:
- Open Source: Free (BYOK)
- Teams: $20/month/user (free through Q1 2026)
- Enterprise: Custom (SSO, SLA, dedicated support)

**Key Features**:
- VS Code/JetBrains/CLI
- Model agnostic (any LLM)
- MCP Marketplace
- Plan & Act modes
- YOLO mode

**CTA Flow**: Sign Up Free → Install Extension → Configure Model → Build

---

### 5. OpenCode - 10K stars

**Positioning**: "A powerful AI coding agent. Built for the terminal."

**Website Strategy**:
- Started GitHub-only, later added opencode.ai
- Desktop app announcement
- Privacy-focused messaging

**Key Takeaway**: Even smaller projects need websites for enterprise credibility

---

## Key Patterns Identified

### README Must-Haves

| Element | Why It Works |
|---------|--------------|
| **Slogan (4-8 words)** | Instant positioning |
| **GIF Demo** | Shows value without reading |
| **One-liner install** | Reduces friction to try |
| **Features with icons** | Scannable, visual |
| **Quick Start (3-5 steps)** | Fast time-to-value |
| **Social proof** | Builds trust (stars, installs) |

### Website Architecture (for future)

```
example.com         - Marketing/landing
docs.example.com    - Documentation
blog.example.com    - Content marketing
```

### Tech Stack Recommendations (2025)

| Purpose | Tool | Cost |
|---------|------|------|
| Marketing site | Next.js / Astro | Free (Vercel) |
| Documentation | Docusaurus / Mintlify | Free |
| Styling | Tailwind + shadcn/ui | Free |
| Analytics | Plausible / Matomo | Free-$12/mo |
| Hosting | Vercel / GitHub Pages | Free |

---

## What Projects Lose Without a Website

1. **SEO** - GitHub repos rank poorly for long-tail searches
2. **Enterprise Sales** - No professional landing page = no enterprise deals
3. **Content Marketing** - No blog = no thought leadership
4. **Community Hub** - Scattered across GitHub Issues, Discord, etc.
5. **Conversion Funnel** - No CTA optimization possible

**Key Finding**: No major AI coding tool remained GitHub-only after gaining traction.

---

## Recommendations for Trellis

### Phase 1: README Optimization (Now)
- Slogan: "The missing workflow layer for AI coding"
- GIF: /start → develop → /finish-work workflow
- Features: Workflow Templates, Agent Delegation, Feature Tracking, Session Context, Multi-Tool Support
- Quick Start: 3 steps to first session

### Phase 2: Simple Documentation Site (Soon)
- Use Docusaurus or Mintlify
- Host on GitHub Pages or Vercel
- Include: Getting Started, Commands, Configuration, Contributing

### Phase 3: Marketing Website (Later)
- Separate marketing site from docs
- Add: Blog, Case Studies, Pricing (even if free)
- SEO optimization for "AI coding workflow" keywords

---

---

## Additional Research: Tagline & Positioning Analysis

> Research Date: 2026-01-20
> Researcher: kleinhe + AI

### Question: Is "AI Coding Governance Framework" a Good Tagline?

**Answer: No.** Here's why:

### 1. "Governance Framework" Word Association

| Aspect | Analysis |
|--------|----------|
| **Association** | Enterprise compliance, bureaucracy, control |
| **Tone** | Formal, cold |
| **Use Cases** | Data governance, community governance, IT governance |
| **Developer Friendliness** | Low - sounds like "managing you" not "helping you" |

**Key Finding**: Almost no popular open-source project uses "governance framework" as tagline.

### 2. Closest Competitor: AI Governor Framework

**Project**: github.com/Fr-e-d/AI-Governor-Framework

**Tagline**: *"Turn any AI coding assistant into a disciplined, project-aware engineering partner that respects your architecture and coding standards"*

**Key Observations**:
- Almost identical positioning to Trellis
- Uses "Governor" not "Governance" — more vivid, less bureaucratic
- Emphasizes: disciplined, project-aware, respects standards

### 3. Popular Positioning Words in Open Source

| Term | Representative Projects | Stars |
|------|------------------------|-------|
| Agent Orchestration Framework | n8n, LangGraph, CrewAI | 50K+ |
| Agent Framework | Microsoft Agent Framework, Swarms | 10K+ |
| Workflow Automation | n8n, Temporal | 50K+ |
| Developer Tooling | Various CLI tools | - |

### 4. Can "Governance" Express Trellis Core Value?

| Problem | Trellis Solution | Does "Governance" Express It? |
|---------|------------------|------------------------------|
| AI lacks project context | Persistent guidelines, session tracking | ❌ Not intuitive |
| Guidelines written but ignored | On-demand injection, Hook automation | ❌ Too abstract |
| Workflow needs supervision | Slash Commands encapsulate flow | ❌ No association |
| Multi-Agent config complex | `/parallel` one-click launch | ❌ Completely unrelated |

### 5. Recommended Positioning Directions

**Direction A: Use Metaphor (Like Trellis Name Itself)**
> *"Guide AI's wild growth along a disciplined path"*
> *"让 AI 的能力沿着正确的方向生长"*

Trellis (藤架) is already a perfect metaphor — **guiding, not constraining**.

**Direction B: Emphasize "Project-Aware AI"**
> *"Project-aware AI coding framework"*
> *"Make AI respect your architecture"*

Similar to AI Governor Framework approach.

**Direction C: Emphasize Workflow Automation**
> *"AI Coding Workflow Framework"*
> *"From prompt to production, on rails"*

**Direction D: Borrow Anthropic's Own Terminology**
Anthropic's article: *"Effective **Harnesses** for Long-Running Agents"*
> *"AI Coding Harness"* (缰绳/驾驭工具)

### 6. Claude Code Plugin vs Trellis Distinction

| Feature | Claude Code Plugin (Global) | Trellis (Project-Level) |
|---------|---------------------------|------------------------|
| Install Location | `~/.claude/plugins/` | Project `.claude/` + `.trellis/` |
| Scope | All projects share | Current project only |
| Install Method | `npm install -g` or `/plugin` | `trellis init` |

**Conclusion**: Trellis uses Claude Code's **project-level configuration capability**, not the global Plugin system. This is by design — each project needs different guidelines and tracking.

### 7. Recommendation

- **Do NOT use** "AI coding 治理框架" as tagline
- **Recommended**: Continue with Trellis **vine metaphor**, or use developer-friendly terms: harness, rails, guide

---

## Source References

1. Aider research agent (aider.chat analysis)
2. Continue.dev research agent (continue.dev analysis)
3. Cursor research agent (cursor.com analysis)
4. Cline research agent (cline.bot analysis)
5. GitHub-only projects research agent (comparative analysis)
6. OSS website best practices research agent (2025-2026 standards)
7. AI Governor Framework (github.com/Fr-e-d/AI-Governor-Framework)
8. Project CodeGuard (github.com/project-codeguard/rules)
9. Anthropic "Effective Harnesses for Long-Running Agents" article
