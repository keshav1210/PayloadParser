---
paths:
  - "**/*.test.{js,jsx,ts,tsx}"
  - "**/*.spec.{js,jsx,ts,tsx}"
  - "**/vitest.config.*"
  - "**/vite.config.*"
---

# Vitest

- **Run**: `npx vitest run path/to/file.test.ts` (single run; plain `npx vitest` starts watch mode), one test
  with `-t "name"`. Coverage: `npx vitest run --coverage` if the coverage package is installed.
- **Config**: `test` section in `vitest.config.*` or `vite.config.*` (environment such as `jsdom` or
  `happy-dom`, setup files, globals).
- **API**: Jest-compatible: `describe`, `it`, `expect`; import them from `vitest` unless `globals: true` is set.
- **Mocks**: `vi.mock('module')` (hoisted to the top of the file), `vi.fn()`, `vi.spyOn`; restore with
  `vi.restoreAllMocks()`. Fake timers: `vi.useFakeTimers()`, `vi.setSystemTime()`.
- **Async**: `await` everything; use `expect(promise).rejects.toThrow()` for failures.
- **Components**: Testing Library with `@testing-library/user-event`, querying by role and label.
- **Snapshots**: only for small, stable output; read the diff before updating.
