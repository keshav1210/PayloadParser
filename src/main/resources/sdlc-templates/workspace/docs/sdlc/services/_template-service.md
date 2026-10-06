# {{#if serviceFolder}}{{serviceFolder}}{{/if}}{{#unless serviceFolder}}<service folder>{{/unless}}

Folder: {{#if serviceFolder}}`{{serviceFolder}}/`{{/if}}{{#unless serviceFolder}}`<folder>/`{{/unless}} · Repository: {{#if serviceRepo}}{{serviceRepo}}{{/if}}{{#unless serviceRepo}}<!-- FILL: git URL -->{{/unless}} · Owner: <!-- FILL: team or person -->

## Purpose

{{#if servicePurpose}}
{{servicePurpose}}
{{/if}}
{{#unless servicePurpose}}
<!-- FILL: what this service is responsible for, in 1-2 sentences, and what it is NOT responsible for. -->
{{/unless}}

## Tech stack

{{#if serviceStack}}
{{serviceStack}}
{{/if}}
{{#unless serviceStack}}
<!-- FILL: language, framework and versions, database, messaging. /sdlc-init fills this from the build files. -->
{{/unless}}

## Build, run and test

<!-- FILL: the exact commands, run inside the service folder. Example:
- Run locally: ./mvnw spring-boot:run
- All tests: ./mvnw test
- One test: ./mvnw test -Dtest=OrderServiceTest
-->

## Structure and where new code goes

<!-- FILL: the main folders and where each kind of new code belongs (endpoint, business logic, data access,
test, config). -->

## APIs it provides

<!-- FILL: endpoints, events or messages other services use, with links to their specs (OpenAPI, AsyncAPI). -->

## What it depends on

<!-- FILL: other services, databases, queues and external systems it calls, and what happens when they're
down. -->

## Data it owns

<!-- FILL: the tables, collections or topics only this service writes to. -->
