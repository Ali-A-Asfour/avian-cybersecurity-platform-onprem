import { 
  BaseConnector, 
  ConnectorConfig, 
  ConnectorCapability, 
  ConnectorResult, 
  ConnectorEvent, 
  ConnectorStatus,
  ConnectorType 
} from './base-connector';
import { WebhookEventType } from '../webhook';

/**
 * SIEM-specific configuration interface
 */
export interface SiemConnectorConfig extends ConnectorConfig {
  type: ConnectorType.SIEM;
  settings: {
    apiUrl: string;
    apiVersion?: string;
    pollInterval?: number; // seconds
    batchSize?: number;
    alertFilters?: {
      severities?: string[];
      categories?: string[];
      sources?: string[];
    };
    fieldMappings?: {
      [siemField: string]: string; // Map SIEM fields to AVIAN fields
    };
  };
  credentials: {
    apiKey?: string;
    username?: string;
    password?: string;
    token?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

/**
 * SIEM alert interface
 */
export interface SiemAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  source: string;
  timestamp: string;
  status: string;
  rawData: Record<string, any>;
  indicators?: Array<{
    type: string;
    value: string;
    confidence?: number;
  }>;
}

/**
 * Generic SIEM connector implementation
 */
export class SiemConnector extends BaseConnector {
  protected config: SiemConnectorConfig;
  private pollTimer?: NodeJS.Timeout;
  private lastPollTime?: Date;

  constructor(config: SiemConnectorConfig) {
    super(config);
    this.config = config;
  }

  getCapabilities(): ConnectorCapability[] {
    return [
      {
        name: 'alert_ingestion',
        description: 'Ingest security alerts from SIEM system',
        required: true,
        parameters: {
          pollInterval: 'Polling interval in seconds',
          batchSize: 'Number of alerts to fetch per batch',
        },
      },
      {
        name: 'real_time_streaming',
        description: 'Real-time alert streaming via webhooks',
        required: false,
        parameters: {
          webhookUrl: 'Webhook endpoint URL',
        },
      },
      {
        name: 'alert_filtering',
        description: 'Filter alerts by severity, category, or source',
        required: false,
        parameters: {
          severities: 'Array of severity levels to include',
          categories: 'Array of alert categories to include',
          sources: 'Array of alert sources to include',
        },
      },
      {
        name: 'field_mapping',
        description: 'Map SIEM fields to AVIAN standard fields',
        required: false,
        parameters: {
          fieldMappings: 'Object mapping SIEM fields to AVIAN fields',
        },
      },
    ];
  }

  async initialize(): Promise<ConnectorResult<void>> {
    try {
      this.log('info', 'Initializing SIEM connector');
      
      // Validate required configuration
      if (!this.config.settings.apiUrl) {
        return this.createResult(false, undefined, {
          code: 'MISSING_API_URL',
          message: 'API URL is required for SIEM connector',
        });
      }

      if (!this.config.credentials.apiKey && !this.config.credentials.token) {
        return this.createResult(false, undefined, {
          code: 'MISSING_CREDENTIALS',
          message: 'API key or token is required for SIEM connector',
        });
      }

      this.updateHealth(ConnectorStatus.CONFIGURING, 'Connector initialized');
      return this.createResult(true);
    } catch (error) {
      this.updateHealth(ConnectorStatus.ERROR, error instanceof Error ? error.message : 'Initialization failed');
      return this.createResult(false, undefined, {
        code: 'INITIALIZATION_FAILED',
        message: error instanceof Error ? error.message : 'Initialization failed',
      });
    }
  }

  async validateConfig(config: ConnectorConfig): Promise<ConnectorResult<boolean>> {
    try {
      const siemConfig = config as SiemConnectorConfig;
      
      // Validate required fields
      if (!siemConfig.settings.apiUrl) {
        return this.createResult(false, false, {
          code: 'INVALID_CONFIG',
          message: 'API URL is required',
        });
      }

      // Validate URL format
      try {
        new URL(siemConfig.settings.apiUrl);
      } catch (error) {
        return this.createResult(false, false, {
          code: 'INVALID_URL',
          message: 'Invalid API URL format',
        });
      }

      // Validate credentials
      const hasApiKey = siemConfig.credentials.apiKey;
      const hasToken = siemConfig.credentials.token;
      const hasUserPass = siemConfig.credentials.username && siemConfig.credentials.password;
      const hasOAuth = siemConfig.credentials.clientId && siemConfig.credentials.clientSecret;

      if (!hasApiKey && !hasToken && !hasUserPass && !hasOAuth) {
        return this.createResult(false, false, {
          code: 'MISSING_CREDENTIALS',
          message: 'At least one authentication method is required',
        });
      }

      return this.createResult(true, true);
    } catch (error) {
      return this.createResult(false, false, {
        code: 'CONFIG_VALIDATION_FAILED',
        message: error instanceof Error ? error.message : 'Configuration validation failed',
      });
    }
  }

