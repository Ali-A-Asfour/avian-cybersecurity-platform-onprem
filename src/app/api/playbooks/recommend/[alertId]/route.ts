import { NextRequest, NextResponse } from 'next/server';
import { PlaybookService } from '@/services/playbook.service';
import { AlertService } from '@/services/alert.service';
import { UserRole } from '@/types';
import { authMiddleware } from '@/middleware/auth.middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: { alertId: string } }
) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only Security Analysts and above can access playbook recommendations
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.SECURITY_ANALYST].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    // Get the alert
    const alertResponse = await AlertService.getAlertById(authResult.user.tenant_id, params.alertId);
    const alert = alertResponse.success ? alertResponse.data : null;
    if (!alert) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Alert not found' } },
        { status: 404 }
      );
    }

    // Get playbook recommendations
    const recommendations = await PlaybookService.getRecommendations(alert);

    return NextResponse.json({
      success: true,
      data: recommendations
    });
  } catch {
    console.error('Error getting playbook recommendations:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get recommendations' } },
      { status: 500 }
    );
  }
}