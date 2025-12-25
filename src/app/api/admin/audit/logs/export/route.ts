import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, like, gte, lte } from 'drizzle-orm';
// import { db } from '../../../../../../lib/database';
import { auditLogs } from '../../../../../../../database/schemas/main';
import { AuthService } from '../../../../../../lib/auth';
import { UserRole } from '../../../../../../types';

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

    // Only super admins and tenant admins can export audit logs
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Build filters (same as the main logs endpoint)
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
    const _userId = searchParams.get('user_id');
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
      endDate.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.created_at, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all matching audit logs (limit to 10,000 for performance)
    const logs = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.created_at))
      .limit(10000);

    // Generate CSV content
    const csvHeaders = [
      'Timestamp',
      'Action',
      'Resource Type',
      'Resource ID',
      'User ID',
      'Tenant ID',
      'IP Address',
      'User Agent',
      'Details'
    ];

    const csvRows = logs.map(log => [
      log.created_at.toISOString(),
      log.action,
      log.resource_type,
      log.resource_id || '',
      log.user_id || '',
      log.tenant_id || '',
      log.ip_address || '',
      log.user_agent || '',
      JSON.stringify(log.details)
    ]);

    // Escape CSV values
    const escapeCsvValue = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(escapeCsvValue).join(','))
    ].join('\n');

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch {
    console.error('Audit logs export error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to export audit logs' 
        } 
      },
      { status: 500 }
    );
  }
}