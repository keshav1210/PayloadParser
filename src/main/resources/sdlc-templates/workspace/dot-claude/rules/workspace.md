# Working in a multi-service workspace

This folder is a workspace: each service lives in its own folder with its own git repository. The services
are listed in `docs/sdlc/01-folder-structure.md`, and each has its own doc in `docs/sdlc/services/`.

## Always know which service

- Before working on a task, work out which service or services it concerns: from the user's words, the files
  involved, or the service docs. If it's unclear, ask.
- Read that service's doc in `docs/sdlc/services/` (build and test commands, structure, where new code goes)
  and the service's own `CLAUDE.md` if it has one.

## Run commands inside the service

- Build, test and dependency commands run inside the service folder: `cd <service> && <command>`.
- Git commands run against the service's repository: `git -C <service> status`, `git -C <service> diff`,
  and so on. In these commands, "the project" or "the repository" means the service, not the workspace.
- The workspace folder itself is not a service repository (it may be a separate repository that holds only
  this kit). Never commit service changes to it.

## Changes across services

- List every service the change affects and the contract between them (REST API, events or messages, shared
  library, database).
- Change the provider side first and keep it backwards compatible until every consumer is updated.
- Keep one commit and one pull request per service, and link them to each other.
- Update the dependencies section of `docs/sdlc/01-folder-structure.md` when services start or stop talking
  to each other.
