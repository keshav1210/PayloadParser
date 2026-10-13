---
name: define-slos
description: Define service level indicators, objectives and error budgets for the product's critical user journeys, with how each is measured and the alert that protects it, saved in docs/sdlc/operations/slos.md. Use when setting reliability targets, designing alerts, or deciding whether reliability work should come before features.
argument-hint: "[service or user journey]"
disable-model-invocation: true
---

# Define SLOs

Scope: $ARGUMENTS (default: the whole product)

## 1. Find the critical user journeys

Read `docs/sdlc/00-project-overview.md` and the existing `docs/sdlc/operations/slos.md` and
`docs/sdlc/operations/observability.md`. With the `sre` agent, list the 3-5 journeys users care about most
(sign in, search, checkout, a nightly export) and confirm them with the user.

## 2. Choose indicators

For each journey, pick one or two SLIs that reflect what users feel, defined as good events ÷ valid events:
- Request-driven: availability (non-error responses) and latency (share of requests faster than a threshold).
- Pipelines and jobs: freshness (data newer than N minutes) and success rate.
- Storage: durability.

Say exactly where each is measured (load balancer, API gateway, application metrics, client side) and which
requests are excluded (health checks, bots, client errors).

## 3. Set objectives

Propose a target and a window for each ("99.5% over 28 days"), with the error budget in plain numbers ("about
3.4 hours of failed requests per 28 days"). Base targets on what users need and current performance; start
loose and tighten. Never propose 100%. Ask the user to confirm each target.

## 4. Protect them

For each SLO, propose an alert on the error budget burn rate (a fast burn that pages and a slow burn that
opens a ticket) and the runbook it links to. Agree an error budget policy: what happens when the budget is
spent (for example, pause feature releases for that service until it recovers).

## 5. Record

Update `docs/sdlc/operations/slos.md` after the user agrees. Reply with the SLO table, the alerts to create, and
missing measurements that need instrumentation first.
