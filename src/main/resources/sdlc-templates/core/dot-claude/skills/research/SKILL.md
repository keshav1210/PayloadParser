---
name: research
description: Research a technical question using this codebase and the web, then write a report with sources and a confidence level to docs/sdlc/research/. Use when asked to research, compare options or libraries, check best practice, find out how something works, or verify a technical claim.
argument-hint: "<question or topic>"
context: fork
agent: researcher
---

# Research

Question: $ARGUMENTS

If no question was given, reply with one line asking what to research, and stop.

1. Check `docs/sdlc/research/` for an earlier report on the same question. If one exists and is still
   relevant, start from it and say what changed.
2. Restate the question in one sentence and say what a useful answer looks like, such as a recommendation, a
   comparison, or an explanation with an example.
3. Find the project's context: the relevant versions in the build files, and where the topic shows up in the
   code (cite `path:line`).
4. Research it following `.claude/rules/research-and-sources.md`. Confirm important claims in two independent
   sources where possible.
5. Write the report to `docs/sdlc/research/YYYY-MM-DD-<short-topic>.md` using
   `docs/sdlc/research/_template-research.md`, and add a line for it to the index in
   `docs/sdlc/research/README.md`.
6. Reply with: the short answer, the recommendation if there is one, the confidence level, the 3 most
   important sources, and the report's path.
