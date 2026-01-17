/**
 * Admin Users API
 * Get users for admin password reset functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { users } from '../../../../../database/schemas/main';
import { eq, and, ne } from 'drizzle-orm';
import { verifyToken } from '@/lib/jwt';

/**
 * GET /api/admin/users
 * Get users that the admin can manage
 */
export async function GET(request: NextRequest) {
    try {
        // Handle demo/bypass mode
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            // Verify admin authentication
            const authHeader = request.headers.get('authorization');
            if (!authHeader?.startsWith('Bearer ')) {
                return NextResponse.json(
                    { error: 'Authentication required' },
                    { status: 401 }
                );
            }

            const token = authHeader.substring(7);
            
            try {
                // Decode the demo token
                const decoded = JSON.parse(atob(token));
                
                // Check if token is expired
                if (decoded.exp && decoded.exp < Date.now()) {
                    return NextResponse.json(
                        { error: 'Token expired' },
                        { status: 401 }
                    );
                }

                // Import mock users store
                const { getMockUsers, getMockUsersByTenant, findMockUserById } = await import('@/lib/mock-users-store');
                const adminUser = findMockUserById(decoded.userId);

                if (!adminUser || !adminUser.isActive) {
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
                    // Super admin can see all users across all tenants
                    userList = getMockUsers();
                } else {
                    // Tenant admin can only see regular users and basic roles in their organization
                    // They should NOT see other admin roles like security_analyst, it_helpdesk_analyst, etc.
                    userList = getMockUsersByTenant(adminUser.tenantId).filter(user => {
                        // Tenant admins can only manage regular users, not other admin/analyst roles
                        const allowedRoles = ['user']; // Only regular users
                        return allowedRoles.includes(user.role);
                    });
                }

                // Convert to expected format
                const formattedUsers = userList.map(user => ({
                    id: user.id,
                    email: user.email,
                    first_name: user.firstName,
                    last_name: user.lastName,
                    role: user.role,
                    tenant_id: user.tenantId,
                    is_active: user.isActive,
                }));

                return NextResponse.json({
                    success: true,
                    users: formattedUsers,
                    adminRole: adminUser.role,
                });
            } catch (error) {
                return NextResponse.json(
                    { error: 'Invalid authentication token' },
                    { status: 401 }
                );
            }
        }

        // Production mode - use database
        // Verify admin authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const verifyResult = verifyToken(token);
        
        if (!verifyResult.valid || !verifyResult.payload) {
            return NextResponse.json(
                { error: 'Invalid authentication token' },
                { status: 401 }
            );
        }

        const payload = verifyResult.payload;

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
            // Super admin can see all users across all tenants
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
            // Tenant admin can only see regular users in their tenant
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
                .where(
                    and(
                        eq(users.tenant_id, adminUser.tenant_id),
                        eq(users.role, 'user') // Only regular users
                    )
                )
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