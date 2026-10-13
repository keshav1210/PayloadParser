# Deployment: version

| Version | Date and time | Owner | Strategy | Decision |
|---|---|---|---|---|
| <!-- FILL --> | <!-- FILL: with time zone --> | <!-- FILL --> | <!-- FILL: all at once, rolling, blue-green, canary, feature flag --> | <!-- FILL: go / no-go --> |

## What changes

<!-- FILL: code by area, configuration and feature flags, database migrations, infrastructure, new
dependencies. -->

## Go / no-go checklist

| Check | Result | Evidence |
|---|---|---|
| Tests pass on the release commit | | |
| No release-blocking bugs open | | |
| Migrations safe with both versions running | | |
| Monitoring and alerts cover the change | | |
| Rollback path known and tried | | |
| Support, stakeholders and on-call told | | |

## Steps

| # | Step | Who | Verify |
|---|---|---|---|

## Rollback

Trigger: <!-- FILL: e.g. "error rate above 2% for 5 minutes" -->

<!-- FILL: the rollback steps. -->

## Result

<!-- FILL: after the deployment: what happened, any issues, and follow-ups. -->
