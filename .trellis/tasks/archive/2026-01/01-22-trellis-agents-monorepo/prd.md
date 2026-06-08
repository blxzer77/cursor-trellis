# Trellis Agents GUI - Monorepo Migration

## Goal

Convert Trellis from a single-package CLI tool into a monorepo structure that supports both the existing CLI and a new Electron-based GUI application similar to [craft-agents-oss](https://github.com/lukilabs/craft-agents-oss).

## Branch

Create and work on branch: `trellis-agents`

## Requirements

### Phase 1: Monorepo Foundation (This PR)

1. **Repository Structure**
   - Create `apps/` and `packages/` directories
   - Update `pnpm-workspace.yaml` to include new packages
   - Create `tsconfig.base.json` for shared TypeScript config

2. **Extract `packages/core`**
   - Move `src/types/ai-tools.ts` → `packages/core/src/types/`
   - Move `src/types/migration.ts` → `packages/core/src/types/`
   - Move `src/constants/paths.ts` → `packages/core/src/constants/`
   - Create `packages/core/package.json` as `@mindfoldhq/trellis-core`

3. **Extract `packages/shared`**
   - Move `src/utils/*` → `packages/shared/src/utils/`
   - Move `src/templates/*` → `packages/shared/src/templates/`
   - Move `src/migrations/*` → `packages/shared/src/migrations/`
   - Create `packages/shared/package.json` as `@mindfoldhq/trellis-shared`

4. **Migrate CLI to `apps/cli`**
   - Move `src/cli/` → `apps/cli/src/`
   - Move `src/commands/` → `apps/cli/src/commands/`
   - Move `src/configurators/` → `apps/cli/src/configurators/`
   - Move `bin/` → `apps/cli/bin/`
   - Update imports to use workspace packages
   - Keep `@mindfoldhq/trellis` as package name for npm publishing

5. **Scaffold `apps/electron`**
   - Create basic Electron + React + Vite setup
   - Set up directory structure:
     ```
     apps/electron/
     ├── src/
     │   ├── main/       # Electron main process
     │   ├── preload/    # Context bridge
     │   └── renderer/   # React UI
     ├── package.json    # @mindfoldhq/trellis-app
     ├── vite.config.ts
     └── electron-builder.json
     ```
   - Install dependencies: Electron, React, shadcn/ui, Tailwind CSS v4

## Target Structure

```
trellis/
├── apps/
│   ├── cli/                    # @mindfoldhq/trellis (existing CLI)
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   ├── configurators/
│   │   │   └── index.ts
│   │   ├── bin/
│   │   └── package.json
│   └── electron/               # @mindfoldhq/trellis-app (new GUI)
│       ├── src/
│       │   ├── main/
│       │   ├── preload/
│       │   └── renderer/
│       └── package.json
├── packages/
│   ├── core/                   # @mindfoldhq/trellis-core
│   │   ├── src/
│   │   │   ├── types/
│   │   │   └── constants/
│   │   └── package.json
│   └── shared/                 # @mindfoldhq/trellis-shared
│       ├── src/
│       │   ├── utils/
│       │   ├── templates/
│       │   └── migrations/
│       └── package.json
├── .trellis/                   # Keep for dogfooding
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json                # Root workspace
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Package Manager | pnpm (workspaces) |
| Desktop Framework | Electron |
| UI Framework | React 18+ |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS v4 |
| Build (Main) | esbuild |
| Build (Renderer) | Vite |
| TypeScript | 5.7+ |

## Acceptance Criteria

- [ ] Branch `trellis-agents` created from `main`
- [ ] `pnpm-workspace.yaml` updated with `apps/*` and `packages/*`
- [ ] `packages/core` exists with types and constants
- [ ] `packages/shared` exists with utils, templates, migrations
- [ ] `apps/cli` exists and `trellis init` / `trellis update` work correctly
- [ ] `apps/electron` scaffolded with basic Electron + React + Vite
- [ ] All packages can be built: `pnpm build`
- [ ] Root scripts work: `pnpm dev`, `pnpm build`, `pnpm typecheck`
- [ ] Existing tests pass (if any)

## Out of Scope (Future Work)

- Full GUI feature implementation (sessions, tasks, specs editor)
- Claude Agent SDK integration in GUI
- Electron app packaging and distribution
- CI/CD pipeline updates

## Technical Notes

- Keep `.trellis/` in root for dogfooding
- Use workspace protocol for internal deps: `"@mindfoldhq/trellis-core": "workspace:*"`
- Preserve `@mindfoldhq/trellis` package name for backward compatibility
- Consider Turborepo for build orchestration in future
