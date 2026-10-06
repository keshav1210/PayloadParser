---
name: add-service
description: Add a service to this multi-service workspace. Clones it from a git URL (after you confirm) or registers an existing folder, documents it in docs/sdlc/services/, and adds it to the services list, the clone list and the gitignore.
argument-hint: "<git URL or folder name>"
disable-model-invocation: true
---

# Add a service to the workspace

Service: $ARGUMENTS

If nothing was given, ask for the git URL or the folder name of the service, and stop.

## 1. Get the code

- **A git URL**: work out the folder name from the URL (the repository name). Show the `git clone <url>
  <folder>` command and run it from the workspace folder after the user confirms. If the folder already
  exists, use it instead of cloning.
- **A folder name**: check the folder exists in the workspace and contains code.

## 2. Register it

- Add a line `<folder> <git URL>` to `services.txt` (use the URL from `git -C <folder> remote get-url origin`
  if none was given), so teammates' clone scripts pick it up.
- Add `/<folder>/` to `.gitignore`, so the service is never committed to the workspace repository.

## 3. Document it

- Create `docs/sdlc/services/<folder>.md` from `docs/sdlc/services/_template-service.md`.
- Read the service (build files, README, CI, config, entry points, a few central source files) and fill in
  what the code shows, marking it with `<!-- INFERRED: … -->` as described in
  `.claude/rules/how-to-use-sdlc-docs.md`: purpose, stack, build and test commands, structure, where new code
  goes, APIs it provides, services and systems it calls, and data it owns.
- Add a row for the service to the services table in `docs/sdlc/01-folder-structure.md`, and add any calls
  between this service and existing ones to the dependencies section.

## 4. Report

The folder, what was filled in, what's still empty, and the questions only a person can answer (purpose,
owner, consumers you couldn't find in the code).
