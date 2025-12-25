-- Rollback Migration 0021: Drop EDR Integration tables
-- This rollback script removes all EDR tables in reverse order of dependencies

-- Drop tables in reverse order (child tables first, then parent tables)
DROP TABLE IF EXISTS "edr_posture_scores" CASCADE;
DROP TABLE IF EXISTS "edr_actions" CASCADE;
DROP TABLE IF EXISTS "edr_compliance" CASCADE;
DROP TABLE IF EXISTS "edr_device_vulnerabilities" CASCADE;
DROP TABLE IF EXISTS "edr_vulnerabilities" CASCADE;
DROP TABLE IF EXISTS "edr_alerts" CASCADE;
DROP TABLE IF EXISTS "edr_devices" CASCADE;

-- Note: Indexes and constraints are automatically dropped with CASCADE
