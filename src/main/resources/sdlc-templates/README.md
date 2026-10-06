# SDLC kit templates (source)

Private source for the Claude Code SDLC Generator. Not served to the browser.

## Name mapping

Claude Code automatically loads `CLAUDE.md` files and `.claude/` folders it finds in a repository, so the
sources use different names here and are renamed when a kit is generated:

| Source | Generated as |
|---|---|
| `CLAUDE.md.tmpl` | `CLAUDE.md` |
| `dot-claude/` | `.claude/` |

Everything else keeps its path.

## Markers used inside the docs

| Marker | Meaning |
|---|---|
| `<!-- FILL: hint -->` | Not filled in yet |
| `<!-- INFERRED: source -->` | Written by Claude from evidence, not yet confirmed by a person |
| Plain text | Written or confirmed by a person |

## Packs

Each pack folder mirrors the generated output. A kit is the core pack plus the packs the user picks; a path may
exist in only one pack.

| Folder | Pack | Contents |
|---|---|---|
| `core/` | Always | CLAUDE.md, quick start, settings, 3 rules, /sdlc-init, /sdlc-status, /analyze-structure, /research, /explain, /sync-docs, researcher and test-runner agents, docs 00, 01, 02-requirements, research/ |
| `dev/` | Developer | coding-standards rule, /requirements, /design, /implement, /write-tests, /refactor, /fix-bug, /review-changes, /commit, /open-pr, /check-dependencies, /prepare-release, architect, debugger, code-reviewer, security-reviewer, docs 03-07 |
| `profiles/<name>/` | Stack profile | path-scoped rule: spring-boot, react, node-api |
| `plugin/` | Plugin edition only | /setup skill and the plugin README; added automatically for ?format=plugin |
| `tester/` | Tester | testing-standards rule, generic test-setup rule, /test-plan, /test-cases, /automate-tests, /run-tests, /bug-report, /regression, test-designer, test-automation, bug-triager, docs/sdlc/testing/ |
| `testing-frameworks/<name>/` | One per framework | path-scoped rule in .claude/rules/testing/: junit5, testng, selenium-java, rest-assured, espresso, jest, vitest, playwright, cypress, pytest, xunit, nunit, go-test, rspec, phpunit, xctest, postman, k6 |
| `extras/<name>/` | Optional extras (off by default) | planned: database, performance, accessibility, API docs, onboarding, postmortem, tech-debt |

## Template language

Rendered by `com.payload.parser.sdlc.SdlcRenderer`. `{{#if flag}} … {{/if}}` keeps the text only when the flag is on;
`{{#unless flag}} … {{/unless}}` is the opposite; `{{name}}` inserts a value (projectName, projectDescription,
projectStack, folderTree, folderTable, testFrameworks). A value that is set is also a flag. Other flags:
`existingClaudeMd`, `plugin` (plugin edition). Pack labels and detection hints live in `packs.json`; every pack folder needs an entry there. Flags are pack folder names: `dev`, `tester`, `spring-boot`, `junit5`, … A block whose tags sit on their own lines is removed together with those lines, so table rows can be
switched on and off.

## Rules for template authors

- Files with YAML frontmatter must start with `---` on the first line. The generator's attribution header
  goes after the frontmatter, never before it.
- Keep `SKILL.md` under 500 lines and `CLAUDE.md` under 200 lines. Keep rule files without `paths:` short:
  they load in every session.
- Skill `description` (plus `when_to_use`) must stay under 1,536 characters; put the main use case first.
- Skill names must not clash with Claude Code built-ins (/review, /release-notes, /code-review, /init, /status …).
- Quote or reword descriptions that contain ": ": an unquoted colon followed by a space breaks the YAML and
  Claude Code silently ignores the file.
- Don't use `` !`command` `` injection where the command can exit non-zero in a normal project: a failed
  command aborts the whole skill.
