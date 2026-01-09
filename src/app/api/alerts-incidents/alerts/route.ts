/**
 * API endpoints for Alert operations in Alerts & Security Incidents Module
 * 
 * Provides:
 * - GET /api/alerts-incidents/alerts - List alerts with tenant-scoped filtering (All Alerts and My Alerts)
 * - POST /api/alerts-incidents/alerts - Create new alert (for testing/manual creation)
 * 
 * Requirements: 1.1, 2.1, 4.2, 6.1, 6.2, 6.4, 6.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AlertManager } from '@/services/alerts-incidents/AlertManager';
import {
    AlertFilters,
    AlertStatus,
    AlertSeverity,
    AlertSourceSystem,
    CreateSecurityAlertInput,
    NormalizedAlert
} from '@/types/alerts-incidents';
import { logger } from '@/lib/logger';

/**
 * GET /api/alerts-incidents/alerts
 * List alerts with tenant-scoped filtering (All Alerts and My Alerts)
 * Requirements: 1.1
 */
export async function GET(request: NextRequest) {
    try {
        // In development mode with bypass auth, return mock data
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            const { searchParams } = new URL(request.url);
            const limit = parseInt(searchParams.get('limit') || '50');
            
            // Return empty alerts for now to avoid 500 errors
            return NextResponse.json({
                success: true,
                data: {
                    alerts: [],
                    pagination: {
                        page: 1,
                        limit,
                        total: 0,
                    },
                    metadata: {
                        unassignedCount: 0,
                        assignedCount: 0,
                        queue: 'all',
                    },
                },
            });
        }

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
        const queue = searchParams.get('queue'); // 'all' for All Alerts, 'my' for My Alerts
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        // Parse filter parameters
        const statusParam = searchParams.getAll('status');
        const severityParam = searchParams.getAll('severity');
        const classificationParam = searchParams.get('classification');
        const sourceSystemParam = searchParams.get('sourceSystem');
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        // Build filters
        const filters: AlertFilters = {
            tenantId: tenantResult.tenant!.id,
            limit,
            offset,
        };

        // Apply queue-specific filters
        if (queue === 'all') {
            // All Alerts tab - only unassigned alerts (Requirements: 1.1)
            filters.status = 'open';
        } else if (queue === 'my') {
            // My Alerts tab - only alerts assigned to current user (Requirements: 3.1)
            filters.assignedTo = authResult.user!.user_id;
            filters.status = ['assigned', 'investigating'];
        }

        // Apply additional filters if provided
        if (statusParam.length > 0) {
            const validStatuses = statusParam.filter(s =>
                ['open', 'assigned', 'investigating', 'escalated', 'closed_benign', 'closed_false_positive'].includes(s)
            ) as AlertStatus[];
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

        if (classificationParam) {
            filters.classification = classificationParam;
        }

        if (sourceSystemParam && ['edr', 'firewall', 'email'].includes(sourceSystemParam)) {
            filters.sourceSystem = sourceSystemParam as AlertSourceSystem;
        }

        if (startDateParam) {
            filters.startDate = new Date(startDateParam);
        }

        if (endDateParam) {
            filters.endDate = new Date(endDateParam);
        }

        // Get alerts from AlertManager
        const alerts = await AlertManager.getAlerts(filters);

        // Get queue-specific counts for response metadata
        let unassignedCount = 0;
        let assignedCount = 0;

        if (queue === 'all' || !queue) {
            const triageQueue = await AlertManager.getTriageQueue(tenantResult.tenant!.id, 1, 0);
            unassignedCount = triageQueue.length;
        }

        if (queue === 'my' || !queue) {
            const investigationQueue = await AlertManager.getInvestigationQueue(
                tenantResult.tenant!.id,
                authResult.user!.user_id,
                1,
                0
            );
            assignedCount = investigationQueue.length;
        }

        logger.info('Alerts retrieved', {
            tenantId: tenantResult.tenant!.id,
            userId: authResult.user!.user_id,
            queue,
            alertCount: alerts.length,
            filters,
        });

        return NextResponse.json({
            success: true,
            data: {
                alerts,
                pagination: {
                    page,
                    limit,
                    total: alerts.length,
                },
                metadata: {
                    unassignedCount,
                    assignedCount,
                    queue: queue || 'all',
                },
            },
        });

    } catch (error) {
        logger.error('Error in GET /api/alerts-incidents/alerts', error instanceof Error ? error : new Error(String(error)));

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
 * POST /api/alerts-incidents/alerts
 * Create new alert (for testing/manual creation)
 * Requirements: 12.1, 12.2
 */
export async function POST(request: NextRequest) {
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

        const body = await request.json();

        // Validate required fields
        const {
            sourceSystem,
            sourceId,
            alertType,
            classification,
            severity,
            title,
            description,
            metadata,
            detectedAt
        } = body;

        if (!sourceSystem || !sourceId || !alertType || !classification || !severity || !title) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Missing required fields: sourceSystem, sourceId, alertType, classification, severity, title',
                    },
                },
                { status: 400 }
            );
        }

        // Validate enum values
        if (!['edr', 'firewall', 'email'].includes(sourceSystem)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid sourceSystem. Must be one of: edr, firewall, email',
                    },
                },
                { status: 400 }
            );
        }

        if (!['critical', 'high', 'medium', 'low'].includes(severity)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid severity. Must be one of: critical, high, medium, low',
                    },
                },
                { status: 400 }
            );
        }

        // Create normalized alert
        const normalizedAlert: NormalizedAlert = {
            sourceSystem: sourceSystem as AlertSourceSystem,
            sourceId,
            alertType,
            classification,
            severity: severity as AlertSeverity,
            title,
            description: description || '',
            metadata: metadata || {},
            detectedAt: detectedAt ? new Date(detectedAt) : new Date(),
        };

        // Create alert using AlertManager
        const alertId = await AlertManager.createAlert(tenantResult.tenant!.id, normalizedAlert);

        if (!alertId) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'CREATION_FAILED',
                        message: 'Failed to create alert',
                    },
                },
                { status: 500 }
            );
        }

        logger.info('Alert created', {
            alertId,
            tenantId: tenantResult.tenant!.id,
            userId: authResult.user!.user_id,
            sourceSystem,
            severity,
            classification,
        });

        return NextResponse.json(
            {
                success: true,
                data: {
                    alertId,
                    message: 'Alert created successfully',
                },
            },
            { status: 201 }
        );

    } catch (error) {
        logger.error('Error in POST /api/alerts-incidents/alerts', error instanceof Error ? error : new Error(String(error)));

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