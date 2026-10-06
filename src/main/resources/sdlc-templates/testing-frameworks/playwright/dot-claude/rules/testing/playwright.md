---
paths:
  - "**/*.spec.{ts,js}"
  - "e2e/**"
  - "tests/**"
  - "**/playwright.config.*"
---

# Playwright

- **Run**: `npx playwright test path/to/file.spec.ts`, one test with `-g "title"`, one browser with
  `--project=chromium`; `--headed` or `--ui` to watch; `npx playwright show-report` for the HTML report.
  (For Python, Java or .NET Playwright, use that language's runner; the practices below still apply.)
- **Locators**, best first: `getByRole('button', { name: 'Save' })`, `getByLabel`, `getByPlaceholder`,
  `getByText`, `getByTestId`. Avoid CSS and XPath tied to layout.
- **Waiting**: actions and web-first assertions wait automatically:
  `await expect(page.getByText('Saved')).toBeVisible()`. Never `page.waitForTimeout()`. Wait for specific
  responses with `page.waitForResponse` when needed.
- **Structure**: `test.describe` per feature; include the test case ID in the title or as a tag
  (`{ tag: '@TC-US-012-03' }`); shared setup through fixtures (`test.extend`) or page object classes.
- **Login once**: save authenticated state with `storageState` in a setup project instead of logging in
  through the UI in every test.
- **Isolation**: each test gets a fresh browser context; don't share data between tests. Mock third-party
  calls with `page.route` when the real service isn't part of the test.
- **Debugging failures**: traces (`trace: 'on-first-retry'` in config), screenshots and videos on failure;
  open a trace with `npx playwright show-trace`.
