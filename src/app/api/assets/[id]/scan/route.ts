import { NextRequest, NextResponse } from 'next/server';
import { assetService } from '@/services/asset.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Await params in Next.js 16
    const { id } = await params;
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { user, tenant } = tenantResult;
    const assetId = id;

    // Only Security Analysts, Tenant Admins, and Super Admins can initiate scans
    if (!['super_admin', 'tenant_admin', 'security_analyst'].includes(user.role)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions to scan assets',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    // Scan asset for vulnerabilities
    const vulnerabilities = await assetService.scanAssetVulnerabilities(assetId);

    const response: ApiResponse = {
      success: true,
      data: {
        asset_id: assetId,
        scan_completed_at: new Date(),
        vulnerabilities_found: vulnerabilities.length,
        vulnerabilities: vulnerabilities,
        summary: {
          critical: vulnerabilities.filter(v => v.severity === 'critical').length,
          high: vulnerabilities.filter(v => v.severity === 'high').length,
          medium: vulnerabilities.filter(v => v.severity === 'medium').length,
          low: vulnerabilities.filter(v => v.severity === 'low').length,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to scan asset', { error, assetId: id });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'ASSET_SCAN_ERROR',
        message: 'Failed to scan asset',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}