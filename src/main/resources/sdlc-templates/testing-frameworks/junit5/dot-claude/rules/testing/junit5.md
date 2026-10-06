---
paths:
  - "src/test/**/*.java"
  - "src/test/**/*.kt"
---

# JUnit 5

- **Run**: Maven `./mvnw test -Dtest=ClassName` or `-Dtest=ClassName#method`; Gradle
  `./gradlew test --tests "com.example.ClassName.method"`. Integration tests named `*IT` run with
  `./mvnw verify` (Failsafe) if the project uses that split.
- **Files**: `src/test/java`, same package as the class under test, named `*Test` (Surefire also picks up
  `Test*`, `*Tests`, `*TestCase`).
- **Structure**: `@Test` methods; `@BeforeEach`/`@AfterEach` for setup and cleanup; `@Nested` classes to
  group by scenario; `@DisplayName` for readable names, including the test case ID.
- **Data-driven**: `@ParameterizedTest` with `@CsvSource`, `@ValueSource` or `@MethodSource` instead of loops.
- **Assertions**: `assertEquals(expected, actual)` (expected first), `assertThrows`, `assertAll` for related
  checks. Use AssertJ (`assertThat(actual).isEqualTo(…)`) if the project already does.
- **Mocks**: Mockito with `@ExtendWith(MockitoExtension.class)`, `@Mock`, `@InjectMocks`; verify interactions
  only when the interaction is the behaviour being tested.
- **Tags**: `@Tag("smoke")`, run with `-Dgroups=smoke` (Maven) or `useJUnitPlatform { includeTags … }` (Gradle).
- **Avoid**: `Thread.sleep`; shared static state between tests; JUnit 4 imports (`org.junit.Test`) in JUnit 5 code.
