import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
// import { db } from '@/lib/database';
import { logAuditEvent, AuditAction } from '@/lib/audit-logger';

export interface SecurityEvent {
  id: string;
  source_type: DataSourceType;
  source_id: string;
  tenant_id: string;
  asset_id?: string;
  event_type: string;
  severity: EventSeverity;
  timestamp: Date;
  raw_data: Record<string, any>;
  normalized_data: NormalizedEvent;
  tags: string[];
  processed_at: Date;
}

export interface DataSource {
  id: string;
  tenant_id: string;
  name: string;
  type: DataSourceType;
  connection_config: ConnectionConfig;
  status: DataSourceStatus;
  last_heartbeat: Date;
  events_processed: number;
  created_at: Date;
  updated_at: Date;
}

export enum DataSourceType {
  EDR_AVAST = 'edr_avast',
  EDR_CROWDSTRIKE = 'edr_crowdstrike',
  EDR_SENTINELONE = 'edr_sentinelone',
  EDR_GENERIC = 'edr_generic',
  FIREWALL_PFSENSE = 'firewall_pfsense',
  FIREWALL_FORTINET = 'firewall_fortinet',
  FIREWALL_CISCO = 'firewall_cisco',
  SIEM_SPLUNK = 'siem_splunk',
  SIEM_QRADAR = 'siem_qradar',
  SYSLOG = 'syslog'
}

export enum DataSourceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  CONNECTING = 'connecting'
}

export enum EventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface NormalizedEvent {
  event_id: string;
  event_type: string;
  severity: EventSeverity;
  source_ip?: string;
  destination_ip?: string;
  source_port?: number;
  destination_port?: number;
  protocol?: string;
  user?: string;
  process?: string;
  file_path?: string;
  hash?: string;
  command_line?: string;
  description: string;
  threat_indicators: ThreatIndicator[];
}

export interface ThreatIndicator {
  type: string;
  value: string;
  confidence: number;
}

export interface ConnectionConfig {
  endpoint?: string;
  api_key?: string;
  username?: string;
  password?: string;
  certificate?: string;
  port?: number;
  use_tls?: boolean;
  polling_interval?: number;
  custom_headers?: Record<string, string>;
}

export class DataIngestionService {
  private static instance: DataIngestionService;
  private connectors: Map<string, any> = new Map();

  public static getInstance(): DataIngestionService {
    if (!DataIngestionService.instance) {
      DataIngestionService.instance = new DataIngestionService();
    }
    return DataIngestionService.instance;
  }

  async createDataSource(dataSource: Omit<DataSource, 'id' | 'created_at' | 'updated_at'>): Promise<DataSource> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      const newDataSource: DataSource = {
        ...dataSource,
        id,
        created_at: now,
        updated_at: now
      };

