/**
 * Microsoft Graph API Client for Defender and Intune integration
 * Handles authentication and API calls to Microsoft Graph
 */

import { 
  MicrosoftGraphCredentials,
  TokenResponse,
  DefenderDevice,
  DefenderAlert,
  IntuneDevice,
  Vulnerability,
  ComplianceStatus,
  ActionResult,
  GraphAPIError,
  RateLimitInfo
} from '@/types/edr';

export class MicrosoftGraphClient {
  private credentials: MicrosoftGraphCredentials;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string = 'https://graph.microsoft.com/v1.0';
  private rateLimitInfo: Map<string, RateLimitInfo> = new Map();

  constructor(credentials: MicrosoftGraphCredentials) {
    this.credentials = credentials;
  }

  /**
   * Get access token using client credentials flow
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.credentials.tenantId}/oauth2/v2.0/token`;
      
      const body = new URLSearchParams({
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const tokenData: TokenResponse = await response.json();
      
      this.accessToken = tokenData.access_token;
      // Set expiry with 5 minute buffer
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in - 300) * 1000);

      return this.accessToken;
    } catch (error) {
      throw new Error(`Failed to get access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Make authenticated request to Microsoft Graph API
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const maxRetries = 3;
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    
    // Check rate limiting
    await this.checkRateLimit(endpoint);

    // Get access token
    const token = await this.getAccessToken();

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        this.rateLimitInfo.set(endpoint, {
          retryAfter: retryAfter * 1000,
          endpoint,
          timestamp: new Date(),
        });

        if (retryCount < maxRetries) {
          console.log(`Rate limited on ${endpoint}, retrying after ${retryAfter} seconds`);
          await this.sleep(retryAfter * 1000);
          return this.makeRequest<T>(endpoint, options, retryCount + 1);
        } else {
          throw new Error(`Rate limit exceeded for ${endpoint} after ${maxRetries} retries`);
        }
      }

      // Handle token expiry
      if (response.status === 401) {
        this.accessToken = undefined;
        this.tokenExpiry = undefined;
        
        if (retryCount < maxRetries) {
          return this.makeRequest<T>(endpoint, options, retryCount + 1);
        }
      }

      if (!response.ok) {
        const errorData: GraphAPIError = await response.json().catch(() => ({
          error: {
            code: 'UNKNOWN_ERROR',
            message: `HTTP ${response.status}: ${response.statusText}`,
          },
        }));
        
        throw new Error(`Graph API error: ${errorData.error.code} - ${errorData.error.message}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rate limit')) {
        throw error;
      }
      
      throw new Error(`Graph API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check rate limiting for endpoint
   */
  private async checkRateLimit(endpoint: string): Promise<void> {
    const rateLimitInfo = this.rateLimitInfo.get(endpoint);
    if (rateLimitInfo) {
      const timeSinceLimit = Date.now() - rateLimitInfo.timestamp.getTime();
      if (timeSinceLimit < rateLimitInfo.retryAfter) {
        const waitTime = rateLimitInfo.retryAfter - timeSinceLimit;
        console.log(`Waiting ${waitTime}ms for rate limit on ${endpoint}`);
        await this.sleep(waitTime);
      }
      this.rateLimitInfo.delete(endpoint);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Defender for Endpoint APIs
  // ============================================================================

  /**
   * Get all devices from Defender for Endpoint
   */
  async getDefenderDevices(): Promise<DefenderDevice[]> {
    try {
      const response = await this.makeRequest<{ value: DefenderDevice[] }>(
        '/security/microsoft.graph.security.runHuntingQuery',
        {
          method: 'POST',
          body: JSON.stringify({
            Query: `
              DeviceInfo
              | where Timestamp > ago(7d)
              | summarize arg_max(Timestamp, *) by DeviceId
              | project DeviceId, DeviceName, OSPlatform, OSVersion, PublicIP, 
                       OnboardingStatus, HealthStatus, RiskScore, ExposureLevel
            `
          }),
        }
      );

      return response.value || [];
    } catch (error) {
      // Fallback to direct device endpoint if hunting query fails
      try {
        const response = await this.makeRequest<{ value: DefenderDevice[] }>(
          '/security/microsoft.graph.security.devices'
        );
        return response.value || [];
      } catch (fallbackError) {
        throw new Error(`Failed to get Defender devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Get specific device from Defender
   */
  async getDefenderDevice(deviceId: string): Promise<DefenderDevice | null> {
    try {
      const device = await this.makeRequest<DefenderDevice>(
        `/security/microsoft.graph.security.devices/${deviceId}`
      );
      return device;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw new Error(`Failed to get Defender device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get alerts from Defender for Endpoint
   */
  async getDefenderAlerts(filter?: string): Promise<DefenderAlert[]> {
    try {
      let endpoint = '/security/alerts_v2';
      if (filter) {
        endpoint += `?$filter=${encodeURIComponent(filter)}`;
      }

      const response = await this.makeRequest<{ value: DefenderAlert[] }>(endpoint);
      return response.value || [];
    } catch (error) {
      throw new Error(`Failed to get Defender alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update alert status
   */
  async updateDefenderAlert(alertId: string, updates: Partial<DefenderAlert>): Promise<void> {
    try {
      await this.makeRequest(
        `/security/alerts_v2/${alertId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );
    } catch (error) {
      throw new Error(`Failed to update Defender alert: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get vulnerabilities
   */
  async getVulnerabilities(): Promise<Vulnerability[]> {
    try {
      const response = await this.makeRequest<{ value: Vulnerability[] }>(
        '/security/microsoft.graph.security.vulnerabilities'
      );
      return response.value || [];
    } catch (error) {
      throw new Error(`Failed to get vulnerabilities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Device Actions
  // ============================================================================

  /**
   * Isolate device
   */
  async isolateDevice(deviceId: string, comment: string = 'Isolated via AVIAN platform'): Promise<ActionResult> {
    try {
      const response = await this.makeRequest<ActionResult>(
        `/security/microsoft.graph.security.devices/${deviceId}/isolate`,
        {
          method: 'POST',
          body: JSON.stringify({
            comment,
            isolationType: 'Full',
          }),
        }
      );
      return response;
    } catch (error) {
      throw new Error(`Failed to isolate device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Release device from isolation
   */
  async releaseDevice(deviceId: string, comment: string = 'Released via AVIAN platform'): Promise<ActionResult> {
    try {
      const response = await this.makeRequest<ActionResult>(
        `/security/microsoft.graph.security.devices/${deviceId}/unisolate`,
        {
          method: 'POST',
          body: JSON.stringify({
            comment,
          }),
        }
      );
      return response;
    } catch (error) {
      throw new Error(`Failed to release device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run antivirus scan
   */
  async runAntivirusScan(deviceId: string, scanType: 'Quick' | 'Full' = 'Quick'): Promise<ActionResult> {
    try {
      const response = await this.makeRequest<ActionResult>(
        `/security/microsoft.graph.security.devices/${deviceId}/runAntiVirusScan`,
        {
          method: 'POST',
          body: JSON.stringify({
            comment: `${scanType} antivirus scan initiated via AVIAN platform`,
            scanType,
          }),
        }
      );
      return response;
    } catch (error) {
      throw new Error(`Failed to run antivirus scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get machine action status
   */
  async getActionStatus(actionId: string): Promise<ActionResult> {
    try {
      const response = await this.makeRequest<ActionResult>(
        `/security/microsoft.graph.security.machineActions/${actionId}`
      );
      return response;
    } catch (error) {
      throw new Error(`Failed to get action status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Intune APIs
  // ============================================================================

  /**
   * Get devices from Intune
   */
  async getIntuneDevices(): Promise<IntuneDevice[]> {
    try {
      const response = await this.makeRequest<{ value: IntuneDevice[] }>(
        '/deviceManagement/managedDevices'
      );
      return response.value || [];
    } catch (error) {
      throw new Error(`Failed to get Intune devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific device from Intune
   */
  async getIntuneDevice(deviceId: string): Promise<IntuneDevice | null> {
    try {
      const device = await this.makeRequest<IntuneDevice>(
        `/deviceManagement/managedDevices/${deviceId}`
      );
      return device;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw new Error(`Failed to get Intune device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get device compliance status
   */
  async getDeviceCompliance(deviceId: string): Promise<ComplianceStatus | null> {
    try {
      const response = await this.makeRequest<ComplianceStatus>(
        `/deviceManagement/managedDevices/${deviceId}/deviceCompliancePolicyStates`
      );
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw new Error(`Failed to get device compliance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync device with Intune
   */
  async syncIntuneDevice(deviceId: string): Promise<void> {
    try {
      await this.makeRequest(
        `/deviceManagement/managedDevices/${deviceId}/syncDevice`,
        {
          method: 'POST',
        }
      );
    } catch (error) {
      throw new Error(`Failed to sync Intune device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Test connection to Microsoft Graph
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/me');
      return true;
    } catch (error) {
      console.error('Microsoft Graph connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): { [endpoint: string]: RateLimitInfo } {
    const status: { [endpoint: string]: RateLimitInfo } = {};
    for (const [endpoint, info] of this.rateLimitInfo.entries()) {
      status[endpoint] = info;
    }
    return status;
  }

  /**
   * Clear rate limit cache
   */
  clearRateLimitCache(): void {
    this.rateLimitInfo.clear();
  }
}

/**
 * Environment-based Graph client
 * Uses environment variables for credentials
 */
export class EnvironmentGraphClient extends MicrosoftGraphClient {
  constructor() {
    const credentials: MicrosoftGraphCredentials = {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      tenantId: process.env.MICROSOFT_TENANT_ID || '',
    };

    if (!credentials.clientId || !credentials.clientSecret || !credentials.tenantId) {
      throw new Error('Microsoft Graph credentials not configured. Please set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID environment variables.');
    }

    super(credentials);
  }
}