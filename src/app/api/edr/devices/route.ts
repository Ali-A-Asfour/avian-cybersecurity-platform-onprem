import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { edrDevices } from '../../../../../database/schemas/edr';
import { eq, and, or, like, gte, desc, sql } from 'drizzle-orm';

/**
 * GET /api/edr/devices - List all EDR devices for tenant
 * 
 * Requirements: 1.4, 8.4, 9.4, 13.2, 13.3
 * - List devices filtered by tenant
 * - Support search (hostname, user)
 * - Support filters (OS, risk level, compliance state, last seen date)
 * - Support pagination
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
        const search = searchParams.get('search');
        const os = searchParams.get('os');
        const riskLevel = searchParams.get('riskLevel');
        const complianceState = searchParams.get('complianceState');
        const lastSeenAfter = searchParams.get('lastSeenAfter');
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

        // Validate risk level parameter if provided
        if (riskLevel && !['low', 'medium', 'high'].includes(riskLevel.toLowerCase())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Risk level must be one of: low, medium, high',
                    },
                },
                { status: 400 }
            );
        }

        // Validate compliance state parameter if provided
        if (complianceState && !['compliant', 'noncompliant', 'unknown'].includes(complianceState.toLowerCase())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Compliance state must be one of: compliant, noncompliant, unknown',
                    },
                },
                { status: 400 }
            );
        }

        // Validate lastSeenAfter date if provided
        let lastSeenDate: Date | null = null;
        if (lastSeenAfter) {
            lastSeenDate = new Date(lastSeenAfter);
            if (isNaN(lastSeenDate.getTime())) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid lastSeenAfter date format. Use ISO 8601 format',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Build query conditions
        const conditions = [eq(edrDevices.tenantId, user.tenant_id)];

        // Add search condition (hostname or user)
        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            conditions.push(
                or(
                    like(edrDevices.deviceName, searchTerm),
                    like(edrDevices.primaryUser, searchTerm)
                )!
            );
        }

        // Add OS filter
        if (os && os.trim() !== '') {
            conditions.push(like(edrDevices.operatingSystem, `%${os.trim()}%`));
        }

        // Add risk level filter
        if (riskLevel) {
            const riskLevelLower = riskLevel.toLowerCase();
            if (riskLevelLower === 'low') {
                conditions.push(sql`${edrDevices.riskScore} < 40`);
            } else if (riskLevelLower === 'medium') {
                conditions.push(sql`${edrDevices.riskScore} >= 40 AND ${edrDevices.riskScore} < 70`);
            } else if (riskLevelLower === 'high') {
                conditions.push(sql`${edrDevices.riskScore} >= 70`);
            }
        }

        // Add compliance state filter
        if (complianceState) {
            conditions.push(eq(edrDevices.intuneComplianceState, complianceState.toLowerCase()));
        }

        // Add last seen date filter
        if (lastSeenDate) {
            conditions.push(gte(edrDevices.lastSeenAt, lastSeenDate));
        }

        // Calculate offset
        const offset = (page - 1) * limit;

        // Execute query with filters and pagination
        const devices = await db
            .select()
            .from(edrDevices)
            .where(and(...conditions))
            .orderBy(desc(edrDevices.lastSeenAt))
            .limit(limit)
            .offset(offset);

        // Get total count for pagination
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(edrDevices)
            .where(and(...conditions));

        const total = Number(countResult[0]?.count || 0);

        // Format response
        const devicesResponse = devices.map((device) => ({
            id: device.id,
            tenantId: device.tenantId,
            microsoftDeviceId: device.microsoftDeviceId,
            deviceName: device.deviceName,
            operatingSystem: device.operatingSystem,
            osVersion: device.osVersion,
            primaryUser: device.primaryUser,
            defenderHealthStatus: device.defenderHealthStatus,
            riskScore: device.riskScore,
            exposureLevel: device.exposureLevel,
            intuneComplianceState: device.intuneComplianceState,
            intuneEnrollmentStatus: device.intuneEnrollmentStatus,
            lastSeenAt: device.lastSeenAt,
            createdAt: device.createdAt,
            updatedAt: device.updatedAt,
        }));

        return NextResponse.json({
            success: true,
            data: devicesResponse,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error in GET /api/edr/devices:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve EDR devices',
                },
            },
            { status: 500 }
        );
    }
}
