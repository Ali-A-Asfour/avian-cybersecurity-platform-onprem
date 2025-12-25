import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { edrActions, edrDevices } from '../../../../../database/schemas/edr';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { MicrosoftGraphClient } from '@/lib/microsoft-graph-client';
import { logRemoteAction, getDeviceById } from '@/lib/edr-database-operations';
import type { MicrosoftGraphCredentials } from '@/types/edr';

/**
 * POST /api/edr/actions - Execute a remote action on a device
 * 
 * Requirements: 5.1, 5.2, 5.3, 9.4, 10.1
 * - Validate user has permission for target device's tenant
 * - Reject cross-tenant action attempts with 403
 * - Call Graph API client to execute remote action
 * - Log action in actions table with user attribution
 * - Return action record with status
 */
export async function POST(request: NextRequest) {
    try {
        // Apply authentication middleware FIRST (before any other checks)
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

        // Check database connection
        if (!db) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'DATABASE_ERROR',
                        message: 'Database connection not available',
                    },
                },
                { status: 503 }
            );
        }

        const { user } = authResult;

        // Apply tenant middleware
        const tenantResult = await tenantMiddleware(request, user);
        if (!tenantResult.success || !tenantResult.tenant) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'TENANT_ERROR',
                        message: tenantResult.error?.message || 'Tenant validation failed',
                    },
                },
                { status: 403 }
            );
        }

        // Parse request body
        let body: { deviceId?: string; actionType?: string };
        try {
            body = await request.json();
        } catch (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid JSON in request body',
                    },
                },
                { status: 400 }
            );
        }

        const { deviceId, actionType } = body;

        // Validate required fields
        if (!deviceId || typeof deviceId !== 'string') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Device ID is required and must be a string',
                    },
                },
                { status: 400 }
            );
        }

        if (!actionType || typeof actionType !== 'string') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Action type is required and must be a string',
                    },
                },
                { status: 400 }
            );
        }

        // Validate deviceId is a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(deviceId)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Device ID must be a valid UUID',
                    },
                },
                { status: 400 }
            );
        }

        // Validate actionType
        const validActionTypes = ['isolate', 'unisolate', 'scan', 'resolve_alert'];
        if (!validActionTypes.includes(actionType.toLowerCase())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Action type must be one of: ${validActionTypes.join(', ')}`,
                    },
                },
                { status: 400 }
            );
        }

        // Verify device exists and belongs to user's tenant (Requirement 5.1, 9.4)
        const device = await getDeviceById(deviceId, user.tenant_id);
        if (!device) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Device not found or access denied',
                    },
                },
                { status: 403 }
            );
        }

        // Log the action BEFORE executing it (Requirement 5.3, 10.1)
        const actionRecord = await logRemoteAction({
            tenantId: user.tenant_id,
            deviceId: deviceId,
            userId: user.id,
            actionType: actionType.toLowerCase() as 'isolate' | 'unisolate' | 'scan' | 'resolve_alert',
            status: 'pending',
            resultMessage: '',
            initiatedAt: new Date(),
            completedAt: new Date(), // Will be updated when action completes
        });

        // Execute the remote action via Microsoft Graph API (Requirement 5.2)
        try {
            // Get Microsoft credentials from environment or secrets manager
            // For MVP, we'll use environment variables
            const credentials: MicrosoftGraphCredentials = {
                clientId: process.env.MICROSOFT_CLIENT_ID || '',
                clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
                tenantId: process.env.MICROSOFT_TENANT_ID || '',
            };

            if (!credentials.clientId || !credentials.clientSecret || !credentials.tenantId) {
                throw new Error('Microsoft Graph API credentials not configured');
            }

            const graphClient = new MicrosoftGraphClient(credentials);

            // Execute the appropriate action
            let result;
            switch (actionType.toLowerCase()) {
                case 'isolate':
                    result = await graphClient.isolateDevice(
                        credentials.tenantId,
                        device.microsoftDeviceId
                    );
                    break;
                case 'unisolate':
                    result = await graphClient.unisolateDevice(
                        credentials.tenantId,
                        device.microsoftDeviceId
                    );
                    break;
                case 'scan':
                    result = await graphClient.runAntivirusScan(
                        credentials.tenantId,
                        device.microsoftDeviceId
                    );
                    break;
                case 'resolve_alert':
                    // Note: This would require additional implementation in the Graph client
                    throw new Error('Resolve alert action not yet implemented');
                default:
                    throw new Error(`Unknown action type: ${actionType}`);
            }

            // Update action status to completed
            await db
                .update(edrActions)
                .set({
                    status: 'completed',
                    resultMessage: result.message || 'Action completed successfully',
                    completedAt: new Date(),
                })
                .where(eq(edrActions.id, actionRecord.id));

            // Return the action record
            return NextResponse.json({
                success: true,
                data: {
                    id: actionRecord.id,
                    tenantId: user.tenant_id,
                    deviceId: deviceId,
                    userId: user.id,
                    actionType: actionType.toLowerCase(),
                    status: 'completed',
                    resultMessage: result.message || 'Action completed successfully',
                    initiatedAt: new Date(),
                    completedAt: new Date(),
                },
            });
        } catch (error) {
            // Update action status to failed
            await db
                .update(edrActions)
                .set({
                    status: 'failed',
                    resultMessage: error instanceof Error ? error.message : 'Unknown error',
                    completedAt: new Date(),
                })
                .where(eq(edrActions.id, actionRecord.id));

            console.error('Error executing remote action:', error);
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'ACTION_EXECUTION_ERROR',
                        message: error instanceof Error ? error.message : 'Failed to execute remote action',
                    },
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Error in POST /api/edr/actions:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to process remote action request',
                },
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/edr/actions - Get action history
 * 
 * Requirements: 10.3, 10.5
 * - Filter actions by tenant and query parameters
 * - Return action history
 * - Support filtering by deviceId, userId, startDate, endDate
 */
export async function GET(request: NextRequest) {
    try {
        // Apply authentication middleware FIRST (before any other checks)
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

        // Check database connection
        if (!db) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'DATABASE_ERROR',
                        message: 'Database connection not available',
                    },
                },
                { status: 503 }
            );
        }

        const { user } = authResult;

        // Apply tenant middleware
        const tenantResult = await tenantMiddleware(request, user);
        if (!tenantResult.success || !tenantResult.tenant) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'TENANT_ERROR',
                        message: tenantResult.error?.message || 'Tenant validation failed',
                    },
                },
                { status: 403 }
            );
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get('deviceId');
        const userId = searchParams.get('userId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const pageParam = searchParams.get('page') || '1';
        const limitParam = searchParams.get('limit') || '50';

        // Validate pagination parameters
        const page = parseInt(pageParam);
        const limit = parseInt(limitParam);

        if (isNaN(page) || page < 1) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Page must be a positive number',
                    },
                },
                { status: 400 }
            );
        }

        if (isNaN(limit) || limit < 1 || limit > 100) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Limit must be a number between 1 and 100',
                    },
                },
                { status: 400 }
            );
        }

        // Validate deviceId parameter if provided (must be valid UUID)
        if (deviceId) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(deviceId)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Device ID must be a valid UUID',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Validate userId parameter if provided (must be valid UUID)
        if (userId) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(userId)) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'User ID must be a valid UUID',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Validate date parameters if provided
        let startDateTime: Date | null = null;
        let endDateTime: Date | null = null;

        if (startDate) {
            startDateTime = new Date(startDate);
            if (isNaN(startDateTime.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid startDate format. Use ISO 8601 format',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        if (endDate) {
            endDateTime = new Date(endDate);
            if (isNaN(endDateTime.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid endDate format. Use ISO 8601 format',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Validate date range logic
        if (startDateTime && endDateTime && startDateTime > endDateTime) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Start date must be before or equal to end date',
                    },
                },
                { status: 400 }
            );
        }

        // Build query conditions (Requirement 10.3, 10.5)
        const conditions = [eq(edrActions.tenantId, user.tenant_id)];

        // Add device filter
        if (deviceId) {
            conditions.push(eq(edrActions.deviceId, deviceId));
        }

        // Add user filter
        if (userId) {
            conditions.push(eq(edrActions.userId, userId));
        }

        // Add date range filters
        if (startDateTime) {
            conditions.push(gte(edrActions.initiatedAt, startDateTime));
        }

        if (endDateTime) {
            conditions.push(lte(edrActions.initiatedAt, endDateTime));
        }

        // Calculate offset
        const offset = (page - 1) * limit;

        // Execute query with filters and pagination
        const actions = await db
            .select()
            .from(edrActions)
            .where(and(...conditions))
            .orderBy(desc(edrActions.initiatedAt))
            .limit(limit)
            .offset(offset);

        // Get total count for pagination
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(edrActions)
            .where(and(...conditions));

        const total = Number(countResult[0]?.count || 0);

        // Format response
        const actionsResponse = actions.map((action) => ({
            id: action.id,
            tenantId: action.tenantId,
            deviceId: action.deviceId,
            userId: action.userId,
            actionType: action.actionType,
            status: action.status,
            resultMessage: action.resultMessage,
            initiatedAt: action.initiatedAt,
            completedAt: action.completedAt,
            createdAt: action.createdAt,
        }));

        return NextResponse.json({
            success: true,
            data: actionsResponse,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error in GET /api/edr/actions:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve action history',
                },
            },
            { status: 500 }
        );
    }
}
