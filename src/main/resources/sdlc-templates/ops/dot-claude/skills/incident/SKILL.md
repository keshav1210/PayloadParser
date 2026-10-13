---
name: incident
description: Help during a live production incident - assess impact and severity, stabilise first (rollback, feature flag, scaling) with steps for a person to run, then narrow down the cause from recent changes, logs and code, and keep a timeline. Use when something is broken or degraded in production right now.
argument-hint: "<symptom, alert or error>"
disable-model-invocation: true
---

# Incident response

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}
Symptom: $ARGUMENTS

If nothing was given, ask what is broken, since when, and who is affected, and stop.

Keep replies short: the people handling the incident are busy. Start a timeline (time, what was seen or done)
and add to it with every step.

## 1. Assess (first minutes)

- What's broken, for whom, since when, and is it getting worse? Set a severity: SEV1 most users or data at risk
  · SEV2 a major feature or many users · SEV3 minor or a workaround exists.
- Check for a runbook in `docs/sdlc/operations/runbooks/` and follow it.
- What changed recently: deployments (`git log --since=…`), config, feature flags, traffic, dependencies.

## 2. Stabilise

Propose the fastest safe way to reduce impact, before looking for the root cause: roll back the last
deployment, switch off the feature flag, scale up, fail over, block the bad traffic. Give exact steps for a
person to run. Never run commands that change production yourself.

## 3. Diagnose

With the `sre` agent, narrow down the cause using the logs and errors the user shares and the code
(`path:line`). Separate confirmed facts from hypotheses, and test the most likely hypothesis first.

## 4. Close

When the impact is over, confirm recovery with the metrics and summarise: impact, timeline, cause (or best
hypothesis), what fixed it, and follow-ups. Suggest a runbook (`/runbook`) if none existed{{#if postmortem}},
and `/postmortem` to write the blameless review{{/if}}{{#if dev}}, and `/fix-bug` for the permanent fix{{/if}}.
