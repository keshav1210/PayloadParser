---
paths:
  - "src/test/**/*.java"
  - "**/testng*.xml"
---

# TestNG

- **Run**: `./mvnw test -Dtest=ClassName` or a suite file with `-Dsurefire.suiteXmlFiles=testng.xml`; groups
  with `-Dgroups=smoke`. Gradle: `useTestNG()` in the test task, `./gradlew test --tests ClassName`.
- **Structure**: `@Test` methods; `@BeforeMethod`/`@AfterMethod` per test, `@BeforeClass`/`@AfterClass` per
  class, `@BeforeSuite` for one-time setup. Suites and parallel settings live in `testng.xml`.
- **Groups and IDs**: `@Test(groups = {"smoke"}, description = "TC-US-012-03 …")`.
- **Data-driven**: `@DataProvider` methods feeding `@Test(dataProvider = "…")`.
- **Assertions**: `org.testng.Assert.assertEquals(actual, expected)`. The order is the opposite of JUnit's
  (actual first). Use `SoftAssert` only when several independent checks belong to one case, and always call
  `assertAll()`.
- **Dependencies**: avoid `dependsOnMethods` between tests; it makes failures cascade and hides real causes.
- **Parallel runs**: keep tests independent and drivers or clients per thread (`ThreadLocal`) when
  `parallel="methods"` is used.
