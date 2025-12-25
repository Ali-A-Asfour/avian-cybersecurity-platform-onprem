import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
// import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply authentication middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const _agentId = params.id;
    const _telemetryData = await request.json();

    // Validate telemetry data structure
    if (!telemetryData || typeof telemetryData !== 'object') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_TELEMETRY_DATA',
          message: 'Invalid telemetry data format',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Ingest telemetry data
    await agentService.ingestTelemetryData(agentId, telemetryData);

    // Correlate data with other sources if requested
    let correlationResults = null;
    if (telemetryData.enable_correlation) {
      correlationResults = await agentService.correlateAgentData(agentId, telemetryData);
    }

    // Generate anomaly alerts if requested
    if (telemetryData.enable_anomaly_detection) {
      await agentService.generateAnomalyAlerts(agentId, telemetryData);
    }

    const response: ApiResponse = {
      success: true,
      data: {
        agent_id: agentId,
        processed_at: new Date(),
        data_types_processed: Object.keys(telemetryData),
        correlation_results: correlationResults,
      },
    };

    return NextResponse.json(response);
  } catch {
    logger.error('Failed to process agent telemetry', { error, agentId: params.id });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TELEMETRY_PROCESSING_ERROR',
        message: 'Failed to process telemetry data',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Apply authentication middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const _agentId = params.id;
    const { searchParams } = new URL(request.url);
    const _timeRange = searchParams.get('time_range') || '24h';
    const dataTypes = searchParams.get('data_types')?.split(',') || [];

    // Get telemetry data for the specified time range
    const _telemetryData = await getTelemetryData(agentId, timeRange, dataTypes);

    const response: ApiResponse = {
      success: true,
      data: telemetryData,
    };

    return NextResponse.json(response);
  } catch {
    logger.error('Failed to get agent telemetry', { error, agentId: params.id });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'TELEMETRY_FETCH_ERROR',
        message: 'Failed to retrieve telemetry data',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

async function getTelemetryData(agentId: string, timeRange: string, dataTypes: string[]): Promise<any> {
  // In a real implementation, this would query the telemetry database
  // For now, return mock data
  const mockData = {
    agent_id: agentId,
    time_range: timeRange,
    data_types: dataTypes,
    metrics: {
      system_performance: {
        avg_cpu_usage: 45.2,
        avg_memory_usage: 67.8,
        avg_disk_usage: 23.1,
        peak_cpu_usage: 89.5,
        peak_memory_usage: 92.3,
      },
      security_events: {
        total_events: 156,
        critical_events: 2,
        high_events: 8,
        medium_events: 34,
        low_events: 112,
      },
      network_activity: {
        total_connections: 1247,
        suspicious_connections: 3,
        blocked_connections: 12,
        data_transferred_mb: 2847.5,
      },
      file_activity: {
        files_created: 89,
        files_modified: 234,
        files_deleted: 12,
        suspicious_file_changes: 1,
      },
    },
    alerts_generated: 5,
    correlations_found: 2,
    last_updated: new Date(),
  };

  return mockData;
}