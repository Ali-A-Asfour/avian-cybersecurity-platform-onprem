import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function POST(request: NextRequest) {
  try {
    // In a real implementation, extract tenant ID from JWT token
    const _tenantId = 'dev-tenant-123';

    const body = await request.json();
    const { framework_id, format = 'pdf' } = body;

    // Validate format
    if (!['pdf', 'csv'].includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Invalid report format. Supported formats: pdf, csv',
          },
        },
        { status: 400 }
      );
    }

    const _result = await complianceService.generateComplianceReport(
      tenantId,
      framework_id,
      format
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    console.error('Error generating compliance report:', error);
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