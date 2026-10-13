# Service level objectives

Reliability targets for the journeys users care about most. `/define-slos` writes and updates this file.

- **SLI** (indicator): good events ÷ valid events, measured where users feel it.
- **SLO** (objective): the target for an SLI over a window, e.g. 99.5% over 28 days.
- **Error budget**: the failures the SLO allows (100% − SLO). When it's spent, reliability work comes first.

| Journey | SLI (good ÷ valid) | Measured at | SLO | Window | Error budget | Alert | Runbook |
|---|---|---|---|---|---|---|---|
<!-- FILL: Example (fictional):
| Send invoice | requests answered 2xx/3xx in under 800 ms ÷ all requests (excl. health checks) | load balancer | 99.5% | 28 days | ~3.4 h | burn rate 14× for 1 h pages; 2× for 6 h tickets | docs/sdlc/operations/runbooks/send-invoice-errors.md |
-->

## Error budget policy

<!-- FILL: what happens when a budget is spent. A good default: feature releases to that service pause
(except fixes) until the budget recovers; the top reliability issue goes to the top of the backlog. -->

## Review

<!-- FILL: how often the SLOs are reviewed and by whom. A good default: monthly, by the team and the product
owner. -->
