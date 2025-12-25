import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { AlertManager, AlertFilters, AlertSeverity } from '@/lib/alert-manager';

/**
 * GET /api/firewall/alerts - List alerts with filtering
 * 
 * Requirements: 15.7 - Alert Management API
 * - List alerts filtered by tenant
 * - Support filtering by device_id, severity, acknowledged status
 * - Support date range filtering
 * - Support pagination (limit, offset)
 * - Enforce tenant isolation
 * - Sort by timestamp descending (newest first)
 * 
 * Query Parameters:
 * - deviceId: Filter by device ID (optional)
 * - severity: Filter by severity (critical, high, medium, low, info) - can be comma-separated (optional)
 * - acknowledged: Filter by acknowledged status (true/false) (optional)
 * - startDate: Filter by start date (ISO 8601 format) (optional)
 * - endDate: Filter by end date (ISO 8601 format) (optional)
 * - limit: Number of results to return (default: 50, max: 100) (optional)
 * - offset: Number of results to skip (default: 0) (optional)
 */
export async function GET(request: NextRequest) {
    try {
        // Apply authentication middleware
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
        const severityParam = searchParams.get('severity');
        const acknowledgedParam = searchParams.get('acknowledged');
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');
        const limitParam = searchParams.get('limit') || '50';
        const offsetParam = searchParams.get('offset') || '0';

        // Validate pagination parameters
        const limit = parseInt(limitParam);
        const offset = parseInt(offsetParam);

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

        if (isNaN(offset) || offset < 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Offset must be a non-negative number',
                    },
                },
                { status: 400 }
            );
        }

        // Parse severity parameter (can be comma-separated)
        let severity: AlertSeverity | AlertSeverity[] | undefined;
        if (severityParam) {
            const severities = severityParam.split(',').map(s => s.trim());
            const validSeverities: AlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

            // Validate all severities
            for (const sev of severities) {
                if (!validSeverities.includes(sev as AlertSeverity)) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: {
                                code: 'VALIDATION_ERROR',
                                message: `Invalid severity: ${sev}. Must be one of: critical, high, medium, low, info`,
                            },
                        },
                        { status: 400 }
                    );
                }
            }

            // If single severity, use string; if multiple, use array
            severity = severities.length === 1
                ? severities[0] as AlertSeverity
                : severities as AlertSeverity[];
        }

        // Parse acknowledged parameter
        let acknowledged: boolean | undefined;
        if (acknowledgedParam !== null) {
            if (acknowledgedParam === 'true') {
                acknowledged = true;
            } else if (acknowledgedParam === 'false') {
                acknowledged = false;
            } else {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Acknowledged parameter must be "true" or "false"',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Parse date parameters
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        if (startDateParam) {
            startDate = new Date(startDateParam);
            if (isNaN(startDate.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid startDate format. Must be ISO 8601 format (e.g., 2024-01-01T00:00:00Z)',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        if (endDateParam) {
            endDate = new Date(endDateParam);
            if (isNaN(endDate.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid endDate format. Must be ISO 8601 format (e.g., 2024-01-01T23:59:59Z)',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Validate date range
        if (startDate && endDate && startDate > endDate) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'startDate must be before or equal to endDate',
                    },
                },
                { status: 400 }
            );
        }

        // Build filters
        const filters: AlertFilters = {
            tenantId: user.tenant_id,
            limit,
            offset,
        };

        if (deviceId) {
            filters.deviceId = deviceId;
        }

        if (severity) {
            filters.severity = severity;
        }

        if (acknowledged !== undefined) {
            filters.acknowledged = acknowledged;
        }

        if (startDate) {
            filters.startDate = startDate;
        }

        if (endDate) {
            filters.endDate = endDate;
        }

        // Get alerts using AlertManager
        const alerts = await AlertManager.getAlerts(filters);

        // Return alerts with metadata
        return NextResponse.json({
            success: true,
            data: alerts,
            meta: {
                total: alerts.length,
                limit,
                offset,
                filters: {
                    deviceId: deviceId || null,
                    severity: severity || null,
                    acknowledged: acknowledged !== undefined ? acknowledged : null,
                    startDate: startDateParam || null,
                    endDate: endDateParam || null,
                },
            },
        });
    } catch (error) {
        console.error('Error in GET /api/firewall/alerts:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve alerts',
                },
            },
            { status: 500 }
        );
    }
}
