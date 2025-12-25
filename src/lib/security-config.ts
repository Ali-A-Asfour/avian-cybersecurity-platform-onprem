import { NextRequest, NextResponse } from 'next/server';

/**
 * Security configuration interface
 */
export interface SecurityConfig {
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };
  headers: {
    contentSecurityPolicy: string;
    strictTransportSecurity: string;
    xFrameOptions: string;
    xContentTypeOptions: string;
    referrerPolicy: string;
    permissionsPolicy: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  validation: {
    maxRequestSize: number;
    maxFileSize: number;
    allowedFileTypes: string[];
    maxFieldLength: number;
  };
}

/**
 * Default security configuration
 */
export const defaultSecurityConfig: SecurityConfig = {
  cors: {
    allowedOrigins: process.env.NODE_ENV === 'development' 
      ? ['http://localhost:3000', 'http://127.0.0.1:3000']
      : (process.env.ALLOWED_ORIGINS?.split(',') || []),
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-User-ID',
      'X-Tenant-ID',
      'X-Request-ID',
      'X-API-Key',
      'Accept',
      'Origin',
      'Cache-Control',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-Processing-Time',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
  },
  headers: {
    contentSecurityPolicy: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Note: In production, remove unsafe-inline and unsafe-eval
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "media-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
    strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', '),
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  validation: {
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedFileTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
      'application/xml',
      'application/zip',
    ],
    maxFieldLength: 10000,
  },
};

/**
 * CORS handler with comprehensive security checks
 */
export class CorsHandler {
  private config: SecurityConfig['cors'];
  
  constructor(config: SecurityConfig['cors'] = defaultSecurityConfig.cors) {
    this.config = config;
  }
  
  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false;
    
    // Allow all origins in development (with wildcard)
    if (this.config.allowedOrigins.includes('*')) {
      return true;
    }
    
    // Check exact matches
    if (this.config.allowedOrigins.includes(origin)) {
      return true;
    }
    
