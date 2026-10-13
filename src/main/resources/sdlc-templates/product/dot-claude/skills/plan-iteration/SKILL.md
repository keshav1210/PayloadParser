---
name: plan-iteration
description: Plan a sprint or iteration from the top of the backlog. Sets one goal, picks items that fit the team's capacity, splits them into tasks, flags dependencies and risks, and checks each item against the Definition of Done. Saved in docs/sdlc/product/iterations/. Use at sprint planning or when deciding what fits in the next few weeks.
argument-hint: "[goal or length, e.g. \"2 weeks\"]"
disable-model-invocation: true
---

# Plan an iteration

Input: $ARGUMENTS

## 1. Gather the inputs

- The ranked backlog in `docs/sdlc/product/backlog.md` and the stories in `docs/sdlc/02-requirements/`.
- The Definition of Done in `docs/sdlc/product/definition-of-done.md`.
- The last iteration in `docs/sdlc/product/iterations/` (what was finished and what carried over).
- Ask the user for the length, the people available and known absences. Use what was actually finished last
  time as the guide to capacity, not wishes.

## 2. Set one goal

Propose a single iteration goal: one sentence on the outcome, not a list of tickets. Confirm it with the user.

## 3. Select and split

- Pick items from the top of the backlog that serve the goal, until the capacity is used, leaving about 20% for
  bugs and unplanned work.
- An item is ready only if it has testable acceptance criteria. List items that aren't ready and what they
  need{{#if dev}} (`/requirements`){{/if}}.
- Split each item into tasks of at most a day or two{{#if dev}}: code, tests, docs{{/if}}{{#if tester}}, test
  cases and automation{{/if}}{{#if ux}}, design{{/if}}{{#if ops}}, deployment and monitoring{{/if}}. Look at the code
  areas involved to make the tasks concrete.
- Mark dependencies (between tasks, on other teams, on decisions) and the riskiest item. Put risky work early.

## 4. Write the plan

Create `docs/sdlc/product/iterations/ITER-<next number>.md` from
`docs/sdlc/product/iterations/_template-iteration.md`.

Reply with the goal, the selected items with estimates, what didn't fit, items that aren't ready, and the top
risks.
