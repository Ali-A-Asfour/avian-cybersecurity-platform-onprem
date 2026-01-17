/**
 * Alert Manager
 * Centralized alert creation and management for both SonicWall and Defender
 */

import { db } from '@/lib/database';
import { firewallAlerts } from '../../database/schemas/firewall';
import { edrAlerts } from '../../database/schemas/edr';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { 
  CreateAlertInput,
  AlertFilters,
  FirewallAlert,
  AlertSeverity,
  AlertType,
  AlertSource
} from '@/types/firewall';
import { sendAlertNotification } from './alert-notification-service';

export class AlertManager {
  /**
   * Create a new alert with deduplication
   */
  static async createAlert(input: CreateAlertInput): Promise<FirewallAlert> {
    try {
      // Check for duplicate alerts in the last 5 minutes
      const isDuplicate = await this.deduplicateAlert(input);
      if (isDuplicate) {
        console.log(`Duplicate alert suppressed: ${input.alertType} for device ${input.deviceId}`);
        // Return the existing alert instead of creating a new one
        const existingAlerts = await db
          .select()
          .from(firewallAlerts)
          .where(and(
            eq(firewallAlerts.tenantId, input.tenantId),
            eq(firewallAlerts.deviceId, input.deviceId || ''),
            eq(firewallAlerts.alertType, input.alertType),
            gte(firewallAlerts.createdAt, new Date(Date.now() - 5 * 60 * 1000))
          ))
          .orderBy(desc(firewallAlerts.createdAt))
          .limit(1);

        if (existingAlerts.length > 0) {
          return existingAlerts[0] as FirewallAlert;
        }
      }

      // Create new alert
      const [newAlert] = await db
        .insert(firewallAlerts)
        .values({
          tenantId: input.tenantId,
          deviceId: input.deviceId,
          alertType: input.alertType,
          severity: input.severity,
          message: input.message,
          source: input.source,
          metadata: input.metadata || {},
          acknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
          createdAt: new Date(),
        })
        .returning();

      console.log(`Created alert: ${input.alertType} (${input.severity}) for device ${input.deviceId}`);

      // Send notification asynchronously (don't wait for it)
      sendAlertNotification({
        tenantId: input.tenantId,
        alertId: newAlert.id,
        alertTitle: input.alertType,
        alertSeverity: input.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
        alertDescription: input.message,
        alertSource: input.source,
        alertMetadata: input.metadata,
      }).catch(error => {
        console.error('Failed to send alert notification:', error);
        // Don't throw - notification failure shouldn't break alert creation
      });

      return newAlert as FirewallAlert;
    } catch (error) {
      throw new Error(`Failed to create alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check for duplicate alerts to prevent spam
   */
  static async deduplicateAlert(input: CreateAlertInput): Promise<boolean> {
    try {
      // Look for similar alerts in the last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const existingAlerts = await db
        .select()
        .from(firewallAlerts)
        .where(and(
          eq(firewallAlerts.tenantId, input.tenantId),
          eq(firewallAlerts.deviceId, input.deviceId || ''),
          eq(firewallAlerts.alertType, input.alertType),
          gte(firewallAlerts.createdAt, fiveMinutesAgo)
        ))
        .limit(1);

      return existingAlerts.length > 0;
    } catch (error) {
      console.error('Error checking for duplicate alerts:', error);
      return false; // If check fails, allow alert creation
    }
  }

  /**
   * Get alerts with filtering
   */
  static async getAlerts(filters: AlertFilters): Promise<FirewallAlert[]> {
    try {
      const conditions = [eq(firewallAlerts.tenantId, filters.tenantId)];

      // Add filters
      if (filters.deviceId) {
        conditions.push(eq(firewallAlerts.deviceId, filters.deviceId));
      }

      if (filters.severity) {
        if (Array.isArray(filters.severity)) {
          // Multiple severities - need to use OR logic
          const severityConditions = filters.severity.map(sev => eq(firewallAlerts.severity, sev));
          // For now, just use the first severity (Drizzle OR is complex)
          conditions.push(eq(firewallAlerts.severity, filters.severity[0]));
        } else {
          conditions.push(eq(firewallAlerts.severity, filters.severity));
        }
      }

      if (filters.acknowledged !== undefined) {
        conditions.push(eq(firewallAlerts.acknowledged, filters.acknowledged));
      }

      if (filters.alertType) {
        conditions.push(eq(firewallAlerts.alertType, filters.alertType));
      }

      if (filters.source) {
        conditions.push(eq(firewallAlerts.source, filters.source));
      }

      if (filters.startDate) {
        conditions.push(gte(firewallAlerts.createdAt, filters.startDate));
      }

      if (filters.endDate) {
        conditions.push(lte(firewallAlerts.createdAt, filters.endDate));
      }

      // Execute query
      const alerts = await db
        .select()
        .from(firewallAlerts)
        .where(and(...conditions))
        .orderBy(desc(firewallAlerts.createdAt))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0);

      return alerts as FirewallAlert[];
    } catch (error) {
      throw new Error(`Failed to get alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Acknowledge an alert
   */
  static async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      await db
        .update(firewallAlerts)
        .set({
          acknowledged: true,
          acknowledgedBy: userId,
          acknowledgedAt: new Date(),
        })
        .where(eq(firewallAlerts.id, alertId));

      console.log(`Alert ${alertId} acknowledged by user ${userId}`);
    } catch (error) {
      throw new Error(`Failed to acknowledge alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check for alert storm (too many alerts in short time)
   */
  static async checkAlertStorm(deviceId: string): Promise<boolean> {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      const recentAlerts = await db
        .select()
        .from(firewallAlerts)
        .where(and(
          eq(firewallAlerts.deviceId, deviceId),
          gte(firewallAlerts.createdAt, tenMinutesAgo)
        ));

      // Consider it an alert storm if more than 20 alerts in 10 minutes
      return recentAlerts.length > 20;
    } catch (error) {
      console.error('Error checking alert storm:', error);
      return false;
    }
  }

  /**
   * Get alert statistics for a tenant
   */
  static async getAlertStats(tenantId: string, hours: number = 24): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    acknowledged: number;
    unacknowledged: number;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const alerts = await db
        .select()
        .from(firewallAlerts)
        .where(and(
          eq(firewallAlerts.tenantId, tenantId),
          gte(firewallAlerts.createdAt, since)
        ));

      const stats = {
        total: alerts.length,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        acknowledged: 0,
        unacknowledged: 0,
      };

      alerts.forEach(alert => {
        // Count by severity
        switch (alert.severity) {
          case 'critical':
            stats.critical++;
            break;
          case 'high':
            stats.high++;
            break;
          case 'medium':
            stats.medium++;
            break;
          case 'low':
            stats.low++;
            break;
          case 'info':
            stats.info++;
            break;
        }

        // Count by acknowledgment
        if (alert.acknowledged) {
          stats.acknowledged++;
        } else {
          stats.unacknowledged++;
        }
      });

      return stats;
    } catch (error) {
      throw new Error(`Failed to get alert stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up old alerts (older than specified days)
   */
  static async cleanupOldAlerts(days: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const deletedAlerts = await db
        .delete(firewallAlerts)
        .where(lte(firewallAlerts.createdAt, cutoffDate))
        .returning();

      console.log(`Cleaned up ${deletedAlerts.length} alerts older than ${days} days`);
      return deletedAlerts.length;
    } catch (error) {
      throw new Error(`Failed to cleanup old alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}