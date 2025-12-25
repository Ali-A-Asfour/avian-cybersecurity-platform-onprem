import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../../../../../lib/auth';
import { UserRole } from '../../../../../types';

export async function GET(request: NextRequest) {
  try {
    // Authenticate and authorize
    const authResult = await AuthService.authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only super admins can access system metrics
    if (authResult.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // In a real implementation, these would be gathered from system monitoring tools
    // For now, return realistic mock data
    const metrics = {
      cpu_usage: Math.random() * 30 + 20, // 20-50%
      memory_usage: Math.random() * 25 + 45, // 45-70%
      disk_usage: Math.random() * 20 + 30, // 30-50%
      network_io: {
        bytes_in: Math.floor(Math.random() * 1000000000) + 500000000, // 500MB-1.5GB
        bytes_out: Math.floor(Math.random() * 800000000) + 300000000, // 300MB-1.1GB
      },
      database: {
        connections: Math.floor(Math.random() * 50) + 20, // 20-70 connections
        max_connections: 100,
        query_time_avg: Math.random() * 50 + 10, // 10-60ms
      },
      redis: {
        memory_used: Math.floor(Math.random() * 200000000) + 100000000, // 100-300MB
        memory_max: 500000000, // 500MB
        connected_clients: Math.floor(Math.random() * 20) + 5, // 5-25 clients
      },
      api: {
        requests_per_minute: Math.floor(Math.random() * 500) + 200, // 200-700 req/min
        avg_response_time: Math.random() * 100 + 50, // 50-150ms
        error_rate: Math.random() * 2, // 0-2%
      },
      uptime: Math.floor(Math.random() * 1000000) + 2000000, // ~23+ days
      last_updated: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('System metrics error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch system metrics' 
        } 
      },
      { status: 500 }
    );
  }
}