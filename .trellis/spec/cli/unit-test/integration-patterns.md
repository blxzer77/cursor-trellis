# Integration Test Patterns

> Patterns for function-level integration tests of CLI commands.

---

## Approach: Function-Level Integration (Approach B)

Instead of spawning CLI subprocesses, directly import and call `init()` / `update()` functions in real temp directories. This gives:

- Fast execution (~400ms per test file)
- Reproducible results (no network, no TTY)
- Precise control of external dependencies via mocks
- Full code path coverage from entry to file system output

**Trade-off**: Does not test CLI argument parsing (commander layer).

---

## Standard Test Setup

```typescript
describe("command() integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.spyOn(console, "log").mockImplementation(noop);
    vi.spyOn(console, "error").mockImplementation(noop);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();  // Only needed if vi.stubGlobal was used
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
```

---

## Common Patterns

### Pattern: Setup Project (for update tests)

Update tests need an initialized project as precondition:

```typescript
async function setupProject(): Promise<void> {
  await init({ yes: true, force: true });
}

it("test case", async () => {
  await setupProject();
  // ... modify state ...
  await update({ force: true });
  // ... assert results ...
});
```

### Pattern: Full Snapshot Comparison

For verifying an operation is a true no-op:

```typescript
const snapshotBefore = new Map<string, string>();
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else snapshotBefore.set(path.relative(tmpDir, full), fs.readFileSync(full, "utf-8"));
  }
};
walk(tmpDir);

await operation();

// Compare: no added, no removed, no changed files
```

### Pattern: Simulate Template Version Change

To test auto-update detection (template changed, user did not modify):

```typescript
// 1. Write "old content" to a template file
const oldContent = "# Old version\n";
fs.writeFileSync(targetFull, oldContent);

// 2. Update hash file to match old content (so update thinks user didn't modify it)
const hashes = JSON.parse(fs.readFileSync(hashFile, "utf-8"));
hashes[targetRelative] = computeHash(oldContent);
fs.writeFileSync(hashFile, JSON.stringify(hashes, null, 2));

// 3. Run update — should auto-update to current template
await update({ force: true });
expect(fs.readFileSync(targetFull, "utf-8")).toBe(currentTemplateContent);
```

### Pattern: Downgrade Protection

```typescript
// Set project version to future
fs.writeFileSync(versionPath, "99.99.99");

await update({});

// Version should NOT be changed — update refused to downgrade
expect(fs.readFileSync(versionPath, "utf-8")).toBe("99.99.99");
```

---

## Test Matrix Design

Integration test scenarios should be organized as a numbered matrix in the PRD:

| # | Scenario | Options | Verification |
|---|----------|---------|--------------|
| 1 | No-op (same version) | `{}` | Zero file changes, no backup |
| 2 | Dry run | `{ dryRun: true }` | No file modifications |
| 3 | Deleted file recreation | `{ force: true }` | File restored |
| ... | | | |

Each test is numbered (`#1`, `#2`, ...) matching the matrix for traceability.

---

## Discovered Bugs (via integration tests)

Integration tests are effective at finding **cross-module inconsistencies**:

1. **Template placeholder roundtrip**: `init` resolves `{{PYTHON_CMD}}` → `python3`, but `update` compared against raw `{{PYTHON_CMD}}`. Every update detected false changes.

2. **Template list mismatch**: `update` listed files not created by `init`, causing phantom "new file" detections on same-version update.

3. **Project-type-conditional templates ignored**: `createSpecTemplates()` accepted `projectType` but ignored it (`_projectType`), always creating both backend + frontend specs. `collectTemplateFiles()` unconditionally included all spec files regardless of which dirs existed. Pure backend projects got empty frontend spec dirs on init, and update always tracked frontend files even when the dir was removed.

All three bugs were invisible to unit tests (which test modules in isolation) but immediately surfaced when testing the full init→update flow.

---

## DO / DON'T

### DO

- Use real file system operations (no mocking fs)
- Test the full flow: entry function → file system output
- Verify both positive outcomes (file created) and negative outcomes (file not changed)
- Clean up temp directories after every test

### DON'T

- Don't mock internal modules to simulate template changes — use filesystem manipulation instead
- Don't share temp directories between tests
- Don't depend on specific template content in assertions (use `computeHash` or read from init output)
