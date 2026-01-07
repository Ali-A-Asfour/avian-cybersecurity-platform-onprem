import { eq, and, count, sql, desc, gte, lte } from 'drizzle-orm';
// import { db } from '../lib/database';
import { users, auditLogs } from '../../database/schemas/main';
import { SessionService } from '../lib/session-service-compat';
import { DashboardMetrics, UserRole, AlertSeverity, TicketStatus, TicketSeverity, ComplianceStatus } from '../types';
import { cache, CachePatterns } from '../lib/cache';
import { dbOptimizer, optimizedQuery } from '../lib/database-optimizer';
import { monitoring } from '../lib/monitoring';
// import { logger } from '../lib/logger';

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'list' | 'gauge';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
  is_enabled: boolean;
}

export interface DashboardConfig {
  tenant_id: string;
  user_id?: string; // null for tenant-wide default
  widgets: DashboardWidget[];
  layout: 'default' | 'compact' | 'detailed';
  refresh_interval: number; // seconds
}

export interface AlertSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  unresolved: number;
  recent: Array<{
    id: string;
    title: string;
    severity: AlertSeverity;
    created_at: Date;
  }>;
}

export interface TicketSummary {
  total: number;
  open: number;
  in_progress: number;
  awaiting_response: number;
  overdue: number;
  resolved_today: number;
  by_severity: Record<TicketSeverity, number>;
  recent: Array<{
    id: string;
    title: string;
    severity: TicketSeverity;
    status: TicketStatus;
    assignee?: string;
    created_at: Date;
  }>;
}

export interface ComplianceSummary {
  overall_score: number;
  frameworks_count: number;
  controls_total: number;
  controls_completed: number;
  controls_in_progress: number;
  controls_not_started: number;
  frameworks: Array<{
    id: string;
    name: string;
    score: number;
    controls_completed: number;
    controls_total: number;
  }>;
}

export interface SLASummary {
  response_rate: number;
  resolution_rate: number;
  average_response_time: number; // hours
  average_resolution_time: number; // hours
  breached_tickets: number;
  at_risk_tickets: number;
}

