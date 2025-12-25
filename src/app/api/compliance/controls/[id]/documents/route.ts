import { NextRequest, NextResponse } from 'next/server';
import { documentAnalysisService } from '@/services/document-analysis.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Await params in Next.js 16
    const { id } = await params;
    
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success) {
      return NextResponse.json(authResult, { status: 401 });
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (!tenantResult.success) {
      return NextResponse.json(tenantResult, { status: 403 });
    }

    const { tenant } = tenantResult;
    const controlId = id;

    const _result = await documentAnalysisService.getAnalysesByControl(tenant.id, controlId);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    console.error('Get control documents error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'CONTROL_DOCUMENTS_ERROR',
        message: 'Failed to fetch control documents',
      },
    }, { status: 500 });
  }
}