import { createClient } from 'redis';
import crypto from 'crypto';
import { config } from './config';

// Redis client configuration (only if Redis URL is configured)
const redisClient = config.redis.url ? createClient({
  url: config.redis.url,
}) : null;

// Connection event handlers (only if Redis client exists)
if (redisClient) {
  redisClient.on('error', (err) => {
    if (config.app.nodeEnv === 'development') {
      // In development, just log once and suppress further errors
      if (!redisErrorLogged) {
        console.warn('⚠️ Redis not available in development mode');
        redisErrorLogged = true;
      }
    } else {
      console.error('Redis Client Error:', err);
    }
  });

  redisClient.on('connect', () => {
    console.log('✅ Connected to Redis');
    redisErrorLogged = false;
  });

  redisClient.on('disconnect', () => {
    console.log('❌ Disconnected from Redis');
  });
}

let redisErrorLogged = false;

// Connect to Redis
let isConnected = false;

export async function connectRedis() {
  if (!redisClient) {
    if (config.app.nodeEnv === 'development') {
      console.warn('⚠️ Redis not configured in development mode, continuing without Redis');
      return null;
    } else {
      throw new Error('Redis client not configured');
    }
  }
  
  if (!isConnected) {
    try {
      await redisClient.connect();
      isConnected = true;
    } catch {
      if (config.app.nodeEnv === 'development') {
        console.warn('⚠️ Redis connection failed in development mode, continuing without Redis');
        isConnected = false;
        return null;
      } else {
        throw error;
      }
    }
  }
  return redisClient;
}

// Session management utilities
export class SessionService {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly REFRESH_TOKEN_PREFIX = 'refresh:';
  private static readonly MFA_PREFIX = 'mfa:';
  private static readonly RATE_LIMIT_PREFIX = 'rate_limit:';
  private static readonly AUTH_STATUS_PREFIX = 'auth_status:';
  private static readonly FAILED_ATTEMPTS_PREFIX = 'failed_attempts:';
  
  // Session timeout configurations
  private static readonly DEFAULT_SESSION_TIMEOUT = 3600; // 1 hour
  private static readonly EXTENDED_SESSION_TIMEOUT = 28800; // 8 hours
  private static readonly IDLE_TIMEOUT = 1800; // 30 minutes
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 900; // 15 minutes

  /**
   * Store user session
   */
  static async storeSession(userId: string, sessionData: any, expiresIn: number = 3600): Promise<void> {
    const client = await connectRedis();
    if (!client) return; // Skip if Redis not available
    const key = `${this.SESSION_PREFIX}${userId}`;
    await client.setEx(key, expiresIn, JSON.stringify(sessionData));
  }

  /**
   * Get user session
   */
  static async getSession(_userId: string): Promise<any | null> {
    const client = await connectRedis();
    if (!client) return null; // Skip if Redis not available
    const key = `${this.SESSION_PREFIX}${userId}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete user session
   */
  static async deleteSession(_userId: string): Promise<void> {
    const client = await connectRedis();
    const key = `${this.SESSION_PREFIX}${userId}`;
    await client.del(key);
  }

  /**
   * Store refresh token
   */
  static async storeRefreshToken(userId: string, tokenHash: string, expiresIn: number = 604800): Promise<void> {
    const client = await connectRedis();
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}`;
    await client.setEx(key, expiresIn, tokenHash);
  }

