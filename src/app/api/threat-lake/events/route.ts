import { NextRequest, NextResponse } from 'next/server';
import { threatLakeService, ThreatLakeQuery } from '@/services/threat-lake.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { z } from 'zod';

const searchQuerySchema = z.object({
  event_category: z.string().optional(),
  event_type: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  min_confidence_score: z.number().min(0).max(1).optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  asset_id: z.string().uuid().optional(),
  correlation_id: z.string().uuid().optional(),
  search_text: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional()
});

export async function GET(request: NextRequest) {
  try {
    // Authentication and tenant validation
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const queryData: any = {};
    for (const [key, value] of searchParams.entries()) {
      if (key === 'min_confidence_score' || key === 'limit' || key === 'offset') {
        queryData[key] = parseFloat(value);
      } else if (key === 'start_time' || key === 'end_time') {
        queryData[key] = value;
      } else {
        queryData[key] = value;
      }
    }

    const validatedQuery = searchQuerySchema.parse(queryData);
    
    // Convert date strings to Date objects
    const query: ThreatLakeQuery = {
      ...validatedQuery,
      start_time: validatedQuery.start_time ? new Date(validatedQuery.start_time) : undefined,
      end_time: validatedQuery.end_time ? new Date(validatedQuery.end_time) : undefined
    };

    const _result = await threatLakeService.searchEvents(tenantResult.tenant.id, query);

    logger.info('Threat lake events searched', {
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      query: validatedQuery,
      resultCount: result.events.length
    });

    return NextResponse.json(result);
  } catch {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to search threat lake events', { error });
    return NextResponse.json(
      { error: 'Failed to search threat lake events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication and tenant validation
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    // Only allow Security Analysts and above to ingest events directly
    if (!['security_analyst', 'tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to ingest threat lake events' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.event_category || !body.event_type || !body.severity || !body.timestamp) {
      return NextResponse.json(
        { error: 'Missing required fields: event_category, event_type, severity, timestamp' },
        { status: 400 }
      );
    }

    const _eventData = {
      tenant_id: tenantResult.tenant.id,
      asset_id: body.asset_id,
      event_category: body.event_category,
      event_type: body.event_type,
      severity: body.severity,
      confidence_score: body.confidence_score || 0.5,
      threat_indicators: body.threat_indicators || [],
      correlation_id: body.correlation_id,
      related_events: body.related_events || [],
      raw_event_data: body.raw_event_data || {},
      normalized_data: body.normalized_data || {},
      source_system: body.source_system || 'manual_ingestion',
      source_event_id: body.source_event_id,
      timestamp: new Date(body.timestamp)
    };

    const event = await threatLakeService.ingestEvent(eventData);

    logger.info('Threat lake event ingested', {
      eventId: event.id,
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      eventType: event.event_type
    });

    return NextResponse.json(event, { status: 201 });
  } catch {
    logger.error('Failed to ingest threat lake event', { error });
    return NextResponse.json(
      { error: 'Failed to ingest threat lake event' },
      { status: 500 }
    );
  }
}