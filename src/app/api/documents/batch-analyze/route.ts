import { NextRequest, NextResponse } from 'next/server';
import { documentAnalysisService } from '@/services/document-analysis.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AnalysisType, ProcessingOptions } from '@/types';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      document_ids,
      analysis_type,
      framework_id,
      processing_options,
    } = body;

    // Validate required fields
    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DOCUMENT_IDS_REQUIRED',
          message: 'Document IDs array is required',
        },
      }, { status: 400 });
    }

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

    // Validate batch size (max 10 documents)
    if (document_ids.length > 10) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'BATCH_SIZE_EXCEEDED',
          message: 'Maximum 10 documents allowed per batch',
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

    const batchRequest = {
      document_ids,
      analysis_type,
      framework_id,
      processing_options: { ...defaultProcessingOptions, ...processing_options },
    };

    const _result = await documentAnalysisService.analyzeBatch(tenant.id, batchRequest);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Batch analysis error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'BATCH_ANALYSIS_ERROR',
        message: 'Failed to perform batch analysis',
      },
    }, { status: 500 });
  }
}