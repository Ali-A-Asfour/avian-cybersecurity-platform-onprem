-- Migration 0015: Create firewall_licenses table
-- This migration creates the firewall_licenses table for tracking
-- license expiration dates and generating alerts for expiring/expired licenses

-- Create firewall_licenses table
CREATE TABLE IF NOT EXISTS "firewall_licenses" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "device_id" uuid NOT NULL,
    "ips_expiry" date,
    "gav_expiry" date,
    "atp_expiry" date,
    "app_control_expiry" date,
    "content_filter_expiry" date,
    "support_expiry" date,
    "license_warnings" jsonb DEFAULT '[]', -- ["IPS expiring in 15 days", "GAV expired"]
    "timestamp" timestamp with time zone DEFAULT NOW()
);

-- Add foreign key constraint to firewall_devices table
DO $$ BEGIN
    ALTER TABLE "firewall_licenses" 
    ADD CONSTRAINT "firewall_licenses_device_id_firewall_devices_id_fk" 
    FOREIGN KEY ("device_id") 
    REFERENCES "public"."firewall_devices"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS "idx_licenses_device" ON "firewall_licenses"("device_id", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_licenses_timestamp" ON "firewall_licenses"("timestamp" DESC);

-- Create indexes for expiry date queries (to find expiring licenses)
CREATE INDEX IF NOT EXISTS "idx_licenses_ips_expiry" ON "firewall_licenses"("ips_expiry") WHERE "ips_expiry" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_licenses_gav_expiry" ON "firewall_licenses"("gav_expiry") WHERE "gav_expiry" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_licenses_atp_expiry" ON "firewall_licenses"("atp_expiry") WHERE "atp_expiry" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_licenses_app_control_expiry" ON "firewall_licenses"("app_control_expiry") WHERE "app_control_expiry" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_licenses_content_filter_expiry" ON "firewall_licenses"("content_filter_expiry") WHERE "content_filter_expiry" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_licenses_support_expiry" ON "firewall_licenses"("support_expiry") WHERE "support_expiry" IS NOT NULL;

-- Add comments to table and columns
COMMENT ON TABLE "firewall_licenses" IS 'Stores license expiration dates for firewall security features. Updated during API polling. Used to generate alerts for expiring (within 30 days) and expired licenses.';

COMMENT ON COLUMN "firewall_licenses"."device_id" IS 'Reference to the firewall device';
COMMENT ON COLUMN "firewall_licenses"."ips_expiry" IS 'IPS (Intrusion Prevention System) license expiration date';
COMMENT ON COLUMN "firewall_licenses"."gav_expiry" IS 'Gateway Anti-Virus license expiration date';
COMMENT ON COLUMN "firewall_licenses"."atp_expiry" IS 'Advanced Threat Protection license expiration date';
COMMENT ON COLUMN "firewall_licenses"."app_control_expiry" IS 'Application Control license expiration date';
COMMENT ON COLUMN "firewall_licenses"."content_filter_expiry" IS 'Content Filtering license expiration date';
COMMENT ON COLUMN "firewall_licenses"."support_expiry" IS 'Support contract expiration date';
COMMENT ON COLUMN "firewall_licenses"."license_warnings" IS 'JSON array of warning messages for expiring or expired licenses';
COMMENT ON COLUMN "firewall_licenses"."timestamp" IS 'License record creation/update timestamp';
