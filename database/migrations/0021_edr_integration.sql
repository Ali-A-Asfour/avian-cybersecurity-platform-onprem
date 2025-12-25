-- Migration 0021: Create EDR Integration tables
-- This migration creates tables for Microsoft Defender for Endpoint and Intune integration
-- Includes devices, alerts, vulnerabilities, compliance, actions, and posture scores

-- ============================================================================
-- EDR Devices Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "edr_devices" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "microsoft_device_id" varchar(255) NOT NULL,
    "device_name" varchar(255) NOT NULL,
    "operating_system" varchar(100),
    "os_version" varchar(100),
    "primary_user" varchar(255),
    
    -- Defender Data
    "defender_health_status" varchar(50),
    "risk_score" integer CHECK (risk_score >= 0 AND risk_score <= 100),
    "exposure_level" varchar(50),
    
    -- Intune Data
    "intune_compliance_state" varchar(50),
    "intune_enrollment_status" varchar(50),
    
    -- Timestamps
    "last_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT NOW(),
    "updated_at" timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(tenant_id, microsoft_device_id)
);

-- Add foreign key constraint to tenants table
DO $$ BEGIN
    ALTER TABLE "edr_devices" 
    ADD CONSTRAINT "edr_devices_tenant_id_tenants_id_fk" 
    FOREIGN KEY ("tenant_id") 
    REFERENCES "public"."tenants"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_edr_devices_tenant" ON "edr_devices"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_edr_devices_risk" ON "edr_devices"("risk_score" DESC);
CREATE INDEX IF NOT EXISTS "idx_edr_devices_compliance" ON "edr_devices"("intune_compliance_state");
CREATE INDEX IF NOT EXISTS "idx_edr_devices_last_seen" ON "edr_devices"("last_seen_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_edr_devices_microsoft_id" ON "edr_devices"("microsoft_device_id");

-- Add comments
COMMENT ON TABLE "edr_devices" IS 'Stores endpoint devices from Microsoft Defender and Intune with tenant isolation';
COMMENT ON COLUMN "edr_devices"."risk_score" IS 'Device risk score from 0-100 calculated by Microsoft Defender';
COMMENT ON COLUMN "edr_devices"."intune_compliance_state" IS 'Compliance state from Intune: compliant, noncompliant, unknown, etc.';

-- ============================================================================
-- EDR Alerts Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "edr_alerts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "device_id" uuid,
    "microsoft_alert_id" varchar(255) NOT NULL,
    
    "severity" varchar(50) NOT NULL,
    "threat_type" varchar(100),
    "threat_name" varchar(255),
    "status" varchar(50),
    "description" text,
    
    "detected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT NOW(),
    "updated_at" timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(tenant_id, microsoft_alert_id)
);

-- Add foreign key constraints
DO $$ BEGIN
    ALTER TABLE "edr_alerts" 
    ADD CONSTRAINT "edr_alerts_tenant_id_tenants_id_fk" 
    FOREIGN KEY ("tenant_id") 
    REFERENCES "public"."tenants"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "edr_alerts" 
    ADD CONSTRAINT "edr_alerts_device_id_edr_devices_id_fk" 
    FOREIGN KEY ("device_id") 
    REFERENCES "public"."edr_devices"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_edr_alerts_tenant" ON "edr_alerts"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_edr_alerts_device" ON "edr_alerts"("device_id");
CREATE INDEX IF NOT EXISTS "idx_edr_alerts_severity" ON "edr_alerts"("severity");
CREATE INDEX IF NOT EXISTS "idx_edr_alerts_status" ON "edr_alerts"("status");
CREATE INDEX IF NOT EXISTS "idx_edr_alerts_detected" ON "edr_alerts"("detected_at" DESC);

