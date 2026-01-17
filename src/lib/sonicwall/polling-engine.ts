/**
 * SonicWall Polling Engine
 * Continuously monitors SonicWall devices and generates alerts on changes
 */

import { SonicWallAPIClient } from './api-client';
import { EnvironmentCredentialManager } from './encryption';
import { AlertManager } from '@/lib/alert-manager';
import { db } from '@/lib/database';
import { 
  firewallDevices, 
  firewallHealthSnapshots, 
  firewallSecurityPosture,
  firewallLicenses,
  firewallMetricsRollup 
} from '../../../database/schemas/firewall';
import { eq } from 'drizzle-orm';
import { 
  PollingState, 
  Counters, 
  Status, 
  HealthData, 
  PostureData,
  FirewallDevice,
  AlertType,
  AlertSeverity,
  CreateAlertInput
} from '@/types/firewall';

export class SonicWallPollingEngine {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private pollingStates: Map<string, PollingState> = new Map();
  private credentialManager: EnvironmentCredentialManager;
  private defaultPollingInterval: number = 30000; // 30 seconds
  private snapshotInterval: number = 4 * 60 * 60 * 1000; // 4 hours

  constructor() {
    this.credentialManager = new EnvironmentCredentialManager();
  }

  /**
   * Start polling a SonicWall device
   */
  async startPolling(deviceId: string): Promise<void> {
    try {
      // Stop existing polling if running
      this.stopPolling(deviceId);

      // Get device configuration
      const device = await this.getDevice(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      // Initialize polling state
      await this.initializePollingState(device);

      // Start polling interval
      const interval = setInterval(async () => {
        try {
          await this.pollDevice(device);
        } catch (error) {
          console.error(`Polling error for device ${deviceId}:`, error);
          // Continue polling even if one cycle fails
        }
      }, this.defaultPollingInterval);

      this.pollingIntervals.set(deviceId, interval);

      console.log(`Started polling SonicWall device: ${deviceId}`);
    } catch (error) {
      throw new Error(`Failed to start polling device ${deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop polling a device
   */
  stopPolling(deviceId: string): void {
    const interval = this.pollingIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(deviceId);
      this.pollingStates.delete(deviceId);
      console.log(`Stopped polling SonicWall device: ${deviceId}`);
    }
  }

  /**
   * Stop all polling
   */
  stopAllPolling(): void {
    for (const deviceId of this.pollingIntervals.keys()) {
      this.stopPolling(deviceId);
    }
  }

  /**
   * Get polling status for a device
   */
  getPollingStatus(deviceId: string): { isPolling: boolean; lastPollTime?: Date } {
    const isPolling = this.pollingIntervals.has(deviceId);
    const state = this.pollingStates.get(deviceId);
    return {
      isPolling,
      lastPollTime: state?.lastPollTime,
    };
  }

  /**
   * Poll a single device
   */
  private async pollDevice(device: FirewallDevice): Promise<void> {
    const deviceId = device.id;
    
    try {
      // Create API client
      const apiClient = await this.createAPIClient(device);
      
      // Get current data
      const [securityStats, systemHealth, interfaceStatus, vpnPolicies, licenseInfo] = await Promise.all([
        apiClient.getSecurityStats(),
        apiClient.getSystemHealth(),
        apiClient.getInterfaceStatus(),
        apiClient.getVPNPolicies(),
        apiClient.getLicenseInfo(),
      ]);

      // Get current polling state
      const currentState = this.pollingStates.get(deviceId);
      if (!currentState) {
        throw new Error(`No polling state found for device ${deviceId}`);
      }

      // Detect counter changes and generate alerts
      await this.detectCounterChanges(device, securityStats, currentState);

      // Detect status changes and generate alerts
      await this.detectStatusChanges(device, systemHealth, interfaceStatus, vpnPolicies, currentState);

      // Store health snapshot
      await this.storeHealthSnapshot(device, systemHealth, interfaceStatus, vpnPolicies);

      // Store security posture
      await this.storeSecurityPosture(device, securityStats, licenseInfo);

      // Store license information
      await this.storeLicenseInfo(device, licenseInfo);

      // Update polling state
      this.updatePollingState(deviceId, securityStats, systemHealth);

      // Update device last seen
      await this.updateDeviceLastSeen(deviceId);

    } catch (error) {
      console.error(`Failed to poll device ${deviceId}:`, error);
      
      // Generate device offline alert if API calls fail
      await this.generateAlert(device, {
        alertType: 'wan_down',
        severity: 'high',
        message: `SonicWall device ${device.managementIp} is not responding to API calls`,
        source: 'api',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          device_identifier: device.managementIp,
        },
      });
    }
  }

  /**
   * Initialize polling state for a device
   */
  private async initializePollingState(device: FirewallDevice): Promise<void> {
    try {
      const apiClient = await this.createAPIClient(device);
      const [securityStats, systemHealth] = await Promise.all([
        apiClient.getSecurityStats(),
        apiClient.getSystemHealth(),
      ]);

      const state: PollingState = {
        deviceId: device.id,
        lastPollTime: new Date(),
        lastCounters: {
          ipsBlocks: securityStats.ips_blocks_today,
          gavBlocks: securityStats.gav_blocks_today,
          dpiSslBlocks: securityStats.dpi_ssl_blocks_today,
          atpVerdicts: securityStats.atp_verdicts_today,
          appControlBlocks: securityStats.app_control_blocks_today,
          botnetBlocks: securityStats.botnet_blocks_today,
          contentFilterBlocks: securityStats.content_filter_blocks_today,
          blockedConnections: securityStats.blocked_connections,
        },
        lastStatus: {
          wanStatus: 'up', // Assume up if we can connect
          vpnStatus: 'up', // Will be updated based on VPN policies
        },
      };

      this.pollingStates.set(device.id, state);
    } catch (error) {
      throw new Error(`Failed to initialize polling state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect counter changes and generate alerts
   */
  private async detectCounterChanges(
    device: FirewallDevice,
    newStats: any,
    currentState: PollingState
  ): Promise<void> {
    const newCounters: Counters = {
      ipsBlocks: newStats.ips_blocks_today,
      gavBlocks: newStats.gav_blocks_today,
      dpiSslBlocks: newStats.dpi_ssl_blocks_today,
      atpVerdicts: newStats.atp_verdicts_today,
      appControlBlocks: newStats.app_control_blocks_today,
      botnetBlocks: newStats.botnet_blocks_today,
      contentFilterBlocks: newStats.content_filter_blocks_today,
      blockedConnections: newStats.blocked_connections,
    };

    const lastCounters = currentState.lastCounters;

    // Check for significant increases in threat counters
    const counterChecks = [
      { name: 'IPS', current: newCounters.ipsBlocks, previous: lastCounters.ipsBlocks, alertType: 'ips_counter_increase' as AlertType },
      { name: 'Gateway Anti-Virus', current: newCounters.gavBlocks, previous: lastCounters.gavBlocks, alertType: 'gav_counter_increase' as AlertType },
      { name: 'ATP', current: newCounters.atpVerdicts, previous: lastCounters.atpVerdicts, alertType: 'atp_counter_increase' as AlertType },
      { name: 'Botnet Filter', current: newCounters.botnetBlocks, previous: lastCounters.botnetBlocks, alertType: 'botnet_counter_increase' as AlertType },
    ];

    for (const check of counterChecks) {
      const increase = check.current - check.previous;
      
      if (increase > 0) {
        let severity: AlertSeverity = 'info';
        
        // Determine severity based on increase amount
        if (increase >= 100) {
          severity = 'critical';
        } else if (increase >= 50) {
          severity = 'high';
        } else if (increase >= 10) {
          severity = 'medium';
        } else if (increase >= 1) {
          severity = 'low';
        }

        await this.generateAlert(device, {
          alertType: check.alertType,
          severity,
          message: `${check.name} blocked ${increase} new threat(s). Total today: ${check.current}`,
          source: 'api',
          metadata: {
            counter_name: check.name.toLowerCase().replace(/\s+/g, '_'),
            previous_value: check.previous,
            new_value: check.current,
            increase: increase,
            device_identifier: device.managementIp,
          },
        });
      }
    }
  }

  /**
   * Detect status changes and generate alerts
   */
  private async detectStatusChanges(
    device: FirewallDevice,
    systemHealth: any,
    interfaceStatus: any[],
    vpnPolicies: any[],
    currentState: PollingState
  ): Promise<void> {
    // Check WAN status (assume WAN is up if we can connect to API)
    const currentWanStatus: 'up' | 'down' = 'up';
    if (currentState.lastStatus.wanStatus !== currentWanStatus) {
      await this.generateAlert(device, {
        alertType: currentWanStatus === 'up' ? 'wan_up' : 'wan_down',
        severity: currentWanStatus === 'up' ? 'info' : 'critical',
        message: `WAN connection is ${currentWanStatus}`,
        source: 'api',
        metadata: {
          previous_status: currentState.lastStatus.wanStatus,
          new_status: currentWanStatus,
          device_identifier: device.managementIp,
        },
      });
    }

    // Check VPN status
    const vpnUp = vpnPolicies.some(policy => policy.status === 'up');
    const currentVpnStatus: 'up' | 'down' = vpnUp ? 'up' : 'down';
    
    if (currentState.lastStatus.vpnStatus !== currentVpnStatus) {
      await this.generateAlert(device, {
        alertType: currentVpnStatus === 'up' ? 'vpn_up' : 'vpn_down',
        severity: currentVpnStatus === 'up' ? 'info' : 'high',
        message: `VPN connection is ${currentVpnStatus}`,
        source: 'api',
        metadata: {
          previous_status: currentState.lastStatus.vpnStatus,
          new_status: currentVpnStatus,
          vpn_policies_count: vpnPolicies.length,
          device_identifier: device.managementIp,
        },
      });
    }

    // Check for high CPU/RAM usage
    if (systemHealth.cpu_percent >= 90) {
      await this.generateAlert(device, {
        alertType: 'high_cpu',
        severity: 'high',
        message: `High CPU usage detected: ${systemHealth.cpu_percent}%`,
        source: 'api',
        metadata: {
          cpu_percent: systemHealth.cpu_percent,
          device_identifier: device.managementIp,
        },
      });
    }

    if (systemHealth.ram_percent >= 90) {
      await this.generateAlert(device, {
        alertType: 'high_ram',
        severity: 'high',
        message: `High RAM usage detected: ${systemHealth.ram_percent}%`,
        source: 'api',
        metadata: {
          ram_percent: systemHealth.ram_percent,
          device_identifier: device.managementIp,
        },
      });
    }
  }

  /**
   * Store health snapshot in database
   */
  private async storeHealthSnapshot(
    device: FirewallDevice,
    systemHealth: any,
    interfaceStatus: any[],
    vpnPolicies: any[]
  ): Promise<void> {
    try {
      const interfaceStatusMap: { [key: string]: 'up' | 'down' } = {};
      interfaceStatus.forEach(iface => {
        interfaceStatusMap[iface.interface_name] = iface.status;
      });

      const vpnUp = vpnPolicies.some(policy => policy.status === 'up');

      await db.insert(firewallHealthSnapshots).values({
        deviceId: device.id,
        cpuPercent: systemHealth.cpu_percent,
        ramPercent: systemHealth.ram_percent,
        uptimeSeconds: systemHealth.uptime_seconds,
        wanStatus: 'up', // Assume up if we can connect
        vpnStatus: vpnUp ? 'up' : 'down',
        interfaceStatus: interfaceStatusMap,
        wifiStatus: null, // Not available from basic API
        haStatus: systemHealth.ha_state || null,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(`Failed to store health snapshot for device ${device.id}:`, error);
    }
  }

  /**
   * Store security posture in database
   */
  private async storeSecurityPosture(
    device: FirewallDevice,
    securityStats: any,
    licenseInfo: any
  ): Promise<void> {
    try {
      await db.insert(firewallSecurityPosture).values({
        deviceId: device.id,
        ipsEnabled: securityStats.ips_blocks_today >= 0, // Assume enabled if we get stats
        ipsLicenseStatus: this.getLicenseStatus(licenseInfo.ips_expiry),
        ipsDailyBlocks: securityStats.ips_blocks_today,
        gavEnabled: securityStats.gav_blocks_today >= 0,
        gavLicenseStatus: this.getLicenseStatus(licenseInfo.gav_expiry),
        gavDailyBlocks: securityStats.gav_blocks_today,
        dpiSslEnabled: securityStats.dpi_ssl_blocks_today >= 0,
        dpiSslCertificateStatus: null, // Not available from basic API
        dpiSslDailyBlocks: securityStats.dpi_ssl_blocks_today,
        atpEnabled: securityStats.atp_verdicts_today >= 0,
        atpLicenseStatus: this.getLicenseStatus(licenseInfo.atp_expiry),
        atpDailyVerdicts: securityStats.atp_verdicts_today,
        botnetFilterEnabled: securityStats.botnet_blocks_today >= 0,
        botnetDailyBlocks: securityStats.botnet_blocks_today,
        appControlEnabled: securityStats.app_control_blocks_today >= 0,
        appControlLicenseStatus: this.getLicenseStatus(licenseInfo.app_control_expiry),
        appControlDailyBlocks: securityStats.app_control_blocks_today,
        contentFilterEnabled: securityStats.content_filter_blocks_today >= 0,
        contentFilterLicenseStatus: this.getLicenseStatus(licenseInfo.content_filter_expiry),
        contentFilterDailyBlocks: securityStats.content_filter_blocks_today,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(`Failed to store security posture for device ${device.id}:`, error);
    }
  }

  /**
   * Store license information in database
   */
  private async storeLicenseInfo(device: FirewallDevice, licenseInfo: any): Promise<void> {
    try {
      const warnings: string[] = [];
      
      // Check for expiring licenses (within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const licenses = [
        { name: 'IPS', expiry: licenseInfo.ips_expiry },
        { name: 'Gateway Anti-Virus', expiry: licenseInfo.gav_expiry },
        { name: 'ATP', expiry: licenseInfo.atp_expiry },
        { name: 'App Control', expiry: licenseInfo.app_control_expiry },
        { name: 'Content Filter', expiry: licenseInfo.content_filter_expiry },
        { name: 'Support', expiry: licenseInfo.support_expiry },
      ];

      for (const license of licenses) {
        if (license.expiry) {
          const expiryDate = new Date(license.expiry);
          const now = new Date();
          
          if (expiryDate < now) {
            warnings.push(`${license.name} license expired on ${license.expiry}`);
          } else if (expiryDate < thirtyDaysFromNow) {
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            warnings.push(`${license.name} license expires in ${daysUntilExpiry} days`);
          }
        }
      }

      await db.insert(firewallLicenses).values({
        deviceId: device.id,
        ipsExpiry: licenseInfo.ips_expiry,
        gavExpiry: licenseInfo.gav_expiry,
        atpExpiry: licenseInfo.atp_expiry,
        appControlExpiry: licenseInfo.app_control_expiry,
        contentFilterExpiry: licenseInfo.content_filter_expiry,
        supportExpiry: licenseInfo.support_expiry,
        licenseWarnings: warnings,
        timestamp: new Date(),
      });

      // Generate alerts for expired or expiring licenses
      for (const warning of warnings) {
        await this.generateAlert(device, {
          alertType: warning.includes('expired') ? 'license_expired' : 'license_expiring',
          severity: warning.includes('expired') ? 'high' : 'medium',
          message: warning,
          source: 'api',
          metadata: {
            license_warning: warning,
            device_identifier: device.managementIp,
          },
        });
      }
    } catch (error) {
      console.error(`Failed to store license info for device ${device.id}:`, error);
    }
  }

  /**
   * Update polling state
   */
  private updatePollingState(deviceId: string, securityStats: any, systemHealth: any): void {
    const state = this.pollingStates.get(deviceId);
    if (state) {
      state.lastPollTime = new Date();
      state.lastCounters = {
        ipsBlocks: securityStats.ips_blocks_today,
        gavBlocks: securityStats.gav_blocks_today,
        dpiSslBlocks: securityStats.dpi_ssl_blocks_today,
        atpVerdicts: securityStats.atp_verdicts_today,
        appControlBlocks: securityStats.app_control_blocks_today,
        botnetBlocks: securityStats.botnet_blocks_today,
        contentFilterBlocks: securityStats.content_filter_blocks_today,
        blockedConnections: securityStats.blocked_connections,
      };
      state.lastStatus = {
        wanStatus: 'up',
        vpnStatus: state.lastStatus.vpnStatus, // Will be updated by status change detection
      };
    }
  }

  /**
   * Update device last seen timestamp
   */
  private async updateDeviceLastSeen(deviceId: string): Promise<void> {
    try {
      await db
        .update(firewallDevices)
        .set({ 
          lastSeenAt: new Date(),
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(firewallDevices.id, deviceId));
    } catch (error) {
      console.error(`Failed to update last seen for device ${deviceId}:`, error);
    }
  }

  /**
   * Generate alert
   */
  private async generateAlert(device: FirewallDevice, alertData: Omit<CreateAlertInput, 'tenantId' | 'deviceId'>): Promise<void> {
    try {
      await AlertManager.createAlert({
        tenantId: device.tenantId,
        deviceId: device.id,
        ...alertData,
      });
    } catch (error) {
      console.error(`Failed to generate alert for device ${device.id}:`, error);
    }
  }

  /**
   * Get device from database
   */
  private async getDevice(deviceId: string): Promise<FirewallDevice | null> {
    try {
      const devices = await db
        .select()
        .from(firewallDevices)
        .where(eq(firewallDevices.id, deviceId))
        .limit(1);

      return devices[0] || null;
    } catch (error) {
      console.error(`Failed to get device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Create API client for device
   */
  private async createAPIClient(device: FirewallDevice): Promise<SonicWallAPIClient> {
    if (!device.apiPasswordEncrypted || !device.apiUsername) {
      throw new Error('Device credentials not configured');
    }

    // Decrypt credentials
    const credentials = this.credentialManager.decryptCredentials(
      device.apiPasswordEncrypted,
      device.apiUsername // Using username field to store IV for now
    );

    return new SonicWallAPIClient({
      baseUrl: `https://${device.managementIp}`,
      username: credentials.username,
      password: credentials.password,
      timeout: 30000,
    });
  }

  /**
   * Get license status from expiry date
   */
  private getLicenseStatus(expiryDate: string | null): 'active' | 'expiring' | 'expired' | null {
    if (!expiryDate) return null;

    try {
      const expiry = new Date(expiryDate);
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      if (expiry < now) return 'expired';
      if (expiry < thirtyDaysFromNow) return 'expiring';
      return 'active';
    } catch {
      return null;
    }
  }
}

// Global polling engine instance
export const sonicWallPollingEngine = new SonicWallPollingEngine();