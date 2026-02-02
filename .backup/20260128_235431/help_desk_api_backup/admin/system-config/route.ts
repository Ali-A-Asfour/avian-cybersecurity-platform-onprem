import { NextRequest, NextResponse } from 'next/server';
import { RoleBasedAccessService } from '@/services/help-desk/RoleBasedAccessService';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';
import { UserRole } from '@/types';
import { ErrorHandler, ApiErrors } from '@/lib/api-errors';
import { z } from 'zod';

// System configuration schema
const systemConfigSchema = z.object({
    defaultSLASettings: z.object({
        criticalHours: z.number().min(1).max(168).default(4),
        highHours: z.number().min(1).max(168).default(24),
        mediumHours: z.number().min(1).max(168).default(72),
        lowHours: z.number().min(1).max(168).default(168),
    }).optional(),
    defaultNotificationSettings: z.object({
        emailEnabled: z.boolean().default(true),
        smsEnabled: z.boolean().default(false),
        pushEnabled: z.boolean().default(true),
        digestFrequency: z.enum(['immediate', 'hourly', 'daily', 'weekly']).default('immediate'),
    }).optional(),
    fileUploadSettings: z.object({
        maxFileSize: z.number().min(1024).max(50 * 1024 * 1024).default(10 * 1024 * 1024), // 10MB default
        allowedFileTypes: z.array(z.string()).default([
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]),
        maxAttachmentsPerTicket: z.number().min(1).max(20).default(5),
    }).optional(),
    queueSettings: z.object({
        autoAssignmentEnabled: z.boolean().default(false),
        maxTicketsPerAnalyst: z.number().min(1).max(100).default(20),
        escalationEnabled: z.boolean().default(true),
        escalationTimeHours: z.number().min(1).max(168).default(24),
    }).optional(),
    knowledgeBaseSettings: z.object({
        autoCreateFromResolutions: z.boolean().default(true),
        requireApprovalForPublic: z.boolean().default(true),
        searchEnabled: z.boolean().default(true),
        maxSearchResults: z.number().min(1).max(100).default(20),
    }).optional(),
});

/**
 * GET /api/help-desk/admin/system-config
 * Get system configuration (super admin only)
 */
export async function GET(request: NextRequest) {
    try {
        // Apply middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            return NextResponse.json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication failed' }
            }, { status: 401 });
        }

        // Validate super admin access
        const accessValidation = RoleBasedAccessService.validateSuperAdminOperation('configure_system', {
            userId: authResult.user!.user_id,
            userRole: authResult.user!.role,
            tenantId: authResult.user!.tenant_id,
        });

        if (!accessValidation.allowed) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: accessValidation.reason || 'Access denied',
                    requiredRole: accessValidation.requiredRole
                }
            }, { status: 403 });
        }

        // In a real implementation, this would fetch from a system configuration store
        // For now, return default configuration
        const systemConfig = {
            defaultSLASettings: {
                criticalHours: 4,
                highHours: 24,
                mediumHours: 72,
                lowHours: 168,
            },
            defaultNotificationSettings: {
                emailEnabled: true,
                smsEnabled: false,
                pushEnabled: true,
                digestFrequency: 'immediate' as const,
            },
            fileUploadSettings: {
                maxFileSize: 10 * 1024 * 1024, // 10MB
                allowedFileTypes: [
                    'image/jpeg',
                    'image/png',
                    'image/gif',
                    'image/webp',
                    'application/pdf',
                    'text/plain',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ],
                maxAttachmentsPerTicket: 5,
            },
            queueSettings: {
                autoAssignmentEnabled: false,
                maxTicketsPerAnalyst: 20,
                escalationEnabled: true,
                escalationTimeHours: 24,
            },
            knowledgeBaseSettings: {
                autoCreateFromResolutions: true,
                requireApprovalForPublic: true,
                searchEnabled: true,
                maxSearchResults: 20,
            },
        };

        return ErrorHandler.success(systemConfig);
    } catch (error) {
        const url = new URL(request.url);
        return ErrorHandler.handleError(error, url.pathname);
    }
}

/**
 * PUT /api/help-desk/admin/system-config
 * Update system configuration (super admin only)
 */
