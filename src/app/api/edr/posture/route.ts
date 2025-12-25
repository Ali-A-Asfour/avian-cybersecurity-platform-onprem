import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { edrPostureScores } from '../../../../../database/schemas/edr';
import { eq, desc } from 'drizzle-orm';
import { calculatePostureScore } from '@/lib/edr-posture-calculator';

/**
 * GET /api/edr/posture - Get current posture score for tenant
 * 
 * Requirements: 6.3, 9.4, 17.2, 17.3, 17.4
 * - Retrieve most recent posture score
 * - Calculate trend (up/down/stable) by comparing to previous score
 * - Return score, trend, and contributing factors
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

        // Get the two most recent posture scores for trend calculation
        const recentScores = await db
            .select()
            .from(edrPostureScores)
            .where(eq(edrPostureScores.tenantId, user.tenant_id))
            .orderBy(desc(edrPostureScores.calculatedAt))
            .limit(2);

        // If no scores exist, return insufficient data message
        if (recentScores.length === 0) {
            return NextResponse.json({
                success: true,
                data: null,
                message: 'Insufficient data for posture score calculation',
            });
        }

        const currentScore = recentScores[0];

        // Calculate trend by comparing to previous score
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (recentScores.length >= 2) {
            const previousScore = recentScores[1];
            if (currentScore.score > previousScore.score) {
                trend = 'up';
            } else if (currentScore.score < previousScore.score) {
                trend = 'down';
            }
        }

        // Calculate contributing factors using the posture calculator
        // This gives us the detailed breakdown
        const calculation = await calculatePostureScore(user.tenant_id);

        // Format response
        const response = {
            score: currentScore.score,
            trend,
            factors: calculation.factors,
            deviceCount: currentScore.deviceCount || 0,
            highRiskDeviceCount: currentScore.highRiskDeviceCount || 0,
            activeAlertCount: currentScore.activeAlertCount || 0,
            criticalVulnerabilityCount: currentScore.criticalVulnerabilityCount || 0,
            nonCompliantDeviceCount: currentScore.nonCompliantDeviceCount || 0,
            calculatedAt: currentScore.calculatedAt,
        };

        return NextResponse.json({
            success: true,
            data: response,
        });
    } catch (error) {
        console.error('Error in GET /api/edr/posture:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve posture score',
                },
            },
            { status: 500 }
        );
    }
}
