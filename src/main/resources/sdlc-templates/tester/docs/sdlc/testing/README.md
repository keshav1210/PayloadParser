# Testing

| Path | What it holds | Created by |
|---|---|---|
| `test-strategy.md` | How this project tests: levels, types, tools, entry/exit criteria, severity definitions | People, `/sdlc-init` |
| `test-plans/TP-<REQ>.md` | Test plan per feature or release | `/test-plan` |
| `test-cases/TC-<story>.md` | Test cases for one user story | `/test-cases` |
| `bugs/BUG-<nnn>-<name>.md` | Bug reports | `/bug-report` |
| `test-runs/` | Results of test and regression runs | `/run-tests`, `/regression` |
| `test-data-and-environments.md` | Environments, accounts and test data rules | People, `/sdlc-init` |
| `traceability-matrix.md` | Requirement → story → test case → automated test → result → bug | Updated by every testing command |

IDs: test cases `TC-<story ID>-01`, e.g. `TC-US-012-03`; bugs `BUG-001`, unless
`docs/sdlc/00-project-overview.md` sets other conventions.

Typical flow: `/test-plan` → `/test-cases` → `/automate-tests` → `/run-tests` → `/bug-report` → `/regression`.
