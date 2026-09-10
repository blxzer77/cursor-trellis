# Local Customization Overview

This directory is for local AI working in a user project where Pactile was installed through npm and `pactile init` has already been run. The AI should modify generated `.pactile/` and platform directories inside the project, not Pactile CLI upstream source code.

## First Determine What The User Actually Wants To Change

| User wording | Read first |
| --- | --- |
| "Change the Pactile flow / phases / next prompt" | `change-workflow.md` |
| "Change task creation, status, archive, or hooks" | `change-task-lifecycle.md` |
| "AI did not read context / change injected content" | `change-context-loading.md` |
| "A platform hook is not behaving as expected" | `change-hooks.md` |
| "Change implement/check/research agent behavior" | `change-agents.md` |
| "Add a skill/command/workflow/prompt" | `change-skills-or-commands.md` |
| "Adjust the project spec structure" | `change-spec-structure.md` |
| "Add team conventions and local notes" | `add-project-local-conventions.md` |

## General Operation Order

1. **Confirm platform and directories**: inspect which directories exist; on a fresh `pactile init --cursor` only `.cursor/` and `.pactile/` are created.
2. **Confirm the selected task**: run `python3 ./.pactile/scripts/task.py selected --source`.
3. **Read the local source of truth**: prefer `.pactile/workflow.md`, `.pactile/config.yaml`, and relevant platform files.
4. **Modify narrowly**: edit only files related to the user's request.
5. **Synchronize semantics**: if a shared flow changes, check whether platform entry points also need changes; if a platform entry changes, check whether `.pactile/workflow.md` still agrees.

## Local File Priority

| Layer | Files |
| --- | --- |
| Workflow | `.pactile/workflow.md` |
| Project configuration | `.pactile/config.yaml` |
| Task material | `.pactile/tasks/<task>/` |
| Project specs | `.pactile/spec/` |
| Runtime scripts | `.pactile/scripts/` |
| Platform integration | `.cursor/` plus legacy adapter directories preserved by `pactile update` |
| Shared skill | `.agents/skills/` |

## Things Not To Do By Default

- Do not edit the global npm install directory.
- Do not edit `node_modules/@blxzer/pactile`.
- Do not assume the user has the Pactile GitHub repository.
- Do not overwrite local files already modified by the user with default templates.
- Do not put team project rules into public `pactile-meta`; project rules belong in `.pactile/spec/` or a local skill.

## When To Inspect Upstream Source

Switch to an upstream source-code perspective only when the user explicitly expresses one of these goals:

- "I want to open a PR to Pactile"
- "I want to change npm package publish contents"
- "I want to fork Pactile"
- "I want to modify the generation logic for `pactile init/update`"

Otherwise, default to modifying local Pactile files inside the user project.
