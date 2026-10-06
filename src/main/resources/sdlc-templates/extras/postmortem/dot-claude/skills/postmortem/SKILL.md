---
name: postmortem
description: Write a blameless incident postmortem with impact, timeline, root cause and contributing factors, what went well and badly, and owned action items, saved in docs/sdlc/incidents/. Use after an outage, incident, data problem or bad release.
argument-hint: "<what happened, roughly when>"
disable-model-invocation: true
---

# Postmortem

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}Incident: $ARGUMENTS

If nothing was given, ask what happened and when, and stop.

## 1. Collect the facts

Ask the user for what you can't find: when it started, was detected and was resolved (with time zone), who and
what was affected, how it was detected and how it was fixed. From the repository, gather the changes deployed
around that time (`git log --since=… --until=…`), the code involved, and any related bugs or tests. Use logs,
alerts and chat excerpts the user shares, with personal data and secrets removed.

## 2. Find the causes

Work back from the failure to why it was possible: the trigger, the root cause, and the contributing factors
(missing test, missing alert, unclear runbook, risky deploy step). Ask "why" until you reach something the team
can change. Confirm the technical cause in the code where you can, with `path:line`.

## 3. Write it

Create `docs/sdlc/incidents/YYYY-MM-DD-<short-name>.md` from `docs/sdlc/incidents/_template-postmortem.md`.
Keep the language blameless: describe what systems and processes allowed the problem, not who made a mistake.

## 4. Action items

Each action item: what to do · type (prevent / detect sooner / reduce impact / respond faster) · owner (ask the
user) · priority · due date. Prefer a few concrete actions over a long wish list. Where an action is a code or
test change, suggest the command to start it (e.g. `/fix-bug`, `/write-tests`).

Reply with the file path, a 3-line summary, and the action items.
