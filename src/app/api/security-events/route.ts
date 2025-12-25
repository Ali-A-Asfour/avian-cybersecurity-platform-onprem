import { NextRequest, NextResponse } from 'next/server';
import { dataIngestionService, DataSourceType, EventSeverity } from '@/services/data-ingestion.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    // Only security analysts and admins can view security events
    if (!['super_admin', 'tenant_admin', 'security_analyst'].includes(authResult.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    const filters = {
      source_type: searchParams.get('source_type') as DataSourceType | undefined,
      severity: searchParams.get('severity') as EventSeverity | undefined,
      start_date: searchParams.get('start_date') ? new Date(searchParams.get('start_date')!) : undefined,
      end_date: searchParams.get('end_date') ? new Date(searchParams.get('end_date')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof typeof filters] === undefined) {
        delete filters[key as keyof typeof filters];
      }
    });

    const events = await dataIngestionService.getSecurityEvents(tenantResult.tenant.id, filters);

    return NextResponse.json({
      events,
      total: events.length,
      filters
    });
  } catch {
    logger.error('Failed to get security events', { error });
    return NextResponse.json(
      { error: 'Failed to get security events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json({ error: tenantResult.error }, { status: 403 });
    }

    // Only system/service accounts should be able to create events directly
    // This endpoint is primarily for external integrations
    if (!['super_admin'].includes(authResult.user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const securityEvent = await dataIngestionService.ingestSecurityEvent({
      source_type: body.source_type,
      source_id: body.source_id,
      tenant_id: tenantResult.tenant.id,
      asset_id: body.asset_id,
      event_type: body.event_type,
      severity: body.severity,
      timestamp: new Date(body.timestamp),
      raw_data: body.raw_data,
      normalized_data: body.normalized_data,
      tags: body.tags || []
    });

    return NextResponse.json(securityEvent, { status: 201 });
  } catch {
    logger.error('Failed to create security event', { error });
    return NextResponse.json(
      { error: 'Failed to create security event' },
      { status: 500 }
    );
  }
}