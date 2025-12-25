import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { edrPostureScores } from '../../../../../../database/schemas/edr';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

/**
 * GET /api/edr/posture/history - Get historical posture scores for tenant
 * 
 * Requirements: 17.4
 * - Return historical posture scores for trend graphs
 * - Support date range filtering (startDate, endDate)
 * - Enforce tenant isolation
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
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        // Validate date parameters
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (startDateParam) {
            startDate = new Date(startDateParam);
            if (isNaN(startDate.getTime())) {
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

        if (endDateParam) {
            endDate = new Date(endDateParam);
            if (isNaN(endDate.getTime())) {
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

        // Build query conditions
        const conditions = [eq(edrPostureScores.tenantId, user.tenant_id)];

        // Add date range filters
        if (startDate) {
            conditions.push(gte(edrPostureScores.calculatedAt, startDate));
        }

        if (endDate) {
            conditions.push(lte(edrPostureScores.calculatedAt, endDate));
        }

        // Execute query
        const scores = await db
            .select()
            .from(edrPostureScores)
            .where(and(...conditions))
            .orderBy(desc(edrPostureScores.calculatedAt));

        // Format response
        const scoresResponse = scores.map((score) => ({
            id: score.id,
            score: score.score,
            deviceCount: score.deviceCount || 0,
            highRiskDeviceCount: score.highRiskDeviceCount || 0,
            activeAlertCount: score.activeAlertCount || 0,
            criticalVulnerabilityCount: score.criticalVulnerabilityCount || 0,
            nonCompliantDeviceCount: score.nonCompliantDeviceCount || 0,
            calculatedAt: score.calculatedAt,
        }));

        return NextResponse.json({
            success: true,
            data: scoresResponse,
            meta: {
                total: scoresResponse.length,
                startDate: startDate?.toISOString() || null,
                endDate: endDate?.toISOString() || null,
            },
        });
    } catch (error) {
        console.error('Error in GET /api/edr/posture/history:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve posture score history',
                },
            },
            { status: 500 }
        );
    }
}
