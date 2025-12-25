-- Migration 0024: Audit Logging for Alerts & Security Incidents Module
-- Adds comprehensive audit trail for all alert and incident state changes
-- with tenant isolation and user attribution

-- Create audit action enum
CREATE TYPE "public"."audit_action" AS ENUM(
    -- Alert actions
    'alert_created',
    'alert_assigned',
    'alert_investigation_started',
    'alert_resolved',
    'alert_escalated',
    'alert_ownership_transferred',
    
    -- Incident actions
    'incident_created',
    'incident_work_started',
    'incident_resolved',
    'incident_dismissed',
    'incident_ownership_transferred',
    'incident_alert_added',
    
    -- Playbook actions
    'playbook_created',
    'playbook_updated',
    'playbook_status_changed',
    'playbook_classification_linked',
    'playbook_classification_unlinked'
);

-- Create audit entity type enum
CREATE TYPE "public"."audit_entity_type" AS ENUM(
    'security_alert',
    'security_incident',
    'investigation_playbook',
    'playbook_classification_link'
);

-- Create alerts incidents audit logs table
CREATE TABLE IF NOT EXISTS "alerts_incidents_audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "action" "audit_action" NOT NULL,
    "entity_type" "audit_entity_type" NOT NULL,
    "entity_id" uuid NOT NULL,
    "description" text NOT NULL,
    "previous_state" jsonb,
    "new_state" jsonb NOT NULL,
    "change_details" jsonb DEFAULT '{}' NOT NULL,
    "user_agent" varchar(500),
    "ip_address" varchar(45),
    "session_id" varchar(255),
    "metadata" jsonb DEFAULT '{}' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
    ALTER TABLE "alerts_incidents_audit_logs" ADD CONSTRAINT "alerts_incidents_audit_logs_tenant_id_tenants_id_fk" 
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "alerts_incidents_audit_logs" ADD CONSTRAINT "alerts_incidents_audit_logs_user_id_users_id_fk" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance and tenant isolation
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_tenant_idx" ON "alerts_incidents_audit_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_tenant_entity_idx" ON "alerts_incidents_audit_logs" ("tenant_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_tenant_user_idx" ON "alerts_incidents_audit_logs" ("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_action_idx" ON "alerts_incidents_audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_entity_type_idx" ON "alerts_incidents_audit_logs" ("entity_type");
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_entity_id_idx" ON "alerts_incidents_audit_logs" ("entity_id");
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_user_idx" ON "alerts_incidents_audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_created_at_idx" ON "alerts_incidents_audit_logs" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_tenant_created_at_idx" ON "alerts_incidents_audit_logs" ("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_entity_chronological_idx" ON "alerts_incidents_audit_logs" ("entity_type", "entity_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "alerts_incidents_audit_logs_user_activity_idx" ON "alerts_incidents_audit_logs" ("user_id", "created_at" DESC);

-- Add comments for documentation
COMMENT ON TABLE "alerts_incidents_audit_logs" IS 'Comprehensive audit trail for all alert and incident state changes with tenant isolation';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."tenant_id" IS 'Tenant context for data isolation';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."user_id" IS 'User who performed the action';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."action" IS 'Type of action performed';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."entity_type" IS 'Type of entity affected';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."entity_id" IS 'ID of the affected entity';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."description" IS 'Human-readable description of the action';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."previous_state" IS 'State before change (null for creation)';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."new_state" IS 'State after change';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."change_details" IS 'Specific fields that changed';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."user_agent" IS 'User agent string from request';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."ip_address" IS 'IP address of the user';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."session_id" IS 'Session identifier';
COMMENT ON COLUMN "alerts_incidents_audit_logs"."metadata" IS 'Additional context information';