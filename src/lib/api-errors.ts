import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Standard API error codes
 */
export enum ApiErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_JSON = 'INVALID_JSON',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Resource Management
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Tenant & Multi-tenancy
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  TENANT_ACCESS_DENIED = 'TENANT_ACCESS_DENIED',
  CROSS_TENANT_ACCESS = 'CROSS_TENANT_ACCESS',
  
  // Business Logic
  INVALID_OPERATION = 'INVALID_OPERATION',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  WORKFLOW_ERROR = 'WORKFLOW_ERROR',
  
  // External Services
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  WEBHOOK_DELIVERY_FAILED = 'WEBHOOK_DELIVERY_FAILED',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  
  // System Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
}

/**
 * API Error interface
 */
export interface ApiError {
  code: ApiErrorCode | string;
  message: string;
  details?: any;
  timestamp?: string;
  request_id?: string;
  path?: string;
}

/**
 * API Response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
    timestamp: string;
    request_id: string;
  };
}

/**
 * Custom API Error class
 */
export class CustomApiError extends Error {
  public readonly code: ApiErrorCode | string;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    code: ApiErrorCode | string,
    message: string,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'CustomApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, CustomApiError);
  }
}

/**
 * Pre-defined error factories
 */
export class ApiErrors {
  static unauthorized(message: string = 'Authentication required'): CustomApiError {
    return new CustomApiError(ApiErrorCode.UNAUTHORIZED, message, 401);
  }

  static forbidden(message: string = 'Insufficient permissions'): CustomApiError {
    return new CustomApiError(ApiErrorCode.FORBIDDEN, message, 403);
  }

  static notFound(resource: string = 'Resource'): CustomApiError {
    return new CustomApiError(ApiErrorCode.NOT_FOUND, `${resource} not found`, 404);
  }

  static validation(message: string = 'Invalid request data', details?: any): CustomApiError {
    return new CustomApiError(ApiErrorCode.VALIDATION_ERROR, message, 400, details);
  }

  static rateLimit(message: string = 'Too many requests', resetTime?: number): CustomApiError {
    return new CustomApiError(
      ApiErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      429,
      resetTime ? { resetTime } : undefined
    );
  }

  static conflict(message: string = 'Resource already exists'): CustomApiError {
    return new CustomApiError(ApiErrorCode.CONFLICT, message, 409);
  }

  static tenantAccess(message: string = 'Access denied to this tenant'): CustomApiError {
    return new CustomApiError(ApiErrorCode.TENANT_ACCESS_DENIED, message, 403);
  }

  static internal(message: string = 'Internal server error'): CustomApiError {
    return new CustomApiError(ApiErrorCode.INTERNAL_ERROR, message, 500, undefined, false);
  }

  static external(service: string, message?: string): CustomApiError {
    return new CustomApiError(
      ApiErrorCode.EXTERNAL_SERVICE_ERROR,
      message || `External service error: ${service}`,
      502
    );
  }

  static invalidOperation(message: string): CustomApiError {
    return new CustomApiError(ApiErrorCode.INVALID_OPERATION, message, 400);
  }
}

/**
 * Error handler utility class
 */
export class ErrorHandler {
  /**
   * Generate a unique request ID
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle and format API errors
   */
  static handleError(
    error: any,
    path?: string,
    requestId?: string
  ): NextResponse<ApiResponse> {
    const id = requestId || this.generateRequestId();
    const timestamp = new Date().toISOString();

    // Log error for debugging
    console.error(`[${id}] API Error:`, {
      error: error.message || error,
      stack: error.stack,
      path,
      timestamp,
    });

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const apiError: ApiError = {
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Invalid request data',
        details: error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
        timestamp,
        request_id: id,
        path,
      };

      return NextResponse.json(
        { success: false, error: apiError },
        { status: 400 }
      );
    }

    // Handle custom API errors
    if (error instanceof CustomApiError) {
      const apiError: ApiError = {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp,
        request_id: id,
        path,
      };

      return NextResponse.json(
        { success: false, error: apiError },
        { status: error.statusCode }
      );
    }

    // Handle database errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      const apiError: ApiError = {
        code: ApiErrorCode.DATABASE_ERROR,
        message: 'Database connection error',
        timestamp,
        request_id: id,
        path,
      };

      return NextResponse.json(
        { success: false, error: apiError },
        { status: 503 }
      );
    }

    // Handle PostgreSQL errors
    if (error.code === '23505') { // Unique constraint violation
      const apiError: ApiError = {
        code: ApiErrorCode.ALREADY_EXISTS,
        message: 'Resource already exists',
        timestamp,
        request_id: id,
        path,
      };

      return NextResponse.json(
        { success: false, error: apiError },
        { status: 409 }
      );
    }

    if (error.code === '23503') { // Foreign key constraint violation
      const apiError: ApiError = {
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Invalid reference to related resource',
        timestamp,
        request_id: id,
        path,
      };

      return NextResponse.json(
        { success: false, error: apiError },
        { status: 400 }
      );
    }

    // Handle generic errors
    const apiError: ApiError = {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'development' 
        ? error.message || 'Internal server error'
        : 'Internal server error',
      timestamp,
      request_id: id,
      path,
    };

    return NextResponse.json(
      { success: false, error: apiError },
      { status: 500 }
    );
  }

  /**
   * Create success response
   */
  static success<T>(
    data: T,
    meta?: any,
    status: number = 200
  ): NextResponse<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        ...meta,
        timestamp: new Date().toISOString(),
        request_id: this.generateRequestId(),
      },
    };

    return NextResponse.json(response, { status });
  }

  /**
   * Create paginated success response
   */
  static successWithPagination<T>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    status: number = 200
  ): NextResponse<ApiResponse<T[]>> {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    
    const response: ApiResponse<T[]> = {
      success: true,
      data,
      meta: {
        pagination: {
          ...pagination,
          total_pages: totalPages,
        },
        timestamp: new Date().toISOString(),
        request_id: this.generateRequestId(),
      },
    };

    return NextResponse.json(response, { status });
  }
}

/**
 * Async error wrapper for API routes
 */
export function asyncHandler(
  handler: (request: Request, context?: any) => Promise<NextResponse>
) {
  return async (request: Request, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch {
      const url = new URL(request.url);
      return ErrorHandler.handleError(error, url.pathname);
    }
  };
}

/**
 * Error logging utility
 */
export class ErrorLogger {
  /**
   * Log error with context
   */
  static logError(
    error: any,
    context: {
      userId?: string;
      tenantId?: string;
      path?: string;
      method?: string;
      ip?: string;
      userAgent?: string;
    }
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message || 'Unknown error',
      error: {
        name: error.name,
        stack: error.stack,
        code: error.code,
      },
      context,
    };

    // In production, you would send this to a logging service
    console.error('API Error:', JSON.stringify(logEntry, null, 2));
  }

  /**
   * Log security event
   */
  static logSecurityEvent(
    event: string,
    context: {
      userId?: string;
      tenantId?: string;
      ip?: string;
      userAgent?: string;
      details?: any;
    }
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'SECURITY',
      event,
      context,
    };

    // In production, you would send this to a security monitoring service
    console.warn('Security Event:', JSON.stringify(logEntry, null, 2));
  }
}