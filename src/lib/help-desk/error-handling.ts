/**
 * Help Desk Error Handling and Validation
 * 
 * Comprehensive error handling system for help desk operations including
 * input validation, business rule validation, and graceful error recovery.
 */

import { z } from 'zod';
import { ApiErrors, CustomApiError, ApiErrorCode } from '@/lib/api-errors';
import { TicketStatus, TicketSeverity, TicketPriority, TicketCategory, UserRole } from '@/types';

/**
 * Help Desk specific error codes
 */
export enum HelpDeskErrorCode {
    // Ticket validation errors
    INVALID_TICKET_DATA = 'INVALID_TICKET_DATA',
    TICKET_NOT_FOUND = 'TICKET_NOT_FOUND',
    TICKET_ALREADY_ASSIGNED = 'TICKET_ALREADY_ASSIGNED',
    TICKET_ASSIGNMENT_FAILED = 'TICKET_ASSIGNMENT_FAILED',

    // State transition errors
    INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
    STATE_TRANSITION_NOT_ALLOWED = 'STATE_TRANSITION_NOT_ALLOWED',
    RESOLUTION_REQUIRED = 'RESOLUTION_REQUIRED',

    // File upload errors
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
    FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
    ATTACHMENT_LIMIT_EXCEEDED = 'ATTACHMENT_LIMIT_EXCEEDED',

    // Knowledge base errors
    KB_ARTICLE_NOT_FOUND = 'KB_ARTICLE_NOT_FOUND',
    KB_CREATION_FAILED = 'KB_CREATION_FAILED',
    KB_SEARCH_FAILED = 'KB_SEARCH_FAILED',

    // Notification errors
    EMAIL_SERVICE_UNAVAILABLE = 'EMAIL_SERVICE_UNAVAILABLE',
    NOTIFICATION_DELIVERY_FAILED = 'NOTIFICATION_DELIVERY_FAILED',
    INVALID_EMAIL_ADDRESS = 'INVALID_EMAIL_ADDRESS',

    // Queue management errors
    QUEUE_ACCESS_DENIED = 'QUEUE_ACCESS_DENIED',
    INVALID_QUEUE_OPERATION = 'INVALID_QUEUE_OPERATION',

    // SLA and timer errors
    SLA_CALCULATION_FAILED = 'SLA_CALCULATION_FAILED',
    TIMER_OPERATION_FAILED = 'TIMER_OPERATION_FAILED',
}

/**
 * Input validation schemas
 */
