import { NextRequest, NextResponse } from 'next/server';
import { assetService } from '@/services/asset.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
// import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
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

    // Get assets for the tenant
    const assets = await assetService.getAssetsByTenant(tenant.id);

    const response: ApiResponse = {
      success: true,
      data: assets,
      meta: {
        total: assets.length,
      },
    };

    return NextResponse.json(response);
  } catch {
    logger.error('Failed to get assets', { error });
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'ASSETS_FETCH_ERROR',
        message: 'Failed to retrieve assets',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}