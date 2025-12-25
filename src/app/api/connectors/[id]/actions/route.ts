import { NextRequest, NextResponse } from 'next/server';
import { ConnectorRegistry } from '@/lib/connectors/base-connector';
import { validateRequest } from '@/lib/validation';
import { ErrorHandler, ApiErrors } from '@/lib/api-errors';
import { authMiddleware, requireRole } from '@/middleware/auth.middleware';
import { checkRateLimit } from '@/lib/rate-limiter';
import { UserRole } from '@/types';
import { z } from 'zod';

// Action request schema
const actionSchema = z.object({
  action: z.enum(['test', 'connect', 'disconnect', 'health_check']),
  parameters: z.record(z.string(), z.any()).optional(),
});

/**
 * POST /api/connectors/[id]/actions - Execute connector actions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: connectorId } = await params;

  try {

    // Apply rate limiting
    const rateLimitResult = await checkRateLimit(request, { windowMs: 1 * 60 * 1000, maxRequests: 100 });
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Check permissions
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return ErrorHandler.handleError(
        ApiErrors.unauthorized(),
        `/api/connectors/${connectorId}/actions`
      );
    }

    const roleCheck = await requireRole(UserRole.TENANT_ADMIN)(request);
    if (roleCheck) {
      return roleCheck;
    }

    // Validate request body
    const validationResult = await validateRequest(actionSchema)(request);
    if (!validationResult.success) {
      return ErrorHandler.handleError(
        ApiErrors.validation(validationResult.error.message, validationResult.error.details),
        `/api/connectors/${connectorId}/actions`
      );
    }

    const { action, parameters } = validationResult.data!;

    // Get connector
    const connector = ConnectorRegistry.getConnector(connectorId);
    if (!connector) {
      return ErrorHandler.handleError(
        ApiErrors.notFound('Connector'),
        `/api/connectors/${connectorId}/actions`
      );
    }

    let result;
    const startTime = Date.now();

    // Execute action
    switch (action) {
      case 'test':
        result = await connector.testConnection();
        break;

      case 'connect':
        result = await connector.connect();
        break;

      case 'disconnect':
        result = await connector.disconnect();
        break;

      case 'health_check':
        result = await connector.testConnection();
        break;

      default:
        return ErrorHandler.handleError(
          ApiErrors.validation(`Unknown action: ${action}`),
          `/api/connectors/${connectorId}/actions`
        );
    }

    const executionTime = Date.now() - startTime;

    // Return result with execution metadata
    return ErrorHandler.success({
      action,
      connector_id: connectorId,
      success: result.success,
      data: result.data,
      error: result.error,
      execution_time_ms: executionTime,
      health: connector.getHealth(),
    });

  } catch (error) {
    return ErrorHandler.handleError(error, `/api/connectors/${connectorId}/actions`);
  }
}

/**
 * OPTIONS /api/connectors/[id]/actions - Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}