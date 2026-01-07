// import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
// import { db } from '@/lib/database';
import { logAuditEvent, AuditAction } from '@/lib/audit-logger';

export interface ThreatLakeEvent {
  id: string;
  tenant_id: string;
  asset_id?: string;
  event_category: string;
  event_type: string;
  severity: ThreatSeverity;
  confidence_score: number;
  threat_indicators: ThreatIndicator[];
  correlation_id?: string;
  related_events: string[];
  enrichment_data: EnrichmentData;
  raw_event_data: Record<string, any>;
  normalized_data: Record<string, any>;
  source_system: string;
  source_event_id?: string;
  timestamp: Date;
  ingested_at: Date;
}

export interface CorrelationRule {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  rule_logic: CorrelationRuleLogic;
  severity: ThreatSeverity;
  enabled: boolean;
  time_window_minutes: number;
  threshold_count: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  last_triggered?: Date;
  trigger_count: number;
}

export interface CorrelationRuleLogic {
  conditions: CorrelationCondition[];
  operator: 'AND' | 'OR';
  time_window_minutes?: number;
  threshold_count?: number;
  grouping_fields?: string[];
}

export interface CorrelationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
  case_sensitive?: boolean;
}

export interface ThreatIntelligenceFeed {
  id: string;
  tenant_id: string;
  name: string;
  feed_type: ThreatFeedType;
  source_url?: string;
  api_key_encrypted?: string;
  update_frequency_hours: number;
  enabled: boolean;
  last_updated?: Date;
  last_sync_status: SyncStatus;
  indicators_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface ThreatIndicator {
  id: string;
  feed_id: string;
  tenant_id: string;
  indicator_type: IndicatorType;
  indicator_value: string;
  threat_type?: string;
  malware_family?: string;
  confidence_score: number;
  severity: ThreatSeverity;
  tags: string[];
  metadata: Record<string, any>;
  first_seen: Date;
  last_seen: Date;
  expiry_date?: Date;
  is_active: boolean;
}

export interface EventCorrelation {
  id: string;
  tenant_id: string;
  correlation_rule_id: string;
  correlation_id: string;
  event_ids: string[];
  severity: ThreatSeverity;
  confidence_score: number;
  threat_summary?: string;
  recommended_actions: RecommendedAction[];
  status: CorrelationStatus;
  assigned_to?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DataRetentionPolicy {
  id: string;
  tenant_id: string;
  policy_name: string;
  event_category?: string;
  severity?: ThreatSeverity;
  retention_days: number;
  archive_after_days?: number;
  delete_after_days: number;
  compression_enabled: boolean;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MLModel {
  id: string;
  tenant_id: string;
  model_name: string;
  model_type: MLModelType;
  model_version: string;
  model_data?: Buffer;
  model_metadata: Record<string, any>;
  training_data_period_days: number;
  accuracy_score?: number;
  last_trained?: Date;
  last_prediction?: Date;
  prediction_count: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EnrichmentData {
  threat_intelligence_matches: ThreatIntelMatch[];
  geolocation?: GeolocationData;
  reputation_scores?: ReputationScores;
  asset_context?: AssetContext;
  user_context?: UserContext;
  network_context?: NetworkContext;
}

export interface ThreatIntelMatch {
  indicator_id: string;
  indicator_type: IndicatorType;
  indicator_value: string;
  threat_type: string;
  confidence_score: number;
  feed_name: string;
}

export interface GeolocationData {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  organization?: string;
}

export interface ReputationScores {
  ip_reputation?: number;
  domain_reputation?: number;
  file_reputation?: number;
  url_reputation?: number;
}

export interface AssetContext {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  criticality: string;
  owner: string;
  location: string;
}

export interface UserContext {
  user_id: string;
  username: string;
  department: string;
  role: string;
  risk_score: number;
}

export interface NetworkContext {
  network_segment: string;
  vlan_id?: number;
  subnet: string;
  security_zone: string;
}

export interface RecommendedAction {
  action_type: string;
  description: string;
  priority: number;
  automated: boolean;
  playbook_id?: string;
}

export enum ThreatSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ThreatFeedType {
  IOC = 'ioc',
  YARA = 'yara',
  SIGMA = 'sigma',
  MITRE_ATTACK = 'mitre_attack',
  CUSTOM = 'custom'
}

export enum IndicatorType {
  IP = 'ip',
  DOMAIN = 'domain',
  URL = 'url',
  HASH_MD5 = 'hash_md5',
  HASH_SHA1 = 'hash_sha1',
  HASH_SHA256 = 'hash_sha256',
  EMAIL = 'email',
  FILE_PATH = 'file_path',
  REGISTRY_KEY = 'registry_key',
  MUTEX = 'mutex',
  USER_AGENT = 'user_agent'
}

export enum SyncStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
  SYNCING = 'syncing'
}

export enum CorrelationStatus {
  NEW = 'new',
  INVESTIGATING = 'investigating',
  CONFIRMED = 'confirmed',
  FALSE_POSITIVE = 'false_positive',
  RESOLVED = 'resolved'
}

export enum MLModelType {
  ANOMALY_DETECTION = 'anomaly_detection',
  THREAT_CLASSIFICATION = 'threat_classification',
  BEHAVIORAL_ANALYSIS = 'behavioral_analysis',
  CORRELATION_SCORING = 'correlation_scoring'
}

export class ThreatLakeService {
  private static instance: ThreatLakeService;
  private correlationEngine: CorrelationEngine;
  private enrichmentEngine: EnrichmentEngine;

  public static getInstance(): ThreatLakeService {
    if (!ThreatLakeService.instance) {
      ThreatLakeService.instance = new ThreatLakeService();
    }
    return ThreatLakeService.instance;
  }

  constructor() {
    this.correlationEngine = new CorrelationEngine();
    this.enrichmentEngine = new EnrichmentEngine();
  }

  // Threat Lake Event Management
  async ingestEvent(event: Omit<ThreatLakeEvent, 'id' | 'ingested_at'>): Promise<ThreatLakeEvent> {
    try {
      const id = crypto.randomUUID();
      const ingested_at = new Date();

      // Enrich the event with threat intelligence and context
      const enrichment_data = await this.enrichmentEngine.enrichEvent(event);

      const threatLakeEvent: ThreatLakeEvent = {
        ...event,
        id,
        ingested_at,
        enrichment_data
      };

      // Store in threat lake
      await db.query(`
        INSERT INTO threat_lake_events (
          id, tenant_id, asset_id, event_category, event_type, severity, confidence_score,
          threat_indicators, correlation_id, related_events, enrichment_data, raw_event_data,
          normalized_data, source_system, source_event_id, timestamp, ingested_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        threatLakeEvent.id,
        threatLakeEvent.tenant_id,
        threatLakeEvent.asset_id,
        threatLakeEvent.event_category,
        threatLakeEvent.event_type,
        threatLakeEvent.severity,
        threatLakeEvent.confidence_score,
        JSON.stringify(threatLakeEvent.threat_indicators),
        threatLakeEvent.correlation_id,
        JSON.stringify(threatLakeEvent.related_events),
        JSON.stringify(threatLakeEvent.enrichment_data),
        JSON.stringify(threatLakeEvent.raw_event_data),
        JSON.stringify(threatLakeEvent.normalized_data),
        threatLakeEvent.source_system,
        threatLakeEvent.source_event_id,
        threatLakeEvent.timestamp,
        threatLakeEvent.ingested_at
      ]);

      // Run correlation analysis
      await this.correlationEngine.analyzeEvent(threatLakeEvent);

      // Cache for real-time access
      const redisClient = await getRedisClient();
      const cacheKey = `threat_lake:${threatLakeEvent.tenant_id}:recent`;
      await redisClient.lPush(cacheKey, JSON.stringify(threatLakeEvent));
      await redisClient.lTrim(cacheKey, 0, 4999); // Keep last 5000 events
      await redisClient.expire(cacheKey, 7200); // 2 hours TTL

      logger.info('Event ingested into threat lake', {
        eventId: threatLakeEvent.id,
        tenantId: threatLakeEvent.tenant_id,
        eventType: threatLakeEvent.event_type
      });

      return threatLakeEvent;
    } catch (error) {
      logger.error('Failed to ingest event into threat lake', { error, event });
      throw new Error('Failed to ingest event into threat lake');
    }
  }

  async searchEvents(tenantId: string, query: ThreatLakeQuery): Promise<ThreatLakeSearchResult> {
    try {
      let sql = `
        SELECT * FROM threat_lake_events 
        WHERE tenant_id = $1
      `;
      const params: any[] = [tenantId];
      let paramIndex = 2;

      // Build dynamic query based on search criteria
      if (query.event_category) {
        sql += ` AND event_category = $${paramIndex}`;
        params.push(query.event_category);
        paramIndex++;
      }

      if (query.event_type) {
        sql += ` AND event_type = $${paramIndex}`;
        params.push(query.event_type);
        paramIndex++;
      }

      if (query.severity) {
        sql += ` AND severity = $${paramIndex}`;
        params.push(query.severity);
        paramIndex++;
      }

      if (query.min_confidence_score) {
        sql += ` AND confidence_score >= $${paramIndex}`;
        params.push(query.min_confidence_score);
        paramIndex++;
      }

      if (query.start_time) {
        sql += ` AND timestamp >= $${paramIndex}`;
        params.push(query.start_time);
        paramIndex++;
      }

      if (query.end_time) {
        sql += ` AND timestamp <= $${paramIndex}`;
        params.push(query.end_time);
        paramIndex++;
      }

      if (query.asset_id) {
        sql += ` AND asset_id = $${paramIndex}`;
        params.push(query.asset_id);
        paramIndex++;
      }

      if (query.correlation_id) {
        sql += ` AND correlation_id = $${paramIndex}`;
        params.push(query.correlation_id);
        paramIndex++;
      }

      // Text search in normalized data
      if (query.search_text) {
        sql += ` AND (normalized_data::text ILIKE $${paramIndex} OR enrichment_data::text ILIKE $${paramIndex})`;
        params.push(`%${query.search_text}%`);
        paramIndex++;
      }

      // Threat indicator search
      if (query.threat_indicators && query.threat_indicators.length > 0) {
        sql += ` AND threat_indicators @> $${paramIndex}`;
        params.push(JSON.stringify(query.threat_indicators));
        paramIndex++;
      }

      sql += ` ORDER BY timestamp DESC`;

      // Pagination
      const limit = query.limit || 100;
      const offset = query.offset || 0;
      sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const _result = await db.query(sql, params);

      // Get total count for pagination
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*)').split('ORDER BY')[0];
      const countResult = await db.query(countSql, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].count);

      const events = result.rows.map(row => ({
        ...row,
        threat_indicators: JSON.parse(row.threat_indicators),
        related_events: JSON.parse(row.related_events),
        enrichment_data: JSON.parse(row.enrichment_data),
        raw_event_data: JSON.parse(row.raw_event_data),
        normalized_data: JSON.parse(row.normalized_data)
      }));

      return {
        events,
        total,
        limit,
        offset,
        has_more: offset + limit < total
      };
    } catch (error) {
      logger.error('Failed to search threat lake events', { error, tenantId, query });
      throw new Error('Failed to search threat lake events');
    }
  }

  // Correlation Rule Management
  async createCorrelationRule(rule: Omit<CorrelationRule, 'id' | 'created_at' | 'updated_at' | 'trigger_count'>): Promise<CorrelationRule> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      const correlationRule: CorrelationRule = {
        ...rule,
        id,
        created_at: now,
        updated_at: now,
        trigger_count: 0
      };

      await db.query(`
        INSERT INTO correlation_rules (
          id, tenant_id, name, description, rule_logic, severity, enabled,
          time_window_minutes, threshold_count, created_by, created_at, updated_at, trigger_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        correlationRule.id,
        correlationRule.tenant_id,
        correlationRule.name,
        correlationRule.description,
        JSON.stringify(correlationRule.rule_logic),
        correlationRule.severity,
        correlationRule.enabled,
        correlationRule.time_window_minutes,
        correlationRule.threshold_count,
        correlationRule.created_by,
        correlationRule.created_at,
        correlationRule.updated_at,
        correlationRule.trigger_count
      ]);

      await AuditLogger.logEvent({
        event: AuditEventType.DATA_ACCESS,
        resourceType: AuditResourceType.SYSTEM,
        resourceId: correlationRule.id,
        tenantId: correlationRule.tenant_id,
        details: { name: correlationRule.name, severity: correlationRule.severity }
      });

      return correlationRule;
    } catch (error) {
      logger.error('Failed to create correlation rule', { error, rule });
      throw new Error('Failed to create correlation rule');
    }
  }

  async getCorrelationRules(_tenantId: string): Promise<CorrelationRule[]> {
    try {
      const _result = await db.query(`
        SELECT * FROM correlation_rules 
        WHERE tenant_id = $1 
        ORDER BY created_at DESC
      `, [tenantId]);

      return result.rows.map(row => ({
        ...row,
        rule_logic: JSON.parse(row.rule_logic)
      }));
    } catch (error) {
      logger.error('Failed to get correlation rules', { error, tenantId });
      throw new Error('Failed to get correlation rules');
    }
  }

  // Threat Intelligence Management
  async createThreatIntelFeed(feed: Omit<ThreatIntelligenceFeed, 'id' | 'created_at' | 'updated_at' | 'indicators_count'>): Promise<ThreatIntelligenceFeed> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      const threatFeed: ThreatIntelligenceFeed = {
        ...feed,
        id,
        created_at: now,
        updated_at: now,
        indicators_count: 0
      };

      await db.query(`
        INSERT INTO threat_intelligence_feeds (
          id, tenant_id, name, feed_type, source_url, api_key_encrypted,
          update_frequency_hours, enabled, last_sync_status, indicators_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        threatFeed.id,
        threatFeed.tenant_id,
        threatFeed.name,
        threatFeed.feed_type,
        threatFeed.source_url,
        threatFeed.api_key_encrypted,
        threatFeed.update_frequency_hours,
        threatFeed.enabled,
        threatFeed.last_sync_status,
        threatFeed.indicators_count,
        threatFeed.created_at,
        threatFeed.updated_at
      ]);

      return threatFeed;
    } catch (error) {
      logger.error('Failed to create threat intelligence feed', { error, feed });
      throw new Error('Failed to create threat intelligence feed');
    }
  }

  async getThreatIntelFeeds(_tenantId: string): Promise<ThreatIntelligenceFeed[]> {
    try {
      const _result = await db.query(`
        SELECT * FROM threat_intelligence_feeds 
        WHERE tenant_id = $1 
        ORDER BY created_at DESC
      `, [tenantId]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get threat intelligence feeds', { error, tenantId });
      throw new Error('Failed to get threat intelligence feeds');
    }
  }

  // Analytics and Reporting
  async getThreatAnalytics(tenantId: string, timeRange: TimeRange): Promise<ThreatAnalytics> {
    try {
      const { start_time, end_time } = timeRange;

      // Get event counts by severity
      const severityResult = await db.query(`
        SELECT severity, COUNT(*) as count
        FROM threat_lake_events 
        WHERE tenant_id = $1 AND timestamp >= $2 AND timestamp <= $3
        GROUP BY severity
      `, [tenantId, start_time, end_time]);

      // Get event counts by category
      const categoryResult = await db.query(`
        SELECT event_category, COUNT(*) as count
        FROM threat_lake_events 
        WHERE tenant_id = $1 AND timestamp >= $2 AND timestamp <= $3
        GROUP BY event_category
      `, [tenantId, start_time, end_time]);

      // Get correlation statistics
      const correlationResult = await db.query(`
        SELECT status, COUNT(*) as count
        FROM event_correlations 
        WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
        GROUP BY status
      `, [tenantId, start_time, end_time]);

      // Get top threat indicators
      const indicatorResult = await db.query(`
        SELECT 
          ti.indicator_type,
          ti.indicator_value,
          ti.threat_type,
          COUNT(tle.id) as event_count
        FROM threat_indicators ti
        JOIN threat_lake_events tle ON tle.threat_indicators @> jsonb_build_array(jsonb_build_object('indicator_id', ti.id))
        WHERE ti.tenant_id = $1 AND tle.timestamp >= $2 AND tle.timestamp <= $3
        GROUP BY ti.indicator_type, ti.indicator_value, ti.threat_type
        ORDER BY event_count DESC
        LIMIT 10
      `, [tenantId, start_time, end_time]);

      return {
        severity_distribution: severityResult.rows,
        category_distribution: categoryResult.rows,
        correlation_status: correlationResult.rows,
        top_threat_indicators: indicatorResult.rows,
        time_range: timeRange
      };
    } catch (error) {
      logger.error('Failed to get threat analytics', { error, tenantId, timeRange });
      throw new Error('Failed to get threat analytics');
    }
  }

  // Data Retention Management
  async createRetentionPolicy(policy: Omit<DataRetentionPolicy, 'id' | 'created_at' | 'updated_at'>): Promise<DataRetentionPolicy> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      const retentionPolicy: DataRetentionPolicy = {
        ...policy,
        id,
        created_at: now,
        updated_at: now
      };

      await db.query(`
        INSERT INTO data_retention_policies (
          id, tenant_id, policy_name, event_category, severity, retention_days,
          archive_after_days, delete_after_days, compression_enabled, enabled, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        retentionPolicy.id,
        retentionPolicy.tenant_id,
        retentionPolicy.policy_name,
        retentionPolicy.event_category,
        retentionPolicy.severity,
        retentionPolicy.retention_days,
        retentionPolicy.archive_after_days,
        retentionPolicy.delete_after_days,
        retentionPolicy.compression_enabled,
        retentionPolicy.enabled,
        retentionPolicy.created_at,
        retentionPolicy.updated_at
      ]);

      return retentionPolicy;
    } catch (error) {
      logger.error('Failed to create retention policy', { error, policy });
      throw new Error('Failed to create retention policy');
    }
  }

