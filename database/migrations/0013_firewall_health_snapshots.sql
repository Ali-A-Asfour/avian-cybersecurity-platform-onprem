-- Migration 0013: Create firewall_health_snapshots table
-- This migration creates the firewall_health_snapshots table for storing periodic
-- health snapshots of SonicWall firewalls (captured every 4-6 hours)

-- Create firewall_health_snapshots table
CREATE TABLE IF NOT EXISTS "firewall_health_snapshots" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "device_id" uuid NOT NULL,
    "cpu_percent" float NOT NULL,
    "ram_percent" float NOT NULL,
    "uptime_seconds" bigint NOT NULL,
    "wan_status" varchar(10) NOT NULL, -- up, down
    "vpn_status" varchar(10) NOT NULL, -- up, down
    "interface_status" jsonb NOT NULL, -- {"X0": "up", "X1": "up", "X2": "down"}
    "wifi_status" varchar(10), -- on, off
    "ha_status" varchar(20), -- active, standby, failover, standalone
    "timestamp" timestamp with time zone DEFAULT NOW()
);

-- Add foreign key constraint to firewall_devices table
DO $$ BEGIN
    ALTER TABLE "firewall_health_snapshots" 
    ADD CONSTRAINT "firewall_health_snapshots_device_id_firewall_devices_id_fk" 
    FOREIGN KEY ("device_id") 
    REFERENCES "public"."firewall_devices"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS "idx_health_snapshots_device" ON "firewall_health_snapshots"("device_id", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_health_snapshots_timestamp" ON "firewall_health_snapshots"("timestamp" DESC);

-- Add check constraints for valid status values
ALTER TABLE "firewall_health_snapshots" 
ADD CONSTRAINT "check_wan_status" 
CHECK ("wan_status" IN ('up', 'down'));

ALTER TABLE "firewall_health_snapshots" 
ADD CONSTRAINT "check_vpn_status" 
CHECK ("vpn_status" IN ('up', 'down'));

ALTER TABLE "firewall_health_snapshots" 
ADD CONSTRAINT "check_wifi_status" 
CHECK ("wifi_status" IS NULL OR "wifi_status" IN ('on', 'off'));

ALTER TABLE "firewall_health_snapshots" 
ADD CONSTRAINT "check_ha_status" 
CHECK ("ha_status" IS NULL OR "ha_status" IN ('active', 'standby', 'failover', 'standalone'));

-- Add check constraints for valid percentage ranges
ALTER TABLE "firewall_health_snapshots" 
ADD CONSTRAINT "check_cpu_percent_range" 
CHECK ("cpu_percent" >= 0 AND "cpu_percent" <= 100);

ALTER TABLE "firewall_health_snapshots" 
ADD CONSTRAINT "check_ram_percent_range" 
CHECK ("ram_percent" >= 0 AND "ram_percent" <= 100);

-- Add check constraint for uptime
ALTER TABLE "firewall_health_snapshots" 
ADD CONSTRAINT "check_uptime_positive" 
CHECK ("uptime_seconds" >= 0);

-- Add comments to table and columns
COMMENT ON TABLE "firewall_health_snapshots" IS 'Stores periodic health snapshots of firewall devices (captured every 4-6 hours). Retention: 90 days.';
COMMENT ON COLUMN "firewall_health_snapshots"."cpu_percent" IS 'CPU usage percentage (0-100)';
COMMENT ON COLUMN "firewall_health_snapshots"."ram_percent" IS 'RAM usage percentage (0-100)';
COMMENT ON COLUMN "firewall_health_snapshots"."uptime_seconds" IS 'Device uptime in seconds';
COMMENT ON COLUMN "firewall_health_snapshots"."wan_status" IS 'WAN interface status: up or down';
COMMENT ON COLUMN "firewall_health_snapshots"."vpn_status" IS 'VPN tunnel status: up or down';
COMMENT ON COLUMN "firewall_health_snapshots"."interface_status" IS 'JSON object mapping interface names to status (up/down)';
COMMENT ON COLUMN "firewall_health_snapshots"."wifi_status" IS 'WiFi status: on, off, or null if not applicable';
COMMENT ON COLUMN "firewall_health_snapshots"."ha_status" IS 'High Availability status: active, standby, failover, standalone, or null';
COMMENT ON COLUMN "firewall_health_snapshots"."timestamp" IS 'Snapshot creation timestamp';
