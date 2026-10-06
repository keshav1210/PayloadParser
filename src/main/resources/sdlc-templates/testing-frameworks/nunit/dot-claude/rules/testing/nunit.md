---
paths:
  - "**/*Tests/**/*.cs"
  - "**/*Test/**/*.cs"
  - "**/*Tests.cs"
  - "**/*.Tests.csproj"
---

# NUnit (.NET)

- **Run**: `dotnet test`, filter with `--filter "FullyQualifiedName~OrderServiceTests"` or
  `--filter "TestCategory=Smoke"`.
- **Structure**: `[TestFixture]` classes, `[Test]` methods, `[TestCase(…)]` and `[TestCaseSource]` for data;
  `[SetUp]`/`[TearDown]` per test, `[OneTimeSetUp]`/`[OneTimeTearDown]` per fixture. The same fixture instance
  is reused for all its tests, so reset state in `[SetUp]`.
- **Assertions**: the constraint model, `Assert.That(actual, Is.EqualTo(expected))`, `Throws.TypeOf<T>()`,
  `Has.Count.EqualTo(3)`; `Assert.Multiple(() => { … })` for related checks.
- **Categories and IDs**: `[Category("Smoke")]`; put the test case ID in `[Description]` or the test name.
- **Async**: `async Task` test methods; `Assert.ThrowsAsync<T>()`.
- **Parallel**: `[Parallelizable]` only for tests that share no state.
