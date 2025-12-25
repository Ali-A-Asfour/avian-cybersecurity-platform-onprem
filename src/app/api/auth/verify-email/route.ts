/**
 * Email Verification API Endpoint
 * POST /api/auth/verify-email
 * Verifies user email with token
 * Part of production authentication system (Task 4.4)
 */

import { NextRequest, NextResponse } from 'next/server';
// import { db } from '@/lib/database';
import { users, emailVerificationTokens } from '../../../../../database/schemas/main';
import { eq, and, gt } from 'drizzle-orm';
import { logAuthEvent, AuditAction, AuditResult, extractClientInfo } from '@/lib/audit-logger';

/**
 * POST /api/auth/verify-email
 * Verify email with token
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

        // Parse request body
        let body: { token: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        const { token } = body;

        if (!token) {
            return NextResponse.json(
                { error: 'Verification token is required' },
                { status: 400 }
            );
        }

        // Find valid verification token
        const [verificationRecord] = await db
            .select()
            .from(emailVerificationTokens)
            .where(
                and(
                    eq(emailVerificationTokens.token, token),
                    gt(emailVerificationTokens.expires_at, new Date())
                )
            )
            .limit(1);

        if (!verificationRecord) {
            await logAuthEvent({
                action: AuditAction.EMAIL_VERIFICATION_FAILED,
                result: AuditResult.FAILURE,
                ipAddress,
                userAgent,
                metadata: { reason: 'Invalid or expired token' },
            });

            return NextResponse.json(
                {
                    error: 'Invalid or expired verification token. Please request a new verification email.',
                },
                { status: 400 }
            );
        }

        // Get user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, verificationRecord.user_id))
            .limit(1);

        if (!user) {
            await logAuthEvent({
                userId: verificationRecord.user_id,
                action: AuditAction.EMAIL_VERIFICATION_FAILED,
                result: AuditResult.FAILURE,
                ipAddress,
                userAgent,
                metadata: { reason: 'User not found' },
            });

            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if already verified
        if (user.email_verified) {
            // Delete the token
            await db
                .delete(emailVerificationTokens)
                .where(eq(emailVerificationTokens.id, verificationRecord.id));

            return NextResponse.json(
                {
                    success: true,
                    message: 'Email is already verified.',
                    alreadyVerified: true,
                },
                { status: 200 }
            );
        }

        // Update user as verified
        await db
            .update(users)
            .set({
                email_verified: true,
                updated_at: new Date(),
            })
            .where(eq(users.id, user.id));

        // Delete the used verification token
        await db
            .delete(emailVerificationTokens)
            .where(eq(emailVerificationTokens.id, verificationRecord.id));

        // Delete all other verification tokens for this user
        await db
            .delete(emailVerificationTokens)
            .where(eq(emailVerificationTokens.user_id, user.id));

        // Log successful verification
        await logAuthEvent({
            userId: user.id,
            email: user.email,
            action: AuditAction.EMAIL_VERIFIED,
            result: AuditResult.SUCCESS,
            ipAddress,
            userAgent,
        });

        return NextResponse.json(
            {
                success: true,
                message: 'Email has been verified successfully. You can now log in.',
            },
            { status: 200 }
        );
    } catch {
        console.error('Email verification error:', error);

        await logAuthEvent({
            action: AuditAction.EMAIL_VERIFICATION_FAILED,
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
 * GET /api/auth/verify-email?token=xxx
 * Check if verification token is valid
 */
export async function GET(req: NextRequest) {
    try {
        if (!db) {
            return NextResponse.json(
                { error: 'Service temporarily unavailable' },
                { status: 503 }
            );
        }

        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json(
                { valid: false, error: 'Token is required' },
                { status: 400 }
            );
        }

        // Check if token exists and is not expired
        const [verificationRecord] = await db
            .select()
            .from(emailVerificationTokens)
            .where(
                and(
                    eq(emailVerificationTokens.token, token),
                    gt(emailVerificationTokens.expires_at, new Date())
                )
            )
            .limit(1);

        if (!verificationRecord) {
            return NextResponse.json(
                {
                    valid: false,
                    error: 'Invalid or expired token',
                },
                { status: 200 }
            );
        }

        // Get user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, verificationRecord.user_id))
            .limit(1);

        if (!user) {
            return NextResponse.json(
                {
                    valid: false,
                    error: 'User not found',
                },
                { status: 200 }
            );
        }

        return NextResponse.json(
            {
                valid: true,
                email: user.email,
                alreadyVerified: user.email_verified,
                expiresAt: verificationRecord.expires_at.toISOString(),
            },
            { status: 200 }
        );
    } catch {
        console.error('Token validation error:', error);
        return NextResponse.json(
            { valid: false, error: 'Validation failed' },
            { status: 500 }
        );
    }
}
