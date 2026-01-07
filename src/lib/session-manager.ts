/**
 * Session Manager
 * 
 * Manages user sessions using Redis with:
 * - Sliding window expiration (24 hours of inactivity)
 * - Absolute expiration (7 days maximum)
 * - Session validation and refresh
 * - Secure session token generation
 * 
 * Requirements: 2.2, 2.3, 7.1, 7.2, 7.6, 7.7
 */

import { randomBytes } from 'crypto';
import { getRedisClient } from './redis';
import { logger } from './logger';

/**
 * Session data structure
 */
export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

/**
 * Session creation options
 */
export interface SessionOptions {
  rememberMe?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  needsRefresh?: boolean;
  reason?: string;
}

export class SessionManager {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly USER_SESSIONS_PREFIX = 'user:sessions:';
  
  // TTL constants (in seconds)
  private static readonly SLIDING_WINDOW_TTL = 24 * 60 * 60; // 24 hours
  private static readonly ABSOLUTE_TTL = 7 * 24 * 60 * 60; // 7 days
  private static readonly REMEMBER_ME_TTL = 30 * 24 * 60 * 60; // 30 days
  
  // Refresh threshold (refresh if less than 20% of TTL remaining)
  private static readonly REFRESH_THRESHOLD = 0.2;

  /**
   * Generate a cryptographically secure session token
   * Requirements: 7.1
   */
  static generateSessionToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Create a new session
   * Requirements: 2.2, 7.2
   */
  static async createSession(
    userId: string,
    userData: Omit<SessionData, 'userId' | 'createdAt' | 'lastAccessedAt' | 'expiresAt'>,
    options: SessionOptions = {}
  ): Promise<string> {
    try {
      const sessionToken = this.generateSessionToken();
      const now = Date.now();
      const ttl = options.rememberMe ? this.REMEMBER_ME_TTL : this.ABSOLUTE_TTL;

      const sessionData: SessionData = {
        userId,
        ...userData,
        createdAt: now,
        lastAccessedAt: now,
        expiresAt: now + (ttl * 1000),
        metadata: options.metadata,
      };

      const client = await getRedisClient();
      const sessionKey = this.getSessionKey(sessionToken);

      // Store session data
      await client.setEx(
        sessionKey,
        ttl,
        JSON.stringify(sessionData)
      );

      // Track user sessions for bulk invalidation
      const userSessionsKey = this.getUserSessionsKey(userId);
      await client.sAdd(userSessionsKey, sessionToken);
      await client.expire(userSessionsKey, ttl);

      logger.info('Session created', {
        userId,
        sessionToken: sessionToken.substring(0, 8) + '...',
        rememberMe: options.rememberMe,
        expiresAt: new Date(sessionData.expiresAt).toISOString(),
      });

      return sessionToken;
    } catch (error) {
      logger.error('Failed to create session', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      throw error;
    }
  }

  /**
   * Get session data
   */
  static async getSession(sessionToken: string): Promise<SessionData | null> {
    try {
      const client = await getRedisClient();
      const sessionKey = this.getSessionKey(sessionToken);

      const data = await client.get(sessionKey);
      if (!data) {
        return null;
      }

      return JSON.parse(data) as SessionData;
    } catch (error) {
      logger.error('Failed to get session', error instanceof Error ? error : new Error(String(error)), {
        sessionToken: sessionToken.substring(0, 8) + '...',
      });
      return null;
    }
  }

  /**
   * Validate session and check if refresh is needed
   * Requirements: 2.3, 7.6, 7.7
   */
  static async validateSession(sessionToken: string): Promise<SessionValidationResult> {
    try {
      const session = await this.getSession(sessionToken);

      if (!session) {
        return {
          valid: false,
          reason: 'Session not found',
        };
      }

      const now = Date.now();

      // Check absolute expiration
      if (now > session.expiresAt) {
        await this.deleteSession(sessionToken);
        return {
          valid: false,
          reason: 'Session expired (absolute timeout)',
        };
      }

      // Check if session needs refresh (less than 20% of TTL remaining)
      const remainingTime = session.expiresAt - now;
      const totalTime = session.expiresAt - session.createdAt;
      const needsRefresh = remainingTime < (totalTime * this.REFRESH_THRESHOLD);

      return {
        valid: true,
        session,
        needsRefresh,
      };
    } catch (error) {
      logger.error('Failed to validate session', error instanceof Error ? error : new Error(String(error)), {
        sessionToken: sessionToken.substring(0, 8) + '...',
      });
      return {
        valid: false,
        reason: 'Validation error',
      };
    }
  }

  /**
   * Refresh session (update last accessed time and extend TTL)
   * Requirements: 7.6
   */
  static async refreshSession(sessionToken: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionToken);
      if (!session) {
        return false;
      }

      const now = Date.now();
      const client = await getRedisClient();
      const sessionKey = this.getSessionKey(sessionToken);

      // Update last accessed time
      session.lastAccessedAt = now;

      // Calculate new TTL (sliding window)
      const timeSinceCreation = now - session.createdAt;
      const absoluteRemaining = session.expiresAt - now;
      const newTTL = Math.min(
        this.SLIDING_WINDOW_TTL,
        Math.floor(absoluteRemaining / 1000)
      );

      if (newTTL <= 0) {
        await this.deleteSession(sessionToken);
        return false;
      }

      // Update session in Redis
      await client.setEx(
        sessionKey,
        newTTL,
        JSON.stringify(session)
      );

      logger.debug('Session refreshed', {
        userId: session.userId,
        sessionToken: sessionToken.substring(0, 8) + '...',
        newTTL,
      });

      return true;
    } catch (error) {
      logger.error('Failed to refresh session', error instanceof Error ? error : new Error(String(error)), {
        sessionToken: sessionToken.substring(0, 8) + '...',
      });
      return false;
    }
  }

  /**
   * Delete a session
   * Requirements: 7.5
   */
  static async deleteSession(sessionToken: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionToken);
      const client = await getRedisClient();
      const sessionKey = this.getSessionKey(sessionToken);

      // Delete session
      await client.del(sessionKey);

      // Remove from user sessions set
      if (session) {
        const userSessionsKey = this.getUserSessionsKey(session.userId);
        await client.sRem(userSessionsKey, sessionToken);

        logger.info('Session deleted', {
          userId: session.userId,
          sessionToken: sessionToken.substring(0, 8) + '...',
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to delete session', error instanceof Error ? error : new Error(String(error)), {
        sessionToken: sessionToken.substring(0, 8) + '...',
      });
      return false;
    }
  }

  /**
   * Delete all sessions for a user
   * Requirements: 7.8
   */
  static async deleteAllUserSessions(userId: string): Promise<number> {
    try {
      const client = await getRedisClient();
      const userSessionsKey = this.getUserSessionsKey(userId);

      // Get all session tokens for user
      const sessionTokens = await client.sMembers(userSessionsKey);

      if (sessionTokens.length === 0) {
        return 0;
      }

      // Delete all sessions
      const deletePromises = sessionTokens.map(token => 
        client.del(this.getSessionKey(token))
      );
      await Promise.all(deletePromises);

      // Clear user sessions set
      await client.del(userSessionsKey);

      logger.info('All user sessions deleted', {
        userId,
        count: sessionTokens.length,
      });

      return sessionTokens.length;
    } catch (error) {
      logger.error('Failed to delete all user sessions', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      return 0;
    }
  }

  /**
   * Get all active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const client = await getRedisClient();
      const userSessionsKey = this.getUserSessionsKey(userId);

      const sessionTokens = await client.sMembers(userSessionsKey);
      
      const sessions = await Promise.all(
        sessionTokens.map(token => this.getSession(token))
      );

      return sessions.filter((s): s is SessionData => s !== null);
    } catch (error) {
      logger.error('Failed to get user sessions', error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      return [];
    }
  }

  /**
   * Update session metadata
   */
  static async updateSessionMetadata(
    sessionToken: string,
    metadata: Record<string, any>
  ): Promise<boolean> {
    try {
      const session = await this.getSession(sessionToken);
      if (!session) {
        return false;
      }

      session.metadata = {
        ...session.metadata,
        ...metadata,
      };

      const client = await getRedisClient();
      const sessionKey = this.getSessionKey(sessionToken);
      const ttl = await client.ttl(sessionKey);

      if (ttl <= 0) {
        return false;
      }

      await client.setEx(sessionKey, ttl, JSON.stringify(session));

      return true;
    } catch (error) {
      logger.error('Failed to update session metadata', error instanceof Error ? error : new Error(String(error)), {
        sessionToken: sessionToken.substring(0, 8) + '...',
      });
      return false;
    }
  }

  /**
   * Get session key for Redis
   */
  private static getSessionKey(sessionToken: string): string {
    return `${this.SESSION_PREFIX}${sessionToken}`;
  }

  /**
   * Get user sessions key for Redis
   */
  private static getUserSessionsKey(userId: string): string {
    return `${this.USER_SESSIONS_PREFIX}${userId}`;
  }
}
