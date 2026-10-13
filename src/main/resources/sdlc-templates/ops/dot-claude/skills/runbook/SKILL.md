---
name: runbook
description: Write a runbook for an alert, a failure mode or a routine operation - what it means, impact, how to check, step-by-step mitigation, escalation and how to verify recovery - grounded in the actual code, config and commands, saved in docs/sdlc/operations/runbooks/. Use when adding an alert, after an incident, or for operations people do by hand.
argument-hint: "<alert, failure or operation>"
disable-model-invocation: true
---

# Runbook

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}
Topic: $ARGUMENTS

If nothing was given, ask which alert, failure or operation the runbook is for, and stop.

## 1. Understand it in the code

Find where the behaviour lives: the code path, config, the dependencies it calls, timeouts and retries, the
metrics and logs it emits. Read `docs/sdlc/operations/observability.md` for where logs, metrics and dashboards
are, and existing runbooks in `docs/sdlc/operations/runbooks/`. Ask the user for what isn't in the repository:
dashboard links, how to reach production, who is on call.

## 2. Write it for 3 a.m.

Create `docs/sdlc/operations/runbooks/<short-name>.md` from
`docs/sdlc/operations/runbooks/_template-runbook.md`. Someone who has never seen this code must be able to
follow it while tired:
- What the alert means and the user impact, in one or two sentences.
- How to confirm it: exact queries, commands and dashboards, and what "bad" looks like.
- Mitigation first, in numbered steps with exact commands: roll back, switch off the flag, restart, scale,
  fail over. Mark each step that changes production and needs care.
- Diagnosis afterwards: likely causes in order, and how to tell them apart.
- How to verify recovery, when to escalate and to whom.

Use only commands and names you found in the project or the user gave you; mark anything you couldn't verify.
Reply with the path and the steps that need a person to check them.
