import { NextRequest, NextResponse } from 'next/server';
import { PlaybookService } from '@/services/playbook.service';
import { UserRole, ExecutionStatus } from '@/types';
import { authMiddleware } from '@/middleware/auth.middleware';

export async function GET(
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

    // Only Security Analysts and above can view executions
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.SECURITY_ANALYST].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const execution = await PlaybookService.getExecution(params.id);
    
    if (!execution) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Execution not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: execution
    });
  } catch (error) {
    console.error('Error fetching execution:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch execution' } },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    // Only Security Analysts and above can update executions
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.SECURITY_ANALYST].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { notes, status } = body;

    let updatedExecution;

    if (notes !== undefined) {
      updatedExecution = await PlaybookService.updateExecutionNotes(params.id, notes);
    }

    if (status !== undefined) {
      updatedExecution = await PlaybookService.updateExecutionStatus(params.id, status as ExecutionStatus);
    }

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
  } catch (error) {
    console.error('Error updating execution:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update execution' } },
      { status: 500 }
    );
  }
}