import { NextRequest, NextResponse } from 'next/server';
import { assetService } from '@/services/asset.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
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
      return NextResponse.json({ success: true, data: [], meta: { total: 0 } });
    }

    const { tenant } = tenantResult;

    let assets: any[] = [];
    try {
      assets = await assetService.getAssetsByTenant(tenant!.id);
    } catch (dbError) {
      logger.warn('Could not query assets, returning empty list', { error: dbError });
    }

    const response: ApiResponse = {
      success: true,
      data: assets,
      meta: {
        total: assets.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
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