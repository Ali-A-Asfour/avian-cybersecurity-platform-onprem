import { NextRequest, NextResponse } from 'next/server';
import { PlaybookService } from '@/services/playbook.service';
import { authMiddleware } from '@/middleware/auth.middleware';

export async function GET(request: NextRequest) {
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

    const playbooks = await PlaybookService.getPlaybooks(authResult.user.tenant_id);

    return NextResponse.json({
      success: true,
      data: playbooks
    });
  } catch (error) {
    console.error('Error fetching playbooks:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch playbooks' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only Security Analysts and above can create playbooks
    if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.SECURITY_ANALYST].includes(authResult.user.role)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.description || !body.threat_type || !body.severity_level || !body.steps) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    const playbookData = {
      ...body,
      tenant_id: authResult.user.tenant_id,
      created_by: authResult.user.user_id,
      last_updated: new Date(),
      is_active: true,
      is_template: false
    };

    const newPlaybook = await PlaybookService.createPlaybook(playbookData);

    return NextResponse.json({
      success: true,
      data: newPlaybook
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating playbook:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create playbook' } },
      { status: 500 }
    );
  }
}