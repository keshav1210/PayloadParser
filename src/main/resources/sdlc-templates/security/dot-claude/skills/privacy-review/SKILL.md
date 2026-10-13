---
name: privacy-review
description: Review how a feature or the whole product handles personal data - what is collected and why, where it is stored and sent, who can see it, how long it is kept, consent, user rights (access, correction, deletion, export) and privacy threats (LINDDUN) - and keep the data inventory in docs/sdlc/security/data-inventory.md up to date. Use when a feature collects, shares or stores personal data, or before a privacy assessment.
argument-hint: "<feature, REQ ID or \"product\">"
disable-model-invocation: true
---

# Privacy review

Scope: $ARGUMENTS

If nothing was given, ask which feature to review (or "product" for everything), and stop.

## 1. Find the personal data

In the code and config, find every place personal data is collected, stored, logged, sent or derived: forms
and API fields, database tables and columns, files and uploads, logs and analytics events, caches, emails,
third-party SDKs and APIs, backups. Include data that identifies people indirectly (device IDs, IP addresses,
location, combinations of fields). Cite `path:line`.

## 2. Map it

For each item: the data, its purpose, its source, where it's stored, who can access it, where it's sent
(processors and other countries), how long it's kept and how it's deleted. Ask the user for what the code
can't show: legal basis or consent, retention rules, contracts with processors.

## 3. Find the problems

- Data collected without a clear purpose, or kept longer than needed.
- Personal data in logs, URLs, error messages, analytics or test fixtures.
- Missing access control, or too many people with access.
- Users can't see, correct, export or delete their data, or deletion misses copies.
- Privacy threats (LINDDUN): records can be linked or identified, users are unaware, processing isn't
  compliant with the rules that apply.

Report findings ranked by risk with fixes. Don't give legal advice: say which questions need the privacy or
legal team, and name the regulation only when the user says which ones apply.

## 4. Record

Update `docs/sdlc/security/data-inventory.md` after the user agrees. Reply with the findings, the inventory
changes and the questions for the privacy or legal team.
