/**
 * Reset Password API Endpoint
 * POST /api/auth/reset-password
 * Validates reset token and updates password
 * Part of production authentication system (Task 3.2)
 */

import { NextRequest, NextResponse } from 'next/server';
// import { db } from '@/lib/database';
import { users, passwordResetTokens, sessions, authAuditLogs } from '../../../../../database/schemas/main';
import { eq, and, gt } from 'drizzle-orm';
import { hashPassword, validatePassword, isPasswordInHistory } from '@/lib/password';

/**
 * Reset password request body
 */
interface ResetPasswordRequest {
    token: string;
    newPassword: string;
    confirmPassword: string;
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
    } catch {
        console.error('Failed to log auth event:', error);
    }
}

/**
 * Send password reset confirmation email
 */
async function sendPasswordResetConfirmation(
    email: string,
    userName: string
): Promise<void> {
    // TODO: Implement with your email service
    console.log('='.repeat(80));
    console.log('PASSWORD RESET CONFIRMATION');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Name: ${userName}`);
    console.log('Your password has been successfully reset.');
    console.log('If you did not make this change, please contact support immediately.');
    console.log('='.repeat(80));

    // In production, replace with actual email service
}

/**
 * POST /api/auth/reset-password
 * Reset user password with valid token
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

        // Parse request body
        let body: ResetPasswordRequest;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        const { token, newPassword, confirmPassword } = body;

        // Validate required fields
        if (!token || !newPassword || !confirmPassword) {
            return NextResponse.json(
                { error: 'Token and passwords are required' },
                { status: 400 }
            );
        }

        // Check passwords match
        if (newPassword !== confirmPassword) {
            return NextResponse.json(
                { error: 'Passwords do not match' },
                { status: 400 }
            );
        }

        // Validate password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            return NextResponse.json(
                {
                    error: 'Password does not meet requirements',
                    details: passwordValidation.errors,
                },
                { status: 400 }
            );
        }

        // Find valid reset token
        const [resetTokenRecord] = await db
            .select()
            .from(passwordResetTokens)
            .where(
                and(
                    eq(passwordResetTokens.token, token),
                    gt(passwordResetTokens.expires_at, new Date())
                )
            )
            .limit(1);

        if (!resetTokenRecord) {
            await logAuthEvent(
                null,
                'unknown',
                'reset_password',
                'invalid_token',
                ipAddress,
                userAgent,
                { token: token.substring(0, 8) + '...' }
            );

            return NextResponse.json(
                {
                    error: 'Invalid or expired reset token. Please request a new password reset.',
                },
                { status: 400 }
            );
        }

        // Get user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, resetTokenRecord.user_id))
            .limit(1);

        if (!user) {
            await logAuthEvent(
                resetTokenRecord.user_id,
                'unknown',
                'reset_password',
                'user_not_found',
                ipAddress,
                userAgent
            );

            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if account is active
        if (!user.is_active) {
            await logAuthEvent(
                user.id,
                user.email,
                'reset_password',
                'account_inactive',
                ipAddress,
                userAgent
            );

            return NextResponse.json(
                { error: 'Account is inactive. Please contact support.' },
                { status: 403 }
            );
        }

        // Check if new password is in history
        const inHistory = await isPasswordInHistory(user.id, newPassword);
        if (inHistory) {
            await logAuthEvent(
                user.id,
                user.email,
                'reset_password',
                'password_in_history',
                ipAddress,
                userAgent
            );

            return NextResponse.json(
                {
                    error: 'Password has been used recently. Please choose a different password.',
                },
                { status: 400 }
            );
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update user's password
        await db
            .update(users)
            .set({
                password_hash: newPasswordHash,
                updated_at: new Date(),
                // Reset failed login attempts
                failed_login_attempts: 0,
                last_failed_login: null,
                locked_until: null,
                account_locked: false,
            })
            .where(eq(users.id, user.id));

        // Delete the used reset token
        await db
            .delete(passwordResetTokens)
            .where(eq(passwordResetTokens.id, resetTokenRecord.id));

        // Delete all other reset tokens for this user
        await db
            .delete(passwordResetTokens)
            .where(eq(passwordResetTokens.user_id, user.id));

        // Invalidate all existing sessions (force re-login)
        await db
            .delete(sessions)
            .where(eq(sessions.user_id, user.id));

        // Send confirmation email
        const userName = `${user.first_name} ${user.last_name}`;
        await sendPasswordResetConfirmation(user.email, userName);

        // Log successful password reset
        await logAuthEvent(
            user.id,
            user.email,
            'reset_password',
            'success',
            ipAddress,
            userAgent,
            {
                passwordStrength: passwordValidation.strength,
                duration: Date.now() - startTime,
            }
        );

        return NextResponse.json(
            {
                success: true,
                message: 'Password has been reset successfully. Please log in with your new password.',
            },
            { status: 200 }
        );
    } catch {
        console.error('Reset password error:', error);

        await logAuthEvent(
            null,
            'unknown',
            'reset_password',
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
 * GET /api/auth/reset-password?token=xxx
 * Validate a reset token without using it
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
        const [resetTokenRecord] = await db
            .select()
            .from(passwordResetTokens)
            .where(
                and(
                    eq(passwordResetTokens.token, token),
                    gt(passwordResetTokens.expires_at, new Date())
                )
            )
            .limit(1);

        if (!resetTokenRecord) {
            return NextResponse.json(
                {
                    valid: false,
                    error: 'Invalid or expired token',
                },
                { status: 200 }
            );
        }

        // Get user to check if account is active
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, resetTokenRecord.user_id))
            .limit(1);

        if (!user || !user.is_active) {
            return NextResponse.json(
                {
                    valid: false,
                    error: 'Account not found or inactive',
                },
                { status: 200 }
            );
        }

        return NextResponse.json(
            {
                valid: true,
                email: user.email,
                expiresAt: resetTokenRecord.expires_at.toISOString(),
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
