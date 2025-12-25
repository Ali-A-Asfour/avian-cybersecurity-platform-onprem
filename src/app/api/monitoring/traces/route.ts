import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '../../../../middleware/auth.middleware';
import { monitoring } from '../../../../lib/monitoring';
// import { logger } from '../../../../lib/logger';
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

    // Only admins can access traces
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(authResult.user!.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const traceId = url.searchParams.get('traceId');
    const operationName = url.searchParams.get('operation');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    let response;

    if (traceId) {
      // Get specific trace
      const trace = monitoring.getTrace(traceId);
      response = {
        success: true,
        data: {
          traceId,
          spans: trace,
          spanCount: trace.length,
        },
      };
    } else {
      // Get traces by operation or all traces
      const traces = monitoring.getTraces(operationName || undefined, limit);
      
      // Group traces by traceId
      const groupedTraces = traces.reduce((acc, span) => {
        if (!acc[span.traceId]) {
          acc[span.traceId] = [];
        }
        acc[span.traceId].push(span);
        return acc;
      }, {} as Record<string, typeof traces>);

      response = {
        success: true,
        data: {
          traces: Object.entries(groupedTraces).map(([traceId, spans]) => ({
            traceId,
            spans,
            spanCount: spans.length,
            duration: Math.max(...spans.map(s => s.duration || 0)),
            startTime: Math.min(...spans.map(s => s.startTime)),
            operationName: spans[0]?.operationName,
          })),
          totalTraces: Object.keys(groupedTraces).length,
          filters: {
            operationName,
            limit,
          },
        },
      };
    }

    // Log trace access
    logger.info('Traces accessed', {
      userId: authResult.user!.user_id,
      traceId,
      operationName,
      limit,
    });

    return NextResponse.json(response);
  } catch {
    logger.error('Failed to fetch traces', error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch traces',
        },
      },
      { status: 500 }
    );
  }
}