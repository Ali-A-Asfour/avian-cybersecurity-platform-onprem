import { NextRequest, NextResponse } from 'next/server';
import { threatLakeService } from '@/services/threat-lake.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { z } from 'zod';

const advancedSearchSchema = z.object({
  query: z.object({
    event_category: z.string().optional(),
    event_type: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    min_confidence_score: z.number().min(0).max(1).optional(),
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
    asset_id: z.string().uuid().optional(),
    correlation_id: z.string().uuid().optional(),
    search_text: z.string().optional(),
    threat_indicators: z.array(z.object({
      indicator_type: z.string(),
      indicator_value: z.string()
    })).optional(),
    limit: z.number().min(1).max(1000).optional(),
    offset: z.number().min(0).optional()
  }),
  aggregations: z.object({
    group_by: z.array(z.string()).optional(),
    time_bucket: z.enum(['hour', 'day', 'week', 'month']).optional(),
    include_stats: z.boolean().optional()
  }).optional()
});

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

    // Only allow Security Analysts and above to search threat lake
    if (!['security_analyst', 'tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to search threat lake' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = advancedSearchSchema.parse(body);

    // Convert date strings to Date objects
    const query = {
      ...validatedData.query,
      start_time: validatedData.query.start_time ? new Date(validatedData.query.start_time) : undefined,
      end_time: validatedData.query.end_time ? new Date(validatedData.query.end_time) : undefined
    };

    const _result = await threatLakeService.searchEvents(tenantResult.tenant.id, query);

    // If aggregations are requested, perform additional analysis
    let aggregations = {};
    if (validatedData.aggregations) {
      aggregations = await performAggregations(
        tenantResult.tenant.id,
        query,
        validatedData.aggregations
      );
    }

    logger.info('Advanced threat lake search performed', {
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      query: validatedData.query,
      resultCount: result.events.length,
      hasAggregations: Object.keys(aggregations).length > 0
    });

    return NextResponse.json({
      ...result,
      aggregations
    });
  } catch {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to perform advanced threat lake search', { error });
    return NextResponse.json(
      { error: 'Failed to perform advanced threat lake search' },
      { status: 500 }
    );
  }
}

async function performAggregations(tenantId: string, query: any, aggregationConfig: any) {
  const aggregations: any = {};

  try {
    // Build base WHERE clause
    let whereClause = 'WHERE tenant_id = $1';
    const params = [tenantId];
    let paramIndex = 2;

    if (query.start_time) {
      whereClause += ` AND timestamp >= $${paramIndex}`;
      params.push(query.start_time);
      paramIndex++;
    }

    if (query.end_time) {
      whereClause += ` AND timestamp <= $${paramIndex}`;
      params.push(query.end_time);
      paramIndex++;
    }

    if (query.event_category) {
      whereClause += ` AND event_category = $${paramIndex}`;
      params.push(query.event_category);
      paramIndex++;
    }

    if (query.severity) {
      whereClause += ` AND severity = $${paramIndex}`;
      params.push(query.severity);
      paramIndex++;
    }

    // Group by aggregations
    if (aggregationConfig.group_by) {
      for (const field of aggregationConfig.group_by) {
        if (['severity', 'event_category', 'event_type'].includes(field)) {
          const { db } = await import('@/lib/database');
          const _result = await db.query(`
            SELECT ${field}, COUNT(*) as count
            FROM threat_lake_events 
            ${whereClause}
            GROUP BY ${field}
            ORDER BY count DESC
          `, params);
          
          aggregations[`${field}_distribution`] = result.rows;
        }
      }
    }

    // Time bucket aggregations
    if (aggregationConfig.time_bucket) {
      const { db } = await import('@/lib/database');
      let timeFormat;
      switch (aggregationConfig.time_bucket) {
        case 'hour':
          timeFormat = "date_trunc('hour', timestamp)";
          break;
        case 'day':
          timeFormat = "date_trunc('day', timestamp)";
          break;
        case 'week':
          timeFormat = "date_trunc('week', timestamp)";
          break;
        case 'month':
          timeFormat = "date_trunc('month', timestamp)";
          break;
        default:
          timeFormat = "date_trunc('day', timestamp)";
      }

      const _result = await db.query(`
        SELECT ${timeFormat} as time_bucket, COUNT(*) as count
        FROM threat_lake_events 
        ${whereClause}
        GROUP BY time_bucket
        ORDER BY time_bucket
      `, params);

      aggregations.time_series = result.rows;
    }

    // Include basic statistics
    if (aggregationConfig.include_stats) {
      const { db } = await import('@/lib/database');
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_events,
          AVG(confidence_score) as avg_confidence,
          MIN(timestamp) as earliest_event,
          MAX(timestamp) as latest_event,
          COUNT(DISTINCT asset_id) as unique_assets,
          COUNT(DISTINCT source_system) as unique_sources
        FROM threat_lake_events 
        ${whereClause}
      `, params);

      aggregations.statistics = statsResult.rows[0];
    }

    return aggregations;
  } catch {
    logger.error('Failed to perform aggregations', { error, tenantId });
    return {};
  }
}