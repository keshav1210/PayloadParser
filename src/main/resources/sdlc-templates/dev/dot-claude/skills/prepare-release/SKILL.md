---
name: prepare-release
description: Write release notes and a changelog entry for a new version from the commits and merged work since the last release, grouped into Added, Changed, Fixed, Security and so on. Use when preparing a release or asked for release notes or a changelog.
argument-hint: "[version, e.g. 1.4.0] [from..to range]"
disable-model-invocation: true
---

# Prepare a release

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}Version and range: $ARGUMENTS

## 1. Find what changed

- Find the previous release: `git describe --tags --abbrev=0`. If there are no tags, ask the user for the
  starting commit or date.
- List the changes: `git log <previous>..HEAD --no-merges --pretty=format:"%h %s"`, and merged pull requests
  if the GitHub CLI is available.
- Link each change to a requirement, story or bug ID when the commit or branch mentions one, and read the
  requirement for context when a commit message is unclear.
- If no version was given, suggest one using Semantic Versioning: MAJOR for breaking changes, MINOR for new
  features, PATCH for fixes only. Explain the choice.

## 2. Write two versions

1. **Changelog entry** for developers, added at the top of `CHANGELOG.md` (create it if missing), in the Keep a
   Changelog format: `## [version] - YYYY-MM-DD` with sections Added, Changed, Deprecated, Removed, Fixed,
   Security. Include IDs and short technical detail. Leave out internal-only changes (refactoring, CI, tests)
   unless they affect users or developers of the project.
2. **Release notes** for the readers named in `docs/sdlc/07-release-process.md` (users by default): plain
   language, benefits first, no internal jargon or commit hashes. Call out breaking changes and any action
   users must take at the top.

## 3. Check before finishing

Show both texts to the user. List commits you couldn't classify and ask about them. Don't create tags,
commit or push unless the user asks.
