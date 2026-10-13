# Team and roles

Who is accountable in each phase of delivering a feature, which commands and agents help them, and what must
be true before the next phase starts. `/lifecycle <feature>` uses this file to track a feature and suggest the
next step. Adapt the phases and gates to how your team works; small teams often combine roles.

## People

| Role | Accountable for | People |
|---|---|---|
| Product owner / manager | Value of the product: problem, priorities, success metrics, the backlog | <!-- FILL: names --> |
| Developers | Building it right: design, code, tests, reviews, the Definition of Done | <!-- FILL: names --> |
| Tech lead / architect | Technical direction, cross-module design, decisions (ADRs) | <!-- FILL: names --> |
| Testers / QA | Evidence that it works: test plans, test cases, automation, bug reports | <!-- FILL: names --> |
| UX / UI designer | Users can understand and use it: flows, screen states, copy | <!-- FILL: names --> |
| Security / privacy | Risks are known and handled: threat models, personal data | <!-- FILL: names --> |
| DevOps / SRE | It ships safely and stays healthy: pipeline, deployments, SLOs, incidents | <!-- FILL: names --> |

## Phases

| Phase | Accountable | Commands | Agents | Done when |
|---|---|---|---|---|
| 1. Discover | Product owner | {{#if product}}`/product-brief`, `/prioritize`, {{/if}}`/research` | {{#if product}}`product-manager`, {{/if}}`researcher` | The problem, users and a measurable success metric are agreed; the item is ranked |
| 2. Define | Product owner, with developers and testers | {{#if dev}}`/requirements`{{/if}}{{#unless dev}}`/explain`{{/unless}}{{#if security}}, `/privacy-review`{{/if}} | {{#if product}}`product-manager`{{/if}}{{#unless product}}`researcher`{{/unless}} | Stories have testable Given/When/Then acceptance criteria; open questions have owners |
| 3. Design | Tech lead / architect | {{#if dev}}`/design`{{/if}}{{#unless dev}}`/explain`{{/unless}}{{#if ux}}, `/user-flow`{{/if}}{{#if security}}, `/threat-model`{{/if}} | {{#if dev}}`architect`{{/if}}{{#unless dev}}`researcher`{{/unless}}{{#if ux}}, `ux-reviewer`{{/if}}{{#if security}}, `threat-modeler`{{/if}} | The design is agreed and recorded; significant choices have ADRs; risks have responses |
| 4. Plan | Product owner and the team | {{#if product}}`/plan-iteration`{{/if}}{{#unless product}}`/sdlc-status`{{/unless}} | {{#if product}}`product-manager`{{/if}}{{#unless product}}—{{/unless}} | The work is ready (Definition of Ready), split into tasks and fits the iteration |
| 5. Build | Developers | {{#if dev}}`/implement`, `/write-tests`, `/review-changes`, `/commit`, `/open-pr`{{/if}}{{#unless dev}}`/explain`{{/unless}}{{#if ops}}, `/ci-pipeline`{{/if}} | {{#if dev}}`code-reviewer`, `security-reviewer`, `debugger`, {{/if}}{{#if ops}}`devops-engineer`, {{/if}}`test-runner` | Acceptance criteria pass, code is reviewed, the pipeline is green, the Definition of Done is met |
| 6. Test | Testers / QA | {{#if tester}}`/test-plan`, `/test-cases`, `/automate-tests`, `/run-tests`, `/bug-report`{{/if}}{{#unless tester}}`/explain`{{/unless}}{{#if ux}}, `/ux-review`{{/if}}{{#if accessibility}}, `/accessibility-check`{{/if}}{{#if performance}}, `/performance-check`{{/if}} | {{#if tester}}`test-designer`, `test-automation`, `bug-triager`, {{/if}}{{#if ux}}`ux-reviewer`, {{/if}}`test-runner` | Every criterion is tested; no release-blocking bugs are open |
| 7. Release | {{#if ops}}DevOps, with the product owner{{/if}}{{#unless ops}}Developers, with the product owner{{/unless}} | {{#if tester}}`/regression`, {{/if}}{{#if dev}}`/prepare-release`{{/if}}{{#unless dev}}`/sdlc-status`{{/unless}}{{#if ops}}, `/deploy-plan`{{/if}} | {{#if ops}}`devops-engineer`, {{/if}}`test-runner` | Go/no-go passed, release notes written, rollback ready, people told |
| 8. Operate and learn | {{#if ops}}DevOps / SRE{{/if}}{{#unless ops}}Developers{{/unless}}, and the product owner for the outcome | {{#if ops}}`/define-slos`, `/runbook`, `/incident`, {{/if}}{{#if postmortem}}`/postmortem`, {{/if}}`/sync-docs` | {{#if ops}}`sre`, {{/if}}`researcher` | It meets its SLOs; the success metric was measured against the target; docs are up to date |

## Hand-offs

<!-- FILL: how work moves between people here (ticket statuses, review rules, who signs off each gate).
A good default: each phase's accountable person signs off its "Done when" before the next phase starts; a
"no" sends the feature back with the reason recorded in its lifecycle file in docs/sdlc/lifecycle/. -->
