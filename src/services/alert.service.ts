import { eq, and, desc, asc, gte, lte, inArray, sql, count } from 'drizzle-orm';
import { getTenantDatabase } from '@/lib/tenant-schema';
import { alerts } from '../../database/schemas/tenant';
import { reportCacheService } from './reports/ReportCacheService';
import {
  Alert,
  AlertFilters,
  AlertSeverity,
  AlertCategory,
  AlertStatus,
  ApiResponse,
  TicketCategory,
  TicketSeverity,
  TicketPriority,
} from '@/types';

export interface AlertAutomationRule {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  conditions: {
    severity?: AlertSeverity[];
    category?: AlertCategory[];
    source?: string[];
    keywords?: string[];
  };
  actions: {
    create_ticket?: boolean;
    assign_to?: string;
    notify_users?: string[];
    escalate_after_minutes?: number;
  };
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AlertCorrelationRule {
  id: string;
  tenant_id: string;
  name: string;
  time_window_minutes: number;
  conditions: {
    same_source?: boolean;
    same_category?: boolean;
    similar_title?: boolean;
    metadata_keys?: string[];
  };
  action: 'merge' | 'suppress' | 'escalate';
  is_active: boolean;
}

export interface WebhookEndpoint {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  secret?: string;
  source_type: 'siem' | 'threat_lake' | 'custom';
  is_active: boolean;
  last_used?: Date;
  created_at: Date;
}

export class AlertService {
  /**
   * Create a new alert
   */
  static async createAlert(
    tenantId: string,
    alertData: Omit<Alert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>
  ): Promise<ApiResponse<Alert>> {
    try {
      // Use mock database in development
      if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
        const { mockDb } = await import('@/lib/mock-database');
        const newAlert = await mockDb.createAlert(tenantId, alertData);

        // Check for automation rules
        await this.processAutomationRules(tenantId, newAlert);

        // Check for correlation/deduplication
        await this.processCorrelationRules(tenantId, newAlert);

        // Invalidate report cache for new alert
        await reportCacheService.invalidateCache({
          tenantId,
          trigger: 'new_alerts'
        });

        return {
          success: true,
          data: newAlert,
        };
      }

      const db = await getTenantDatabase(tenantId);

      const [newAlert] = await db
        .insert(alerts)
        .values({
          tenant_id: tenantId,
          ...alertData,
        })
        .returning();

      // Check for automation rules
      await this.processAutomationRules(tenantId, newAlert as Alert);

      // Check for correlation/deduplication
      await this.processCorrelationRules(tenantId, newAlert as Alert);

      // Invalidate report cache for new alert
      await reportCacheService.invalidateCache({
        tenantId,
        trigger: 'new_alerts'
      });

      return {
        success: true,
        data: newAlert as Alert,
      };
    } catch (error) {
      console.error('Error creating alert:', error);
      return {
        success: false,
        error: {
          code: 'ALERT_CREATE_ERROR',
          message: 'Failed to create alert',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      };
    }
  }

  /**
   * Get alerts with filtering and pagination
   */
  static async getAlerts(
    tenantId: string,
    filters: AlertFilters = {}
  ): Promise<ApiResponse<{ alerts: Alert[]; total: number }>> {
    try {
      // Use mock database in development
      if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
        const { mockDb } = await import('@/lib/mock-database');
        const result = await mockDb.getAlerts(tenantId, filters);
        return {
          success: true,
          data: result,
          meta: {
            total: result.total,
            page: filters.page || 1,
            limit: filters.limit || 50,
          },
        };
      }

      const db = await getTenantDatabase(tenantId);
      const {
        page = 1,
        limit = 50,
        sort_by = 'created_at',
        sort_order = 'desc',
        severity,
        category,
        status,
        source,
        created_after,
        created_before,
      } = filters;

      // Build where conditions
      const conditions = [eq(alerts.tenant_id, tenantId)];

      if (severity?.length) {
        conditions.push(inArray(alerts.severity, severity));
      }

      if (category?.length) {
        conditions.push(inArray(alerts.category, category));
      }

      if (status?.length) {
        conditions.push(inArray(alerts.status, status));
      }

      if (source?.length) {
        conditions.push(inArray(alerts.source, source));
      }

      if (created_after) {
        conditions.push(gte(alerts.created_at, created_after));
      }

      if (created_before) {
        conditions.push(lte(alerts.created_at, created_before));
      }

      const whereClause = and(...conditions);

      // Get total count
      const [{ total }] = await db
        .select({ total: count() })
        .from(alerts)
        .where(whereClause);

      // Get alerts with pagination
      const offset = (page - 1) * limit;
      const orderByFn = sort_order === 'desc' ? desc : asc;

      let sortColumn;
      switch (sort_by) {
        case 'severity':
          sortColumn = alerts.severity;
          break;
        case 'category':
          sortColumn = alerts.category;
          break;
        case 'status':
          sortColumn = alerts.status;
          break;
        case 'source':
          sortColumn = alerts.source;
          break;
        case 'title':
          sortColumn = alerts.title;
          break;
        default:
          sortColumn = alerts.created_at;
      }

      const alertList = await db
        .select()
        .from(alerts)
        .where(whereClause)
        .orderBy(orderByFn(sortColumn))
        .limit(limit)
        .offset(offset);

      return {
        success: true,
        data: {
          alerts: alertList as Alert[],
          total: Number(total),
        },
        meta: {
          total: Number(total),
          page,
          limit,
        },
      };
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return {
        success: false,
        error: {
          code: 'ALERT_FETCH_ERROR',
          message: 'Failed to fetch alerts',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      };
    }
  }

