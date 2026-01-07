/**
 * Audit Log Integrity Property Tests
 * Tests for audit log retention and immutability
 * 
 * @jest-environment node
 * 
 * Properties tested:
 * - Property 51: Audit Log Retention
 * - Property 52: Audit Log Immutability
 * 
 * Validates: Requirements 9.7, 9.8
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getClient } from '../database';
import { drizzle } from 'drizzle-orm/postgres-js';
import { authAuditLogs, auditLogs, users, tenants } from '../../../database/schemas/main';
import { eq, sql } from 'drizzle-orm';

describe('Audit Log Integrity Property Tests', () => {
  let testTenantId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create test tenant and user for foreign key constraints
    const client = await getClient();
    const db = drizzle(client);

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: 'Integrity Test Tenant',
        domain: `integrity-test-${Date.now()}.example.com`,
      })
      .returning();
    testTenantId = tenant.id;

    const [user] = await db
      .insert(users)
      .values({
        tenant_id: testTenantId,
        email: 'integrity-test@example.com',
        first_name: 'Integrity',
        last_name: 'Test',
        role: 'user',
        password_hash: 'dummy-hash',
        email_verified: true,
      })
      .returning();
    testUserId = user.id;
  });

  afterAll(async () => {
    // Note: We cannot delete the tenant because audit logs are immutable
    // and have foreign key references. This is expected behavior.
    // In production, tenants would be soft-deleted or archived.
    // For tests, we'll leave the test data (it will be cleaned up with database reset)
  });

  /**
   * Property 51: Audit Log Retention
   * Feature: self-hosted-security-migration, Property 51: Audit Log Retention
   * Validates: Requirements 9.7
   * 
   * For any audit log, it SHALL be retained for at least 1 year (365 days)
   */
  describe('Property 51: Audit Log Retention', () => {
    it('should have retention policy configured for auth audit logs', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Query retention policy table
      const [policy] = await db.execute(sql`
        SELECT table_name, retention_days
        FROM audit_log_retention_policy
        WHERE table_name = 'auth_audit_logs'
      `);

      expect(policy).toBeDefined();
      expect(policy.table_name).toBe('auth_audit_logs');
      expect(policy.retention_days).toBeGreaterThanOrEqual(365);
    }, 30000);

    it('should have retention policy configured for general audit logs', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Query retention policy table
      const [policy] = await db.execute(sql`
        SELECT table_name, retention_days
        FROM audit_log_retention_policy
        WHERE table_name = 'audit_logs'
      `);

      expect(policy).toBeDefined();
      expect(policy.table_name).toBe('audit_logs');
      expect(policy.retention_days).toBeGreaterThanOrEqual(365);
    }, 30000);

    it('should maintain audit logs for the configured retention period', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a test audit log
      const [log] = await db
        .insert(authAuditLogs)
        .values({
          user_id: testUserId,
          email: 'retention-test@example.com',
          action: 'test_retention',
          result: 'success',
          ip_address: '127.0.0.1',
          user_agent: 'Test',
        })
        .returning();

      // Verify log exists
      const [foundLog] = await db
        .select()
        .from(authAuditLogs)
        .where(eq(authAuditLogs.id, log.id))
        .limit(1);

      expect(foundLog).toBeDefined();
      expect(foundLog.id).toBe(log.id);
      expect(foundLog.created_at).toBeInstanceOf(Date);

      // Verify log has a created_at timestamp (required for retention)
      expect(foundLog.created_at).toBeDefined();
      // Verify timestamp is recent (within 2 seconds, allowing for clock skew)
      const timeDiff = Math.abs(Date.now() - foundLog.created_at.getTime());
      expect(timeDiff).toBeLessThan(2000);
    }, 30000);

    it('should track retention policy metadata', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Query retention policy metadata
      const policies = await db.execute(sql`
        SELECT 
          table_name,
          retention_days,
          last_cleanup_at,
          created_at,
          updated_at
        FROM audit_log_retention_policy
        ORDER BY table_name
      `);

      expect(policies.length).toBeGreaterThan(0);

      for (const policy of policies) {
        // Verify required fields
        expect(policy.table_name).toBeDefined();
        expect(policy.retention_days).toBeGreaterThanOrEqual(365);
        expect(policy.created_at).toBeDefined();
        expect(policy.updated_at).toBeDefined();
      }
    }, 30000);
  });

  /**
   * Property 52: Audit Log Immutability
   * Feature: self-hosted-security-migration, Property 52: Audit Log Immutability
   * Validates: Requirements 9.8
   * 
   * For any audit log, it SHALL NOT be modifiable or deletable after creation
   */
  describe('Property 52: Audit Log Immutability', () => {
    it('should prevent modification of auth audit logs', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a test audit log
      const [log] = await db
        .insert(authAuditLogs)
        .values({
          user_id: testUserId,
          email: 'immutable-test@example.com',
          action: 'test_immutability',
          result: 'success',
          ip_address: '192.168.1.1',
          user_agent: 'Test Agent',
        })
        .returning();

      // Attempt to modify the log (should fail)
      await expect(async () => {
        await db
          .update(authAuditLogs)
          .set({ action: 'modified_action' })
          .where(eq(authAuditLogs.id, log.id));
      }).rejects.toThrow();
    }, 30000);

    it('should prevent deletion of auth audit logs', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a test audit log
      const [log] = await db
        .insert(authAuditLogs)
        .values({
          user_id: testUserId,
          email: 'delete-test@example.com',
          action: 'test_deletion',
          result: 'success',
          ip_address: '10.0.0.1',
          user_agent: 'Test',
        })
        .returning();

      // Attempt to delete the log (should fail)
      await expect(async () => {
        await db
          .delete(authAuditLogs)
          .where(eq(authAuditLogs.id, log.id));
      }).rejects.toThrow();

      // Verify log still exists
      const [foundLog] = await db
        .select()
        .from(authAuditLogs)
        .where(eq(authAuditLogs.id, log.id))
        .limit(1);

      expect(foundLog).toBeDefined();
      expect(foundLog.id).toBe(log.id);
    }, 30000);

    it('should prevent modification of general audit logs', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a test audit log with valid UUID
      const testResourceId = crypto.randomUUID();
      const [log] = await db
        .insert(auditLogs)
        .values({
          tenant_id: testTenantId,
          user_id: testUserId,
          action: 'test_immutability',
          resource_type: 'test_resource',
          resource_id: testResourceId,
          details: { test: true },
        })
        .returning();

      // Attempt to modify the log (should fail)
      await expect(async () => {
        await db
          .update(auditLogs)
          .set({ action: 'modified_action' })
          .where(eq(auditLogs.id, log.id));
      }).rejects.toThrow();
    }, 30000);

    it('should prevent deletion of general audit logs', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a test audit log with valid UUID
      const testResourceId = crypto.randomUUID();
      const [log] = await db
        .insert(auditLogs)
        .values({
          tenant_id: testTenantId,
          user_id: testUserId,
          action: 'test_deletion',
          resource_type: 'test_resource',
          resource_id: testResourceId,
          details: { test: true },
        })
        .returning();

      // Attempt to delete the log (should fail)
      await expect(async () => {
        await db
          .delete(auditLogs)
          .where(eq(auditLogs.id, log.id));
      }).rejects.toThrow();

      // Verify log still exists
      const [foundLog] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.id, log.id))
        .limit(1);

      expect(foundLog).toBeDefined();
      expect(foundLog.id).toBe(log.id);
    }, 30000);

    it('should verify immutability triggers are in place', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Query database triggers
      const triggers = await db.execute(sql`
        SELECT 
          trigger_name,
          event_manipulation,
          event_object_table
        FROM information_schema.triggers
        WHERE event_object_table IN ('auth_audit_logs', 'audit_logs')
          AND trigger_name LIKE '%prevent%'
        ORDER BY event_object_table, trigger_name
      `);

      // Should have triggers for both tables
      expect(triggers.length).toBeGreaterThanOrEqual(4); // 2 triggers per table (UPDATE, DELETE)

      // Verify auth_audit_logs triggers
      const authTriggers = triggers.filter(
        (t: any) => t.event_object_table === 'auth_audit_logs'
      );
      expect(authTriggers.length).toBeGreaterThanOrEqual(2);

      // Verify audit_logs triggers
      const auditTriggers = triggers.filter(
        (t: any) => t.event_object_table === 'audit_logs'
      );
      expect(auditTriggers.length).toBeGreaterThanOrEqual(2);
    }, 30000);

    it('should allow insertion of new audit logs', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Insertion should still work (only UPDATE/DELETE are blocked)
      const [log] = await db
        .insert(authAuditLogs)
        .values({
          user_id: testUserId,
          email: 'insert-test@example.com',
          action: 'test_insert',
          result: 'success',
          ip_address: '172.16.0.1',
          user_agent: 'Test',
        })
        .returning();

      expect(log).toBeDefined();
      expect(log.id).toBeDefined();
      expect(log.action).toBe('test_insert');
    }, 30000);
  });

  describe('Audit Log Query Views', () => {
    it('should have recent_auth_audit_logs view available', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Query the view
      const logs = await db.execute(sql`
        SELECT * FROM recent_auth_audit_logs
        LIMIT 5
      `);

      // View should exist and be queryable
      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
    }, 30000);

    it('should have recent_audit_logs view available', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Query the view
      const logs = await db.execute(sql`
        SELECT * FROM recent_audit_logs
        LIMIT 5
      `);

      // View should exist and be queryable
      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
    }, 30000);
  });
});
