/**
 * Admin Password Reset API
 * Allows tenant admins and super admins to reset user passwords
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { users } from '../../../../../database/schemas/main';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { verifyJWT } from '@/lib/jwt';

/**
 * POST /api/admin/reset-password
 * Reset a user's password (admin only)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, newPassword } = body;

        if (!userId || !newPassword) {
            return NextResponse.json(
                { error: 'User ID and new password are required' },
                { status: 400 }
            );
        }

        // Verify admin authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const payload = await verifyJWT(token);
        
        if (!payload) {
            return NextResponse.json(
                { error: 'Invalid authentication token' },
                { status: 401 }
            );
        }

        const db = await getDb();

        // Get the admin user
        const [adminUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, payload.userId))
            .limit(1);

        if (!adminUser) {
            return NextResponse.json(
                { error: 'Admin user not found' },
                { status: 404 }
            );
        }

        // Get the target user
        const [targetUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!targetUser) {
            return NextResponse.json(
                { error: 'Target user not found' },
                { status: 404 }
            );
        }

        // Check permissions
        const canResetPassword = 
            adminUser.role === 'super_admin' || // Super admin can reset anyone
            (adminUser.role === 'tenant_admin' && adminUser.tenant_id === targetUser.tenant_id); // Tenant admin can reset users in their tenant

        if (!canResetPassword) {
            return NextResponse.json(
                { error: 'Insufficient permissions to reset this user\'s password' },
                { status: 403 }
            );
        }

        // Validate password strength
        if (newPassword.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters long' },
                { status: 400 }
            );
        }

        // Hash the new password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update the user's password and clear any lockout
        await db
            .update(users)
            .set({
                password_hash: hashedPassword,
                failed_login_attempts: 0,
                locked_until: null,
                updated_at: new Date(),
            })
            .where(eq(users.id, userId));

        // Log the password reset
        console.log(`Password reset by admin: ${adminUser.email} reset password for user: ${targetUser.email}`);

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully',
            resetBy: adminUser.email,
            resetFor: targetUser.email,
        });

    } catch (error) {
        console.error('Admin password reset error:', error);
        return NextResponse.json(
            { error: 'Failed to reset password' },
            { status: 500 }
        );
    }
}