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
    // For now, skip creating separate schemas for each tenant
    // The application uses tenant_id columns for isolation instead
    // This avoids complex schema creation that can cause database connection issues
    
    try {
      // Just log that we're skipping schema creation for now
      console.log(`📋 Skipping separate schema creation for tenant ${tenantId} - using tenant_id column isolation instead`);
      
      // In a full multi-tenant setup, you would create separate schemas here
      // For this deployment, we use the simpler approach of tenant_id columns
      
      // Schema creation completed (skipped)
    } catch (error) {
      console.error(`❌ Error in tenant schema setup:`, error);
      throw error;
    }
  }

  /**
   * Drop a tenant schema and all its data
   */
  static async dropTenantSchema(tenantId: string): Promise<void> {
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;

    try {
      const database = await getDb();
      await database.execute(sql.raw(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`));
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
      const database = await getDb();
      const result = await database.execute(sql.raw(`
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
      const database = await getDb();
      const result = await database.execute(sql.raw(`
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