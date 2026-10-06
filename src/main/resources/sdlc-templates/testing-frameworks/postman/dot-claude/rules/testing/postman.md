---
paths:
  - "**/*.postman_collection.json"
  - "**/*.postman_environment.json"
  - "postman/**"
---

# Postman and Newman (API tests)

- **Run**: `npx newman run postman/orders.postman_collection.json -e postman/staging.postman_environment.json`;
  one folder with `--folder "Orders"`; reports with `--reporters cli,junit --reporter-junit-export results.xml`.
- **Organise**: one collection per API or feature, folders per resource, request names that include the
  test case ID when one exists.
- **Tests**: in each request's test script,
  `pm.test("TC-US-012-03 returns 201", () => pm.response.to.have.status(201));` and
  `pm.expect(pm.response.json().total).to.eql(120.5)`. Check the error format for error cases.
- **Variables**: base URLs and data in environments; pass values between requests with
  `pm.collectionVariables.set("orderId", …)`. Get tokens in a pre-request script or a login request.
- **Secrets**: never commit real tokens or passwords in environment files; commit a template with empty
  values and supply the real ones in CI as variables (`--env-var "token=…"`).
- **Order**: Newman runs requests in collection order; keep each request's setup explicit so a single
  request can still be run on its own when debugging.
