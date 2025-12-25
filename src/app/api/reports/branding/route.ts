import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { createCustomBrandingService } from '@/services/reports/CustomBrandingService';
import { UserRole } from '@/types';

/**
 * GET /api/reports/branding - Get custom branding configuration
 * 
 * Requirements: 6.1, 6.2, 6.3, professional standards
 * 
 * Access Control: Super Admin and Security Analyst roles only
 * 
 * Response: CustomBrandingConfiguration object
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

        // Check role-based access (Super Admin or Security Analyst only)
        if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.SECURITY_ANALYST) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Access restricted. Custom branding is available to authorized personnel only.',
                    },
                },
                { status: 403 }
            );
        }

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

        // Get branding configuration
        const brandingService = createCustomBrandingService();
        const brandingConfig = await brandingService.getBrandingConfiguration(tenantResult.tenant.id);

        // Return successful response
        return NextResponse.json({
            success: true,
            data: brandingConfig,
            meta: {
                tenantId: tenantResult.tenant.id,
                retrievedAt: new Date().toISOString(),
                retrievedBy: user.user_id,
            },
        });

    } catch (error) {
        console.error('Error in GET /api/reports/branding:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve branding configuration',
                },
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/reports/branding - Update custom branding configuration
 * 
 * Requirements: 6.1, 6.2, 6.3, professional standards
 * 
 * Access Control: Super Admin and Security Analyst roles only
 * 
 * Request Body: Partial<CustomBrandingConfiguration>
 * Response: Updated CustomBrandingConfiguration object
 */
export async function PUT(request: NextRequest) {
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

        // Check role-based access (Super Admin or Security Analyst only)
        if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.SECURITY_ANALYST) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Access restricted. Custom branding updates are available to authorized personnel only.',
                    },
                },
                { status: 403 }
            );
        }

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

        // Parse request body
        const updates = await request.json();

        // Validate request body
        if (!updates || typeof updates !== 'object') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request body. Expected branding configuration object.',
                    },
                },
                { status: 400 }
            );
        }

        // Update branding configuration
        const brandingService = createCustomBrandingService();

        // Validate the configuration
        const validation = brandingService.validateBrandingConfiguration(updates);
        if (!validation.isValid) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid branding configuration',
                        details: {
                            errors: validation.errors,
                            warnings: validation.warnings
                        }
                    },
                },
                { status: 400 }
            );
        }

        const updatedConfig = await brandingService.updateBrandingConfiguration(
            tenantResult.tenant.id,
            updates,
            user.user_id
        );

        // Return successful response
        return NextResponse.json({
            success: true,
            data: updatedConfig,
            meta: {
                tenantId: tenantResult.tenant.id,
                updatedAt: new Date().toISOString(),
                updatedBy: user.user_id,
                validation: {
                    warnings: validation.warnings
                }
            },
        });

    } catch (error) {
        console.error('Error in PUT /api/reports/branding:', error);

        // Handle specific branding errors
        if (error instanceof Error) {
            if (error.message.includes('template not found')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: {
                            code: 'TEMPLATE_NOT_FOUND',
                            message: 'Branding template not found',
                        },
                    },
                    { status: 404 }
                );
            }
        }

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to update branding configuration',
                },
            },
            { status: 500 }
        );
    }
}