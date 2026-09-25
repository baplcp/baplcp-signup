-- The normalization handoff is complete and no remaining database code writes
-- to this transient diagnostics table.
drop table if exists public.normalization_migration_issues;
