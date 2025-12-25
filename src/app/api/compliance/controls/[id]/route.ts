import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';
import { ComplianceStatus } from '@/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In a real implementation, extract tenant ID from JWT token
    const _tenantId = 'dev-tenant-123';
    const { id: controlId } = await params;

    const body = await request.json();
    const { status, assigned_to } = body;

    // Validate status
    if (!Object.values(ComplianceStatus).includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Invalid compliance status',
          },
        },
        { status: 400 }
      );
    }

    const _result = await complianceService.updateControlStatus(
      tenantId,
      controlId,
      status,
      assigned_to
    );

    if (!result.success) {
      return NextResponse.json(result, { status: result.error?.code === 'CONTROL_NOT_FOUND' ? 404 : 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating compliance control:', error);
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