import { NextRequest, NextResponse } from 'next/server';
import { ConnectorRegistry } from '@/lib/connectors/base-connector';
import { validateRequest } from '@/lib/validation';
import { ErrorHandler, ApiErrors } from '@/lib/api-errors';
import { authMiddleware, requireRole } from '@/middleware/auth.middleware';
import { RateLimiter, RateLimitPolicies } from '@/lib/rate-limiter';
import { UserRole } from '@/types';
import { z } from 'zod';

// Update connector schema
const updateConnectorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  metadata: z.object({
    version: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * GET /api/connectors/[id] - Get connector details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: connectorId } = await params;

  try {

    // Apply rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
      request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = await RateLimiter.checkRateLimit(
      clientIp, 
      { windowMs: 1 * 60 * 1000, maxRequests: 100 },
      'connector-get'
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    // Check permissions
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return ErrorHandler.handleError(
        ApiErrors.unauthorized(),
        `/api/connectors/${connectorId}`
      );
    }

    const roleCheck = await requireRole(UserRole.TENANT_ADMIN)(request);
    if (roleCheck) {
      return roleCheck;
    }

    // Get connector
    const connector = ConnectorRegistry.getConnector(connectorId);
    if (!connector) {
      return ErrorHandler.handleError(
        ApiErrors.notFound('Connector'),
        `/api/connectors/${connectorId}`
      );
    }

    return ErrorHandler.success({
      ...connector.getInfo(),
      health: connector.getHealth(),
      capabilities: connector.getCapabilities(),
    });
  } catch (error) {
    return ErrorHandler.handleError(error, `/api/connectors/${connectorId}`);
  }
}

/**
 * PUT /api/connectors/[id] - Update connector configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: connectorId } = await params;

  try {
    // Apply rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
      request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = await RateLimiter.checkRateLimit(
      clientIp, 
      { windowMs: 1 * 60 * 1000, maxRequests: 100 },
      'connector-put'
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    // Check permissions
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return ErrorHandler.handleError(
        ApiErrors.unauthorized(),
        `/api/connectors/${connectorId}`
      );
    }

    const roleCheck = await requireRole(UserRole.TENANT_ADMIN)(request);
    if (roleCheck) {
      return roleCheck;
    }

    // Validate request body
    const validationResult = await validateRequest(updateConnectorSchema)(request);
    if (!validationResult.success) {
      return ErrorHandler.handleError(
        ApiErrors.validation(validationResult.error.message, validationResult.error.details),
        `/api/connectors/${connectorId}`
      );
    }

    // Get connector
    const connector = ConnectorRegistry.getConnector(connectorId);
    if (!connector) {
      return ErrorHandler.handleError(
        ApiErrors.notFound('Connector'),
        `/api/connectors/${connectorId}`
      );
    }

    // Update connector configuration
    const currentConfig = connector.getInfo();
    const updatedConfig = {
      ...currentConfig,
      ...validationResult.data!,
      credentials: validationResult.data!.credentials as Record<string, string> | undefined,
      metadata: {
        ...currentConfig.metadata,
        ...validationResult.data!.metadata,
        version: validationResult.data!.metadata?.version || currentConfig.metadata?.version || '1.0.0',
      },
    };

    const _result = await connector.updateConfig(updatedConfig);

    if (!result.success) {
      return ErrorHandler.handleError(
        ApiErrors.internal(result.error?.message || 'Failed to update connector'),
        `/api/connectors/${connectorId}`
      );
    }

    return ErrorHandler.success({
      ...connector.getInfo(),
      health: connector.getHealth(),
      capabilities: connector.getCapabilities(),
    });
  } catch (error) {
    return ErrorHandler.handleError(error, `/api/connectors/${connectorId}`);
  }
}

/**
 * DELETE /api/connectors/[id] - Remove connector
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: connectorId } = await params;

  try {
    // Apply rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 
      request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = await RateLimiter.checkRateLimit(
      clientIp, 
      { windowMs: 1 * 60 * 1000, maxRequests: 100 },
      'connector-delete'
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    // Check permissions
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return ErrorHandler.handleError(
        ApiErrors.unauthorized(),
        `/api/connectors/${connectorId}`
      );
    }

    const roleCheck = await requireRole(UserRole.TENANT_ADMIN)(request);
    if (roleCheck) {
      return roleCheck;
    }

    // Remove connector
    const _result = await ConnectorRegistry.removeConnector(connectorId);

    if (!result.success) {
      return ErrorHandler.handleError(
        ApiErrors.internal(result.error?.message || 'Failed to remove connector'),
        `/api/connectors/${connectorId}`
      );
    }

    return ErrorHandler.success({ message: 'Connector removed successfully' });
  } catch (error) {
    return ErrorHandler.handleError(error, `/api/connectors/${connectorId}`);
  }
}

/**
 * OPTIONS /api/connectors/[id] - Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}