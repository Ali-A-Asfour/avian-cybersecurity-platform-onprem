-- Initial schema migration for AVIAN Platform
-- This creates the main platform tables and tenant-specific table structures

-- Create enums
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'tenant_admin', 'analyst', 'user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."ticket_status" AS ENUM('new', 'in_progress', 'awaiting_response', 'resolved', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."ticket_severity" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."ticket_category" AS ENUM('security_incident', 'vulnerability', 'compliance', 'access_request', 'policy_violation', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."alert_severity" AS ENUM('info', 'low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."alert_category" AS ENUM('malware', 'phishing', 'intrusion', 'data_breach', 'policy_violation', 'anomaly', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."alert_status" AS ENUM('open', 'investigating', 'resolved', 'false_positive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."compliance_status" AS ENUM('not_started', 'in_progress', 'completed', 'non_compliant');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."notification_type" AS ENUM('info', 'warning', 'error', 'success');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create main platform tables
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"logo_url" text,
	"theme_color" varchar(7),
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_domain_unique" UNIQUE("domain")
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" text,
	"password_hash" text NOT NULL,
	"last_login" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);

-- Create tenant-specific tables (these will be in tenant schemas)
CREATE TABLE IF NOT EXISTS "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requester" varchar(255) NOT NULL,
	"assignee" varchar(255),
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"category" "ticket_category" NOT NULL,
	"severity" "ticket_severity" NOT NULL,
	"priority" "ticket_priority" NOT NULL,
	"status" "ticket_status" DEFAULT 'new' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"sla_deadline" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ticket_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"category" "alert_category" NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "compliance_frameworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"version" varchar(50) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "compliance_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" uuid NOT NULL,
	"control_id" varchar(100) NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text NOT NULL,
	"status" "compliance_status" DEFAULT 'not_started' NOT NULL,
	"last_reviewed" timestamp,
	"next_review_date" timestamp,
	"assigned_to" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "compliance_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"control_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_path" text NOT NULL,
	"description" text,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"type" "notification_type" DEFAULT 'info' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "compliance_controls" ADD CONSTRAINT "compliance_controls_framework_id_compliance_frameworks_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."compliance_frameworks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "compliance_evidence" ADD CONSTRAINT "compliance_evidence_control_id_compliance_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."compliance_controls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "tenants_domain_idx" ON "tenants" USING btree ("domain");
CREATE INDEX IF NOT EXISTS "tenants_active_idx" ON "tenants" USING btree ("is_active");

CREATE INDEX IF NOT EXISTS "users_email_tenant_idx" ON "users" USING btree ("email","tenant_id");
CREATE INDEX IF NOT EXISTS "users_tenant_idx" ON "users" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" USING btree ("role");
CREATE INDEX IF NOT EXISTS "users_active_idx" ON "users" USING btree ("is_active");

CREATE INDEX IF NOT EXISTS "audit_logs_tenant_idx" ON "audit_logs" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" USING btree ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "tickets_tenant_idx" ON "tickets" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets" USING btree ("status");
CREATE INDEX IF NOT EXISTS "tickets_severity_idx" ON "tickets" USING btree ("severity");
CREATE INDEX IF NOT EXISTS "tickets_priority_idx" ON "tickets" USING btree ("priority");
CREATE INDEX IF NOT EXISTS "tickets_assignee_idx" ON "tickets" USING btree ("assignee");
CREATE INDEX IF NOT EXISTS "tickets_requester_idx" ON "tickets" USING btree ("requester");
CREATE INDEX IF NOT EXISTS "tickets_created_at_idx" ON "tickets" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "tickets_sla_deadline_idx" ON "tickets" USING btree ("sla_deadline");

CREATE INDEX IF NOT EXISTS "ticket_comments_ticket_idx" ON "ticket_comments" USING btree ("ticket_id");
CREATE INDEX IF NOT EXISTS "ticket_comments_user_idx" ON "ticket_comments" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "ticket_comments_created_at_idx" ON "ticket_comments" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "ticket_attachments_ticket_idx" ON "ticket_attachments" USING btree ("ticket_id");
CREATE INDEX IF NOT EXISTS "ticket_attachments_uploader_idx" ON "ticket_attachments" USING btree ("uploaded_by");

CREATE INDEX IF NOT EXISTS "alerts_tenant_idx" ON "alerts" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "alerts_severity_idx" ON "alerts" USING btree ("severity");
CREATE INDEX IF NOT EXISTS "alerts_category_idx" ON "alerts" USING btree ("category");
CREATE INDEX IF NOT EXISTS "alerts_status_idx" ON "alerts" USING btree ("status");
CREATE INDEX IF NOT EXISTS "alerts_source_idx" ON "alerts" USING btree ("source");
CREATE INDEX IF NOT EXISTS "alerts_created_at_idx" ON "alerts" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "compliance_frameworks_tenant_idx" ON "compliance_frameworks" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "compliance_frameworks_active_idx" ON "compliance_frameworks" USING btree ("is_active");

CREATE INDEX IF NOT EXISTS "compliance_controls_framework_idx" ON "compliance_controls" USING btree ("framework_id");
CREATE INDEX IF NOT EXISTS "compliance_controls_status_idx" ON "compliance_controls" USING btree ("status");
CREATE INDEX IF NOT EXISTS "compliance_controls_assigned_idx" ON "compliance_controls" USING btree ("assigned_to");
CREATE INDEX IF NOT EXISTS "compliance_controls_review_date_idx" ON "compliance_controls" USING btree ("next_review_date");

CREATE INDEX IF NOT EXISTS "compliance_evidence_control_idx" ON "compliance_evidence" USING btree ("control_id");
CREATE INDEX IF NOT EXISTS "compliance_evidence_uploader_idx" ON "compliance_evidence" USING btree ("uploaded_by");

CREATE INDEX IF NOT EXISTS "notifications_tenant_idx" ON "notifications" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "notifications_read_idx" ON "notifications" USING btree ("is_read");
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" USING btree ("created_at");