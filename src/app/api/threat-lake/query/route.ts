import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { threatLakeService } from '@/services/threat-lake.service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    const body = await request.json();
    const { query, limit = 100, offset = 0, start_time, end_time, severity, event_category } = body;

    if (!query && !severity && !event_category) {
      return NextResponse.json({ error: 'At least one search parameter is required' }, { status: 400 });
    }

    const startTime = Date.now();
    const result = await threatLakeService.searchEvents(tenantResult.tenant.id, {
      search_text: query || undefined,
      severity: severity || undefined,
      event_category: event_category || undefined,
      start_time: start_time ? new Date(start_time) : undefined,
      end_time: end_time ? new Date(end_time) : undefined,
      limit: Math.min(limit, 500),
      offset,
    });

    return NextResponse.json({
      success: true,
      results: result.events,
      total: result.total,
      has_more: result.has_more,
      query_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('Failed to execute threat lake query', { error });
    return NextResponse.json({ error: 'Failed to execute query' }, { status: 500 });
  }
}
