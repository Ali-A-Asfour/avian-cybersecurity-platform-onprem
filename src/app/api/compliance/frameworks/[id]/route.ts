import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In a real implementation, extract tenant ID from JWT token
    const _tenantId = 'dev-tenant-123';
    const { id: frameworkId } = await params;

    const _result = await complianceService.getFrameworkById(tenantId, frameworkId);

    if (!result.success) {
      return NextResponse.json(result, { status: result.error?.code === 'FRAMEWORK_NOT_FOUND' ? 404 : 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching compliance framework:', error);
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