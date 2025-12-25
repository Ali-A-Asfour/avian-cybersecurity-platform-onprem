import { NextRequest, NextResponse } from 'next/server';
import { SiemConnector } from '@/lib/connectors/siem-connector';
import { ErrorHandler, ApiErrors } from '@/lib/api-errors';
import { authMiddleware, requireRole } from '@/middleware/auth.middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { UserRole } from '@/types';
import { z } from 'zod';

import { ConnectorType, ConnectorRegistry } from '@/lib/connectors/base-connector';

// Register connector factories
ConnectorRegistry.registerFactory(ConnectorType.SIEM, (config) => new SiemConnector(config as any));

// Connector configuration validation schema
const connectorConfigSchema = z.object({
  name: z.string().min(1, 'Connector name is required').max(100),
  type: z.nativeEnum(ConnectorType),
  enabled: z.boolean().default(true),
  settings: z.record(z.string(), z.any()),
  credentials: z.record(z.string(), z.string()).optional(),
  metadata: z.object({
    version: z.string(),
    description: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * GET /api/connectors - List all connectors
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(request, {
      windowMs: 1 * 60 * 1000,
      maxRequests: 100,
    });
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Check permissions
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return ErrorHandler.handleError(
        ApiErrors.unauthorized(),
        '/api/connectors'
      );
    }

    // Only admins can view connectors
    const roleCheck = await requireRole(UserRole.TENANT_ADMIN)(request);
    if (roleCheck) {
      return roleCheck;
    }

    // Get all connectors
    const connectors = ConnectorRegistry.getAllConnectors();
    const connectorsInfo = connectors.map(connector => ({
      ...connector.getInfo(),
      health: connector.getHealth(),
      capabilities: connector.getCapabilities(),
    }));

    return ErrorHandler.success(connectorsInfo);
  } catch {
    return ErrorHandler.handleError(error, '/api/connectors');
  }
}

/**
 * POST /api/connectors - Create a new connector
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(request, {
      windowMs: 1 * 60 * 1000,
      maxRequests: 100,
    });
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Check permissions
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return ErrorHandler.handleError(
        ApiErrors.unauthorized(),
        '/api/connectors'
      );
    }

    // Only admins can create connectors
    const roleCheck = await requireRole(UserRole.TENANT_ADMIN)(request);
    if (roleCheck) {
      return roleCheck;
    }

    // Validate request body
    const validationResult = await validateRequest(connectorConfigSchema)(request);
    if (!validationResult.success) {
      return ErrorHandler.handleError(
        ApiErrors.validation(validationResult.error.message, validationResult.error.details),
        '/api/connectors'
      );
    }

    const connectorConfig = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...validationResult.data!,
      credentials: validationResult.data!.credentials as Record<string, string> | undefined,
    };

    // Create connector
    const _result = await ConnectorRegistry.createConnector(connectorConfig);

    if (!result.success) {
      return ErrorHandler.handleError(
        ApiErrors.internal(result.error?.message || 'Failed to create connector'),
        '/api/connectors'
      );
    }

    // Auto-connect if enabled
    if (connectorConfig.enabled && result.data) {
      await result.data.connect();
    }

    return ErrorHandler.success({
      ...result.data!.getInfo(),
      health: result.data!.getHealth(),
      capabilities: result.data!.getCapabilities(),
    }, undefined, 201);
  } catch {
    return ErrorHandler.handleError(error, '/api/connectors');
  }
}

/**
 * OPTIONS /api/connectors - Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}