/**
 * Authentication Audit Log Query Endpoint
 * Requirements: 9.7, 9.8
 * Restricted to super_admin and tenant_admin roles only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/database';
import { authAuditLogs, users, tenants } from '../../../../../database/schemas/main';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { UserRole } from '@/types';

export async function GET(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (!authResult.success) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Only admins can query audit logs
  const allowedRoles: string[] = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN];
  if (!allowedRoles.includes(authResult.user!.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const tenantResult = await tenantMiddleware(request, authResult.user!);
  if (!tenantResult.success) {
    return NextResponse.json({ error: tenantResult.error?.message || 'Access denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
  const offset = parseInt(searchParams.get('offset') || '0');

  if (limit < 1) {
    return NextResponse.json({ error: 'Limit must be between 1 and 1000' }, { status: 400 });
  }

  try {
    const { logs, total } = await withTenantContext(tenantResult.tenant!.id, authResult.user!.role, async (db) => {
      const conditions = [];

      const userId = searchParams.get('userId');
      const email = searchParams.get('email');
      const action = searchParams.get('action');
      const result = searchParams.get('result');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      if (userId) conditions.push(eq(authAuditLogs.user_id, userId));
      if (email) conditions.push(eq(authAuditLogs.email, email));
      if (action) conditions.push(eq(authAuditLogs.action, action));
      if (result) conditions.push(eq(authAuditLogs.result, result));
      if (startDate) conditions.push(gte(authAuditLogs.created_at, new Date(startDate)));
      if (endDate) conditions.push(lte(authAuditLogs.created_at, new Date(endDate)));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const logs = await db
        .select({
          id: authAuditLogs.id,
          user_id: authAuditLogs.user_id,
          email: authAuditLogs.email,
          action: authAuditLogs.action,
          result: authAuditLogs.result,
          ip_address: authAuditLogs.ip_address,
          user_agent: authAuditLogs.user_agent,
          metadata: authAuditLogs.metadata,
          created_at: authAuditLogs.created_at,
          user: { first_name: users.first_name, last_name: users.last_name, role: users.role },
          tenant: { name: tenants.name },
        })
        .from(authAuditLogs)
        .leftJoin(users, eq(authAuditLogs.user_id, users.id))
        .leftJoin(tenants, eq(users.tenant_id, tenants.id))
        .where(where)
        .orderBy(desc(authAuditLogs.created_at))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(authAuditLogs)
        .where(where);

      return { logs, total: Number(count) };
    });

    return NextResponse.json({ logs, pagination: { total, limit, offset, hasMore: offset + limit < total } });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to query audit logs' }, { status: 500 });
  }
}
