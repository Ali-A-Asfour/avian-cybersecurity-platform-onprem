-- Migration 0016: Create firewall_config_risks table
-- This migration creates the firewall_config_risks table for storing
-- configuration risk analysis results from uploaded SonicWall .exp files

-- Create firewall_config_risks table
CREATE TABLE IF NOT EXISTS "firewall_config_risks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "device_id" uuid NOT NULL,
    "snapshot_id" uuid, -- Reference to config upload event (nullable)
    "risk_category" varchar(50) NOT NULL, -- network_misconfiguration, exposure_risk, security_feature_disabled, license_expired, best_practice_violation
    "risk_type" varchar(100) NOT NULL, -- ANY_ANY_RULE, OPEN_INBOUND, WAN_MANAGEMENT_ENABLED, etc.
    "severity" varchar(20) NOT NULL, -- critical, high, medium, low
    "description" text NOT NULL,
    "remediation" text,
    "detected_at" timestamp with time zone DEFAULT NOW()
);

-- Add foreign key constraint to firewall_devices table
DO $$ BEGIN
    ALTER TABLE "firewall_config_risks" 
    ADD CONSTRAINT "firewall_config_risks_device_id_firewall_devices_id_fk" 
    FOREIGN KEY ("device_id") 
    REFERENCES "public"."firewall_devices"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS "idx_config_risks_device" ON "firewall_config_risks"("device_id", "severity");
CREATE INDEX IF NOT EXISTS "idx_config_risks_severity" ON "firewall_config_risks"("severity");
CREATE INDEX IF NOT EXISTS "idx_config_risks_category" ON "firewall_config_risks"("risk_category");
CREATE INDEX IF NOT EXISTS "idx_config_risks_type" ON "firewall_config_risks"("risk_type");
CREATE INDEX IF NOT EXISTS "idx_config_risks_detected_at" ON "firewall_config_risks"("detected_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_config_risks_snapshot" ON "firewall_config_risks"("snapshot_id") WHERE "snapshot_id" IS NOT NULL;

-- Add check constraints for valid severity values
ALTER TABLE "firewall_config_risks" 
ADD CONSTRAINT "check_severity_valid" 
CHECK ("severity" IN ('critical', 'high', 'medium', 'low'));

-- Add check constraints for valid risk_category values
ALTER TABLE "firewall_config_risks" 
ADD CONSTRAINT "check_risk_category_valid" 
CHECK ("risk_category" IN ('network_misconfiguration', 'exposure_risk', 'security_feature_disabled', 'license_expired', 'best_practice_violation'));

-- Add comments to table and columns
COMMENT ON TABLE "firewall_config_risks" IS 'Stores configuration risk analysis results from uploaded SonicWall .exp files. Risks are detected by parsing configuration and applying security best practice rules.';

COMMENT ON COLUMN "firewall_config_risks"."device_id" IS 'Reference to the firewall device';
COMMENT ON COLUMN "firewall_config_risks"."snapshot_id" IS 'Optional reference to config upload event for tracking which config version generated these risks';
COMMENT ON COLUMN "firewall_config_risks"."risk_category" IS 'Risk category: network_misconfiguration, exposure_risk, security_feature_disabled, license_expired, best_practice_violation';
COMMENT ON COLUMN "firewall_config_risks"."risk_type" IS 'Specific risk type identifier (e.g., ANY_ANY_RULE, OPEN_INBOUND, WAN_MANAGEMENT_ENABLED) - maps to Firewall Risk Rules + Severity Matrix';
COMMENT ON COLUMN "firewall_config_risks"."severity" IS 'Risk severity level: critical, high, medium, low';
COMMENT ON COLUMN "firewall_config_risks"."description" IS 'Human-readable description of the risk';
COMMENT ON COLUMN "firewall_config_risks"."remediation" IS 'Recommended remediation steps to address the risk';
COMMENT ON COLUMN "firewall_config_risks"."detected_at" IS 'Timestamp when the risk was detected';

