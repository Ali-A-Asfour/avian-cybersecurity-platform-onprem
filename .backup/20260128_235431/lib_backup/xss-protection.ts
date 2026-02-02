import { NextRequest, NextResponse } from 'next/server';
import { InputSanitizer } from './validation';
import { AuditLogger, AuditEventType, AuditResourceType } from './audit-logger';
import { logger } from './logger';

/**
 * XSS attack patterns for detection
 */
const XSS_PATTERNS = [
  // Script tags
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  
  // JavaScript protocols
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  
  // Event handlers
  /on\w+\s*=/gi,
  /on[a-z]+\s*=/gi,
  
  // HTML entities that could be XSS
  /&#x?[0-9a-f]+;?/gi,
  
  // CSS expressions
  /expression\s*\(/gi,
  /-moz-binding/gi,
  
  // Meta refresh
  /<meta[^>]*http-equiv[^>]*refresh/gi,
  
  // Object/embed tags
  /<(object|embed|applet|iframe|frame|frameset)/gi,
  
  // Form elements
  /<(form|input|textarea|select|button)/gi,
  
  // Link tags with javascript
  /<link[^>]*href[^>]*javascript:/gi,
  
  // Style tags with javascript
  /<style[^>]*>[\s\S]*javascript[\s\S]*<\/style>/gi,
  
  // Base64 encoded scripts
  /data:text\/html;base64/gi,
  
  // SVG with scripts
  /<svg[^>]*>[\s\S]*<script[\s\S]*<\/svg>/gi,
];

/**
 * Dangerous HTML attributes that should be removed
 */
const DANGEROUS_ATTRIBUTES = [
  'onabort', 'onactivate', 'onafterprint', 'onafterscriptexecute', 'onafterupdate',
  'onbeforeactivate', 'onbeforecopy', 'onbeforecut', 'onbeforedeactivate',
  'onbeforeeditfocus', 'onbeforepaste', 'onbeforeprint', 'onbeforescriptexecute',
  'onbeforeunload', 'onbeforeupdate', 'onblur', 'onbounce', 'oncellchange',
  'onchange', 'onclick', 'oncontextmenu', 'oncontrolselect', 'oncopy', 'oncut',
  'ondataavailable', 'ondatasetchanged', 'ondatasetcomplete', 'ondblclick',
  'ondeactivate', 'ondrag', 'ondragdrop', 'ondragend', 'ondragenter', 'ondragleave',
  'ondragover', 'ondragstart', 'ondrop', 'onerror', 'onerrorupdate', 'onfilterchange',
  'onfinish', 'onfocus', 'onfocusin', 'onfocusout', 'onhelp', 'onkeydown', 'onkeypress',
  'onkeyup', 'onlayoutcomplete', 'onload', 'onlosecapture', 'onmousedown', 'onmouseenter',
  'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onmousewheel',
  'onmove', 'onmoveend', 'onmovestart', 'onpaste', 'onpropertychange', 'onreadystatechange',
  'onreset', 'onresize', 'onresizeend', 'onresizestart', 'onrowenter', 'onrowexit',
  'onrowsdelete', 'onrowsinserted', 'onscroll', 'onselect', 'onselectionchange',
  'onselectstart', 'onstart', 'onstop', 'onsubmit', 'onunload',
];

/**
 * XSS detection and prevention utilities
 */
export class XSSProtection {
  /**
   * Detect potential XSS attacks in input
   */
  static detectXSS(input: string): {
    isXSS: boolean;
    patterns: string[];
    risk: 'low' | 'medium' | 'high';
  } {
    if (typeof input !== 'string') {
      return { isXSS: false, patterns: [], risk: 'low' };
    }
    
    const detectedPatterns: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    // Check against XSS patterns
    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.source);
        
        // Determine risk level based on pattern type
        if (pattern.source.includes('script') || pattern.source.includes('javascript')) {
          riskLevel = 'high';
        } else if (pattern.source.includes('on\\w+') || pattern.source.includes('expression')) {
          riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
        }
      }
    }
    
    return {
      isXSS: detectedPatterns.length > 0,
      patterns: detectedPatterns,
      risk: riskLevel,
    };
  }
  
  /**
   * Comprehensive XSS sanitization
   */
  static sanitizeInput(input: string, options: {
    allowHtml?: boolean;
    allowedTags?: string[];
    strictMode?: boolean;
  } = {}): string {
    if (typeof input !== 'string') return '';
    
    const { allowHtml = false, allowedTags = [], strictMode = true } = options;
    
    const sanitized = input;
    
    if (strictMode) {
      // In strict mode, remove all HTML
      sanitized = InputSanitizer.sanitizeString(sanitized);
    } else if (allowHtml) {
      // Allow specific HTML tags but sanitize dangerous content
      sanitized = InputSanitizer.sanitizeHtml(sanitized, allowedTags);
    } else {
      // Basic sanitization
      sanitized = InputSanitizer.sanitizeString(sanitized);
    }
    
    // Additional XSS-specific sanitization
    sanitized = this.removeXSSPatterns(sanitized);
    
    return sanitized;
  }
  
  /**
   * Remove specific XSS patterns
   */
  private static removeXSSPatterns(input: string): string {
    const sanitized = input;
    
    // Remove dangerous attributes
    for (const attr of DANGEROUS_ATTRIBUTES) {
      const regex = new RegExp(`\\s*${attr}\\s*=\\s*[^\\s>]*`, 'gi');
      sanitized = sanitized.replace(regex, '');
    }
    
    // Remove javascript: protocols
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');
    sanitized = sanitized.replace(/data:text\/html/gi, '');
    
    // Remove CSS expressions
    sanitized = sanitized.replace(/expression\s*\(/gi, '');
    sanitized = sanitized.replace(/-moz-binding/gi, '');
    
    // Remove HTML comments that might contain scripts
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');
    
    // Remove CDATA sections
    sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
    
    return sanitized;
  }
  
  /**
   * Validate and sanitize URL to prevent XSS
   */
  static sanitizeURL(url: string): string {
    if (typeof url !== 'string') return '';
    
    // Remove dangerous protocols
    const sanitized = url
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/file:/gi, '');
    
    // Validate URL format
    try {
      const urlObj = new URL(sanitized);
      
      // Only allow http, https, and mailto protocols
      if (!['http:', 'https:', 'mailto:'].includes(urlObj.protocol)) {
        return '';
      }
      
      return urlObj.toString();
    } catch (error) {
      return '';
    }
  }
  
  /**
   * Deep sanitize object recursively
   */
  static sanitizeObject(obj: any, options: {
    allowHtml?: boolean;
    allowedTags?: string[];
    strictMode?: boolean;
    maxDepth?: number;
  } = {}): any {
    const { maxDepth = 10 } = options;
    
    if (maxDepth <= 0) return obj;
    
    if (typeof obj === 'string') {
      return this.sanitizeInput(obj, options);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, { ...options, maxDepth: maxDepth - 1 }));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeInput(key, { strictMode: true });
        sanitized[sanitizedKey] = this.sanitizeObject(value, { ...options, maxDepth: maxDepth - 1 });
      }
      return sanitized;
    }
    
    return obj;
  }
}

