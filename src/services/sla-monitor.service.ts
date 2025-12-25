import { WorkflowService } from './workflow.service';
import { TenantService } from './tenant.service';

export class SLAMonitorService {
  private static isRunning = false;
  private static intervalId: NodeJS.Timeout | null = null;

  /**
   * Start the SLA monitoring service
   */
  static start(intervalMinutes: number = 30): void {
    if (this.isRunning) {
      console.log('SLA Monitor is already running');
      return;
    }

    console.log(`Starting SLA Monitor with ${intervalMinutes} minute intervals`);
    this.isRunning = true;

    // Run immediately
    this.runMonitoringCycle();

    // Set up recurring monitoring
    this.intervalId = setInterval(() => {
      this.runMonitoringCycle();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the SLA monitoring service
   */
  static stop(): void {
    if (!this.isRunning) {
      console.log('SLA Monitor is not running');
      return;
    }

    console.log('Stopping SLA Monitor');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Run a single monitoring cycle for all tenants
   */
  private static async runMonitoringCycle(): Promise<void> {
    try {
      console.log('Running SLA monitoring cycle...');
      
      // Get all active tenants
      const tenants = await TenantService.getAllTenants();
      
      for (const tenant of tenants) {
        if (tenant.is_active) {
          await this.monitorTenant(tenant.id);
        }
      }
      
      console.log(`SLA monitoring cycle completed for ${tenants.length} tenants`);
    } catch (error) {
      console.error('Error in SLA monitoring cycle:', error);
    }
  }

  /**
   * Monitor SLA for a specific tenant
   */
  private static async monitorTenant(_tenantId: string): Promise<void> {
    try {
      // Check for SLA breaches
      await WorkflowService.monitorSLABreaches(tenantId);
      
      // Check for escalations
      await WorkflowService.checkForEscalations(tenantId);
      
    } catch (error) {
      console.error(`Error monitoring tenant ${tenantId}:`, error);
    }
  }

  /**
   * Get monitoring status
   */
  static getStatus(): { isRunning: boolean; intervalId: number | null } {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId ? Number(this.intervalId) : null,
    };
  }

  /**
   * Run monitoring for a specific tenant (manual trigger)
   */
  static async runForTenant(_tenantId: string): Promise<void> {
    console.log(`Running manual SLA monitoring for tenant ${tenantId}`);
    await this.monitorTenant(tenantId);
  }
}