// Strip host-shell session env vars so the OpenCode / Pactile context
// resolvers under test fall through to platform-input-derived keys
// instead of picking up whatever the dev's terminal happens to export.
delete process.env.PACTILE_CONTEXT_ID;
delete process.env.OPENCODE_RUN_ID;

// Strip *_PROJECT_DIR vars: shared-hooks/session-start.py prefers them over
// JSON cwd / process cwd, so a dev running tests inside a Claude Code /
// Copilot / etc. session would otherwise have the hook read the *real*
// repo's .pactile/ instead of the test tmpDir.
delete process.env.CLAUDE_PROJECT_DIR;
delete process.env.QODER_PROJECT_DIR;
delete process.env.CODEBUDDY_PROJECT_DIR;
delete process.env.FACTORY_PROJECT_DIR;
delete process.env.CURSOR_PROJECT_DIR;
delete process.env.GEMINI_PROJECT_DIR;
delete process.env.KIRO_PROJECT_DIR;
delete process.env.COPILOT_PROJECT_DIR;