/**
 * Content Security Policy (CSP) utilities
 */
export class CSPManager {
  private static nonces = new Map<string, string>();
  
  /**
   * Generate a cryptographically secure nonce
   */
  static generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    // Use btoa for Edge Runtime compatibility instead of Buffer
    const nonce = typeof Buffer !== 'undefined' 
      ? Buffer.from(array).toString('base64')
      : btoa(String.fromCharCode(...array));
    
    // Store nonce with expiration (5 minutes) - only if setTimeout is available
    if (typeof setTimeout !== 'undefined') {
      const requestId = Math.random().toString(36);
      this.nonces.set(requestId, nonce);
      
      setTimeout(() => {
        this.nonces.delete(requestId);
      }, 5 * 60 * 1000);
    }
    
    return nonce;
  }
  
  /**
   * Validate nonce
   */
  static validateNonce(nonce: string): boolean {
    return Array.from(this.nonces.values()).includes(nonce);
  }
  
  /**
   * Create CSP header with nonce
   */
  static createCSPHeader(nonce: string, options: {
    allowInlineStyles?: boolean;
    allowInlineScripts?: boolean;
    allowEval?: boolean;
    additionalSources?: {
      script?: string[];
      style?: string[];
      img?: string[];
      connect?: string[];
    };
  } = {}): string {
    const {
      allowInlineStyles = false,
      allowInlineScripts = false,
      allowEval = false,
      additionalSources = {},
    } = options;
    
    const directives = [
      "default-src 'self'",
    ];
    
    // Script sources
    let scriptSrc = "'self'";
    if (allowInlineScripts) {
      scriptSrc += ` 'nonce-${nonce}'`;
    }
    if (allowEval) {
      scriptSrc += " 'unsafe-eval'";
    }
    if (additionalSources.script) {
      scriptSrc += ` ${additionalSources.script.join(' ')}`;
    }
    directives.push(`script-src ${scriptSrc}`);
    
    // Style sources
    let styleSrc = "'self'";
    if (allowInlineStyles) {
      styleSrc += ` 'nonce-${nonce}'`;
    }
    if (additionalSources.style) {
      styleSrc += ` ${additionalSources.style.join(' ')}`;
    }
    directives.push(`style-src ${styleSrc}`);
    
    // Image sources
    let imgSrc = "'self' data: https:";
    if (additionalSources.img) {
      imgSrc += ` ${additionalSources.img.join(' ')}`;
    }
    directives.push(`img-src ${imgSrc}`);
    
    // Connect sources (for AJAX, WebSocket, etc.)
    let connectSrc = "'self'";
    if (additionalSources.connect) {
      connectSrc += ` ${additionalSources.connect.join(' ')}`;
    }
    directives.push(`connect-src ${connectSrc}`);
    
    // Other directives
    directives.push(
      "font-src 'self' data:",
      "object-src 'none'",
      "media-src 'self'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    );
    
    return directives.join('; ');
  }
}

