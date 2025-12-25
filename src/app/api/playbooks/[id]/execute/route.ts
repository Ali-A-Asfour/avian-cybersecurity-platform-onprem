import { NextRequest, NextResponse } from 'next/server';
import { PlaybookService } from '@/services/playbook.service';
import { UserRole } from '@/types';
import { authMiddleware } from '@/middleware/auth.middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only Security Analysts and above can execute playbooks
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.SECURITY_ANALYST].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { alertId, incidentId } = body;

    const execution = await PlaybookService.startExecution(
      params.id,
      authResult.user.tenant_id,
      authResult.user.user_id,
      alertId,
      incidentId
    );

    return NextResponse.json({
      success: true,
      data: execution
    }, { status: 201 });
  } catch (error) {
    console.error('Error starting playbook execution:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to start execution' } },
      { status: 500 }
    );
  }
}