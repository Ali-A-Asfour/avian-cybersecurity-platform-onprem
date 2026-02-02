import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { ApiResponse, HeartbeatData } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: agentId } = await params;

    // Validate agent authentication (in real implementation, this would verify agent credentials)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'AGENT_AUTH_REQUIRED',
          message: 'Agent authentication required',
        },
      };
      return NextResponse.json(response, { status: 401 });
    }

    const body = await request.json();
    const heartbeatData: HeartbeatData = {
      agent_id: agentId,
      timestamp: new Date(body.timestamp),
      status: body.status,
      health_metrics: body.health_metrics,
      installed_tools: body.installed_tools || [],
      system_info: body.system_info,
      security_events: body.security_events || [],
    };

    // Validate required fields
    if (!heartbeatData.status || !heartbeatData.health_metrics || !heartbeatData.system_info) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INVALID_HEARTBEAT',
          message: 'Invalid heartbeat data: status, health_metrics, and system_info are required',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Process heartbeat
    await agentService.processHeartbeat(heartbeatData);

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Heartbeat processed successfully',
        next_heartbeat_interval: 300, // 5 minutes
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const { id: _id } = await params;
    logger.error('Failed to process agent heartbeat', { error, agentId: id });

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'HEARTBEAT_PROCESS_ERROR',
        message: 'Failed to process heartbeat',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}