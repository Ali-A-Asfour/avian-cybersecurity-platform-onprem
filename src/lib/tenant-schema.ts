import { db, getDb } from './database';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

/**
 * Multi-tenant schema management utilities
 * Handles creation and management of tenant-specific database schemas
 */

export class TenantSchemaManager {
  /**
   * Create a new tenant schema with all required tables
   */
  static async createTenantSchema(tenantId: string): Promise<void> {
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;

    try {
      // Create schema
      await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`));

      // Create tenant-specific tables in the schema
      const createTablesSQL = `
        -- Set search path to tenant schema
        SET search_path TO "${schemaName}", public;
        
        -- Create tenant-specific tables
        CREATE TABLE IF NOT EXISTS tickets (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL,
          requester varchar(255) NOT NULL,
          assignee varchar(255),
          title varchar(500) NOT NULL,
          description text NOT NULL,
          category ticket_category NOT NULL,
          severity ticket_severity NOT NULL,
          priority ticket_priority NOT NULL,
          status ticket_status DEFAULT 'new' NOT NULL,
          tags jsonb DEFAULT '[]' NOT NULL,
          sla_deadline timestamp,
          created_at timestamp DEFAULT now() NOT NULL,
          updated_at timestamp DEFAULT now() NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS ticket_comments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
          user_id uuid NOT NULL,
          content text NOT NULL,
          is_internal boolean DEFAULT false NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL,
          updated_at timestamp DEFAULT now() NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS ticket_attachments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
          filename varchar(255) NOT NULL,
          original_filename varchar(255) NOT NULL,
          file_size integer NOT NULL,
          mime_type varchar(100) NOT NULL,
          file_path text NOT NULL,
          uploaded_by uuid NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS alerts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL,
          source varchar(255) NOT NULL,
          title varchar(500) NOT NULL,
          description text NOT NULL,
          severity alert_severity NOT NULL,
          category alert_category NOT NULL,
          status alert_status DEFAULT 'open' NOT NULL,
          metadata jsonb DEFAULT '{}' NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL,
          updated_at timestamp DEFAULT now() NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS compliance_frameworks (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL,
          name varchar(255) NOT NULL,
          version varchar(50) NOT NULL,
          description text,
          is_active boolean DEFAULT true NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL,
          updated_at timestamp DEFAULT now() NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS compliance_controls (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          framework_id uuid NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
          control_id varchar(100) NOT NULL,
          title varchar(500) NOT NULL,
          description text NOT NULL,
          status compliance_status DEFAULT 'not_started' NOT NULL,
          last_reviewed timestamp,
          next_review_date timestamp,
          assigned_to uuid,
          created_at timestamp DEFAULT now() NOT NULL,
          updated_at timestamp DEFAULT now() NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS compliance_evidence (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          control_id uuid NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,
          filename varchar(255) NOT NULL,
          original_filename varchar(255) NOT NULL,
          file_size integer NOT NULL,
          mime_type varchar(100) NOT NULL,
          file_path text NOT NULL,
          description text,
          uploaded_by uuid NOT NULL,
          created_at timestamp DEFAULT now() NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS notifications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL,
          user_id uuid NOT NULL,
          title varchar(255) NOT NULL,
          message text NOT NULL,
          type notification_type DEFAULT 'info' NOT NULL,
          is_read boolean DEFAULT false NOT NULL,
          metadata jsonb DEFAULT '{}',
          created_at timestamp DEFAULT now() NOT NULL,
          read_at timestamp
        );
        
        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS tickets_tenant_idx ON tickets(tenant_id);
        CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status);
        CREATE INDEX IF NOT EXISTS tickets_severity_idx ON tickets(severity);
        CREATE INDEX IF NOT EXISTS tickets_assignee_idx ON tickets(assignee);
        CREATE INDEX IF NOT EXISTS tickets_created_at_idx ON tickets(created_at);
        
        CREATE INDEX IF NOT EXISTS alerts_tenant_idx ON alerts(tenant_id);
        CREATE INDEX IF NOT EXISTS alerts_severity_idx ON alerts(severity);
        CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts(status);
        CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts(created_at);
        
        CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(is_read);
        CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);
        
        -- Reset search path
        SET search_path TO public;
      `;

      await db.execute(sql.raw(createTablesSQL));

      // Schema created successfully
    } catch (error) {
      console.error(`❌ Error creating tenant schema ${schemaName}:`, error);
      throw error;
    }
  }

  /**
   * Drop a tenant schema and all its data
   */
  static async dropTenantSchema(tenantId: string): Promise<void> {
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;

    try {
      await db.execute(sql.raw(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`));
      // Schema dropped successfully
    } catch (error) {
      console.error(`❌ Error dropping tenant schema ${schemaName}:`, error);
      throw error;
    }
  }

  /**
   * Get the schema name for a tenant
   */
  static getTenantSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '_')}`;
  }

  /**
   * Check if a tenant schema exists
   */
  static async schemaExists(tenantId: string): Promise<boolean> {
    const schemaName = this.getTenantSchemaName(tenantId);

    try {
      const result = await db.execute(sql.raw(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = '${schemaName}'
      `));

      return result.length > 0;
    } catch (error) {
      console.error(`❌ Error checking schema existence:`, error);
      return false;
    }
  }

  /**
   * List all tenant schemas
   */
  static async listTenantSchemas(): Promise<string[]> {
    try {
      const result = await db.execute(sql.raw(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
        ORDER BY schema_name
      `));

      return result.map((row) => (row as { schema_name: string }).schema_name);
    } catch (error) {
      console.error(`❌ Error listing tenant schemas:`, error);
      return [];
    }
  }
}

/**
 * Get a database connection for a specific tenant
 */
export async function getTenantDatabase(tenantId: string) {
  const database = await getDb();

  // For now, use the public schema for all tenants
  // Tenant isolation is handled by the tenant_id column in each table
  // In a production environment with full multi-tenancy, you would use separate schemas
  await database.execute(sql.raw(`SET search_path TO public`));

  return database;
}