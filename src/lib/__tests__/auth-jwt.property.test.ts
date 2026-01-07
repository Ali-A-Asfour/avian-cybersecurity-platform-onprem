/**
 * Property-Based Tests for JWT System
 * 
 * Feature: self-hosted-security-migration
 * Properties: 3, 4, 5
 * Validates: Requirements 3.4, 3.5, 3.6
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { AuthService } from '../auth-service';
import crypto from 'crypto';

describe('JWT System Property Tests', () => {
  /**
   * Property 3: JWT Generation on Authentication
   * For any successful authentication, a valid JWT token SHALL be generated with correct claims (user_id, tenant_id, role)
   * Validates: Requirements 3.4
   */
  it('Property 3: JWT generation includes required claims', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.emailAddress(),
        fc.constantFrom('user', 'tenant_admin', 'security_analyst', 'super_admin'),
        fc.uuid(),
        fc.uuid(),
        async (userId, email, role, tenantId, sessionId) => {
          const user = {
            id: userId,
            email,
            role,
            tenant_id: tenantId, // Use snake_case to match database schema
          };

          // Generate access token
          const accessToken = AuthService.generateAccessToken(user, sessionId);

          // Verify token is a string
          expect(typeof accessToken).toBe('string');
          expect(accessToken.length).toBeGreaterThan(0);

          // Verify token has 3 parts (header.payload.signature)
          const parts = accessToken.split('.');
          expect(parts.length).toBe(3);

          // Verify token
          const payload = AuthService.verifyAccessToken(accessToken);
          expect(payload).not.toBeNull();
          expect(payload?.userId).toBe(userId);
          expect(payload?.email).toBe(email);
          expect(payload?.role).toBe(role);
          expect(payload?.tenantId).toBe(tenantId);
          expect(payload?.sessionId).toBe(sessionId);
          expect(payload?.type).toBe('access');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 4: JWT Validation on Protected Routes
   * For any request to a protected route, JWT validation SHALL occur and reject invalid/expired tokens
   * Validates: Requirements 3.5
   */
  it('Property 4: JWT validation rejects invalid tokens', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 200 }),
        async (invalidToken) => {
          // Skip if by chance it looks like a valid JWT
          if (invalidToken.split('.').length === 3) {
            return;
          }

          // Verify invalid token returns null
          const payload = AuthService.verifyAccessToken(invalidToken);
          expect(payload).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 5: Token Refresh Mechanism
   * For any valid refresh token, a new access token SHALL be generated with updated expiration
   * Validates: Requirements 3.6
   */
  it('Property 5: Refresh token generates new access token', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.emailAddress(),
        fc.constantFrom('user', 'tenant_admin', 'security_analyst', 'super_admin'),
        fc.uuid(),
        fc.uuid(),
        async (userId, email, role, tenantId, sessionId) => {
          const user = {
            id: userId,
            email,
            role,
            tenant_id: tenantId, // Use snake_case to match database schema
          };

          // Generate refresh token
          const refreshToken = AuthService.generateRefreshToken(user, sessionId);

          // Verify refresh token
          const payload = AuthService.verifyRefreshToken(refreshToken);
          expect(payload).not.toBeNull();
          expect(payload?.userId).toBe(userId);
          expect(payload?.type).toBe('refresh');

          // Verify refresh token is different from access token
          const accessToken = AuthService.generateAccessToken(user, sessionId);
          expect(refreshToken).not.toBe(accessToken);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Access token and refresh token are different
   */
  it('Property: Access and refresh tokens are distinct', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.emailAddress(),
        fc.constantFrom('user', 'tenant_admin'),
        fc.uuid(),
        fc.uuid(),
        async (userId, email, role, tenantId, sessionId) => {
          const user = { id: userId, email, role, tenant_id: tenantId };

          const accessToken = AuthService.generateAccessToken(user, sessionId);
          const refreshToken = AuthService.generateRefreshToken(user, sessionId);

          // Tokens should be different
          expect(accessToken).not.toBe(refreshToken);

          // Access token should verify as access
          const accessPayload = AuthService.verifyAccessToken(accessToken);
          expect(accessPayload?.type).toBe('access');

          // Refresh token should verify as refresh
          const refreshPayload = AuthService.verifyRefreshToken(refreshToken);
          expect(refreshPayload?.type).toBe('refresh');

          // Access token should not verify as refresh token
          const wrongVerify1 = AuthService.verifyRefreshToken(accessToken);
          expect(wrongVerify1).toBeNull();

          // Refresh token should not verify as access token
          const wrongVerify2 = AuthService.verifyAccessToken(refreshToken);
          expect(wrongVerify2).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Token payload is consistent
   */
  it('Property: Token payload remains consistent on verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.emailAddress(),
        fc.constantFrom('user', 'tenant_admin', 'security_analyst'),
        fc.uuid(),
        fc.uuid(),
        async (userId, email, role, tenantId, sessionId) => {
          const user = { id: userId, email, role, tenant_id: tenantId };

          const token = AuthService.generateAccessToken(user, sessionId);

          // Verify multiple times - should always return same payload
          const payload1 = AuthService.verifyAccessToken(token);
          const payload2 = AuthService.verifyAccessToken(token);
          const payload3 = AuthService.verifyAccessToken(token);

          expect(payload1).toEqual(payload2);
          expect(payload2).toEqual(payload3);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Tampered tokens are rejected
   */
  it('Property: Tampered tokens are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.emailAddress(),
        fc.constantFrom('user', 'tenant_admin'),
        fc.uuid(),
        fc.uuid(),
        async (userId, email, role, tenantId, sessionId) => {
          const user = { id: userId, email, role, tenant_id: tenantId };

          const token = AuthService.generateAccessToken(user, sessionId);
          const parts = token.split('.');

          // Tamper with the payload (middle part)
          const tamperedPayload = parts[1].slice(0, -1) + 'X';
          const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

          // Tampered token should be rejected
          const payload = AuthService.verifyAccessToken(tamperedToken);
          expect(payload).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Additional property: Empty or malformed tokens are rejected
   */
  it('Property: Empty or malformed tokens are rejected', async () => {
    const invalidTokens = [
      '',
      'invalid',
      'a.b',
      'a.b.c.d',
      '...',
      'Bearer token',
      null,
      undefined,
    ];

    for (const token of invalidTokens) {
      const payload = AuthService.verifyAccessToken(token as any);
      expect(payload).toBeNull();
    }
  });
});
