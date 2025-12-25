import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { edrCompliance } from '../../../../../database/schemas/edr';
import { eq, and, sql } from 'drizzle-orm';

/**
 * GET /api/edr/compliance - List compliance records for tenant
 * 
 * Requirements: 4.4, 9.4, 16.2, 16.3, 16.4
 * - List compliance records filtered by tenant
 * - Support filters (compliance state, device)
 * - Return compliance records with failed rules
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
        const state = searchParams.get('state');
        const deviceId = searchParams.get('deviceId');

        // Validate state parameter if provided
        const validStates = ['compliant', 'noncompliant', 'unknown'];
        if (state && !validStates.includes(state.toLowerCase())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `State must be one of: ${validStates.join(', ')}`,
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

        // Build query conditions
        const conditions = [eq(edrCompliance.tenantId, user.tenant_id)];

        // Add state filter
        if (state) {
            conditions.push(eq(edrCompliance.complianceState, state.toLowerCase()));
        }

        // Add device filter
        if (deviceId) {
            conditions.push(eq(edrCompliance.deviceId, deviceId));
        }

        // Execute query with filters
        const complianceRecords = await db
            .select()
            .from(edrCompliance)
            .where(and(...conditions));

        // Format response
        const complianceResponse = complianceRecords.map((record) => ({
            id: record.id,
            tenantId: record.tenantId,
            deviceId: record.deviceId,
            complianceState: record.complianceState,
            failedRules: record.failedRules,
            securityBaselineStatus: record.securityBaselineStatus,
            requiredAppsStatus: record.requiredAppsStatus,
            checkedAt: record.checkedAt,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        }));

        return NextResponse.json({
            success: true,
            data: complianceResponse,
        });
    } catch (error) {
        console.error('Error in GET /api/edr/compliance:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve compliance records',
                },
            },
            { status: 500 }
        );
    }
}
