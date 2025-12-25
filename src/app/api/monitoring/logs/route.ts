import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '../../../../middleware/auth.middleware';
import { tenantMiddleware } from '../../../../middleware/tenant.middleware';
import { logger, LogLevel } from '../../../../lib/logger';
import { UserRole } from '../../../../types';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Apply tenant middleware for non-super admins
    let tenantId: string | undefined;
    if (authResult.user!.role !== UserRole.SUPER_ADMIN) {
      const tenantResult = await tenantMiddleware(request, authResult.user!);
      if (!tenantResult.success) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 }
        );
      }
      tenantId = tenantResult.tenant!.id;
    }

    const url = new URL(request.url);
    const level = url.searchParams.get('level');
    const query = url.searchParams.get('query');
    const _userId = url.searchParams.get('userId');
    const traceId = url.searchParams.get('traceId');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const format = url.searchParams.get('format') || 'json';

    let logs;

    if (query) {
      // Search logs
      logs = logger.searchLogs(query, limit);
    } else if (userId) {
      // Get logs by user
      logs = logger.getLogsByUser(userId, limit);
    } else if (traceId) {
      // Get logs by trace
      logs = logger.getLogsByTrace(traceId);
    } else if (tenantId) {
      // Get logs by tenant
      logs = logger.getLogsByTenant(tenantId, limit);
    } else {
      // Get recent logs with optional level filter
      const logLevel = level ? LogLevel[level.toUpperCase() as keyof typeof LogLevel] : undefined;
      logs = logger.getRecentLogs(limit, logLevel);
    }

    // Filter logs by tenant if user is not super admin
    if (tenantId && authResult.user!.role !== UserRole.SUPER_ADMIN) {
      logs = logs.filter(log => log.tenantId === tenantId || !log.tenantId);
    }

    const response = {
      success: true,
      data: {
        logs,
        count: logs.length,
        filters: {
          level,
          query,
          userId,
          traceId,
          tenantId,
          limit,
        },
        stats: logger.getLogStats(),
      },
    };

    // Log access
    logger.info('Logs accessed', {
      userId: authResult.user!.user_id,
      tenantId,
      filters: response.data.filters,
      resultCount: logs.length,
    });

    // Handle different response formats
    if (format === 'text') {
      const textLogs = logs.map(log => {
        const levelName = LogLevel[log.level];
        const contextStr = log.context && Object.keys(log.context).length > 0 
          ? ` ${JSON.stringify(log.context)}` 
          : '';
        return `[${log.timestamp}] ${levelName}: ${log.message}${contextStr}`;
      }).join('\n');

      return new NextResponse(textLogs, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    return NextResponse.json(response);
  } catch {
    logger.error('Failed to fetch logs', error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch logs',
        },
      },
      { status: 500 }
    );
  }
}