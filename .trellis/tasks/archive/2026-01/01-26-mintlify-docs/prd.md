# Set up Mintlify Documentation Site

## Goal

Create a professional documentation site for Trellis using Mintlify, making it easy for users to understand and adopt the framework.

## Background

Trellis is an AI framework & toolkit for Claude Code & Cursor. Currently documentation lives only in the README. A dedicated docs site will:
- Provide better navigation and searchability
- Allow more detailed guides and tutorials
- Present a professional image
- Enable AI-native features (Mintlify has llms.txt, MCP support)

## Requirements

### Phase 1: Initial Setup
- [ ] Create `docs/` directory with Mintlify structure
- [ ] Configure `mint.json` with Trellis branding
- [ ] Set up basic navigation structure
- [ ] Deploy to `*.mintlify.app` for testing

### Phase 2: Core Documentation
- [ ] **Introduction** - What is Trellis, why use it
- [ ] **Quick Start** - Installation and first steps
- [ ] **Concepts** - Spec injection, hooks, workspaces
- [ ] **Use Cases** - Educating AI, parallel sessions, custom workflows

### Phase 3: Reference Documentation
- [ ] **Configuration** - `workflow.md`, `worktree.yaml`, spec structure
- [ ] **Scripts Reference** - All `.trellis/scripts/` commands
- [ ] **Hooks** - How hooks work, available hooks
- [ ] **Agents** - Built-in agents and customization

### Phase 4: Advanced Topics
- [ ] **Writing Specs** - Best practices for spec files
- [ ] **Team Collaboration** - Multi-developer workflows
- [ ] **Troubleshooting** - Common issues and solutions
- [ ] **FAQ** - Expanded from README

## Proposed Structure

```
docs/
├── mint.json                 # Mintlify config
├── introduction.mdx          # Landing page
├── quickstart.mdx            # Getting started
├── concepts/
│   ├── spec-injection.mdx
│   ├── hooks.mdx
│   └── workspaces.mdx
├── guides/
│   ├── educating-ai.mdx
│   ├── parallel-sessions.mdx
│   └── custom-workflows.mdx
├── reference/
│   ├── configuration.mdx
│   ├── scripts.mdx
│   ├── hooks.mdx
│   └── agents.mdx
└── resources/
    ├── faq.mdx
    └── troubleshooting.mdx
```

## Acceptance Criteria

- [ ] Docs site deploys successfully to Mintlify
- [ ] All core pages have content (not just placeholders)
- [ ] Navigation is intuitive and logical
- [ ] Branding matches Trellis identity
- [ ] Code examples are accurate and tested
- [ ] Images/diagrams from README are included

## Technical Notes

- Use Mintlify CLI (`mint dev`) for local preview
- Content is MDX format (Markdown + JSX components)
- Can reuse content from existing README
- Consider enabling Mintlify's AI features (llms.txt, Assistant)

## Resources

- [Mintlify Quickstart](https://mintlify.com/docs/quickstart)
- [Mintlify Components](https://mintlify.com/docs/content/components)
- Current README content as source material
