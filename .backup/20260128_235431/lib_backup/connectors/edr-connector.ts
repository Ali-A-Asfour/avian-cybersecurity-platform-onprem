import { logger } from '@/lib/logger';
import { DataSource, SecurityEvent, NormalizedEvent, EventSeverity, ThreatIndicator } from '@/services/data-ingestion.service';
import { dataIngestionService } from '@/services/data-ingestion.service';

export interface EDREvent {
  id: string;
  timestamp: string;
  event_type: string;
  severity: string;
  endpoint: {
    hostname: string;
    ip_address: string;
    os: string;
    user?: string;
  };
  process?: {
    name: string;
    pid: number;
    path: string;
    command_line?: string;
    hash?: string;
  };
  file?: {
    path: string;
    hash: string;
    size?: number;
  };
  network?: {
    source_ip: string;
    destination_ip: string;
    source_port: number;
    destination_port: number;
    protocol: string;
  };
  threat?: {
    name: string;
    category: string;
    confidence: number;
    indicators: Array<{
      type: string;
      value: string;
    }>;
  };
  raw_data: Record<string, any>;
}

export abstract class BaseEDRConnector {
  protected dataSource: DataSource;
  protected isRunning: boolean = false;
  protected pollingInterval?: NodeJS.Timeout;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  abstract authenticate(): Promise<boolean>;
  abstract fetchEvents(since?: Date): Promise<EDREvent[]>;
  abstract testConnection(): Promise<{ success: boolean; message: string }>;

