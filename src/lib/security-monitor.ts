import { AuditLogger, AuditEventType, AuditResourceType } from './audit-logger';
// import { logger } from './logger';
// import { db } from './database';
import { auditLogs } from '../../database/schemas/main';
import { eq, and, gte, lte, desc, count, sql } from 'drizzle-orm';

/**
 * Security threat levels
 */
export enum ThreatLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Security incident types
 */
export enum SecurityIncidentType {
  BRUTE_FORCE_ATTACK = 'BRUTE_FORCE_ATTACK',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_ABUSE = 'RATE_LIMIT_ABUSE',
  CORS_VIOLATION = 'CORS_VIOLATION',
  INVALID_TOKEN_USAGE = 'INVALID_TOKEN_USAGE',
}

/**
 * Security incident interface
 */
export interface SecurityIncident {
  id: string;
  type: SecurityIncidentType;
  threatLevel: ThreatLevel;
  description: string;
  source: {
    ipAddress: string;
    userAgent: string;
    userId?: string;
    tenantId?: string;
  };
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

/**
 * Security metrics interface
 */
export interface SecurityMetrics {
  totalIncidents: number;
  incidentsByType: Record<SecurityIncidentType, number>;
  incidentsByThreatLevel: Record<ThreatLevel, number>;
  topAttackSources: Array<{
    ipAddress: string;
    count: number;
    lastSeen: Date;
  }>;
  authenticationFailures: number;
  suspiciousActivities: number;
  blockedRequests: number;
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Security monitoring and incident detection service
 */
export class SecurityMonitor {
  private static incidents: Map<string, SecurityIncident> = new Map();
  private static alertThresholds = {
    failedLogins: 5, // per IP per 15 minutes
    xssAttempts: 3, // per IP per hour
    rateLimitViolations: 10, // per IP per hour
    suspiciousPatterns: 5, // per IP per hour
  };
  
  /**
   * Analyze security events and detect incidents
   */
  static async analyzeSecurityEvents(): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
      
      // Detect brute force attacks
      await this.detectBruteForceAttacks(fifteenMinutesAgo, now);
      
      // Detect XSS attempts
      await this.detectXSSAttempts(oneHourAgo, now);
      
      // Detect suspicious activity patterns
      await this.detectSuspiciousPatterns(oneHourAgo, now);
      
      // Detect rate limit abuse
      await this.detectRateLimitAbuse(oneHourAgo, now);
      
      // Clean up old incidents
      this.cleanupOldIncidents();
      
    } catch {
      logger.error('Security monitoring analysis failed', error instanceof Error ? error : new Error(String(error)), {
        category: 'security',
      });
    }
  }
  
