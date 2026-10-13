---
name: ci-pipeline
description: Create or review the CI/CD pipeline - build, tests, static checks, dependency scanning, packaging and deployment stages - using the CI provider the project already has, with pinned versions, caching, least-privilege secrets and an approval before production. Use when setting up CI, when builds are slow or flaky, or to review pipeline changes.
argument-hint: "[create | review | fix <failing job>]"
disable-model-invocation: true
---

# CI/CD pipeline

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}
Task: $ARGUMENTS (default: review)

## 1. Learn the current setup

Use the `devops-engineer` agent. Find the CI config (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`,
`azure-pipelines.yml`, `bitbucket-pipelines.yml`, `.circleci/`), the build files, Dockerfiles and deploy
scripts, and read `docs/sdlc/operations/ci-cd.md`. Find the exact build and test commands in the build files
and `CLAUDE.md`.

## 2. Do the task

- **review**: check the stages in order (install with lock file, build, unit tests, static checks, dependency
  and secret scanning, package once, deploy the same artifact per environment, smoke test), caching, pinned
  versions, secrets handling, permissions, branch protection assumptions, and the manual approval before
  production. Report findings ranked by risk, with `path:line` and the fix.
- **create**: write the pipeline for the provider the project uses (ask if there is none). Start with build,
  tests and checks on every pull request; add deployment stages only when the user asks, with an approval step
  for production.
- **fix**: reproduce the failing step locally with the same command, find the cause (code, test, environment,
  cache, flaky test, expired secret) and fix it. Don't hide failures by skipping tests or adding retries.

Validate the config syntax where a tool exists (for example `actionlint` for GitHub Actions) and run the build
and test commands locally to prove they pass.

## 3. Record it

Update `docs/sdlc/operations/ci-cd.md` (stages, environments, how to deploy and roll back) after the user
agrees. List anything a person must set up in the CI provider: secrets, environments, approvals, branch rules.