export const HelpDeskValidationSchemas = {
    // Ticket creation validation
    createTicket: z.object({
        title: z.string()
            .min(1, 'Title is required')
            .max(200, 'Title must be less than 200 characters')
            .trim(),
        description: z.string()
            .min(1, 'Description is required')
            .max(5000, 'Description must be less than 5000 characters')
            .trim(),
        impactLevel: z.enum(['critical', 'medium', 'low'], {
            errorMap: () => ({ message: 'Impact level must be critical, medium, or low' })
        }),
        deviceId: z.string()
            .max(50, 'Device ID must be less than 50 characters')
            .regex(/^[A-Z0-9-_]+$/i, 'Device ID can only contain letters, numbers, hyphens, and underscores')
            .optional(),
        contactMethod: z.enum(['email', 'phone']).default('email'),
        phoneNumber: z.string()
            .min(1, 'Phone number is required')
            .regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format')
            .refine(phone => phone.replace(/\D/g, '').length >= 10, 'Phone number must be at least 10 digits'),
    }),

    // Ticket update validation
    updateTicket: z.object({
        title: z.string()
            .min(1, 'Title cannot be empty')
            .max(200, 'Title must be less than 200 characters')
            .trim()
            .optional(),
        description: z.string()
            .min(1, 'Description cannot be empty')
            .max(5000, 'Description must be less than 5000 characters')
            .trim()
            .optional(),
        status: z.nativeEnum(TicketStatus).optional(),
        assignee: z.string().optional(),
    }),

    // Resolution validation
    resolveTicket: z.object({
        resolution: z.string()
            .min(10, 'Resolution description must be at least 10 characters')
            .max(2000, 'Resolution description must be less than 2000 characters')
            .trim(),
        createKnowledgeArticle: z.boolean().default(false),
        knowledgeArticleTitle: z.string()
            .min(1, 'Knowledge article title is required when creating article')
            .max(200, 'Knowledge article title must be less than 200 characters')
            .trim()
            .optional(),
    }).refine(data => {
        // If creating KB article, title is required
        if (data.createKnowledgeArticle && !data.knowledgeArticleTitle) {
            return false;
        }
        return true;
    }, {
        message: 'Knowledge article title is required when creating knowledge article',
        path: ['knowledgeArticleTitle']
    }),

    // Comment validation
    addComment: z.object({
        content: z.string()
            .min(1, 'Comment content is required')
            .max(2000, 'Comment must be less than 2000 characters')
            .trim(),
        isInternal: z.boolean().default(false),
    }),

    // File upload validation
    fileUpload: z.object({
        filename: z.string().min(1, 'Filename is required'),
        size: z.number()
            .min(1, 'File cannot be empty')
            .max(10 * 1024 * 1024, 'File size cannot exceed 10MB'), // 10MB limit
        mimeType: z.string().refine(type => {
            const allowedTypes = [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'application/pdf',
                'text/plain',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            return allowedTypes.includes(type);
        }, 'File type not allowed. Supported types: images, PDF, text, and Word documents'),
    }),

    // Knowledge base search validation
    kbSearch: z.object({
        query: z.string()
            .min(2, 'Search query must be at least 2 characters')
            .max(100, 'Search query must be less than 100 characters')
            .trim(),
        limit: z.number().min(1).max(50).default(20),
    }),
};

/**
 * Business rule validation
 */
export class HelpDeskBusinessRules {
    /**
     * Validate ticket assignment rules
     */
    static validateTicketAssignment(
        ticket: any,
        assigneeId: string,
        assigneeRole: UserRole
    ): { valid: boolean; error?: string } {
        // Check if ticket is already assigned
        if (ticket.assignee && ticket.assignee !== 'Unassigned') {
            return {
                valid: false,
                error: `Ticket is already assigned to ${ticket.assignee}`
            };
        }

        // Check if assignee has permission for this ticket category
        const allowedCategories = this.getAllowedCategoriesForRole(assigneeRole);
        if (!allowedCategories.includes(ticket.category)) {
            return {
                valid: false,
                error: `Role ${assigneeRole} cannot be assigned tickets in category ${ticket.category}`
            };
        }

        return { valid: true };
    }

    /**
     * Validate state transitions
     */
    static validateStateTransition(
        currentStatus: TicketStatus,
        newStatus: TicketStatus,
        userRole: UserRole,
        hasResolution?: boolean
    ): { valid: boolean; error?: string } {
        // Define valid transitions
        const validTransitions: Record<TicketStatus, TicketStatus[]> = {
            [TicketStatus.NEW]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
            [TicketStatus.IN_PROGRESS]: [TicketStatus.WAITING_ON_USER, TicketStatus.RESOLVED, TicketStatus.NEW],
            [TicketStatus.WAITING_ON_USER]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
            [TicketStatus.RESOLVED]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
            [TicketStatus.CLOSED]: [], // Closed tickets cannot be transitioned
        };

        // Check if transition is valid
        if (!validTransitions[currentStatus]?.includes(newStatus)) {
            return {
                valid: false,
                error: `Invalid state transition from ${currentStatus} to ${newStatus}`
            };
        }

        // Special validation for resolution
        if (newStatus === TicketStatus.RESOLVED && !hasResolution) {
            return {
                valid: false,
                error: 'Resolution description is required when resolving a ticket'
            };
        }

        // Role-based restrictions
        if (newStatus === TicketStatus.CLOSED && userRole === UserRole.USER) {
            return {
                valid: false,
                error: 'Only help desk analysts can close tickets'
            };
        }

        return { valid: true };
    }

    /**
     * Validate file upload constraints
     */
    static validateFileUpload(
        file: { size: number; type: string; name: string },
        existingAttachments: number = 0
    ): { valid: boolean; error?: string } {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        const MAX_ATTACHMENTS = 5;
        const ALLOWED_TYPES = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (file.size > MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
            };
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return {
                valid: false,
                error: 'File type not allowed. Supported types: images, PDF, text, and Word documents'
            };
        }

        if (existingAttachments >= MAX_ATTACHMENTS) {
            return {
                valid: false,
                error: `Maximum of ${MAX_ATTACHMENTS} attachments allowed per ticket`
            };
        }

        return { valid: true };
    }

    /**
     * Get allowed categories for a user role
     */
    private static getAllowedCategoriesForRole(role: UserRole): TicketCategory[] {
        switch (role) {
            case UserRole.IT_HELPDESK_ANALYST:
                return [TicketCategory.IT_SUPPORT, TicketCategory.HARDWARE, TicketCategory.SOFTWARE];
            case UserRole.SECURITY_ANALYST:
                return [TicketCategory.SECURITY_INCIDENT, TicketCategory.COMPLIANCE];
            case UserRole.TENANT_ADMIN:
                return Object.values(TicketCategory);
            case UserRole.SUPER_ADMIN:
                return Object.values(TicketCategory);
            default:
                return [];
        }
    }
}

