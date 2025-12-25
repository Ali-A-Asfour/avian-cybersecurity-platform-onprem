import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),

  // Email validation
  email: z.string().email('Invalid email format'),

  // Password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sort_by: z.string().optional(),
    sort_order: z.enum(['asc', 'desc']).default('desc'),
  }),

  // Date range
  dateRange: z.object({
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
  }).refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.start_date) <= new Date(data.end_date);
      }
      return true;
    },
    { message: 'Start date must be before end date' }
  ),

  // File upload
  fileUpload: z.object({
    filename: z.string().min(1, 'Filename is required'),
    content_type: z.string().min(1, 'Content type is required'),
    size: z.number().int().min(1).max(10 * 1024 * 1024), // 10MB max
  }),
};

/**
 * API-specific validation schemas
 */
export const apiSchemas = {
  // Authentication
  login: z.object({
    email: commonSchemas.email,
    password: z.string().min(1, 'Password is required'),
    mfa_code: z.string().length(6, 'MFA code must be 6 digits').optional(),
  }),

  // User management
  createUser: z.object({
    email: commonSchemas.email,
    first_name: z.string().min(1, 'First name is required').max(50),
    last_name: z.string().min(1, 'Last name is required').max(50),
    role: z.enum(['super_admin', 'tenant_admin', 'analyst', 'user']),
    tenant_id: commonSchemas.uuid.optional(),
  }),

  updateUser: z.object({
    first_name: z.string().min(1).max(50).optional(),
    last_name: z.string().min(1).max(50).optional(),
    role: z.enum(['super_admin', 'tenant_admin', 'analyst', 'user']).optional(),
  }),

  // Tenant management
  createTenant: z.object({
    name: z.string().min(1, 'Tenant name is required').max(100),
    domain: z.string().min(1, 'Domain is required').max(100),
    logo_url: z.string().url().optional(),
    theme_color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color').optional(),
  }),

  updateTenant: z.object({
    name: z.string().min(1).max(100).optional(),
    domain: z.string().min(1).max(100).optional(),
    logo_url: z.string().url().optional(),
    theme_color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color').optional(),
  }),

  // Ticket management
  createTicket: z.object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().min(1, 'Description is required').max(5000),
    category: z.enum(['security_incident', 'vulnerability', 'compliance', 'access_request', 'other']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    assignee: commonSchemas.uuid.optional(),
    tags: z.array(z.string().max(50)).max(10).default([]),
  }),

  updateTicket: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(5000).optional(),
    category: z.enum(['security_incident', 'vulnerability', 'compliance', 'access_request', 'other']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    status: z.enum(['new', 'in_progress', 'awaiting_response', 'resolved', 'closed']).optional(),
    assignee: commonSchemas.uuid.optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  }),

  // Alert management
  createAlert: z.object({
    source: z.string().min(1, 'Source is required').max(100),
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().min(1, 'Description is required').max(5000),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    category: z.enum(['malware', 'phishing', 'data_breach', 'unauthorized_access', 'policy_violation', 'other']),
    status: z.enum(['open', 'investigating', 'resolved', 'false_positive']).default('open'),
    metadata: z.record(z.any()).default({}),
  }),

  updateAlert: z.object({
    status: z.enum(['open', 'investigating', 'resolved', 'false_positive']).optional(),
    metadata: z.record(z.any()).optional(),
  }),

  // Compliance management
  createComplianceFramework: z.object({
    name: z.string().min(1, 'Framework name is required').max(100),
    version: z.string().min(1, 'Version is required').max(20),
    description: z.string().max(1000).optional(),
  }),

  updateComplianceControl: z.object({
    status: z.enum(['not_started', 'in_progress', 'completed', 'not_applicable']),
    notes: z.string().max(2000).optional(),
  }),

  // Notification preferences
  updateNotificationPreferences: z.object({
    email_enabled: z.boolean().default(true),
    push_enabled: z.boolean().default(true),
    sms_enabled: z.boolean().default(false),
    ticket_updates: z.boolean().default(true),
    alert_notifications: z.boolean().default(true),
    compliance_reminders: z.boolean().default(true),
    sla_breaches: z.boolean().default(true),
  }),
};

/**
 * Input sanitization utilities
 */
export class InputSanitizer {
  /**
   * Comprehensive XSS prevention for string inputs
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      // Remove HTML tags completely
      .replace(/<[^>]*>/g, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove data: protocol (can be used for XSS)
      .replace(/data:/gi, '')
      // Remove vbscript: protocol
      .replace(/vbscript:/gi, '')
      // Remove event handlers
      .replace(/on\w+\s*=/gi, '')
      // Remove expression() CSS
      .replace(/expression\s*\(/gi, '')
      // Remove @import CSS
      .replace(/@import/gi, '')
      // Remove null bytes
      .replace(/\0/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Enhanced HTML sanitization with allowlist approach
   */
  static sanitizeHtml(input: string, allowedTags: string[] = []): string {
    if (typeof input !== 'string') return '';

    // Remove dangerous tags completely
    let sanitized = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      .replace(/<input\b[^>]*>/gi, '')
      .replace(/<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gi, '')
      .replace(/<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi, '')
      .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '')
      .replace(/<link\b[^>]*>/gi, '')
      .replace(/<meta\b[^>]*>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove dangerous protocols
    sanitized = sanitized
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/file:/gi, '');

    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');