export interface ActivityFeedItem {
  id: string;
  type: 'ticket' | 'alert' | 'compliance' | 'user' | 'system';
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  user?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class DashboardService {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly CACHE_PREFIX = 'dashboard:';

  /**
   * Get ticket summary and metrics with role-based filtering
   */
  static async getTicketSummary(tenantId: string, userRole?: UserRole, userId?: string): Promise<TicketSummary> {
    // Skip caching in development mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      // Return role-specific data
      if (userRole === UserRole.SECURITY_ANALYST) {
        return {
          total: 89,
          open: 15,
          in_progress: 12,
          awaiting_response: 4,
          overdue: 2,
          resolved_today: 8,
          by_severity: {
            critical: 3,
            high: 6,
            medium: 8,
            low: 4,
          },
          recent: [
            {
              id: 'SEC-001',
              title: 'Suspicious login attempt detected',
              severity: TicketSeverity.HIGH,
              status: TicketStatus.NEW,
              assignee: 'John Doe',
              created_at: new Date(Date.now() - 2 * 60 * 1000),
            },
            {
              id: 'SEC-002',
              title: 'Malware detection on workstation',
              severity: TicketSeverity.CRITICAL,
              status: TicketStatus.IN_PROGRESS,
              assignee: 'Jane Smith',
              created_at: new Date(Date.now() - 15 * 60 * 1000),
            },
            {
              id: 'SEC-003',
              title: 'Phishing email reported by user',
              severity: TicketSeverity.MEDIUM,
              status: TicketStatus.AWAITING_RESPONSE,
              assignee: 'Bob Johnson',
              created_at: new Date(Date.now() - 45 * 60 * 1000),
            },
          ],
        };
      } else if (userRole === UserRole.IT_HELPDESK_ANALYST) {
        return {
          total: 67,
          open: 23,
          in_progress: 18,
          awaiting_response: 8,
          overdue: 3,
          resolved_today: 12,
          by_severity: {
            critical: 1,
            high: 4,
            medium: 12,
            low: 15,
          },
          recent: [
            {
              id: 'IT-001',
              title: 'Password reset request',
              severity: TicketSeverity.LOW,
              status: TicketStatus.NEW,
              assignee: 'Alice Cooper',
              created_at: new Date(Date.now() - 10 * 60 * 1000),
            },
            {
              id: 'IT-002',
              title: 'Software installation request',
              severity: TicketSeverity.MEDIUM,
              status: TicketStatus.IN_PROGRESS,
              assignee: 'Mike Johnson',
              created_at: new Date(Date.now() - 30 * 60 * 1000),
            },
            {
              id: 'IT-003',
              title: 'Network connectivity issue',
              severity: TicketSeverity.HIGH,
              status: TicketStatus.AWAITING_RESPONSE,
              assignee: 'Sarah Davis',
              created_at: new Date(Date.now() - 60 * 60 * 1000),
            },
          ],
        };
      }
      
      // Default data for other roles
      return {
        total: 156,
        open: 23,
        in_progress: 18,
        awaiting_response: 7,
        overdue: 4,
        resolved_today: 12,
        by_severity: {
          critical: 3,
          high: 8,
          medium: 15,
          low: 12,
        },
        recent: [
          {
            id: 'TKT-001',
            title: 'Suspicious login attempt detected',
            severity: TicketSeverity.HIGH,
            status: TicketStatus.NEW,
            assignee: 'John Doe',
            created_at: new Date(Date.now() - 2 * 60 * 1000),
          },
          {
            id: 'TKT-002',
            title: 'Malware detection on workstation',
            severity: TicketSeverity.CRITICAL,
            status: TicketStatus.IN_PROGRESS,
            assignee: 'Jane Smith',
            created_at: new Date(Date.now() - 15 * 60 * 1000),
          },
          {
            id: 'TKT-003',
            title: 'Access review for terminated employee',
            severity: TicketSeverity.MEDIUM,
            status: TicketStatus.AWAITING_RESPONSE,
            assignee: 'Bob Johnson',
            created_at: new Date(Date.now() - 45 * 60 * 1000),
          },
        ],
      };
    }

    const cacheKey = `${this.CACHE_PREFIX}tickets:${tenantId}`;
    
    // Try to get from cache first
    return cache.getOrSet(
      cacheKey,
      async () => {
        // This would be the actual database query in production
        return {
          total: 156,
          open: 23,
          in_progress: 18,
          awaiting_response: 7,
          overdue: 4,
          resolved_today: 12,
          by_severity: {
            critical: 3,
            high: 8,
            medium: 15,
            low: 12,
          },
          recent: [],
        };
      },
      {
        ttl: 300, // 5 minutes
        tags: [`tenant:${tenantId}`, 'dashboard', 'tickets'],
      }
    );
    
    const cached = await SessionService.getSession(cacheKey);
    if (cached) {
      return cached;
    }

    // Mock data for production mode
    const summary: TicketSummary = {
      total: 156,
      open: 23,
      in_progress: 18,
      awaiting_response: 7,
      overdue: 4,
      resolved_today: 12,
      by_severity: {
        critical: 3,
        high: 8,
        medium: 15,
        low: 12,
      },
      recent: [
        {
          id: 'TKT-001',
          title: 'Suspicious login attempt detected',
          severity: TicketSeverity.HIGH,
          status: TicketStatus.NEW,
          assignee: 'John Doe',
          created_at: new Date(Date.now() - 2 * 60 * 1000),
        },
        {
          id: 'TKT-002',
          title: 'Malware detection on workstation',
          severity: TicketSeverity.CRITICAL,
          status: TicketStatus.IN_PROGRESS,
          assignee: 'Jane Smith',
          created_at: new Date(Date.now() - 15 * 60 * 1000),
        },
        {
          id: 'TKT-003',
          title: 'Access review for terminated employee',
          severity: TicketSeverity.MEDIUM,
          status: TicketStatus.AWAITING_RESPONSE,
          assignee: 'Bob Johnson',
          created_at: new Date(Date.now() - 45 * 60 * 1000),
        },
      ],
    };

    await SessionService.storeSession(cacheKey, summary, this.CACHE_TTL);
    return summary;
  }