/**
 * Help Desk specific error factory
 */
export class HelpDeskErrors {
    static ticketNotFound(ticketId: string): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.TICKET_NOT_FOUND,
            `Ticket ${ticketId} not found`,
            404
        );
    }

    static ticketAlreadyAssigned(assignee: string): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.TICKET_ALREADY_ASSIGNED,
            `Ticket is already assigned to ${assignee}`,
            400
        );
    }

    static invalidStateTransition(from: string, to: string): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.INVALID_STATE_TRANSITION,
            `Invalid state transition from ${from} to ${to}`,
            400
        );
    }

    static resolutionRequired(): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.RESOLUTION_REQUIRED,
            'Resolution description is required when resolving a ticket',
            400
        );
    }

    static fileTooLarge(maxSize: string): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.FILE_TOO_LARGE,
            `File size exceeds maximum limit of ${maxSize}`,
            400
        );
    }

    static invalidFileType(allowedTypes: string[]): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.INVALID_FILE_TYPE,
            `File type not allowed. Supported types: ${allowedTypes.join(', ')}`,
            400
        );
    }

    static attachmentLimitExceeded(limit: number): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.ATTACHMENT_LIMIT_EXCEEDED,
            `Maximum of ${limit} attachments allowed per ticket`,
            400
        );
    }

    static emailServiceUnavailable(): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.EMAIL_SERVICE_UNAVAILABLE,
            'Email service is temporarily unavailable',
            503
        );
    }

    static notificationDeliveryFailed(reason?: string): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.NOTIFICATION_DELIVERY_FAILED,
            `Failed to deliver notification${reason ? `: ${reason}` : ''}`,
            500
        );
    }

    static queueAccessDenied(userRole: string, category: string): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.QUEUE_ACCESS_DENIED,
            `Role ${userRole} does not have access to ${category} tickets`,
            403
        );
    }

    static kbArticleNotFound(articleId: string): CustomApiError {
        return new CustomApiError(
            HelpDeskErrorCode.KB_ARTICLE_NOT_FOUND,
            `Knowledge base article ${articleId} not found`,
            404
        );
    }
}

/**
 * Input validation utility
 */
export class HelpDeskValidator {
    /**
     * Validate and sanitize ticket creation data
     */
    static validateTicketCreation(data: any): { valid: boolean; data?: any; errors?: string[] } {
        try {
            const validatedData = HelpDeskValidationSchemas.createTicket.parse(data);
            return { valid: true, data: validatedData };
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
                return { valid: false, errors };
            }
            return { valid: false, errors: ['Invalid input data'] };
        }
    }

    /**
     * Validate proxy ticket creation data (for tenant admin creating tickets on behalf of users)
     */
    static validateProxyTicketCreation(data: any): { valid: boolean; data?: any; errors?: string[] } {
        const proxyTicketSchema = z.object({
            title: z.string()
                .min(1, 'Title is required')
                .max(200, 'Title must be less than 200 characters')
                .trim(),
            description: z.string()
                .min(1, 'Description is required')
                .max(5000, 'Description must be less than 5000 characters')
                .trim(),
            category: z.nativeEnum(TicketCategory).optional(),
            severity: z.nativeEnum(TicketSeverity).optional(),
            priority: z.nativeEnum(TicketPriority).optional(),
            onBehalfOfUserId: z.string().optional(),
            onBehalfOfEmail: z.string().email('Invalid email format').optional(),
            requesterEmail: z.string().email('Invalid requester email format'),
        }).refine(data => {
            // Either onBehalfOfUserId or onBehalfOfEmail must be provided
            if (!data.onBehalfOfUserId && !data.onBehalfOfEmail) {
                return false;
            }
            return true;
        }, {
            message: 'Either user ID or email must be provided for proxy ticket creation',
            path: ['onBehalfOfUserId']
        });

        try {
            const validatedData = proxyTicketSchema.parse(data);
            return { valid: true, data: validatedData };
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
                return { valid: false, errors };
            }
            return { valid: false, errors: ['Invalid proxy ticket data'] };
        }
    }

    /**
     * Validate ticket resolution data
     */
    static validateTicketResolution(data: any): { valid: boolean; data?: any; errors?: string[] } {
        try {
            const validatedData = HelpDeskValidationSchemas.resolveTicket.parse(data);
            return { valid: true, data: validatedData };
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
                return { valid: false, errors };
            }
            return { valid: false, errors: ['Invalid resolution data'] };
        }
    }

    /**
     * Validate file upload
     */
    static validateFileUpload(
        file: { size: number; type: string; name: string },
        existingAttachments: number = 0
    ): { valid: boolean; errors?: string[] } {
        const businessRuleResult = HelpDeskBusinessRules.validateFileUpload(file, existingAttachments);

        if (!businessRuleResult.valid) {
            return { valid: false, errors: [businessRuleResult.error!] };
        }

        try {
            HelpDeskValidationSchemas.fileUpload.parse({
                filename: file.name,
                size: file.size,
                mimeType: file.type,
            });
            return { valid: true };
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.issues.map(issue => issue.message);
                return { valid: false, errors };
            }
            return { valid: false, errors: ['Invalid file data'] };
        }
    }

    /**
     * Sanitize user input to prevent XSS and injection attacks
     */
    static sanitizeInput(input: string): string {
        return input
            .trim()
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: URLs
            .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    }

    /**
     * Validate email address format
     */
    static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate phone number format
     */
    static isValidPhoneNumber(phone: string): boolean {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
    }
}

