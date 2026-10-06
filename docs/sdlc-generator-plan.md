# Claude Code SDLC Generator — Plan

Status: built (2026-10-04); not yet committed or deployed. Kit not yet run inside Claude Code by a user. Working name: **Claude Code SDLC Generator**, URL `/claude-code-sdlc-generator`.

## 1. Goal

A tool on jsonxmleditor.com that generates a ready-to-use Claude Code setup for a project, for **Developers** and/or **Testers**: commands (skills), agents, rules and fill-in SDLC documents.

- Works **without editing**: every file has sensible defaults; empty `<!-- FILL: … -->` slots tell Claude to infer from the code (and label it "inferred") or ask, never invent.
- Works **better with editing**: users type short descriptions into ready sections.
- **The generation logic is private**: templates and rendering live on the server; the browser only sends settings and receives the finished files.

## 2. Generated output (ZIP for the project root)

```
your-project/
├── CLAUDE.md                          short entry point (<200 lines), imports overview + folder structure
├── AGENTS.md                          optional, for teams also using other AI tools (v2)
├── SDLC-QUICKSTART.md                 for humans: run /sdlc-init first; kit version; /doctor prompt-audit tip
├── LICENSE-SDLC-KIT.md                usage terms for the generated files
├── .claude/
│   ├── settings.json                  permission preset + guardrail hooks (opt-out)
│   ├── rules/
│   │   ├── how-to-use-sdlc-docs.md    FILL = unknown → infer + label, or ask
│   │   ├── research-and-sources.md    source ranking, version-matched docs, dates, quotes, confidence
│   │   ├── coding-standards.md        paths: src/**            [Developer]
│   │   ├── security.md                OWASP basics
│   │   ├── testing-standards.md       paths: test/**, tests/** [Tester]
│   │   └── stack/<profile>.md         e.g. spring-boot.md, react.md (profile packs)
│   ├── skills/
│   │   ├── sdlc-init/                 analyse repo, fill blanks, ask questions, write answers back
│   │   ├── analyze-structure/         context: fork; maps folders → purpose
│   │   ├── research/                  context: fork; researcher agent; report with sources
│   │   ├── sdlc-status/               !`count of FILL slots` → what is missing, phase per feature
│   │   ├── sdlc-update/               refresh structure/architecture docs after merges (v2)
│   │   ├── requirements/              acceptance criteria as Given/When/Then   [Developer]
│   │   ├── design/                    writes ADRs
│   │   ├── implement/                 user-only; ends with build + tests + done checklist
│   │   ├── review/                    !`git diff` injected
│   │   ├── fix-bug/                   ends with reproduction + passing test
│   │   ├── release-notes/             user-only
│   │   ├── test-plan/                                                         [Tester]
│   │   ├── test-cases/                one TC per Given/When/Then + boundary/negative cases
│   │   ├── automate-tests/            chosen framework
│   │   ├── run-tests/                 !`test command output` injected
│   │   ├── bug-report/
│   │   └── regression/                !`changed files` injected
│   └── agents/
│       ├── researcher.md              Read/Grep/Glob/WebSearch/WebFetch, permissionMode: plan
│       ├── architect.md               [Developer]
│       ├── code-reviewer.md           read-only, memory: project, use proactively
│       ├── security-reviewer.md       read-only
│       ├── test-designer.md           memory: project          [Tester]
│       ├── test-automation.md
│       └── bug-triager.md
└── docs/sdlc/
    ├── 00-project-overview.md   01-folder-structure.md   02-requirements/   03-architecture.md (arc42-lite)
    ├── 04-decisions/ (ADR template)   05-environments-and-setup.md   06-api-and-data.md   07-release-process.md
    ├── research/ (template with Sources section)
    └── testing/ test-strategy, test-plan template (ISO 29119-3 based), TC template, bug template,
                 test data & environments, traceability matrix (REQ → US → TC → BUG)
```

Plugin download (optional): same content as `skills/`, `agents/`, `hooks/hooks.json`, `.claude-plugin/plugin.json`; doc templates under `templates/`, copied into the project by `/sdlc-init`.

## 3. Accuracy and safety features (agreed)

