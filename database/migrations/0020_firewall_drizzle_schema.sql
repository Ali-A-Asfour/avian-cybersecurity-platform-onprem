-- Drizzle ORM Schema Migration for Firewall Integration
-- This migration documents the firewall tables that were created in migrations 0012-0019
-- The actual table creation was done in those migrations
-- This file serves as the Drizzle ORM reference for the firewall schema

-- Note: This migration should NOT be run if migrations 0012-0019 have already been applied
-- It is provided for reference and for Drizzle ORM schema tracking

-- Migration 0012: firewall_devices table
-- Migration 0013: firewall_health_snapshots table  
-- Migration 0014: firewall_security_posture table
-- Migration 0015: firewall_licenses table
-- Migration 0016: firewall_config_risks table
-- Migration 0017: firewall_metrics_rollup table
-- Migration 0018: firewall_alerts table
-- Migration 0019: firewall_retention_policies (cleanup functions)

-- All firewall tables are defined in database/schemas/firewall.ts
-- The Drizzle schema matches the manually created tables in migrations 0012-0019

-- To verify schema consistency, run:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name LIKE 'firewall_%'
-- ORDER BY table_name;

-- Expected tables:
-- 1. firewall_alerts
-- 2. firewall_config_risks
-- 3. firewall_devices
-- 4. firewall_health_snapshots
-- 5. firewall_licenses
-- 6. firewall_metrics_rollup
-- 7. firewall_security_posture

-- This migration is a NO-OP if the tables already exist
-- It serves to synchronize Drizzle ORM with the existing schema

DO $$ 
BEGIN
    -- Check if firewall tables exist
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'firewall_devices'
    ) THEN
        RAISE NOTICE 'Firewall tables already exist (created by migrations 0012-0019)';
        RAISE NOTICE 'Drizzle ORM schema is now synchronized with existing tables';
    ELSE
        RAISE EXCEPTION 'Firewall tables do not exist. Please run migrations 0012-0019 first.';
    END IF;
END $$;
