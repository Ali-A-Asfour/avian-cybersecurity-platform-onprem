/**
 * Change Password API Endpoint
 * POST /api/auth/change-password
 * Allows authenticated users to change their password
 * Part of production authentication system (Task 3.3)
 */

import { NextRequest, NextResponse } from 'next/server';
// import { db } from '@/lib/database';
import { users, authAuditLogs } from '../../../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import { verifyPassword, hashPassword, validatePassword, isPasswordInHistory } from '@/lib/password';
import { extractTokenFromCookie, verifyToken } from '@/lib/jwt';

/**
 * Change password request body
 */
interface ChangePasswordRequest {
    currentPassword: string;
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
    } catch (error) {
        console.error('Failed to log auth event:', error);
    }
}

/**
 * Send password change confirmation email
 */
async function sendPasswordChangeConfirmation(
    email: string,
    userName: string
): Promise<void> {
    // TODO: Implement with your email service
    console.log('='.repeat(80));
    console.log('PASSWORD CHANGE CONFIRMATION');
    console.log('='.repeat(80));
    console.log(`To: ${email}`);
    console.log(`Name: ${userName}`);
    console.log('Your password has been successfully changed.');
    console.log('If you did not make this change, please contact support immediately.');
    console.log('='.repeat(80));

    // In production, replace with actual email service
}

/**
 * Extract and verify user from request
 */
async function authenticateRequest(req: NextRequest): Promise<{
    authenticated: boolean;
    user?: any;
    error?: string;
}> {
    if (!db) {
        return { authenticated: false, error: 'Database not initialized' };
    }

    // Extract token from cookie
    const cookieHeader = req.headers.get('cookie');
    const token = extractTokenFromCookie(cookieHeader);

    if (!token) {
        return { authenticated: false, error: 'No authentication token found' };
    }

    // Verify token
    const verifyResult = verifyToken(token);
    if (!verifyResult.valid || !verifyResult.payload) {
        return { authenticated: false, error: 'Invalid or expired token' };
    }

    // Get user from database
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, verifyResult.payload.userId))
        .limit(1);

    if (!user) {
        return { authenticated: false, error: 'User not found' };
    }

    if (!user.is_active) {
        return { authenticated: false, error: 'Account is inactive' };
    }

    return { authenticated: true, user };
}

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
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

        // Authenticate user
        const authResult = await authenticateRequest(req);
        if (!authResult.authenticated || !authResult.user) {
            return NextResponse.json(
                { error: authResult.error || 'Authentication required' },
                { status: 401 }
            );
        }

        const _user = authResult.user;

        // Parse request body
        let body: ChangePasswordRequest;
        try {
            body = await req.json();
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        const { currentPassword, newPassword, confirmPassword } = body;

        // Validate required fields
        if (!currentPassword || !newPassword || !confirmPassword) {
            await logAuthEvent(
                user.id,
                user.email,
                'change_password',
                'missing_fields',
                ipAddress,
                userAgent
            );

            return NextResponse.json(
                { error: 'All password fields are required' },
                { status: 400 }
            );
        }

        // Check passwords match
        if (newPassword !== confirmPassword) {
            await logAuthEvent(
                user.id,
                user.email,
                'change_password',
                'passwords_mismatch',
                ipAddress,
                userAgent
            );

            return NextResponse.json(
                { error: 'New passwords do not match' },
                { status: 400 }
            );
        }

        // Verify current password
        const isCurrentPasswordValid = await verifyPassword(
            currentPassword,
            user.password_hash
        );

        if (!isCurrentPasswordValid) {
            await logAuthEvent(
                user.id,
                user.email,
                'change_password',
                'invalid_current_password',
                ipAddress,
                userAgent
            );

            return NextResponse.json(
                { error: 'Current password is incorrect' },
                { status: 401 }
            );
        }

        // Check if new password is same as current
        const isSamePassword = await verifyPassword(newPassword, user.password_hash);
        if (isSamePassword) {
            await logAuthEvent(
                user.id,
                user.email,
                'change_password',
                'same_password',
                ipAddress,
                userAgent
            );

            return NextResponse.json(
                { error: 'New password must be different from current password' },
                { status: 400 }
            );
        }

        // Validate new password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            await logAuthEvent(
                user.id,
                user.email,
                'change_password',
                'weak_password',
                ipAddress,
                userAgent,
                { errors: passwordValidation.errors }
            );

            return NextResponse.json(
                {
                    error: 'Password does not meet requirements',
                    details: passwordValidation.errors,
                },
                { status: 400 }
            );
        }

        // Check if new password is in history
        const inHistory = await isPasswordInHistory(user.id, newPassword);
        if (inHistory) {
            await logAuthEvent(
                user.id,
                user.email,
                'change_password',
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
            })
            .where(eq(users.id, user.id));

        // Send confirmation email
        const userName = `${user.first_name} ${user.last_name}`;
        await sendPasswordChangeConfirmation(user.email, userName);

        // Log successful password change
        await logAuthEvent(
            user.id,
            user.email,
            'change_password',
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
                message: 'Password has been changed successfully.',
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Change password error:', error);

        await logAuthEvent(
            null,
            'unknown',
            'change_password',
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
