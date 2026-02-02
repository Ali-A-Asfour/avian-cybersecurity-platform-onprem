/**
 * SonicWall API Client
 * Handles authentication and API calls to SonicWall firewall devices
 */

import { 
  SonicWallAPIConfig, 
  SonicWallAuthResponse,
  SonicWallSecurityStatsResponse,
  SonicWallSystemStatusResponse,
  SonicWallInterfaceResponse,
  SonicWallVPNPoliciesResponse,
  SonicWallLicensesResponse,
  SecurityStats,
  SystemHealth,
  InterfaceStatus,
  VPNPolicy,
  LicenseInfo
} from '@/types/firewall';

export class SonicWallAPIClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private authToken?: string;
  private tokenExpiry?: Date;
  private timeout: number;

  constructor(config: SonicWallAPIConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.username = config.username;
    this.password = config.password;
    this.authToken = config.authToken;
    this.timeout = config.timeout || 30000;
  }

  /**
   * Authenticate with SonicWall device
   */
  async authenticate(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sonicos/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          user: this.username,
          pass: this.password,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const data: SonicWallAuthResponse = await response.json();
      
      // SonicWall API can return token in different fields
      this.authToken = data.token || data.auth_token;
      
      if (!this.authToken) {
        throw new Error('No authentication token received from SonicWall API');
      }

      // Set token expiry (default 1 hour if not provided)
      const expiresIn = data.expires_in || 3600;
      this.tokenExpiry = new Date(Date.now() + (expiresIn * 1000));

      return this.authToken;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`SonicWall authentication failed: ${error.message}`);
      }
      throw new Error('SonicWall authentication failed: Unknown error');
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Check if we need to authenticate
    if (!this.authToken || (this.tokenExpiry && new Date() >= this.tokenExpiry)) {
      await this.authenticate();
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (response.status === 401) {
        // Token expired, re-authenticate and retry
        await this.authenticate();
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            'Authorization': `Bearer ${this.authToken}`,
          },
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!retryResponse.ok) {
          throw new Error(`API request failed: ${retryResponse.status} ${retryResponse.statusText}`);
        }

        return await retryResponse.json();
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`SonicWall API request failed: ${error.message}`);
      }
      throw new Error('SonicWall API request failed: Unknown error');
    }
  }

  /**
   * Get security statistics (IPS, GAV, ATP blocks, etc.)
   */
  async getSecurityStats(): Promise<SecurityStats> {
    try {
      const data = await this.makeRequest<SonicWallSecurityStatsResponse>(
        '/api/sonicos/reporting/security-services/statistics'
      );

      // Normalize the response - SonicWall APIs can have different field names
      return {
        ips_blocks_today: this.extractNumber(data, ['ips_blocks_today', 'ips_blocks', 'ips.blocks']),
        gav_blocks_today: this.extractNumber(data, ['gav_blocks_today', 'gav_blocks', 'gateway_av.blocks']),
        dpi_ssl_blocks_today: this.extractNumber(data, ['dpi_ssl_blocks_today', 'dpi_ssl_blocks', 'dpi_ssl.blocks']),
        atp_verdicts_today: this.extractNumber(data, ['atp_verdicts_today', 'atp_verdicts', 'atp.verdicts']),
        app_control_blocks_today: this.extractNumber(data, ['app_control_blocks_today', 'app_control_blocks', 'app_control.blocks']),
        content_filter_blocks_today: this.extractNumber(data, ['content_filter_blocks_today', 'content_filter_blocks', 'content_filter.blocks']),
        botnet_blocks_today: this.extractNumber(data, ['botnet_blocks_today', 'botnet_blocks', 'botnet.blocks']),
        blocked_connections: this.extractNumber(data, ['blocked_connections', 'denied_connections', 'total_blocks']),
        bandwidth_total_mb: this.extractNumber(data, ['bandwidth_total_mb', 'bandwidth_mb', 'total_bandwidth']),
      };
    } catch (error) {
      throw new Error(`Failed to get security statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get system health information
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const data = await this.makeRequest<SonicWallSystemStatusResponse>(
        '/api/sonicos/system/status'
      );

      return {
        cpu_percent: this.extractNumber(data, ['cpu_percent', 'cpu', 'cpu_usage']),
        ram_percent: this.extractNumber(data, ['ram_percent', 'memory_percent', 'memory', 'ram']),
        uptime_seconds: this.extractNumber(data, ['uptime_seconds', 'uptime', 'system_uptime']),
        firmware_version: this.extractString(data, ['firmware_version', 'firmware', 'version']),
        model: this.extractString(data, ['model', 'device_model', 'product']),
        serial_number: this.extractString(data, ['serial_number', 'serial', 'sn']),
        ha_role: this.normalizeHARole(this.extractString(data, ['ha_role', 'ha.role', 'high_availability.role'])),
        ha_state: this.normalizeHAState(this.extractString(data, ['ha_state', 'ha.state', 'high_availability.state'])),
        bandwidth_total_mb: this.extractNumber(data, ['bandwidth_total_mb', 'bandwidth_mb', 'total_bandwidth']),
        active_sessions_count: this.extractNumber(data, ['active_sessions', 'sessions_count', 'current_sessions']),
      };
    } catch (error) {
      throw new Error(`Failed to get system health: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get interface status
   */
  async getInterfaceStatus(): Promise<InterfaceStatus[]> {
    try {
      const data = await this.makeRequest<SonicWallInterfaceResponse>(
        '/api/sonicos/interfaces'
      );

      const interfaces = data.interfaces || data.data || [];
      
      return interfaces.map(iface => ({
        interface_name: this.extractString(iface, ['name', 'interface_name', 'interface']),
        zone: this.extractString(iface, ['zone', 'security_zone']),
        ip_address: this.extractString(iface, ['ip', 'ip_address', 'ipv4']),
        status: this.normalizeInterfaceStatus(this.extractString(iface, ['status', 'link_status'])),
        link_speed: this.extractString(iface, ['link_speed', 'speed']),
      }));
    } catch (error) {
      throw new Error(`Failed to get interface status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get VPN policies status
   */
  async getVPNPolicies(): Promise<VPNPolicy[]> {
    try {
      const data = await this.makeRequest<SonicWallVPNPoliciesResponse>(
        '/api/sonicos/vpn/policies'
      );

      const policies = data.policies || data.vpn_policies || data.data || [];
      
      return policies.map(policy => ({
        policy_name: this.extractString(policy, ['name', 'policy_name']),
        status: this.normalizeVPNStatus(this.extractString(policy, ['status', 'tunnel_status'])),
        remote_gateway: this.extractString(policy, ['remote_gateway', 'peer', 'remote_ip']),
        encryption: this.extractString(policy, ['encryption', 'encryption_algorithm']),
        authentication_method: this.extractString(policy, ['authentication', 'auth_method', 'authentication_method']),
      }));
    } catch (error) {
      throw new Error(`Failed to get VPN policies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get license information
   */
  async getLicenseInfo(): Promise<LicenseInfo> {
    try {
      const data = await this.makeRequest<SonicWallLicensesResponse>(
        '/api/sonicos/licenses'
      );

      return {
        ips_expiry: this.extractLicenseDate(data, ['ips_expiry', 'ips.expiry', 'licenses.ips.expiry']) || '',
        gav_expiry: this.extractLicenseDate(data, ['gav_expiry', 'gateway_av_expiry', 'licenses.gav.expiry']) || '',
        atp_expiry: this.extractLicenseDate(data, ['atp_expiry', 'licenses.atp.expiry']) || '',
        app_control_expiry: this.extractLicenseDate(data, ['app_control_expiry', 'licenses.app_control.expiry']) || '',
        content_filter_expiry: this.extractLicenseDate(data, ['content_filter_expiry', 'licenses.content_filter.expiry']) || '',
        support_expiry: this.extractLicenseDate(data, ['support_expiry', 'licenses.support.expiry']) || '',
      };
    } catch (error) {
      throw new Error(`Failed to get license information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test connection to SonicWall device
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      await this.getSystemHealth();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Helper methods for data extraction and normalization

  private extractNumber(data: any, fields: string[]): number {
    for (const field of fields) {
      if (field.includes('.')) {
        const value = this.getNestedValue(data, field.split('.'));
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed)) return parsed;
        }
      } else {
        const value = data[field];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
    return 0;
  }

  private extractString(data: any, fields: string[]): string {
    for (const field of fields) {
      if (field.includes('.')) {
        const value = this.getNestedValue(data, field.split('.'));
        if (typeof value === 'string') return value;
        if (value !== null && value !== undefined) return String(value);
      } else {
        const value = data[field];
        if (typeof value === 'string') return value;
        if (value !== null && value !== undefined) return String(value);
      }
    }
    return '';
  }

  private extractLicenseDate(data: any, fields: string[]): string | null {
    const dateStr = this.extractString(data, fields);
    if (!dateStr) return null;
    
    // Try to parse and normalize the date
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    } catch {
      return dateStr; // Return as-is if parsing fails
    }
  }

  private getNestedValue(obj: any, path: string[]): any {
    return path.reduce((current, key) => current?.[key], obj);
  }

  private normalizeInterfaceStatus(status: string): 'up' | 'down' {
    if (!status) return 'down';
    const normalized = status.toLowerCase();
    return normalized.includes('up') || normalized.includes('active') ? 'up' : 'down';
  }

  private normalizeVPNStatus(status: string): 'up' | 'down' {
    if (!status) return 'down';
    const normalized = status.toLowerCase();
    return normalized.includes('up') || normalized.includes('active') || normalized.includes('connected') ? 'up' : 'down';
  }

  private normalizeHARole(role: string): 'primary' | 'secondary' | undefined {
    if (!role) return undefined;
    const normalized = role.toLowerCase();
    if (normalized.includes('primary') || normalized.includes('master')) return 'primary';
    if (normalized.includes('secondary') || normalized.includes('backup') || normalized.includes('slave')) return 'secondary';
    return undefined;
  }

  private normalizeHAState(state: string): 'active' | 'standby' | 'failover' | undefined {
    if (!state) return undefined;
    const normalized = state.toLowerCase();
    if (normalized.includes('active')) return 'active';
    if (normalized.includes('standby')) return 'standby';
    if (normalized.includes('failover')) return 'failover';
    return undefined;
  }
}