    // Check pattern matches (e.g., *.example.com)
    return this.config.allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.startsWith('*.')) {
        const domain = allowedOrigin.substring(2);
        return origin.endsWith(`.${domain}`) || origin === domain;
      }
      return false;
    });
  }
  
  /**
   * Handle CORS preflight request
   */
  handlePreflight(request: NextRequest): NextResponse {
    const origin = request.headers.get('origin');
    const requestMethod = request.headers.get('access-control-request-method');
    const requestHeaders = request.headers.get('access-control-request-headers');
    
    // Check origin
    if (!this.isOriginAllowed(origin)) {
      return new NextResponse(null, { status: 403 });
    }
    
    // Check method
    if (requestMethod && !this.config.allowedMethods.includes(requestMethod)) {
      return new NextResponse(null, { status: 405 });
    }
    
    // Check headers
    if (requestHeaders) {
      const headers = requestHeaders.split(',').map(h => h.trim().toLowerCase());
      const allowedHeaders = this.config.allowedHeaders.map(h => h.toLowerCase());
      
      if (!headers.every(header => allowedHeaders.includes(header))) {
        return new NextResponse(null, { status: 400 });
      }
    }
    
    const response = new NextResponse(null, { status: 200 });
    this.applyCorsHeaders(response, origin);
    
    return response;
  }
  
  /**
   * Apply CORS headers to response
   */
  applyCorsHeaders(response: NextResponse, origin?: string | null): void {
    if (origin && this.isOriginAllowed(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else if (this.config.allowedOrigins.includes('*')) {
      response.headers.set('Access-Control-Allow-Origin', '*');
    }
    
    response.headers.set(
      'Access-Control-Allow-Methods',
      this.config.allowedMethods.join(', ')
    );
    
    response.headers.set(
      'Access-Control-Allow-Headers',
      this.config.allowedHeaders.join(', ')
    );
    
    if (this.config.exposedHeaders.length > 0) {
      response.headers.set(
        'Access-Control-Expose-Headers',
        this.config.exposedHeaders.join(', ')
      );
    }
    
    if (this.config.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    response.headers.set('Access-Control-Max-Age', this.config.maxAge.toString());
  }
  
  /**
   * Validate CORS for actual request
   */
  validateRequest(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    
    // Same-origin requests don't need CORS validation
    if (!origin) return true;
    
    return this.isOriginAllowed(origin);
  }
}

/**
 * Security headers handler
 */
export class SecurityHeaders {
  private config: SecurityConfig['headers'];
  
  constructor(config: SecurityConfig['headers'] = defaultSecurityConfig.headers) {
    this.config = config;
  }
  
  /**
   * Apply all security headers to response
   */
  applyHeaders(response: NextResponse, options: {
    skipCSP?: boolean;
    customCSP?: string;
  } = {}): void {
    // Content Security Policy
    if (!options.skipCSP) {
      const csp = options.customCSP || this.config.contentSecurityPolicy;
      response.headers.set('Content-Security-Policy', csp);
    }
    
    // HSTS (HTTP Strict Transport Security)
    response.headers.set('Strict-Transport-Security', this.config.strictTransportSecurity);
    
    // X-Frame-Options (Clickjacking protection)
    response.headers.set('X-Frame-Options', this.config.xFrameOptions);
    
    // X-Content-Type-Options (MIME sniffing protection)
    response.headers.set('X-Content-Type-Options', this.config.xContentTypeOptions);
    
    // Referrer Policy
    response.headers.set('Referrer-Policy', this.config.referrerPolicy);
    
    // Permissions Policy (Feature Policy)
    response.headers.set('Permissions-Policy', this.config.permissionsPolicy);
    
    // X-XSS-Protection (Legacy XSS protection)
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // X-DNS-Prefetch-Control
    response.headers.set('X-DNS-Prefetch-Control', 'off');
    
    // X-Download-Options (IE8+ download protection)
    response.headers.set('X-Download-Options', 'noopen');
    
    // X-Permitted-Cross-Domain-Policies (Adobe Flash/PDF protection)
    response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Cache-Control for sensitive pages
    if (response.headers.get('cache-control') === null) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
  }
  
  /**
   * Generate nonce for CSP
   */
  generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    // Use btoa for Edge Runtime compatibility instead of Buffer
    return typeof Buffer !== 'undefined' 
      ? Buffer.from(array).toString('base64')
      : btoa(String.fromCharCode(...array));
  }
  
  /**
   * Create CSP with nonce
   */
  createCSPWithNonce(nonce: string): string {
    return this.config.contentSecurityPolicy
      .replace(/'unsafe-inline'/g, `'nonce-${nonce}'`)
      .replace(/'unsafe-eval'/g, ''); // Remove unsafe-eval when using nonces
  }
}

/**
 * Request validation utilities
 */
export class RequestValidator {
  private config: SecurityConfig['validation'];
  
  constructor(config: SecurityConfig['validation'] = defaultSecurityConfig.validation) {
    this.config = config;
  }
  
  /**
   * Validate request size
   */
  validateRequestSize(request: NextRequest): boolean {
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      return size <= this.config.maxRequestSize;
    }
    return true;
  }
  
  /**
   * Validate file upload
   */
  validateFileUpload(file: {
    size: number;
    type: string;
    name: string;
  }): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`,
      };
    }
    
    // Check file type
    if (!this.config.allowedFileTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }
    
    // Check filename for security issues
    if (this.hasUnsafeFilename(file.name)) {
      return {
        valid: false,
        error: 'Filename contains unsafe characters',
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Check for unsafe filename patterns
   */
  private hasUnsafeFilename(filename: string): boolean {
    // Check for directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return true;
    }
    
    // Check for null bytes
    if (filename.includes('\0')) {
      return true;
    }
    
    // Check for executable extensions
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
      '.sh', '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl',
    ];
    
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return dangerousExtensions.includes(extension);
  }
  
  /**
   * Validate field length
   */
  validateFieldLength(value: string, fieldName: string): { valid: boolean; error?: string } {
    if (value.length > this.config.maxFieldLength) {
      return {
        valid: false,
        error: `Field ${fieldName} exceeds maximum length of ${this.config.maxFieldLength} characters`,
      };
    }
    return { valid: true };
  }
}

/**
 * Comprehensive security middleware factory
 */
export function createSecurityMiddleware(config: Partial<SecurityConfig> = {}) {
  const fullConfig: SecurityConfig = {
    ...defaultSecurityConfig,
    ...config,
    cors: { ...defaultSecurityConfig.cors, ...config.cors },
    headers: { ...defaultSecurityConfig.headers, ...config.headers },
    rateLimit: { ...defaultSecurityConfig.rateLimit, ...config.rateLimit },
    validation: { ...defaultSecurityConfig.validation, ...config.validation },
  };
  
  const corsHandler = new CorsHandler(fullConfig.cors);
  const securityHeaders = new SecurityHeaders(fullConfig.headers);
  const requestValidator = new RequestValidator(fullConfig.validation);
  
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return corsHandler.handlePreflight(request);
    }
    
    // Validate CORS for actual requests
    if (!corsHandler.validateRequest(request)) {
      return new NextResponse('CORS policy violation', { status: 403 });
    }
    
    // Validate request size
    if (!requestValidator.validateRequestSize(request)) {
      return new NextResponse('Request too large', { status: 413 });
    }
    
    // Continue with request processing
    const response = NextResponse.next();
    
    // Apply security headers
    securityHeaders.applyHeaders(response);
    
    // Apply CORS headers
    corsHandler.applyCorsHeaders(response, request.headers.get('origin'));
    
    return response;
  };
}

/**
 * Environment-specific security configurations
 */
export const securityConfigs = {
  development: {
    ...defaultSecurityConfig,
    cors: {
      ...defaultSecurityConfig.cors,
      allowedOrigins: ['*'], // Allow all origins in development
    },
    headers: {
      ...defaultSecurityConfig.headers,
      contentSecurityPolicy: defaultSecurityConfig.headers.contentSecurityPolicy
        .replace("'unsafe-inline'", "'unsafe-inline' 'unsafe-eval'"), // More permissive in dev
    },
  },
  
  production: {
    ...defaultSecurityConfig,
    headers: {
      ...defaultSecurityConfig.headers,
      contentSecurityPolicy: defaultSecurityConfig.headers.contentSecurityPolicy
        .replace("'unsafe-inline'", '') // Remove unsafe-inline in production
        .replace("'unsafe-eval'", ''), // Remove unsafe-eval in production
    },
  },
  
  testing: {
    ...defaultSecurityConfig,
    cors: {
      ...defaultSecurityConfig.cors,
      allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    },
  },
};