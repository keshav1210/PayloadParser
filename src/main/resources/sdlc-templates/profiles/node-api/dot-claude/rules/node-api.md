---
paths:
  - "**/routes/**"
  - "**/controllers/**"
  - "**/services/**"
  - "**/middleware/**"
  - "**/middlewares/**"
  - "**/*.controller.{js,ts}"
  - "**/*.service.{js,ts}"
  - "**/*.module.ts"
  - "**/server.{js,ts,mjs}"
  - "**/app.{js,ts,mjs}"
---

# Node.js API practices

Follow these unless the project already does it differently (Express, Fastify, NestJS, Koa…); existing patterns
win.

## Structure

- Keep route handlers thin: parse and validate the request, call a service, map the result to a response.
  Business logic lives in services; data access in repositories or the ORM layer.
- Validate every request body, query and parameter at the edge with the project's validator (zod, joi,
  class-validator, the framework's schema). Reject unknown fields where the API allows it.
- Read configuration from environment variables through one config module; fail fast at startup when a
  required value is missing. Never commit secrets.

## Async and errors

- Use `async`/`await`. Every promise is awaited or handled; no floating promises.
- Send errors through the framework's central error handler, in the project's error format, with the right
  status code. Never return stack traces or internal messages to clients; log them instead.
- Don't block the event loop: no synchronous file or crypto calls in request paths, no long CPU loops; stream
  large files.
- Set timeouts on outgoing HTTP calls and database queries.

## Security

- Parameterised queries or the ORM's binding; never build queries from strings with user input.
- Check authorisation for the specific resource on every request, not just authentication.
- Use the project's security middleware (e.g. helmet, rate limiting, a CORS allow-list); don't widen CORS to `*`
  for APIs that use cookies or tokens.
- Log in a structured way without personal data, tokens or passwords.

## Tests

Test services with unit tests and routes with HTTP-level tests (e.g. supertest against the app, or the
framework's injection helpers), covering success, validation errors, not found and unauthorised cases.
