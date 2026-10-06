---
name: document-api
description: Create or update the API documentation (OpenAPI) from the actual code, covering every endpoint's parameters, request and response bodies, errors, authentication and examples. Use when asked to document the API, write or fix the OpenAPI or Swagger spec, or after API changes.
argument-hint: "[endpoints or area to document; default: the whole API]"
disable-model-invocation: true
---

# Document the API

Scope: $ARGUMENTS

## 1. Find how the project documents its API

- **Generated from code**: springdoc-openapi, NestJS `@nestjs/swagger`, FastAPI, ASP.NET Swashbuckle or
  NSwag, `drf-spectacular`, tsoa and similar. Then improve the annotations, decorators or docstrings in the code
  instead of writing a separate file.
- **A spec file**: `openapi.yaml`/`openapi.json`/`swagger.*` in the repository. Then update that file.
- **Nothing yet**: propose creating a new spec file at docs/api/openapi.yaml (OpenAPI 3.0, the version most
  tools support, unless the project already uses 3.1) and ask before creating it.

## 2. Document what the code really does

For each endpoint in scope, read the handler, its validation, the service it calls and the error handling, then
document:

- method, path, summary and a one-paragraph description;
- path, query and header parameters, with types and whether they're required;
- request body schema, with constraints from the validation (lengths, formats, enums);
- every response: success codes and bodies, and the error responses the code can actually return, in the
  project's error format;
- authentication and required permissions;
- a realistic example for the request and the main response (no real personal data or secrets).

Reuse shared schemas (components) instead of repeating them. Never document behaviour you can't find in the
code; list gaps and inconsistencies (an undocumented 500, a field that's validated but not described) for
the user instead.

## 3. Check and report

Validate the spec if a linter is available (e.g. `npx @redocly/cli lint <file>` or the framework's own
check), and fix what it reports. Update the endpoints table in `docs/sdlc/06-api-and-data.md` if it exists.
Report: endpoints documented · files changed · inconsistencies found in the code · lint result.
