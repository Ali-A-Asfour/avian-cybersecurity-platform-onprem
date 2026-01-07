import { NextRequest } from 'next/server';
// Using Web Crypto API for Edge Runtime compatibility
import { z } from 'zod';

/**
 * Webhook event types
 */
export enum WebhookEventType {
  // Alert events
  ALERT_CREATED = 'alert.created',
  ALERT_UPDATED = 'alert.updated',
  ALERT_RESOLVED = 'alert.resolved',

  // Ticket events
  TICKET_CREATED = 'ticket.created',
  TICKET_UPDATED = 'ticket.updated',
  TICKET_ASSIGNED = 'ticket.assigned',
  TICKET_RESOLVED = 'ticket.resolved',
  TICKET_CLOSED = 'ticket.closed',

  // Compliance events
  COMPLIANCE_CONTROL_UPDATED = 'compliance.control.updated',
  COMPLIANCE_FRAMEWORK_COMPLETED = 'compliance.framework.completed',

  // User events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',

  // Tenant events
  TENANT_CREATED = 'tenant.created',
  TENANT_UPDATED = 'tenant.updated',

  // System events
  SYSTEM_HEALTH_CHECK = 'system.health_check',
  SYSTEM_MAINTENANCE = 'system.maintenance',
}

/**
 * Webhook payload interface
 */
export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  tenant_id?: string;
  data: any;
  metadata?: {
    source: string;
    version: string;
    retry_count?: number;
    correlation_id?: string;
  };
}

/**
 * Webhook configuration interface
 */
export interface WebhookConfig {
  url: string;
  secret: string;
  events: WebhookEventType[];
  active: boolean;
  retry_policy?: {
    max_retries: number;
    retry_delay: number; // seconds
    backoff_multiplier: number;
  };
  headers?: Record<string, string>;
  timeout?: number; // seconds
}

/**
 * Webhook signature verification
 */
