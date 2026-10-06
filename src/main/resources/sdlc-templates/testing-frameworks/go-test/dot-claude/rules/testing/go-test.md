---
paths:
  - "**/*_test.go"
---

# Go testing

- **Run**: `go test ./...`, one package `go test ./internal/orders`, one test or subtest
  `go test ./internal/orders -run 'TestCreate/rejects_expired'`; add `-race` for concurrent code, `-count=1`
  to bypass the test cache, `-v` for details.
- **Files**: `x_test.go` next to `x.go`; same package for internal tests, `package x_test` for black-box tests.
  Test fixtures go in a `testdata/` folder.
- **Table-driven tests**: a slice of cases with `name`, inputs and `want`, run with `t.Run(tc.name, …)`;
  include the test case ID in `name` when it maps to one.
- **Assertions**: plain comparisons with `t.Errorf("got %v, want %v", got, want)`; `t.Fatalf` when the test
  can't continue. Use `testify` (`assert`/`require`) only if the project already does.
- **Helpers**: call `t.Helper()` in helpers; `t.Cleanup()` for teardown; `t.TempDir()` for files;
  `t.Parallel()` only for tests that share no state.
- **HTTP**: `httptest.NewRecorder()` for handlers, `httptest.NewServer()` for fake external services.
- **Integration tests**: guard slow or external tests with build tags or `testing.Short()`.
