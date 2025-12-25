/**
 * Audit Logs Query API Endpoint
 * GET /api/admin/audit-logs
 * Query and retrieve audit logs (admin only)
 * Part of production authentication system (Task 4.3)
 */

import { NextRequest, NextResponse } from 'next/server';
// import { db } from '@/lib/database';
import { authAuditLogs, users } from '../../../../../database/schemas/main';
import { eq, and, gte, lte, desc, or, ilike } from 'drizzle-orm';
import { extractTokenFromCookie, verifyToken } from '@/lib/jwt';

/**
 * Authenticate admin user
 */
async function authenticateAdmin(req: NextRequest): Promise<{
    authenticated: boolean;
    user?: any;
    error?: string;
}> {
    if (!db) {
        return { authenticated: false, error: 'Database not initialized' };
    }

    const cookieHeader = req.headers.get('cookie');
    const token = extractTokenFromCookie(cookieHeader);

    if (!token) {
        return { authenticated: false, error: 'No authentication token' };
    }

    const verifyResult = verifyToken(token);
    if (!verifyResult.valid || !verifyResult.payload) {
        return { authenticated: false, error: 'Invalid token' };
    }

    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, verifyResult.payload.userId))
        .limit(1);

    if (!user || !user.is_active) {
        return { authenticated: false, error: 'User not found or inactive' };
    }

    // Check if user is admin
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
        return { authenticated: false, error: 'Insufficient permissions' };
    }

    return { authenticated: true, user };
}

/**
 * GET /api/admin/audit-logs
 * Query audit logs with filters
 */
export async function GET(req: NextRequest) {
    try {
        if (!db) {
            return NextResponse.json(
                { error: 'Service temporarily unavailable' },
                { status: 503 }
            );
        }

        // Authenticate admin
        const authResult = await authenticateAdmin(req);
        if (!authResult.authenticated || !authResult.user) {
            return NextResponse.json(
                { error: authResult.error || 'Authentication required' },
                { status: 401 }
            );
        }

        const _user = authResult.user;
        const { searchParams } = new URL(req.url);

        // Parse query parameters
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
        const offset = (page - 1) * limit;

        const action = searchParams.get('action');
        const _result = searchParams.get('result');
        const _userId = searchParams.get('userId');
        const email = searchParams.get('email');
        const ipAddress = searchParams.get('ipAddress');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const search = searchParams.get('search');

        // Build query conditions
        const conditions: any[] = [];

        if (action) {
            conditions.push(eq(authAuditLogs.action, action));
        }

        if (result) {
            conditions.push(eq(authAuditLogs.result, result));
        }

        if (userId) {
            conditions.push(eq(authAuditLogs.user_id, userId));
        }

        if (email) {
            conditions.push(ilike(authAuditLogs.email, `%${email}%`));
        }

        if (ipAddress) {
            conditions.push(eq(authAuditLogs.ip_address, ipAddress));
        }

        if (startDate) {
            conditions.push(gte(authAuditLogs.created_at, new Date(startDate)));
        }

        if (endDate) {
            conditions.push(lte(authAuditLogs.created_at, new Date(endDate)));
        }

        if (search) {
            conditions.push(
                or(
                    ilike(authAuditLogs.email, `%${search}%`),
                    ilike(authAuditLogs.action, `%${search}%`),
                    ilike(authAuditLogs.ip_address, `%${search}%`)
                )
            );
        }

        // Query audit logs
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const logs = await db
            .select()
            .from(authAuditLogs)
            .where(whereClause)
            .orderBy(desc(authAuditLogs.created_at))
            .limit(limit)
            .offset(offset);

        // Get total count for pagination
        const [countResult] = await db
            .select({ count: authAuditLogs.id })
            .from(authAuditLogs)
            .where(whereClause);

        const totalCount = logs.length; // Simplified - in production, do proper count

        return NextResponse.json(
            {
                logs: logs.map((log) => ({
                    id: log.id,
                    userId: log.user_id,
                    email: log.email,
                    action: log.action,
                    result: log.result,
                    ipAddress: log.ip_address,
                    userAgent: log.user_agent,
                    metadata: log.metadata,
                    createdAt: log.created_at.toISOString(),
                })),
                pagination: {
                    page,
                    limit,
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                },
            },
            { status: 200 }
        );
    } catch {
        console.error('Audit logs query error:', error);
        return NextResponse.json(
            { error: 'Failed to retrieve audit logs' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/admin/audit-logs/stats
 * Get audit log statistics
 */
export async function POST(req: NextRequest) {
    try {
        if (!db) {
            return NextResponse.json(
                { error: 'Service temporarily unavailable' },
                { status: 503 }
            );
        }

        // Authenticate admin
        const authResult = await authenticateAdmin(req);
        if (!authResult.authenticated) {
            return NextResponse.json(
                { error: authResult.error || 'Authentication required' },
                { status: 401 }
            );
        }

        // Get statistics for the last 24 hours
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const recentLogs = await db
            .select()
            .from(authAuditLogs)
            .where(gte(authAuditLogs.created_at, last24Hours));

        // Calculate statistics
        const stats = {
            total: recentLogs.length,
            byAction: {} as Record<string, number>,
            byResult: {} as Record<string, number>,
            failedLogins: 0,
            successfulLogins: 0,
            accountLockouts: 0,
            passwordResets: 0,
            suspiciousActivity: 0,
        };

        recentLogs.forEach((log) => {
            // Count by action
            stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

            // Count by result
            stats.byResult[log.result] = (stats.byResult[log.result] || 0) + 1;

            // Specific counters
            if (log.action === 'login' && log.result === 'failure') {
                stats.failedLogins++;
            }
            if (log.action === 'login' && log.result === 'success') {
                stats.successfulLogins++;
            }
            if (log.action === 'account_locked') {
                stats.accountLockouts++;
            }
            if (log.action.includes('password_reset')) {
                stats.passwordResets++;
            }
            if (log.action === 'suspicious_activity') {
                stats.suspiciousActivity++;
            }
        });

        return NextResponse.json(
            {
                period: 'last_24_hours',
                stats,
            },
            { status: 200 }
        );
    } catch {
        console.error('Audit stats error:', error);
        return NextResponse.json(
            { error: 'Failed to retrieve statistics' },
            { status: 500 }
        );
    }
}
