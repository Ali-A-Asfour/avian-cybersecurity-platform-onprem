import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from './auth.middleware';
import { tenantMiddleware } from './tenant.middleware';
import { RateLimiters, RateLimitBypass } from '../lib/rate-limiter';
import {  InputSanitizer } from '../lib/validation';
import { ErrorHandler, ApiErrors, ErrorLogger } from '../lib/api-errors';
import { XSSProtection, CSPManager, createXSSProtectionMiddleware } from '../lib/xss-protection';
import { CorsHandler, SecurityHeaders, RequestValidator, securityConfigs } from '../lib/security-config';
import { AuditLogger, auditContextMiddleware, AuditEventType, AuditResourceType } from '../lib/audit-logger';
import { z } from 'zod';

/**
 * Security middleware configuration
 */
export interface SecurityConfig {
  requireAuth?: boolean;
  requireTenant?: boolean;
  rateLimiter?: 'auth' | 'api' | 'user' | 'webhook' | 'upload' | 'search';
  allowedMethods?: string[];
  corsOrigins?: string[];
  validateInput?: z.ZodSchema<any>;
  sanitizeInput?: boolean;
  logRequests?: boolean;
  enableXSSProtection?: boolean;
  enableCSP?: boolean;
  strictMode?: boolean;
  auditLogging?: boolean;
}

/**
 * Request context interface
 */
export interface RequestContext {
  user?: any;
  tenant?: any;
  requestId: string;
  startTime: number;
  clientIp: string;
  userAgent: string;
}

/**
 * Comprehensive API security middleware
 */
export class ApiSecurityMiddleware {
  /**
   * Get security configuration based on environment
   */
  private static getSecurityConfig() {
    const env = process.env.NODE_ENV || 'development';
    return securityConfigs[env as keyof typeof securityConfigs] || securityConfigs.development;
  }

  /**
   * Validate HTTP method
   */
  private static validateMethod(
    request: NextRequest,
    allowedMethods: string[]
  ): NextResponse | null {
    if (!allowedMethods.includes(request.method)) {
      return ErrorHandler.handleError(
        ApiErrors.invalidOperation(`Method ${request.method} not allowed`),
        new URL(request.url).pathname
      );
    }
    return null;
  }

  /**
   * Enhanced sanitization with XSS protection
   */
  private static sanitizeRequestData(data: any, config: SecurityConfig): any {
    if (config.enableXSSProtection) {
      return XSSProtection.sanitizeObject(data, {
        strictMode: config.strictMode || true,
        allowHtml: false,
        allowedTags: [],
      });
    }
    
    // Fallback to basic sanitization
    return InputSanitizer.sanitizeObject(data, {
      sanitizeStrings: true,
      sanitizeHtml: false,
    });
  }

  /**
   * Log request for audit purposes
   */
  private static logRequest(
    request: NextRequest,
    context: RequestContext,
    config: SecurityConfig
  ): void {
    if (!config.logRequests) return;

    const logData = {
      requestId: context.requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      userAgent: context.userAgent,
      clientIp: context.clientIp,
      userId: context.user?.user_id,
      tenantId: context.tenant?.id,
      timestamp: new Date().toISOString(),
    };

    console.log('API Request:', JSON.stringify(logData));
  }

