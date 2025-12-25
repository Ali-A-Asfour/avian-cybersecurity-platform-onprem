import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { createCustomBrandingService } from '@/services/reports/CustomBrandingService';
import { UserRole } from '@/types';

/**
 * GET /api/reports/branding/templates - Get available branding templates
 * 
 * Requirements: 6.1, 6.2, 6.3, professional standards
 * 
 * Access Control: Super Admin and Security Analyst roles only
 * 
 * Response: Array of BrandingTemplate objects
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
                        message: 'Access restricted. Branding templates are available to authorized personnel only.',
                    },
                },
                { status: 403 }
            );
        }

        // Get branding templates
        const brandingService = createCustomBrandingService();
        const templates = brandingService.getBrandingTemplates();

        // Return successful response
        return NextResponse.json({
            success: true,
            data: templates,
            meta: {
                count: templates.length,
                retrievedAt: new Date().toISOString(),
                retrievedBy: user.user_id,
            },
        });

    } catch (error) {
        console.error('Error in GET /api/reports/branding/templates:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to retrieve branding templates',
                },
            },
            { status: 500 }
        );
    }
}