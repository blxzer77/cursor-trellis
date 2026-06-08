# Repo Findings: git-backed private registry init

## Relevant Existing Behavior

* `packages/cli/src/utils/template-fetcher.ts` owns registry parsing, index probing, and template download helpers.
* `parseRegistrySource()` already accepts self-hosted GitLab-style HTTPS and SSH URLs. Unknown HTTPS domains are treated as GitLab-compatible sources and keep a `host` field.
* `probeRegistryIndex()` probes `index.json` with unauthenticated `fetch()` and only distinguishes 404 from other HTTP/network errors.
* `init.ts` uses `${registry.rawBaseUrl}/index.json` to decide marketplace mode vs direct download mode in both interactive and `-y` registry flows.
* `downloadTemplateById()` and `downloadRegistryDirect()` still call `downloadWithStrategy()`, which uses `giget` `downloadTemplate()`.

## Root Cause

Private GitLab auth fails before download. The mode-detection probe uses a raw URL and anonymous HTTP. A private GitLab instance commonly returns a login page, 401/403, or redirect instead of raw JSON. Current code treats this as transient registry failure, so marketplace selection never starts.

## Design Constraint

Changing only `probeRegistryIndex()` is insufficient. If probe switches to git but download remains `giget`/raw-provider based, the same private-auth problem can reappear during template download. Probe and download need a shared backend for private registry sources.

## Files To Inspect During Implementation

* `packages/cli/src/utils/template-fetcher.ts`
* `packages/cli/src/commands/init.ts`
* `packages/cli/test/utils/template-fetcher.test.ts`
* `.trellis/spec/cli/backend/error-handling.md`
* `.trellis/spec/cli/backend/quality-guidelines.md`
