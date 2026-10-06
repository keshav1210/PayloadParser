---
name: review-changes
description: Review code changes for correctness, acceptance-criteria coverage, tests, security, performance and fit with the project's patterns, and report findings ranked by severity with file and line. Use when asked to review changes, a branch, a commit or a pull request, or before committing.
argument-hint: "[branch, commit range, PR number or files; default: uncommitted changes]"
---

# Review changes

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}What to review: $ARGUMENTS (if empty: all uncommitted changes, staged and unstaged, plus new untracked files).

Don't change any files in this command.

## 1. Collect the changes

- Use git to get the change set: `git status --short`, then `git diff HEAD` for uncommitted work,
  `git diff <base>...<branch>` for a branch, or `git show <commit>` for a commit. For a pull request number,
  use `gh pr diff <number>` if the GitHub CLI is available.
- If this isn't a git repository or there are no changes, say so and stop.
- Find the related requirement or bug from the branch name, commit messages or the user's description, and
  read its acceptance criteria.

## 2. Review in parallel

Delegate to the `code-reviewer` agent with the change set and the acceptance criteria. If the changes touch
authentication, authorisation, input handling, queries, file or network access, secrets, payments or personal
data, also delegate to the `security-reviewer` agent at the same time.

## 3. Report

Merge the findings, remove duplicates and check each one against the code yourself; drop anything you can't
confirm. Then reply with:

1. **Verdict**: Ready to merge · Merge after fixes · Needs rework, plus one sentence why.
2. **Findings**, most severe first: severity (Blocker / Major / Minor / Nit) · `file:line` · the problem ·
   why it matters · a concrete fix.
3. **Acceptance criteria**: covered / not covered, if criteria were found.
4. **What's done well**: 1-3 points.
