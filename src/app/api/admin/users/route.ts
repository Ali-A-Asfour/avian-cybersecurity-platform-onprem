/**
 * Admin Users API
 * Get users for admin password reset functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { users } from '../../../../../database/schemas/main';
import { eq, and } from 'drizzle-orm';
import { verifyJWT } from '@/lib/jwt';

/**
 * GET /api/admin/users
 * Get users that the admin can manage
 */
export async function GET(request: NextRequest) {
    try {
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

        // Check if user has admin permissions
        if (!['super_admin', 'tenant_admin'].includes(adminUser.role)) {
            return NextResponse.json(
                { error: 'Insufficient permissions' },
                { status: 403 }
            );
        }

        let userList;

        if (adminUser.role === 'super_admin') {
            // Super admin can see all users
            userList = await db
                .select({
                    id: users.id,
                    email: users.email,
                    first_name: users.first_name,
                    last_name: users.last_name,
                    role: users.role,
                    tenant_id: users.tenant_id,
                    is_active: users.is_active,
                })
                .from(users)
                .orderBy(users.email);
        } else {
            // Tenant admin can only see users in their tenant
            userList = await db
                .select({
                    id: users.id,
                    email: users.email,
                    first_name: users.first_name,
                    last_name: users.last_name,
                    role: users.role,
                    tenant_id: users.tenant_id,
                    is_active: users.is_active,
                })
                .from(users)
                .where(eq(users.tenant_id, adminUser.tenant_id))
                .orderBy(users.email);
        }

        return NextResponse.json({
            success: true,
            users: userList,
            adminRole: adminUser.role,
        });

    } catch (error) {
        console.error('Admin users API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}