---
name: deploy-plan
description: Prepare a release for production - go/no-go checklist, what changes (code, config, database, infrastructure), rollout steps and strategy, how to verify, the rollback plan and who to tell - saved in docs/sdlc/operations/deployments/. Use before a production deployment or a risky change.
argument-hint: "<version, branch or change>"
disable-model-invocation: true
---

# Deployment plan

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}
Release: $ARGUMENTS

If nothing was given, ask which version or change to plan, and stop.

## 1. Work out what changes

Compare the release with what's in production (`git log <last release tag>..<release>`, the changelog). List:
code changes by area, configuration and feature flags, database migrations (are they backwards compatible
with the old version still running?), infrastructure changes, new dependencies and external services.
Read `docs/sdlc/operations/ci-cd.md`{{#if dev}} and `docs/sdlc/07-release-process.md`{{/if}}.

## 2. Go / no-go checklist

Check and report each item as yes, no or unknown, with the evidence:
- All tests pass on the exact commit being released{{#if tester}}; the regression results are recorded in
  `docs/sdlc/testing/test-runs/`{{/if}}.
- No open bugs of the severity that blocks a release.
- Migrations are reversible or safe with both versions running.
- Monitoring and alerts cover the new behaviour; the SLOs in `docs/sdlc/operations/slos.md` aren't already
  breached.
- The rollback has been tried or is a known, automated path.
- The people who need to know have been told (support, stakeholders, on-call).

## 3. Write the plan

Create `docs/sdlc/operations/deployments/YYYY-MM-DD-<version>.md` from
`docs/sdlc/operations/deployments/_template-deploy-plan.md`: the rollout strategy (all at once, rolling,
blue-green, canary or behind a feature flag) and why, the steps with who runs each, how to verify after each
step (smoke tests, dashboards, the metrics to watch and for how long), the rollback trigger ("error rate above
2% for 5 minutes") and the rollback steps.

Never deploy or run production commands yourself. Reply with the plan path, the go/no-go result with any
blockers, and the rollback trigger.
