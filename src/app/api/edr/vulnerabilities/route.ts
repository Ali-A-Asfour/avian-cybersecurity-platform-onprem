import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import {
    edrVulnerabilities,
    edrDeviceVulnerabilities,
} from '../../../../../database/schemas/edr';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * GET /api/edr/vulnerabilities - List all EDR vulnerabilities for tenant
 * 
 * Requirements: 3.4, 9.4, 15.2, 15.4
 * - List vulnerabilities filtered by tenant
 * - Support filters (severity, exploitability)
 * - Include affected device count in response
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
        const severity = searchParams.get('severity');
        const exploitability = searchParams.get('exploitability');
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

        // Validate severity parameter if provided
        const validSeverities = ['low', 'medium', 'high', 'critical'];
        if (severity && !validSeverities.includes(severity.toLowerCase())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Severity must be one of: ${validSeverities.join(', ')}`,
                    },
                },
                { status: 400 }
            );
        }

        // Validate exploitability parameter if provided
        const validExploitability = ['unproven', 'proof_of_concept', 'functional', 'high'];
        if (exploitability && !validExploitability.includes(exploitability.toLowerCase())) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: `Exploitability must be one of: ${validExploitability.join(', ')}`,
                    },
                },
                { status: 400 }
            );
        }

        // Build query conditions
        const conditions = [eq(edrVulnerabilities.tenantId, user.tenant_id)];

        // Add severity filter
        if (severity) {
            conditions.push(eq(edrVulnerabilities.severity, severity.toLowerCase()));
        }

        // Add exploitability filter
        if (exploitability) {
            conditions.push(
                eq(edrVulnerabilities.exploitability, exploitability.toLowerCase())
            );
        }

        // Calculate offset
        const offset = (page - 1) * limit;

        // Execute query with filters and pagination
        const vulnerabilities = await db
            .select()
            .from(edrVulnerabilities)
            .where(and(...conditions))
            .orderBy(desc(edrVulnerabilities.cvssScore))
            .limit(limit)
            .offset(offset);

        // Get total count for pagination
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(edrVulnerabilities)
            .where(and(...conditions));

        const total = Number(countResult[0]?.count || 0);

        // Get affected device counts for each vulnerability
        const vulnerabilityIds = vulnerabilities.map((v) => v.id);

        let deviceCounts: Record<string, number> = {};
        if (vulnerabilityIds.length > 0) {
            const countQuery = await db
                .select({
                    vulnerabilityId: edrDeviceVulnerabilities.vulnerabilityId,
                    count: sql<number>`count(*)`,
                })
                .from(edrDeviceVulnerabilities)
                .where(sql`${edrDeviceVulnerabilities.vulnerabilityId} = ANY(${vulnerabilityIds})`)
                .groupBy(edrDeviceVulnerabilities.vulnerabilityId);

            deviceCounts = countQuery.reduce(
                (acc, row) => {
                    acc[row.vulnerabilityId] = Number(row.count);
                    return acc;
                },
                {} as Record<string, number>
            );
        }

        // Format response with affected device counts
        const vulnerabilitiesResponse = vulnerabilities.map((vuln) => ({
            id: vuln.id,
            tenantId: vuln.tenantId,
            cveId: vuln.cveId,
            severity: vuln.severity,
            cvssScore: vuln.cvssScore ? parseFloat(vuln.cvssScore) : null,
            exploitability: vuln.exploitability,
            description: vuln.description,
            affectedDeviceCount: deviceCounts[vuln.id] || 0,
            createdAt: vuln.createdAt,
            updatedAt: vuln.updatedAt,
        }));

        return NextResponse.json({
            success: true,
            data: vulnerabilitiesResponse,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error in GET /api/edr/vulnerabilities:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve EDR vulnerabilities',
                },
            },
            { status: 500 }
        );
    }
}
