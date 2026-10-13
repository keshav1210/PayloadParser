---
name: product-brief
description: Turn an idea or request into a one-page product brief (problem, users, evidence, success metrics, scope, risks and open questions) saved in docs/sdlc/product/briefs/. Use at the start of a new feature or initiative, before requirements are written.
argument-hint: "<idea, request or problem>"
disable-model-invocation: true
---

# Product brief

Idea: $ARGUMENTS

If nothing was given, ask what the idea or problem is, and stop.

## 1. Understand the context

- Read `docs/sdlc/00-project-overview.md` (product, users, scope, out of scope),
  `docs/sdlc/product/backlog.md` and the index in `docs/sdlc/product/README.md`.
- Check whether a brief or requirement for this already exists in `docs/sdlc/product/briefs/` or
  `docs/sdlc/02-requirements/`. If it does, say so and ask whether to update it instead.
- Look at the parts of the product the idea touches, so the brief describes what users have today.

## 2. Ask the product questions

Use the `product-manager` agent to analyse the idea. Then ask the user up to 5 questions it couldn't answer
from the project: who exactly has the problem, what evidence there is, what success looks like in numbers, any
deadline or constraint, and who decides. Offer likely answers they can confirm. Record anything unanswered as
an assumption; never invent data.

## 3. Write the brief

- Create `docs/sdlc/product/briefs/BRIEF-<next number>-<short-name>.md` from
  `docs/sdlc/product/briefs/_template-brief.md`. Keep it to about one page.
- Success metrics need a baseline, a target, a time frame and a guardrail. If there's no baseline yet, the
  first action item is to measure it.
- "Out of scope" is as important as scope: list what this brief deliberately does not cover.
- Set the status to Draft and add a row to the index in `docs/sdlc/product/README.md`.

## 4. Report

Reply with the file path, the problem statement, the success metric, the first slice, the riskiest
assumption, and the open questions. Suggest the next step: `/prioritize` to rank it against the backlog{{#if dev}},
or `/requirements BRIEF-<number>` to turn it into user stories{{/if}}.
