# Claude Code SDLC Kit: quick start

Kit version 0.1 · Packs: Core{{#if dev}}, Developer{{/if}}{{#if tester}}, Tester{{/if}}{{#if spring-boot}}, Spring Boot{{/if}}{{#if react}}, React{{/if}}{{#if node-api}}, Node API{{/if}}{{#if plugin}} · plugin edition{{/if}}{{#if workspace}} · workspace edition{{/if}}

This kit gives Claude Code project knowledge, working rules, commands and a research specialist. It works as
soon as it's unzipped; filling in the docs makes Claude's answers more accurate.

{{#if existingClaudeMd}}
> Your project already had a `CLAUDE.md`, so the kit's instructions are in `CLAUDE.sdlc.md`. Add this line
> to your own `CLAUDE.md` so Claude loads them: `@CLAUDE.sdlc.md`

{{/if}}
## First 10 minutes

{{#if plugin}}
1. You installed the `sdlc-kit` plugin and ran `/setup`, which copied these project files. Use a new git
   branch so you can review every file before committing.
{{/if}}
{{#if workspace}}
1. Unzip the kit into your workspace folder and clone your services into it (or run the clone script; see
   `WORKSPACE-README.md`). Always open Claude Code in the workspace folder.
{{/if}}
{{#unless plugin}}
{{#unless workspace}}
1. Unzip the kit into your project's root folder (the folder with your build file). Use a new git branch so
   you can review every file before committing.
{{/unless}}
{{/unless}}
2. Open Claude Code in that folder and run `/sdlc-init`.
   Claude reads your project, fills in what it can work out (marked as inferred), and asks you a few
   questions it can't answer from the code.
3. Open `docs/sdlc/00-project-overview.md` and `docs/sdlc/01-folder-structure.md`. Check the inferred parts,
   fix anything wrong, and delete the `<!-- INFERRED … -->` line once a section is right.
4. Commit the kit so everyone on the team gets the same setup.

## Commands

| Command | Use it to |
|---|---|
| `/sdlc-init [area]` | Fill empty doc sections from the code and ask about the rest. Run again any time |
| `/sdlc-status` | See which docs are filled, inferred or empty, and the next things to do |
| `/analyze-structure` | Map your folders and record where new code should go |
| `/research <question>` | Get an answer researched in your code and on the web, with sources, saved to `docs/sdlc/research/` |
{{#if workspace}}
| `/add-service <git URL>` | Clone and document another service, and add it to the clone list |
{{/if}}
| `/explain <area>` | Understand how part of the code works, with file:line references |
| `/sync-docs [since]` | Update the docs after code changes so they stay accurate |
{{#if dev}}
| `/requirements <feature>` | Turn an idea into user stories with testable Given/When/Then acceptance criteria |
| `/design <REQ or change>` | Plan the change before coding; important choices are saved as ADRs |
| `/implement <story>` | Build it with tests; Claude must show the test run as proof |
| `/write-tests <target>` | Add missing tests to existing code, in your project's test style |
| `/refactor <target>` | Clean up code without changing behaviour; tests run before and after each step |
| `/fix-bug <bug>` | Reproduce with a failing test, find the root cause, fix, prove |
| `/review-changes [target]` | Review your changes, a branch or a PR; findings ranked with file and line |
| `/commit` | Safety check (secrets, debug code), a good message, commit after you confirm |
| `/open-pr` | Pull request description with how it was tested; created after you confirm |
| `/check-dependencies` | Outdated and vulnerable libraries; upgrades one at a time only when you ask |
| `/prepare-release [version]` | Changelog entry and plain-language release notes from the commits |
{{/if}}
{{#if tester}}
| `/test-plan <REQ>` | Risk-based test plan: scope, risks, approach, environment, entry and exit criteria |
| `/test-cases <story>` | Test cases from the acceptance criteria (boundaries, negatives, permissions), linked in the traceability matrix |
| `/automate-tests <cases>` | Automated tests in your framework, named after the test case IDs, run and recorded |
| `/run-tests [suite]` | Run tests; every failure classified as product bug, test problem, environment or flaky |
| `/bug-report <problem>` | Reproducible bug report with evidence and severity, ready for your tracker |
| `/regression [changes]` | What a change could break, the tests to run, and a manual checklist |
{{/if}}
{{#if database}}
| `/db-migration <change>` | A safe, reversible database migration, checked for data loss and long locks |
{{/if}}
{{#if performance}}
| `/performance-check <target>` | What makes an endpoint, job or page slow, ranked by impact, with fixes |
{{/if}}
{{#if accessibility}}
| `/accessibility-check <target>` | WCAG 2.2 AA review of pages or components, with fixes |
{{/if}}
{{#if api-docs}}
| `/document-api [scope]` | OpenAPI documentation written from the actual code |
{{/if}}
{{#if onboarding}}
| `/onboarding-guide [role]` | A getting-started guide for new team members, with verified setup steps |
{{/if}}
{{#if postmortem}}
| `/postmortem <incident>` | A blameless incident report with timeline, causes and owned action items |
{{/if}}
{{#if tech-debt}}
| `/tech-debt-scan [area]` | The riskiest technical debt, ranked, in `docs/sdlc/tech-debt.md` |
{{/if}}

You can also ask in plain words, for example "use the researcher agent to compare Redis and Caffeine for caching".

## Filling in the docs

Every doc section has a hint and an example in a comment:

```markdown
## Who uses it
<!-- FILL: 1-3 lines. Example: "Shop owners who create GST invoices on their phone." -->
```

Replace the comment with your text. You don't have to fill everything: empty sections are fine, and Claude will
work them out from the code or ask you when they matter.

| You see | It means |
|---|---|
| `<!-- FILL: … -->` | Empty. Claude infers it or asks when needed |
| `<!-- INFERRED: … -->` | Claude wrote it from the code. Check it, then delete the marker |
| Plain text | Confirmed by a person. Claude never overwrites it without asking |

## What's inside

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Loaded every session: how to work in this project, build commands, project rules |
| `.claude/settings.json` | Safety: Claude can't read or edit `.env` files, keys or `secrets/`, and asks before `git push` |
| `.claude/rules/` | Standards Claude follows automatically: using the docs, research with sources, security{{#if dev}}, coding standards{{/if}}{{#if tester}}, testing standards and your test frameworks{{/if}} |
{{#if plugin}}
| `sdlc-kit` plugin | The commands and agents, installed once for all your projects |
{{/if}}
{{#unless plugin}}
| `.claude/skills/` | The commands above |
{{/unless}}
| {{#if plugin}}Plugin agents{{/if}}{{#unless plugin}}`.claude/agents/`{{/unless}} | Specialists Claude hands work to: `researcher`, `test-runner`{{#if dev}}, `architect`, `debugger`, `code-reviewer` (remembers your project's conventions in `.claude/agent-memory/`; commit it), `security-reviewer`{{/if}}{{#if tester}}, `test-designer` (remembers domain rules), `test-automation`, `bug-triager`{{/if}}{{#if database}}, `db-reviewer`{{/if}}{{#if performance}}, `performance-analyst`{{/if}} |
| `docs/sdlc/` | Your project docs |

## Customising

- Edit any file; it's yours.{{#if plugin}} To change a command, edit it in the plugin folder
  (`~/.claude/skills/sdlc-kit/skills/<name>/SKILL.md`) and run `/reload-plugins`.{{/if}}{{#unless plugin}} Commands are plain Markdown in `.claude/skills/<name>/SKILL.md`.{{/unless}}
- Personal settings that shouldn't be shared go in `.claude/settings.local.json` and `CLAUDE.local.md`
  (add both to `.gitignore`).
- To check your instruction files for conflicts or outdated rules, run `/doctor prompt-audit`.