  /**
   * Get alert by ID
   */
  static async getAlertById(
    tenantId: string,
    alertId: string
  ): Promise<ApiResponse<Alert>> {
    try {
      // Use mock database in development
      if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
        const { mockDb } = await import('@/lib/mock-database');
        const alert = await mockDb.getAlertById(tenantId, alertId);
        if (!alert) {
          return {
            success: false,
            error: {
              code: 'ALERT_NOT_FOUND',
              message: 'Alert not found',
            },
          };
        }
        return {
          success: true,
          data: alert,
        };
      }

      const db = await getTenantDatabase(tenantId);

      const [alert] = await db
        .select()
        .from(alerts)
        .where(and(eq(alerts.id, alertId), eq(alerts.tenant_id, tenantId)));

      if (!alert) {
        return {
          success: false,
          error: {
            code: 'ALERT_NOT_FOUND',
            message: 'Alert not found',
          },
        };
      }

      return {
        success: true,
        data: alert as Alert,
      };
    } catch (error) {
      console.error('Error fetching alert:', error);
      return {
        success: false,
        error: {
          code: 'ALERT_FETCH_ERROR',
          message: 'Failed to fetch alert',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      };
    }
  }

  /**
   * Update alert status
   */
  static async updateAlertStatus(
    tenantId: string,
    alertId: string,
    status: AlertStatus,
    metadata?: Record<string, any>
  ): Promise<ApiResponse<Alert>> {
    try {
      // Use mock database in development
      if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
        const { mockDb } = await import('@/lib/mock-database');
        const updatedAlert = await mockDb.updateAlertStatus(tenantId, alertId, status);
        if (!updatedAlert) {
          return {
            success: false,
            error: {
              code: 'ALERT_NOT_FOUND',
              message: 'Alert not found',
            },
          };
        }

        // Update metadata if provided
        if (metadata) {
          updatedAlert.metadata = { ...updatedAlert.metadata, ...metadata };
        }

        // Invalidate report cache for alert resolution
        await reportCacheService.invalidateCache({
          tenantId,
          trigger: 'alert_resolution'
        });

        return {
          success: true,
          data: updatedAlert,
        };
      }

      const db = await getTenantDatabase(tenantId);

      // Get current alert to merge metadata
      const [currentAlert] = await db
        .select()
        .from(alerts)
        .where(and(eq(alerts.id, alertId), eq(alerts.tenant_id, tenantId)));

      if (!currentAlert) {
        return {
          success: false,
          error: {
            code: 'ALERT_NOT_FOUND',
            message: 'Alert not found',
          },
        };
      }

      // Merge metadata if provided
      const updatedMetadata = metadata
        ? { ...currentAlert.metadata, ...metadata }
        : currentAlert.metadata;

      const [updatedAlert] = await db
        .update(alerts)
        .set({
          status,
          metadata: updatedMetadata,
          updated_at: new Date(),
        })
        .where(and(eq(alerts.id, alertId), eq(alerts.tenant_id, tenantId)))
        .returning();

      // Invalidate report cache for alert resolution
      await reportCacheService.invalidateCache({
        tenantId,
        trigger: 'alert_resolution'
      });

      return {
        success: true,
        data: updatedAlert as Alert,
      };
    } catch (error) {
      console.error('Error updating alert status:', error);
      return {
        success: false,
        error: {
          code: 'ALERT_UPDATE_ERROR',
          message: 'Failed to update alert status',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      };
    }
  }

