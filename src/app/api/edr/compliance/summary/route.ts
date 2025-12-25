import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { edrCompliance } from '../../../../../../database/schemas/edr';
import { eq, and, sql } from 'drizzle-orm';

/**
 * GET /api/edr/compliance/summary - Get compliance summary counts
 * 
 * Requirements: 4.4, 9.4, 16.1
 * - Calculate and return counts of compliant vs non-compliant devices
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

        // Query compliance counts by state
        const complianceCounts = await db
            .select({
                complianceState: edrCompliance.complianceState,
                count: sql<number>`count(*)`,
            })
            .from(edrCompliance)
            .where(eq(edrCompliance.tenantId, user.tenant_id))
            .groupBy(edrCompliance.complianceState);

        // Initialize counts
        let compliant = 0;
        let nonCompliant = 0;
        let unknown = 0;

        // Aggregate counts by state
        complianceCounts.forEach((row) => {
            const count = Number(row.count);
            const state = row.complianceState?.toLowerCase();

            if (state === 'compliant') {
                compliant = count;
            } else if (state === 'noncompliant') {
                nonCompliant = count;
            } else if (state === 'unknown') {
                unknown = count;
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                compliant,
                nonCompliant,
                unknown,
                total: compliant + nonCompliant + unknown,
            },
        });
    } catch (error) {
        console.error('Error in GET /api/edr/compliance/summary:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve compliance summary',
                },
            },
            { status: 500 }
        );
    }
}
