/**
 * API endpoints for Incident operations in Alerts & Security Incidents Module
 * 
 * Provides:
 * - GET /api/alerts-incidents/incidents - List incidents with tenant-scoped filtering (My Incidents and All Incidents)
 * 
 * Requirements: 7.1, 8.1, 8.2, 8.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { validateNoDirectIncidentCreation } from '@/middleware/incident-workflow.middleware';
import { IncidentManager } from '@/services/alerts-incidents/IncidentManager';
import {
    IncidentFilters,
    IncidentStatus,
    AlertSeverity,
} from '@/types/alerts-incidents';
import { logger } from '@/lib/logger';

/**
 * GET /api/alerts-incidents/incidents
 * List incidents with tenant-scoped filtering (My Incidents and All Incidents)
 * Requirements: 7.1, 8.1, 8.2, 8.4
 */
export async function GET(request: NextRequest) {
    try {
        // Apply authentication middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: authResult.error || 'Authentication required'
                    }
                },
                { status: 401 }
            );
        }

        // Apply tenant middleware
        const tenantResult = await tenantMiddleware(request, authResult.user!);
        if (!tenantResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: tenantResult.error || { code: 'TENANT_ERROR', message: 'Tenant validation failed' }
                },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);

        // Parse query parameters
        const queue = searchParams.get('queue'); // 'my' for My Incidents, 'all' for All Incidents
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        // Parse filter parameters
        const statusParam = searchParams.getAll('status');
        const severityParam = searchParams.getAll('severity');
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        // Build filters
        const filters: IncidentFilters = {
            tenantId: tenantResult.tenant!.id,
            limit,
            offset,
        };

        // Apply queue-specific filters
        if (queue === 'my') {
            // My Incidents tab - only incidents owned by current user (Requirements: 7.1)
            filters.ownerId = authResult.user!.user_id;
        } else if (queue === 'all') {
            // All Incidents tab - all incidents with read-only access (Requirements: 8.1, 8.2, 8.4)
            // No ownerId filter - shows all incidents in tenant
        }

        // Apply additional filters if provided
        if (statusParam.length > 0) {
            const validStatuses = statusParam.filter(s =>
                ['open', 'in_progress', 'resolved', 'dismissed'].includes(s)
            ) as IncidentStatus[];
            if (validStatuses.length > 0) {
                filters.status = validStatuses;
            }
        }

        if (severityParam.length > 0) {
            const validSeverities = severityParam.filter(s =>
                ['critical', 'high', 'medium', 'low'].includes(s)
            ) as AlertSeverity[];
            if (validSeverities.length > 0) {
                filters.severity = validSeverities;
            }
        }

        if (startDateParam) {
            filters.startDate = new Date(startDateParam);
        }

        if (endDateParam) {
            filters.endDate = new Date(endDateParam);
        }

        // Get incidents from IncidentManager
        let incidents;
        if (queue === 'my') {
            incidents = await IncidentManager.getMyIncidents(
                tenantResult.tenant!.id,
                authResult.user!.user_id,
                limit,
                offset
            );
        } else {
            incidents = await IncidentManager.getAllIncidents(
                tenantResult.tenant!.id,
                limit,
                offset
            );
        }

        // Get queue summary for response metadata
        const queueSummary = await IncidentManager.getIncidentQueueSummary(
            tenantResult.tenant!.id,
            queue === 'my' ? authResult.user!.user_id : undefined
        );

        logger.info('Incidents retrieved', {
            tenantId: tenantResult.tenant!.id,
            userId: authResult.user!.user_id,
            queue,
            incidentCount: incidents.length,
            filters,
        });

        return NextResponse.json({
            success: true,
            data: {
                incidents,
                pagination: {
                    page,
                    limit,
                    total: queueSummary.total,
                },
                metadata: {
                    total: queueSummary.total,
                    openCount: queueSummary.openCount,
                    inProgressCount: queueSummary.inProgressCount,
                    queue: queue || 'all',
                    readOnly: queue === 'all', // All Incidents view is read-only (Requirements: 8.2, 8.4)
                },
            },
        });

    } catch (error) {
        logger.error('Error in GET /api/alerts-incidents/incidents', error instanceof Error ? error : new Error(String(error)));

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Internal server error',
                },
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/alerts-incidents/incidents
 * BLOCKED: Direct incident creation is not allowed
 * Requirements: 13.1, 13.2, 13.7, 13.9
 */
export async function POST(request: NextRequest) {
    // Apply comprehensive workflow validation to block direct incident creation
    const workflowValidation = await validateNoDirectIncidentCreation(request);

    // Log the blocked attempt with detailed information
    logger.warn('Blocked direct incident creation attempt', {
        url: request.url,
        method: request.method,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
        timestamp: new Date().toISOString(),
        error: workflowValidation.error || 'Direct creation blocked'
    });

    // Always block - this endpoint should never create incidents
    return NextResponse.json(
        {
            success: false,
            error: {
                code: 'DIRECT_INCIDENT_CREATION_BLOCKED',
                message: 'Security Incidents can only be created through alert escalation workflow. Direct incident creation is permanently disabled.',
                details: {
                    workflowStep: 'direct_creation_blocked',
                    nextAction: 'Navigate to My Alerts, investigate an alert, then escalate it to create a Security Incident',
                    allowedEndpoint: '/api/alerts-incidents/alerts/{id}/escalate',
                    documentation: 'See Requirements 13.1, 13.2, 13.7, 13.9 for workflow enforcement details'
                }
            },
        },
        { status: 403 } // Forbidden
    );
}

/**
 * PUT /api/alerts-incidents/incidents
 * BLOCKED: Bulk incident operations are not allowed
 * Requirements: 13.1, 13.2, 13.7, 13.9
 */
export async function PUT(request: NextRequest) {
    logger.warn('Blocked bulk incident operation attempt', {
        url: request.url,
        method: request.method,
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
    });

    return NextResponse.json(
        {
            success: false,
            error: {
                code: 'BULK_INCIDENT_OPERATIONS_BLOCKED',
                message: 'Bulk incident operations are not allowed. Each incident must be managed individually.',
                details: {
                    workflowStep: 'bulk_operations_blocked',
                    nextAction: 'Use individual incident management endpoints for each incident'
                }
            },
        },
        { status: 403 }
    );
}

/**
 * PATCH /api/alerts-incidents/incidents
 * BLOCKED: Bulk incident operations are not allowed
 * Requirements: 13.1, 13.2, 13.7, 13.9
 */
export async function PATCH(request: NextRequest) {
    logger.warn('Blocked bulk incident operation attempt', {
        url: request.url,
        method: request.method,
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
    });

    return NextResponse.json(
        {
            success: false,
            error: {
                code: 'BULK_INCIDENT_OPERATIONS_BLOCKED',
                message: 'Bulk incident operations are not allowed. Each incident must be managed individually.',
                details: {
                    workflowStep: 'bulk_operations_blocked',
                    nextAction: 'Use individual incident management endpoints for each incident'
                }
            },
        },
        { status: 403 }
    );
}