-- Add comments
COMMENT ON TABLE "edr_alerts" IS 'Stores security alerts from Microsoft Defender for Endpoint';
COMMENT ON COLUMN "edr_alerts"."severity" IS 'Alert severity: Informational, Low, Medium, High';
COMMENT ON COLUMN "edr_alerts"."status" IS 'Alert status: New, InProgress, Resolved, etc.';

-- ============================================================================
-- EDR Vulnerabilities Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "edr_vulnerabilities" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "cve_id" varchar(50) NOT NULL,
    
    "severity" varchar(50) NOT NULL,
    "cvss_score" decimal(3,1),
    "exploitability" varchar(50),
    "description" text,
    
    "created_at" timestamp with time zone DEFAULT NOW(),
    "updated_at" timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(tenant_id, cve_id)
);

-- Add foreign key constraint
DO $$ BEGIN
    ALTER TABLE "edr_vulnerabilities" 
    ADD CONSTRAINT "edr_vulnerabilities_tenant_id_tenants_id_fk" 
    FOREIGN KEY ("tenant_id") 
    REFERENCES "public"."tenants"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_edr_vulnerabilities_tenant" ON "edr_vulnerabilities"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_edr_vulnerabilities_severity" ON "edr_vulnerabilities"("severity");
CREATE INDEX IF NOT EXISTS "idx_edr_vulnerabilities_cvss" ON "edr_vulnerabilities"("cvss_score" DESC);

-- Add comments
COMMENT ON TABLE "edr_vulnerabilities" IS 'Stores CVE vulnerabilities detected by Microsoft Defender';
COMMENT ON COLUMN "edr_vulnerabilities"."cvss_score" IS 'CVSS score from 0.0 to 10.0';
COMMENT ON COLUMN "edr_vulnerabilities"."exploitability" IS 'Exploitability status: Exploited, ExploitAvailable, NoExploitAvailable, etc.';

-- ============================================================================
-- EDR Device Vulnerabilities Junction Table (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "edr_device_vulnerabilities" (
    "device_id" uuid NOT NULL,
    "vulnerability_id" uuid NOT NULL,
    "detected_at" timestamp with time zone DEFAULT NOW(),
    
    PRIMARY KEY (device_id, vulnerability_id)
);

-- Add foreign key constraints with CASCADE delete
DO $$ BEGIN
    ALTER TABLE "edr_device_vulnerabilities" 
    ADD CONSTRAINT "edr_device_vulnerabilities_device_id_fk" 
    FOREIGN KEY ("device_id") 
    REFERENCES "public"."edr_devices"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "edr_device_vulnerabilities" 
    ADD CONSTRAINT "edr_device_vulnerabilities_vulnerability_id_fk" 
    FOREIGN KEY ("vulnerability_id") 
    REFERENCES "public"."edr_vulnerabilities"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_edr_device_vulns_device" ON "edr_device_vulnerabilities"("device_id");
CREATE INDEX IF NOT EXISTS "idx_edr_device_vulns_vuln" ON "edr_device_vulnerabilities"("vulnerability_id");

-- Add comments
COMMENT ON TABLE "edr_device_vulnerabilities" IS 'Junction table linking devices to their vulnerabilities (many-to-many)';

-- ============================================================================
-- EDR Compliance Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "edr_compliance" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "device_id" uuid NOT NULL,
    
    "compliance_state" varchar(50) NOT NULL,
    "failed_rules" jsonb,
    "security_baseline_status" varchar(50),
    "required_apps_status" jsonb,
    
    "checked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT NOW(),
    "updated_at" timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(tenant_id, device_id)
);

-- Add foreign key constraints
DO $$ BEGIN
    ALTER TABLE "edr_compliance" 
    ADD CONSTRAINT "edr_compliance_tenant_id_tenants_id_fk" 
    FOREIGN KEY ("tenant_id") 
    REFERENCES "public"."tenants"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "edr_compliance" 
    ADD CONSTRAINT "edr_compliance_device_id_edr_devices_id_fk" 
    FOREIGN KEY ("device_id") 
    REFERENCES "public"."edr_devices"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_edr_compliance_tenant" ON "edr_compliance"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_edr_compliance_device" ON "edr_compliance"("device_id");
