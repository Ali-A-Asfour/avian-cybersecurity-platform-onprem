import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { db } from '@/lib/database';
import { firewallDevices } from '@/../database/schemas/firewall';
import { eq, and } from 'drizzle-orm';
import { ConfigParser, RiskEngine } from '@/lib/firewall-config-parser';
import { replaceDeviceRisks, countRisksBySeverity } from '@/lib/firewall-risk-storage';
import { UserRole } from '@/types';

/**
 * POST /api/firewall/config/upload - Upload and analyze firewall configuration
 * 
 * Requirements: 15.4 - Configuration API
 * - Upload config file
 * - Parse config file using ConfigParser
 * - Run risk detection using RiskEngine
 * - Store risks in database
 * - Return risk summary
 * 
 * Request body:
 * - deviceId: string (UUID of firewall device)
 * - configText: string (raw configuration file content)
 * - snapshotId: string (optional UUID for config snapshot tracking)
 */
export async function POST(request: NextRequest) {
    try {
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

        // Only Super Admins and Tenant Admins can upload configs
        if (!['super_admin', 'tenant_admin'].includes(user.role)) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'INSUFFICIENT_PERMISSIONS',
                        message: 'Only administrators can upload firewall configurations',
                    },
                },
                { status: 403 }
            );
        }

        // Parse request body
        let body: {
            deviceId: string;
            configText: string;
            snapshotId?: string;
        };
        try {
            body = await request.json();
        } catch (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid JSON in request body',
                    },
                },
                { status: 400 }
            );
        }

        // Validate required fields
        if (!body.deviceId || typeof body.deviceId !== 'string' || body.deviceId.trim() === '') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Device ID is required and must be a non-empty string',
                    },
                },
                { status: 400 }
            );
        }

        if (!body.configText || typeof body.configText !== 'string' || body.configText.trim() === '') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Configuration text is required and must be a non-empty string',
                    },
                },
                { status: 400 }
            );
        }

        // Validate optional snapshotId if provided
        if (body.snapshotId !== undefined && body.snapshotId !== null) {
            if (typeof body.snapshotId !== 'string' || body.snapshotId.trim() === '') {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Snapshot ID must be a non-empty string if provided',
                        },
                    },
                    { status: 400 }
                );
            }
        }

        // Trim whitespace
        body.deviceId = body.deviceId.trim();
        body.configText = body.configText.trim();
        if (body.snapshotId) {
            body.snapshotId = body.snapshotId.trim();
        }

        // Verify device exists and belongs to user's tenant
        const device = await db
            .select()
            .from(firewallDevices)
            .where(eq(firewallDevices.id, body.deviceId))
            .limit(1);

        if (device.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Firewall device not found',
                    },
                },
                { status: 404 }
            );
        }

        // Enforce tenant isolation (unless super admin)
        if (user.role !== UserRole.SUPER_ADMIN && device[0].tenantId !== user.tenant_id) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Cannot access device from another tenant',
                    },
                },
                { status: 403 }
            );
        }

        // Parse configuration file
        const parser = new ConfigParser();
        let parsedConfig;
        try {
            parsedConfig = parser.parseConfig(body.configText);
        } catch (error) {
            console.error('Failed to parse configuration:', error);
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'PARSE_ERROR',
                        message: 'Failed to parse configuration file. Please ensure the file is in valid SonicWall .exp format',
                        details: error instanceof Error ? error.message : 'Unknown error',
                    },
                },
                { status: 400 }
            );
        }

        // Run risk detection
        const riskEngine = new RiskEngine();
        let detectedRisks;
        try {
            detectedRisks = riskEngine.analyzeConfig(parsedConfig);
        } catch (error) {
            console.error('Failed to analyze configuration:', error);
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'ANALYSIS_ERROR',
                        message: 'Failed to analyze configuration for risks',
                        details: error instanceof Error ? error.message : 'Unknown error',
                    },
                },
                { status: 500 }
            );
        }

        // Calculate risk score
        const riskScore = riskEngine.calculateRiskScore(detectedRisks);

        // Store risks in database (replace old risks)
        let storedRisks;
        try {
            const result = await replaceDeviceRisks(
                body.deviceId,
                detectedRisks,
                body.snapshotId || null
            );
            storedRisks = result.createdRisks;
        } catch (error) {
            console.error('Failed to store risks:', error);
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'STORAGE_ERROR',
                        message: 'Failed to store configuration risks',
                        details: error instanceof Error ? error.message : 'Unknown error',
                    },
                },
                { status: 500 }
            );
        }

        // Get risk counts by severity
        const riskCounts = await countRisksBySeverity(body.deviceId);

        // Return risk summary
        return NextResponse.json(
            {
                success: true,
                data: {
                    deviceId: body.deviceId,
                    snapshotId: body.snapshotId || null,
                    riskScore,
                    riskCounts,
                    risks: storedRisks.map(risk => ({
                        riskId: risk.id,
                        riskCategory: risk.riskCategory,
                        riskType: risk.riskType,
                        severity: risk.severity,
                        description: risk.description,
                        remediation: risk.remediation,
                        detectedAt: risk.detectedAt,
                    })),
                    parsedConfig: {
                        rulesCount: parsedConfig.rules.length,
                        natPoliciesCount: parsedConfig.natPolicies.length,
                        addressObjectsCount: parsedConfig.addressObjects.length,
                        serviceObjectsCount: parsedConfig.serviceObjects.length,
                        vpnConfigsCount: parsedConfig.vpnConfigs.length,
                        interfacesCount: parsedConfig.interfaces.length,
                        securitySettings: parsedConfig.securitySettings,
                        adminSettings: {
                            adminUsernames: parsedConfig.adminSettings.adminUsernames,
                            mfaEnabled: parsedConfig.adminSettings.mfaEnabled,
                            wanManagementEnabled: parsedConfig.adminSettings.wanManagementEnabled,
                            httpsAdminPort: parsedConfig.adminSettings.httpsAdminPort,
                            sshEnabled: parsedConfig.adminSettings.sshEnabled,
                        },
                        systemSettings: parsedConfig.systemSettings,
                    },
                },
                message: 'Configuration uploaded and analyzed successfully',
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error in POST /api/firewall/config/upload:', error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to process configuration upload',
                },
            },
            { status: 500 }
        );
    }
}
