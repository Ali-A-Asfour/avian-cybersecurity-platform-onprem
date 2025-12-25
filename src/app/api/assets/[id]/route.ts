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

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get asset
    const asset = await assetService.getAssetById(assetId);

    if (!asset) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'Asset not found',
        },
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Verify asset belongs to the tenant
    if (asset.tenant_id !== tenant.id) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'ASSET_ACCESS_DENIED',
          message: 'Access denied to this asset',
        },
      };
      return NextResponse.json(response, { status: 403 });
    }

    const response: ApiResponse = {
      success: true,
      data: asset,
    };

    return NextResponse.json(response);
  } catch {
    logger.error('Failed to get asset', { error, assetId: id });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'ASSET_FETCH_ERROR',
        message: 'Failed to retrieve asset',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}