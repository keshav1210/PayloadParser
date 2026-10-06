# {{#if projectName}}{{projectName}}: overview{{/if}}{{#unless projectName}}Project overview{{/unless}}

Loaded in every Claude Code session, so keep each section short. Replace the `<!-- FILL … -->` comments with
your own words; leave a section as it is if you don't know yet.

## What it is

{{#if projectDescription}}
{{projectDescription}}
{{/if}}
{{#unless projectDescription}}
<!-- FILL: 2-3 sentences: what the product does and the problem it solves. Example (fictional): "A web app where
small shops create and send GST invoices. It replaces paper bill books." -->
{{/unless}}

## Who uses it

<!-- FILL: the main users and what they need. Example (fictional): "Shop owners creating invoices on
their phone; accountants exporting monthly reports." -->

## Main features

<!-- FILL: the 3-8 most important features, one per line. -->

## Out of scope

<!-- FILL: what this project deliberately doesn't do, so Claude doesn't build it. Example (fictional): "No payment
collection; no inventory management." -->

## Tech stack

{{#if projectStack}}
{{projectStack}}
{{/if}}
{{#unless projectStack}}
<!-- FILL: languages, frameworks, database, hosting, with versions. Example (fictional): "Java 17, Spring Boot 3.5,
PostgreSQL 16, React 18, deployed on AWS". /sdlc-init can fill this from the build files. -->
{{/unless}}

## Quality requirements

<!-- FILL: the non-functional requirements that matter, with numbers where possible. Example:
- Performance: invoice list loads in under 2 s on 4G
- Security: invoices visible only to their shop
- Availability: 99.5% monthly
- Accessibility: keyboard usable, WCAG 2.1 AA where practical
- Browsers / devices: latest Chrome, Edge, Firefox, Safari; mobile width 360 px and up
-->

## Conventions

<!-- FILL: naming and workflow conventions. Example:
- IDs: requirements REQ-001, user stories US-001, test cases TC-001, bugs BUG-001, decisions ADR-0001
- Branches: feature/US-012-short-name, fix/BUG-034-short-name
- Commits: Conventional Commits (feat:, fix:, docs:, test:, refactor:)
-->

## Glossary

<!-- FILL: project or business terms Claude should understand, as "Term: meaning", one per line. -->

## Contacts

<!-- FILL: optional. Who owns what (product, backend, QA), so Claude can suggest who to ask. -->
