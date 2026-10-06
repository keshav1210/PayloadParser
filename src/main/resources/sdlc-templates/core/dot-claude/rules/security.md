# Security basics

Apply these to every change. They follow the OWASP Top 10 and the OWASP Application Security Verification
Standard (ASVS).

- Secrets: never hard-code, log, print or commit passwords, tokens, keys or connection strings. Read them from
  environment variables or the project's secret store. Never open `.env` files or key files.
- Input: validate everything that comes from outside (requests, files, headers, messages) at the boundary,
  with allow-lists where possible.
- Databases: use parameterised queries or the ORM's binding. Never build SQL, NoSQL or LDAP queries by joining
  strings with user input.
- Output: encode data for its context (HTML, attributes, JavaScript, URLs). Don't insert raw HTML from users.
- Access: check authentication and authorisation on the server for every protected action and record. Hiding
  a button is not access control.
- Files and paths: never use user input directly in file paths, shell commands or redirects.
- Errors and logs: show users generic messages; log details server-side without personal data or secrets.
- Dependencies: don't add a library without saying why; prefer maintained, widely used ones.
- Transport: never turn off TLS certificate checks, even in tests that call real services.

If you notice a security problem outside the current task, mention it to the user; don't fix it silently.
