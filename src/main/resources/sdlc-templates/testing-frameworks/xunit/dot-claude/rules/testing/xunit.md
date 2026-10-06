---
paths:
  - "**/*Tests/**/*.cs"
  - "**/*Test/**/*.cs"
  - "**/*Tests.cs"
  - "**/*.Tests.csproj"
---

# xUnit (.NET)

- **Run**: `dotnet test`, one test or class with `--filter "FullyQualifiedName~OrderServiceTests.Rejects"`,
  by trait with `--filter "Category=Smoke"`.
- **Structure**: `[Fact]` for single cases, `[Theory]` with `[InlineData]`, `[MemberData]` or `[ClassData]`
  for data-driven cases. Setup goes in the constructor, cleanup in `Dispose()` (`IDisposable` /
  `IAsyncLifetime`). A new class instance is created for every test.
- **Shared context**: `IClassFixture<T>` for expensive setup per class, collection fixtures across classes.
- **Assertions**: `Assert.Equal(expected, actual)` (expected first), `Assert.Throws<T>()` /
  `await Assert.ThrowsAsync<T>()`. Use FluentAssertions or Shouldly if the project already does.
- **Async**: test methods return `async Task`, never `async void`.
- **Traits and IDs**: `[Trait("Category", "Smoke")]`, `[Trait("TestCase", "TC-US-012-03")]`.
- **Web APIs**: `WebApplicationFactory<Program>` for in-memory integration tests.
