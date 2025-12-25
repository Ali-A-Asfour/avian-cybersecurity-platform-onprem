// Use Web Crypto API exclusively for Edge Runtime compatibility
import { logAuthEvent, AuditAction, AuditResult } from './audit-logger';
import { logger } from './logger';

/**
 * Cryptographic utilities for security operations
 */
export class CryptoUtils {
  /**
   * Generate cryptographically secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate secure token for API keys, session tokens, etc.
   */
  static generateSecureToken(prefix?: string): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    // Convert to base64url manually for Edge Runtime compatibility
    const base64 = typeof Buffer !== 'undefined'
      ? Buffer.from(array).toString('base64')
      : btoa(String.fromCharCode(...array));
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return prefix ? `${prefix}_${base64url}` : base64url;
  }

  /**
   * Hash sensitive data (passwords, tokens, etc.)
   */
  static async hashSensitiveData(data: string, salt?: string): Promise<{
    hash: string;
    salt: string;
  }> {
    const actualSalt = salt || this.generateSecureRandom(16);

    // Use Web Crypto API for Edge Runtime compatibility
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(data),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(actualSalt),
        iterations: 100000,
        hash: 'SHA-512'
      },
      keyMaterial,
      512 // 64 bytes * 8 bits
    );

    const hashArray = new Uint8Array(derivedBits);
    const hash = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');

    return { hash, salt: actualSalt };
  }

  /**
   * Verify hashed data
   */
  static async verifySensitiveData(data: string, hash: string, salt: string): Promise<boolean> {
    try {
      const { hash: computedHash } = await this.hashSensitiveData(data, salt);
      // Simple constant-time comparison
      if (hash.length !== computedHash.length) return false;
      const _result = 0;
      for (let i = 0; i < hash.length; i++) {
        result |= hash.charCodeAt(i) ^ computedHash.charCodeAt(i);
      }
      return result === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Encrypt sensitive data for storage (Web Crypto API compatible)
   */
  static async encryptData(data: string, key?: string): Promise<{
    encrypted: string;
    iv: string;
    key?: string;
  }> {
    const encoder = new TextEncoder();
    const actualKey = key || this.generateSecureRandom(32);

    // Generate IV
    const iv = new Uint8Array(12); // 96-bit IV for AES-GCM
    crypto.getRandomValues(iv);

    // Import key
    const keyBuffer = new Uint8Array(actualKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Encrypt data
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        additionalData: encoder.encode('AVIAN-SECURITY')
      },
      cryptoKey,
      encoder.encode(data)
    );

    const encrypted = Array.from(new Uint8Array(encryptedBuffer), byte =>
      byte.toString(16).padStart(2, '0')).join('');
    const ivHex = Array.from(iv, byte => byte.toString(16).padStart(2, '0')).join('');

    return {
      encrypted,
      iv: ivHex,
      key: key ? undefined : actualKey,
    };
  }

  /**
   * Decrypt sensitive data (Web Crypto API compatible)
   */
  static async decryptData(encryptedData: string, key: string, iv: string): Promise<string> {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // Convert hex strings to Uint8Arrays
    const encryptedBuffer = new Uint8Array(encryptedData.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const ivBuffer = new Uint8Array(iv.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const keyBuffer = new Uint8Array(key.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    // Import key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
        additionalData: encoder.encode('AVIAN-SECURITY')
      },
      cryptoKey,
      encryptedBuffer
    );

    return decoder.decode(decryptedBuffer);
  }

  /**
   * Generate HMAC signature for webhook verification (Web Crypto API)
   */
  static async generateHMAC(data: string, secret: string, algorithm: string = 'SHA-256'): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return Array.from(new Uint8Array(signature), byte =>
      byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify HMAC signature (Web Crypto API)
   */
  static async verifyHMAC(data: string, signature: string, secret: string, algorithm: string = 'SHA-256'): Promise<boolean> {
    try {
      const expectedSignature = await this.generateHMAC(data, secret, algorithm);
      // Simple constant-time comparison
      if (signature.length !== expectedSignature.length) return false;
      const _result = 0;
      for (let i = 0; i < signature.length; i++) {
        result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
      }
      return result === 0;
    } catch (error) {
      return false;
    }
  }
}

/**
 * IP address utilities for security
 */
export class IPUtils {
  /**
   * Check if IP address is in private range
   */
  static isPrivateIP(_ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/,
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Normalize IP address (handle IPv6, proxies, etc.)
   */
  static normalizeIP(_ip: string): string {
    // Remove IPv6 prefix for IPv4-mapped addresses
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }

    // Handle comma-separated IPs from X-Forwarded-For
    if (ip.includes(',')) {
      return ip.split(',')[0].trim();
    }

    return ip.trim();
  }

  /**
   * Check if IP is in blocklist
   */
  static async isBlockedIP(_ip: string): Promise<boolean> {
    // In a real implementation, this would check against:
    // - Internal blocklist database
    // - External threat intelligence feeds
    // - Rate limiting records

    // For now, return false (not blocked)
    return false;
  }

  /**
   * Get geolocation info for IP (for security logging)
   */
  static async getIPGeolocation(_ip: string): Promise<{
    country?: string;
    region?: string;
    city?: string;
    isp?: string;
  }> {
    // In a real implementation, this would use a geolocation service
    // For now, return empty object
    return {};
  }
}

/**
 * Session security utilities
 */
export class SessionSecurity {
  private static activeSessions = new Map<string, {
    userId: string;
    tenantId: string;
    ipAddress: string;
    userAgent: string;
    createdAt: Date;
    lastActivity: Date;
    isValid: boolean;
  }>();

  /**
   * Create secure session
   */
  static createSession(userId: string, tenantId: string, ipAddress: string, userAgent: string): string {
    const sessionId = CryptoUtils.generateSecureToken('sess');

    this.activeSessions.set(sessionId, {
      userId,
      tenantId,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      lastActivity: new Date(),
      isValid: true,
    });

    // Log session creation
    logAuthEvent({
      userId,
      action: AuditAction.LOGIN,
      result: AuditResult.SUCCESS,
      ipAddress,
      userAgent,
      metadata: { sessionId },
    });

    return sessionId;
  }

  /**
   * Validate session
   */
  static validateSession(sessionId: string, ipAddress: string, userAgent: string): {
    valid: boolean;
    userId?: string;
    tenantId?: string;
    reason?: string;
  } {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    if (!session.isValid) {
      return { valid: false, reason: 'Session invalidated' };
    }

    // Check session timeout (24 hours)
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - session.createdAt.getTime() > maxAge) {
      this.invalidateSession(sessionId, 'Session expired');
      return { valid: false, reason: 'Session expired' };
    }

    // Check inactivity timeout (2 hours)
    const inactivityTimeout = 2 * 60 * 60 * 1000;
    if (Date.now() - session.lastActivity.getTime() > inactivityTimeout) {
      this.invalidateSession(sessionId, 'Session inactive');
      return { valid: false, reason: 'Session inactive' };
    }

    // Check IP address consistency (optional, can be disabled for mobile users)
    if (process.env.ENFORCE_IP_CONSISTENCY === 'true' && session.ipAddress !== ipAddress) {
      this.invalidateSession(sessionId, 'IP address changed');
      logAuthEvent({
        userId: session.userId,
        action: AuditAction.SUSPICIOUS_ACTIVITY,
        result: AuditResult.BLOCKED,
        ipAddress,
        userAgent,
        metadata: {
          reason: 'SESSION_IP_MISMATCH',
          sessionId,
          originalIP: session.ipAddress,
          newIP: ipAddress,
        },
      });
      return { valid: false, reason: 'IP address mismatch' };
    }

    // Update last activity
    session.lastActivity = new Date();

    return {
      valid: true,
      userId: session.userId,
      tenantId: session.tenantId,
    };
  }

  /**
   * Invalidate session
   */
  static invalidateSession(sessionId: string, reason: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isValid = false;

      logAuthEvent({
        userId: session.userId,
        action: AuditAction.LOGOUT,
        result: AuditResult.SUCCESS,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        metadata: { sessionId, reason },
      });
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  static invalidateUserSessions(userId: string, reason: string = 'Security action'): void {
    for (const [sessionId, session] of this.activeSessions) {
      if (session.userId === userId) {
        this.invalidateSession(sessionId, reason);
      }
    }
  }

  /**
   * Clean up expired sessions
   */
  static cleanupSessions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    for (const [sessionId, session] of this.activeSessions) {
      if (now - session.createdAt.getTime() > maxAge || !session.isValid) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  /**
   * Get active sessions for a user
   */
  static getUserSessions(_userId: string): Array<{
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    createdAt: Date;
    lastActivity: Date;
  }> {
    const sessions = [];

    for (const [sessionId, session] of this.activeSessions) {
      if (session.userId === userId && session.isValid) {
        sessions.push({
          sessionId,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
        });
      }
    }

    return sessions;
  }
}

/**
 * File security utilities
 */
export class FileSecurity {
  private static readonly DANGEROUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.sh', '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.ps1',
  ];

  private static readonly ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/csv', 'application/json',
    'application/xml', 'application/zip', 'application/x-zip-compressed',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  /**
   * Validate file upload security
   */
  static validateFileUpload(file: {
    name: string;
    size: number;
    type: string;
  }): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check file extension
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (this.DANGEROUS_EXTENSIONS.includes(extension)) {
      errors.push(`File extension ${extension} is not allowed`);
    }

    // Check MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push(`File size ${file.size} exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Check filename for security issues
    if (this.hasUnsafeFilename(file.name)) {
      errors.push('Filename contains unsafe characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for unsafe filename patterns
   */
  private static hasUnsafeFilename(filename: string): boolean {
    // Check for directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return true;
    }

    // Check for null bytes
    if (filename.includes('\0')) {
      return true;
    }

    // Check for control characters
    if (/[\x00-\x1f\x7f]/.test(filename)) {
      return true;
    }

    return false;
  }

  /**
   * Generate secure filename
   */
  static generateSecureFilename(originalName: string, userId: string): string {
    const extension = originalName.substring(originalName.lastIndexOf('.'));
    const timestamp = Date.now();
    const random = CryptoUtils.generateSecureRandom(8);

    return `${userId}_${timestamp}_${random}${extension}`;
  }

  /**
   * Scan file content for malicious patterns (basic implementation)
   */
  static async scanFileContent(content: Buffer): Promise<{
    safe: boolean;
    threats: string[];
  }> {
    const threats: string[] = [];
    const contentStr = content.toString('utf8', 0, Math.min(content.length, 10000)); // First 10KB

    // Check for script tags
    if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(contentStr)) {
      threats.push('Script tags detected');
    }

    // Check for PHP code
    if (/<\?php/gi.test(contentStr)) {
      threats.push('PHP code detected');
    }

    // Check for executable signatures
    if (content.length >= 2) {
      const header = content.readUInt16BE(0);
      if (header === 0x4D5A) { // MZ header (Windows executable)
        threats.push('Windows executable detected');
      }
    }

    return {
      safe: threats.length === 0,
      threats,
    };
  }
}

/**
 * Start security utilities (cleanup tasks, etc.)
 */
export function startSecurityUtils(): void {
  // Only run cleanup in environments that support setInterval
  if (typeof setInterval !== 'undefined') {
    // Clean up expired sessions every hour
    setInterval(() => {
      SessionSecurity.cleanupSessions();
    }, 60 * 60 * 1000);

    logger.info('Security utilities started', {
      category: 'security',
    });
  }
}

// Auto-start in production (only in Node.js runtime)
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
  startSecurityUtils();
}