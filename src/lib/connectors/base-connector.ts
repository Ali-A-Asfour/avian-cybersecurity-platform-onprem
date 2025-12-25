/**
 * Base connector interface and abstract class for external system integrations
 */

export interface ConnectorConfig {
  id: string;
  name: string;
  type: ConnectorType;
  enabled: boolean;
  settings: Record<string, any>;
  credentials?: Record<string, string>;
  metadata?: {
    version: string;
    description?: string;
    author?: string;
    tags?: string[];
  };
}

export enum ConnectorType {
  SIEM = 'siem',
  THREAT_INTELLIGENCE = 'threat_intelligence',
  TICKETING = 'ticketing',
  NOTIFICATION = 'notification',
  COMPLIANCE = 'compliance',
  IDENTITY_PROVIDER = 'identity_provider',
  CLOUD_SECURITY = 'cloud_security',
  VULNERABILITY_SCANNER = 'vulnerability_scanner',
  EMAIL = 'email',
  CHAT = 'chat',
  CUSTOM = 'custom',
}

export enum ConnectorStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  CONFIGURING = 'configuring',
  TESTING = 'testing',
}

export interface ConnectorCapability {
  name: string;
  description: string;
  required: boolean;
  parameters?: Record<string, any>;
}

export interface ConnectorHealth {
  status: ConnectorStatus;
  lastCheck: Date;
  message?: string;
  metrics?: {
    uptime: number;
    responseTime: number;
    errorRate: number;
    requestCount: number;
  };
}

export interface ConnectorEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: any;
  source: string;
  tenantId?: string;
}

export interface ConnectorResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId?: string;
    timestamp: Date;
    duration?: number;
  };
}

/**
 * Abstract base connector class
 */
export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected health: ConnectorHealth;

  constructor(config: ConnectorConfig) {
    this.config = config;
    this.health = {
      status: ConnectorStatus.DISCONNECTED,
      lastCheck: new Date(),
    };
  }

  /**
   * Get connector information
   */
  getInfo(): ConnectorConfig {
    return { ...this.config };
  }

  /**
   * Get connector health status
   */
  getHealth(): ConnectorHealth {
    return { ...this.health };
  }

  /**
   * Get connector capabilities
   */
  abstract getCapabilities(): ConnectorCapability[];

  /**
   * Initialize the connector
   */
  abstract initialize(): Promise<ConnectorResult<void>>;

  /**
   * Test the connector connection
   */
  abstract testConnection(): Promise<ConnectorResult<boolean>>;

  /**
   * Connect to the external system
   */
  abstract connect(): Promise<ConnectorResult<void>>;

  /**
   * Disconnect from the external system
   */
  abstract disconnect(): Promise<ConnectorResult<void>>;

  /**
   * Update connector configuration
   */
  async updateConfig(newConfig: Partial<ConnectorConfig>): Promise<ConnectorResult<void>> {
    try {
      this.config = { ...this.config, ...newConfig };
      
      // Reinitialize if connector was connected
      if (this.health.status === ConnectorStatus.CONNECTED) {
        await this.disconnect();
        await this.connect();
      }

      return { success: true, metadata: { timestamp: new Date() } };
    } catch {
      return {
        success: false,
        error: {
          code: 'CONFIG_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Configuration update failed',
        },
        metadata: { timestamp: new Date() },
      };
    }
  }

  /**
   * Validate connector configuration
   */
  abstract validateConfig(config: ConnectorConfig): Promise<ConnectorResult<boolean>>;

  /**
   * Process incoming data from external system
   */
  abstract processIncomingData(data: any): Promise<ConnectorResult<ConnectorEvent[]>>;

  /**
   * Send data to external system
   */
  abstract sendData(data: any): Promise<ConnectorResult<any>>;

  /**
   * Update health status
   */
  protected updateHealth(status: ConnectorStatus, message?: string, metrics?: any): void {
    this.health = {
      status,
      lastCheck: new Date(),
      message,
      metrics,
    };
  }

  /**
   * Create a standardized result
   */
  protected createResult<T>(
    success: boolean,
    data?: T,
    error?: { code: string; message: string; details?: any },
    requestId?: string,
    startTime?: number
  ): ConnectorResult<T> {
    return {
      success,
      data,
      error,
      metadata: {
        requestId,
        timestamp: new Date(),
        duration: startTime ? Date.now() - startTime : undefined,
      },
    };
  }

  /**
   * Log connector activity
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      connector: this.config.name,
      connectorId: this.config.id,
      message,
      data,
    };

    console.log(`[${logEntry.level}] Connector ${logEntry.connector}:`, logEntry.message, data || '');
  }
}

/**
 * Connector registry for managing all connectors
 */
export class ConnectorRegistry {
  private static connectors = new Map<string, BaseConnector>();
  private static factories = new Map<ConnectorType, (config: ConnectorConfig) => BaseConnector>();

  /**
   * Register a connector factory
   */
  static registerFactory(type: ConnectorType, factory: (config: ConnectorConfig) => BaseConnector): void {
    this.factories.set(type, factory);
  }

