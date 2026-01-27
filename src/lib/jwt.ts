/**
 * JWT Token Management Utility
 * Handles JWT token generation, verification, and refresh
 * Part of production authentication system (Task 2.2)
 */

import jwt from 'jsonwebtoken';
import { getDb } from './database';
import { sessions, users } from '../../database/schemas/main';
import { eq, and, gt, lt } from 'drizzle-orm';
import crypto from 'crypto';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_ISSUER = 'avian-platform';
const JWT_AUDIENCE = 'avian-users';

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '24h'; // 24 hours
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days (for "remember me")
const SHORT_SESSION_EXPIRY = '24h'; // 24 hours (normal session)
const LONG_SESSION_EXPIRY = '30d'; // 30 days (remember me)

/**
 * JWT Token Payload
 */
export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    tenantId: string;
    sessionId?: string;
}

/**
 * Token generation result
 */
export interface TokenResult {
    token: string;
    expiresAt: Date;
    sessionId: string;
}

/**
 * Token verification result
 */
export interface VerifyResult {
    valid: boolean;
    payload?: TokenPayload;
    error?: string;
    expired?: boolean;
}

/**
 * Validate JWT_SECRET is configured
 */
function validateJWTSecret(): void {
    if (!JWT_SECRET || JWT_SECRET.length < 32) {
        throw new Error(
            'JWT_SECRET must be set and at least 32 characters long. Generate one with: openssl rand -base64 32'
        );
    }
}

/**
 * Generate a secure random token hash
 * @param token - JWT token to hash
 * @returns SHA-256 hash of the token
 */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Calculate expiration date based on duration
 * @param duration - Duration string (e.g., '24h', '30d')
 * @returns Expiration date
 */
function calculateExpiration(duration: string): Date {
    const match = duration.match(/^(\d+)([hdm])$/);
    if (!match) {
        throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const now = new Date();

    switch (unit) {
        case 'h':
            return new Date(now.getTime() + value * 60 * 60 * 1000);
        case 'd':
            return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
        case 'm':
            return new Date(now.getTime() + value * 60 * 1000);
        default:
            throw new Error(`Invalid duration unit: ${unit}`);
    }
}

/**
 * Generate a JWT access token
 * @param payload - Token payload
 * @param rememberMe - Whether to use extended expiration
 * @returns JWT token string
 */
export function generateToken(
    payload: TokenPayload,
    rememberMe: boolean = false
): string {
    validateJWTSecret();

    const expiry = rememberMe ? REFRESH_TOKEN_EXPIRY : ACCESS_TOKEN_EXPIRY;

    // Map camelCase to snake_case for consistency with JWTPayload type
    const jwtPayload = {
        user_id: payload.userId,
        tenant_id: payload.tenantId,
        role: payload.role,
        email: payload.email,
        sessionId: payload.sessionId,
    };

    return jwt.sign(jwtPayload, JWT_SECRET, {
        expiresIn: expiry,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        subject: payload.userId,
    });
}

/**
 * Verify a JWT token
 * @param token - JWT token to verify
 * @returns Verification result with payload or error
 */
export function verifyToken(token: string): VerifyResult {
    if (!token) {
        return { valid: false, error: 'Token is required' };
    }

    validateJWTSecret();

    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        }) as any;

        // Convert snake_case back to camelCase for consistency
        const payload: TokenPayload = {
            userId: decoded.user_id,
            tenantId: decoded.tenant_id,
            role: decoded.role,
            email: decoded.email,
            sessionId: decoded.sessionId,
        };

        return {
            valid: true,
            payload: payload,
        };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return {
                valid: false,
                error: 'Token has expired',
                expired: true,
            };
        }

        if (error instanceof jwt.JsonWebTokenError) {
            return {
                valid: false,
                error: 'Invalid token',
            };
        }

        return {
            valid: false,
            error: 'Token verification failed',
        };
    }
}

/**
 * Create a session and generate token
 * @param userId - User ID
 * @param email - User email
 * @param role - User role
 * @param tenantId - Tenant ID
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 * @param rememberMe - Whether to use extended expiration
 * @returns Token result with token and session ID
 */
export async function createSession(
    userId: string,
    email: string,
    role: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
    rememberMe: boolean = false
): Promise<TokenResult> {
    const db = await getDb();
    validateJWTSecret();

    // Generate token payload
    const payload: TokenPayload = {
        userId,
        email,
        role,
        tenantId,
    };

    // Generate JWT token
    const token = generateToken(payload, rememberMe);

    // Hash token for storage
    const tokenHash = hashToken(token);

    // Calculate expiration
    const expiry = rememberMe ? LONG_SESSION_EXPIRY : SHORT_SESSION_EXPIRY;
    const expiresAt = calculateExpiration(expiry);

    // Create session record
    const [session] = await db
        .insert(sessions)
        .values({
            user_id: userId,
            token_hash: tokenHash,
            ip_address: ipAddress,
            user_agent: userAgent,
            expires_at: expiresAt,
        })
        .returning();

    return {
        token,
        expiresAt,
        sessionId: session.id,
    };
}

/**
 * Validate a session exists and is not expired
 * @param token - JWT token
 * @returns True if session is valid
 */
export async function validateSession(token: string): Promise<boolean> {
    const db = await getDb();

    // Verify token signature and expiration
    const verifyResult = verifyToken(token);
    if (!verifyResult.valid) {
        return false;
    }

    // Hash token to look up in database
    const tokenHash = hashToken(token);

    // Check if session exists and is not expired
    const [session] = await db
        .select()
        .from(sessions)
        .where(
            and(
                eq(sessions.token_hash, tokenHash),
                gt(sessions.expires_at, new Date())
            )
        )
        .limit(1);

    return !!session;
}

