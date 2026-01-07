import { NextRequest, NextResponse } from 'next/server';
import { PlaybookService } from '@/services/playbook.service';
import { UserRole } from '@/types';
import { authMiddleware } from '@/middleware/auth.middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only Security Analysts and above can access playbooks
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.SECURITY_ANALYST].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const playbook = await PlaybookService.getPlaybook(params.id, authResult.user.tenant_id);
    
    if (!playbook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Playbook not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: playbook
    });
  } catch (error) {
    console.error('Error fetching playbook:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch playbook' } },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only Security Analysts and above can update playbooks
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.SECURITY_ANALYST].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    const updatedPlaybook = await PlaybookService.updatePlaybook(
      params.id, 
      authResult.user.tenant_id, 
      body
    );

    if (!updatedPlaybook) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Playbook not found or cannot be updated' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedPlaybook
    });
  } catch (error) {
    console.error('Error updating playbook:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update playbook' } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only Security Analysts and above can delete playbooks
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.SECURITY_ANALYST].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const deleted = await PlaybookService.deletePlaybook(params.id, authResult.user.tenant_id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Playbook not found or cannot be deleted' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Playbook deleted successfully' }
    });
  } catch (error) {
    console.error('Error deleting playbook:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete playbook' } },
      { status: 500 }
    );
  }
}