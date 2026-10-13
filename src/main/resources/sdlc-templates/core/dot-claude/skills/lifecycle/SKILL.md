---
name: lifecycle
description: Track one feature through the delivery phases (discover, define, design, plan, build, test, release, operate). Finds the evidence for each phase in the docs, git history and test results, checks each phase's exit criteria, records progress in docs/sdlc/lifecycle/, and says which role should do what next with which command. Use to start a new feature, to ask where a feature stands, or to decide what to do next.
argument-hint: "<feature name, REQ ID or brief ID>"
disable-model-invocation: true
---

# Feature lifecycle

Feature: $ARGUMENTS

If nothing was given, list the features in `docs/sdlc/lifecycle/` with their current phase, and ask which one
to look at or what new feature to start.

## 1. Find or start the tracker

Look for `docs/sdlc/lifecycle/<short-name>.md` (match by name or by any ID it mentions). If there is none,
confirm the name with the user and create it from `docs/sdlc/lifecycle/_template-feature.md`.

## 2. Collect the evidence

Read the phases, owners and exit criteria in `docs/sdlc/08-team-and-roles.md`. Then look for evidence of
each phase for this feature:
{{#if product}}- Discover and plan: a brief in `docs/sdlc/product/briefs/`, its rank in
  `docs/sdlc/product/backlog.md`, an iteration in `docs/sdlc/product/iterations/`.
{{/if}}- Define: a requirement with acceptance criteria in `docs/sdlc/02-requirements/`.
{{#if dev}}- Design: an ADR in `docs/sdlc/04-decisions/` or a design section in the requirement.
{{/if}}{{#if ux}}- Design: a flow in `docs/sdlc/design/flows/`.
{{/if}}{{#if security}}- Design: a threat model in `docs/sdlc/security/threat-models/`.
{{/if}}- Build: commits and branches that mention the feature or its IDs (`git log --all --oneline --grep=…`),
  code and tests.
{{#if tester}}- Test: test plans, test cases, runs and bugs in `docs/sdlc/testing/`.
{{/if}}{{#if ops}}- Release and operate: a deployment plan in `docs/sdlc/operations/deployments/`, SLOs and runbooks
  in `docs/sdlc/operations/`.
{{/if}}

## 3. Check the gates

For each phase, decide Done, In progress or Not started from the evidence, and check its "Done when"
criteria. Phases can overlap, but flag any gate that was skipped (for example, building before acceptance
criteria existed{{#if security}}, or shipping a feature that handles personal data without a threat model{{/if}}).
Never mark a phase Done without evidence, and never sign off for a person; record who signed off only when
the user says so.

## 4. Update and advise

Update the tracker (statuses, evidence links, next step, a log line) after showing the user the changes. Reply
with:
- where the feature stands, in one line;
- what's missing for the current phase's gate;
- the next step: which role should act, and the command to run (for example
  {{#if dev}}`/requirements`, `/design`, `/implement`{{/if}}{{#unless dev}}`/research`, `/explain`{{/unless}}{{#if tester}}, `/test-cases`{{/if}}{{#if ops}}, `/deploy-plan`{{/if}});
- risks or skipped gates.
