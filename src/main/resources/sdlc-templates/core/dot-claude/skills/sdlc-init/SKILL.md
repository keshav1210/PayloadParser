---
name: sdlc-init
description: Set up or refresh this project's SDLC docs. Reads the codebase, fills empty sections in docs/sdlc/ and CLAUDE.md with what the code shows (marked as inferred), and asks the user about what it can't work out. Run when starting with the kit, after big changes, or when asked to initialise or fill the project docs.
argument-hint: "[optional: a doc or area to focus on]"
disable-model-invocation: true
---

# Initialise the SDLC docs

Focus, if given: $ARGUMENTS

Follow `.claude/rules/how-to-use-sdlc-docs.md` throughout. You may edit only `CLAUDE.md` and files under
`docs/sdlc/`. Don't change code, build files or settings.

## 1. Take stock

- Find every Markdown file in `docs/sdlc/` plus `CLAUDE.md`.
- With Grep, list the sections that contain `<!-- FILL` (empty) and `<!-- INFERRED` (unconfirmed).
- If the docs folder is missing or a doc listed in `CLAUDE.md` doesn't exist, tell the user which files are
  missing and continue with the rest.

## 2. Learn the project (read only)

Look at whichever of these exist. Never open `.env` files or key files.

| Look at | To learn |
|---|---|
| `pom.xml`, `build.gradle*`, `package.json`, `pyproject.toml`, `requirements*.txt`, `go.mod`, `Cargo.toml`, `*.csproj`, `Gemfile`, `composer.json` | Languages, frameworks and versions, build/test commands |
| `README*`, existing docs | Purpose, setup, conventions |
| `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `azure-pipelines.yml` | Real build, test and deploy commands |
| `Dockerfile`, `docker-compose*`, `k8s/`, `helm/`, `terraform/` | Runtime and environments |
| `application*.properties/yml`, `config/`, `.env.example` | Configuration and integrations |
| Test folders and a few test files | Test frameworks and style |
| A few central source files (entry point, a typical controller/service/component) | Architecture and conventions |

If `docs/sdlc/01-folder-structure.md` still has empty sections, follow the steps in
`.claude/skills/analyze-structure/SKILL.md` for that file.

{{#if workspace}}
### In a multi-service workspace

Do steps 2 and 3 for **each service** listed in `docs/sdlc/01-folder-structure.md` (and any other folder
that contains a build file or a `.git` folder):

- Fill `docs/sdlc/services/<service>.md`, creating it from `docs/sdlc/services/_template-service.md` if it
  doesn't exist. Commands go there, not in `CLAUDE.md`.
- Fill the services table, then the dependencies between services: look for other services' names, hosts
  and URLs in configuration, HTTP or gRPC clients, and the topics and queues each service publishes to or
  consumes from. Record each link with the file it came from.
- Fill the system-level sections of the project overview from what the services do together.

{{/if}}
## 3. Fill what the evidence supports

For each empty section you can answer from what you found:

- Replace the `<!-- FILL … -->` comment with short, factual content, then add
  `<!-- INFERRED: <files you used> -->` on its own line.
- In `CLAUDE.md`, fill "Build, run and test" with the exact commands (prefer the ones CI uses).
- Leave sections empty when the code doesn't tell you, such as business goals, users, out-of-scope items or
  team contacts. Don't guess them.
- Never edit text a person wrote. If the code contradicts it, add it to the conflicts list for the report.
- Keep `CLAUDE.md` under 200 lines.

## 4. Ask about the rest

Ask the user about the empty sections that matter most for working on this project, at most 5 questions at
a time. Suggest an answer for each when you can, so the user can just confirm. Write the confirmed answers into
the docs as plain text, without an INFERRED marker. If the user skips a question, leave the section empty.

## 5. Report

Finish with:

1. A table: doc · sections filled · inferred (please check) · still empty.
2. Conflicts between docs and code, if any.
3. Questions still open.
4. The 1-3 most useful next steps, such as "check the inferred stack in 00-project-overview.md".
