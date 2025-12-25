/**
 * Forgot Password API Endpoint
 * POST /api/auth/forgot-password
 * Generates password reset token and sends reset email
 * Part of production authentication system (Task 3.1)
 */

import { NextRequest, NextResponse } from 'next/server';
// import { db } from '@/lib/database';
import { users, passwordResetTokens, authAuditLogs } from '../../../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 3; // Max 3 requests per 15 minutes

/**
 * Token configuration
 */
const TOKEN_EXPIRY_HOURS = 1; // Password reset token expires in 1 hour
const TOKEN_LENGTH = 32; // 32 bytes = 64 hex characters

/**
 * In-memory rate limiting (in production, use Redis)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit for an IP address
 */
function checkRateLimit(_ipAddress: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const record = rateLimitStore.get(ipAddress);

    if (!record || now > record.resetAt) {
        // Create new record
        rateLimitStore.set(ipAddress, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return { allowed: true };
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return { allowed: false, retryAfter };
    }

    // Increment count
    record.count++;
    return { allowed: true };
}

/**
 * Generate a secure random token
 */
function generateResetToken(): string {
    return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Log authentication event
 */
async function logAuthEvent(
    userId: string | null,
    email: string,
    action: string,
    result: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>
): Promise<void> {
    if (!db) return;

    try {
        await db.insert(authAuditLogs).values({
            user_id: userId,
            email,
            action,
            result,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: metadata || {},
        });
    } catch (error) {
        console.error('Failed to log auth event:', error);
    }
}

/**
 * Send password reset email (placeholder - implement with your email service)
 */
async function sendPasswordResetEmail(
    email: string,
    token: string,
    userName: string
): Promise<void> {
    // TODO: Implement with your email service (SendGrid, AWS SES, etc.)
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    console.log('='.repeat(80));
    console.log('PASSWORD RESET EMAIL');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Name: ${userName}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log(`Token expires in: ${TOKEN_EXPIRY_HOURS} hour(s)`);
    console.log('='.repeat(80));

    // In production, replace with actual email service:
    /*
    await emailService.send({
      to: email,
      subject: 'Password Reset Request - Avian Cybersecurity Platform',
      template: 'password-reset',
      data: {
        userName,
        resetUrl,
        expiryHours: TOKEN_EXPIRY_HOURS,
      },
    });
    */
}

/**
 * POST /api/auth/forgot-password
 * Generate password reset token and send email
 */
export async function POST(req: NextRequest) {
    const startTime = Date.now();
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    try {
        // Check database connection
        if (!db) {
            return NextResponse.json(
                { error: 'Service temporarily unavailable' },
                { status: 503 }
            );
        }

        // Check rate limit
        const rateLimit = checkRateLimit(ipAddress);
        if (!rateLimit.allowed) {
            await logAuthEvent(
                null,
                'unknown',
                'forgot_password',
                'rate_limited',
                ipAddress,
                userAgent,
                { retryAfter: rateLimit.retryAfter }
            );

            return NextResponse.json(
                {
                    error: `Too many password reset requests. Please try again in ${rateLimit.retryAfter} seconds.`,
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': rateLimit.retryAfter?.toString() || '900',
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

        // Validate email
        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        // Normalize email
        const normalizedEmail = email.toLowerCase().trim();

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Find user by email
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        // Always return success to prevent user enumeration
        // Don't reveal whether the email exists or not
        const successResponse = {
            success: true,
            message: 'If an account exists with this email, you will receive a password reset link shortly.',
        };

        if (!user) {
            // Log attempt for non-existent user
            await logAuthEvent(
                null,
                normalizedEmail,
                'forgot_password',
                'user_not_found',
                ipAddress,
                userAgent
            );

            // Still return success to prevent enumeration
            return NextResponse.json(successResponse, { status: 200 });
        }

        // Check if account is active
        if (!user.is_active) {
            await logAuthEvent(
                user.id,
                normalizedEmail,
                'forgot_password',
                'account_inactive',
                ipAddress,
                userAgent
            );

            // Still return success to prevent enumeration
            return NextResponse.json(successResponse, { status: 200 });
        }

        // Generate reset token
        const resetToken = generateResetToken();
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        // Store token in database
        await db.insert(passwordResetTokens).values({
            user_id: user.id,
            token: resetToken,
            expires_at: expiresAt,
        });

        // Send password reset email
        const userName = `${user.first_name} ${user.last_name}`;
        await sendPasswordResetEmail(normalizedEmail, resetToken, userName);

        // Log successful request
        await logAuthEvent(
            user.id,
            normalizedEmail,
            'forgot_password',
            'success',
            ipAddress,
            userAgent,
            {
                tokenExpiresAt: expiresAt.toISOString(),
                duration: Date.now() - startTime,
            }
        );

        return NextResponse.json(successResponse, { status: 200 });
    } catch (error) {
        console.error('Forgot password error:', error);

        await logAuthEvent(
            null,
            'unknown',
            'forgot_password',
            'error',
            ipAddress,
            userAgent,
            {
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: Date.now() - startTime,
            }
        );

        return NextResponse.json(
            { error: 'An error occurred. Please try again later.' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/auth/forgot-password
 * Return configuration (for client-side)
 */
export async function GET() {
    return NextResponse.json({
        config: {
            tokenExpiryHours: TOKEN_EXPIRY_HOURS,
            rateLimitWindowMinutes: RATE_LIMIT_WINDOW_MS / (60 * 1000),
            maxRequestsPerWindow: MAX_REQUESTS_PER_WINDOW,
        },
    });
}