1. Live data injected into skills with `` !`command` `` (diff, changed files, test output, FILL counts); `shell: powershell` on Windows.
2. Hard rules enforced with hooks, not CLAUDE.md: block `.env`/secrets (PreToolUse), run formatter/lint after edits (PostToolUse). Cross-platform commands, opt-out.
3. Path-scoped rules (`paths:`) so standards load only when relevant; CLAUDE.md kept under 200 lines.
4. Heavy skills run with `context: fork`.
5. Agents tuned: read-only agents use `permissionMode: plan`; exploration on `model: haiku`; reviewer and test-designer use `memory: project`.
6. Acceptance criteria in Given/When/Then, feeding test cases and the traceability matrix.
7. Change commands end with proof: build + tests run, output shown, done checklist.
8. Research rules: source ranking, version-matched docs, read date, short quotes, confidence, conflicts reported.
9. Stack profile packs (start with Spring Boot API, React, Node API).
10. (v2) `/sdlc-update`; `/sdlc-init` writes answers back into docs.
11. (v2) Optional AGENTS.md.
12. (v2) Optional MCP setups for Jira/GitHub and Playwright, off by default.
13. Evals for the templates (`claude plugin eval`), e.g. test cases must cover boundaries, research must cite sources, empty docs must lead to "inferred" not invented.
14. (v2) Versioned kits and upgrade that returns only changed files.
15. Quick-start mentions `/doctor prompt-audit`.

## 4. Implementation

### Server (private logic)
- Templates: `src/main/resources/sdlc-templates/` (not under `static/`, never served), laid out like the output, plus `manifest.json` (path → roles, component, condition).
- `SdlcGeneratorService` (Java): filter manifest by roles/components/options → render templates (`{{value}}`, `{{#if}}`, `{{#each}}`, skill-name prefix) → cross-reference fixes (only list included skills/agents, fallbacks when an agent is removed) → checks → stream ZIP with `ZipOutputStream` (UTF-8, LF).
- Checks before download: valid YAML frontmatter; skill `name` = folder; description ≤ 1,536 chars; SKILL.md < 500 lines; CLAUDE.md < 200 lines; no leftover `{{ }}`; every referenced path exists; no clash with built-in command names.
- Endpoints: `POST /api/sdlc/preview` (selected files as JSON) and `POST /api/sdlc/generate` (ZIP or plugin ZIP).
- Limits: input size caps (folders ≤ 1,500, text lengths), rate limit in `CaffeineRateLimiterFilter` (~20/min/IP). Memory cost: templates < 1 MB loaded once; each ZIP ~100–200 KB streamed.
- Every generated file gets an attribution header; ZIP includes a license file (wording to be decided by the owner).

### Browser (only form logic; obfuscated in production)
- `sdlcgen.html` built from a page config with `build-tools.js`; `js/sdlcgen.js` (wizard + preview UI), `js/sdlc-folders.js` (folder input).
- Wizard steps: Role → Project → Folders → Testing → Components → Options; sticky preview with file tree, viewer, in-place edits (edits sent back with the generate request), Reset/Copy per file.
- Folder input: paste `tree` / `tree /f` / `dir /s /b`, or folder picker (`webkitdirectory`, names only, noise folders skipped, depth 3). Stack and test frameworks auto-detected from `pom.xml`, `build.gradle`, `package.json`, `requirements.txt` read locally. Common folder descriptions pre-filled.
- Settings saved to localStorage; existing-CLAUDE.md option produces `CLAUDE.sdlc.md` + one `@import` line; optional `sdlc-` prefix to avoid clashes.
- Site integration: ViewHandler route, tools-list (Generate), header, footer, sitemap, SEO article + FAQ, og image (run last), `?v=` bumps, production build test.

## 5. Testing

1. Hand-write the core kit in this repo and run every command in real Claude Code; fix wording before templating.
2. JUnit: render 4 configs (dev, tester, both, plugin), run the checks, compare with saved snapshots.
3. Run the generated kit on a small Node/React sample repo.
4. "Leave everything empty" test: `/sdlc-init` must infer + label, not invent.
5. Evals for key skills; re-run on every template change.
6. Production (obfuscated) build: generation still works.

## 6. Order of work

| Step | Work |
|---|---|
| 1 | Core kit by hand + tested (CLAUDE.md, rules, sdlc-init, analyze-structure, research, sdlc-status, researcher, docs 00–01, guardrail hooks) |
| 2 | Developer pack (6 skills, 3 agents, docs 02–07) + Spring Boot profile |
| 3 | Tester pack (6 skills, 3 agents, testing docs) |
| 4 | Templates + manifest on server, Java service, checks, JUnit snapshots, evals |
| 5 | Wizard page, folder reader, preview, ZIP download |
| 6 | Plugin export, React/Node profiles, rate limit, site integration, SEO, production test |
| v2 | /sdlc-update, AGENTS.md, MCP options, versioned upgrades |

