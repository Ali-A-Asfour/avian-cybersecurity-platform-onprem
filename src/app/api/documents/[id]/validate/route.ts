import { NextRequest, NextResponse } from 'next/server';
import { documentAnalysisService } from '@/services/document-analysis.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
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
    const documentId = params.id;

    const body = await request.json();
    const { framework_id } = body;

    // Validate required fields
    if (!framework_id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FRAMEWORK_ID_REQUIRED',
          message: 'Framework ID is required for validation',
        },
      }, { status: 400 });
    }

    const _result = await documentAnalysisService.validateDocument(tenant.id, documentId, framework_id);

    if (!result.success) {
      return NextResponse.json(result, { status: result.error?.code === 'DOCUMENT_NOT_FOUND' ? 404 : 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Document validation error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate document',
      },
    }, { status: 500 });
  }
}