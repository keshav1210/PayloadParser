---
paths:
  - "**/*.test.{js,jsx,ts,tsx}"
  - "**/*.spec.{js,jsx,ts,tsx}"
  - "**/__tests__/**"
  - "**/jest.config.*"
---

# Jest

- **Run**: `npx jest path/to/file.test.ts`, one test by name with `-t "rejects expired token"`; watch mode
  `--watch`. Use the project's `npm test` script in CI-like runs.
- **Files**: `*.test.ts` next to the code or in `__tests__/`, following what the project does.
- **Structure**: `describe` per unit or scenario, `it`/`test` per behaviour; `beforeEach` for fresh setup;
  include the test case ID in the name when it maps to one.
- **Assertions**: `toBe` for primitives, `toEqual` for objects, `toThrow`, `resolves`/`rejects` for promises.
  Always `await` async code or return the promise.
- **Mocks**: `jest.mock('module')` for modules, `jest.fn()`/`jest.spyOn` for functions; reset between tests
  (`clearMocks`/`restoreMocks` in config or `afterEach`). Use fake timers (`jest.useFakeTimers()`) for time.
- **React components**: React Testing Library; query by role and label (`getByRole('button', { name: 'Save' })`),
  use `user-event` for interaction and `findBy…` to wait for async UI.
- **Snapshots**: only for small, stable output; never accept updated snapshots without reading the diff.
