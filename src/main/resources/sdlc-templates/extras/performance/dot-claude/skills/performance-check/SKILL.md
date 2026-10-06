---
name: performance-check
description: Find performance problems in an endpoint, page, job, function or the current changes (slow queries, N+1, unbounded loads, chatty calls, blocking work, heavy pages, memory growth), ranked by impact with evidence and fixes. Use when something is slow or before shipping performance-sensitive code.
argument-hint: "<endpoint, page, file, feature, or 'changes'>"
---

# Performance check

Target: $ARGUMENTS (if `changes` or empty: the uncommitted changes and the current branch).

Report first; don't change code unless the user asks.

1. **Know the goal**: read the quality requirements in `docs/sdlc/00-project-overview.md` (e.g. "p95 under
   500 ms"). If there are none, say what you'll assume.
2. **Measure if you can**: look for existing benchmarks, load tests, profiling, metrics or slow-query logs the
   user can share. If the code can run locally, time the target (a quick script, the framework's timing, or the
   test suite) before and after any change you propose.
3. **Analyse**: hand the code paths to the `performance-analyst` agent. Ask the `researcher` agent for limits
   or behaviour of a library when a finding depends on them.
4. **Report**, most impact first:
   - finding · `file:line` · evidence (what makes it slow, with numbers where possible) · expected gain ·
     effort · the fix;
   - quick wins vs larger changes;
   - how to verify each fix (a benchmark, a test with timing, a k6 or Lighthouse run).

Don't recommend caching, parallelism or micro-optimisation without evidence that the code is actually on the
slow path.
