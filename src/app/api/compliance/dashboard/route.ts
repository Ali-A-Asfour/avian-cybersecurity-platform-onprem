import { NextRequest, NextResponse } from 'next/server';
import { complianceService } from '@/services/compliance.service';

export async function GET(request: NextRequest) {
  try {
    // In a real implementation, extract tenant ID from JWT token
    const tenantId = 'dev-tenant-123';

    const result = await complianceService.getComplianceDashboardData(tenantId);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching compliance dashboard data:', error);
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