      // Store in database (using tenant-specific schema)
      await db.query(`
        INSERT INTO data_sources (id, tenant_id, name, type, connection_config, status, last_heartbeat, events_processed, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        newDataSource.id,
        newDataSource.tenant_id,
        newDataSource.name,
        newDataSource.type,
        JSON.stringify(newDataSource.connection_config),
        newDataSource.status,
        newDataSource.last_heartbeat,
        newDataSource.events_processed,
        newDataSource.created_at,
        newDataSource.updated_at
      ]);

      await AuditLogger.logEvent({
        event: AuditEventType.DATA_ACCESS,
        resourceType: AuditResourceType.DATA_SOURCE,
        resourceId: newDataSource.id,
        tenantId: newDataSource.tenant_id,
        details: { type: newDataSource.type, name: newDataSource.name }
      });

      logger.info('Data source created', {
        dataSourceId: newDataSource.id,
        type: newDataSource.type,
        tenantId: newDataSource.tenant_id
      });

      return newDataSource;
    } catch (error) {
      logger.error('Failed to create data source', { error, dataSource });
      throw new Error('Failed to create data source');
    }
  }

  async getDataSources(_tenantId: string): Promise<DataSource[]> {
    try {
      const _result = await db.query(`
        SELECT * FROM data_sources 
        WHERE tenant_id = $1 
        ORDER BY created_at DESC
      `, [tenantId]);

      return result.rows.map(row => ({
        ...row,
        connection_config: JSON.parse(row.connection_config)
      }));
    } catch (error) {
      logger.error('Failed to get data sources', { error, tenantId });
      throw new Error('Failed to get data sources');
    }
  }

  async getDataSource(id: string, tenantId: string): Promise<DataSource | null> {
    try {
      const _result = await db.query(`
        SELECT * FROM data_sources 
        WHERE id = $1 AND tenant_id = $2
      `, [id, tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      return {
        ...result.rows[0],
        connection_config: JSON.parse(result.rows[0].connection_config)
      };
    } catch (error) {
      logger.error('Failed to get data source', { error, id, tenantId });
      throw new Error('Failed to get data source');
    }
  }

  async updateDataSource(id: string, tenantId: string, updates: Partial<DataSource>): Promise<DataSource | null> {
    try {
      const existing = await this.getDataSource(id, tenantId);
      if (!existing) {
        return null;
      }

      const updated = {
        ...existing,
        ...updates,
        updated_at: new Date()
      };

      await db.query(`
        UPDATE data_sources 
        SET name = $1, connection_config = $2, status = $3, updated_at = $4
        WHERE id = $5 AND tenant_id = $6
      `, [
        updated.name,
        JSON.stringify(updated.connection_config),
        updated.status,
        updated.updated_at,
        id,
        tenantId
      ]);

      await AuditLogger.logEvent({
        event: AuditEventType.DATA_ACCESS,
        resourceType: AuditResourceType.DATA_SOURCE,
        resourceId: id,
        tenantId: tenantId,
        details: updates
      });

      return updated;
    } catch (error) {
      logger.error('Failed to update data source', { error, id, tenantId });
      throw new Error('Failed to update data source');
    }
  }

  async deleteDataSource(id: string, tenantId: string): Promise<boolean> {
    try {
      const _result = await db.query(`
        DELETE FROM data_sources 
        WHERE id = $1 AND tenant_id = $2
      `, [id, tenantId]);

      if (result.rowCount === 0) {
        return false;
      }

      // Stop connector if running
      if (this.connectors.has(id)) {
        const connector = this.connectors.get(id);
        if (connector.stop) {
          await connector.stop();
        }
        this.connectors.delete(id);
      }

      await AuditLogger.logEvent({
        event: AuditEventType.DATA_ACCESS,
        resourceType: AuditResourceType.DATA_SOURCE,
        resourceId: id,
        tenantId: tenantId
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete data source', { error, id, tenantId });
      throw new Error('Failed to delete data source');
    }
  }

  async ingestSecurityEvent(event: Omit<SecurityEvent, 'id' | 'processed_at'>): Promise<SecurityEvent> {
    try {
      const id = crypto.randomUUID();
      const processed_at = new Date();

      const securityEvent: SecurityEvent = {
        ...event,
        id,
        processed_at
      };

      // Store in database
      await db.query(`
        INSERT INTO security_events (id, source_type, source_id, tenant_id, asset_id, event_type, severity, timestamp, raw_data, normalized_data, tags, processed_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        securityEvent.id,
        securityEvent.source_type,
        securityEvent.source_id,
        securityEvent.tenant_id,
        securityEvent.asset_id,
        securityEvent.event_type,
        securityEvent.severity,
        securityEvent.timestamp,
        JSON.stringify(securityEvent.raw_data),
        JSON.stringify(securityEvent.normalized_data),
        JSON.stringify(securityEvent.tags),
        securityEvent.processed_at
      ]);

      // Forward to threat lake for enrichment and correlation
      await this.forwardToThreatLake(securityEvent);

      // Cache recent events for quick access
      const redisClient = await getRedisClient();
      const cacheKey = `events:${securityEvent.tenant_id}:recent`;
      await redisClient.lPush(cacheKey, JSON.stringify(securityEvent));
      await redisClient.lTrim(cacheKey, 0, 999); // Keep last 1000 events
      await redisClient.expire(cacheKey, 3600); // 1 hour TTL

      // Update data source metrics
      await this.updateDataSourceMetrics(securityEvent.source_id);

      logger.info('Security event ingested', {
        eventId: securityEvent.id,
        sourceType: securityEvent.source_type,
        tenantId: securityEvent.tenant_id
      });

