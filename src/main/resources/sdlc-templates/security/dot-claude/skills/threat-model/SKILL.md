---
name: threat-model
description: Threat-model a feature, change or system with the four-question method - diagram the data flows and trust boundaries, find threats with STRIDE (and LINDDUN for personal data), rate them, agree responses and turn mitigations into testable security requirements - saved in docs/sdlc/security/threat-models/. Use at design time for anything touching authentication, payments, personal data, uploads, integrations or new endpoints.
argument-hint: "<feature, REQ ID, change or system>"
disable-model-invocation: true
---

# Threat model

Scope: $ARGUMENTS

If nothing was given, ask what to threat-model, and stop.

## 1. Gather the context

Read the requirement in `docs/sdlc/02-requirements/`{{#if dev}}, the design and `docs/sdlc/03-architecture.md`,
the decisions in `docs/sdlc/04-decisions/`{{/if}}, `.claude/rules/security.md`, the data inventory in
`docs/sdlc/security/data-inventory.md` and earlier models in `docs/sdlc/security/threat-models/`. Find the
code for the components involved: entry points, authentication and authorisation checks, data stores, calls
to other systems.

## 2. Model it

Use the `threat-modeler` agent to work through the four questions: what are we working on, what can go wrong,
what are we going to do about it, did we do a good job. Ask the user about anything that changes the risk:
who the users and admins are, what data is involved, which parts face the internet, existing controls outside
the code (WAF, gateway, network rules).

## 3. Agree the responses

Show the threats ranked by risk with the proposed response for each. The user decides which risks to accept;
an accepted risk needs a reason and an owner. Don't downgrade a threat without saying why.

## 4. Write it

Create `docs/sdlc/security/threat-models/TM-<short-name>.md` from
`docs/sdlc/security/threat-models/_template-threat-model.md`. Add the security requirements to the related
requirement document as acceptance criteria after the user agrees, so they get built and tested like any
other criterion.

Reply with the path, the top risks and their responses, and the new security requirements{{#if tester}}; suggest
`/test-cases` to turn them into test cases{{/if}}.