CREATE INDEX IF NOT EXISTS "idx_edr_compliance_state" ON "edr_compliance"("compliance_state");

-- Add comments
COMMENT ON TABLE "edr_compliance" IS 'Stores device compliance status from Microsoft Intune';
COMMENT ON COLUMN "edr_compliance"."compliance_state" IS 'Compliance state: compliant, noncompliant, unknown, inGracePeriod, etc.';
COMMENT ON COLUMN "edr_compliance"."failed_rules" IS 'JSON array of failed compliance policy rules';

-- ============================================================================
-- EDR Remote Actions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "edr_actions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "device_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    
    "action_type" varchar(50) NOT NULL,
    "status" varchar(50) NOT NULL,
    "result_message" text,
    
    "initiated_at" timestamp with time zone DEFAULT NOW(),
    "completed_at" timestamp with time zone,
    
    "created_at" timestamp with time zone DEFAULT NOW()
);

-- Add foreign key constraints
DO $$ BEGIN
    ALTER TABLE "edr_actions" 
    ADD CONSTRAINT "edr_actions_tenant_id_tenants_id_fk" 
    FOREIGN KEY ("tenant_id") 
    REFERENCES "public"."tenants"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "edr_actions" 
    ADD CONSTRAINT "edr_actions_device_id_edr_devices_id_fk" 
    FOREIGN KEY ("device_id") 
    REFERENCES "public"."edr_devices"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "edr_actions" 
    ADD CONSTRAINT "edr_actions_user_id_users_id_fk" 
    FOREIGN KEY ("user_id") 
    REFERENCES "public"."users"("id") 
    ON DELETE NO ACTION 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_edr_actions_tenant" ON "edr_actions"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_edr_actions_device" ON "edr_actions"("device_id");
CREATE INDEX IF NOT EXISTS "idx_edr_actions_user" ON "edr_actions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_edr_actions_initiated" ON "edr_actions"("initiated_at" DESC);

-- Add comments
COMMENT ON TABLE "edr_actions" IS 'Audit log of remote actions executed on devices via Microsoft Defender';
COMMENT ON COLUMN "edr_actions"."action_type" IS 'Action type: isolate, unisolate, scan, resolve_alert, etc.';
COMMENT ON COLUMN "edr_actions"."status" IS 'Action status: pending, in_progress, completed, failed';

-- ============================================================================
-- EDR Posture Scores Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "edr_posture_scores" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    
    "score" integer NOT NULL CHECK (score >= 0 AND score <= 100),
    "device_count" integer,
    "high_risk_device_count" integer,
    "active_alert_count" integer,
    "critical_vulnerability_count" integer,
    "non_compliant_device_count" integer,
    
    "calculated_at" timestamp with time zone DEFAULT NOW(),
    "created_at" timestamp with time zone DEFAULT NOW()
);

-- Add foreign key constraint
DO $$ BEGIN
    ALTER TABLE "edr_posture_scores" 
    ADD CONSTRAINT "edr_posture_scores_tenant_id_tenants_id_fk" 
    FOREIGN KEY ("tenant_id") 
    REFERENCES "public"."tenants"("id") 
    ON DELETE CASCADE 
    ON UPDATE NO ACTION;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_edr_posture_tenant" ON "edr_posture_scores"("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_edr_posture_calculated" ON "edr_posture_scores"("calculated_at" DESC);

-- Add comments
COMMENT ON TABLE "edr_posture_scores" IS 'Historical security posture scores calculated from EDR data';
COMMENT ON COLUMN "edr_posture_scores"."score" IS 'Overall security posture score from 0-100';
COMMENT ON COLUMN "edr_posture_scores"."critical_vulnerability_count" IS 'Count of vulnerabilities with CVSS >= 7.0';
