-- Migration: Add risk_executive role and acceptance_memoranda table
-- Task: Risk Acceptance Memorandum workflow (Task #16)
-- Applied: 2026-03-17
-- Note: drizzle-kit push has a pre-existing conflict with vendor_status enum.
--       This migration documents the raw SQL changes applied directly to the database.

-- 1. Add risk_executive to the user_role enum (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'risk_executive'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'risk_executive';
  END IF;
END $$;

-- 2. Create memorandum_status enum (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memorandum_status') THEN
    CREATE TYPE memorandum_status AS ENUM ('pending_approval', 'approved', 'rejected');
  END IF;
END $$;

-- 3. Create acceptance_memoranda table (skip if already exists)
CREATE TABLE IF NOT EXISTS acceptance_memoranda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES treatments(id) ON DELETE SET NULL,
  memorandum_text TEXT NOT NULL,
  status memorandum_status NOT NULL DEFAULT 'pending_approval',
  requested_by_id UUID REFERENCES users(id),
  approver_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_by_id UUID REFERENCES users(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Add rejected_by_id and rejected_at columns if they don't exist
--    (applied after initial table creation in code review fix)
ALTER TABLE acceptance_memoranda
  ADD COLUMN IF NOT EXISTS rejected_by_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
