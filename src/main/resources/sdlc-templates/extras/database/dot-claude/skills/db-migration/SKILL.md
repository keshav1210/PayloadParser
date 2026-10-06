---
name: db-migration
description: Write a safe, reversible database schema or data migration with the project's migration tool, planned to avoid data loss and long locks, reviewed by the db-reviewer agent. Use when a change needs new or altered tables, columns, indexes or constraints, or a data fix.
argument-hint: "<the schema or data change needed>"
disable-model-invocation: true
---

# Database migration

{{#if workspace}}
> Workspace: first decide which service this is about (ask if unclear), then run every git, build and
> test command inside that service's folder (`git -C <service> …`, `cd <service> && …`), as described in
> `.claude/rules/workspace.md`.

{{/if}}Change: $ARGUMENTS

If nothing was given, ask what needs to change in the database, and stop.

## 1. Find the migration setup

Look for the tool the project uses and follow its conventions for file names, versions and folders:
Flyway (`db/migration/V<n>__*.sql`), Liquibase (changelog files), Alembic (`alembic/versions/`), Django
(`*/migrations/`), Rails (`db/migrate/`), Prisma (`prisma/migrations/`), EF Core (`Migrations/`), Knex,
TypeORM, Sequelize, golang-migrate, or plain numbered SQL files. Read the latest few migrations to match their
style. If there's no migration tool, say so and ask before choosing one. Never rely on the ORM changing the
schema automatically outside local development.

## 2. Plan it safely

Read the entities or models and the queries that use the affected tables. Then plan with these rules:

- **No data loss**: never drop or narrow a column or table that holds data in the same release that stops
  using it. Use expand and contract: add the new structure, copy or backfill data, switch the code, and remove
  the old structure in a later release.
- **Renames** are add-new + backfill + switch + drop-old, so old and new code can run during the deploy.
- **New required column on an existing table**: add it as nullable (or with a default), backfill, then add
  the NOT NULL constraint.
- **Large tables**: avoid long locks. Backfill in batches; create indexes with the database's online option
  where it has one (e.g. `CREATE INDEX CONCURRENTLY` in PostgreSQL, which can't run inside a transaction).
- **Index** new foreign keys and the columns new queries filter or sort on.
- **Reversible**: write the rollback (down migration) when the tool supports it; if a step can't be undone,
  say so and describe the restore plan.
- Keep schema changes and data changes in separate migrations.

Show the plan, including the deploy order (migration before or after the code), and wait for the user to agree
when it drops, renames or rewrites existing data.

## 3. Write and test

- Create the migration file(s) with the next version number, and update the entities, models and repositories.
- Run the migrations against a local or test database if the project can (e.g. its test setup or
  Testcontainers), then run the related tests with the `test-runner` agent.
- Ask the `db-reviewer` agent to review the migration and the code change; fix what it finds.

## 4. Report

Files created · what changes in the schema · rollback plan · lock and downtime risk · deploy order · test
results · reviewer findings and how they were handled. Update `docs/sdlc/06-api-and-data.md` (data model) if
it exists.
