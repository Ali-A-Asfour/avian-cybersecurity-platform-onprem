import { NextRequest, NextResponse } from 'next/server';
import { documentAnalysisService } from '@/services/document-analysis.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

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

    const { user, tenant } = tenantResult;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const controlId = formData.get('controlId') as string;
    const frameworkId = formData.get('frameworkId') as string;
    const description = formData.get('description') as string;
    const analysisRequested = formData.get('analysisRequested') === 'true';

    if (!file) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FILE_REQUIRED',
          message: 'File is required',
        },
      }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/tiff',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'File type not supported for analysis',
        },
      }, { status: 400 });
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds 50MB limit',
        },
      }, { status: 400 });
    }

    // In a real implementation, you would save the file to storage
    // For now, we'll simulate the file upload
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `/uploads/documents/${filename}`;

    const fileData = {
      filename,
      originalFilename: file.name,
      fileSize: file.size,
      mimeType: file.type,
      filePath,
    };

    const metadata = {
      controlId: controlId || undefined,
      frameworkId: frameworkId || undefined,
      description: description || undefined,
      analysisRequested,
    };

    const _result = await documentAnalysisService.uploadDocument(
      tenant.id,
      fileData,
      metadata,
      user.id
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    console.error('Document upload error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: 'Failed to upload document',
      },
    }, { status: 500 });
  }
}