## 6b. Changes made while building

- Secrets are blocked with permission deny rules in settings.json (they also cover cat/head/tail in Bash), not hooks.
- Core skills don't use command injection: a failing command aborts the skill. Claude runs the commands itself.
- Renamed to avoid built-in commands: /review → /review-changes, /release-notes → /prepare-release.
- Template sources are split into core/, dev/, profiles/<stack>/, tester/; CLAUDE.md is stored as CLAUDE.md.tmpl and
  .claude/ as dot-claude/ so they don't affect Claude Code sessions in this repo.
- FILL examples are fictional (an invoicing app); a rule says examples are never facts.
- Formatter/lint hooks come from wizard input in step 4 (no default formatter for most stacks).
- Added after review: core /explain, /sync-docs, test-runner agent; dev /write-tests, /refactor, /commit, /open-pr, /check-dependencies, debugger agent.
- Requirements docs (02-requirements) moved to core so Tester-only kits have them.
- Tester pack built (step 3): 6 skills, 3 agents, testing docs, testing-standards rule, generic test-setup rule, 18 framework rules.
- Optional extras chosen (off by default): /db-migration + db-reviewer, /performance-check + performance-analyst, /accessibility-check, /document-api, /onboarding-guide, /postmortem, /tech-debt-scan. Not chosen: CI/CD, planning.

## 6c. Step 4 (done 2026-10-04)