export async function PUT(request: NextRequest) {
    try {
        // Apply middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            return NextResponse.json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication failed' }
            }, { status: 401 });
        }

        // Validate super admin access
        const accessValidation = RoleBasedAccessService.validateSuperAdminOperation('configure_system', {
            userId: authResult.user!.user_id,
            userRole: authResult.user!.role,
            tenantId: authResult.user!.tenant_id,
        });

        if (!accessValidation.allowed) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: accessValidation.reason || 'Access denied',
                    requiredRole: accessValidation.requiredRole
                }
            }, { status: 403 });
        }

        const body = await request.json();

        // Validate configuration data
        try {
            const validatedConfig = systemConfigSchema.parse(body);

            // In a real implementation, this would save to a system configuration store
            // For now, just return the validated configuration
            console.log('System configuration updated by super admin:', authResult.user!.user_id, validatedConfig);

            return ErrorHandler.success({
                message: 'System configuration updated successfully',
                config: validatedConfig,
                updatedBy: authResult.user!.user_id,
                updatedAt: new Date().toISOString(),
            });
        } catch (validationError) {
            if (validationError instanceof z.ZodError) {
                const errors = validationError.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
                throw ApiErrors.validation('Invalid system configuration', { errors });
            }
            throw validationError;
        }
    } catch (error) {
        const url = new URL(request.url);
        return ErrorHandler.handleError(error, url.pathname);
    }
}

/**
 * GET /api/help-desk/admin/system-config/defaults
 * Get default system configuration values (super admin only)
 */
export async function GET_DEFAULTS(request: NextRequest) {
    try {
        // Apply middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            return NextResponse.json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication failed' }
            }, { status: 401 });
        }

        // Validate super admin access
        const accessValidation = RoleBasedAccessService.validateSuperAdminOperation('configure_system', {
            userId: authResult.user!.user_id,
            userRole: authResult.user!.role,
            tenantId: authResult.user!.tenant_id,
        });

        if (!accessValidation.allowed) {
            return NextResponse.json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: accessValidation.reason || 'Access denied',
                    requiredRole: accessValidation.requiredRole
                }
            }, { status: 403 });
        }

        // Return default configuration schema with descriptions
        const defaultConfig = {
            defaultSLASettings: {
                description: 'Default SLA response times by severity level',
                criticalHours: { value: 4, description: 'Response time for critical tickets (hours)' },
                highHours: { value: 24, description: 'Response time for high priority tickets (hours)' },
                mediumHours: { value: 72, description: 'Response time for medium priority tickets (hours)' },
                lowHours: { value: 168, description: 'Response time for low priority tickets (hours)' },
            },
            defaultNotificationSettings: {
                description: 'Default notification preferences for new tenants',
                emailEnabled: { value: true, description: 'Enable email notifications' },
                smsEnabled: { value: false, description: 'Enable SMS notifications' },
                pushEnabled: { value: true, description: 'Enable push notifications' },
                digestFrequency: {
                    value: 'immediate',
                    description: 'Notification digest frequency',
                    options: ['immediate', 'hourly', 'daily', 'weekly']
                },
            },
            fileUploadSettings: {
                description: 'File upload constraints and allowed types',
                maxFileSize: { value: 10 * 1024 * 1024, description: 'Maximum file size in bytes (10MB)' },
                allowedFileTypes: {
                    value: [
                        'image/jpeg',
                        'image/png',
                        'image/gif',
                        'image/webp',
                        'application/pdf',
                        'text/plain',
                        'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    ],
                    description: 'Allowed MIME types for file uploads'
                },
                maxAttachmentsPerTicket: { value: 5, description: 'Maximum attachments per ticket' },
            },
            queueSettings: {
                description: 'Ticket queue management settings',
                autoAssignmentEnabled: { value: false, description: 'Enable automatic ticket assignment' },
                maxTicketsPerAnalyst: { value: 20, description: 'Maximum tickets per analyst' },
                escalationEnabled: { value: true, description: 'Enable automatic escalation' },
                escalationTimeHours: { value: 24, description: 'Hours before escalation' },
            },
            knowledgeBaseSettings: {
                description: 'Knowledge base configuration',
                autoCreateFromResolutions: { value: true, description: 'Auto-create KB articles from resolutions' },
                requireApprovalForPublic: { value: true, description: 'Require approval for public articles' },
                searchEnabled: { value: true, description: 'Enable knowledge base search' },
                maxSearchResults: { value: 20, description: 'Maximum search results to return' },
            },
        };

        return ErrorHandler.success(defaultConfig);
    } catch (error) {
        const url = new URL(request.url);
        return ErrorHandler.handleError(error, url.pathname);
    }
}