  /**
   * Create comprehensive security middleware
   */
  static create(config: SecurityConfig = {}) {
    // Get environment-specific security configuration
    const securityConfig = this.getSecurityConfig();
    const corsHandler = new CorsHandler(securityConfig.cors);
    const securityHeaders = new SecurityHeaders(securityConfig.headers);
    const requestValidator = new RequestValidator(securityConfig.validation);
    
    // Create XSS protection middleware if enabled
    const xssMiddleware = config.enableXSSProtection !== false 
      ? createXSSProtectionMiddleware({
          strictMode: config.strictMode !== false,
          logViolations: true,
          blockOnDetection: true,
        })
      : null;
    
    return async (request: NextRequest): Promise<NextResponse> => {
      const startTime = Date.now();
      const requestId = `req_${startTime}_${Math.random().toString(36).substr(2, 9)}`;
      const clientIp = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      const context: RequestContext = {
        requestId,
        startTime,
        clientIp,
        userAgent,
      };

      try {
        // Set audit context
        if (config.auditLogging !== false) {
          auditContextMiddleware(request);
        }

        // Handle OPTIONS requests (CORS preflight)
        if (request.method === 'OPTIONS') {
          return corsHandler.handlePreflight(request);
        }

        // Validate CORS for actual requests
        if (!corsHandler.validateRequest(request)) {
          await AuditLogger.logSecurityViolation('CORS_VIOLATION', {
            origin: request.headers.get('origin'),
            path: new URL(request.url).pathname,
            method: request.method,
          });
          return new NextResponse('CORS policy violation', { status: 403 });
        }

        // Validate request size
        if (!requestValidator.validateRequestSize(request)) {
          await AuditLogger.logSecurityViolation('REQUEST_SIZE_EXCEEDED', {
            contentLength: request.headers.get('content-length'),
            path: new URL(request.url).pathname,
          });
          return new NextResponse('Request too large', { status: 413 });
        }

        // Validate HTTP method
        if (config.allowedMethods) {
          const methodError = this.validateMethod(request, config.allowedMethods);
          if (methodError) {
            await AuditLogger.logSecurityViolation('INVALID_HTTP_METHOD', {
              method: request.method,
              allowedMethods: config.allowedMethods,
              path: new URL(request.url).pathname,
            });
            return methodError;
          }
        }

        // Apply XSS protection
        if (xssMiddleware) {
          const xssResult = await xssMiddleware(request);
          if (xssResult && xssResult.status !== 200) {
            return xssResult;
          }
        }

        // Apply rate limiting (with bypass check)
        if (config.rateLimiter && !RateLimitBypass.shouldBypass(request)) {
          const rateLimiter = RateLimiters[config.rateLimiter];
          if (rateLimiter) {
            const rateLimitResult = await rateLimiter.middleware()(request);
            if (rateLimitResult && rateLimitResult.status !== 200) {
              await AuditLogger.logSecurityViolation('RATE_LIMIT_EXCEEDED', {
                rateLimiter: config.rateLimiter,
                path: new URL(request.url).pathname,
              });
              return rateLimitResult;
            }
          }
        }

        // Authentication
        if (config.requireAuth) {
          const authResult = await authMiddleware(request);
          if (!authResult.success) {
            await AuditLogger.logAuth(
              AuditEventType.LOGIN_FAILED,
              undefined,
              {
                error: authResult.error,
                path: new URL(request.url).pathname,
                method: request.method,
              }
            );

            return ErrorHandler.handleError(
              ApiErrors.unauthorized(authResult.error),
              new URL(request.url).pathname,
              requestId
            );
          }
          context.user = authResult.user;
          
          // Log successful authentication
          await AuditLogger.logAuth(
            AuditEventType.ACCESS_GRANTED,
            authResult.user.user_id,
            {
              path: new URL(request.url).pathname,
              method: request.method,
            }
          );
        }

        // Tenant validation
        if (config.requireTenant && context.user) {
          const tenantResult = await tenantMiddleware(request, context.user);
          if (!tenantResult.success) {
            await AuditLogger.logAuthz(
              AuditEventType.ACCESS_DENIED,
              AuditResourceType.TENANT,
              undefined,
              {
                userId: context.user.user_id,
                error: tenantResult.error,
                path: new URL(request.url).pathname,
              }
            );

            return ErrorHandler.handleError(
              ApiErrors.tenantAccess(tenantResult.error),
              new URL(request.url).pathname,
              requestId
            );
          }
          context.tenant = tenantResult.tenant;
          
          // Log tenant access
          await AuditLogger.logAuthz(
            AuditEventType.TENANT_ACCESSED,
            AuditResourceType.TENANT,
            tenantResult.tenant.id,
            {
              userId: context.user.user_id,
              path: new URL(request.url).pathname,
            }
          );
        }

        // Input validation
        if (config.validateInput) {
          const validationResult = await validateRequest(config.validateInput)(request);
          if (!validationResult.success) {
            await AuditLogger.logSecurityViolation('INPUT_VALIDATION_FAILED', {
              error: validationResult.error,
              path: new URL(request.url).pathname,
            });
            
            return ErrorHandler.handleError(
              ApiErrors.validation(validationResult.error.message, validationResult.error.details),
              new URL(request.url).pathname,
              requestId
            );
          }
        }

        // Input sanitization
        if (config.sanitizeInput) {
          try {
            const contentType = request.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const body = await request.json();
              const sanitizedBody = this.sanitizeRequestData(body, config);
              
              // Create new request with sanitized body
              const sanitizedRequest = new NextRequest(request.url, {
                method: request.method,
                headers: request.headers,
                body: JSON.stringify(sanitizedBody),
              });
              
              request = sanitizedRequest;
            }
          } catch {
            // If body parsing fails, continue with original request
          }
        }

        // Log request for audit
        if (config.auditLogging !== false) {
          this.logRequest(request, context, config);
        }

        // Create response
        const response = NextResponse.next();
        
        // Add context headers
        response.headers.set('X-Request-ID', requestId);
        response.headers.set('X-Processing-Time', (Date.now() - startTime).toString());
        
        if (context.user) {
          response.headers.set('X-User-ID', context.user.user_id);
          response.headers.set('X-User-Role', context.user.role);
        }
        
        if (context.tenant) {
          response.headers.set('X-Tenant-ID', context.tenant.id);
        }

        // Apply security headers
        const nonce = config.enableCSP !== false ? CSPManager.generateNonce() : undefined;
        securityHeaders.applyHeaders(response, {
          skipCSP: config.enableCSP === false,
          customCSP: nonce ? CSPManager.createCSPHeader(nonce) : undefined,
        });
        
        // Apply CORS headers
        corsHandler.applyCorsHeaders(response, request.headers.get('origin'));

        return response;

      } catch {
        // Log error with audit context
        await AuditLogger.logEvent({
          action: AuditEventType.SECURITY_VIOLATION,
          resourceType: AuditResourceType.SYSTEM_SETTING,
          details: {
            error: error.message,
            path: new URL(request.url).pathname,
            method: request.method,
            category: 'middleware_error',
          },
        });

        return ErrorHandler.handleError(
          error,
          new URL(request.url).pathname,
          requestId
        );
      }
    };
  }

  /**
   * Pre-configured middleware for common use cases with enhanced security
   */
  static readonly presets = {
    /**
     * Public API endpoints (no auth required)
     */
    public: this.create({
      rateLimiter: 'api',
      allowedMethods: ['GET', 'POST', 'OPTIONS'],
      sanitizeInput: true,
      enableXSSProtection: true,
      enableCSP: true,
      strictMode: true,
      auditLogging: true,
      logRequests: true,
    }),

    /**
     * Authenticated API endpoints
     */
    authenticated: this.create({
      requireAuth: true,
      requireTenant: true,
      rateLimiter: 'user',
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      sanitizeInput: true,
      enableXSSProtection: true,
      enableCSP: true,
      strictMode: true,
      auditLogging: true,
      logRequests: true,
    }),

    /**
     * Admin-only endpoints (maximum security)
     */
    admin: this.create({
      requireAuth: true,
      rateLimiter: 'api',
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      sanitizeInput: true,
      enableXSSProtection: true,
      enableCSP: true,
      strictMode: true,
      auditLogging: true,
      logRequests: true,
    }),

    /**
     * Authentication endpoints (stricter rate limiting and security)
     */
    auth: this.create({
      rateLimiter: 'auth',
      allowedMethods: ['POST', 'OPTIONS'],
      sanitizeInput: true,
      enableXSSProtection: true,
      enableCSP: true,
      strictMode: true,
      auditLogging: true,
      logRequests: true,
    }),

    /**
     * Webhook endpoints (external data ingestion)
     */
    webhook: this.create({
      rateLimiter: 'webhook',
      allowedMethods: ['POST', 'OPTIONS'],
      sanitizeInput: true,
      enableXSSProtection: true,
      strictMode: true,
      auditLogging: true,
      logRequests: true,
    }),

    /**
     * File upload endpoints (enhanced validation)
     */
    upload: this.create({
      requireAuth: true,
      requireTenant: true,
      rateLimiter: 'upload',
      allowedMethods: ['POST', 'OPTIONS'],
      sanitizeInput: true,
      enableXSSProtection: true,
      strictMode: true,
      auditLogging: true,
      logRequests: true,
    }),

    /**
     * Search endpoints (expensive operations with protection)
     */
    search: this.create({
      requireAuth: true,
      requireTenant: true,
      rateLimiter: 'search',
      allowedMethods: ['GET', 'POST', 'OPTIONS'],
      sanitizeInput: true,
      enableXSSProtection: true,
      strictMode: true,
      auditLogging: true,
      logRequests: true,
    }),
  };
}

/**
 * Middleware composition utility
 */
export function composeMiddleware(
  ...middlewares: Array<(request: NextRequest) => Promise<NextResponse | null>>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    for (const middleware of middlewares) {
      const _result = await middleware(request);
      if (result && result.status !== 200) {
        return result;
      }
    }
    
    // If all middleware passed, return success
    return NextResponse.next();
  };
}

/**
 * Helper function to extract request context
 */
export function getRequestContext(request: NextRequest): Partial<RequestContext> {
  return {
    requestId: request.headers.get('x-request-id') || undefined,
    clientIp: request.headers.get('x-forwarded-for') || 
              request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}