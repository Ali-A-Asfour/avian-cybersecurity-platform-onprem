import { NextRequest, NextResponse } from 'next/server';
import { assetService } from '@/services/asset.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const assetId = params.id;
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: authResult.error || 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const tenantResult = await tenantMiddleware(request, authResult.user);
    if (!tenantResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: tenantResult.error || {
            code: 'TENANT_ERROR',
            message: 'Failed to process tenant context',
          },
        },
        { status: 500 }
      );
    }

    const user = authResult.user;
    const { tenant } = tenantResult;

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
    logger.error('Failed to scan asset', { error, assetId });
    
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