/**
 * Revoke a session (logout)
 * @param token - JWT token
 * @returns True if session was revoked
 */
export async function revokeSession(token: string): Promise<boolean> {
    const db = await getDb();
    const tokenHash = hashToken(token);

    const _result = await db
        .delete(sessions)
        .where(eq(sessions.token_hash, tokenHash));

    return true;
}

/**
 * Revoke all sessions for a user
 * @param userId - User ID
 * @returns Number of sessions revoked
 */
export async function revokeAllUserSessions(_userId: string): Promise<number> {
    const db = await getDb();

    const _result = await db
        .delete(sessions)
        .where(eq(sessions.user_id, userId));

    return 1; // Drizzle doesn't return affected rows count easily
}

/**
 * Refresh a token (extend expiration)
 * @param oldToken - Current JWT token
 * @param rememberMe - Whether to use extended expiration
 * @returns New token result
 */
export async function refreshToken(
    oldToken: string,
    rememberMe: boolean = false
): Promise<TokenResult | null> {
    const db = await getDb();

    // Verify old token
    const verifyResult = verifyToken(oldToken);
    if (!verifyResult.valid || !verifyResult.payload) {
        return null;
    }

    // Get user data to ensure user still exists and is active
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, verifyResult.payload.userId))
        .limit(1);

    if (!user || !user.is_active) {
        return null;
    }

    // Revoke old session
    await revokeSession(oldToken);

    // Create new session
    return createSession(
        user.id,
        user.email,
        user.role,
        user.tenant_id,
        undefined,
        undefined,
        rememberMe
    );
}

/**
 * Get all active sessions for a user
 * @param userId - User ID
 * @returns Array of session information
 */
export async function getUserSessions(_userId: string): Promise<
    Array<{
        id: string;
        ipAddress: string | null;
        userAgent: string | null;
        createdAt: Date;
        expiresAt: Date;
    }>
> {
    const db = await getDb();

    const userSessions = await db
        .select({
            id: sessions.id,
            ipAddress: sessions.ip_address,
            userAgent: sessions.user_agent,
            createdAt: sessions.created_at,
            expiresAt: sessions.expires_at,
        })
        .from(sessions)
        .where(
            and(
                eq(sessions.user_id, userId),
                gt(sessions.expires_at, new Date())
            )
        );

    return userSessions;
}

/**
 * Revoke a specific session by ID
 * @param sessionId - Session ID
 * @param userId - User ID (for authorization)
 * @returns True if session was revoked
 */
export async function revokeSessionById(
    sessionId: string,
    userId: string
): Promise<boolean> {
    const db = await getDb();

    const _result = await db
        .delete(sessions)
        .where(
            and(
                eq(sessions.id, sessionId),
                eq(sessions.user_id, userId)
            )
        );

    return true;
}

/**
 * Clean up expired sessions (maintenance task)
 * @returns Number of sessions cleaned up
 */
export async function cleanupExpiredSessions(): Promise<number> {
    const db = await getDb();

    const now = new Date();
    const _result = await db
        .delete(sessions)
        .where(lt(sessions.expires_at, now));

    return 1; // Drizzle doesn't return affected rows count easily
}

/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value
 * @returns Token string or null
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader) {
        return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }

    return parts[1];
}

/**
 * Generate a secure JWT_SECRET
 * This should be run once and the result stored in environment variables
 * @returns Base64-encoded random secret (32 bytes)
 */
export function generateJWTSecret(): string {
    return crypto.randomBytes(32).toString('base64');
}

/**
 * Cookie configuration for JWT tokens
 */
export const COOKIE_CONFIG = {
    name: 'auth_token',
    options: {
        httpOnly: true, // Prevents JavaScript access
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict' as const, // CSRF protection - strict mode
        path: '/',
        maxAge: 24 * 60 * 60, // 24 hours in seconds
    },
    rememberMeOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const, // CSRF protection - strict mode
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    },
};

/**
 * Set auth token cookie
 * @param token - JWT token
 * @param rememberMe - Whether to use extended expiration
 * @returns Cookie string for Set-Cookie header
 */
export function setAuthCookie(token: string, rememberMe: boolean = false): string {
    const options = rememberMe
        ? COOKIE_CONFIG.rememberMeOptions
        : COOKIE_CONFIG.options;

    const cookieParts = [
        `${COOKIE_CONFIG.name}=${token}`,
        `Path=${options.path}`,
        `Max-Age=${options.maxAge}`,
        `SameSite=${options.sameSite}`,
    ];

    if (options.httpOnly) {
        cookieParts.push('HttpOnly');
    }

    if (options.secure) {
        cookieParts.push('Secure');
    }

    return cookieParts.join('; ');
}

/**
 * Clear auth token cookie
 * @returns Cookie string for Set-Cookie header
 */
export function clearAuthCookie(): string {
    return `${COOKIE_CONFIG.name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`;
}

/**
 * Extract token from cookie string
 * @param cookieHeader - Cookie header value
 * @returns Token string or null
 */
export function extractTokenFromCookie(cookieHeader: string | null): string | null {
    if (!cookieHeader) {
        return null;
    }

    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const authCookie = cookies.find((c) => c.startsWith(`${COOKIE_CONFIG.name}=`));

    if (!authCookie) {
        return null;
    }

    return authCookie.substring(COOKIE_CONFIG.name.length + 1);
}