    // If no allowed tags specified, remove all remaining tags
    if (allowedTags.length === 0) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    } else {
      // Remove tags not in allowlist
      const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
      sanitized = sanitized.replace(tagRegex, (match, tagName) => {
        return allowedTags.includes(tagName.toLowerCase()) ? match : '';
      });
    }

    return sanitized.trim();
  }

  /**
   * Enhanced SQL injection prevention (still recommend parameterized queries)
   */
  static sanitizeSql(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      // Remove SQL injection patterns
      .replace(/['";\\]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/xp_/gi, '')
      .replace(/sp_/gi, '')
      .replace(/exec\s*\(/gi, '')
      .replace(/execute\s*\(/gi, '')
      .replace(/union\s+select/gi, '')
      .replace(/drop\s+table/gi, '')
      .replace(/delete\s+from/gi, '')
      .replace(/insert\s+into/gi, '')
      .replace(/update\s+set/gi, '')
      .replace(/create\s+table/gi, '')
      .replace(/alter\s+table/gi, '')
      .replace(/truncate\s+table/gi, '')
      .trim();
  }

  /**
   * Enhanced file path sanitization with security checks
   */
  static sanitizeFilePath(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      // Remove directory traversal attempts
      .replace(/\.\./g, '')
      .replace(/\.\\/g, '')
      .replace(/\.\//g, '')
      // Remove absolute path indicators
      .replace(/^[\/\\]+/, '')
      .replace(/^[a-zA-Z]:[\/\\]/, '')
      // Remove invalid filename characters
      .replace(/[<>:"|?*\x00-\x1f]/g, '')
      // Remove null bytes and control characters
      .replace(/[\x00-\x1f\x7f]/g, '')
      // Normalize path separators
      .replace(/[\/\\]+/g, '/')
      // Remove leading/trailing whitespace and dots
      .replace(/^[\s\.]+|[\s\.]+$/g, '')
      .trim();
  }

  /**
   * Sanitize email addresses
   */
  static sanitizeEmail(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .toLowerCase()
      .replace(/[^\w@.-]/g, '')
      .trim();
  }

  /**
   * Sanitize phone numbers
   */
  static sanitizePhone(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .replace(/[^\d+\-\(\)\s]/g, '')
      .trim();
  }

  /**
   * Sanitize URLs
   */
  static sanitizeUrl(input: string): string {
    if (typeof input !== 'string') return '';

    // Remove dangerous protocols
    const sanitized = input
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/file:/gi, '')
      .trim();

    // Validate URL format
    try {
      new URL(sanitized);
      return sanitized;
    } catch (error) {
      return '';
    }
  }

  /**
   * Deep sanitize object recursively
   */
  static sanitizeObject(obj: any, options: {
    sanitizeStrings?: boolean;
    sanitizeHtml?: boolean;
    allowedHtmlTags?: string[];
    maxDepth?: number;
  } = {}): any {
    const {
      sanitizeStrings = true,
      sanitizeHtml = false,
      allowedHtmlTags = [],
      maxDepth = 10
    } = options;

    if (maxDepth <= 0) return obj;

    if (typeof obj === 'string') {
      if (sanitizeHtml) {
        return this.sanitizeHtml(obj, allowedHtmlTags);
      }
      if (sanitizeStrings) {
        return this.sanitizeString(obj);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, { ...options, maxDepth: maxDepth - 1 }));
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = sanitizeStrings ? this.sanitizeString(key) : key;
        sanitized[sanitizedKey] = this.sanitizeObject(value, { ...options, maxDepth: maxDepth - 1 });
      }
      return sanitized;
    }

    return obj;
  }
}

/**
 * Request validation middleware factory
 */
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return async (request: NextRequest): Promise<{ success: boolean; data?: T; error?: any }> => {
    try {
      let body: any = {};

      // Parse request body if it exists
      if (request.headers.get('content-type')?.includes('application/json')) {
        try {
          body = await request.json();
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'INVALID_JSON',
              message: 'Invalid JSON in request body',
            }
          };
        }
      }

      // Parse query parameters
      const { searchParams } = new URL(request.url);
      const queryParams: Record<string, any> = {};

      for (const [key, value] of searchParams.entries()) {
        // Handle array parameters (e.g., ?tags=tag1&tags=tag2)
        if (queryParams[key]) {
          if (Array.isArray(queryParams[key])) {
            queryParams[key].push(value);
          } else {
            queryParams[key] = [queryParams[key], value];
          }
        } else {
          queryParams[key] = value;
        }
      }

      // Combine body and query parameters
      const requestData = { ...body, ...queryParams };

      // Validate against schema
      const validatedData = schema.parse(requestData);

      return {
        success: true,
        data: validatedData,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
          }
        };
      }

      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
        }
      };
    }
  };
}

/**
 * Query parameter validation for GET requests
 */
export function validateQueryParams<T>(schema: z.ZodSchema<T>) {
  return (request: NextRequest): { success: boolean; data?: T; error?: any } => {
    try {
      const { searchParams } = new URL(request.url);
      const queryParams: Record<string, any> = {};

      for (const [key, value] of searchParams.entries()) {
        // Handle array parameters
        if (queryParams[key]) {
          if (Array.isArray(queryParams[key])) {
            queryParams[key].push(value);
          } else {
            queryParams[key] = [queryParams[key], value];
          }
        } else {
          queryParams[key] = value;
        }
      }

      const validatedData = schema.parse(queryParams);

      return {
        success: true,
        data: validatedData,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
          }
        };
      }

      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
        }
      };
    }
  };
}