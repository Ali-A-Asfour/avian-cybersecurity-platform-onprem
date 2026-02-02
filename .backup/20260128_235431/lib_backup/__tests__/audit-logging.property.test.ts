/**
 * Audit Logging Property Tests
 * Tests for comprehensive audit logging functionality
 * 
 * @jest-environment node
 * 
 * Properties tested:
 * - Property 46: Authentication Event Logging
 * - Property 47: Authorization Failure Logging
 * - Property 48: Data Access Logging
 * - Property 49: Administrative Action Logging
 * - Property 50: Audit Log Required Fields
 * 
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as fc from 'fast-check';
import {
  logAuthEvent,
  logAuditEvent,
  logLoginSuccess,
  logLoginFailure,
  logAccessDenied,
  AuditAction,
  AuditResult,
  extractClientInfo,
} from '../audit-logger';
import { getClient } from '../database';
import { drizzle } from 'drizzle-orm/postgres-js';
import { authAuditLogs, auditLogs, users, tenants } from '../../../database/schemas/main';
import { eq, desc } from 'drizzle-orm';
import { NextRequest } from 'next/server';

describe('Audit Logging Property Tests', () => {
  let testTenantId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create test tenant and user for foreign key constraints
    const client = await getClient();
    const db = drizzle(client);

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: 'Audit Test Tenant',
        domain: `audit-test-${Date.now()}.example.com`,
      })
      .returning();
    testTenantId = tenant.id;

    const [user] = await db
      .insert(users)
      .values({
        tenant_id: testTenantId,
        email: 'audit-test@example.com',
        first_name: 'Audit',
        last_name: 'Test',
        role: 'user',
        password_hash: 'dummy-hash',
        email_verified: true,
      })
      .returning();
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    const client = await getClient();
    const db = drizzle(client);
    await db.delete(tenants).where(eq(tenants.id, testTenantId));
  });

  describe('Property 46: Authentication Event Logging', () => {
    it('should log authentication events with all required fields', async () => {
      const client = await getClient();
      const db = drizzle(client);
      const email = 'test@example.com';
      
      await logAuthEvent({
        userId: testUserId,
        email,
        action: AuditAction.LOGIN,
        result: AuditResult.SUCCESS,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
      });

      const [log] = await db
        .select()
        .from(authAuditLogs)
        .where(eq(authAuditLogs.user_id, testUserId))
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      expect(log).toBeDefined();
      expect(log.user_id).toBe(testUserId);
      expect(log.email).toBe(email);
      expect(log.action).toBe(AuditAction.LOGIN);
      expect(log.result).toBe(AuditResult.SUCCESS);
      expect(log.ip_address).toBe('192.168.1.1');
      expect(log.user_agent).toBe('Test Agent');
      expect(log.created_at).toBeInstanceOf(Date);
    }, 30000);

    it('should log login success with session metadata', async () => {
      const client = await getClient();
      const db = drizzle(client);
      const sessionId = fc.sample(fc.uuid(), 1)[0];
      
      const req = new NextRequest('http://localhost/api/auth/login', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Test Agent',
        },
      });

      await logLoginSuccess(testUserId, 'user@test.com', req, {
        sessionId,
        rememberMe: true,
      });

      const [log] = await db
        .select()
        .from(authAuditLogs)
        .where(eq(authAuditLogs.user_id, testUserId))
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      expect(log.action).toBe(AuditAction.LOGIN);
      expect(log.result).toBe(AuditResult.SUCCESS);
      expect(log.metadata).toMatchObject({
        sessionId,
        rememberMe: true,
      });
    }, 30000);

    it('should log login failures with reason', async () => {
      const client = await getClient();
      const db = drizzle(client);
      const email = 'failed@test.com';
      const req = new NextRequest('http://localhost/api/auth/login', {
        headers: {
          'x-forwarded-for': '10.0.0.1',
          'user-agent': 'Test Browser',
        },
      });

      await logLoginFailure(email, req, 'Invalid password');

      const [log] = await db
        .select()
        .from(authAuditLogs)
        .where(eq(authAuditLogs.email, email))
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      expect(log.action).toBe(AuditAction.LOGIN_FAILED);
      expect(log.result).toBe(AuditResult.FAILURE);
      expect(log.metadata).toMatchObject({ reason: 'Invalid password' });
    }, 30000);
  });

  describe('Property 47: Authorization Failure Logging', () => {
    it('should log authorization failures with resource and reason', async () => {
      const client = await getClient();
      const db = drizzle(client);
      const req = new NextRequest('http://localhost/api/admin/users', {
        headers: {
          'x-forwarded-for': '172.16.0.1',
          'user-agent': 'API Client',
        },
      });

      await logAccessDenied(
        testUserId,
        'user@test.com',
        req,
        '/api/admin/users',
        'Insufficient permissions'
      );

      const [log] = await db
        .select()
        .from(authAuditLogs)
        .where(eq(authAuditLogs.user_id, testUserId))
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      expect(log.action).toBe(AuditAction.ACCESS_DENIED);
      expect(log.result).toBe(AuditResult.BLOCKED);
      expect(log.metadata).toMatchObject({
        resource: '/api/admin/users',
        reason: 'Insufficient permissions',
      });
      expect(log.ip_address).toBe('172.16.0.1');
    }, 30000);
  });

  describe('Property 48: Data Access Logging', () => {
    it('should log data access events with resource details', async () => {
      const client = await getClient();
      const db = drizzle(client);
      const resourceId = fc.sample(fc.uuid(), 1)[0];

      await logAuditEvent({
        tenantId: testTenantId,
        userId: testUserId,
        action: 'read',
        resourceType: 'device',
        resourceId,
        ipAddress: '192.168.1.100',
        userAgent: 'Test Client',
      });

      const [log] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.user_id, testUserId))
        .orderBy(desc(auditLogs.created_at))
        .limit(1);

      expect(log.tenant_id).toBe(testTenantId);
      expect(log.user_id).toBe(testUserId);
      expect(log.action).toBe('read');
      expect(log.resource_type).toBe('device');
      expect(log.resource_id).toBe(resourceId);
    }, 30000);

    it('should include tenant isolation in data access logs', async () => {
      const client = await getClient();
      const db = drizzle(client);
      
      await logAuditEvent({
        tenantId: testTenantId,
        userId: testUserId,
        action: 'update',
        resourceType: 'alert',
        resourceId: fc.sample(fc.uuid(), 1)[0],
      });

      const [log] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.tenant_id, testTenantId))
        .orderBy(desc(auditLogs.created_at))
        .limit(1);

      expect(log.tenant_id).toBe(testTenantId);
    }, 30000);
  });

  describe('Property 49: Administrative Action Logging', () => {
    it('should log administrative actions with complete context', async () => {
      const client = await getClient();
      const db = drizzle(client);
      const targetUserId = fc.sample(fc.uuid(), 1)[0];

      await logAuditEvent({
        tenantId: testTenantId,
        userId: testUserId,
        action: 'user_created',
        resourceType: 'user',
        resourceId: targetUserId,
        metadata: {
          targetUserId,
          adminAction: true,
        },
        ipAddress: '10.0.0.1',
        userAgent: 'Admin Console',
      });

      const [log] = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.user_id, testUserId))
        .orderBy(desc(auditLogs.created_at))
        .limit(1);

      expect(log.action).toBe('user_created');
      expect(log.resource_type).toBe('user');
      expect(log.resource_id).toBe(targetUserId);
      expect(log.details).toMatchObject({
        targetUserId,
        adminAction: true,
      });
    }, 30000);
  });

  describe('Property 50: Audit Log Required Fields', () => {
    it('should always include required fields in auth audit logs', async () => {
      const client = await getClient();
      const db = drizzle(client);
      
      await logAuthEvent({
        userId: null,
        email: undefined,
        action: 'test_action',
        result: 'test_result',
        ipAddress: '127.0.0.1',
        userAgent: 'Test',
      });

      const [log] = await db
        .select()
        .from(authAuditLogs)
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      // Required fields must always be present
      expect(log.id).toBeDefined();
      expect(log.action).toBeDefined();
      expect(log.result).toBeDefined();
      expect(log.created_at).toBeInstanceOf(Date);
    }, 30000);

    it('should always include required fields in general audit logs', async () => {
      const client = await getClient();
      const db = drizzle(client);
      
      await logAuditEvent({
        tenantId: null,
        userId: null,
        action: 'test_action',
        resourceType: 'test_resource',
      });

      const [log] = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.created_at))
        .limit(1);

      // Required fields must always be present
      expect(log.id).toBeDefined();
      expect(log.action).toBeDefined();
      expect(log.resource_type).toBeDefined();
      expect(log.created_at).toBeInstanceOf(Date);
      expect(log.details).toBeDefined(); // Default to {}
    }, 30000);

    it('should preserve metadata in audit logs', async () => {
      const client = await getClient();
      const db = drizzle(client);
      const metadata = {
        key1: 'value1',
        key2: 123,
        key3: true,
      };

      await logAuthEvent({
        userId: testUserId,
        action: 'test_action',
        result: 'success',
        metadata,
      });

      const [log] = await db
        .select()
        .from(authAuditLogs)
        .where(eq(authAuditLogs.user_id, testUserId))
        .orderBy(desc(authAuditLogs.created_at))
        .limit(1);

      expect(log.metadata).toMatchObject(metadata);
    }, 30000);
  });

  describe('Client Information Extraction', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const req = new NextRequest('http://localhost/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
        },
      });

      const { ipAddress } = extractClientInfo(req);
      expect(ipAddress).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const req = new NextRequest('http://localhost/test', {
        headers: {
          'x-real-ip': '10.0.0.1',
        },
      });

      const { ipAddress } = extractClientInfo(req);
      expect(ipAddress).toBe('10.0.0.1');
    });

    it('should handle multiple IPs in x-forwarded-for', () => {
      const req = new NextRequest('http://localhost/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
        },
      });

      const { ipAddress } = extractClientInfo(req);
      expect(ipAddress).toBe('192.168.1.1'); // Should use first IP
    });

    it('should return unknown when no IP headers present', () => {
      const req = new NextRequest('http://localhost/test');
      const { ipAddress } = extractClientInfo(req);
      expect(ipAddress).toBe('unknown');
    });
  });
});
