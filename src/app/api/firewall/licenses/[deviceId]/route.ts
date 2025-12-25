import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import {
    firewallDevices,
    firewallLicenses,
} from '../../../../../../database/schemas/firewall';
import { eq, and, desc } from 'drizzle-orm';
import { UserRole } from '@/types';

/**
 * GET /api/firewall/licenses/:deviceId - Get license status
 * 
 * Requirements: 15.6 - Posture and Health API
 * - Retrieve latest license information for a device
 * - Include all license expiry dates and warnings
 * - Calculate days remaining for each license
 * - Enforce tenant isolation
 * - Return 404 if device not found or belongs to different tenant
 * - Return 404 if no license data exists for device
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ deviceId: string }> }
) {
    try {
    // Await params in Next.js 16
    const { deviceId } = await params;
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

        // Validate UUID format
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(deviceId)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INVALID_ID',
                        message: 'Invalid device ID format',
                    },
                },
                { status: 400 }
            );
        }

        // First check if device exists at all
        const deviceCheckResult = await db
            .select()
            .from(firewallDevices)
            .where(eq(firewallDevices.id, deviceId))
            .limit(1);

        if (deviceCheckResult.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Device not found',
                    },
                },
                { status: 404 }
            );
        }

        const device = deviceCheckResult[0];

        // Verify device belongs to user's tenant (unless super admin)
        if (user.role !== UserRole.SUPER_ADMIN && device.tenantId !== user.tenant_id) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Access denied. Device belongs to another tenant',
                    },
                },
                { status: 403 }
            );
        }

        // Get latest license information
        const latestLicenseResult = await db
            .select()
            .from(firewallLicenses)
            .where(eq(firewallLicenses.deviceId, deviceId))
            .orderBy(desc(firewallLicenses.timestamp))
            .limit(1);

        if (latestLicenseResult.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'No license data found for this device',
                    },
                },
                { status: 404 }
            );
        }

        const license = latestLicenseResult[0];

        // Calculate days remaining for each license
        const calculateDaysRemaining = (expiryDate: string | null): number | null => {
            if (!expiryDate) return null;

            const expiry = new Date(expiryDate);
            const now = new Date();
            const diffTime = expiry.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return diffDays;
        };

        // Determine license status based on days remaining
        const getLicenseStatus = (daysRemaining: number | null): 'active' | 'expiring' | 'expired' | null => {
            if (daysRemaining === null) return null;
            if (daysRemaining < 0) return 'expired';
            if (daysRemaining <= 30) return 'expiring';
            return 'active';
        };

        // Format license response with calculated fields
        const licenseResponse = {
            id: license.id,
            deviceId: license.deviceId,
            ipsExpiry: license.ipsExpiry,
            ipsDaysRemaining: calculateDaysRemaining(license.ipsExpiry),
            ipsStatus: getLicenseStatus(calculateDaysRemaining(license.ipsExpiry)),
            gavExpiry: license.gavExpiry,
            gavDaysRemaining: calculateDaysRemaining(license.gavExpiry),
            gavStatus: getLicenseStatus(calculateDaysRemaining(license.gavExpiry)),
            atpExpiry: license.atpExpiry,
            atpDaysRemaining: calculateDaysRemaining(license.atpExpiry),
            atpStatus: getLicenseStatus(calculateDaysRemaining(license.atpExpiry)),
            appControlExpiry: license.appControlExpiry,
            appControlDaysRemaining: calculateDaysRemaining(license.appControlExpiry),
            appControlStatus: getLicenseStatus(calculateDaysRemaining(license.appControlExpiry)),
            contentFilterExpiry: license.contentFilterExpiry,
            contentFilterDaysRemaining: calculateDaysRemaining(license.contentFilterExpiry),
            contentFilterStatus: getLicenseStatus(calculateDaysRemaining(license.contentFilterExpiry)),
            supportExpiry: license.supportExpiry,
            supportDaysRemaining: calculateDaysRemaining(license.supportExpiry),
            supportStatus: getLicenseStatus(calculateDaysRemaining(license.supportExpiry)),
            licenseWarnings: license.licenseWarnings,
            timestamp: license.timestamp,
        };

        return NextResponse.json({
            success: true,
            data: licenseResponse,
        });
    } catch (error) {
        console.error('Error in GET /api/firewall/licenses/:deviceId:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve license information',
                },
            },
            { status: 500 }
        );
    }
}