  /**
   * Verify refresh token
   */
  static async verifyRefreshToken(userId: string, tokenHash: string): Promise<boolean> {
    const client = await connectRedis();
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}`;
    const storedHash = await client.get(key);
    return storedHash === tokenHash;
  }

  /**
   * Delete refresh token
   */
  static async deleteRefreshToken(_userId: string): Promise<void> {
    const client = await connectRedis();
    const key = `${this.REFRESH_TOKEN_PREFIX}${userId}`;
    await client.del(key);
  }

  /**
   * Store MFA verification code
   */
  static async storeMFACode(userId: string, code: string, expiresIn: number = 300): Promise<void> {
    const client = await connectRedis();
    const key = `${this.MFA_PREFIX}${userId}`;
    await client.setEx(key, expiresIn, code);
  }

  /**
   * Verify MFA code
   */
  static async verifyMFACode(userId: string, code: string): Promise<boolean> {
    const client = await connectRedis();
    const key = `${this.MFA_PREFIX}${userId}`;
    const storedCode = await client.get(key);
    if (storedCode === code) {
      await client.del(key); // Delete after successful verification
      return true;
    }
    return false;
  }

  /**
   * Rate limiting
   */
  static async checkRateLimit(identifier: string, maxAttempts: number = 5, windowSeconds: number = 900): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const client = await connectRedis();
    const key = `${this.RATE_LIMIT_PREFIX}${identifier}`;
    
    const current = await client.get(key);
    const attempts = current ? parseInt(current) : 0;
    
    if (attempts >= maxAttempts) {
      const ttl = await client.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + (ttl * 1000),
      };
    }

    const newAttempts = attempts + 1;
    if (attempts === 0) {
      await client.setEx(key, windowSeconds, newAttempts.toString());
    } else {
      await client.incr(key);
    }

    return {
      allowed: true,
      remaining: maxAttempts - newAttempts,
      resetTime: Date.now() + (windowSeconds * 1000),
    };
  }

  /**
   * Clear rate limit
   */
  static async clearRateLimit(identifier: string): Promise<void> {
    const client = await connectRedis();
    const key = `${this.RATE_LIMIT_PREFIX}${identifier}`;
    await client.del(key);
  }

  /**
   * Store enhanced session with timeout and activity tracking
   */
  static async storeEnhancedSession(
    userId: string, 
    sessionData: any, 
    options: {
      expiresIn?: number;
      extendedSession?: boolean;
      rememberMe?: boolean;
    } = {}
  ): Promise<void> {
    const client = await connectRedis();
    const key = `${this.SESSION_PREFIX}${userId}`;
    
    const enhancedSessionData = {
      ...sessionData,
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      extended_session: options.extendedSession || false,
      remember_me: options.rememberMe || false,
      session_id: crypto.randomUUID(),
    };

    let expiresIn = options.expiresIn || this.DEFAULT_SESSION_TIMEOUT;
    
    if (options.extendedSession) {
      expiresIn = this.EXTENDED_SESSION_TIMEOUT;
    }
    
    if (options.rememberMe) {
      expiresIn = 604800; // 7 days
    }

    await client.setEx(key, expiresIn, JSON.stringify(enhancedSessionData));
  }

  /**
   * Update session activity timestamp
   */
  static async updateSessionActivity(_userId: string): Promise<boolean> {
    const client = await connectRedis();
    const key = `${this.SESSION_PREFIX}${userId}`;
    
    const sessionData = await client.get(key);
    if (!sessionData) {
      return false;
    }

    const session = JSON.parse(sessionData);
    session.last_activity = new Date().toISOString();

    const ttl = await client.ttl(key);
    if (ttl > 0) {
      await client.setEx(key, ttl, JSON.stringify(session));
      return true;
    }

    return false;
  }

  /**
   * Check if session is idle and needs re-authentication
   */
  static async checkSessionIdleTimeout(_userId: string): Promise<{ 
    isValid: boolean; 
    needsReauth: boolean; 
    timeRemaining?: number 
  }> {
    const client = await connectRedis();
    const key = `${this.SESSION_PREFIX}${userId}`;
    
    const sessionData = await client.get(key);
    if (!sessionData) {
      return { isValid: false, needsReauth: true };
    }

    const session = JSON.parse(sessionData);
    const lastActivity = new Date(session.last_activity);
    const now = new Date();
    const idleTime = (now.getTime() - lastActivity.getTime()) / 1000;

    if (idleTime > this.IDLE_TIMEOUT) {
      return { 
        isValid: true, 
        needsReauth: true,
        timeRemaining: 0
      };
    }

    return { 
      isValid: true, 
      needsReauth: false,
      timeRemaining: this.IDLE_TIMEOUT - idleTime
    };
  }

  /**
   * Store authentication status for middleware checking
   */
  static async storeAuthStatus(
    userId: string, 
    status: 'authenticated' | 'needs_mfa' | 'locked' | 'expired',
    metadata: any = {}
  ): Promise<void> {
    const client = await connectRedis();
    const key = `${this.AUTH_STATUS_PREFIX}${userId}`;
    
    const authStatus = {
      status,
      timestamp: new Date().toISOString(),
      metadata,
    };

    await client.setEx(key, 3600, JSON.stringify(authStatus));
  }

  /**
   * Get authentication status
   */
  static async getAuthStatus(_userId: string): Promise<{
    status: 'authenticated' | 'needs_mfa' | 'locked' | 'expired' | 'unknown';
    timestamp?: string;
    metadata?: any;
  }> {
    const client = await connectRedis();
    const key = `${this.AUTH_STATUS_PREFIX}${userId}`;
    
    const data = await client.get(key);
    if (!data) {
      return { status: 'unknown' };
    }

    return JSON.parse(data);
  }

  /**
   * Track failed authentication attempts
   */
  static async trackFailedAttempt(
    identifier: string, 
    attemptData: {
      userId?: string;
      email?: string;
      ipAddress?: string;
      userAgent?: string;
      attemptType: 'login' | 'mfa' | 'backup_code';
      reason: string;
    }
  ): Promise<{ 
    attemptCount: number; 
    isLocked: boolean; 
    lockoutTimeRemaining?: number 
  }> {
    const client = await connectRedis();
    const key = `${this.FAILED_ATTEMPTS_PREFIX}${identifier}`;
    
    // Get current attempts
    const currentData = await client.get(key);
    const attempts = currentData ? JSON.parse(currentData) : { count: 0, attempts: [] };
    
    // Add new attempt
    attempts.count += 1;
    attempts.attempts.push({
      ...attemptData,
      timestamp: new Date().toISOString(),
    });

    // Keep only recent attempts (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    attempts.attempts = attempts.attempts.filter(
      (attempt: any) => new Date(attempt.timestamp) > oneDayAgo
    );
    attempts.count = attempts.attempts.length;

    // Check if account should be locked
    const isLocked = attempts.count >= this.MAX_FAILED_ATTEMPTS;
    let lockoutTimeRemaining = 0;

    if (isLocked) {
      const ttl = await client.ttl(key);
      lockoutTimeRemaining = ttl > 0 ? ttl : this.LOCKOUT_DURATION;
      await client.setEx(key, this.LOCKOUT_DURATION, JSON.stringify(attempts));
    } else {
      await client.setEx(key, 86400, JSON.stringify(attempts)); // 24 hours
    }

    return {
      attemptCount: attempts.count,
      isLocked,
      lockoutTimeRemaining: isLocked ? lockoutTimeRemaining : undefined,
    };
  }

  /**
   * Clear failed attempts on successful authentication
   */
  static async clearFailedAttempts(identifier: string): Promise<void> {
    const client = await connectRedis();
    const key = `${this.FAILED_ATTEMPTS_PREFIX}${identifier}`;
    await client.del(key);
  }

  /**
   * Check if identifier is currently locked due to failed attempts
   */
  static async isLocked(identifier: string): Promise<{ 
    isLocked: boolean; 
    timeRemaining?: number;
    attemptCount?: number;
  }> {
    const client = await connectRedis();
    const key = `${this.FAILED_ATTEMPTS_PREFIX}${identifier}`;
    
    const data = await client.get(key);
    if (!data) {
      return { isLocked: false };
    }

    const attempts = JSON.parse(data);
    const isLocked = attempts.count >= this.MAX_FAILED_ATTEMPTS;
    
    if (isLocked) {
      const ttl = await client.ttl(key);
      return {
        isLocked: true,
        timeRemaining: ttl > 0 ? ttl : 0,
        attemptCount: attempts.count,
      };
    }

    return { 
      isLocked: false, 
      attemptCount: attempts.count 
    };
  }

  /**
   * Force session expiration (for security events)
   */
  static async expireSession(userId: string, reason: string = 'security_event'): Promise<void> {
    const client = await connectRedis();
    
    // Delete session
    await this.deleteSession(userId);
    
    // Delete refresh token
    await this.deleteRefreshToken(userId);
    
    // Update auth status
    await this.storeAuthStatus(userId, 'expired', { reason, timestamp: new Date().toISOString() });
  }

  /**
   * Get all active sessions for a user (for security monitoring)
   */
  static async getActiveSessions(_userId: string): Promise<any[]> {
    const client = await connectRedis();
    const pattern = `${this.SESSION_PREFIX}${userId}*`;
    
    const keys = await client.keys(pattern);
    const sessions = [];
    
    for (const key of keys) {
      const data = await client.get(key);
      if (data) {
        sessions.push(JSON.parse(data));
      }
    }
    
    return sessions;
  }
}

export { redisClient };
export default redisClient;