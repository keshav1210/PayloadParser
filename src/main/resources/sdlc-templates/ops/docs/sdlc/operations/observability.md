# Observability

Where to look when something goes wrong. `/runbook`, `/incident` and `/define-slos` read this file.

## Logs

<!-- FILL: where logs go, how to search them, and the fields every log line carries. A good default:
structured JSON with timestamp, level, service, request or trace ID; never secrets or personal data. -->

## Metrics and dashboards

<!-- FILL: the metrics tool, the main dashboards (links) and the metrics that matter. A good default: for
each service the four golden signals - latency, traffic, errors and saturation. -->

## Tracing

<!-- FILL: the tracing tool, if any, and how a request ID gets from the logs to a trace. -->

## Alerts and on-call

<!-- FILL: the alerting tool, who is on call and how to reach them, and where alerts are routed. A good
default: alerts fire on symptoms users feel (SLO burn), each links to a runbook in
docs/sdlc/operations/runbooks/. -->

## Production access

<!-- FILL: how people get access to production, and who approves it. Never put credentials here. -->
