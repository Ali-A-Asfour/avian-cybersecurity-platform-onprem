-- Migration 0017: Create firewall_metrics_rollup table
-- This migration creates the firewall_metrics_rollup table for storing
-- daily aggregated metrics from SonicWall firewalls

-- Create firewall_metrics_rollup table
CREATE TABLE IF NOT EXISTS "firewall_metrics_rollup" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "device_id" uuid NOT NULL,
    "date" date NOT NULL,
    "threats_blocked" integer DEFAULT 0, -- Sum of IPS + GAV + ATP + Botnet
    "malware_blocked" integer DEFAULT 0, -- GAV blocks
    "ips_blocked" integer DEFAULT 0, -- IPS blocks
    "blocked_connections" integer DEFAULT 0, -- Total denied connections
    "web_filter_hits" integer DEFAULT 0, -- Content filter blocks
    "bandwidth_total_mb" bigint DEFAULT 0, -- If available from API
    "active_sessions_count" integer DEFAULT 0, -- Average or final value
    "created_at" timestamp with time zone DEFAULT NOW(),
    CONSTRAINT "firewall_metrics_rollup_device_date_unique" UNIQUE("device_id", "date")
);

-- Add foreign key constraint to firewall_devices table
DO $$ BEGIN
    ALTER TABLE "firewall_metrics_rollup" 
    ADD CONSTRAINT "firewall_metrics_rollup_device_id_firewall_devices_id_fk" 
    FOREIGN KEY ("device_id") 
    REFERENCES "public"."firewall_devices"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS "idx_metrics_rollup_device" ON "firewall_metrics_rollup"("device_id", "date" DESC);
CREATE INDEX IF NOT EXISTS "idx_metrics_rollup_date" ON "firewall_metrics_rollup"("date" DESC);
CREATE INDEX IF NOT EXISTS "idx_metrics_rollup_created_at" ON "firewall_metrics_rollup"("created_at" DESC);

-- Add check constraints for non-negative values
ALTER TABLE "firewall_metrics_rollup" 
ADD CONSTRAINT "check_threats_blocked_non_negative" 
CHECK ("threats_blocked" >= 0);

ALTER TABLE "firewall_metrics_rollup" 
ADD CONSTRAINT "check_malware_blocked_non_negative" 
CHECK ("malware_blocked" >= 0);

ALTER TABLE "firewall_metrics_rollup" 
ADD CONSTRAINT "check_ips_blocked_non_negative" 
CHECK ("ips_blocked" >= 0);

ALTER TABLE "firewall_metrics_rollup" 
ADD CONSTRAINT "check_blocked_connections_non_negative" 
CHECK ("blocked_connections" >= 0);

ALTER TABLE "firewall_metrics_rollup" 
ADD CONSTRAINT "check_web_filter_hits_non_negative" 
CHECK ("web_filter_hits" >= 0);

ALTER TABLE "firewall_metrics_rollup" 
ADD CONSTRAINT "check_bandwidth_total_mb_non_negative" 
CHECK ("bandwidth_total_mb" >= 0);

ALTER TABLE "firewall_metrics_rollup" 
ADD CONSTRAINT "check_active_sessions_count_non_negative" 
CHECK ("active_sessions_count" >= 0);

-- Add comments to table and columns
COMMENT ON TABLE "firewall_metrics_rollup" IS 'Stores daily aggregated metrics from SonicWall firewalls. Created at midnight UTC by the MetricsAggregator. Uses final cumulative counter values from SonicWall API (not calculated by summing increments). Retention: 365 days.';

COMMENT ON COLUMN "firewall_metrics_rollup"."device_id" IS 'Reference to the firewall device';
COMMENT ON COLUMN "firewall_metrics_rollup"."date" IS 'Date for which metrics are aggregated (YYYY-MM-DD)';
COMMENT ON COLUMN "firewall_metrics_rollup"."threats_blocked" IS 'Total threats blocked (sum of IPS + GAV + ATP + Botnet blocks)';
COMMENT ON COLUMN "firewall_metrics_rollup"."malware_blocked" IS 'Gateway Anti-Virus blocks for the day';
COMMENT ON COLUMN "firewall_metrics_rollup"."ips_blocked" IS 'Intrusion Prevention System blocks for the day';
COMMENT ON COLUMN "firewall_metrics_rollup"."blocked_connections" IS 'Total denied connections for the day';
COMMENT ON COLUMN "firewall_metrics_rollup"."web_filter_hits" IS 'Content filter blocks for the day';
COMMENT ON COLUMN "firewall_metrics_rollup"."bandwidth_total_mb" IS 'Total bandwidth usage in megabytes (if available from API)';
COMMENT ON COLUMN "firewall_metrics_rollup"."active_sessions_count" IS 'Active sessions count (average or final value from last poll)';
COMMENT ON COLUMN "firewall_metrics_rollup"."created_at" IS 'Timestamp when the rollup record was created';
