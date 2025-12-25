-- Migration 0012: Create firewall_devices table
-- This migration creates the firewall_devices table for SonicWall firewall integration
-- with tenant association and encrypted API credentials

-- Create firewall_devices table
CREATE TABLE IF NOT EXISTS "firewall_devices" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "model" varchar(100),
    "firmware_version" varchar(50),
    "serial_number" varchar(100) UNIQUE,
    "management_ip" inet NOT NULL,
    "api_username" varchar(255),
    "api_password_encrypted" text, -- AES-256 encrypted
    "uptime_seconds" bigint DEFAULT 0,
    "last_seen_at" timestamp with time zone,
    "status" varchar(20) DEFAULT 'active', -- active, inactive, offline
    "created_at" timestamp with time zone DEFAULT NOW(),
    "updated_at" timestamp with time zone DEFAULT NOW()
);

-- Add foreign key constraint to tenants table
DO $$ BEGIN
    ALTER TABLE "firewall_devices" 
    ADD CONSTRAINT "firewall_devices_tenant_id_tenants_id_fk" 
    FOREIGN KEY ("tenant_id") 
    REFERENCES "public"."tenants"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS "idx_firewall_devices_tenant" ON "firewall_devices"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_firewall_devices_status" ON "firewall_devices"("status");
CREATE INDEX IF NOT EXISTS "idx_firewall_devices_serial" ON "firewall_devices"("serial_number");
CREATE INDEX IF NOT EXISTS "idx_firewall_devices_last_seen" ON "firewall_devices"("last_seen_at");

-- Add comment to table
COMMENT ON TABLE "firewall_devices" IS 'Stores registered SonicWall firewall devices with tenant association and API credentials';
COMMENT ON COLUMN "firewall_devices"."api_password_encrypted" IS 'AES-256 encrypted API password for SonicWall authentication';
COMMENT ON COLUMN "firewall_devices"."status" IS 'Device status: active (polling enabled), inactive (polling disabled), offline (unreachable)';
