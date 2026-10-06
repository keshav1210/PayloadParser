---
name: onboarding-guide
description: Write or refresh an onboarding guide for a new team member, covering what the product does, a guided tour of the code, verified setup steps, how to run tests, conventions, key flows to read and good first tasks, saved to docs/sdlc/onboarding.md. Use when someone joins the team or asks how to get started on this project.
argument-hint: "[role, e.g. backend developer, tester, front-end developer]"
disable-model-invocation: true
---

# Onboarding guide

For: $ARGUMENTS (if empty: a new developer).

Use the SDLC docs in `docs/sdlc/` as the starting point and check everything against the code. A guide with
wrong setup steps is worse than none.

## Write `docs/sdlc/onboarding.md` with

1. **The product in five minutes**: what it does, for whom, the main features (from the project overview).
2. **Setup**: step-by-step from a fresh clone to a running app and a passing test run. Take the commands from
   `CLAUDE.md`, the build files and CI. Run the safe ones (build, unit tests) to confirm they work, and say
   which steps you verified.
3. **Code tour**: the main folders and what lives in them, the entry points, and how a typical request or user
   action flows through the code, with `path:line` references.
4. **Five things to read first**: the files that explain the most about how the project works, with one line
   on why each matters.
5. **How we work**: branching, commits, reviews, testing expectations, definition of done (from the release
   process and test strategy docs, if they exist).
6. **Conventions and gotchas**: naming, patterns to follow, things that surprise newcomers, known weak spots.
7. **Good first tasks**: 3-5 small, low-risk tasks found in the code (TODOs, missing tests, small doc gaps),
   each with the files involved.
8. **Glossary and who to ask**: from the project overview.

Tailor the depth to the role given. Keep it to what a person can read in about 30 minutes, and link to the
detailed docs instead of copying them. Finish by listing anything you couldn't verify.
