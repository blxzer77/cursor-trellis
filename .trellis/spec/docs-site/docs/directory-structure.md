# Directory Structure

> File organization and naming conventions for this Mintlify documentation project.

---

## ⚠️ Critical: Manual Navigation Update Required

**Mintlify does NOT auto-discover pages.** Every new page must be manually added to `docs.json`.

```json
// docs.json - Must update navigation when adding pages
{
  "navigation": {
    "languages": [
      {
        "language": "en",
        "groups": [
          {
            "group": "Spec Templates",
            "pages": [
              "templates/specs-index",
              "templates/specs-node", // ← Add new pages here
              "templates/specs-python"
            ]
          }
        ]
      },
      {
        "language": "zh",
        "groups": [
          // Same structure for Chinese
        ]
      }
    ]
  }
}
```

**Checklist for new pages:**

1. [ ] Create `.mdx` file
2. [ ] Add to English navigation in `docs.json`
3. [ ] Create Chinese version in `zh/` directory
4. [ ] Add to Chinese navigation in `docs.json`

---

## Project Structure

```
docs/
├── docs.json              # Main configuration
├── index.mdx              # Homepage
├── quickstart.mdx         # Quick start guide
├── development.mdx        # Development setup
│
├── essentials/            # Core documentation
│   ├── settings.mdx
│   ├── navigation.mdx
│   ├── markdown.mdx
│   ├── code.mdx
│   ├── images.mdx
│   └── reusable-snippets.mdx
│
├── api-reference/         # API documentation
│   ├── introduction.mdx
│   ├── openapi.json       # OpenAPI specification
│   └── endpoint/
│       ├── get.mdx
│       ├── create.mdx
│       ├── delete.mdx
│       └── webhook.mdx
│
├── ai-tools/              # AI tools guides
│   ├── cursor.mdx
│   ├── claude-code.mdx
│   └── windsurf.mdx
│
├── snippets/              # Reusable content fragments
│   └── snippet-intro.mdx
│
├── images/                # Image assets
│   └── *.png|jpg|gif
│
└── logo/                  # Brand assets
    ├── light.svg
    └── dark.svg
```

---

## Naming Conventions

### Files

| Type        | Convention       | Example               |
| ----------- | ---------------- | --------------------- |
| MDX pages   | `kebab-case.mdx` | `getting-started.mdx` |
| Directories | `kebab-case/`    | `api-reference/`      |
| Images      | `kebab-case.png` | `hero-image.png`      |
| Snippets    | `kebab-case.mdx` | `api-key-setup.mdx`   |

### Directory Organization

| Directory        | Purpose            | When to Use                             |
| ---------------- | ------------------ | --------------------------------------- |
| Root (`/`)       | Top-level pages    | Homepage, quickstart, main entry points |
| `essentials/`    | Core platform docs | Settings, navigation, markdown syntax   |
| `api-reference/` | API documentation  | Endpoints, OpenAPI specs                |
| `snippets/`      | Reusable content   | Content used in multiple pages          |
| `images/`        | Image assets       | Screenshots, diagrams                   |
| `logo/`          | Brand assets       | Light/dark mode logos                   |

---

## Rules

### DO

- Group related pages in directories
- Use descriptive, SEO-friendly file names
- Keep directory nesting shallow (max 2 levels)
- Place reusable content in `snippets/`

### DON'T

- Use underscores in file names (use hyphens)
- Create deeply nested directories
- Mix different content types in same directory
- Use spaces or special characters in names

---

## Internationalization (i18n) Structure

For bilingual documentation, follow this pattern:

```
docs/
├── index.mdx              # English homepage
├── quickstart.mdx         # English quickstart
├── guides/                # English guides
│   └── *.mdx
├── blog/                  # English blog (EN posts only)
│   ├── index.mdx          # Lists EN posts only
│   └── *.mdx
│
├── zh/                    # Chinese content root
│   ├── index.mdx          # Chinese homepage
│   ├── quickstart.mdx     # Chinese quickstart
│   ├── guides/            # Chinese guides
│   │   └── *.mdx
│   └── blog/              # Chinese blog (ZH posts only)
│       ├── index.mdx      # Lists ZH posts only
│       └── *.mdx
│
├── changelog.mdx          # Shared (no translation needed)
└── docs.json
```

### i18n Rules

| Content Type   | English Path       | Chinese Path                |
| -------------- | ------------------ | --------------------------- |
| Main pages     | `page.mdx`         | `zh/page.mdx`               |
| Section pages  | `section/page.mdx` | `zh/section/page.mdx`       |
| Blog posts     | `blog/post.mdx`    | `zh/blog/post.mdx`          |
| Shared content | `changelog.mdx`    | `changelog.mdx` (same file) |

### Common Mistake

**Don't**: Mix languages in one folder

```
blog/
├── post-en.mdx      # ❌ Clutters both language views
└── post-zh.mdx
```

**Do**: Separate by language directory

```
blog/
└── post.mdx         # ✅ English only
zh/blog/
└── post.mdx         # ✅ Chinese only
```

---

## Adding New Content

### New Page (Bilingual)

| Step | Action                   | File                                |
| ---- | ------------------------ | ----------------------------------- |
| 1    | Create English page      | `section/page.mdx`                  |
| 2    | Create Chinese page      | `zh/section/page.mdx`               |
| 3    | **Update EN navigation** | `docs.json` → `languages[0].groups` |
| 4    | **Update ZH navigation** | `docs.json` → `languages[1].groups` |
| 5    | Test locally             | `pnpm dev`                          |

> ⚠️ **Steps 3-4 are mandatory.** Pages won't appear in sidebar without navigation entries.

### New Section

1. Create new directory with descriptive name
2. Add pages inside the directory
3. Create a group in `docs.json` navigation (both EN and ZH)

### New Snippet

1. Create `.mdx` file in `snippets/`
2. Reference with `<Snippet file="filename.mdx" />`
