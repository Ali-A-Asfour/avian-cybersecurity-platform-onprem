import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In a real implementation, extract tenant ID from JWT token
    const _tenantId = 'dev-tenant-123';
    const { id: controlId } = await params;

    const _result = await complianceService.getEvidenceByControl(tenantId, controlId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching compliance evidence:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In a real implementation, extract tenant ID and user ID from JWT token
    const _tenantId = 'dev-tenant-123';
    const uploadedBy = 'current-user-id';
    const { id: controlId } = await params;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_REQUIRED',
            message: 'File is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate file type and size
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Invalid file type. Allowed types: PDF, JPEG, PNG, DOC, DOCX, TXT',
          },
        },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File size must be less than 10MB',
          },
        },
        { status: 400 }
      );
    }

    // In a real implementation, save the file to storage (S3, local filesystem, etc.)
    const filename = `evidence-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `/uploads/evidence/${filename}`;

    const _result = await complianceService.uploadEvidence(
      tenantId,
      controlId,
      {
        filename,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        filePath,
      },
      description || '',
      uploadedBy
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error uploading compliance evidence:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}