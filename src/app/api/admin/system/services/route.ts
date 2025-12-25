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

    // Only super admins can access service status
    if (authResult.user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // In a real implementation, these would check actual service health
    // For now, return mock service statuses
    const services = [
      {
        name: 'Web Application',
        status: 'healthy',
        message: 'All endpoints responding normally',
        last_check: new Date().toISOString(),
      },
      {
        name: 'PostgreSQL Database',
        status: 'healthy',
        message: 'Connection pool healthy, queries executing normally',
        last_check: new Date().toISOString(),
      },
      {
        name: 'Redis Cache',
        status: 'healthy',
        message: 'Cache hit ratio: 94.2%',
        last_check: new Date().toISOString(),
      },
      {
        name: 'Email Service',
        status: 'healthy',
        message: 'SMTP connection active, queue processing normally',
        last_check: new Date().toISOString(),
      },
      {
        name: 'File Storage',
        status: 'warning',
        message: 'Storage usage at 78% capacity',
        last_check: new Date().toISOString(),
      },
      {
        name: 'Background Jobs',
        status: 'healthy',
        message: 'All job queues processing normally',
        last_check: new Date().toISOString(),
      },
      {
        name: 'External API Connectors',
        status: 'healthy',
        message: 'All SIEM connectors responding',
        last_check: new Date().toISOString(),
      },
      {
        name: 'Monitoring & Logging',
        status: 'healthy',
        message: 'Log aggregation and metrics collection active',
        last_check: new Date().toISOString(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: services,
    });
  } catch (error) {
    console.error('Service status error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'Failed to fetch service status' 
        } 
      },
      { status: 500 }
    );
  }
}