  /**
   * Create and register a connector
   */
  static async createConnector(config: ConnectorConfig): Promise<ConnectorResult<BaseConnector>> {
    try {
      const factory = this.factories.get(config.type);
      if (!factory) {
        return {
          success: false,
          error: {
            code: 'UNKNOWN_CONNECTOR_TYPE',
            message: `No factory registered for connector type: ${config.type}`,
          },
          metadata: { timestamp: new Date() },
        };
      }

      const connector = factory(config);
      
      // Validate configuration
      const validationResult = await connector.validateConfig(config);
      if (!validationResult.success) {
        return validationResult as ConnectorResult<BaseConnector>;
      }

      // Initialize connector
      const initResult = await connector.initialize();
      if (!initResult.success) {
        return initResult as ConnectorResult<BaseConnector>;
      }

      // Register connector
      this.connectors.set(config.id, connector);

      return {
        success: true,
        data: connector,
        metadata: { timestamp: new Date() },
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'CONNECTOR_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Connector creation failed',
        },
        metadata: { timestamp: new Date() },
      };
    }
  }

  /**
   * Get a connector by ID
   */
  static getConnector(id: string): BaseConnector | null {
    return this.connectors.get(id) || null;
  }

  /**
   * Get all connectors
   */
  static getAllConnectors(): BaseConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Get connectors by type
   */
  static getConnectorsByType(type: ConnectorType): BaseConnector[] {
    return Array.from(this.connectors.values()).filter(
      connector => connector.getInfo().type === type
    );
  }

  /**
   * Remove a connector
   */
  static async removeConnector(id: string): Promise<ConnectorResult<void>> {
    try {
      const connector = this.connectors.get(id);
      if (!connector) {
        return {
          success: false,
          error: {
            code: 'CONNECTOR_NOT_FOUND',
            message: `Connector with ID ${id} not found`,
          },
          metadata: { timestamp: new Date() },
        };
      }

      // Disconnect before removing
      await connector.disconnect();
      this.connectors.delete(id);

      return {
        success: true,
        metadata: { timestamp: new Date() },
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'CONNECTOR_REMOVAL_FAILED',
          message: error instanceof Error ? error.message : 'Connector removal failed',
        },
        metadata: { timestamp: new Date() },
      };
    }
  }

  /**
   * Test all connectors
   */
  static async testAllConnectors(): Promise<ConnectorResult<{ [connectorId: string]: boolean }>> {
    const results: { [connectorId: string]: boolean } = {};

    for (const [id, connector] of this.connectors) {
      try {
        const testResult = await connector.testConnection();
        results[id] = testResult.success;
      } catch {
        results[id] = false;
      }
    }

    return {
      success: true,
      data: results,
      metadata: { timestamp: new Date() },
    };
  }

  /**
   * Get health status of all connectors
   */
  static getHealthStatus(): { [connectorId: string]: ConnectorHealth } {
    const healthStatus: { [connectorId: string]: ConnectorHealth } = {};

    for (const [id, connector] of this.connectors) {
      healthStatus[id] = connector.getHealth();
    }

    return healthStatus;
  }
}

/**
 * Connector manager for high-level operations
 */
export class ConnectorManager {
  /**
   * Initialize all connectors from configuration
   */
  static async initializeFromConfig(configs: ConnectorConfig[]): Promise<ConnectorResult<void>> {
    const results: ConnectorResult<BaseConnector>[] = [];

    for (const config of configs) {
      if (config.enabled) {
        const _result = await ConnectorRegistry.createConnector(config);
        results.push(result);

        if (result.success && result.data) {
          // Auto-connect if initialization was successful
          await result.data.connect();
        }
      }
    }

    const failedConnectors = results.filter(r => !r.success);
    
    if (failedConnectors.length > 0) {
      return {
        success: false,
        error: {
          code: 'PARTIAL_INITIALIZATION_FAILURE',
          message: `${failedConnectors.length} connectors failed to initialize`,
          details: failedConnectors.map(r => r.error),
        },
        metadata: { timestamp: new Date() },
      };
    }

    return {
      success: true,
      metadata: { timestamp: new Date() },
    };
  }

  /**
   * Gracefully shutdown all connectors
   */
  static async shutdown(): Promise<ConnectorResult<void>> {
    const connectors = ConnectorRegistry.getAllConnectors();
    const disconnectPromises = connectors.map(connector => connector.disconnect());

    try {
      await Promise.all(disconnectPromises);
      return {
        success: true,
        metadata: { timestamp: new Date() },
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'SHUTDOWN_FAILED',
          message: error instanceof Error ? error.message : 'Connector shutdown failed',
        },
        metadata: { timestamp: new Date() },
      };
    }
  }

  /**
   * Perform health checks on all connectors
   */
  static async performHealthChecks(): Promise<ConnectorResult<{ [connectorId: string]: ConnectorHealth }>> {
    const connectors = ConnectorRegistry.getAllConnectors();
    const healthPromises = connectors.map(async connector => {
      try {
        await connector.testConnection();
        return { id: connector.getInfo().id, health: connector.getHealth() };
      } catch {
        return {
          id: connector.getInfo().id,
          health: {
            status: ConnectorStatus.ERROR,
            lastCheck: new Date(),
            message: error instanceof Error ? error.message : 'Health check failed',
          } as ConnectorHealth,
        };
      }
    });

    try {
      const results = await Promise.all(healthPromises);
      const healthStatus: { [connectorId: string]: ConnectorHealth } = {};

      for (const result of results) {
        healthStatus[result.id] = result.health;
      }

      return {
        success: true,
        data: healthStatus,
        metadata: { timestamp: new Date() },
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Health check failed',
        },
        metadata: { timestamp: new Date() },
      };
    }
  }
}