// import { logger } from '@/lib/logger';
import { DataSource, SecurityEvent, NormalizedEvent, EventSeverity, ThreatIndicator } from '@/services/data-ingestion.service';
import { dataIngestionService } from '@/services/data-ingestion.service';
import * as dgram from 'dgram';
import * as tls from 'tls';
import * as net from 'net';

export interface FirewallEvent {
  id: string;
  timestamp: string;
  action: 'allow' | 'deny' | 'drop' | 'reject';
  source_ip: string;
  destination_ip: string;
  source_port: number;
  destination_port: number;
  protocol: string;
  interface?: string;
  rule_id?: string;
  rule_name?: string;
  bytes_sent?: number;
  bytes_received?: number;
  packet_count?: number;
  duration?: number;
  reason?: string;
  raw_data: Record<string, any>;
}

export abstract class BaseFirewallConnector {
  protected dataSource: DataSource;
  protected isRunning: boolean = false;
  protected pollingInterval?: NodeJS.Timeout;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  abstract authenticate(): Promise<boolean>;
  abstract fetchLogs(since?: Date): Promise<FirewallEvent[]>;
  abstract testConnection(): Promise<{ success: boolean; message: string }>;

  async start(): Promise<void> {
    try {
      logger.info('Starting firewall connector', { 
        dataSourceId: this.dataSource.id, 
        type: this.dataSource.type 
      });

      const authSuccess = await this.authenticate();
      if (!authSuccess) {
        throw new Error('Authentication failed');
      }

      this.isRunning = true;
      
      // Start polling for logs
      const interval = this.dataSource.connection_config.polling_interval || 30000; // Default 30 seconds
      this.pollingInterval = setInterval(async () => {
        if (this.isRunning) {
          await this.pollLogs();
        }
      }, interval);

      // Initial poll
      await this.pollLogs();

      logger.info('Firewall connector started successfully', { 
        dataSourceId: this.dataSource.id 
      });
    } catch (error) {
      logger.error('Failed to start firewall connector', { 
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

      logger.info('Firewall connector stopped', { 
        dataSourceId: this.dataSource.id 
      });
    } catch (error) {
      logger.error('Failed to stop firewall connector', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
    }
  }

  protected async pollLogs(): Promise<void> {
    try {
      const lastPoll = await this.getLastPollTime();
      const logs = await this.fetchLogs(lastPoll);

      logger.debug('Fetched firewall logs', { 
        dataSourceId: this.dataSource.id, 
        logCount: logs.length 
      });

      for (const log of logs) {
        await this.processLog(log);
      }

      await this.setLastPollTime(new Date());
    } catch (error) {
      logger.error('Failed to poll firewall logs', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
    }
  }

  protected async processLog(firewallEvent: FirewallEvent): Promise<void> {
    try {
      const normalizedEvent = this.normalizeEvent(firewallEvent);
      
      const securityEvent: Omit<SecurityEvent, 'id' | 'processed_at'> = {
        source_type: this.dataSource.type,
        source_id: this.dataSource.id,
        tenant_id: this.dataSource.tenant_id,
        asset_id: await this.resolveAssetId(firewallEvent.source_ip),
        event_type: `firewall_${firewallEvent.action}`,
        severity: this.mapSeverity(firewallEvent),
        timestamp: new Date(firewallEvent.timestamp),
        raw_data: firewallEvent.raw_data,
        normalized_data: normalizedEvent,
        tags: this.generateTags(firewallEvent)
      };

      await dataIngestionService.ingestSecurityEvent(securityEvent);
    } catch (error) {
      logger.error('Failed to process firewall log', { 
        error, 
        eventId: firewallEvent.id,
        dataSourceId: this.dataSource.id 
      });
    }
  }

  protected normalizeEvent(firewallEvent: FirewallEvent): NormalizedEvent {
    const threatIndicators: ThreatIndicator[] = [];
    
    // Add suspicious IPs as threat indicators
    if (firewallEvent.action === 'deny' || firewallEvent.action === 'drop') {
      threatIndicators.push({
        type: 'ip_address',
        value: firewallEvent.source_ip,
        confidence: 0.6
      });
    }

    return {
      event_id: firewallEvent.id,
      event_type: `firewall_${firewallEvent.action}`,
      severity: this.mapSeverity(firewallEvent),
      source_ip: firewallEvent.source_ip,
      destination_ip: firewallEvent.destination_ip,
      source_port: firewallEvent.source_port,
      destination_port: firewallEvent.destination_port,
      protocol: firewallEvent.protocol,
      description: this.generateDescription(firewallEvent),
      threat_indicators: threatIndicators
    };
  }

  protected mapSeverity(firewallEvent: FirewallEvent): EventSeverity {
    // Denied/dropped connections are more suspicious
    if (firewallEvent.action === 'deny' || firewallEvent.action === 'drop') {
      // High severity for common attack ports
      const suspiciousPorts = [22, 23, 135, 139, 445, 1433, 3389, 5432];
      if (suspiciousPorts.includes(firewallEvent.destination_port)) {
        return EventSeverity.HIGH;
      }
      return EventSeverity.MEDIUM;
    }
    
    return EventSeverity.LOW;
  }

  protected generateDescription(firewallEvent: FirewallEvent): string {
    let description = `Firewall ${firewallEvent.action.toUpperCase()}: `;
    description += `${firewallEvent.source_ip}:${firewallEvent.source_port} → `;
    description += `${firewallEvent.destination_ip}:${firewallEvent.destination_port} `;
    description += `(${firewallEvent.protocol.toUpperCase()})`;
    
    if (firewallEvent.rule_name) {
      description += ` - Rule: ${firewallEvent.rule_name}`;
    }
    
    if (firewallEvent.reason) {
      description += ` - Reason: ${firewallEvent.reason}`;
    }
    
    return description;
  }

  protected generateTags(firewallEvent: FirewallEvent): string[] {
    const tags: string[] = ['firewall', this.dataSource.type, firewallEvent.action];
    
    tags.push(`protocol:${firewallEvent.protocol}`);
    
    if (firewallEvent.interface) {
      tags.push(`interface:${firewallEvent.interface}`);
    }
    
    if (firewallEvent.rule_name) {
      tags.push(`rule:${firewallEvent.rule_name}`);
    }
    
    return tags;
  }

  protected async resolveAssetId(_ipAddress: string): Promise<string | undefined> {
    // This would query the asset management system to find the asset ID by IP
    return undefined;
  }

  protected async getLastPollTime(): Promise<Date> {
    // Return 5 minutes ago for firewall logs (more frequent polling)
    return new Date(Date.now() - 5 * 60 * 1000);
  }

  protected async setLastPollTime(time: Date): Promise<void> {
    // Implementation would store the last poll time
  }
}

// pfSense Firewall Connector
export class PfSenseConnector extends BaseFirewallConnector {
  async authenticate(): Promise<boolean> {
    try {
      const { username, password, endpoint } = this.dataSource.connection_config;
      
      if (!username || !password || !endpoint) {
        throw new Error('Missing authentication configuration');
      }

      // pfSense API authentication
      const response = await fetch(`${endpoint}/api/v1/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      return response.ok;
    } catch (error) {
      logger.error('pfSense authentication failed', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
      return false;
    }
  }

  async fetchLogs(since?: Date): Promise<FirewallEvent[]> {
    try {
      const { username, password, endpoint } = this.dataSource.connection_config;
      const sinceParam = since ? `&since=${Math.floor(since.getTime() / 1000)}` : '';
      
      const response = await fetch(`${endpoint}/api/v1/firewall/logs?limit=1000${sinceParam}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const data = await response.json();
      return this.transformPfSenseLogs(data.logs || []);
    } catch (error) {
      logger.error('Failed to fetch pfSense logs', { 
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

  private transformPfSenseLogs(logs: any[]): FirewallEvent[] {
    return logs.map(log => ({
      id: log.id || crypto.randomUUID(),
      timestamp: log.timestamp || new Date().toISOString(),
      action: this.mapPfSenseAction(log.action),
      source_ip: log.src_ip || '0.0.0.0',
      destination_ip: log.dst_ip || '0.0.0.0',
      source_port: parseInt(log.src_port) || 0,
      destination_port: parseInt(log.dst_port) || 0,
      protocol: log.protocol?.toLowerCase() || 'tcp',
      interface: log.interface,
      rule_id: log.rule_id,
      rule_name: log.rule_name,
      reason: log.reason,
      raw_data: log
    }));
  }

  private mapPfSenseAction(action: string): 'allow' | 'deny' | 'drop' | 'reject' {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower.includes('block') || actionLower.includes('deny')) {
      return 'deny';
    } else if (actionLower.includes('pass') || actionLower.includes('allow')) {
      return 'allow';
    } else if (actionLower.includes('reject')) {
      return 'reject';
    }
    return 'drop';
  }
}

// Fortinet Firewall Connector
export class FortinetConnector extends BaseFirewallConnector {
  private apiToken?: string;

  async authenticate(): Promise<boolean> {
    try {
      const { username, password, endpoint } = this.dataSource.connection_config;
      
      if (!username || !password || !endpoint) {
        throw new Error('Missing authentication configuration');
      }

      // Fortinet FortiOS API authentication
      const response = await fetch(`${endpoint}/api/v2/cmdb/system/admin`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
        }
      });

      if (response.ok) {
        // Extract session token if available
        const cookies = response.headers.get('set-cookie');
        if (cookies) {
          const tokenMatch = cookies.match(/ccsrftoken=([^;]+)/);
          if (tokenMatch) {
            this.apiToken = tokenMatch[1];
          }
        }
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Fortinet authentication failed', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
      return false;
    }
  }

  async fetchLogs(since?: Date): Promise<FirewallEvent[]> {
    try {
      const { username, password, endpoint } = this.dataSource.connection_config;
      
      const headers: Record<string, string> = {
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json'
      };

      if (this.apiToken) {
        headers['X-CSRFTOKEN'] = this.apiToken;
      }

      const response = await fetch(`${endpoint}/api/v2/log/memory`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const data = await response.json();
      return this.transformFortinetLogs(data.results || []);
    } catch (error) {
      logger.error('Failed to fetch Fortinet logs', { 
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

  private transformFortinetLogs(logs: any[]): FirewallEvent[] {
    return logs.map(log => ({
      id: log.id || crypto.randomUUID(),
      timestamp: log.date || new Date().toISOString(),
      action: this.mapFortinetAction(log.action),
      source_ip: log.srcip || '0.0.0.0',
      destination_ip: log.dstip || '0.0.0.0',
      source_port: parseInt(log.srcport) || 0,
      destination_port: parseInt(log.dstport) || 0,
      protocol: log.proto?.toLowerCase() || 'tcp',
      interface: log.srcintf,
      rule_id: log.policyid,
      rule_name: log.policyname,
      bytes_sent: parseInt(log.sentbyte) || 0,
      bytes_received: parseInt(log.rcvdbyte) || 0,
      duration: parseInt(log.duration) || 0,
      raw_data: log
    }));
  }

  private mapFortinetAction(action: string): 'allow' | 'deny' | 'drop' | 'reject' {
    const actionLower = action?.toLowerCase() || '';
    if (actionLower === 'deny' || actionLower === 'block') {
      return 'deny';
    } else if (actionLower === 'accept' || actionLower === 'allow') {
      return 'allow';
    }
    return 'drop';
  }
}

// Generic Firewall Connector
export class GenericFirewallConnector extends BaseFirewallConnector {
  async authenticate(): Promise<boolean> {
    try {
      const { username, password, api_key, endpoint } = this.dataSource.connection_config;
      
      if (!endpoint) {
        throw new Error('Missing endpoint configuration');
      }

      if (api_key) {
        const response = await fetch(`${endpoint}/api/auth`, {
          method: 'POST',
          headers: {
            'X-API-Key': api_key
          }
        });
        return response.ok;
      } else if (username && password) {
        const response = await fetch(`${endpoint}/api/auth`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
          }
        });
        return response.ok;
      }

      return false;
    } catch (error) {
      logger.error('Generic firewall authentication failed', { 
        error, 
        dataSourceId: this.dataSource.id 
      });
      return false;
    }
  }

  async fetchLogs(since?: Date): Promise<FirewallEvent[]> {
    try {
      const { username, password, api_key, endpoint } = this.dataSource.connection_config;
      const sinceParam = since ? `&since=${since.toISOString()}` : '';
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (api_key) {
        headers['X-API-Key'] = api_key;
      } else if (username && password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
      }

      const response = await fetch(`${endpoint}/api/logs?limit=1000${sinceParam}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }

      const data = await response.json();
      return this.transformGenericLogs(data.logs || data || []);
    } catch (error) {
      logger.error('Failed to fetch generic firewall logs', { 
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

  private transformGenericLogs(logs: any[]): FirewallEvent[] {
    return logs.map(log => ({
      id: log.id || crypto.randomUUID(),
      timestamp: log.timestamp || log.time || new Date().toISOString(),
      action: this.normalizeAction(log.action || log.verdict || 'allow'),
      source_ip: log.source_ip || log.src_ip || log.srcip || '0.0.0.0',
      destination_ip: log.destination_ip || log.dst_ip || log.dstip || '0.0.0.0',
      source_port: parseInt(log.source_port || log.src_port || log.srcport) || 0,
      destination_port: parseInt(log.destination_port || log.dst_port || log.dstport) || 0,
      protocol: (log.protocol || log.proto || 'tcp').toLowerCase(),
      interface: log.interface || log.intf,
      rule_id: log.rule_id || log.policy_id,
      rule_name: log.rule_name || log.policy_name,
      bytes_sent: parseInt(log.bytes_sent || log.sent_bytes) || 0,
      bytes_received: parseInt(log.bytes_received || log.recv_bytes) || 0,
      reason: log.reason || log.message,
      raw_data: log
    }));
  }

  private normalizeAction(action: string): 'allow' | 'deny' | 'drop' | 'reject' {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('allow') || actionLower.includes('accept') || actionLower.includes('pass')) {
      return 'allow';
    } else if (actionLower.includes('deny') || actionLower.includes('block')) {
      return 'deny';
    } else if (actionLower.includes('reject')) {
      return 'reject';
    }
    return 'drop';
  }
}

export function createFirewallConnector(dataSource: DataSource): BaseFirewallConnector {
  switch (dataSource.type) {
    case 'firewall_pfsense':
      return new PfSenseConnector(dataSource);
    case 'firewall_fortinet':
      return new FortinetConnector(dataSource);
    case 'firewall_cisco':
    default:
      return new GenericFirewallConnector(dataSource);
  }
}