  async testConnection(): Promise<ConnectorResult<boolean>> {
    const startTime = Date.now();
    
    try {
      this.log('info', 'Testing SIEM connection');
      this.updateHealth(ConnectorStatus.TESTING, 'Testing connection');

      // Make a test API call
      const response = await this.makeApiCall('/health', 'GET');
      
      if (response.ok) {
        this.updateHealth(ConnectorStatus.CONNECTED, 'Connection test successful', {
          responseTime: Date.now() - startTime,
        });
        return this.createResult(true, true, undefined, undefined, startTime);
      } else {
        this.updateHealth(ConnectorStatus.ERROR, `Connection test failed: ${response.statusText}`);
        return this.createResult(false, false, {
          code: 'CONNECTION_TEST_FAILED',
          message: `HTTP ${response.status}: ${response.statusText}`,
        }, undefined, startTime);
      }
    } catch (error) {
      this.updateHealth(ConnectorStatus.ERROR, error instanceof Error ? error.message : 'Connection test failed');
      return this.createResult(false, false, {
        code: 'CONNECTION_TEST_ERROR',
        message: error instanceof Error ? error.message : 'Connection test failed',
      }, undefined, startTime);
    }
  }

  async connect(): Promise<ConnectorResult<void>> {
    try {
      this.log('info', 'Connecting to SIEM system');
      
      // Test connection first
      const testResult = await this.testConnection();
      if (!testResult.success) {
        return testResult as ConnectorResult<void>;
      }

      // Start polling if configured
      if (this.config.settings.pollInterval && this.config.settings.pollInterval > 0) {
        this.startPolling();
      }

      this.updateHealth(ConnectorStatus.CONNECTED, 'Successfully connected to SIEM system');
      return this.createResult(true);
    } catch (error) {
      this.updateHealth(ConnectorStatus.ERROR, error instanceof Error ? error.message : 'Connection failed');
      return this.createResult(false, undefined, {
        code: 'CONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  }

  async disconnect(): Promise<ConnectorResult<void>> {
    try {
      this.log('info', 'Disconnecting from SIEM system');
      
      // Stop polling
      this.stopPolling();
      
      this.updateHealth(ConnectorStatus.DISCONNECTED, 'Disconnected from SIEM system');
      return this.createResult(true);
    } catch (error) {
      return this.createResult(false, undefined, {
        code: 'DISCONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Disconnection failed',
      });
    }
  }

  async processIncomingData(data: any): Promise<ConnectorResult<ConnectorEvent[]>> {
    try {
      this.log('info', 'Processing incoming SIEM data', { dataType: typeof data });
      
      // Handle different data formats
      let alerts: SiemAlert[] = [];
      
      if (Array.isArray(data)) {
        alerts = data.map(item => this.mapSiemAlert(item));
      } else if (data.alerts && Array.isArray(data.alerts)) {
        alerts = data.alerts.map((item: any) => this.mapSiemAlert(item));
      } else {
        alerts = [this.mapSiemAlert(data)];
      }

      // Apply filters
      const filteredAlerts = this.applyFilters(alerts);
      
      // Convert to connector events
      const events: ConnectorEvent[] = filteredAlerts.map(alert => ({
        id: `siem_${alert.id}`,
        type: WebhookEventType.ALERT_CREATED,
        timestamp: new Date(alert.timestamp),
        data: alert,
        source: this.config.name,
        tenantId: this.extractTenantId(alert),
      }));

      this.log('info', `Processed ${events.length} SIEM alerts`);
      return this.createResult(true, events);
    } catch (error) {
      this.log('error', 'Failed to process incoming SIEM data', error);
      return this.createResult(false, [], {
        code: 'DATA_PROCESSING_FAILED',
        message: error instanceof Error ? error.message : 'Data processing failed',
      });
    }
  }

  async sendData(data: any): Promise<ConnectorResult<any>> {
    try {
      this.log('info', 'Sending data to SIEM system');
      
      // This would typically be used to send acknowledgments or updates back to the SIEM
      const response = await this.makeApiCall('/alerts/acknowledge', 'POST', data);
      
      if (response.ok) {
        const responseData = await response.json();
        return this.createResult(true, responseData);
      } else {
        return this.createResult(false, undefined, {
          code: 'SEND_DATA_FAILED',
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error) {
      return this.createResult(false, undefined, {
        code: 'SEND_DATA_ERROR',
        message: error instanceof Error ? error.message : 'Send data failed',
      });
    }
  }

  /**
   * Start polling for new alerts
   */
  private startPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    const interval = (this.config.settings.pollInterval || 300) * 1000; // Convert to milliseconds
    
    this.pollTimer = setInterval(async () => {
      try {
        await this.pollForAlerts();
      } catch (error) {
        this.log('error', 'Polling error', error);
      }
    }, interval);

    this.log('info', `Started polling with interval: ${interval}ms`);
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
      this.log('info', 'Stopped polling');
    }
  }

  /**
   * Poll for new alerts
   */
  private async pollForAlerts(): Promise<void> {
    try {
      const since = this.lastPollTime || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours if no previous poll
      const batchSize = this.config.settings.batchSize || 100;

      const queryParams = new URLSearchParams({
        since: since.toISOString(),
        limit: batchSize.toString(),
      });

      const response = await this.makeApiCall(`/alerts?${queryParams}`, 'GET');
      
      if (response.ok) {
        const data = await response.json();
        const _result = await this.processIncomingData(data);
        
        if (result.success && result.data) {
          // Process events (this would typically trigger webhook delivery or direct processing)
          for (const event of result.data) {
            this.log('info', `New alert: ${event.data.title}`);
            // Here you would typically send the event to the webhook processor
          }
        }

        this.lastPollTime = new Date();
      } else {
        this.log('error', `Polling failed: HTTP ${response.status}`);
      }
    } catch (error) {
      this.log('error', 'Polling error', error);
    }
  }

  /**
   * Make API call to SIEM system
   */
  private async makeApiCall(endpoint: string, method: string, body?: any): Promise<Response> {
    const url = `${this.config.settings.apiUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AVIAN-SIEM-Connector/1.0',
    };

    // Add authentication headers
    if (this.config.credentials.apiKey) {
      headers['X-API-Key'] = this.config.credentials.apiKey;
    } else if (this.config.credentials.token) {
      headers['Authorization'] = `Bearer ${this.config.credentials.token}`;
    } else if (this.config.credentials.username && this.config.credentials.password) {
      const auth = Buffer.from(`${this.config.credentials.username}:${this.config.credentials.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      requestOptions.body = JSON.stringify(body);
    }

    return fetch(url, requestOptions);
  }

  /**
   * Map SIEM alert to standard format
   */
  private mapSiemAlert(siemData: any): SiemAlert {
    const mappings = this.config.settings.fieldMappings || {};
    
    return {
      id: siemData[mappings.id || 'id'] || siemData.id,
      title: siemData[mappings.title || 'title'] || siemData.name || siemData.summary,
      description: siemData[mappings.description || 'description'] || siemData.details || '',
      severity: this.mapSeverity(siemData[mappings.severity || 'severity'] || siemData.priority),
      category: siemData[mappings.category || 'category'] || siemData.type || 'other',
      source: siemData[mappings.source || 'source'] || this.config.name,
      timestamp: siemData[mappings.timestamp || 'timestamp'] || siemData.created_at || new Date().toISOString(),
      status: siemData[mappings.status || 'status'] || 'open',
      rawData: siemData,
      indicators: this.extractIndicators(siemData),
    };
  }

  /**
   * Map SIEM severity to standard severity levels
   */
  private mapSeverity(siemSeverity: any): 'low' | 'medium' | 'high' | 'critical' {
    const severity = String(siemSeverity).toLowerCase();
    
    if (severity.includes('critical') || severity.includes('5') || severity === 'high') {
      return 'critical';
    } else if (severity.includes('high') || severity.includes('4')) {
      return 'high';
    } else if (severity.includes('medium') || severity.includes('3') || severity.includes('moderate')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Extract threat indicators from SIEM data
   */
  private extractIndicators(siemData: any): Array<{ type: string; value: string; confidence?: number }> {
    const indicators: Array<{ type: string; value: string; confidence?: number }> = [];
    
    // Common indicator fields
    const indicatorFields = {
      ip: ['src_ip', 'dst_ip', 'source_ip', 'dest_ip', 'ip_address'],
      domain: ['domain', 'hostname', 'fqdn'],
      url: ['url', 'uri'],
      hash: ['md5', 'sha1', 'sha256', 'file_hash'],
      email: ['email', 'sender', 'recipient'],
    };

    for (const [type, fields] of Object.entries(indicatorFields)) {
      for (const field of fields) {
        if (siemData[field]) {
          indicators.push({
            type,
            value: siemData[field],
            confidence: siemData[`${field}_confidence`] || 80,
          });
        }
      }
    }

    return indicators;
  }

  /**
   * Apply configured filters to alerts
   */
  private applyFilters(alerts: SiemAlert[]): SiemAlert[] {
    const filters = this.config.settings.alertFilters;
    if (!filters) return alerts;

    return alerts.filter(alert => {
      // Filter by severity
      if (filters.severities && filters.severities.length > 0) {
        if (!filters.severities.includes(alert.severity)) {
          return false;
        }
      }

      // Filter by category
      if (filters.categories && filters.categories.length > 0) {
        if (!filters.categories.includes(alert.category)) {
          return false;
        }
      }

      // Filter by source
      if (filters.sources && filters.sources.length > 0) {
        if (!filters.sources.includes(alert.source)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Extract tenant ID from alert data
   */
  private extractTenantId(alert: SiemAlert): string | undefined {
    // This would be customized based on how the SIEM system identifies tenants
    // Common approaches:
    // 1. Tenant ID in alert metadata
    // 2. Source IP mapping to tenant
    // 3. Custom field in SIEM data
    
    if (alert.rawData.tenant_id) {
      return alert.rawData.tenant_id;
    }
    
    if (alert.rawData.customer_id) {
      return alert.rawData.customer_id;
    }
    
    // Could also map based on source IP ranges, domains, etc.
    return undefined;
  }
}