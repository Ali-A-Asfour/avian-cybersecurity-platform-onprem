import { NextRequest, NextResponse } from 'next/server';
import { threatLakeService, ThreatLakeQuery } from '@/services/threat-lake.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const exportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  event_category: z.string().optional(),
  event_type: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  search_text: z.string().optional(),
  limit: z.number().min(1).max(10000).optional().default(1000)
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

    // Only allow Security Analysts and above to export threat lake data
    if (!['security_analyst', 'tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to export threat lake data' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const queryData: any = {};
    for (const [key, value] of searchParams.entries()) {
      if (key === 'limit') {
        queryData[key] = parseInt(value);
      } else {
        queryData[key] = value;
      }
    }

    const validatedQuery = exportQuerySchema.parse(queryData);
    
    // Convert date strings to Date objects and build search query
    const searchQuery: ThreatLakeQuery = {
      event_category: validatedQuery.event_category,
      event_type: validatedQuery.event_type,
      severity: validatedQuery.severity as any,
      start_time: validatedQuery.start_time ? new Date(validatedQuery.start_time) : undefined,
      end_time: validatedQuery.end_time ? new Date(validatedQuery.end_time) : undefined,
      search_text: validatedQuery.search_text,
      limit: validatedQuery.limit
    };

    // Search for events
    const _result = await threatLakeService.searchEvents(tenantResult.tenant.id, searchQuery);

    // Generate export data based on format
    let exportData: string;
    let contentType: string;
    let filename: string;

    if (validatedQuery.format === 'json') {
      exportData = JSON.stringify({
        metadata: {
          exported_at: new Date().toISOString(),
          tenant_id: tenantResult.tenant.id,
          exported_by: authResult.user!.id,
          total_events: result.total,
          query: searchQuery
        },
        events: result.events
      }, null, 2);
      contentType = 'application/json';
      filename = `threat-lake-events-${new Date().toISOString().split('T')[0]}.json`;
    } else {
      // CSV format
      const csvHeaders = [
        'ID',
        'Timestamp',
        'Category',
        'Type',
        'Severity',
        'Confidence Score',
        'Source System',
        'Asset ID',
        'Threat Indicators Count',
        'Correlation ID',
        'Description'
      ];

      const csvRows = result.events.map(event => [
        event.id,
        new Date(event.timestamp).toISOString(),
        event.event_category,
        event.event_type,
        event.severity,
        (event.confidence_score * 100).toFixed(2) + '%',
        event.source_system,
        event.asset_id || '',
        event.threat_indicators.length.toString(),
        event.correlation_id || '',
        event.normalized_data?.description || ''
      ]);

      exportData = [
        csvHeaders.join(','),
        ...csvRows.map(row => 
          row.map(cell => 
            typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))
              ? `"${cell.replace(/"/g, '""')}"` // Escape quotes and wrap in quotes if needed
              : cell
          ).join(',')
        )
      ].join('\n');

      contentType = 'text/csv';
      filename = `threat-lake-events-${new Date().toISOString().split('T')[0]}.csv`;
    }

    logger.info('Threat lake data exported', {
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      format: validatedQuery.format,
      eventCount: result.events.length,
      query: searchQuery
    });

    // Return file download response
    return new NextResponse(exportData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(exportData, 'utf8').toString()
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid export parameters', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to export threat lake data', { error });
    return NextResponse.json(
      { error: 'Failed to export threat lake data' },
      { status: 500 }
    );
  }
}