export class WebhookSecurity {
  /**
   * Generate webhook signature using Web Crypto API
   */
  static async generateSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature), byte =>
      byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify webhook signature using Web Crypto API
   */
  static async verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): Promise<boolean> {
    try {
      const expectedSignature = await this.generateSignature(payload, secret);

      // Simple constant-time comparison
      if (signature.length !== expectedSignature.length) return false;
      let result = 0;
      for (let i = 0; i < signature.length; i++) {
        result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
      }
      return result === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract signature from request headers
   */
  static extractSignature(request: NextRequest): string | null {
    const signature = request.headers.get('x-webhook-signature') ||
      request.headers.get('x-hub-signature-256');

    if (!signature) return null;

    // Remove 'sha256=' prefix if present
    return signature.replace(/^sha256=/, '');
  }

  /**
   * Verify webhook request
   */
  static async verifyWebhookRequest(
    request: NextRequest,
    secret: string
  ): Promise<{ valid: boolean; payload?: string; error?: string }> {
    try {
      const signature = this.extractSignature(request);
      if (!signature) {
        return { valid: false, error: 'Missing webhook signature' };
      }

      const payload = await request.text();
      const isValid = await this.verifySignature(payload, signature, secret);

      if (!isValid) {
        return { valid: false, error: 'Invalid webhook signature' };
      }

      return { valid: true, payload };
    } catch (error) {
      return {
        valid: false,
        error: `Webhook verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Webhook payload validation schemas
 */
export const webhookSchemas = {
  // Base webhook payload schema
  base: z.object({
    id: z.string().uuid(),
    event: z.nativeEnum(WebhookEventType),
    timestamp: z.string().datetime(),
    tenant_id: z.string().uuid().optional(),
    data: z.any(),
    metadata: z.object({
      source: z.string(),
      version: z.string(),
      retry_count: z.number().int().min(0).optional(),
      correlation_id: z.string().optional(),
    }).optional(),
  }),

  // SIEM alert webhook
  siemAlert: z.object({
    id: z.string().uuid(),
    event: z.literal(WebhookEventType.ALERT_CREATED),
    timestamp: z.string().datetime(),
    tenant_id: z.string().uuid(),
    data: z.object({
      alert_id: z.string(),
      source: z.string(),
      title: z.string(),
      description: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      category: z.enum(['malware', 'phishing', 'data_breach', 'unauthorized_access', 'policy_violation', 'other']),
      raw_data: z.record(z.any()),
      detected_at: z.string().datetime(),
    }),
    metadata: z.object({
      source: z.string(),
      version: z.string(),
      siem_system: z.string(),
      rule_id: z.string().optional(),
    }),
  }),

  // Threat Lake data webhook
  threatLake: z.object({
    id: z.string().uuid(),
    event: z.literal(WebhookEventType.ALERT_CREATED),
    timestamp: z.string().datetime(),
    tenant_id: z.string().uuid(),
    data: z.object({
      threat_id: z.string(),
      threat_type: z.string(),
      indicators: z.array(z.object({
        type: z.string(),
        value: z.string(),
        confidence: z.number().min(0).max(100),
      })),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      description: z.string(),
      source_feeds: z.array(z.string()),
      first_seen: z.string().datetime(),
      last_seen: z.string().datetime(),
    }),
    metadata: z.object({
      source: z.string(),
      version: z.string(),
      threat_lake: z.string(),
      feed_sources: z.array(z.string()),
    }),
  }),

  // External system integration webhook
  externalSystem: z.object({
    id: z.string().uuid(),
    event: z.nativeEnum(WebhookEventType),
    timestamp: z.string().datetime(),
    tenant_id: z.string().uuid().optional(),
    data: z.record(z.any()),
    metadata: z.object({
      source: z.string(),
      version: z.string(),
      system_type: z.string(),
      integration_id: z.string(),
    }),
  }),
};

/**
 * Webhook processor interface
 */
export interface WebhookProcessor {
  canProcess(event: WebhookEventType): boolean;
  process(payload: WebhookPayload): Promise<{ success: boolean; error?: string }>;
}

/**
 * SIEM alert webhook processor
 */
export class SiemAlertProcessor implements WebhookProcessor {
  canProcess(event: WebhookEventType): boolean {
    return event === WebhookEventType.ALERT_CREATED;
  }

  async process(payload: WebhookPayload): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate SIEM alert payload
      const validatedPayload = webhookSchemas.siemAlert.parse(payload);

      // Import alert service dynamically to avoid circular dependencies
      const { AlertService } = await import('../services/alert.service');

      // Create alert from SIEM data
      const alertData = {
        source: validatedPayload.data.source,
        title: validatedPayload.data.title,
        description: validatedPayload.data.description,
        severity: validatedPayload.data.severity,
        category: validatedPayload.data.category,
        status: 'open' as const,
        metadata: {
          siem_alert_id: validatedPayload.data.alert_id,
          siem_system: validatedPayload.metadata.siem_system,
          rule_id: validatedPayload.metadata.rule_id,
          detected_at: validatedPayload.data.detected_at,
          raw_data: validatedPayload.data.raw_data,
        },
      };

      const result = await AlertService.createAlert(validatedPayload.tenant_id, alertData);

      if (!result.success) {
        return { success: false, error: result.error?.message || 'Failed to create alert' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `SIEM alert processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Threat Lake webhook processor
 */
export class ThreatLakeProcessor implements WebhookProcessor {
  canProcess(event: WebhookEventType): boolean {
    return event === WebhookEventType.ALERT_CREATED;
  }

  async process(payload: WebhookPayload): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate Threat Lake payload
      const validatedPayload = webhookSchemas.threatLake.parse(payload);

      // Import alert service dynamically
      const { AlertService } = await import('../services/alert.service');

      // Create alert from threat intelligence data
      const alertData = {
        source: validatedPayload.metadata.threat_lake,
        title: `Threat Intelligence: ${validatedPayload.data.threat_type}`,
        description: validatedPayload.data.description,
        severity: validatedPayload.data.severity,
        category: 'other' as const, // Map threat types to categories as needed
        status: 'open' as const,
        metadata: {
          threat_id: validatedPayload.data.threat_id,
          threat_type: validatedPayload.data.threat_type,
          indicators: validatedPayload.data.indicators,
          source_feeds: validatedPayload.data.source_feeds,
          first_seen: validatedPayload.data.first_seen,
          last_seen: validatedPayload.data.last_seen,
          threat_lake: validatedPayload.metadata.threat_lake,
        },
      };

      const result = await AlertService.createAlert(validatedPayload.tenant_id, alertData);

      if (!result.success) {
        return { success: false, error: result.error?.message || 'Failed to create alert' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Threat Lake processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Webhook registry for managing processors
 */
export class WebhookRegistry {
  private static processors: WebhookProcessor[] = [
    new SiemAlertProcessor(),
    new ThreatLakeProcessor(),
  ];

  /**
   * Register a new webhook processor
   */
  static register(processor: WebhookProcessor): void {
    this.processors.push(processor);
  }

  /**
   * Find processor for event type
   */
  static findProcessor(event: WebhookEventType): WebhookProcessor | null {
    return this.processors.find(processor => processor.canProcess(event)) || null;
  }

  /**
   * Process webhook payload
   */
  static async process(payload: WebhookPayload): Promise<{ success: boolean; error?: string }> {
    const processor = this.findProcessor(payload.event);

    if (!processor) {
      return {
        success: false,
        error: `No processor found for event type: ${payload.event}`
      };
    }

    return processor.process(payload);
  }
}

/**
 * Webhook delivery service
 */
export class WebhookDelivery {
  /**
   * Deliver webhook to external endpoint
   */
  static async deliver(
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<{ success: boolean; error?: string; response?: any }> {
    try {
      const payloadString = JSON.stringify(payload);
      const signature = await WebhookSecurity.generateSignature(payloadString, config.secret);

      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': payload.event,
        'X-Webhook-ID': payload.id,
        'X-Webhook-Timestamp': payload.timestamp,
        'User-Agent': 'AVIAN-Webhook/1.0',
        ...config.headers,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), (config.timeout || 30) * 1000);

      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `Webhook delivery failed with status ${response.status}: ${response.statusText}`,
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
          },
        };
      }

      const responseData = await response.text();

      return {
        success: true,
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseData,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Webhook delivery timeout' };
      }

      return {
        success: false,
        error: `Webhook delivery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Deliver webhook with retry logic
   */
  static async deliverWithRetry(
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<{ success: boolean; error?: string; attempts: number }> {
    const retryPolicy = config.retry_policy || {
      max_retries: 3,
      retry_delay: 5,
      backoff_multiplier: 2,
    };

    let attempts = 0;
    let delay = retryPolicy.retry_delay;

    while (attempts <= retryPolicy.max_retries) {
      attempts++;

      // Update retry count in payload metadata
      const retryPayload = {
        ...payload,
        metadata: {
          ...payload.metadata,
          retry_count: attempts - 1,
        },
      };

      const result = await this.deliver(config, retryPayload);

      if (result.success) {
        return { success: true, attempts };
      }

      // If this was the last attempt, return the error
      if (attempts > retryPolicy.max_retries) {
        return { success: false, error: result.error, attempts };
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
      delay *= retryPolicy.backoff_multiplier;
    }

    return { success: false, error: 'Max retries exceeded', attempts };
  }
}

/**
 * Webhook utilities
 */
export class WebhookUtils {
  /**
   * Generate webhook ID
   */
  static generateId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create webhook payload
   */
  static createPayload(
    event: WebhookEventType,
    data: any,
    tenantId?: string,
    metadata?: any
  ): WebhookPayload {
    return {
      id: this.generateId(),
      event,
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      data,
      metadata: {
        source: 'avian-platform',
        version: '1.0.0',
        ...metadata,
      },
    };
  }

  /**
   * Validate webhook payload
   */
  static validatePayload(payload: any): { valid: boolean; error?: string } {
    try {
      webhookSchemas.base.parse(payload);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid webhook payload'
      };
    }
  }

  /**
   * Extract tenant ID from webhook source
   */
  static extractTenantId(source: string, payload: any): string | null {
    // Implementation depends on how different sources encode tenant information
    // This is a placeholder implementation

    if (payload.tenant_id) {
      return payload.tenant_id;
    }

    // Extract from source-specific fields
    if (source.includes('siem') && payload.customer_id) {
      return payload.customer_id;
    }

    if (source.includes('threat-lake') && payload.organization_id) {
      return payload.organization_id;
    }

    return null;
  }
}