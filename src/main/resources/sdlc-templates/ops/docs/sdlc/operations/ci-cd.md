# CI/CD and environments

How a change gets from a commit to production, and how to undo it. `/ci-pipeline` keeps this up to date.

## Pipeline

<!-- FILL: the CI provider, where the config lives, and the stages in order. Example (fictional):
GitHub Actions, .github/workflows/ci.yml: install → build → unit tests → lint → dependency scan → Docker
image → deploy to staging → smoke tests → manual approval → deploy to production. -->

## Environments

| Environment | URL | Deployed when | Data | Who can deploy |
|---|---|---|---|---|
<!-- FILL: Example (fictional): | staging | staging.invoice.example | every merge to main | test data | pipeline | -->

## How to deploy

<!-- FILL: the exact steps or the pipeline to run, and the approvals needed. -->

## How to roll back

<!-- FILL: the exact steps. A good default: redeploy the previous artifact through the same pipeline; switch
off the feature flag for flag-guarded changes; database migrations are backwards compatible so the previous
version still works. -->

## Secrets and configuration

<!-- FILL: where secrets and per-environment config live (never in the repository) and who manages them. -->

## Delivery metrics

<!-- FILL: optional. DORA's software delivery metrics, if you track them: change lead time, deployment
frequency, failed deployment recovery time, change fail rate and deployment rework rate. -->
