/**
 * Authorization Failure Logging Property Tests
 * Tests for logging authorization failures
 * 
 * @jest-environment node
 * 
 * Properties tested:
 * - Property 28: Authorization Failure Logging
 * 
 * Validates: Requirements 5.7
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getClient } from '../database';
import { drizzle } from 'drizzle-orm/postgres-js';
import { authAuditLogs, users, tenants } from '../../../database/schemas/main';
import { eq, and, desc } from 'drizzle-orm';
import { logAccessDenied, AuditAction, AuditResult } from '../audit-logger';
import { NextRequest } from 'next/server';

describe('Authorization Failure Logging Property Tests', () => {
  let testTenant1Id: string;
  let testTenant2Id: string;
  let testUser1Id: string;
  let testUser2Id: string;
  let testUser1Email: string;
  let testUser2Email: string;

  beforeAll(async () => {
    // Create test tenants and users for authorization tests
    const client = await getClient();
    const db = drizzle(client);

    // Create two tenants for cross-tenant testing
    const [tenant1] = await db
      .insert(tenants)
      .values({
        name: 'Auth Test Tenant 1',
        domain: `auth-test-1-${Date.now()}.example.com`,
      })
      .returning();
    testTenant1Id = tenant1.id;

    const [tenant2] = await db
      .insert(tenants)
      .values({
        name: 'Auth Test Tenant 2',
        domain: `auth-test-2-${Date.now()}.example.com`,
      })
      .returning();
    testTenant2Id = tenant2.id;

    // Create users in different tenants
    const [user1] = await db
      .insert(users)
      .values({
        tenant_id: testTenant1Id,
        email: `auth-test-1-${Date.now()}@example.com`,
        first_name: 'Auth',
        last_name: 'Test1',
        role: 'user',
        password_hash: 'dummy-hash',
        email_verified: true,
      })
      .returning();
    testUser1Id = user1.id;
    testUser1Email = user1.email;

    const [user2] = await db
      .insert(users)
      .values({
        tenant_id: testTenant2Id,
        email: `auth-test-2-${Date.now()}@example.com`,
        first_name: 'Auth',
        last_name: 'Test2',
        role: 'user',
        password_hash: 'dummy-hash',
        email_verified: true,
      })
      .returning();
    testUser2Id = user2.id;
    testUser2Email = user2.email;
  });

  afterAll(async () => {
    // Cleanup is not needed as audit logs are immutable
    // Test data will be cleaned up with database reset
  });

  /**
   * Property 28: Authorization Failure Logging
   * Feature: self-hosted-security-migration, Property 28: Authorization Failure Logging
   * Validates: Requirements 5.7
   * 
   * For any authorization failure, the system SHALL log the failure with user, resource, and reason
   */
  describe('Property 28: Authorization Failure Logging', () => {
    it('should log permission denied events', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a mock request
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '192.168.1.100'],
          ['user-agent', 'Test Agent'],
        ]),
      } as unknown as NextRequest;

      // Log an access denied event
      await logAccessDenied(
        testUser1Id,
        testUser1Email,
        mockRequest,
        'admin_panel',
        'insufficient_permissions'
      );

      // Query the most recent auth audit log for this user
      const [log] = await db
        .select()
        .from(authAuditLogs)
        .where(
          and(
            eq(authAuditLogs.user_id, testUser1Id),
            eq(authAuditLogs.action, AuditAction.ACCESS_DENIED)
          )
        )
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      // Verify log was created
      expect(log).toBeDefined();
      expect(log.user_id).toBe(testUser1Id);
      expect(log.email).toBe(testUser1Email);
      expect(log.action).toBe(AuditAction.ACCESS_DENIED);
      expect(log.result).toBe(AuditResult.BLOCKED);
      expect(log.ip_address).toBe('192.168.1.100');
      expect(log.user_agent).toBe('Test Agent');
      expect(log.metadata).toBeDefined();
      expect(log.metadata.resource).toBe('admin_panel');
      expect(log.metadata.reason).toBe('insufficient_permissions');
    }, 30000);

    it('should log cross-tenant access attempts', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a mock request
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '10.0.0.50'],
          ['user-agent', 'Cross Tenant Test'],
        ]),
      } as unknown as NextRequest;

      // Log a cross-tenant access attempt
      await logAccessDenied(
        testUser1Id,
        testUser1Email,
        mockRequest,
        `tenant:${testTenant2Id}:data`,
        'cross_tenant_access'
      );

      // Query the most recent auth audit log for this user
      const [log] = await db
        .select()
        .from(authAuditLogs)
        .where(
          and(
            eq(authAuditLogs.user_id, testUser1Id),
            eq(authAuditLogs.action, AuditAction.ACCESS_DENIED)
          )
        )
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      // Verify log was created with cross-tenant details
      expect(log).toBeDefined();
      expect(log.user_id).toBe(testUser1Id);
      expect(log.action).toBe(AuditAction.ACCESS_DENIED);
      expect(log.result).toBe(AuditResult.BLOCKED);
      expect(log.metadata.resource).toContain(testTenant2Id);
      expect(log.metadata.reason).toBe('cross_tenant_access');
    }, 30000);

    it('should log role-based access denials', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a mock request
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '172.16.0.10'],
          ['user-agent', 'Role Test Agent'],
        ]),
      } as unknown as NextRequest;

      // Log a role-based access denial
      await logAccessDenied(
        testUser2Id,
        testUser2Email,
        mockRequest,
        'system_settings',
        'requires_admin_role'
      );

      // Query the most recent auth audit log for this user
      const [log] = await db
        .select()
        .from(authAuditLogs)
        .where(
          and(
            eq(authAuditLogs.user_id, testUser2Id),
            eq(authAuditLogs.action, AuditAction.ACCESS_DENIED)
          )
        )
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      // Verify log was created with role details
      expect(log).toBeDefined();
      expect(log.user_id).toBe(testUser2Id);
      expect(log.email).toBe(testUser2Email);
      expect(log.action).toBe(AuditAction.ACCESS_DENIED);
      expect(log.result).toBe(AuditResult.BLOCKED);
      expect(log.metadata.resource).toBe('system_settings');
      expect(log.metadata.reason).toBe('requires_admin_role');
    }, 30000);

    it('should include all required fields in authorization failure logs', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a mock request
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '203.0.113.42'],
          ['user-agent', 'Required Fields Test'],
        ]),
      } as unknown as NextRequest;

      // Log an access denied event
      await logAccessDenied(
        testUser1Id,
        testUser1Email,
        mockRequest,
        'sensitive_data',
        'insufficient_clearance'
      );

      // Query the most recent auth audit log
      const [log] = await db
        .select()
        .from(authAuditLogs)
        .where(
          and(
            eq(authAuditLogs.user_id, testUser1Id),
            eq(authAuditLogs.action, AuditAction.ACCESS_DENIED)
          )
        )
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      // Verify all required fields are present
      expect(log).toBeDefined();
      expect(log.id).toBeDefined();
      expect(log.user_id).toBeDefined();
      expect(log.email).toBeDefined();
      expect(log.action).toBeDefined();
      expect(log.result).toBeDefined();
      expect(log.ip_address).toBeDefined();
      expect(log.user_agent).toBeDefined();
      expect(log.metadata).toBeDefined();
      expect(log.created_at).toBeDefined();
      expect(log.created_at).toBeInstanceOf(Date);

      // Verify metadata contains resource and reason
      expect(log.metadata.resource).toBeDefined();
      expect(log.metadata.reason).toBeDefined();
    }, 30000);

    it('should log multiple authorization failures for the same user', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a mock request
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '198.51.100.25'],
          ['user-agent', 'Multiple Failures Test'],
        ]),
      } as unknown as NextRequest;

      // Log multiple access denied events
      const resources = ['resource_a', 'resource_b', 'resource_c'];
      for (const resource of resources) {
        await logAccessDenied(
          testUser2Id,
          testUser2Email,
          mockRequest,
          resource,
          'permission_denied'
        );
      }

      // Query all recent auth audit logs for this user
      const logs = await db
        .select()
        .from(authAuditLogs)
        .where(
          and(
            eq(authAuditLogs.user_id, testUser2Id),
            eq(authAuditLogs.action, AuditAction.ACCESS_DENIED)
          )
        )
        .orderBy(desc(authAuditLogs.created_at))
        .limit(10);

      // Verify multiple logs were created
      expect(logs.length).toBeGreaterThanOrEqual(3);

      // Verify each log has the correct action and result
      for (const log of logs.slice(0, 3)) {
        expect(log.user_id).toBe(testUser2Id);
        expect(log.action).toBe(AuditAction.ACCESS_DENIED);
        expect(log.result).toBe(AuditResult.BLOCKED);
      }
    }, 30000);

    it('should preserve authorization failure logs immutably', async () => {
      const client = await getClient();
      const db = drizzle(client);

      // Create a mock request
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '192.0.2.100'],
          ['user-agent', 'Immutability Test'],
        ]),
      } as unknown as NextRequest;

      // Log an access denied event
      await logAccessDenied(
        testUser1Id,
        testUser1Email,
        mockRequest,
        'protected_resource',
        'test_immutability'
      );

      // Query the log
      const [log] = await db
        .select()
        .from(authAuditLogs)
        .where(
          and(
            eq(authAuditLogs.user_id, testUser1Id),
            eq(authAuditLogs.action, AuditAction.ACCESS_DENIED)
          )
        )
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      expect(log).toBeDefined();

      // Attempt to modify the log (should fail due to immutability triggers)
      await expect(async () => {
        await db
          .update(authAuditLogs)
          .set({ result: 'modified' })
          .where(eq(authAuditLogs.id, log.id));
      }).rejects.toThrow();

      // Verify log is unchanged
      const [unchangedLog] = await db
        .select()
        .from(authAuditLogs)
        .where(eq(authAuditLogs.id, log.id))
        .limit(1);

      expect(unchangedLog.result).toBe(AuditResult.BLOCKED);
      expect(unchangedLog.metadata.reason).toBe('test_immutability');
    }, 30000);
  });
});
