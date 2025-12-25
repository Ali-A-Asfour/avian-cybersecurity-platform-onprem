import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/services/workflow.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: _id } = await params;
  try {
    // Apply middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: authResult.error || "Authentication failed" } }, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: tenantResult.error?.message || "Access denied" } }, { status: 403 });
    }

    const body = await request.json();
    const { assignee, reason } = body;

    // Validate required fields
    if (!assignee) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Assignee is required',
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    await WorkflowService.reassignTicket(
      tenantResult.tenant!.id,
      id,
      assignee,
      "system",
      reason
    );

    const response: ApiResponse = {
      success: true,
      data: { reassigned: true },
    };

    return NextResponse.json(response);
  } catch {
    console.error('Error reassigning ticket:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to reassign ticket',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}