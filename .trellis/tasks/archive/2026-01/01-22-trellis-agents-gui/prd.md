# Trellis Agents GUI - Electron App

## Goal

Add a GUI application (`trellis-agents`) to the Trellis project as a monorepo sub-project, mimicking the UI/UX of [craft-agents-oss](https://github.com/lukilabs/craft-agents-oss).

**Important**: The CLI remains in the root directory. Only add the GUI as a sub-project.

## Branch

`feature/trellis-agents`

## Target Structure

```
trellis/                          # Root = CLI (unchanged)
├── src/                          # CLI source (keep as-is)
├── bin/                          # CLI binary (keep as-is)
├── package.json                  # @mindfoldhq/trellis (CLI)
├── tsconfig.json                 # CLI tsconfig (keep as-is)
├── .trellis/                     # Keep for dogfooding
│
├── apps/                         # NEW: Sub-applications
│   └── trellis-agents/           # NEW: GUI application
│       ├── src/
│       │   ├── main/             # Electron main process
│       │   │   ├── index.ts
│       │   │   └── window.ts
│       │   ├── preload/          # Context bridge
│       │   │   └── index.ts
│       │   └── renderer/         # React UI
│       │       ├── components/
│       │       │   ├── ui/       # shadcn/ui components
│       │       │   ├── layout/
│       │       │   │   ├── Sidebar.tsx
│       │       │   │   ├── Header.tsx
│       │       │   │   └── MainContent.tsx
│       │       │   └── sessions/
│       │       │       ├── SessionList.tsx
│       │       │       ├── SessionItem.tsx
│       │       │       └── ChatView.tsx
│       │       ├── hooks/
│       │       ├── stores/       # Zustand stores
│       │       ├── lib/
│       │       ├── styles/
│       │       │   └── globals.css
│       │       ├── App.tsx
│       │       └── main.tsx
│       ├── resources/            # App icons
│       ├── electron-builder.json
│       ├── package.json          # @mindfoldhq/trellis-agents
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── tailwind.config.ts
│
└── pnpm-workspace.yaml           # NEW: Workspace config
```

## Requirements

### 1. Monorepo Setup

- Create `pnpm-workspace.yaml`:
  ```yaml
  packages:
    - 'apps/*'
  ```
- Root `package.json` stays as CLI package (no changes to name/version)
- Add workspace scripts to root `package.json`:
  ```json
  {
    "scripts": {
      "dev:gui": "pnpm --filter @mindfoldhq/trellis-agents dev",
      "build:gui": "pnpm --filter @mindfoldhq/trellis-agents build"
    }
  }
  ```

### 2. Electron App Scaffold (`apps/trellis-agents/`)

Create a working Electron + React + Vite application with:

**Tech Stack:**
| Layer | Technology |
|-------|------------|
| Desktop | Electron |
| UI Framework | React 18+ |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS v4 |
| Build | Vite |
| State | Zustand |

**Package.json:**
```json
{
  "name": "@mindfoldhq/trellis-agents",
  "version": "0.1.0",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build && electron-builder",
    "electron:dev": "concurrently \"vite\" \"electron .\""
  }
}
```

### 3. UI Implementation (Mimic craft-agents)

Implement the visual layout similar to craft-agents-oss:

**Layout:**
- Left sidebar with session list
- Main content area for chat/session view
- Header with controls

**Components to create:**
- `Sidebar.tsx` - Session list sidebar
- `SessionList.tsx` - List of sessions with status indicators
- `SessionItem.tsx` - Individual session row
- `ChatView.tsx` - Main chat/message area (placeholder)
- `Header.tsx` - Top bar with controls

**Styling:**
- Dark theme by default (like craft-agents)
- Use shadcn/ui components
- Tailwind CSS for custom styling

### 4. Basic Functionality (UI Only)

- Display mock session list
- Session selection (visual state change)
- Basic routing between sessions
- No actual Claude integration yet (placeholder UI)

## Tech Stack Reference (from craft-agents)

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "electron": "^34.0.0",
    "electron-builder": "^25.0.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "concurrently": "^9.0.0"
  }
}
```

## Acceptance Criteria

- [ ] `pnpm-workspace.yaml` created with `apps/*`
- [ ] `apps/trellis-agents/` directory created with full structure
- [ ] Electron app runs: `pnpm dev:gui` or `cd apps/trellis-agents && pnpm electron:dev`
- [ ] UI shows sidebar with mock sessions
- [ ] UI shows main chat area (placeholder)
- [ ] Dark theme applied
- [ ] shadcn/ui components working
- [ ] Root CLI still works: `pnpm build && node bin/trellis.js --help`

## Out of Scope

- Claude Agent SDK integration (future)
- Actual session persistence (future)
- Real chat functionality (future)
- App packaging/distribution (future)
- Shared packages extraction (future, if needed)

## Reference

- craft-agents-oss: https://github.com/lukilabs/craft-agents-oss
- Claude Agent SDK: https://docs.anthropic.com/en/docs/claude-code/sdk