  async applyRetentionPolicies(_tenantId: string): Promise<RetentionResult> {
    try {
      const policies = await db.query(`
        SELECT * FROM data_retention_policies 
        WHERE tenant_id = $1 AND enabled = true
      `, [tenantId]);

      const totalArchived = 0;
      let totalDeleted = 0;

      for (const policy of policies.rows) {
        const archiveDate = new Date();
        archiveDate.setDate(archiveDate.getDate() - policy.archive_after_days);

        const deleteDate = new Date();
        deleteDate.setDate(deleteDate.getDate() - policy.delete_after_days);

        // Archive old events (implementation would depend on storage strategy)
        // For now, we'll just mark them as archived in metadata

        // Delete very old events
        let deleteQuery = `
          DELETE FROM threat_lake_events 
          WHERE tenant_id = $1 AND timestamp < $2
        `;
        const deleteParams = [tenantId, deleteDate];

        if (policy.event_category) {
          deleteQuery += ` AND event_category = $3`;
          deleteParams.push(policy.event_category);
        }

        if (policy.severity) {
          deleteQuery += ` AND severity = $${deleteParams.length + 1}`;
          deleteParams.push(policy.severity);
        }

        const deleteResult = await db.query(deleteQuery, deleteParams);
        totalDeleted += deleteResult.rowCount || 0;
      }

      logger.info('Retention policies applied', {
        tenantId,
        totalArchived,
        totalDeleted
      });

      return {
        archived_count: totalArchived,
        deleted_count: totalDeleted,
        policies_applied: policies.rows.length
      };
    } catch (error) {
      logger.error('Failed to apply retention policies', { error, tenantId });
      throw new Error('Failed to apply retention policies');
    }
  }
}

// Correlation Engine for real-time event analysis
class CorrelationEngine {
  async analyzeEvent(event: ThreatLakeEvent): Promise<void> {
    try {
      // Get active correlation rules for the tenant
      const rules = await db.query(`
        SELECT * FROM correlation_rules 
        WHERE tenant_id = $1 AND enabled = true
      `, [event.tenant_id]);

      for (const rule of rules.rows) {
        const ruleLogic: CorrelationRuleLogic = JSON.parse(rule.rule_logic);

        // Check if event matches rule conditions
        if (await this.evaluateRule(event, ruleLogic)) {
          await this.createCorrelation(event, rule, ruleLogic);
        }
      }
    } catch (error) {
      logger.error('Failed to analyze event for correlation', { error, eventId: event.id });
    }
  }

