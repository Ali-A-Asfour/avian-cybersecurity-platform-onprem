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

export async function GET(request: NextRequest, { params }: RouteParams) {
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
    if (asset.tenant_id !== tenant!.id) {
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
  } catch (error) {
    logger.error('Failed to get asset', { error, assetId });
    
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