/**
 * Retry mechanism for external services
 */
export class HelpDeskRetryManager {
    private static readonly DEFAULT_MAX_RETRIES = 3;
    private static readonly DEFAULT_BASE_DELAY = 1000; // 1 second

    /**
     * Execute operation with retry logic
     */
    static async executeWithRetry<T>(
        operation: () => Promise<T>,
        options: {
            maxRetries?: number;
            baseDelay?: number;
            shouldRetry?: (error: any) => boolean;
            onRetry?: (attempt: number, error: any) => void;
        } = {}
    ): Promise<T> {
        const {
            maxRetries = this.DEFAULT_MAX_RETRIES,
            baseDelay = this.DEFAULT_BASE_DELAY,
            shouldRetry = this.defaultShouldRetry,
            onRetry
        } = options;

        let lastError: any;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                // Don't retry on the last attempt
                if (attempt === maxRetries) {
                    break;
                }

                // Check if error is retryable
                if (!shouldRetry(error)) {
                    throw error;
                }

                // Calculate delay with exponential backoff
                const delay = baseDelay * Math.pow(2, attempt);

                if (onRetry) {
                    onRetry(attempt + 1, error);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    /**
     * Default retry logic for common errors
     */
    private static defaultShouldRetry(error: any): boolean {
        // Retry on network errors, timeouts, and server errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return true;
        }

        if (error instanceof CustomApiError) {
            return [
                HelpDeskErrorCode.EMAIL_SERVICE_UNAVAILABLE,
                ApiErrorCode.EXTERNAL_SERVICE_ERROR,
                ApiErrorCode.DATABASE_ERROR
            ].includes(error.code as any);
        }

        // Retry on HTTP 5xx errors
        if (error.status >= 500) {
            return true;
        }

        return false;
    }
}

/**
 * Error boundary for React components
 */
export class HelpDeskErrorBoundary {
    /**
     * Handle component errors gracefully
     */
    static handleComponentError(error: Error, errorInfo: any): void {
        console.error('Help Desk Component Error:', error, errorInfo);

        // Log to monitoring service in production
        if (process.env.NODE_ENV === 'production') {
            // TODO: Send to monitoring service
        }
    }

    /**
     * Get user-friendly error message for UI display
     */
    static getUserFriendlyMessage(error: any): string {
        if (error instanceof CustomApiError) {
            switch (error.code) {
                case HelpDeskErrorCode.TICKET_NOT_FOUND:
                    return 'The ticket you are looking for could not be found.';
                case HelpDeskErrorCode.TICKET_ALREADY_ASSIGNED:
                    return 'This ticket has already been assigned to another analyst.';
                case HelpDeskErrorCode.INVALID_STATE_TRANSITION:
                    return 'This action is not allowed for the current ticket status.';
                case HelpDeskErrorCode.FILE_TOO_LARGE:
                    return 'The file you are trying to upload is too large.';
                case HelpDeskErrorCode.INVALID_FILE_TYPE:
                    return 'The file type you are trying to upload is not supported.';
                case HelpDeskErrorCode.EMAIL_SERVICE_UNAVAILABLE:
                    return 'Email notifications are temporarily unavailable.';
                default:
                    return error.message;
            }
        }

        return 'An unexpected error occurred. Please try again.';
    }
}