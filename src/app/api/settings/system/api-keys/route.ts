import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

// Mock API keys storage
const apiKeysStore = new Map<string, any[]>();

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'sk_';
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export async function GET(request: NextRequest) {
  try {
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

    const { tenant } = tenantResult;
    const keysKey = tenant!.id;
    const keys = apiKeysStore.get(keysKey) || [];

    return NextResponse.json({
      success: true,
      data: keys,
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_API_KEYS_ERROR',
          message: 'Failed to fetch API keys',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const { tenant } = tenantResult;
    const body = await request.json();
    const keysKey = tenant!.id;

    const newKey = {
      id: `key_${Date.now()}`,
      name: body.name,
      key: generateApiKey(),
      createdAt: new Date().toISOString(),
      lastUsed: null,
    };

    const keys = apiKeysStore.get(keysKey) || [];
    keys.push(newKey);
    apiKeysStore.set(keysKey, keys);

    return NextResponse.json({
      success: true,
      data: newKey,
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CREATE_API_KEY_ERROR',
          message: 'Failed to create API key',
        },
      },
      { status: 500 }
    );
  }
}
