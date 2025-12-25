-- Migration 0014: Create firewall_security_posture table
-- This migration creates the firewall_security_posture table for tracking
-- security feature status and daily block counts from SonicWall firewalls

-- Create firewall_security_posture table
CREATE TABLE IF NOT EXISTS "firewall_security_posture" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "device_id" uuid NOT NULL,
    
    -- IPS (Intrusion Prevention System)
    "ips_enabled" boolean NOT NULL,
    "ips_license_status" varchar(20), -- active, expiring, expired
    "ips_daily_blocks" integer DEFAULT 0,
    
    -- Gateway Anti-Virus
    "gav_enabled" boolean NOT NULL,
    "gav_license_status" varchar(20), -- active, expiring, expired
    "gav_daily_blocks" integer DEFAULT 0,
    
    -- DPI-SSL (Deep Packet Inspection - SSL)
    "dpi_ssl_enabled" boolean NOT NULL,
    "dpi_ssl_certificate_status" varchar(20), -- valid, expiring, expired
    "dpi_ssl_daily_blocks" integer DEFAULT 0,
    
    -- ATP (Advanced Threat Protection)
    "atp_enabled" boolean NOT NULL,
    "atp_license_status" varchar(20), -- active, expiring, expired
    "atp_daily_verdicts" integer DEFAULT 0,
    
    -- Botnet Filter
    "botnet_filter_enabled" boolean NOT NULL,
    "botnet_daily_blocks" integer DEFAULT 0,
    
    -- Application Control
    "app_control_enabled" boolean NOT NULL,
    "app_control_license_status" varchar(20), -- active, expiring, expired
    "app_control_daily_blocks" integer DEFAULT 0,
    
    -- Content Filtering
    "content_filter_enabled" boolean NOT NULL,
    "content_filter_license_status" varchar(20), -- active, expiring, expired
    "content_filter_daily_blocks" integer DEFAULT 0,
    
    "timestamp" timestamp with time zone DEFAULT NOW()
);

-- Add foreign key constraint to firewall_devices table
DO $ BEGIN
    ALTER TABLE "firewall_security_posture" 
    ADD CONSTRAINT "firewall_security_posture_device_id_firewall_devices_id_fk" 
    FOREIGN KEY ("device_id") 
    REFERENCES "public"."firewall_devices"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS "idx_security_posture_device" ON "firewall_security_posture"("device_id", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_security_posture_timestamp" ON "firewall_security_posture"("timestamp" DESC);

-- Add check constraints for valid license status values
ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_ips_license_status" 
CHECK ("ips_license_status" IS NULL OR "ips_license_status" IN ('active', 'expiring', 'expired'));

ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_gav_license_status" 
CHECK ("gav_license_status" IS NULL OR "gav_license_status" IN ('active', 'expiring', 'expired'));

ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_atp_license_status" 
CHECK ("atp_license_status" IS NULL OR "atp_license_status" IN ('active', 'expiring', 'expired'));

ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_app_control_license_status" 
CHECK ("app_control_license_status" IS NULL OR "app_control_license_status" IN ('active', 'expiring', 'expired'));

ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_content_filter_license_status" 
CHECK ("content_filter_license_status" IS NULL OR "content_filter_license_status" IN ('active', 'expiring', 'expired'));

-- Add check constraints for valid certificate status values
ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_dpi_ssl_certificate_status" 
CHECK ("dpi_ssl_certificate_status" IS NULL OR "dpi_ssl_certificate_status" IN ('valid', 'expiring', 'expired'));

-- Add check constraints for non-negative counter values
ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_ips_daily_blocks_positive" 
CHECK ("ips_daily_blocks" >= 0);

ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_gav_daily_blocks_positive" 
CHECK ("gav_daily_blocks" >= 0);

ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_dpi_ssl_daily_blocks_positive" 
CHECK ("dpi_ssl_daily_blocks" >= 0);

ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_atp_daily_verdicts_positive" 
CHECK ("atp_daily_verdicts" >= 0);

ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_botnet_daily_blocks_positive" 
CHECK ("botnet_daily_blocks" >= 0);

ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_app_control_daily_blocks_positive" 
CHECK ("app_control_daily_blocks" >= 0);

ALTER TABLE "firewall_security_posture" 
ADD CONSTRAINT "check_content_filter_daily_blocks_positive" 
CHECK ("content_filter_daily_blocks" >= 0);

-- Add comments to table and columns
COMMENT ON TABLE "firewall_security_posture" IS 'Stores security feature status and daily block counts for firewall devices. Updated on changes or daily. Retention: 30 days for trending.';

-- IPS comments
COMMENT ON COLUMN "firewall_security_posture"."ips_enabled" IS 'Intrusion Prevention System enabled status';
COMMENT ON COLUMN "firewall_security_posture"."ips_license_status" IS 'IPS license status: active, expiring (within 30 days), or expired';
COMMENT ON COLUMN "firewall_security_posture"."ips_daily_blocks" IS 'Number of threats blocked by IPS today';

-- Gateway Anti-Virus comments
COMMENT ON COLUMN "firewall_security_posture"."gav_enabled" IS 'Gateway Anti-Virus enabled status';
COMMENT ON COLUMN "firewall_security_posture"."gav_license_status" IS 'GAV license status: active, expiring (within 30 days), or expired';
COMMENT ON COLUMN "firewall_security_posture"."gav_daily_blocks" IS 'Number of malware blocked by GAV today';

-- DPI-SSL comments
COMMENT ON COLUMN "firewall_security_posture"."dpi_ssl_enabled" IS 'Deep Packet Inspection SSL enabled status';
COMMENT ON COLUMN "firewall_security_posture"."dpi_ssl_certificate_status" IS 'DPI-SSL certificate status: valid, expiring, or expired';
COMMENT ON COLUMN "firewall_security_posture"."dpi_ssl_daily_blocks" IS 'Number of threats blocked by DPI-SSL today';

-- ATP comments
COMMENT ON COLUMN "firewall_security_posture"."atp_enabled" IS 'Advanced Threat Protection enabled status';
COMMENT ON COLUMN "firewall_security_posture"."atp_license_status" IS 'ATP license status: active, expiring (within 30 days), or expired';
COMMENT ON COLUMN "firewall_security_posture"."atp_daily_verdicts" IS 'Number of ATP verdicts (threat assessments) today';

-- Botnet Filter comments
COMMENT ON COLUMN "firewall_security_posture"."botnet_filter_enabled" IS 'Botnet Filter enabled status';
COMMENT ON COLUMN "firewall_security_posture"."botnet_daily_blocks" IS 'Number of botnet connections blocked today';

-- Application Control comments
COMMENT ON COLUMN "firewall_security_posture"."app_control_enabled" IS 'Application Control enabled status';
COMMENT ON COLUMN "firewall_security_posture"."app_control_license_status" IS 'Application Control license status: active, expiring (within 30 days), or expired';
COMMENT ON COLUMN "firewall_security_posture"."app_control_daily_blocks" IS 'Number of applications blocked today';

-- Content Filtering comments
COMMENT ON COLUMN "firewall_security_posture"."content_filter_enabled" IS 'Content Filtering enabled status';
COMMENT ON COLUMN "firewall_security_posture"."content_filter_license_status" IS 'Content Filtering license status: active, expiring (within 30 days), or expired';
COMMENT ON COLUMN "firewall_security_posture"."content_filter_daily_blocks" IS 'Number of content filter blocks today';

COMMENT ON COLUMN "firewall_security_posture"."timestamp" IS 'Posture record creation timestamp';
