import { NextRequest, NextResponse } from 'next/server';
import { threatLakeService, TimeRange } from '@/services/threat-lake.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  include_predictions: z.boolean().optional().default(false),
  include_trends: z.boolean().optional().default(false)
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

    // Only allow Security Analysts and above to view threat analytics
    if (!['security_analyst', 'tenant_admin', 'super_admin'].includes(authResult.user!.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view threat analytics' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // Default to last 24 hours if no time range specified
    const defaultEndTime = new Date();
    const defaultStartTime = new Date(defaultEndTime.getTime() - 24 * 60 * 60 * 1000);

    const queryData = {
      start_time: searchParams.get('start_time') || defaultStartTime.toISOString(),
      end_time: searchParams.get('end_time') || defaultEndTime.toISOString(),
      include_predictions: searchParams.get('include_predictions') === 'true',
      include_trends: searchParams.get('include_trends') === 'true'
    };

    const validatedQuery = analyticsQuerySchema.parse(queryData);

    const timeRange: TimeRange = {
      start_time: new Date(validatedQuery.start_time),
      end_time: new Date(validatedQuery.end_time)
    };

    // Get basic threat analytics
    const analytics = await threatLakeService.getThreatAnalytics(tenantResult.tenant.id, timeRange);

    // Add additional analytics if requested
    let predictions = {};
    let trends = {};

    if (validatedQuery.include_predictions) {
      predictions = await getThreatPredictions(tenantResult.tenant.id, timeRange);
    }

    if (validatedQuery.include_trends) {
      trends = await getThreatTrends(tenantResult.tenant.id, timeRange);
    }

    const response = {
      ...analytics,
      predictions: validatedQuery.include_predictions ? predictions : undefined,
      trends: validatedQuery.include_trends ? trends : undefined
    };

    logger.info('Threat analytics retrieved', {
      tenantId: tenantResult.tenant.id,
      userId: authResult.user!.id,
      timeRange,
      includePredictions: validatedQuery.include_predictions,
      includeTrends: validatedQuery.include_trends
    });

    return NextResponse.json(response);
  } catch {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid analytics query parameters', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to get threat analytics', { error });
    return NextResponse.json(
      { error: 'Failed to get threat analytics' },
      { status: 500 }
    );
  }
}

async function getThreatPredictions(tenantId: string, timeRange: TimeRange) {
  try {
    const { db } = await import('@/lib/database');
    
    // Get ML model predictions (simplified implementation)
    const modelsResult = await db.query(`
      SELECT * FROM ml_models 
      WHERE tenant_id = $1 AND enabled = true AND model_type = 'threat_classification'
      ORDER BY accuracy_score DESC NULLS LAST
      LIMIT 1
    `, [tenantId]);

    if (modelsResult.rows.length === 0) {
      return {
        available: false,
        message: 'No trained threat prediction models available'
      };
    }

    // In a real implementation, this would use the actual ML model
    // For now, we'll return mock predictions based on historical data
    const historicalResult = await db.query(`
      SELECT 
        event_category,
        severity,
        COUNT(*) as historical_count,
        AVG(confidence_score) as avg_confidence
      FROM threat_lake_events 
      WHERE tenant_id = $1 
      AND timestamp >= $2 - INTERVAL '7 days'
      AND timestamp < $2
      GROUP BY event_category, severity
    `, [tenantId, timeRange.start_time]);

    const predictions = historicalResult.rows.map(row => ({
      event_category: row.event_category,
      severity: row.severity,
      predicted_count: Math.round(row.historical_count * 1.1), // Simple prediction
      confidence: Math.min(row.avg_confidence * 0.8, 0.95),
      prediction_window: '24h'
    }));

    return {
      available: true,
      model_version: modelsResult.rows[0].model_version,
      model_accuracy: modelsResult.rows[0].accuracy_score,
      predictions
    };
  } catch {
    logger.error('Failed to get threat predictions', { error, tenantId });
    return {
      available: false,
      error: 'Failed to generate predictions'
    };
  }
}

async function getThreatTrends(tenantId: string, timeRange: TimeRange) {
  try {
    const { db } = await import('@/lib/database');
    
    // Get hourly trends for the time period
    const trendsResult = await db.query(`
      SELECT 
        date_trunc('hour', timestamp) as hour,
        severity,
        COUNT(*) as event_count,
        AVG(confidence_score) as avg_confidence
      FROM threat_lake_events 
      WHERE tenant_id = $1 
      AND timestamp >= $2 
      AND timestamp <= $3
      GROUP BY hour, severity
      ORDER BY hour, severity
    `, [tenantId, timeRange.start_time, timeRange.end_time]);

    // Calculate trend direction for each severity
    const severityTrends = await db.query(`
      WITH hourly_counts AS (
        SELECT 
          date_trunc('hour', timestamp) as hour,
          severity,
          COUNT(*) as event_count
        FROM threat_lake_events 
        WHERE tenant_id = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
        GROUP BY hour, severity
      ),
      trend_calc AS (
        SELECT 
          severity,
          AVG(event_count) as avg_count,
          CASE 
            WHEN COUNT(*) > 1 THEN
              (COUNT(*) * SUM(EXTRACT(EPOCH FROM hour) * event_count) - SUM(EXTRACT(EPOCH FROM hour)) * SUM(event_count)) /
              (COUNT(*) * SUM(POWER(EXTRACT(EPOCH FROM hour), 2)) - POWER(SUM(EXTRACT(EPOCH FROM hour)), 2))
            ELSE 0
          END as trend_slope
        FROM hourly_counts
        GROUP BY severity
      )
      SELECT 
        severity,
        avg_count,
        CASE 
          WHEN trend_slope > 0.1 THEN 'increasing'
          WHEN trend_slope < -0.1 THEN 'decreasing'
          ELSE 'stable'
        END as trend_direction,
        ABS(trend_slope) as trend_strength
      FROM trend_calc
    `, [tenantId, timeRange.start_time, timeRange.end_time]);

    // Get correlation trends
    const correlationTrends = await db.query(`
      SELECT 
        date_trunc('hour', created_at) as hour,
        status,
        COUNT(*) as correlation_count
      FROM event_correlations 
      WHERE tenant_id = $1 
      AND created_at >= $2 
      AND created_at <= $3
      GROUP BY hour, status
      ORDER BY hour, status
    `, [tenantId, timeRange.start_time, timeRange.end_time]);

    return {
      hourly_events: trendsResult.rows,
      severity_trends: severityTrends.rows,
      correlation_trends: correlationTrends.rows,
      analysis_period: {
        start: timeRange.start_time,
        end: timeRange.end_time,
        duration_hours: Math.round((timeRange.end_time.getTime() - timeRange.start_time.getTime()) / (1000 * 60 * 60))
      }
    };
  } catch {
    logger.error('Failed to get threat trends', { error, tenantId });
    return {
      error: 'Failed to calculate trends'
    };
  }
}