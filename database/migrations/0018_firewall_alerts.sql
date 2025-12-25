-- Migration 0018: Create firewall_alerts table
-- This migration creates the firewall_alerts table for storing
-- alerts generated from API polling and email sources

-- Create firewall_alerts table
CREATE TABLE IF NOT EXISTS "firewall_alerts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "device_id" uuid, -- Nullable for email alerts without device match
    "alert_type" varchar(100) NOT NULL, -- ips_counter_increase, wan_down, vpn_down, license_expired, feature_disabled, config_risk
    "severity" varchar(20) NOT NULL, -- critical, high, medium, low, info
    "message" text NOT NULL,
    "source" varchar(20) NOT NULL, -- api, email
    "metadata" jsonb DEFAULT '{}', -- {"previous_value": 100, "new_value": 150, "counter_name": "ips_blocks"}
    "acknowledged" boolean DEFAULT false,
    "acknowledged_by" uuid,
    "acknowledged_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT NOW()
);

-- Add foreign key constraint to tenants table
DO $$ BEGIN
    ALTER TABLE "firewall_alerts" 
    ADD CONSTRAINT "firewall_alerts_tenant_id_tenants_id_fk" 
    FOREIGN KEY ("tenant_id") 
    REFERENCES "public"."tenants"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraint to firewall_devices table (nullable)
DO $$ BEGIN
    ALTER TABLE "firewall_alerts" 
    ADD CONSTRAINT "firewall_alerts_device_id_firewall_devices_id_fk" 
    FOREIGN KEY ("device_id") 
    REFERENCES "public"."firewall_devices"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add foreign key constraint to users table (nullable)
DO $$ BEGIN
    ALTER TABLE "firewall_alerts" 
    ADD CONSTRAINT "firewall_alerts_acknowledged_by_users_id_fk" 
    FOREIGN KEY ("acknowledged_by") 
    REFERENCES "public"."users"("id") 
    ON DELETE SET NULL 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS "idx_alerts_tenant" ON "firewall_alerts"("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_alerts_device" ON "firewall_alerts"("device_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_alerts_severity" ON "firewall_alerts"("severity");
CREATE INDEX IF NOT EXISTS "idx_alerts_acknowledged" ON "firewall_alerts"("acknowledged");
CREATE INDEX IF NOT EXISTS "idx_alerts_alert_type" ON "firewall_alerts"("alert_type");
CREATE INDEX IF NOT EXISTS "idx_alerts_source" ON "firewall_alerts"("source");
CREATE INDEX IF NOT EXISTS "idx_alerts_created_at" ON "firewall_alerts"("created_at" DESC);

-- Add check constraints for valid enum values
ALTER TABLE "firewall_alerts" 
ADD CONSTRAINT "check_severity_valid" 
CHECK ("severity" IN ('critical', 'high', 'medium', 'low', 'info'));

ALTER TABLE "firewall_alerts" 
ADD CONSTRAINT "check_source_valid" 
CHECK ("source" IN ('api', 'email'));

-- Add check constraint to ensure acknowledged_by is set when acknowledged is true
ALTER TABLE "firewall_alerts" 
ADD CONSTRAINT "check_acknowledged_consistency" 
CHECK (
    ("acknowledged" = false AND "acknowledged_by" IS NULL AND "acknowledged_at" IS NULL) OR
    ("acknowledged" = true AND "acknowledged_by" IS NOT NULL AND "acknowledged_at" IS NOT NULL)
);

-- Add comments to table and columns
COMMENT ON TABLE "firewall_alerts" IS 'Stores alerts generated from SonicWall API polling and email sources. Supports deduplication, acknowledgment, and filtering. Retention: 90 days.';

COMMENT ON COLUMN "firewall_alerts"."id" IS 'Unique alert identifier';
COMMENT ON COLUMN "firewall_alerts"."tenant_id" IS 'Reference to the tenant that owns this alert';
COMMENT ON COLUMN "firewall_alerts"."device_id" IS 'Reference to the firewall device (nullable for email alerts without device match)';
COMMENT ON COLUMN "firewall_alerts"."alert_type" IS 'Type of alert: ips_counter_increase, wan_down, vpn_down, license_expired, feature_disabled, config_risk, etc.';
COMMENT ON COLUMN "firewall_alerts"."severity" IS 'Alert severity: critical, high, medium, low, info';
COMMENT ON COLUMN "firewall_alerts"."message" IS 'Human-readable alert message';
COMMENT ON COLUMN "firewall_alerts"."source" IS 'Alert source: api (from polling engine) or email (from email listener)';
COMMENT ON COLUMN "firewall_alerts"."metadata" IS 'Additional alert context as JSON (e.g., counter values, device identifiers)';
COMMENT ON COLUMN "firewall_alerts"."acknowledged" IS 'Whether the alert has been acknowledged by a user';
COMMENT ON COLUMN "firewall_alerts"."acknowledged_by" IS 'User who acknowledged the alert';
COMMENT ON COLUMN "firewall_alerts"."acknowledged_at" IS 'Timestamp when the alert was acknowledged';
COMMENT ON COLUMN "firewall_alerts"."created_at" IS 'Timestamp when the alert was created';