- Java package com.payload.parser.sdlc: SdlcTemplateStore (loads classpath sdlc-templates/ once; works from the jar), SdlcRenderer ({{#if}}, {{#unless}}, {{value}}; values never re-scanned), SdlcGeneratorService (packs, values, folder tree/table, command prefix, lint Stop hook, attribution header, user edits), SdlcValidator (frontmatter YAML, names, description length, built-in clashes, missing agents and file references, CLAUDE.md size), SdlcZip, SdlcController.
- API: GET /api/sdlc/packs (catalogue from sdlc-templates/packs.json, no template content), POST /api/sdlc/preview (JSON), POST /api/sdlc/generate (ZIP; 422 if the kit has errors; 400 for invalid input).
- Rate limit for /api/sdlc/*: per cookie and per IP (last X-Forwarded-For entry), 60 previews and 10 downloads per minute; JSON 429.
- Templates are not reachable over HTTP (verified 404 on the jar).
- 31 JUnit tests (renderer, generator combinations, prefix, edits, injection, hooks, controller).
- Plugin export moved to step 6 as planned. Evals need the Claude Code CLI and are not automated yet.
- The Node prototype (scratchpad kitcheck/) is superseded by the Java generator.

## 6d. Step 6, part 1 (done 2026-10-04)

- Plugin edition: POST /api/sdlc/preview|generate?format=plugin returns a plugin named sdlc-kit (claude-sdlc-plugin.zip):
  .claude-plugin/plugin.json, README.md (install), skills/ (incl. setup), agents/, hooks/hooks.json (lint hook), templates/
  (CLAUDE.md, quick start, rules, settings.json permissions, docs/sdlc). Plugins can't ship CLAUDE.md, rules or
  permissions, so /sdlc-kit:setup copies templates/ into each project without overwriting (CLAUDE.sdlc.md + @import if
  a CLAUDE.md exists; merges permission entries into an existing settings.json after asking).
- Plugin conversion (SdlcPluginLayout): commands → /sdlc-kit:<name>, agent references → sdlc-kit:<agent>, skill path
  references → /skills/…, permissionMode removed from agents (ignored in plugins), command prefix
  and existing-CLAUDE.md options ignored (the plugin namespace and setup command cover them).
- Install: unzip into ~/.claude/skills/sdlc-kit/ (loads in every session) or claude --plugin-dir claude-sdlc-plugin.zip.
- New profiles: react, node-api.
- 54 tests pass (whole project). Verified on the packaged jar.
- Remaining in step 6: site integration (route, tools list, menus, sitemap, SEO page, og image), which needs the
  step 5 wizard page.

## 6e. Remaining work (done 2026-10-04)

- Optional extras (extras/, off by default): database (/db-migration + db-reviewer, needs dev), performance
  (/performance-check + performance-analyst), accessibility (/accessibility-check, WCAG 2.2 AA), api-docs
  (/document-api, needs dev), onboarding (/onboarding-guide), postmortem (/postmortem + template), tech-debt
  (/tech-debt-scan, needs dev).
- Step 5 wizard page: /claude-code-sdlc-generator (static/sdlcgen.html built from pages/sdlcgen.js, js/sdlcgen.js,
  sg-* styles in tools.css). Roles, project details, folder picker (names + local build-file detection, existing
  CLAUDE.md detection) or pasted tree / tree /f / dir /s /b, folder notes, profiles, frameworks by language, extras,
  format (project ZIP / plugin), prefix, lint hook; live preview with editable files, issues, download.
  Answers saved in localStorage.
- Site integration: route in ViewHandler, tools-list (Generate), header Generate menu, footer, sitemap, tools page,
  og image (all 51 pages now have one). Verified in dev and in the obfuscated production build.
- 59 tests pass.

## 6f. Guide page (done 2026-10-04)

- /guides/claude-code-sdlc-kit (static/sdlc-guide.html, built by scratchpad build-guide.js from guide-content.js): how the kit loads, quick start, markers, a card per generated file (what it does, how it works, what you can change, official docs), customising recipes, troubleshooting, FAQ, sources.
- The generator preview links each file to its card ("What is this file?"); a check maps all 289 generated paths (project, plugin, prefix, every pack) to existing anchors.
- Linked from the generator page, blogs page, footer and sitemap. When templates change, update guide-content.js and rebuild.

## 6g. Workspace edition (done 2026-10-04)

For microservices: the kit goes in a parent folder that holds every service (each its own git repository)
instead of in each service. Claude Code is always opened at that parent folder.

- API: `format=workspace` → `claude-sdlc-workspace.zip` (`SdlcEdition`). The request has an optional
  `services` list (`folder`, `purpose`, `stack`, `repo`); max 60; folder `^[A-Za-z0-9._-]{1,80}$`, URL
  `https://`, `ssh://` or `git@`.
- Hidden pack `workspace/`: `.claude/rules/workspace.md`, `/add-service`, `docs/sdlc/services/` (one doc per
  service from `_template-service.md`), `services.txt`, `clone-services.sh/.ps1`, `.gitignore` (service folders
  and personal files), `WORKSPACE-README.md`.
- Core templates use `{{#if workspace}}`: CLAUDE.md, 01-folder-structure (services table), sdlc-init,
  analyze-structure, a `git -C <service>` note in 17 git/test skills, and the quick start.
- Rule `paths:` globs get a `**/` prefix in the workspace edition so they match inside every service.
- Wizard: the "This folder holds several services" toggle, a services table, and a third format card. Picking
  a folder with no root build file and two or more subfolders with build files or `.git/config` switches to
  workspace automatically and fills each service's stack and origin URL (credentials removed). In paste
  mode, top-level folders become services.
- Guide: a "Workspace edition" section with 7 cards and an FAQ entry. Tests: 71 pass.

## 7. Decisions

Decided (2026-10-03):
- Downloads: **both** — ZIP for the project (default) and plugin ZIP.
- Guardrail hooks: **on by default**, user can untick.
- Tester pack: **any language**. Test skills are framework-agnostic; a framework rule file (`.claude/rules/testing/<framework>.md`: run command, layout, naming, assertions, reading failures) is chosen from the detected stack or by the user. Starting set: JUnit 5, TestNG, Selenium, REST Assured, Espresso; Jest, Vitest, Playwright, Cypress; pytest; xUnit, NUnit; go test; RSpec; PHPUnit; XCTest; Postman/Newman; k6. Unknown stacks get a generic rule: detect the setup from build files and existing tests, ask before adding a framework.
- Folder names (never contents) may be sent to the server.

Still open:
- Final name/URL (working: Claude Code SDLC Generator, /claude-code-sdlc-generator)
- License wording for generated files (owner's decision)

## Sources

- Skills: https://code.claude.com/docs/en/skills
- Subagents: https://code.claude.com/docs/en/sub-agents
- Memory, CLAUDE.md, rules, AGENTS.md: https://code.claude.com/docs/en/memory
- Hooks: https://code.claude.com/docs/en/hooks
- Permissions: https://code.claude.com/docs/en/permissions
- Plugins: https://code.claude.com/docs/en/plugins
- arc42: https://arc42.org · ADRs: https://adr.github.io · ISO/IEC/IEEE 29119-3: https://www.iso.org/standard/79429.html · OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