  private async evaluateRule(event: ThreatLakeEvent, ruleLogic: CorrelationRuleLogic): Promise<boolean> {
    // Implement rule evaluation logic
    // This is a simplified version - real implementation would be more sophisticated

    for (const condition of ruleLogic.conditions) {
      const fieldValue = this.getFieldValue(event, condition.field);

      if (!this.evaluateCondition(fieldValue, condition)) {
        if (ruleLogic.operator === 'AND') {
          return false;
        }
      } else {
        if (ruleLogic.operator === 'OR') {
          return true;
        }
      }
    }

    return ruleLogic.operator === 'AND';
  }

  private getFieldValue(event: ThreatLakeEvent, field: string): any {
    // Extract field value from event using dot notation
    const parts = field.split('.');
    let value: any = event;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private evaluateCondition(fieldValue: any, condition: CorrelationCondition): boolean {
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
      case 'regex':
        return typeof fieldValue === 'string' && new RegExp(condition.value).test(fieldValue);
      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > condition.value;
      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      default:
        return false;
    }
  }

  private async createCorrelation(event: ThreatLakeEvent, rule: any, ruleLogic: CorrelationRuleLogic): Promise<void> {
    try {
      const correlationId = crypto.randomUUID();

      // Find related events within time window
      const timeWindow = new Date(event.timestamp.getTime() - (rule.time_window_minutes * 60 * 1000));

      const relatedEvents = await db.query(`
        SELECT id FROM threat_lake_events 
        WHERE tenant_id = $1 AND timestamp >= $2 AND timestamp <= $3 AND id != $4
        LIMIT 100
      `, [event.tenant_id, timeWindow, event.timestamp, event.id]);

      const eventIds = [event.id, ...relatedEvents.rows.map(row => row.id)];

      await db.query(`
        INSERT INTO event_correlations (
          id, tenant_id, correlation_rule_id, correlation_id, event_ids, severity,
          confidence_score, threat_summary, recommended_actions, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        crypto.randomUUID(),
        event.tenant_id,
        rule.id,
        correlationId,
        JSON.stringify(eventIds),
        rule.severity,
        0.8, // Default confidence score
        `Correlation detected: ${rule.name}`,
        JSON.stringify([]),
        CorrelationStatus.NEW,
        new Date(),
        new Date()
      ]);

      // Update rule trigger count
      await db.query(`
        UPDATE correlation_rules 
        SET trigger_count = trigger_count + 1, last_triggered = NOW()
        WHERE id = $1
      `, [rule.id]);

      logger.info('Correlation created', {
        correlationId,
        ruleId: rule.id,
        eventId: event.id,
        tenantId: event.tenant_id
      });
    } catch (error) {
      logger.error('Failed to create correlation', { error, eventId: event.id, ruleId: rule.id });
    }
  }
}

// Enrichment Engine for adding context to events
class EnrichmentEngine {
  async enrichEvent(event: Omit<ThreatLakeEvent, 'id' | 'ingested_at' | 'enrichment_data'>): Promise<EnrichmentData> {
    try {
      const enrichmentData: EnrichmentData = {
        threat_intelligence_matches: [],
        geolocation: undefined,
        reputation_scores: undefined,
        asset_context: undefined,
        user_context: undefined,
        network_context: undefined
      };

      // Enrich with threat intelligence
      enrichmentData.threat_intelligence_matches = await this.getThreatIntelMatches(event);

      // Add geolocation data for IP addresses
      if (event.normalized_data.source_ip) {
        enrichmentData.geolocation = await this.getGeolocationData(event.normalized_data.source_ip);
      }

      // Add reputation scores
      enrichmentData.reputation_scores = await this.getReputationScores(event);

      // Add asset context if asset_id is available
      if (event.asset_id) {
        enrichmentData.asset_context = await this.getAssetContext(event.asset_id);
      }

      return enrichmentData;
    } catch (error) {
      logger.error('Failed to enrich event', { error, eventType: event.event_type });
      return {
        threat_intelligence_matches: [],
        geolocation: undefined,
        reputation_scores: undefined,
        asset_context: undefined,
        user_context: undefined,
        network_context: undefined
      };
    }
  }

  private async getThreatIntelMatches(event: any): Promise<ThreatIntelMatch[]> {
    try {
      const matches: ThreatIntelMatch[] = [];

      // Check for IP indicators
      if (event.normalized_data.source_ip) {
        const ipMatches = await db.query(`
          SELECT ti.*, tif.name as feed_name
          FROM threat_indicators ti
          JOIN threat_intelligence_feeds tif ON ti.feed_id = tif.id
          WHERE ti.tenant_id = $1 AND ti.indicator_type = 'ip' 
          AND ti.indicator_value = $2 AND ti.is_active = true
        `, [event.tenant_id, event.normalized_data.source_ip]);

        matches.push(...ipMatches.rows.map(row => ({
          indicator_id: row.id,
          indicator_type: row.indicator_type,
          indicator_value: row.indicator_value,
          threat_type: row.threat_type,
          confidence_score: row.confidence_score,
          feed_name: row.feed_name
        })));
      }

      // Check for hash indicators
      if (event.normalized_data.hash) {
        const hashMatches = await db.query(`
          SELECT ti.*, tif.name as feed_name
          FROM threat_indicators ti
          JOIN threat_intelligence_feeds tif ON ti.feed_id = tif.id
          WHERE ti.tenant_id = $1 AND ti.indicator_type LIKE 'hash_%' 
          AND ti.indicator_value = $2 AND ti.is_active = true
        `, [event.tenant_id, event.normalized_data.hash]);

        matches.push(...hashMatches.rows.map(row => ({
          indicator_id: row.id,
          indicator_type: row.indicator_type,
          indicator_value: row.indicator_value,
          threat_type: row.threat_type,
          confidence_score: row.confidence_score,
          feed_name: row.feed_name
        })));
      }

      return matches;
    } catch (error) {
      logger.error('Failed to get threat intelligence matches', { error });
      return [];
    }
  }

  private async getGeolocationData(_ip: string): Promise<GeolocationData | undefined> {
    // This would integrate with a geolocation service
    // For now, return undefined
    return undefined;
  }

  private async getReputationScores(event: any): Promise<ReputationScores | undefined> {
    // This would integrate with reputation services
    // For now, return undefined
    return undefined;
  }

  private async getAssetContext(assetId: string): Promise<AssetContext | undefined> {
    try {
      const _result = await db.query(`
        SELECT * FROM assets WHERE id = $1
      `, [assetId]);

      if (result.rows.length === 0) {
        return undefined;
      }

      const asset = result.rows[0];
      return {
        asset_id: asset.id,
        asset_name: asset.name,
        asset_type: asset.asset_type,
        criticality: asset.criticality || 'medium',
        owner: asset.owner || 'unknown',
        location: asset.location || 'unknown'
      };
    } catch (error) {
      logger.error('Failed to get asset context', { error, assetId });
      return undefined;
    }
  }
}

// Type definitions for search and analytics
export interface ThreatLakeQuery {
  event_category?: string;
  event_type?: string;
  severity?: ThreatSeverity;
  min_confidence_score?: number;
  start_time?: Date;
  end_time?: Date;
  asset_id?: string;
  correlation_id?: string;
  search_text?: string;
  threat_indicators?: ThreatIndicator[];
  limit?: number;
  offset?: number;
}

export interface ThreatLakeSearchResult {
  events: ThreatLakeEvent[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface TimeRange {
  start_time: Date;
  end_time: Date;
}

export interface ThreatAnalytics {
  severity_distribution: Array<{ severity: string; count: number }>;
  category_distribution: Array<{ event_category: string; count: number }>;
  correlation_status: Array<{ status: string; count: number }>;
  top_threat_indicators: Array<{
    indicator_type: string;
    indicator_value: string;
    threat_type: string;
    event_count: number;
  }>;
  time_range: TimeRange;
}

export interface RetentionResult {
  archived_count: number;
  deleted_count: number;
  policies_applied: number;
}

export const threatLakeService = ThreatLakeService.getInstance();