      return securityEvent;
    } catch (error) {
      logger.error('Failed to ingest security event', { error, event });
      throw new Error('Failed to ingest security event');
    }
  }

  private async forwardToThreatLake(securityEvent: SecurityEvent): Promise<void> {
    try {
      // Import threat lake service dynamically to avoid circular dependencies
      const { threatLakeService } = await import('./threat-lake.service');

      // Convert security event to threat lake event format
      const threatLakeEvent = {
        tenant_id: securityEvent.tenant_id,
        asset_id: securityEvent.asset_id,
        event_category: this.mapEventCategory(securityEvent.event_type),
        event_type: securityEvent.event_type,
        severity: securityEvent.severity as any,
        confidence_score: this.calculateConfidenceScore(securityEvent),
        threat_indicators: this.extractThreatIndicators(securityEvent),
        correlation_id: undefined,
        related_events: [],
        raw_event_data: securityEvent.raw_data,
        normalized_data: securityEvent.normalized_data,
        source_system: securityEvent.source_type,
        source_event_id: securityEvent.id,
        timestamp: securityEvent.timestamp
      };

      await threatLakeService.ingestEvent(threatLakeEvent);
    } catch (error) {
      // Don't fail the main ingestion if threat lake forwarding fails
      logger.error('Failed to forward event to threat lake', {
        error,
        eventId: securityEvent.id
      });
    }
  }

  private mapEventCategory(eventType: string): string {
    // Map event types to categories
    const categoryMappings: Record<string, string> = {
      'malware_detected': 'malware',
      'virus_found': 'malware',
      'trojan_detected': 'malware',
      'login_failed': 'authentication',
      'login_success': 'authentication',
      'user_locked': 'authentication',
      'password_changed': 'authentication',
      'network_intrusion': 'network',
      'port_scan': 'network',
      'ddos_attack': 'network',
      'firewall_block': 'network',
      'file_access': 'data_access',
      'file_modified': 'data_access',
      'file_deleted': 'data_access',
      'database_access': 'data_access',
      'system_startup': 'system',
      'service_started': 'system',
      'service_stopped': 'system',
      'process_created': 'system'
    };

    return categoryMappings[eventType] || 'unknown';
  }

  private calculateConfidenceScore(securityEvent: SecurityEvent): number {
    // Calculate confidence score based on various factors
    let confidence = 0.5; // Base confidence

    // Increase confidence based on severity
    switch (securityEvent.severity) {
      case 'critical':
        confidence += 0.3;
        break;
      case 'high':
        confidence += 0.2;
        break;
      case 'medium':
        confidence += 0.1;
        break;
    }

    // Increase confidence if we have structured data
    if (securityEvent.normalized_data && Object.keys(securityEvent.normalized_data).length > 0) {
      confidence += 0.1;
    }

    // Increase confidence based on data source reliability
    const reliableSources = ['edr_avast', 'edr_crowdstrike', 'edr_sentinelone'];
    if (reliableSources.includes(securityEvent.source_type)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private extractThreatIndicators(securityEvent: SecurityEvent): any[] {
    const indicators: any[] = [];

    // Extract indicators from normalized data
    const normalized = securityEvent.normalized_data;

    if (normalized.source_ip) {
      indicators.push({
        indicator_type: 'ip',
        indicator_value: normalized.source_ip,
        confidence_score: 0.8
      });
    }

    if (normalized.destination_ip) {
      indicators.push({
        indicator_type: 'ip',
        indicator_value: normalized.destination_ip,
        confidence_score: 0.7
      });
    }

    if (normalized.hash) {
      const hashType = normalized.hash.length === 32 ? 'hash_md5' :
        normalized.hash.length === 40 ? 'hash_sha1' :
          normalized.hash.length === 64 ? 'hash_sha256' : 'hash';

      indicators.push({
        indicator_type: hashType,
        indicator_value: normalized.hash,
        confidence_score: 0.9
      });
    }

    if (normalized.file_path) {
      indicators.push({
        indicator_type: 'file_path',
        indicator_value: normalized.file_path,
        confidence_score: 0.6
      });
    }

    if (normalized.user) {
      indicators.push({
        indicator_type: 'user',
        indicator_value: normalized.user,
        confidence_score: 0.5
      });
    }

    return indicators;
  }

  async getSecurityEvents(tenantId: string, filters?: {
    source_type?: DataSourceType;
    severity?: EventSeverity;
    start_date?: Date;
    end_date?: Date;
    limit?: number;
    offset?: number;
  }): Promise<SecurityEvent[]> {
    try {
      let query = `
        SELECT * FROM security_events 
        WHERE tenant_id = $1
      `;
      const params: any[] = [tenantId];
      let paramIndex = 2;

      if (filters?.source_type) {
        query += ` AND source_type = $${paramIndex}`;
        params.push(filters.source_type);
        paramIndex++;
      }

      if (filters?.severity) {
        query += ` AND severity = $${paramIndex}`;
        params.push(filters.severity);
        paramIndex++;
      }

      if (filters?.start_date) {
        query += ` AND timestamp >= $${paramIndex}`;
        params.push(filters.start_date);
        paramIndex++;
      }

      if (filters?.end_date) {
        query += ` AND timestamp <= $${paramIndex}`;
        params.push(filters.end_date);
        paramIndex++;
      }

      query += ` ORDER BY timestamp DESC`;

      if (filters?.limit) {
        query += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }

      if (filters?.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(filters.offset);
      }

      const _result = await db.query(query, params);

      return result.rows.map(row => ({
        ...row,
        raw_data: JSON.parse(row.raw_data),
        normalized_data: JSON.parse(row.normalized_data),
        tags: JSON.parse(row.tags)
      }));
    } catch (error) {
      logger.error('Failed to get security events', { error, tenantId, filters });
      throw new Error('Failed to get security events');
    }
  }

  async testConnection(dataSource: DataSource): Promise<{ success: boolean; message: string }> {
    try {
      // This would be implemented by specific connectors
      // For now, return a basic test
      return {
        success: true,
        message: 'Connection test successful'
      };
    } catch (error) {
      logger.error('Connection test failed', { error, dataSourceId: dataSource.id });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  private async updateDataSourceMetrics(sourceId: string): Promise<void> {
    try {
      await db.query(`
        UPDATE data_sources 
        SET events_processed = events_processed + 1, last_heartbeat = NOW()
        WHERE id = $1
      `, [sourceId]);
    } catch (error) {
      logger.error('Failed to update data source metrics', { error, sourceId });
    }
  }

  registerConnector(sourceId: string, connector: any): void {
    this.connectors.set(sourceId, connector);
  }

  unregisterConnector(sourceId: string): void {
    this.connectors.delete(sourceId);
  }
}

export const dataIngestionService = DataIngestionService.getInstance();