  /**
   * Detect brute force attacks based on failed login attempts
   */
  private static async detectBruteForceAttacks(startTime: Date, endTime: Date): Promise<void> {
    try {
      // Query failed login attempts grouped by IP
      const failedLogins = await db
        .select({
          ipAddress: auditLogs.ip_address,
          count: count(),
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, AuditEventType.LOGIN_FAILED),
            gte(auditLogs.created_at, startTime),
            lte(auditLogs.created_at, endTime)
          )
        )
        .groupBy(auditLogs.ip_address)
        .having(sql`count(*) >= ${this.alertThresholds.failedLogins}`);
      
      for (const attack of failedLogins) {
        if (!attack.ipAddress) continue;
        
        const incidentId = `brute_force_${attack.ipAddress}_${Date.now()}`;
        
        if (!this.incidents.has(incidentId)) {
          const incident: SecurityIncident = {
            id: incidentId,
            type: SecurityIncidentType.BRUTE_FORCE_ATTACK,
            threatLevel: attack.count >= 20 ? ThreatLevel.CRITICAL : 
                        attack.count >= 10 ? ThreatLevel.HIGH : ThreatLevel.MEDIUM,
            description: `Brute force attack detected from IP ${attack.ipAddress}`,
            source: {
              ipAddress: attack.ipAddress,
              userAgent: 'Unknown',
            },
            details: {
              failedAttempts: attack.count,
              timeWindow: '15 minutes',
              threshold: this.alertThresholds.failedLogins,
            },
            timestamp: new Date(),
            resolved: false,
          };
          
          this.incidents.set(incidentId, incident);
          await this.reportIncident(incident);
        }
      }
    } catch {
      logger.error('Failed to detect brute force attacks', error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Detect XSS attempts
   */
  private static async detectXSSAttempts(startTime: Date, endTime: Date): Promise<void> {
    try {
      // Query XSS violation events grouped by IP
      const xssAttempts = await db
        .select({
          ipAddress: auditLogs.ip_address,
          count: count(),
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, AuditEventType.SECURITY_VIOLATION),
            sql`details->>'violation' = 'XSS_ATTEMPT_DETECTED'`,
            gte(auditLogs.created_at, startTime),
            lte(auditLogs.created_at, endTime)
          )
        )
        .groupBy(auditLogs.ip_address)
        .having(sql`count(*) >= ${this.alertThresholds.xssAttempts}`);
      
      for (const attack of xssAttempts) {
        if (!attack.ipAddress) continue;
        
        const incidentId = `xss_attempt_${attack.ipAddress}_${Date.now()}`;
        
        if (!this.incidents.has(incidentId)) {
          const incident: SecurityIncident = {
            id: incidentId,
            type: SecurityIncidentType.XSS_ATTEMPT,
            threatLevel: attack.count >= 10 ? ThreatLevel.HIGH : ThreatLevel.MEDIUM,
            description: `Multiple XSS attempts detected from IP ${attack.ipAddress}`,
            source: {
              ipAddress: attack.ipAddress,
              userAgent: 'Unknown',
            },
            details: {
              attempts: attack.count,
              timeWindow: '1 hour',
              threshold: this.alertThresholds.xssAttempts,
            },
            timestamp: new Date(),
            resolved: false,
          };
          
          this.incidents.set(incidentId, incident);
          await this.reportIncident(incident);
        }
      }
    } catch {
      logger.error('Failed to detect XSS attempts', error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Detect suspicious activity patterns
   */
  private static async detectSuspiciousPatterns(startTime: Date, endTime: Date): Promise<void> {
    try {
      // Query for various suspicious activities
      const suspiciousActivities = await db
        .select({
          ipAddress: auditLogs.ip_address,
          action: auditLogs.action,
          count: count(),
        })
        .from(auditLogs)
        .where(
          and(
            sql`action IN ('ACCESS_DENIED', 'CROSS_TENANT_ACCESS_ATTEMPT', 'INVALID_TOKEN')`,
            gte(auditLogs.created_at, startTime),
            lte(auditLogs.created_at, endTime)
          )
        )
        .groupBy(auditLogs.ip_address, auditLogs.action)
        .having(sql`count(*) >= ${this.alertThresholds.suspiciousPatterns}`);
      
      // Group by IP address
      const suspiciousByIP = new Map<string, { actions: string[], totalCount: number }>();
      
      for (const activity of suspiciousActivities) {
        if (!activity.ipAddress) continue;
        
        const existing = suspiciousByIP.get(activity.ipAddress) || { actions: [], totalCount: 0 };
        existing.actions.push(activity.action);
        existing.totalCount += activity.count;
        suspiciousByIP.set(activity.ipAddress, existing);
      }
      
      for (const [ipAddress, data] of suspiciousByIP) {
        const incidentId = `suspicious_activity_${ipAddress}_${Date.now()}`;
        
        if (!this.incidents.has(incidentId)) {
          const incident: SecurityIncident = {
            id: incidentId,
            type: SecurityIncidentType.SUSPICIOUS_ACTIVITY,
            threatLevel: data.totalCount >= 20 ? ThreatLevel.HIGH : ThreatLevel.MEDIUM,
            description: `Suspicious activity pattern detected from IP ${ipAddress}`,
            source: {
              ipAddress,
              userAgent: 'Unknown',
            },
            details: {
              activities: data.actions,
              totalCount: data.totalCount,
              timeWindow: '1 hour',
            },
            timestamp: new Date(),
            resolved: false,
          };
          
          this.incidents.set(incidentId, incident);
          await this.reportIncident(incident);
        }
      }
    } catch {
      logger.error('Failed to detect suspicious patterns', error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Detect rate limit abuse
   */
  private static async detectRateLimitAbuse(startTime: Date, endTime: Date): Promise<void> {
    try {
      const rateLimitViolations = await db
        .select({
          ipAddress: auditLogs.ip_address,
          count: count(),
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, AuditEventType.SECURITY_VIOLATION),
            sql`details->>'violation' = 'RATE_LIMIT_EXCEEDED'`,
            gte(auditLogs.created_at, startTime),
            lte(auditLogs.created_at, endTime)
          )
        )
        .groupBy(auditLogs.ip_address)
        .having(sql`count(*) >= ${this.alertThresholds.rateLimitViolations}`);
      
      for (const violation of rateLimitViolations) {
        if (!violation.ipAddress) continue;
        
        const incidentId = `rate_limit_abuse_${violation.ipAddress}_${Date.now()}`;
        
        if (!this.incidents.has(incidentId)) {
          const incident: SecurityIncident = {
            id: incidentId,
            type: SecurityIncidentType.RATE_LIMIT_ABUSE,
            threatLevel: violation.count >= 50 ? ThreatLevel.HIGH : ThreatLevel.MEDIUM,
            description: `Rate limit abuse detected from IP ${violation.ipAddress}`,
            source: {
              ipAddress: violation.ipAddress,
              userAgent: 'Unknown',
            },
            details: {
              violations: violation.count,
              timeWindow: '1 hour',
              threshold: this.alertThresholds.rateLimitViolations,
            },
            timestamp: new Date(),
            resolved: false,
          };
          
          this.incidents.set(incidentId, incident);
          await this.reportIncident(incident);
        }
      }
    } catch {
      logger.error('Failed to detect rate limit abuse', error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Report security incident
   */
  private static async reportIncident(incident: SecurityIncident): Promise<void> {
    try {
      // Log the incident
      logger.error('Security Incident Detected', new Error(incident.description), {
        category: 'security',
        incidentId: incident.id,
        type: incident.type,
        threatLevel: incident.threatLevel,
        source: incident.source,
        details: incident.details,
      });
      
      // Log to audit system
      await AuditLogger.logSecurityViolation(incident.type, {
        incidentId: incident.id,
        threatLevel: incident.threatLevel,
        description: incident.description,
        source: incident.source,
        details: incident.details,
      });
      
      // In production, you would also:
      // - Send alerts to security team
      // - Update SIEM systems
      // - Trigger automated responses (IP blocking, etc.)
      // - Create tickets in incident management system
      
    } catch {
      logger.error('Failed to report security incident', error instanceof Error ? error : new Error(String(error)), {
        incidentId: incident.id,
      });
    }
  }
  
  /**
   * Get security metrics for a time period
   */
  static async getSecurityMetrics(startTime: Date, endTime: Date): Promise<SecurityMetrics> {
    try {
      // Get total incidents
      const totalIncidents = this.incidents.size;
      
      // Count incidents by type
      const incidentsByType: Record<SecurityIncidentType, number> = {} as any;
      const incidentsByThreatLevel: Record<ThreatLevel, number> = {} as any;
      
      // Initialize counters
      Object.values(SecurityIncidentType).forEach(type => {
        incidentsByType[type] = 0;
      });
      Object.values(ThreatLevel).forEach(level => {
        incidentsByThreatLevel[level] = 0;
      });
      
      // Count incidents
      for (const incident of this.incidents.values()) {
        if (incident.timestamp >= startTime && incident.timestamp <= endTime) {
          incidentsByType[incident.type]++;
          incidentsByThreatLevel[incident.threatLevel]++;
        }
      }
      
      // Get top attack sources from audit logs
      const topSources = await db
        .select({
          ipAddress: auditLogs.ip_address,
          count: count(),
          lastSeen: sql<Date>`MAX(${auditLogs.created_at})`,
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, AuditEventType.SECURITY_VIOLATION),
            gte(auditLogs.created_at, startTime),
            lte(auditLogs.created_at, endTime)
          )
        )
        .groupBy(auditLogs.ip_address)
        .orderBy(desc(count()))
        .limit(10);
      
      // Get authentication failures
      const authFailures = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, AuditEventType.LOGIN_FAILED),
            gte(auditLogs.created_at, startTime),
            lte(auditLogs.created_at, endTime)
          )
        );
      
      // Get suspicious activities
      const suspiciousCount = await db
        .select({ count: count() })
        .from(auditLogs)
        .where(
          and(
            sql`action IN ('ACCESS_DENIED', 'CROSS_TENANT_ACCESS_ATTEMPT')`,
            gte(auditLogs.created_at, startTime),
            lte(auditLogs.created_at, endTime)
          )
        );
      
      return {
        totalIncidents,
        incidentsByType,
        incidentsByThreatLevel,
        topAttackSources: topSources.map(source => ({
          ipAddress: source.ipAddress || 'Unknown',
          count: source.count,
          lastSeen: source.lastSeen,
        })),
        authenticationFailures: authFailures[0]?.count || 0,
        suspiciousActivities: suspiciousCount[0]?.count || 0,
        blockedRequests: 0, // Would be calculated from rate limiter logs
        timeRange: {
          start: startTime,
          end: endTime,
        },
      };
    } catch {
      logger.error('Failed to get security metrics', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  /**
   * Get active security incidents
   */
  static getActiveIncidents(): SecurityIncident[] {
    return Array.from(this.incidents.values()).filter(incident => !incident.resolved);
  }
  
  /**
   * Resolve security incident
   */
  static async resolveIncident(incidentId: string, resolvedBy: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (incident) {
      incident.resolved = true;
      incident.resolvedAt = new Date();
      incident.resolvedBy = resolvedBy;
      
      await AuditLogger.logEvent({
        action: AuditEventType.SECURITY_VIOLATION,
        resourceType: AuditResourceType.SYSTEM_SETTING,
        details: {
          action: 'INCIDENT_RESOLVED',
          incidentId,
          resolvedBy,
          type: incident.type,
        },
      });
      
      logger.info('Security incident resolved', {
        category: 'security',
        incidentId,
        resolvedBy,
        type: incident.type,
      });
    }
  }
  
  /**
   * Clean up old incidents (older than 30 days)
   */
  private static cleanupOldIncidents(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    for (const [id, incident] of this.incidents) {
      if (incident.timestamp < thirtyDaysAgo) {
        this.incidents.delete(id);
      }
    }
  }
  
  /**
   * Start security monitoring (call this on application startup)
   */
  static startMonitoring(): void {
    // Only run monitoring in environments that support setInterval
    if (typeof setInterval !== 'undefined') {
      // Run analysis every 5 minutes
      setInterval(() => {
        this.analyzeSecurityEvents().catch(error => {
          logger.error('Security monitoring failed', error instanceof Error ? error : new Error(String(error)));
        });
      }, 5 * 60 * 1000);
      
      logger.info('Security monitoring started', {
        category: 'security',
        interval: '5 minutes',
      });
    }
  }
  
  /**
   * Update alert thresholds
   */
  static updateThresholds(thresholds: Partial<typeof SecurityMonitor.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    
    logger.info('Security alert thresholds updated', {
      category: 'security',
      thresholds: this.alertThresholds,
    });
  }
}

// Start monitoring in production (only in Node.js runtime)
if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
  SecurityMonitor.startMonitoring();
}