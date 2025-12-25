import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function GET(request: NextRequest) {
  try {
    // In a real implementation, extract tenant ID from JWT token
    const tenantId = 'dev-tenant-123';

    const result = await complianceService.getFrameworks(tenantId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching compliance frameworks:', error);
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

export async function POST(request: NextRequest) {
  try {
    const tenantId = 'dev-tenant-123';
    const { frameworkKey } = await request.json();

    if (!frameworkKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FRAMEWORK_KEY',
            message: 'Framework key is required',
          },
        },
        { status: 400 }
      );
    }

    const result = await complianceService.enableFramework(tenantId, frameworkKey);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error enabling compliance framework:', error);
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