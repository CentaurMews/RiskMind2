#!/bin/bash
set -e
pnpm install --frozen-lockfile

echo "Running treatment strategy enum migration (old→new 4T mapping)..."

# Step 1: Add new enum values to treatment_strategy if they don't exist
# This is safe because IF NOT EXISTS prevents errors on re-runs
psql "$DATABASE_URL" <<'MIGRATION_SQL'
DO $$
BEGIN
  -- Add new 4T enum values if they don't exist yet
  BEGIN
    ALTER TYPE treatment_strategy ADD VALUE IF NOT EXISTS 'treat';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE treatment_strategy ADD VALUE IF NOT EXISTS 'tolerate';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TYPE treatment_strategy ADD VALUE IF NOT EXISTS 'terminate';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END
$$;

-- Step 2: Map old enum values to new ones (safe: only updates rows with old values)
UPDATE treatments SET strategy = 'treat' WHERE strategy = 'mitigate';
UPDATE treatments SET strategy = 'tolerate' WHERE strategy = 'accept';
UPDATE treatments SET strategy = 'terminate' WHERE strategy = 'avoid';
MIGRATION_SQL

echo "Treatment strategy migration complete"

pnpm --filter db push
