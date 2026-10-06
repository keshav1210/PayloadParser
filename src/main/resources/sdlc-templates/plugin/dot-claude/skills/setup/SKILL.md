---
name: setup
description: Install or update the SDLC kit's project files (CLAUDE.md instructions, rules, safety settings and the docs/sdlc templates) in the current project. Run once in each project before the other kit commands, and again after updating the plugin.
disable-model-invocation: true
---

# Set up the SDLC kit in this project

The plugin provides the commands and agents. The files that have to live inside a project are in
`${CLAUDE_PLUGIN_ROOT}/templates/`. Copy them into the project root (the folder Claude Code was opened in),
keeping their relative paths.

## 1. Compare

List every file under `${CLAUDE_PLUGIN_ROOT}/templates/` and check whether the same path exists in the project.

## 2. Copy

- **Missing in the project**: create it with the template's content.
- **Already exists and identical**: skip it.
- **Already exists and different**: don't overwrite it. List it for the user, with a one-line summary of what
  differs, and ask before replacing anything.

Special cases:

- `CLAUDE.md`: if the project already has one, don't touch it. Write the kit's version as `CLAUDE.sdlc.md`
  instead, then offer to add this line at the end of the project's `CLAUDE.md` so Claude loads it:
  `@CLAUDE.sdlc.md`
- `.claude/settings.json`: if the project already has one, merge into it: add any `permissions.deny` and
  `permissions.ask` entries from the template that are missing, keep everything else, show the result, and
  save only after the user agrees.
- Never copy anything outside the project folder, and never delete project files.

Use the shell to copy if it's available, otherwise read each template and write it to the project.

## 3. Report

A short table: created · skipped (identical) · needs your decision. Then suggest running `/sdlc-init`, which
reads the project and fills in the docs.