/**
 * XSS protection middleware
 */
export function createXSSProtectionMiddleware(options: {
  strictMode?: boolean;
  allowHtml?: boolean;
  allowedTags?: string[];
  logViolations?: boolean;
  blockOnDetection?: boolean;
} = {}) {
  const {
    strictMode = true,
    allowHtml = false,
    allowedTags = [],
    logViolations = true,
    blockOnDetection = true,
  } = options;
  
  return async (request: NextRequest): Promise<NextResponse | null> => {
    try {
      // Skip GET requests (no body to sanitize)
      if (request.method === 'GET') {
        return null;
      }
      
      // Check content type
      const contentType = request.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('application/x-www-form-urlencoded')) {
        return null;
      }
      
      // Parse request body
      let body: any;
      try {
        if (contentType.includes('application/json')) {
          body = await request.json();
        } else {
          const formData = await request.formData();
          body = Object.fromEntries(formData.entries());
        }
      } catch (error) {
        // If body parsing fails, continue without sanitization
        return null;
      }
      
      // Detect XSS in the request body
      const xssResults = detectXSSInObject(body);
      
      if (xssResults.detected) {
        if (logViolations) {
          await AuditLogger.logSecurityViolation('XSS_ATTEMPT_DETECTED', {
            path: new URL(request.url).pathname,
            method: request.method,
            patterns: xssResults.patterns,
            riskLevel: xssResults.maxRisk,
            userAgent: request.headers.get('user-agent'),
            body: JSON.stringify(body).substring(0, 1000), // Truncate for logging
          });
          
          logger.warn('XSS attempt detected', {
            category: 'security',
            path: new URL(request.url).pathname,
            patterns: xssResults.patterns,
            riskLevel: xssResults.maxRisk,
          });
        }
        
        if (blockOnDetection && xssResults.maxRisk === 'high') {
          return new NextResponse(
            JSON.stringify({
              success: false,
              error: {
                code: 'XSS_DETECTED',
                message: 'Potentially malicious content detected',
              },
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }
      
      // Sanitize the request body
      const sanitizedBody = XSSProtection.sanitizeObject(body, {
        strictMode,
        allowHtml,
        allowedTags,
      });
      
      // Create new request with sanitized body
      const sanitizedRequest = new NextRequest(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(sanitizedBody),
      });
      
      // Continue with sanitized request
      return NextResponse.rewrite(sanitizedRequest.url);
      
    } catch (error) {
      logger.error('XSS protection middleware error', error instanceof Error ? error : new Error(String(error)), {
        category: 'security',
        path: new URL(request.url).pathname,
      });
      
      // Don't block request on middleware errors
      return null;
    }
  };
  
  /**
   * Detect XSS in object recursively
   */
  const detectXSSInObject = (obj: any, maxDepth = 10): {
    detected: boolean;
    patterns: string[];
    maxRisk: 'low' | 'medium' | 'high';
  } => {
    if (maxDepth <= 0) return { detected: false, patterns: [], maxRisk: 'low' };
    
    let detected = false;
    const patterns: string[] = [];
    let maxRisk: 'low' | 'medium' | 'high' = 'low';
    
    if (typeof obj === 'string') {
      const _result = XSSProtection.detectXSS(obj);
      if (result.isXSS) {
        detected = true;
        patterns.push(...result.patterns);
        if (result.risk === 'high' || (result.risk === 'medium' && maxRisk === 'low')) {
          maxRisk = result.risk;
        }
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        const _result = detectXSSInObject(item, maxDepth - 1);
        if (result.detected) {
          detected = true;
          patterns.push(...result.patterns);
          if (result.maxRisk === 'high' || (result.maxRisk === 'medium' && maxRisk === 'low')) {
            maxRisk = result.maxRisk;
          }
        }
      }
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        // Check key for XSS
        const keyResult = XSSProtection.detectXSS(key);
        if (keyResult.isXSS) {
          detected = true;
          patterns.push(...keyResult.patterns);
        }
        
        // Check value for XSS
        const valueResult = detectXSSInObject(value, maxDepth - 1);
        if (valueResult.detected) {
          detected = true;
          patterns.push(...valueResult.patterns);
          if (valueResult.maxRisk === 'high' || (valueResult.maxRisk === 'medium' && maxRisk === 'low')) {
            maxRisk = valueResult.maxRisk;
          }
        }
      }
    }
    
    return { detected, patterns, maxRisk };
  };
}