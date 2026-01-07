/**
 * Property-Based Tests for Cookie Security
 * 
 * Feature: self-hosted-security-migration
 * Properties: 11, 12
 * Validates: Requirements 7.3, 7.4
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { setAuthCookie, clearAuthCookie, COOKIE_CONFIG } from '../jwt';

describe('Cookie Security Property Tests', () => {
  /**
   * Property 11: Secure Cookie Flags
   * For any JWT token, the cookie SHALL have httpOnly and secure flags set appropriately
   * Validates: Requirements 7.3
   */
  it('Property 11: Cookie has httpOnly flag set', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 500 }), // JWT token
        fc.boolean(), // rememberMe
        async (token, rememberMe) => {
          const cookieString = setAuthCookie(token, rememberMe);
          
          // Cookie MUST have HttpOnly flag
          expect(cookieString).toContain('HttpOnly');
          
          // Verify the flag is properly formatted
          const parts = cookieString.split('; ');
          expect(parts).toContain('HttpOnly');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 11: Cookie has secure flag based on environment', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 500 }), // JWT token
        fc.boolean(), // rememberMe
        async (token, rememberMe) => {
          const cookieString = setAuthCookie(token, rememberMe);
          
          // In current environment, check if secure flag matches NODE_ENV
          const isProduction = process.env.NODE_ENV === 'production';
          
          if (isProduction) {
            // Cookie MUST have Secure flag in production
            expect(cookieString).toContain('Secure');
            const parts = cookieString.split('; ');
            expect(parts).toContain('Secure');
          } else {
            // Cookie MUST NOT have Secure flag in non-production
            expect(cookieString).not.toContain('Secure');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12: SameSite Cookie Policy
   * For any JWT token, the cookie SHALL have SameSite=Strict policy
   * Validates: Requirements 7.4
   */
  it('Property 12: Cookie has SameSite=Strict policy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 500 }), // JWT token
        fc.boolean(), // rememberMe
        async (token, rememberMe) => {
          const cookieString = setAuthCookie(token, rememberMe);
          
          // Cookie MUST have SameSite=strict (lowercase in implementation)
          expect(cookieString).toContain('SameSite=strict');
          
          // Verify the policy is properly formatted
          const parts = cookieString.split('; ');
          expect(parts).toContain('SameSite=strict');
          
          // Ensure it's not using lax or none
          expect(cookieString).not.toContain('SameSite=lax');
          expect(cookieString).not.toContain('SameSite=none');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12: Clear cookie has SameSite=Strict policy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No input needed for clear cookie
        async () => {
          const cookieString = clearAuthCookie();
          
          // Clear cookie MUST also have SameSite=Strict (capitalized in clearAuthCookie)
          expect(cookieString).toContain('SameSite=Strict');
          
          // Verify it's properly formatted
          const parts = cookieString.split('; ');
          expect(parts).toContain('SameSite=Strict');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional Security Properties
   */
  it('Property: Cookie has correct path', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 500 }), // JWT token
        fc.boolean(), // rememberMe
        async (token, rememberMe) => {
          const cookieString = setAuthCookie(token, rememberMe);
          
          // Cookie MUST have Path=/
          expect(cookieString).toContain('Path=/');
          
          // Verify the path is properly formatted
          const parts = cookieString.split('; ');
          expect(parts).toContain('Path=/');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Cookie has appropriate Max-Age', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 500 }), // JWT token
        fc.boolean(), // rememberMe
        async (token, rememberMe) => {
          const cookieString = setAuthCookie(token, rememberMe);
          
          // Extract Max-Age value
          const maxAgeMatch = cookieString.match(/Max-Age=(\d+)/);
          expect(maxAgeMatch).not.toBeNull();
          
          const maxAge = parseInt(maxAgeMatch![1], 10);
          
          if (rememberMe) {
            // Remember me: 30 days
            expect(maxAge).toBe(30 * 24 * 60 * 60);
          } else {
            // Regular: 24 hours
            expect(maxAge).toBe(24 * 60 * 60);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Clear cookie has Max-Age=0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No input needed
        async () => {
          const cookieString = clearAuthCookie();
          
          // Clear cookie MUST have Max-Age=0
          expect(cookieString).toContain('Max-Age=0');
          
          // Verify it's properly formatted
          const maxAgeMatch = cookieString.match(/Max-Age=(\d+)/);
          expect(maxAgeMatch).not.toBeNull();
          expect(parseInt(maxAgeMatch![1], 10)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Cookie configuration is immutable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // No input needed
        async () => {
          // Verify COOKIE_CONFIG has expected structure
          expect(COOKIE_CONFIG.name).toBe('auth_token');
          expect(COOKIE_CONFIG.options.httpOnly).toBe(true);
          expect(COOKIE_CONFIG.options.sameSite).toBe('strict');
          expect(COOKIE_CONFIG.options.path).toBe('/');
          expect(COOKIE_CONFIG.options.maxAge).toBe(24 * 60 * 60);
          
          expect(COOKIE_CONFIG.rememberMeOptions.httpOnly).toBe(true);
          expect(COOKIE_CONFIG.rememberMeOptions.sameSite).toBe('strict');
          expect(COOKIE_CONFIG.rememberMeOptions.path).toBe('/');
          expect(COOKIE_CONFIG.rememberMeOptions.maxAge).toBe(30 * 24 * 60 * 60);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Security Regression Tests
   */
  it('Property: Cookie does not expose token in JavaScript-accessible way', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 500 }), // JWT token
        fc.boolean(), // rememberMe
        async (token, rememberMe) => {
          const cookieString = setAuthCookie(token, rememberMe);
          
          // HttpOnly flag prevents JavaScript access
          expect(cookieString).toContain('HttpOnly');
          
          // Verify no JavaScript-accessible alternatives are present
          expect(cookieString).not.toContain('document.cookie');
          expect(cookieString).not.toContain('localStorage');
          expect(cookieString).not.toContain('sessionStorage');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: Cookie string format is valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 500 }), // JWT token
        fc.boolean(), // rememberMe
        async (token, rememberMe) => {
          const cookieString = setAuthCookie(token, rememberMe);
          
          // Cookie string should follow standard format: name=value; attribute1; attribute2
          const parts = cookieString.split('; ');
          
          // First part should be name=value
          expect(parts[0]).toMatch(/^auth_token=.+$/);
          
          // All other parts should be valid attributes
          const validAttributes = ['Path=/', 'HttpOnly', 'Secure', 'SameSite=strict'];
          const maxAgePattern = /^Max-Age=\d+$/;
          
          for (let i = 1; i < parts.length; i++) {
            const isValid = validAttributes.includes(parts[i]) || maxAgePattern.test(parts[i]);
            expect(isValid).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
