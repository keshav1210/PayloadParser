---
name: ux-review
description: Usability review of a page, screen or flow - a heuristic evaluation against Nielsen's 10 heuristics, missing states (empty, loading, error), unclear copy and inconsistencies - with issues ranked by severity and concrete fixes. Use when asked to review UX or UI, check a flow, or before releasing UI changes.
argument-hint: "<page, screen, flow, component or REQ ID>"
context: fork
agent: ux-reviewer
---

# UX review

Target: $ARGUMENTS

If no target was given, ask which page, screen or flow to review, and stop.

1. Find the code for the target: routes, pages, components, templates, messages and styles. If the target is a
   requirement ID, review the screens its stories touch.
2. Read the related requirement in `docs/sdlc/02-requirements/`, the flow in `docs/sdlc/design/flows/` if
   there is one, and `docs/sdlc/design/design-guidelines.md`.
3. Walk through the flow as each type of user, checking every screen state and the 10 heuristics.
4. Report the findings ranked by severity (4 blocks users → 1 cosmetic), each with where it is, the problem
   from the user's point of view and a concrete fix. Give copy changes as "before → after".

Don't change any files. End with the 3 changes that would help users most{{#if accessibility}}, and suggest
`/accessibility-check` for a full WCAG 2.2 AA check{{/if}}.
