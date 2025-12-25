import { NextRequest, NextResponse } from 'next/server';
import { PlaybookService } from '@/services/playbook.service';
import { UserRole } from '@/types';
import { authMiddleware } from '@/middleware/auth.middleware';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; stepId: string } }
) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only Security Analysts and above can complete steps
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.SECURITY_ANALYST].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { notes, verificationStatus = 'verified' } = body;

    const updatedExecution = await PlaybookService.completeStep(
      params.id,
      params.stepId,
      authResult.user.user_id,
      notes,
      verificationStatus
    );

    if (!updatedExecution) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Execution not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedExecution
    });
  } catch {
    console.error('Error completing step:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to complete step' } },
      { status: 500 }
    );
  }
}