  /**
   * Get alert summary and metrics
   */
  static async getAlertSummary(_tenantId: string): Promise<AlertSummary> {
    // Skip caching in development mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      return {
        total: 1247,
        critical: 7,
        high: 23,
        medium: 89,
        low: 156,
        info: 972,
        unresolved: 119,
        recent: [
          {
            id: 'ALT-001',
            title: 'Multiple failed login attempts',
            severity: AlertSeverity.HIGH,
            created_at: new Date(Date.now() - 5 * 60 * 1000),
          },
          {
            id: 'ALT-002',
            title: 'Unusual network traffic pattern',
            severity: AlertSeverity.MEDIUM,
            created_at: new Date(Date.now() - 12 * 60 * 1000),
          },
          {
            id: 'ALT-003',
            title: 'Security patch available',
            severity: AlertSeverity.INFO,
            created_at: new Date(Date.now() - 30 * 60 * 1000),
          },
        ],
      };
    }

    const cacheKey = `${this.CACHE_PREFIX}alerts:${tenantId}`;
    
    const cached = await SessionService.getSession(cacheKey);
    if (cached) {
      return cached;
    }

    const summary: AlertSummary = {
      total: 1247,
      critical: 7,
      high: 23,
      medium: 89,
      low: 156,
      info: 972,
      unresolved: 119,
      recent: [
        {
          id: 'ALT-001',
          title: 'Multiple failed login attempts',
          severity: AlertSeverity.HIGH,
          created_at: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          id: 'ALT-002',
          title: 'Unusual network traffic pattern',
          severity: AlertSeverity.MEDIUM,
          created_at: new Date(Date.now() - 12 * 60 * 1000),
        },
        {
          id: 'ALT-003',
          title: 'Security patch available',
          severity: AlertSeverity.INFO,
          created_at: new Date(Date.now() - 30 * 60 * 1000),
        },
      ],
    };

    await SessionService.storeSession(cacheKey, summary, this.CACHE_TTL);
    return summary;
  }

  /**
   * Get compliance summary and metrics
   */
  static async getComplianceSummary(_tenantId: string): Promise<ComplianceSummary> {
    // Skip caching in development mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      return {
        overall_score: 87.5,
        frameworks_count: 3,
        controls_total: 245,
        controls_completed: 214,
        controls_in_progress: 23,
        controls_not_started: 8,
        frameworks: [
          {
            id: 'hipaa',
            name: 'HIPAA',
            score: 92.3,
            controls_completed: 89,
            controls_total: 96,
          },
          {
            id: 'iso27001',
            name: 'ISO 27001',
            score: 85.7,
            controls_completed: 96,
            controls_total: 112,
          },
          {
            id: 'pci',
            name: 'PCI DSS',
            score: 81.1,
            controls_completed: 29,
            controls_total: 37,
          },
        ],
      };
    }

    const cacheKey = `${this.CACHE_PREFIX}compliance:${tenantId}`;
    
    const cached = await SessionService.getSession(cacheKey);
    if (cached) {
      return cached;
    }

    const summary: ComplianceSummary = {
      overall_score: 87.5,
      frameworks_count: 3,
      controls_total: 245,
      controls_completed: 214,
      controls_in_progress: 23,
      controls_not_started: 8,
      frameworks: [
        {
          id: 'hipaa',
          name: 'HIPAA',
          score: 92.3,
          controls_completed: 89,
          controls_total: 96,
        },
        {
          id: 'iso27001',
          name: 'ISO 27001',
          score: 85.7,
          controls_completed: 96,
          controls_total: 112,
        },
        {
          id: 'pci',
          name: 'PCI DSS',
          score: 81.1,
          controls_completed: 29,
          controls_total: 37,
        },
      ],
    };

    await SessionService.storeSession(cacheKey, summary, this.CACHE_TTL);
    return summary;
  }

  /**
   * Get SLA summary and metrics
   */
  static async getSLASummary(_tenantId: string): Promise<SLASummary> {
    // Skip caching in development mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      return {
        response_rate: 94.2,
        resolution_rate: 89.7,
        average_response_time: 2.3,
        average_resolution_time: 18.7,
        breached_tickets: 8,
        at_risk_tickets: 15,
      };
    }

    const cacheKey = `${this.CACHE_PREFIX}sla:${tenantId}`;
    
    const cached = await SessionService.getSession(cacheKey);
    if (cached) {
      return cached;
    }

    const summary: SLASummary = {
      response_rate: 94.2,
      resolution_rate: 89.7,
      average_response_time: 2.3,
      average_resolution_time: 18.7,
      breached_tickets: 8,
      at_risk_tickets: 15,
    };

    await SessionService.storeSession(cacheKey, summary, this.CACHE_TTL);
    return summary;
  }

  /**
   * Get activity feed for dashboard
   */
  static async getActivityFeed(
    tenantId: string,
    limit: number = 20
  ): Promise<ActivityFeedItem[]> {
    // Skip caching and database queries in development mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      return [
        {
          id: 'act-001',
          type: 'alert',
          title: 'New critical alert',
          description: 'Suspicious login attempt detected from unknown IP',
          severity: 'critical',
          timestamp: new Date(Date.now() - 2 * 60 * 1000),
        },
        {
          id: 'act-002',
          type: 'ticket',
          title: 'Ticket assigned',
          description: 'Malware detection ticket assigned to security team',
          severity: 'high',
          user: 'system',
          timestamp: new Date(Date.now() - 8 * 60 * 1000),
        },
        {
          id: 'act-003',
          type: 'compliance',
          title: 'Control completed',
          description: 'HIPAA control 164.312(a)(1) marked as completed',
          severity: 'low',
          user: 'compliance-officer',
          timestamp: new Date(Date.now() - 25 * 60 * 1000),
        },
        {
          id: 'act-004',
          type: 'user',
          title: 'User created',
          description: 'New analyst user account created',
          severity: 'low',
          user: 'admin',
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
        },
        {
          id: 'act-005',
          type: 'system',
          title: 'System update',
          description: 'Security patches applied to production systems',
          severity: 'medium',
          user: 'system',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ];
    }

    const cacheKey = `${this.CACHE_PREFIX}activity:${tenantId}:${limit}`;
    
    const cached = await SessionService.getSession(cacheKey);
    if (cached) {
      return cached;
    }

    // Mock activities for production mode
    const activities: ActivityFeedItem[] = [
      {
        id: 'act-001',
        type: 'alert',
        title: 'New critical alert',
        description: 'Suspicious login attempt detected from unknown IP',
        severity: 'critical',
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
      },
      {
        id: 'act-002',
        type: 'ticket',
        title: 'Ticket assigned',
        description: 'Malware detection ticket assigned to security team',
        severity: 'high',
        user: 'system',
        timestamp: new Date(Date.now() - 8 * 60 * 1000),
      },
      {
        id: 'act-003',
        type: 'compliance',
        title: 'Control completed',
        description: 'HIPAA control 164.312(a)(1) marked as completed',
        severity: 'low',
        user: 'compliance-officer',
        timestamp: new Date(Date.now() - 25 * 60 * 1000),
      },
    ];

    await SessionService.storeSession(cacheKey, activities, this.CACHE_TTL);
    return activities;
  }

  /**
   * Get or create dashboard configuration for user/tenant
   */
  static async getDashboardConfig(
    tenantId: string,
    userId?: string
  ): Promise<DashboardConfig> {
    // Skip caching in development mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      return {
        tenant_id: tenantId,
        user_id: userId,
        layout: 'default',
        refresh_interval: 300,
        widgets: [
          {
            id: 'tickets-summary',
            type: 'metric',
            title: 'Tickets Overview',
            position: { x: 0, y: 0, w: 6, h: 4 },
            config: { showTrends: true },
            is_enabled: true,
          },
          {
            id: 'alerts-chart',
            type: 'chart',
            title: 'Alert Severity Distribution',
            position: { x: 6, y: 0, w: 6, h: 4 },
            config: { chartType: 'donut' },
            is_enabled: true,
          },
        ],
      };
    }

    const cacheKey = `${this.CACHE_PREFIX}config:${tenantId}:${userId || 'default'}`;
    
    const cached = await SessionService.getSession(cacheKey);
    if (cached) {
      return cached;
    }

    const defaultConfig: DashboardConfig = {
      tenant_id: tenantId,
      user_id: userId,
      layout: 'default',
      refresh_interval: 300,
      widgets: [
        {
          id: 'tickets-summary',
          type: 'metric',
          title: 'Tickets Overview',
          position: { x: 0, y: 0, w: 6, h: 4 },
          config: { showTrends: true },
          is_enabled: true,
        },
      ],
    };

    await SessionService.storeSession(cacheKey, defaultConfig, 3600);
    return defaultConfig;
  }

  /**
   * Update dashboard configuration
   */
  static async updateDashboardConfig(
    tenantId: string,
    config: Partial<DashboardConfig>,
    userId?: string
  ): Promise<DashboardConfig> {
    const currentConfig = await this.getDashboardConfig(tenantId, userId);
    const updatedConfig = { ...currentConfig, ...config };

    if (process.env.NODE_ENV !== 'development' || process.env.BYPASS_AUTH !== 'true') {
      const cacheKey = `${this.CACHE_PREFIX}config:${tenantId}:${userId || 'default'}`;
      await SessionService.storeSession(cacheKey, updatedConfig, 3600);
    }

    return updatedConfig;
  }

  /**
   * Invalidate dashboard cache for tenant
   */
  static async invalidateCache(_tenantId: string): Promise<void> {
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      return; // Skip cache operations in development
    }
    
    const cacheKey = `${this.CACHE_PREFIX}metrics:${tenantId}`;
    await SessionService.deleteSession(cacheKey);
  }
}