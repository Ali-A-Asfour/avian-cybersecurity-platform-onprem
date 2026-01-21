import { NextRequest, NextResponse } from 'next/server';
import { monitoring } from '@/lib/monitoring';
import { authMiddleware } from '@/middleware/auth.middleware';

/**
 * GET /api/metrics
 * 
 * Returns current metrics summary
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  // Authenticate request
  const authResult = await authMiddleware(request);
  if (!authResult.success || !authResult.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Only allow super admins to view metrics
  if (authResult.user.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Forbidden - Super admin access required' },
      { status: 403 }
    );
  }

  try {
    const summary = await monitoring.getMetricsSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
