---
paths:
  - "src/test/**/*.java"
---

# REST Assured (API tests)

- **Style**: `given()` (setup: auth, headers, body) → `when()` (the call) → `then()` (checks). One API
  behaviour per test.
- **Setup**: put the base URI, port, base path and default headers in a shared `RequestSpecification`
  (`RequestSpecBuilder`) read from configuration; tokens come from a login helper or environment variables.
- **Checks**: status code, important headers, and the body fields that matter, with Hamcrest matchers
  (`body("total", equalTo(120.5f))`, `body("items.size()", is(3))`). For error cases, check the error format
  and message, not only the status.
- **Contracts**: validate response structure with a JSON schema (`matchesJsonSchemaInClasspath("schemas/order.json")`
  from the `json-schema-validator` module) where the project keeps schemas.
- **Data**: create the data each test needs through the API (or a builder) and delete it afterwards. Extract
  values with `.extract().path("id")` to chain calls.
- **Debugging**: `.log().ifValidationFails()` on request and response, never logging secrets in CI.
- **Coverage per endpoint**: success, validation errors, not found, unauthorised (401), forbidden (403), and
  idempotency or duplicate handling where relevant.
