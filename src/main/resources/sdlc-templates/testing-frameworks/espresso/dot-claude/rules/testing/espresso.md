---
paths:
  - "**/src/androidTest/**"
  - "**/src/test/**/*.kt"
  - "**/src/test/**/*.java"
---

# Android: Espresso and local tests

- **Where**: UI and instrumented tests in `src/androidTest/` run on a device or emulator with
  `./gradlew connectedAndroidTest` (or `connectedDebugAndroidTest`). Plain unit tests in `src/test/` run on the
  JVM with `./gradlew testDebugUnitTest`. Prefer local tests for logic; keep Espresso for UI behaviour.
- **Pattern**: `onView(withId(R.id.save)).perform(click())`, then
  `onView(withText("Saved")).check(matches(isDisplayed()))`. For lists, use `RecyclerViewActions`.
- **Launching**: `ActivityScenarioRule` / `ActivityScenario.launch(…)`; for Compose screens use
  `createAndroidComposeRule` with `onNodeWithTag(…)` and `testTag` modifiers.
- **Waiting**: Espresso waits for the main thread and AsyncTask automatically; register `IdlingResource`s for
  your own background work (coroutines, network). Never `Thread.sleep`.
- **Stability**: turn off animations on test devices; give views stable IDs or test tags; don't depend on
  device language or screen size unless that's what's being tested.
- **Data**: fake the network and repositories (dependency injection, MockWebServer) instead of calling real
  services.
