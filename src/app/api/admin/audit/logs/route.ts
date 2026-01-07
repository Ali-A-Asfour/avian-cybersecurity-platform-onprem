import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, count, like, gte, lte } from 'drizzle-orm';
// import { db } from '../../../../../lib/database';
import { auditLogs } from '../../../../../../database/schemas/main';
import { AuthService } from '../../../../../lib/auth';
import { UserRole } from '../../../../../types';

export async function GET(request: NextRequest) {
  try {
    // Authenticate and authorize
    const authResult = await AuthService.authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only super admins and tenant admins can access audit logs
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    // Build filters
    const conditions = [];

    // Tenant isolation for tenant admins
    if (authResult.user.role === UserRole.TENANT_ADMIN) {
      conditions.push(eq(auditLogs.tenant_id, authResult.user.tenant_id));
    }

    // Search filter
    const search = searchParams.get('search');
    if (search) {
      conditions.push(like(auditLogs.action, `%${search}%`));
    }

    // Action filter
    const action = searchParams.get('action');
    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }

    // Resource type filter
    const resourceType = searchParams.get('resource_type');
    if (resourceType) {
      conditions.push(eq(auditLogs.resource_type, resourceType));
    }

    // User filter
    const userId = searchParams.get('user_id');
    if (userId) {
      conditions.push(eq(auditLogs.user_id, userId));
    }

    // Tenant filter (only for super admins)
    const _tenantId = searchParams.get('tenant_id');
    if (tenantId && authResult.user.role === UserRole.SUPER_ADMIN) {
      conditions.push(eq(auditLogs.tenant_id, tenantId));
    }

    // Date filters
    const dateFrom = searchParams.get('date_from');
    if (dateFrom) {
      conditions.push(gte(auditLogs.created_at, new Date(dateFrom)));
    }

    const dateTo = searchParams.get('date_to');
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999); // End of day
      conditions.push(lte(auditLogs.created_at, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count: totalCount }] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);

    // Get audit logs
    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.created_at))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: {
        logs,
        total: totalCount,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch audit logs' 
        } 
      },
      { status: 500 }
    );
  }
}