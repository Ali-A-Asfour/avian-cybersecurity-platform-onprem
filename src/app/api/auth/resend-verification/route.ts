/**
 * Resend Email Verification API Endpoint
 * POST /api/auth/resend-verification
 * Resends email verification link
 * Part of production authentication system (Task 4.4)
 */

import { NextRequest, NextResponse } from 'next/server';
// import { db } from '@/lib/database';
import { users, emailVerificationTokens } from '../../../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { logAuthEvent, AuditAction, AuditResult, extractClientInfo } from '@/lib/audit-logger';

/**
 * Token configuration
 */
const TOKEN_EXPIRY_HOURS = 24; // Email verification token expires in 24 hours
const TOKEN_LENGTH = 32; // 32 bytes = 64 hex characters

/**
 * Rate limiting (in-memory)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 3; // Max 3 resend requests per hour

/**
 * Check rate limit
 */
function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return { allowed: true };
    }

    if (record.count >= MAX_REQUESTS) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return { allowed: false, retryAfter };
    }

    record.count++;
    return { allowed: true };
}

/**
 * Generate verification token
 */
function generateVerificationToken(): string {
    return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Send verification email (placeholder)
 */
async function sendVerificationEmail(
    email: string,
    token: string,
    userName: string
): Promise<void> {
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

    console.log('='.repeat(80));
    console.log('EMAIL VERIFICATION');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Name: ${userName}`);
    console.log(`Verification URL: ${verifyUrl}`);
    console.log(`Token expires in: ${TOKEN_EXPIRY_HOURS} hours`);
    console.log('='.repeat(80));

    // TODO: Implement with your email service
}

/**
 * POST /api/auth/resend-verification
 * Resend email verification
 */
export async function POST(req: NextRequest) {
    const { ipAddress, userAgent } = extractClientInfo(req);

    try {
        if (!db) {
            return NextResponse.json(
                { error: 'Service temporarily unavailable' },
                { status: 503 }
            );
        }

        // Check rate limit
        const rateLimit = checkRateLimit(ipAddress);
        if (!rateLimit.allowed) {
            await logAuthEvent({
                action: AuditAction.EMAIL_VERIFICATION_SENT,
                result: AuditResult.RATE_LIMITED,
                ipAddress,
                userAgent,
                metadata: { retryAfter: rateLimit.retryAfter },
            });

            return NextResponse.json(
                {
                    error: `Too many verification requests. Please try again in ${Math.ceil((rateLimit.retryAfter || 0) / 60)} minutes.`,
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': rateLimit.retryAfter?.toString() || '3600',
                    },
                }
            );
        }

        // Parse request body
        let body: { email: string };
        try {
            body = await req.json();
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        const { email } = body;

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();

        // Find user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        // Always return success to prevent user enumeration
        const successResponse = {
            success: true,
            message: 'If an unverified account exists with this email, a verification link has been sent.',
        };

        if (!user) {
            await logAuthEvent({
                email: normalizedEmail,
                action: AuditAction.EMAIL_VERIFICATION_SENT,
                result: AuditResult.FAILURE,
                ipAddress,
                userAgent,
                metadata: { reason: 'User not found' },
            });

            return NextResponse.json(successResponse, { status: 200 });
        }

        // Check if already verified
        if (user.email_verified) {
            await logAuthEvent({
                userId: user.id,
                email: normalizedEmail,
                action: AuditAction.EMAIL_VERIFICATION_SENT,
                result: AuditResult.SUCCESS,
                ipAddress,
                userAgent,
                metadata: { reason: 'Already verified' },
            });

            return NextResponse.json(successResponse, { status: 200 });
        }

        // Check if account is active
        if (!user.is_active) {
            await logAuthEvent({
                userId: user.id,
                email: normalizedEmail,
                action: AuditAction.EMAIL_VERIFICATION_SENT,
                result: AuditResult.BLOCKED,
                ipAddress,
                userAgent,
                metadata: { reason: 'Account inactive' },
            });

            return NextResponse.json(successResponse, { status: 200 });
        }

        // Delete any existing verification tokens for this user
        await db
            .delete(emailVerificationTokens)
            .where(eq(emailVerificationTokens.user_id, user.id));

        // Generate new verification token
        const token = generateVerificationToken();
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        // Store token
        await db.insert(emailVerificationTokens).values({
            user_id: user.id,
            token,
            expires_at: expiresAt,
        });

        // Send verification email
        const userName = `${user.first_name} ${user.last_name}`;
        await sendVerificationEmail(normalizedEmail, token, userName);

        // Log success
        await logAuthEvent({
            userId: user.id,
            email: normalizedEmail,
            action: AuditAction.EMAIL_VERIFICATION_SENT,
            result: AuditResult.SUCCESS,
            ipAddress,
            userAgent,
            metadata: { expiresAt: expiresAt.toISOString() },
        });

        return NextResponse.json(successResponse, { status: 200 });
    } catch (error) {
        console.error('Resend verification error:', error);

        await logAuthEvent({
            action: AuditAction.EMAIL_VERIFICATION_SENT,
            result: AuditResult.ERROR,
            ipAddress,
            userAgent,
            metadata: {
                error: error instanceof Error ? error.message : 'Unknown error',
            },
        });

        return NextResponse.json(
            { error: 'An error occurred. Please try again later.' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/auth/resend-verification
 * Get configuration
 */
export async function GET() {
    return NextResponse.json({
        config: {
            tokenExpiryHours: TOKEN_EXPIRY_HOURS,
            rateLimitWindowMinutes: RATE_LIMIT_WINDOW_MS / (60 * 1000),
            maxRequestsPerWindow: MAX_REQUESTS,
        },
    });
}
