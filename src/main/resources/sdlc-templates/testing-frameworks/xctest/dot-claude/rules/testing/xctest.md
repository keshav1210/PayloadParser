---
paths:
  - "**/*Tests/**/*.swift"
  - "**/*UITests/**/*.swift"
  - "**/Tests/**/*.swift"
---

# XCTest and Swift Testing (iOS / macOS)

- **Run**: in Xcode with Cmd+U, or
  `xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=iPhone 15' -only-testing:AppTests/OrderTests/testRejectsExpired`.
  Swift packages: `swift test --filter OrderTests`.
- **Which framework**: if the project imports `Testing`, use Swift Testing (`@Test`, `#expect`, `#require`,
  `@Suite`, parameterised `@Test(arguments:)`). Otherwise use XCTest. Don't mix both in one file.
- **XCTest**: classes subclass `XCTestCase`, methods start with `test`; `setUpWithError()`/`tearDownWithError()`;
  `XCTAssertEqual(actual, expected)`, `XCTAssertThrowsError`, `XCTUnwrap`. Async code: `async throws` test
  methods with `await`, or `XCTestExpectation` with `wait(for:timeout:)`.
- **UI tests (XCUITest)**: find elements by `accessibilityIdentifier` (`app.buttons["save"]`); use
  `waitForExistence(timeout:)`, never `sleep`. Pass launch arguments to reset state and use test data.
- **Isolation**: inject dependencies (protocols) so tests use fakes instead of the network or real storage.
