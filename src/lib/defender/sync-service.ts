/**
 * Microsoft Defender Data Synchronization Service
 * Handles periodic sync of devices, alerts, and vulnerabilities from Microsoft Graph
 */

import { EnvironmentGraphClient } from './graph-client';
import { db } from '@/lib/database';
import { 
  edrDevices, 
  edrAlerts, 
  edrVulnerabilities,
  edrPostureScores 
} from '../../../database/schemas/edr';
import { eq, and, desc } from 'drizzle-orm';
import { 
  DefenderDevice,
  DefenderAlert,
  IntuneDevice,
  Vulnerability,
  NormalizedDevice,
  NormalizedAlert,
  NormalizedVulnerability
} from '@/types/edr';
import { calculatePostureScore } from '@/lib/edr-posture-calculator';

export class DefenderSyncService {
  private graphClient: EnvironmentGraphClient;
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private defaultSyncInterval: number = 5 * 60 * 1000; // 5 minutes
  private isRunning: boolean = false;

  constructor() {
    this.graphClient = new EnvironmentGraphClient();
  }

  /**
   * Start periodic synchronization for a tenant
   */
  async startSync(tenantId: string): Promise<void> {
    try {
      // Stop existing sync if running
      this.stopSync(tenantId);

      // Test connection first
      const connectionOk = await this.graphClient.testConnection();
      if (!connectionOk) {
        throw new Error('Microsoft Graph connection test failed');
      }

      // Start sync interval
      const interval = setInterval(async () => {
        try {
          await this.performSync(tenantId);
        } catch (error) {
          console.error(`Sync error for tenant ${tenantId}:`, error);
          // Continue syncing even if one cycle fails
        }
      }, this.defaultSyncInterval);

      this.syncIntervals.set(tenantId, interval);
      this.isRunning = true;

      // Perform initial sync
      await this.performSync(tenantId);

      console.log(`Started Defender sync for tenant: ${tenantId}`);
    } catch (error) {
      throw new Error(`Failed to start sync for tenant ${tenantId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop synchronization for a tenant
   */
  stopSync(tenantId: string): void {
    const interval = this.syncIntervals.get(tenantId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(tenantId);
      console.log(`Stopped Defender sync for tenant: ${tenantId}`);
    }

    if (this.syncIntervals.size === 0) {
      this.isRunning = false;
    }
  }

  /**
   * Stop all synchronization
   */
  stopAllSync(): void {
    for (const tenantId of this.syncIntervals.keys()) {
      this.stopSync(tenantId);
    }
  }

  /**
   * Perform manual sync for a tenant
   */
  async performManualSync(tenantId: string): Promise<{
    devicesProcessed: number;
    alertsProcessed: number;
    vulnerabilitiesProcessed: number;
  }> {
    return await this.performSync(tenantId);
  }

  /**
   * Get sync status for a tenant
   */
  getSyncStatus(tenantId: string): { isRunning: boolean; interval: number } {
    return {
      isRunning: this.syncIntervals.has(tenantId),
      interval: this.defaultSyncInterval,
    };
  }

  /**
   * Perform synchronization for a tenant
   */
  private async performSync(tenantId: string): Promise<{
    devicesProcessed: number;
    alertsProcessed: number;
    vulnerabilitiesProcessed: number;
  }> {
    console.log(`Starting sync for tenant: ${tenantId}`);
    
    try {
      // Sync devices (Defender + Intune data)
      const devicesProcessed = await this.syncDevices(tenantId);
      
      // Sync alerts
      const alertsProcessed = await this.syncAlerts(tenantId);
      
      // Sync vulnerabilities
      const vulnerabilitiesProcessed = await this.syncVulnerabilities(tenantId);
      
      // Calculate and store posture score
      await this.updatePostureScore(tenantId);

      console.log(`Sync completed for tenant ${tenantId}: ${devicesProcessed} devices, ${alertsProcessed} alerts, ${vulnerabilitiesProcessed} vulnerabilities`);

      return {
        devicesProcessed,
        alertsProcessed,
        vulnerabilitiesProcessed,
      };
    } catch (error) {
      console.error(`Sync failed for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Sync devices from Defender and Intune
   */
  private async syncDevices(tenantId: string): Promise<number> {
    try {
      // Get devices from both Defender and Intune
      const [defenderDevices, intuneDevices] = await Promise.all([
        this.graphClient.getDefenderDevices(),
        this.graphClient.getIntuneDevices(),
      ]);

      let processedCount = 0;

      // Process Defender devices
      for (const defenderDevice of defenderDevices) {
        try {
          // Find matching Intune device
          const intuneDevice = intuneDevices.find(
            intune => intune.azureADDeviceId === defenderDevice.id ||
                     intune.deviceName === defenderDevice.computerDnsName
          );

          // Normalize device data
          const normalizedDevice = this.normalizeDevice(defenderDevice, tenantId, intuneDevice);

          // Upsert device
          await this.upsertDevice(normalizedDevice);
          processedCount++;
        } catch (error) {
          console.error(`Failed to process device ${defenderDevice.id}:`, error);
        }
      }

      return processedCount;
    } catch (error) {
      throw new Error(`Failed to sync devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync alerts from Defender
   */
  private async syncAlerts(tenantId: string): Promise<number> {
    try {
      // Get recent alerts (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const filter = `createdDateTime ge ${yesterday.toISOString()}`;
      const defenderAlerts = await this.graphClient.getDefenderAlerts(filter);

      let processedCount = 0;

      for (const defenderAlert of defenderAlerts) {
        try {
          // Find associated device
          const deviceId = defenderAlert.devices?.[0]?.deviceId;
          let normalizedDeviceId: string | null = null;

          if (deviceId) {
            const existingDevice = await db
              .select()
              .from(edrDevices)
              .where(and(
                eq(edrDevices.tenantId, tenantId),
                eq(edrDevices.microsoftDeviceId, deviceId)
              ))
              .limit(1);

            normalizedDeviceId = existingDevice[0]?.id || null;
          }

          // Normalize alert data
          const normalizedAlert = this.normalizeAlert(defenderAlert, tenantId, normalizedDeviceId);

          // Upsert alert
          await this.upsertAlert(normalizedAlert);
          processedCount++;
        } catch (error) {
          console.error(`Failed to process alert ${defenderAlert.id}:`, error);
        }
      }

      return processedCount;
    } catch (error) {
      throw new Error(`Failed to sync alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync vulnerabilities from Defender
   */
  private async syncVulnerabilities(tenantId: string): Promise<number> {
    try {
      const vulnerabilities = await this.graphClient.getVulnerabilities();

      let processedCount = 0;

      for (const vulnerability of vulnerabilities) {
        try {
          // Normalize vulnerability data
          const normalizedVulnerability = this.normalizeVulnerability(vulnerability, tenantId);

          // Upsert vulnerability
          await this.upsertVulnerability(normalizedVulnerability);
          processedCount++;
        } catch (error) {
          console.error(`Failed to process vulnerability ${vulnerability.id}:`, error);
        }
      }

      return processedCount;
    } catch (error) {
      throw new Error(`Failed to sync vulnerabilities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update posture score for tenant
   */
  private async updatePostureScore(tenantId: string): Promise<void> {
    try {
      const postureCalculation = await calculatePostureScore(tenantId);
      
      await db.insert(edrPostureScores).values({
        tenantId,
        score: postureCalculation.score,
        deviceCount: postureCalculation.deviceCount,
        highRiskDeviceCount: postureCalculation.highRiskDeviceCount,
        activeAlertCount: postureCalculation.activeAlertCount,
        criticalVulnerabilityCount: postureCalculation.criticalVulnerabilityCount,
        nonCompliantDeviceCount: postureCalculation.nonCompliantDeviceCount,
        calculatedAt: new Date(),
        createdAt: new Date(),
      });
    } catch (error) {
      console.error(`Failed to update posture score for tenant ${tenantId}:`, error);
    }
  }

  /**
   * Normalize Defender device data
   */
  private normalizeDevice(
    defenderDevice: DefenderDevice,
    tenantId: string,
    intuneDevice?: IntuneDevice
  ): NormalizedDevice {
    return {
      id: '', // Will be generated by database
      tenantId,
      microsoftDeviceId: defenderDevice.id,
      deviceName: defenderDevice.computerDnsName,
      operatingSystem: defenderDevice.osPlatform,
      osVersion: defenderDevice.osVersion,
      primaryUser: intuneDevice?.userPrincipalName || '',
      defenderHealthStatus: defenderDevice.healthStatus,
      riskScore: defenderDevice.riskScore,
      exposureLevel: defenderDevice.exposureLevel,
      intuneComplianceState: intuneDevice?.complianceState || 'unknown',
      intuneEnrollmentStatus: intuneDevice?.enrollmentType || 'unknown',
      lastSeenAt: new Date(defenderDevice.lastSeen),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Normalize Defender alert data
   */
  private normalizeAlert(
    defenderAlert: DefenderAlert,
    tenantId: string,
    deviceId: string | null
  ): NormalizedAlert {
    return {
      id: '', // Will be generated by database
      tenantId,
      deviceId: deviceId || '',
      microsoftAlertId: defenderAlert.id,
      severity: defenderAlert.severity.toLowerCase(),
      threatType: defenderAlert.category,
      threatName: defenderAlert.title,
      status: defenderAlert.status.toLowerCase(),
      description: defenderAlert.description,
      detectedAt: new Date(defenderAlert.createdDateTime),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Normalize vulnerability data
   */
  private normalizeVulnerability(
    vulnerability: Vulnerability,
    tenantId: string
  ): NormalizedVulnerability {
    return {
      id: '', // Will be generated by database
      tenantId,
      cveId: vulnerability.cveId,
      severity: vulnerability.severity.toLowerCase(),
      cvssScore: vulnerability.cvssScore,
      exploitability: vulnerability.exploitability,
      description: vulnerability.description,
      affectedDeviceCount: vulnerability.affectedDevices?.length || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Upsert device in database
   */
  private async upsertDevice(device: NormalizedDevice): Promise<void> {
    try {
      // Check if device exists
      const existingDevice = await db
        .select()
        .from(edrDevices)
        .where(and(
          eq(edrDevices.tenantId, device.tenantId),
          eq(edrDevices.microsoftDeviceId, device.microsoftDeviceId)
        ))
        .limit(1);

      if (existingDevice.length > 0) {
        // Update existing device
        await db
          .update(edrDevices)
          .set({
            deviceName: device.deviceName,
            operatingSystem: device.operatingSystem,
            osVersion: device.osVersion,
            primaryUser: device.primaryUser,
            defenderHealthStatus: device.defenderHealthStatus,
            riskScore: device.riskScore,
            exposureLevel: device.exposureLevel,
            intuneComplianceState: device.intuneComplianceState,
            intuneEnrollmentStatus: device.intuneEnrollmentStatus,
            lastSeenAt: device.lastSeenAt,
            updatedAt: new Date(),
          })
          .where(eq(edrDevices.id, existingDevice[0].id));
      } else {
        // Insert new device
        await db.insert(edrDevices).values({
          tenantId: device.tenantId,
          microsoftDeviceId: device.microsoftDeviceId,
          deviceName: device.deviceName,
          operatingSystem: device.operatingSystem,
          osVersion: device.osVersion,
          primaryUser: device.primaryUser,
          defenderHealthStatus: device.defenderHealthStatus,
          riskScore: device.riskScore,
          exposureLevel: device.exposureLevel,
          intuneComplianceState: device.intuneComplianceState,
          intuneEnrollmentStatus: device.intuneEnrollmentStatus,
          lastSeenAt: device.lastSeenAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      throw new Error(`Failed to upsert device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upsert alert in database
   */
  private async upsertAlert(alert: NormalizedAlert): Promise<void> {
    try {
      // Check if alert exists
      const existingAlert = await db
        .select()
        .from(edrAlerts)
        .where(and(
          eq(edrAlerts.tenantId, alert.tenantId),
          eq(edrAlerts.microsoftAlertId, alert.microsoftAlertId)
        ))
        .limit(1);

      if (existingAlert.length > 0) {
        // Update existing alert
        await db
          .update(edrAlerts)
          .set({
            severity: alert.severity,
            threatType: alert.threatType,
            threatName: alert.threatName,
            status: alert.status,
            description: alert.description,
            updatedAt: new Date(),
          })
          .where(eq(edrAlerts.id, existingAlert[0].id));
      } else {
        // Insert new alert
        await db.insert(edrAlerts).values({
          tenantId: alert.tenantId,
          deviceId: alert.deviceId,
          microsoftAlertId: alert.microsoftAlertId,
          severity: alert.severity,
          threatType: alert.threatType,
          threatName: alert.threatName,
          status: alert.status,
          description: alert.description,
          detectedAt: alert.detectedAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      throw new Error(`Failed to upsert alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upsert vulnerability in database
   */
  private async upsertVulnerability(vulnerability: NormalizedVulnerability): Promise<void> {
    try {
      // Check if vulnerability exists
      const existingVulnerability = await db
        .select()
        .from(edrVulnerabilities)
        .where(and(
          eq(edrVulnerabilities.tenantId, vulnerability.tenantId),
          eq(edrVulnerabilities.cveId, vulnerability.cveId)
        ))
        .limit(1);

      if (existingVulnerability.length > 0) {
        // Update existing vulnerability
        await db
          .update(edrVulnerabilities)
          .set({
            severity: vulnerability.severity,
            cvssScore: vulnerability.cvssScore,
            exploitability: vulnerability.exploitability,
            description: vulnerability.description,
            affectedDeviceCount: vulnerability.affectedDeviceCount,
            updatedAt: new Date(),
          })
          .where(eq(edrVulnerabilities.id, existingVulnerability[0].id));
      } else {
        // Insert new vulnerability
        await db.insert(edrVulnerabilities).values({
          tenantId: vulnerability.tenantId,
          cveId: vulnerability.cveId,
          severity: vulnerability.severity,
          cvssScore: vulnerability.cvssScore,
          exploitability: vulnerability.exploitability,
          description: vulnerability.description,
          affectedDeviceCount: vulnerability.affectedDeviceCount,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (error) {
      throw new Error(`Failed to upsert vulnerability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Global sync service instance
export const defenderSyncService = new DefenderSyncService();