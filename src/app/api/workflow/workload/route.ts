import { NextRequest, NextResponse } from 'next/server';
import { WorkflowService } from '@/services/workflow.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
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

    const workloadSummary = await WorkflowService.getWorkloadSummary(tenantResult.tenant!.id);

    const response: ApiResponse = {
      success: true,
      data: workloadSummary,
    };

    return NextResponse.json(response);
  } catch {
    console.error('Error fetching workload summary:', error);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch workload summary',
      },
    };
    return NextResponse.json(response, { status: 500 });
  }
}