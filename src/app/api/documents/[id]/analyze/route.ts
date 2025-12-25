import { NextRequest, NextResponse } from 'next/server';
import { documentAnalysisService } from '@/services/document-analysis.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AnalysisType, ProcessingOptions } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const documentId = id;

    const body = await request.json();
    const {
      analysis_type,
      framework_id,
      control_id,
      processing_options,
    } = body;

    // Validate required fields
    if (!analysis_type) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ANALYSIS_TYPE_REQUIRED',
          message: 'Analysis type is required',
        },
      }, { status: 400 });
    }

    // Validate analysis type
    if (!Object.values(AnalysisType).includes(analysis_type)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_ANALYSIS_TYPE',
          message: 'Invalid analysis type',
        },
      }, { status: 400 });
    }

    // Set default processing options
    const defaultProcessingOptions: ProcessingOptions = {
      enable_ocr: true,
      enable_nlp: true,
      confidence_threshold: 70,
      language: 'en',
      extract_tables: true,
      extract_images: false,
      compliance_frameworks: framework_id ? [framework_id] : [],
    };

    const analysisRequest = {
      document_id: documentId,
      analysis_type,
      framework_id,
      control_id,
      processing_options: { ...defaultProcessingOptions, ...processing_options },
    };

    const _result = await documentAnalysisService.analyzeDocument(tenant.id, analysisRequest);

    if (!result.success) {
      return NextResponse.json(result, { status: result.error?.code === 'DOCUMENT_NOT_FOUND' ? 404 : 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    console.error('Document analysis error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'ANALYSIS_ERROR',
        message: 'Failed to analyze document',
      },
    }, { status: 500 });
  }
}