  /**
   * Escalate alert to incident
   */
  static async escalateToIncident(
    tenantId: string,
    alertId: string,
    incidentId: string,
    escalatedBy: string
  ): Promise<ApiResponse<Alert>> {
    try {
      const escalationMetadata = {
        escalated_to_incident: incidentId,
        escalated_by: escalatedBy,
        escalated_at: new Date().toISOString(),
      };

      return await this.updateAlertStatus(
        tenantId,
        alertId,
        AlertStatus.INVESTIGATING,
        escalationMetadata
      );
    } catch (error) {
      console.error('Error escalating alert to incident:', error);
      return {
        success: false,
        error: {
          code: 'ESCALATION_ERROR',
          message: 'Failed to escalate alert to incident',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      };
    }
  }

  /**
   * Bulk create alerts (for webhook ingestion)
   */
  static async bulkCreateAlerts(
    tenantId: string,
    alertsData: Omit<Alert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>[]
  ): Promise<ApiResponse<Alert[]>> {
    try {
      // Use mock database in development
      if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
        const { mockDb } = await import('@/lib/mock-database');
        const newAlerts = await mockDb.bulkCreateAlerts(tenantId, alertsData);

        // Process automation rules for each alert
        for (const alert of newAlerts) {
          await this.processAutomationRules(tenantId, alert);
          await this.processCorrelationRules(tenantId, alert);
        }

        // Invalidate report cache for new alerts
        await reportCacheService.invalidateCache({
          tenantId,
          trigger: 'new_alerts'
        });

        return {
          success: true,
          data: newAlerts,
        };
      }

      const db = await getTenantDatabase(tenantId);

      const alertsToInsert = alertsData.map(alert => ({
        tenant_id: tenantId,
        ...alert,
      }));

      const newAlerts = await db
        .insert(alerts)
        .values(alertsToInsert)
        .returning();

      // Process automation rules for each alert
      for (const alert of newAlerts) {
        await this.processAutomationRules(tenantId, alert as Alert);
        await this.processCorrelationRules(tenantId, alert as Alert);
      }

      // Invalidate report cache for new alerts
      await reportCacheService.invalidateCache({
        tenantId,
        trigger: 'new_alerts'
      });

      return {
        success: true,
        data: newAlerts as Alert[],
      };
    } catch (error) {
      console.error('Error bulk creating alerts:', error);
      return {
        success: false,
        error: {
          code: 'ALERT_BULK_CREATE_ERROR',
          message: 'Failed to bulk create alerts',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      };
    }
  }

  /**
   * Get alert statistics for dashboard
   */
  static async getAlertStats(tenantId: string): Promise<ApiResponse<{
    total: number;
    critical: number;
    high: number;
    unresolved: number;
    by_severity: Record<AlertSeverity, number>;
    by_category: Record<AlertCategory, number>;
    recent_alerts: Alert[];
  }>> {
    try {
      // Use mock database in development
      if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
        const { mockDb } = await import('@/lib/mock-database');
        const stats = await mockDb.getAlertStats(tenantId);
        return {
          success: true,
          data: stats,
        };
      }

      const db = await getTenantDatabase(tenantId);

      // Get total counts
      const [totalResult] = await db
        .select({ count: count() })
        .from(alerts)
        .where(eq(alerts.tenant_id, tenantId));

      const [criticalResult] = await db
        .select({ count: count() })
        .from(alerts)
        .where(and(
          eq(alerts.tenant_id, tenantId),
          eq(alerts.severity, 'critical')
        ));

      const [highResult] = await db
        .select({ count: count() })
        .from(alerts)
        .where(and(
          eq(alerts.tenant_id, tenantId),
          eq(alerts.severity, 'high')
        ));

      const [unresolvedResult] = await db
        .select({ count: count() })
        .from(alerts)
        .where(and(
          eq(alerts.tenant_id, tenantId),
          inArray(alerts.status, ['open', 'investigating'])
        ));

      // Get severity distribution
      const severityStats = await db
        .select({
          severity: alerts.severity,
          count: count(),
        })
        .from(alerts)
        .where(eq(alerts.tenant_id, tenantId))
        .groupBy(alerts.severity);

      // Get category distribution
      const categoryStats = await db
        .select({
          category: alerts.category,
          count: count(),
        })
        .from(alerts)
        .where(eq(alerts.tenant_id, tenantId))
        .groupBy(alerts.category);

      // Get recent alerts
      const recentAlerts = await db
        .select()
        .from(alerts)
        .where(eq(alerts.tenant_id, tenantId))
        .orderBy(desc(alerts.created_at))
        .limit(10);

      // Format results
      const by_severity = severityStats.reduce((acc, stat) => {
        acc[stat.severity] = Number(stat.count);
        return acc;
      }, {} as Record<AlertSeverity, number>);

      const by_category = categoryStats.reduce((acc, stat) => {
        acc[stat.category] = Number(stat.count);
        return acc;
      }, {} as Record<AlertCategory, number>);

      return {
        success: true,
        data: {
          total: Number(totalResult.count),
          critical: Number(criticalResult.count),
          high: Number(highResult.count),
          unresolved: Number(unresolvedResult.count),
          by_severity,
          by_category,
          recent_alerts: recentAlerts as Alert[],
        },
      };
    } catch (error) {
      console.error('Error fetching alert stats:', error);
      return {
        success: false,
        error: {
          code: 'ALERT_STATS_ERROR',
          message: 'Failed to fetch alert statistics',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      };
    }
  }

  /**
   * Generate mock alerts for demonstration
   */
  static async generateMockAlerts(tenantId: string, count: number = 50): Promise<ApiResponse<Alert[]>> {
    const mockSources = ['Splunk', 'QRadar', 'Sentinel', 'CrowdStrike', 'SentinelOne', 'Threat Lake'];
    const mockTitles = [
      'Suspicious login attempt detected',
      'Malware signature detected',
      'Unusual network traffic pattern',
      'Failed authentication attempts',
      'Privilege escalation detected',
      'Data exfiltration attempt',
      'Phishing email detected',
      'Unauthorized access attempt',
      'Anomalous user behavior',
      'Security policy violation',
    ];

    const mockAlerts: Omit<Alert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>[] = [];

    for (let i = 0; i < count; i++) {
      const severities = [AlertSeverity.INFO, AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL];
      const categories = [AlertCategory.MALWARE, AlertCategory.PHISHING, AlertCategory.INTRUSION, AlertCategory.DATA_BREACH, AlertCategory.POLICY_VIOLATION, AlertCategory.ANOMALY];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const source = mockSources[Math.floor(Math.random() * mockSources.length)];
      const title = mockTitles[Math.floor(Math.random() * mockTitles.length)];

      mockAlerts.push({
        source,
        title,
        description: `${title} from ${source}. This is a mock alert generated for demonstration purposes.`,
        severity,
        category,
        status: Math.random() > 0.7 ? AlertStatus.RESOLVED : AlertStatus.OPEN,
        metadata: {
          source_ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          event_id: `EVT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          confidence: Math.floor(Math.random() * 100),
        },
      });
    }

    return this.bulkCreateAlerts(tenantId, mockAlerts);
  }

  /**
   * Process automation rules for an alert
   */
  private static async processAutomationRules(tenantId: string, alert: Alert): Promise<void> {
    // Skip automation in development mode with mock database
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      console.log(`Skipping automation rules for alert ${alert.id} in development mode`);
      return;
    }

    // This would typically fetch automation rules from database and process them
    // For now, we'll implement basic logic

    // Example: Auto-create ticket for critical alerts
    if (alert.severity === AlertSeverity.CRITICAL) {
      try {
        const { TicketService } = await import('./ticket.service');
        await TicketService.createTicket(tenantId, 'system', {
          requester: 'system',
          title: `Critical Alert: ${alert.title}`,
          description: `Auto-generated ticket from critical alert:\n\n${alert.description}\n\nSource: ${alert.source}\nAlert ID: ${alert.id}`,
          category: TicketCategory.SECURITY_INCIDENT,
          severity: TicketSeverity.CRITICAL,
          priority: TicketPriority.URGENT,
          tags: ['auto-generated', 'alert', alert.category],
        });
      } catch (error) {
        console.error('Error auto-creating ticket for alert:', error);
      }
    }
  }

  /**
   * Process correlation rules for deduplication
   */
  private static async processCorrelationRules(tenantId: string, alert: Alert): Promise<void> {
    try {
      // Skip correlation in development mode with mock database
      if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
        console.log(`Skipping correlation rules for alert ${alert.id} in development mode`);
        return;
      }

      const db = await getTenantDatabase(tenantId);

      // Look for similar alerts in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const similarAlerts = await db
        .select()
        .from(alerts)
        .where(and(
          eq(alerts.tenant_id, tenantId),
          eq(alerts.source, alert.source),
          eq(alerts.category, alert.category),
          gte(alerts.created_at, oneHourAgo),
          eq(alerts.status, 'open')
        ))
        .limit(5);

      // If we find similar alerts, we could merge or suppress
      if (similarAlerts.length > 3) {
        console.log(`Found ${similarAlerts.length} similar alerts for correlation`);
        // Implementation would depend on specific correlation rules
      }
    } catch (error) {
      console.error('Error processing correlation rules:', error);
    }
  }
}