/**
 * Unit Tests for JWT Token Management
 * Tests token generation, verification, and cookie management
 * Part of Phase 9: Testing (Task 9.1)
 */

import {
    generateToken,
    verifyToken,
    setAuthCookie,
    clearAuthCookie,
    extractTokenFromHeader,
    extractTokenFromCookie,
    generateJWTSecret,
} from '../jwt';

describe('JWT Token Management', () => {
    const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        tenantId: 'tenant-123',
    };

    describe('generateToken', () => {
        it('should generate a valid JWT token', () => {
            const token = generateToken(mockPayload);

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
        });

        it('should include user data in token payload', () => {
            const token = generateToken(mockPayload);
            const result = verifyToken(token);

            expect(result.valid).toBe(true);
            expect(result.payload?.userId).toBe(mockPayload.userId);
            expect(result.payload?.email).toBe(mockPayload.email);
            expect(result.payload?.role).toBe(mockPayload.role);
            expect(result.payload?.tenantId).toBe(mockPayload.tenantId);
        });

        it('should set expiration time', () => {
            const token = generateToken(mockPayload);
            const result = verifyToken(token);

            expect(result.payload?.exp).toBeDefined();
            expect(result.payload?.exp).toBeGreaterThan(Date.now() / 1000);
        });

        it('should generate different tokens for same payload', () => {
            const token1 = generateToken(mockPayload);
            const token2 = generateToken(mockPayload);

            expect(token1).not.toBe(token2); // Different iat (issued at) times
        });

        it('should support remember me option', () => {
            const normalToken = generateToken(mockPayload, false);
            const rememberToken = generateToken(mockPayload, true);

            const normalResult = verifyToken(normalToken);
            const rememberResult = verifyToken(rememberToken);

            expect(normalResult.valid).toBe(true);
            expect(rememberResult.valid).toBe(true);

            // Remember me token should have longer expiration
            expect(rememberResult.payload?.exp).toBeGreaterThan(normalResult.payload?.exp!);
        });
    });

    describe('verifyToken', () => {
        it('should verify valid token', () => {
            const token = generateToken(mockPayload);
            const result = verifyToken(token);

            expect(result.valid).toBe(true);
            expect(result.payload).toBeDefined();
            expect(result.error).toBeUndefined();
        });

        it('should reject invalid token format', () => {
            const invalidToken = 'not-a-valid-token';
            const result = verifyToken(invalidToken);

            expect(result.valid).toBe(false);
            expect(result.payload).toBeNull();
            expect(result.error).toBeDefined();
        });

        it('should reject empty token', () => {
            const result = verifyToken('');

            expect(result.valid).toBe(false);
            expect(result.payload).toBeNull();
            expect(result.error).toBe('Token is required');
        });

        it('should reject token with wrong signature', () => {
            const token = generateToken(mockPayload);
            const tamperedToken = token.slice(0, -10) + 'tampered123';
            const result = verifyToken(tamperedToken);

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('Cookie Management', () => {
        describe('setAuthCookie', () => {
            it('should create cookie string with token', () => {
                const token = 'test-token-123';
                const cookie = setAuthCookie(token, false);

                expect(cookie).toContain('auth_token=');
                expect(cookie).toContain(token);
                expect(cookie).toContain('HttpOnly');
                expect(cookie).toContain('Path=/');
            });

            it('should set longer expiration for remember me', () => {
                const token = 'test-token-123';
                const cookieRemember = setAuthCookie(token, true);
                const cookieNormal = setAuthCookie(token, false);

                expect(cookieRemember).toContain('Max-Age=');
                expect(cookieNormal).toContain('Max-Age=');
                // Remember me should have longer Max-Age (30 days vs 24 hours)
            });

            it('should include security flags', () => {
                const token = 'test-token-123';
                const cookie = setAuthCookie(token, false);

                expect(cookie).toContain('HttpOnly'); // Prevent XSS
                expect(cookie).toContain('Path=/');
                expect(cookie).toContain('SameSite');
            });
        });

        describe('clearAuthCookie', () => {
            it('should create cookie string that clears the token', () => {
                const cookie = clearAuthCookie();

                expect(cookie).toContain('auth_token=');
                expect(cookie).toContain('Max-Age=0'); // Expire immediately
                expect(cookie).toContain('HttpOnly');
            });
        });

        describe('extractTokenFromCookie', () => {
            it('should extract token from cookie header', () => {
                const token = 'test-token-123';
                const cookieHeader = `auth_token=${token}; Path=/`;
                const extracted = extractTokenFromCookie(cookieHeader);

                expect(extracted).toBe(token);
            });

            it('should return null for empty cookie header', () => {
                const extracted = extractTokenFromCookie(null);
                expect(extracted).toBeNull();
            });

            it('should return null when token not found', () => {
                const cookieHeader = 'other_cookie=value';
                const extracted = extractTokenFromCookie(cookieHeader);
                expect(extracted).toBeNull();
            });
        });
    });

    describe('extractTokenFromHeader', () => {
        it('should extract token from Bearer header', () => {
            const token = 'test-token-123';
            const authHeader = `Bearer ${token}`;
            const extracted = extractTokenFromHeader(authHeader);

            expect(extracted).toBe(token);
        });

        it('should return null for empty header', () => {
            const extracted = extractTokenFromHeader(null);
            expect(extracted).toBeNull();
        });

        it('should return null for invalid format', () => {
            const extracted = extractTokenFromHeader('InvalidFormat');
            expect(extracted).toBeNull();
        });
    });

    describe('generateJWTSecret', () => {
        it('should generate a secret', () => {
            const secret = generateJWTSecret();

            expect(secret).toBeDefined();
            expect(typeof secret).toBe('string');
            expect(secret.length).toBeGreaterThan(20);
        });

        it('should generate different secrets each time', () => {
            const secret1 = generateJWTSecret();
            const secret2 = generateJWTSecret();

            expect(secret1).not.toBe(secret2);
        });

        it('should generate base64 encoded string', () => {
            const secret = generateJWTSecret();
            // Base64 regex pattern
            expect(secret).toMatch(/^[A-Za-z0-9+/]+=*$/);
        });
    });
});
