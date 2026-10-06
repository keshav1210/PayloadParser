---
paths:
  - "cypress/**"
  - "**/*.cy.{js,ts}"
  - "**/cypress.config.*"
---

# Cypress

- **Run**: `npx cypress run --spec "cypress/e2e/orders.cy.ts"` headless, `npx cypress open` interactive;
  choose a browser with `--browser chrome`.
- **Files**: specs in `cypress/e2e/*.cy.ts`, custom commands in `cypress/support/commands.ts`, test data in
  `cypress/fixtures/`. `baseUrl` lives in `cypress.config.*`, so tests use `cy.visit('/orders')`.
- **Selectors**: dedicated attributes, `cy.get('[data-cy=save]')`, over classes, IDs that change, or text.
- **Waiting**: commands retry automatically. Never `cy.wait(5000)`; wait on network aliases:
  `cy.intercept('POST', '/api/orders').as('createOrder')` … `cy.wait('@createOrder')`.
- **Async model**: Cypress commands are queued, not promises: don't use `async/await` with them; use `.then()`
  to work with values.
- **Login**: `cy.session()` to log in once and cache, or log in through the API instead of the UI.
- **Stubbing**: `cy.intercept` with fixtures to make responses predictable when the backend isn't under test.
- **Isolation**: each test sets up its own state; don't rely on test order.
