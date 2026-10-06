---
paths:
  - "src/test/**/*.java"
---

# Selenium WebDriver (Java)

- **Drivers**: Selenium 4.6+ downloads browser drivers automatically (Selenium Manager); don't commit driver
  binaries or hard-code their paths. Create one driver per test or per thread, and always `driver.quit()` in
  teardown.
- **Page Object Model**: one class per page or component with locators and user-level actions
  (`loginPage.signInAs(user)`). Tests read like the test case steps; assertions stay in tests, not page objects.
- **Locators**, best first: `By.id`, a dedicated test attribute (`[data-testid='…']`), stable CSS, then short
  relative XPath. Avoid absolute XPath and styling classes.
- **Waits**: use explicit waits, `new WebDriverWait(driver, Duration.ofSeconds(10)).until(ExpectedConditions.…)`.
  Never `Thread.sleep`. Don't mix implicit and explicit waits.
- **Headless and CI**: read the browser and headless mode from configuration so CI can run
  `--headless=new` without code changes.
- **On failure**: save a screenshot (`TakesScreenshot`) and the page URL to the test report.
- **Base URL and credentials**: from configuration or environment variables, never in the test code.
