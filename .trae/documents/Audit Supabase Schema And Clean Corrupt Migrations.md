## Objectives
- Produce a clear, up-to-date file documenting the Supabase backend structure (schemas, tables, columns, constraints, indexes, foreign keys, RLS policies, extensions).
- Identify and safely remove corrupt/unused local migration files so the repo reflects the real backend state.
- Use Supabase MCP for accurate introspection and keep changes minimal and reversible.

## Read-Only Audit (No Changes)
1) Inventory local migrations
- List files under `supabase/migrations/` and note versions, names, and modification dates.

2) Introspect the live Supabase database with MCP
- Tables: List all tables per schema using `list_tables`.
- Columns: Query `information_schema.columns` for each table (name, type, nullability, default).
- Keys & constraints: Query `pg_constraint` for PKs/FKs/unique, and `pg_indexes` for indexes.
- RLS policies: Query `pg_policy` and include policy names, permissive/restrictive, roles, and qualifiers.
- Extensions: List installed extensions.
- Types: Generate TypeScript types for the project to cross-check model names.

3) Migrations status comparison
- List Supabase migrations (`list_migrations`) and compare to local files to detect drift:
  - Local files missing in Supabase history
  - Local files referencing objects that don’t exist (or already exist but with different definitions)
  - Ordering or dependency issues

## Deliverables To Create
- `docs/backend_structure.md`: Human-friendly schema documentation covering:
  - Schemas overview
  - For each table: columns (type, null, default), PK, FKs, unique/indexes
  - RLS policies per table
  - Extensions used
- `docs/migrations_audit.md`: Summary of each local migration with status and recommended action (Keep/Delete/Needs manual review).

## Cleanup Plan (After Review)
- Delete local migration files that are not required:
  - Criteria: Not present in Supabase migration history OR conflicts with the live schema and were superseded by manual changes.
  - Use repo delete tool to remove only those identified as safe to delete.
- Optional: Establish a new baseline migration capturing the current schema to restore CLI workflows:
  - Create a single baseline migration from the current DB (DDL only) and mark it as the starting point.

## Validation
- Verify `docs/backend_structure.md` matches the counts from `list_tables` and column queries.
- Run spot checks: Pick a few tables used in code and confirm definitions match the doc.
- Ensure app continues to run without relying on deleted migrations; if the CLI needs migrations, proceed with the baseline.

## Safety & Rollback
- Take note of files to delete and back them up before removal.
- No DB writes during audit; deletion targets are local files only.

## Next Actions I Will Perform
- Run the Supabase MCP read-only queries to collect schema metadata.
- Generate and add `docs/backend_structure.md` and `docs/migrations_audit.md` with complete content.
- Propose specific migration files to delete with reasons and then remove them after your confirmation (or proceed if you prefer immediate cleanup).