  async start(): Promise<void> {
    try {
      logger.info('Starting EDR connector', { 
        dataSourceId: this.dataSource.id, 
        type: this.dataSource.type 
      });

      const authSuccess = await this.authenticate();
      if (!authSuccess) {
        throw new Error('Authentication failed');
      }

      this.isRunning = true;
      
      // Start polling for events
      const interval = this.dataSource.connection_config.polling_interval || 60000; // Default 1 minute
      this.pollingInterval = setInterval(async () => {
        if (this.isRunning) {
          await this.pollEvents();
        }
      }, interval);

      // Initial poll
      await this.pollEvents();

      logger.info('EDR connector started successfully', { 
        dataSourceId: this.dataSource.id 
      });
    } catch (error) {
      logger.error('Failed to start EDR connector', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = undefined;
      }

      logger.info('EDR connector stopped', { 
        dataSourceId: this.dataSource.id 
      });
    } catch (error) {
      logger.error('Failed to stop EDR connector', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
    }
  }

  protected async pollEvents(): Promise<void> {
    try {
      // Get last poll time from cache or use 1 hour ago
      const lastPoll = await this.getLastPollTime();
      const events = await this.fetchEvents(lastPoll);

      logger.debug('Fetched EDR events', { 
        dataSourceId: this.dataSource.id, 
        eventCount: events.length 
      });

      for (const event of events) {
        await this.processEvent(event);
      }

      // Update last poll time
      await this.setLastPollTime(new Date());
    } catch (error) {
      logger.error('Failed to poll EDR events', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
    }
  }

  protected async processEvent(edrEvent: EDREvent): Promise<void> {
    try {
      const normalizedEvent = this.normalizeEvent(edrEvent);
      
      const securityEvent: Omit<SecurityEvent, 'id' | 'processed_at'> = {
        source_type: this.dataSource.type,
        source_id: this.dataSource.id,
        tenant_id: this.dataSource.tenant_id,
        asset_id: await this.resolveAssetId(edrEvent.endpoint.hostname, edrEvent.endpoint.ip_address),
        event_type: edrEvent.event_type,
        severity: this.mapSeverity(edrEvent.severity),
        timestamp: new Date(edrEvent.timestamp),
        raw_data: edrEvent.raw_data,
        normalized_data: normalizedEvent,
        tags: this.generateTags(edrEvent)
      };

      await dataIngestionService.ingestSecurityEvent(securityEvent);
    } catch (error) {
      logger.error('Failed to process EDR event', { 
        error, 
        eventId: edrEvent.id,
        dataSourceId: this.dataSource.id 
      });
    }
  }

  protected normalizeEvent(edrEvent: EDREvent): NormalizedEvent {
    const threatIndicators: ThreatIndicator[] = [];
    
    if (edrEvent.threat?.indicators) {
      threatIndicators.push(...edrEvent.threat.indicators.map(indicator => ({
        type: indicator.type,
        value: indicator.value,
        confidence: edrEvent.threat?.confidence || 0.5
      })));
    }

    // Add file hash as indicator if available
    if (edrEvent.file?.hash) {
      threatIndicators.push({
        type: 'file_hash',
        value: edrEvent.file.hash,
        confidence: 0.8
      });
    }

    // Add process hash as indicator if available
    if (edrEvent.process?.hash) {
      threatIndicators.push({
        type: 'process_hash',
        value: edrEvent.process.hash,
        confidence: 0.8
      });
    }

    return {
      event_id: edrEvent.id,
      event_type: edrEvent.event_type,
      severity: this.mapSeverity(edrEvent.severity),
      source_ip: edrEvent.network?.source_ip || edrEvent.endpoint.ip_address,
      destination_ip: edrEvent.network?.destination_ip,
      source_port: edrEvent.network?.source_port,
      destination_port: edrEvent.network?.destination_port,
      protocol: edrEvent.network?.protocol,
      user: edrEvent.endpoint.user,
      process: edrEvent.process?.name,
      file_path: edrEvent.file?.path || edrEvent.process?.path,
      hash: edrEvent.file?.hash || edrEvent.process?.hash,
      command_line: edrEvent.process?.command_line,
      description: this.generateDescription(edrEvent),
      threat_indicators: threatIndicators
    };
  }

  protected mapSeverity(edrSeverity: string): EventSeverity {
    const severity = edrSeverity.toLowerCase();
    
    if (severity.includes('critical') || severity.includes('high')) {
      return EventSeverity.CRITICAL;
    } else if (severity.includes('medium') || severity.includes('moderate')) {
      return EventSeverity.MEDIUM;
    } else if (severity.includes('low') || severity.includes('info')) {
      return EventSeverity.LOW;
    } else {
      return EventSeverity.MEDIUM; // Default
    }
  }

  protected generateDescription(edrEvent: EDREvent): string {
    let description = `EDR Event: ${edrEvent.event_type}`;
    
    if (edrEvent.threat?.name) {
      description += ` - Threat: ${edrEvent.threat.name}`;
    }
    
    if (edrEvent.process?.name) {
      description += ` - Process: ${edrEvent.process.name}`;
    }
    
    if (edrEvent.file?.path) {
      description += ` - File: ${edrEvent.file.path}`;
    }
    
    return description;
  }

  protected generateTags(edrEvent: EDREvent): string[] {
    const tags: string[] = ['edr', this.dataSource.type];
    
    if (edrEvent.threat?.category) {
      tags.push(`threat:${edrEvent.threat.category}`);
    }
    
    if (edrEvent.endpoint.os) {
      tags.push(`os:${edrEvent.endpoint.os.toLowerCase()}`);
    }
    
    if (edrEvent.process?.name) {
      tags.push(`process:${edrEvent.process.name}`);
    }
    
    return tags;
  }

  protected async resolveAssetId(hostname: string, ipAddress: string): Promise<string | undefined> {
    // This would query the asset management system to find the asset ID
    // For now, return undefined - this would be implemented with actual asset lookup
    return undefined;
  }

  protected async getLastPollTime(): Promise<Date> {
    // This would get the last poll time from cache/database
    // For now, return 1 hour ago
    return new Date(Date.now() - 60 * 60 * 1000);
  }

  protected async setLastPollTime(time: Date): Promise<void> {
    // This would store the last poll time in cache/database
    // Implementation would go here
  }
}

// Avast EDR Connector Implementation
export class AvastEDRConnector extends BaseEDRConnector {
  private apiToken?: string;

  async authenticate(): Promise<boolean> {
    try {
      const { api_key, endpoint } = this.dataSource.connection_config;
      
      if (!api_key || !endpoint) {
        throw new Error('Missing API key or endpoint configuration');
      }

      // Avast EDR authentication
      const response = await fetch(`${endpoint}/api/v1/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': api_key
        },
        body: JSON.stringify({
          grant_type: 'api_key'
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const authData = await response.json();
      this.apiToken = authData.access_token;

      return true;
    } catch (error) {
      logger.error('Avast EDR authentication failed', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
      return false;
    }
  }

  async fetchEvents(since?: Date): Promise<EDREvent[]> {
    try {
      if (!this.apiToken) {
        throw new Error('Not authenticated');
      }

      const { endpoint } = this.dataSource.connection_config;
      const sinceParam = since ? `&since=${since.toISOString()}` : '';
      
      const response = await fetch(`${endpoint}/api/v1/events?limit=1000${sinceParam}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`);
      }

      const data = await response.json();
      return this.transformAvastEvents(data.events || []);
    } catch (error) {
      logger.error('Failed to fetch Avast EDR events', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
      return [];
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const authSuccess = await this.authenticate();
      if (!authSuccess) {
        return { success: false, message: 'Authentication failed' };
      }

      // Test by fetching a small number of events
      const events = await this.fetchEvents();
      return { 
        success: true, 
        message: `Connection successful. Found ${events.length} recent events.` 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      };
    }
  }

  private transformAvastEvents(avastEvents: any[]): EDREvent[] {
    return avastEvents.map(event => ({
      id: event.id || crypto.randomUUID(),
      timestamp: event.timestamp || new Date().toISOString(),
      event_type: event.event_type || 'unknown',
      severity: event.severity || 'medium',
      endpoint: {
        hostname: event.endpoint?.hostname || 'unknown',
        ip_address: event.endpoint?.ip_address || '0.0.0.0',
        os: event.endpoint?.os || 'unknown',
        user: event.endpoint?.user
      },
      process: event.process ? {
        name: event.process.name,
        pid: event.process.pid || 0,
        path: event.process.path || '',
        command_line: event.process.command_line,
        hash: event.process.hash
      } : undefined,
      file: event.file ? {
        path: event.file.path,
        hash: event.file.hash,
        size: event.file.size
      } : undefined,
      network: event.network ? {
        source_ip: event.network.source_ip,
        destination_ip: event.network.destination_ip,
        source_port: event.network.source_port || 0,
        destination_port: event.network.destination_port || 0,
        protocol: event.network.protocol || 'tcp'
      } : undefined,
      threat: event.threat ? {
        name: event.threat.name,
        category: event.threat.category || 'unknown',
        confidence: event.threat.confidence || 0.5,
        indicators: event.threat.indicators || []
      } : undefined,
      raw_data: event
    }));
  }
}

// Generic EDR Connector for other vendors
export class GenericEDRConnector extends BaseEDRConnector {
  async authenticate(): Promise<boolean> {
    try {
      const { username, password, api_key, endpoint } = this.dataSource.connection_config;
      
      if (!endpoint) {
        throw new Error('Missing endpoint configuration');
      }

      // Generic authentication - could be API key or username/password
      if (api_key) {
        // API key authentication
        const response = await fetch(`${endpoint}/api/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': api_key
          }
        });
        return response.ok;
      } else if (username && password) {
        // Basic authentication
        const response = await fetch(`${endpoint}/api/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
          }
        });
        return response.ok;
      }

      return false;
    } catch (error) {
      logger.error('Generic EDR authentication failed', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
      return false;
    }
  }

  async fetchEvents(since?: Date): Promise<EDREvent[]> {
    try {
      const { endpoint, api_key, username, password } = this.dataSource.connection_config;
      const sinceParam = since ? `&since=${since.toISOString()}` : '';
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (api_key) {
        headers['X-API-Key'] = api_key;
      } else if (username && password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      }

      const response = await fetch(`${endpoint}/api/events?limit=1000${sinceParam}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch events: ${response.statusText}`);
      }

      const data = await response.json();
      return this.transformGenericEvents(data.events || data || []);
    } catch (error) {
      logger.error('Failed to fetch generic EDR events', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
      return [];
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const authSuccess = await this.authenticate();
      if (!authSuccess) {
        return { success: false, message: 'Authentication failed' };
      }

      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      };
    }
  }

  private transformGenericEvents(events: any[]): EDREvent[] {
    return events.map(event => ({
      id: event.id || event.event_id || crypto.randomUUID(),
      timestamp: event.timestamp || event.time || new Date().toISOString(),
      event_type: event.event_type || event.type || 'unknown',
      severity: event.severity || event.level || 'medium',
      endpoint: {
        hostname: event.hostname || event.host || event.endpoint?.hostname || 'unknown',
        ip_address: event.ip_address || event.ip || event.endpoint?.ip || '0.0.0.0',
        os: event.os || event.platform || event.endpoint?.os || 'unknown',
        user: event.user || event.username || event.endpoint?.user
      },
      process: event.process ? {
        name: event.process.name || event.process_name,
        pid: event.process.pid || event.process_id || 0,
        path: event.process.path || event.process_path || '',
        command_line: event.process.command_line || event.command,
        hash: event.process.hash || event.process_hash
      } : undefined,
      file: event.file ? {
        path: event.file.path || event.file_path,
        hash: event.file.hash || event.file_hash,
        size: event.file.size || event.file_size
      } : undefined,
      network: event.network ? {
        source_ip: event.network.source_ip || event.src_ip,
        destination_ip: event.network.destination_ip || event.dst_ip,
        source_port: event.network.source_port || event.src_port || 0,
        destination_port: event.network.destination_port || event.dst_port || 0,
        protocol: event.network.protocol || event.protocol || 'tcp'
      } : undefined,
      threat: event.threat ? {
        name: event.threat.name || event.threat_name,
        category: event.threat.category || event.threat_type || 'unknown',
        confidence: event.threat.confidence || event.confidence || 0.5,
        indicators: event.threat.indicators || []
      } : undefined,
      raw_data: event
    }));
  }
}

export function createEDRConnector(dataSource: DataSource): BaseEDRConnector {
  switch (dataSource.type) {
    case 'edr_avast':
      return new AvastEDRConnector(dataSource);
    case 'edr_crowdstrike':
    case 'edr_sentinelone':
    case 'edr_generic':
    default:
      return new GenericEDRConnector(dataSource);
  }
}