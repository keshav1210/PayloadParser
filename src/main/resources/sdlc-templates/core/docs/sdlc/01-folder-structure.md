{{#if workspace}}
# Workspace and services

Loaded in every Claude Code session. Keep it under about 120 lines; details for each service live in
`docs/sdlc/services/`. Run `/analyze-structure` or `/sdlc-init` to fill or refresh it.

## Services

{{#if servicesTable}}
| Folder | Purpose | Stack | Repository |
|---|---|---|---|
{{servicesTable}}
{{/if}}
{{#unless servicesTable}}
<!-- FILL: one row per service. Example (fictional):
| Folder | Purpose | Stack | Repository |
|---|---|---|---|
| `order-service/` | Orders and checkout | Java 17, Spring Boot | github.com/acme/order-service |
-->
{{/unless}}

## How the services talk to each other

<!-- FILL: who calls whom, synchronously (REST, gRPC) or asynchronously (events, queues), and the main flows
that cross services. Example (fictional): "web-app → order-service (REST) → payment-service (REST);
order-service publishes OrderPlaced to Kafka; notification-service consumes it." -->

## Shared conventions

<!-- FILL: rules every service follows: API style and versioning, error format, correlation IDs for logs and
tracing, authentication between services, event and topic naming. -->

## Workspace layout

{{#if folderTree}}
```text
{{folderTree}}
```
{{/if}}
{{#unless folderTree}}
<!-- FILL: the top-level folders. /analyze-structure can write it. -->
{{/unless}}
{{/if}}
{{#unless workspace}}
# Folder structure

Loaded in every Claude Code session. Keep it under about 120 lines. Run `/analyze-structure` to fill or
refresh it from the code; add your own notes in plain text and Claude will keep them.

## Architecture in one paragraph

<!-- FILL: how the code is organised. Example (fictional): "Spring Boot API with controller → service →
repository layers; React front end in web/, one folder per feature." -->

## Tree

{{#if folderTree}}
```text
{{folderTree}}
```
{{/if}}
{{#unless folderTree}}
<!-- FILL: the main folders, up to 3 levels deep, with generated folders left out. Paste the output of `tree`
or let /analyze-structure write it. -->
{{/unless}}

## What lives where

{{#if folderTable}}
| Folder | What lives here |
|---|---|
{{folderTable}}
{{/if}}
{{#unless folderTable}}
<!-- FILL: one row per important folder.
| Folder | What lives here | Notes |
|---|---|---|
| src/main/java/.../invoice | Invoice API: controller, service, repository | One package per feature |
| src/test/java | JUnit tests | Mirrors the main package layout |
-->
{{/unless}}

## Entry points

<!-- FILL: where the program starts and where requests come in. Example (fictional): "InvoiceApplication.java
(main); web/src/main.tsx (front end)". -->

## Where new code goes

<!-- FILL: where to put each kind of new code, based on existing examples. Example (fictional):
| To add | Put it in | Follow this example |
|---|---|---|
| A REST endpoint | the feature package | invoice/InvoiceController.java |
| Business logic | the feature package | invoice/InvoiceService.java |
| A unit test | src/test/java, same package | invoice/InvoiceServiceTest.java |
| A front-end page | web/src/features/<name>/ | web/src/features/invoices/ |
-->

## Don't edit by hand

<!-- FILL: generated, vendored or copied folders that must not be edited directly. Example: "target/ (build
output), web/dist/ (built front end), generated/ (code generated from the API spec)". -->
{{/unless}}
