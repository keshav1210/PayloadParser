---
name: prioritize
description: Rank the product backlog with RICE scoring (reach, impact, confidence, effort), show the inputs and the ranking, and update docs/sdlc/product/backlog.md after you agree. Use when deciding what to build next, comparing features or ideas, or refreshing the backlog order.
argument-hint: "[items to compare; default: the whole backlog]"
disable-model-invocation: true
---

# Prioritize the backlog

Items: $ARGUMENTS

## 1. Collect the items

Read `docs/sdlc/product/backlog.md`, the briefs in `docs/sdlc/product/briefs/` and the requirements in
`docs/sdlc/02-requirements/`. If the user named items, compare only those (add new ones to the backlog).

## 2. Score each item with RICE

| Factor | Meaning | Scale |
|---|---|---|
| Reach | People or events affected per time period (say which period, e.g. per quarter) | A number, from real data when possible |
| Impact | Effect on each person reached | 3 massive · 2 high · 1 medium · 0.5 low · 0.25 minimal |
| Confidence | How much the estimates are backed by evidence | 100% high · 80% medium · 50% low |
| Effort | Total person-months across product, design, engineering and testing | A number; 0.5 for well under a month |

Score = Reach × Impact × Confidence ÷ Effort.

- Ask the user for reach and effort numbers you can't find; estimate effort from the code areas involved and
  say it's an estimate. Lower the confidence when an input is a guess.
- Keep the same reach period for every item, or the scores aren't comparable.

## 3. Sanity-check the ranking

RICE is an input, not the decision. Flag items whose rank should be overridden and why: a hard deadline, a
legal or security requirement, a dependency another item needs first, or a commitment to a customer. Never
reorder silently; show the overrides.

## 4. Update after agreement

Show the ranked table and the overrides. After the user agrees, update `docs/sdlc/product/backlog.md`: scores,
order and the date. Keep notes people wrote.

Reply with the top 5, what changed since the last ranking, and inputs that need better data.
