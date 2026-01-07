/**
 * Session Service Compatibility Layer
 * 
 * Provides stub implementations of SessionService methods for development.
 * This allows the app to start while the full implementation is being developed.
 */

import { SessionManager } from './session-manager';

export class SessionService {
  // Delegate to SessionManager where possible
  static getSession = SessionManager.getSession.bind(SessionManager);
  static deleteSession = SessionManager.deleteSession.bind(SessionManager);
  
  // Stub implementations for missing methods
  static async isLocked(_key: string): Promise<{ isLocked: boolean; attemptCount?: number; timeRemaining?: number }> {
    return { isLocked: false };
  }
  
  static async checkRateLimit(_key: string, _maxRequests: number, _windowSeconds: number): Promise<{ allowed: boolean; remaining?: number; resetTime?: number }> {
    return { allowed: true, remaining: 100, resetTime: Date.now() + 900000 };
  }
  
  static async trackFailedAttempt(_key: string, _data: any): Promise<void> {
    // Stub - no-op
  }
  
  static async storeMFACode(_userId: string, _code: string, _ttl: number): Promise<void> {
    // Stub - no-op
  }
  
  static async storeAuthStatus(_userId: string, _status: string, _data?: any): Promise<void> {
    // Stub - no-op
  }
  
  static async getAuthStatus(_userId: string): Promise<{ status: string; data?: any }> {
    return { status: 'authenticated' };
  }
  
  static async storeEnhancedSession(_userId: string, _data: any, _options?: any): Promise<void> {
    // Stub - no-op
  }
  
  static async storeRefreshToken(_userId: string, _token: string, _ttl: number): Promise<void> {
    // Stub - no-op
  }
  
  static async verifyRefreshToken(_userId: string, _token: string): Promise<boolean> {
    return true;
  }
  
  static async deleteRefreshToken(_userId: string): Promise<void> {
    // Stub - no-op
  }
  
  static async clearRateLimit(_key: string): Promise<void> {
    // Stub - no-op
  }
  
  static async clearFailedAttempts(_key: string): Promise<void> {
    // Stub - no-op
  }
  
  static async checkSessionIdleTimeout(_userId: string): Promise<{ isValid: boolean; needsReauth?: boolean; timeRemaining?: number }> {
    return { isValid: true, needsReauth: false, timeRemaining: 3600 };
  }
  
  static async updateSessionActivity(_userId: string): Promise<boolean> {
    return true;
  }
  
  static async storeSession(_key: string, _data: any, _ttl: number): Promise<void> {
    // Stub - no-op
  }
  
  static async verifyMFACode(_userId: string, _code: string): Promise<boolean> {
    return true;
  }
}
