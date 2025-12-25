import { NextRequest, NextResponse } from 'next/server';
import { AlertService } from '@/services/alert.service';
import { AlertSeverity, AlertCategory } from '@/types';
import { WebhookSecurity, WebhookRegistry, webhookSchemas } from '@/lib/webhook';
import { validateRequest } from '@/lib/validation';
import { ErrorHandler, ApiErrors } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limiter';
import { z } from 'zod';
// Removed crypto import - using Web Crypto API instead

interface WebhookPayload {
  source: string;
  alerts: Array<{
    id?: string;
    title: string;
    description: string;
    severity: string;
    category: string;
    timestamp?: string;
    metadata?: Record<string, any>;
  }>;
  tenant_id?: string;
}

interface SIEMAlert {
  event_id: string;
  event_name: string;
  event_description: string;
  severity_level: number;
  category: string;
  source_ip?: string;
  destination_ip?: string;
  user?: string;
  timestamp: string;
  raw_data?: Record<string, any>;
}

interface ThreatLakeAlert {
  finding_id: string;
  finding_title: string;
  finding_description: string;
  severity: string;
  finding_type: string;
  source_account?: string;
  region?: string;
  created_at: string;
  updated_at?: string;
  resources?: Array<{
    id: string;
    type: string;
    region?: string;
  }>;
  compliance?: {
    status: string;
    status_reason?: string;
  };
}

// Enhanced webhook payload validation schema
const enhancedWebhookSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  alerts: z.array(z.any()).optional(),
  findings: z.array(z.any()).optional(),
  tenant_id: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).refine(
  (data) => data.alerts || data.findings,
  { message: 'Either alerts or findings array is required' }
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply rate limiting for webhooks
    const rateLimitResult = await checkRateLimit(request, { windowMs: 1 * 60 * 1000, maxRequests: 100 });
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Get request context
    const source = request.headers.get('x-source-type') || 'unknown';
    const signature = request.headers.get('x-webhook-signature');
    const clientIp = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') || 'unknown';

    // Parse and validate request body
    const body = await request.json();

    // Validate webhook signature if provided
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const verificationResult = await WebhookSecurity.verifyWebhookRequest(request, webhookSecret);
      if (!verificationResult.valid) {
        return ErrorHandler.handleError(
          ApiErrors.unauthorized(`Webhook verification failed: ${verificationResult.error}`),
          '/api/webhooks/alerts'
        );
      }
    }

    // Validate payload structure
    const validationResult = enhancedWebhookSchema.safeParse(body);
    if (!validationResult.success) {
      return ErrorHandler.handleError(
        ApiErrors.validation('Invalid webhook payload structure', validationResult.error.issues),
        '/api/webhooks/alerts'
      );
    }

    // Extract tenant ID with enhanced logic
    const _tenantId = extractTenantId(request, body, source);
    if (!tenantId) {
      return ErrorHandler.handleError(
        ApiErrors.validation('Tenant ID could not be determined from webhook payload or headers'),
        '/api/webhooks/alerts'
      );
    }

    let alerts: any[] = [];

    // Parse different webhook formats with enhanced error handling
    try {
      switch (source.toLowerCase()) {
        case 'siem':
        case 'splunk':
        case 'qradar':
          alerts = parseSIEMWebhook(body, source);
          break;
        case 'threat_lake':
        case 'aws_security_hub':
          alerts = parseThreatLakeWebhook(body, source);
          break;
        case 'generic':
        default:
          alerts = parseGenericWebhook(body, source);
          break;
      }
    } catch (parseError) {
      return ErrorHandler.handleError(
        ApiErrors.validation(`Failed to parse ${source} webhook format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`),
        '/api/webhooks/alerts'
      );
    }

    if (alerts.length === 0) {
      return ErrorHandler.handleError(
        ApiErrors.validation('No valid alerts found in webhook payload'),
        '/api/webhooks/alerts'
      );
    }

    // Enhance alerts with webhook metadata
    const enhancedAlerts = alerts.map(alert => ({
      ...alert,
      metadata: {
        ...alert.metadata,
        webhook_source: source,
        webhook_received_at: new Date().toISOString(),
        webhook_client_ip: clientIp,
        webhook_user_agent: request.headers.get('user-agent') || 'unknown',
        webhook_processing_time: Date.now() - startTime,
      },
    }));

    // Create alerts in bulk with enhanced error handling
    const _result = await AlertService.bulkCreateAlerts(tenantId, enhancedAlerts);

    if (!result.success) {
      return ErrorHandler.handleError(
        ApiErrors.internal(`Failed to create alerts: ${result.error?.message || 'Unknown error'}`),
        '/api/webhooks/alerts'
      );
    }

    const processingTime = Date.now() - startTime;

    // Log successful webhook processing
    console.log(`Webhook processed successfully: ${source} -> ${alerts.length} alerts in ${processingTime}ms`);

    return ErrorHandler.success({
      processed: alerts.length,
      created: result.data?.length || 0,
      processing_time_ms: processingTime,
      source,
      tenant_id: tenantId,
    }, {
      webhook_source: source,
      tenant_id: tenantId,
      processing_time: processingTime,
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return ErrorHandler.handleError(
      error,
      '/api/webhooks/alerts'
    );
  }
}

/**
 * Enhanced tenant ID extraction with multiple fallback methods
 */
function extractTenantId(request: NextRequest, body: any, source: string): string | null {
  // 1. Check headers
  const headerTenantId = request.headers.get('x-tenant-id');
  if (headerTenantId) return headerTenantId;

  // 2. Check query parameters
  const { searchParams } = new URL(request.url);
  const queryTenantId = searchParams.get('tenant_id');
  if (queryTenantId) return queryTenantId;

  // 3. Check payload
  if (body.tenant_id) return body.tenant_id;

  // 4. Source-specific extraction
  if (source === 'aws_security_hub' && body.account_id) {
    return `aws-${body.account_id}`;
  }

  // 5. Default tenant mapping based on source
  const sourceTenantMapping: Record<string, string> = {
    'splunk-prod': process.env.DEFAULT_TENANT_ID || 'default-tenant',
    'qradar-main': process.env.DEFAULT_TENANT_ID || 'default-tenant',
    'sentinel-azure': process.env.DEFAULT_TENANT_ID || 'default-tenant',
  };

  return sourceTenantMapping[source] || process.env.DEFAULT_TENANT_ID || null;
}

/**
 * OPTIONS /api/webhooks/alerts - Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Signature, X-Source-Type, X-Tenant-ID',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function _validateWebhookSignature(payload: unknown, signature: string): Promise<boolean> {
  try {
    // Enhanced signature validation with multiple algorithm support
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';

    // Support both sha256= prefixed and raw signatures
    const cleanSignature = signature.replace(/^sha256=/, '');

    // Use Web Crypto API for HMAC generation
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(payload)));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer), byte =>
      byte.toString(16).padStart(2, '0')).join('');

    // Use constant-time comparison to prevent timing attacks
    // Convert hex strings to Uint8Arrays for comparison
    const cleanBytes = new Uint8Array(cleanSignature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    const expectedBytes = new Uint8Array(expectedSignature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);

    // Simple constant-time comparison
    if (cleanBytes.length !== expectedBytes.length) return false;
    const _result = 0;
    for (let i = 0; i < cleanBytes.length; i++) {
      result |= cleanBytes[i] ^ expectedBytes[i];
    }
    return result === 0;
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
}

function parseSIEMWebhook(payload: any, source: string): any[] {
  const alerts: any[] = [];

  try {
    // Handle array of SIEM alerts
    const siemAlerts = Array.isArray(payload.alerts) ? payload.alerts : [payload];

    for (const alert of siemAlerts) {
      const siemAlert = alert as SIEMAlert;

      // Map SIEM severity levels to our enum
      let severity: AlertSeverity = AlertSeverity.INFO;
      if (siemAlert.severity_level >= 8) severity = AlertSeverity.CRITICAL;
      else if (siemAlert.severity_level >= 6) severity = AlertSeverity.HIGH;
      else if (siemAlert.severity_level >= 4) severity = AlertSeverity.MEDIUM;
      else if (siemAlert.severity_level >= 2) severity = AlertSeverity.LOW;

      // Map SIEM categories to our enum
      let category: AlertCategory = AlertCategory.OTHER;
      const categoryLower = siemAlert.category?.toLowerCase() || '';
      if (categoryLower.includes('malware')) category = AlertCategory.MALWARE;
      else if (categoryLower.includes('phishing')) category = AlertCategory.PHISHING;
      else if (categoryLower.includes('intrusion') || categoryLower.includes('attack')) category = AlertCategory.INTRUSION;
      else if (categoryLower.includes('breach') || categoryLower.includes('exfiltration')) category = AlertCategory.DATA_BREACH;
      else if (categoryLower.includes('policy') || categoryLower.includes('violation')) category = AlertCategory.POLICY_VIOLATION;
      else if (categoryLower.includes('anomaly') || categoryLower.includes('unusual')) category = AlertCategory.ANOMALY;

      alerts.push({
        source: payload.source || 'SIEM',
        title: siemAlert.event_name || 'SIEM Alert',
        description: siemAlert.event_description || 'Alert from SIEM system',
        severity,
        category,
        status: 'open',
        metadata: {
          event_id: siemAlert.event_id,
          source_ip: siemAlert.source_ip,
          destination_ip: siemAlert.destination_ip,
          user: siemAlert.user,
          timestamp: siemAlert.timestamp,
          severity_level: siemAlert.severity_level,
          raw_data: siemAlert.raw_data,
        },
      });
    }
  } catch (error) {
    console.error('Error parsing SIEM webhook:', error);
  }

  return alerts;
}

function parseThreatLakeWebhook(payload: any, source: string): any[] {
  const alerts: any[] = [];

  try {
    // Handle AWS Security Hub / Threat Lake format
    const findings = Array.isArray(payload.findings) ? payload.findings : [payload];

    for (const finding of findings) {
      const threatAlert = finding as ThreatLakeAlert;

      // Map severity
      let severity: AlertSeverity = AlertSeverity.INFO;
      const severityLower = threatAlert.severity?.toLowerCase() || '';
      if (severityLower === 'critical') severity = AlertSeverity.CRITICAL;
      else if (severityLower === 'high') severity = AlertSeverity.HIGH;
      else if (severityLower === 'medium') severity = AlertSeverity.MEDIUM;
      else if (severityLower === 'low') severity = AlertSeverity.LOW;

      // Map finding type to category
      let category: AlertCategory = AlertCategory.OTHER;
      const typeLower = threatAlert.finding_type?.toLowerCase() || '';
      if (typeLower.includes('malware')) category = AlertCategory.MALWARE;
      else if (typeLower.includes('phishing')) category = AlertCategory.PHISHING;
      else if (typeLower.includes('intrusion')) category = AlertCategory.INTRUSION;
      else if (typeLower.includes('data')) category = AlertCategory.DATA_BREACH;
      else if (typeLower.includes('policy')) category = AlertCategory.POLICY_VIOLATION;
      else if (typeLower.includes('anomaly')) category = AlertCategory.ANOMALY;

      alerts.push({
        source: payload.source || 'Threat Lake',
        title: threatAlert.finding_title || 'Threat Lake Finding',
        description: threatAlert.finding_description || 'Finding from Threat Lake',
        severity,
        category,
        status: 'open',
        metadata: {
          finding_id: threatAlert.finding_id,
          source_account: threatAlert.source_account,
          region: threatAlert.region,
          created_at: threatAlert.created_at,
          updated_at: threatAlert.updated_at,
          resources: threatAlert.resources,
          compliance: threatAlert.compliance,
        },
      });
    }
  } catch (error) {
    console.error('Error parsing Threat Lake webhook:', error);
  }

  return alerts;
}

function parseGenericWebhook(payload: WebhookPayload, source: string): any[] {
  const alerts: any[] = [];

  try {
    const alertsData = Array.isArray(payload.alerts) ? payload.alerts : [];

    for (const alertItem of alertsData) {
      // Validate required fields
      if (!alertItem.title || !alertItem.description) {
        continue;
      }

      // Map severity
      let severity: AlertSeverity = AlertSeverity.INFO;
      const severityLower = alertItem.severity?.toLowerCase() || '';
      if (['critical', 'crit'].includes(severityLower)) severity = AlertSeverity.CRITICAL;
      else if (['high'].includes(severityLower)) severity = AlertSeverity.HIGH;
      else if (['medium', 'med'].includes(severityLower)) severity = AlertSeverity.MEDIUM;
      else if (['low'].includes(severityLower)) severity = AlertSeverity.LOW;

      // Map category
      let category: AlertCategory = AlertCategory.OTHER;
      const categoryLower = alertItem.category?.toLowerCase() || '';
      if (['malware', 'virus'].includes(categoryLower)) category = AlertCategory.MALWARE;
      else if (['phishing', 'phish'].includes(categoryLower)) category = AlertCategory.PHISHING;
      else if (['intrusion', 'attack'].includes(categoryLower)) category = AlertCategory.INTRUSION;
      else if (['breach', 'data_breach'].includes(categoryLower)) category = AlertCategory.DATA_BREACH;
      else if (['policy', 'policy_violation'].includes(categoryLower)) category = AlertCategory.POLICY_VIOLATION;
      else if (['anomaly', 'unusual'].includes(categoryLower)) category = AlertCategory.ANOMALY;

      alerts.push({
        source: payload.source || 'External System',
        title: alertItem.title,
        description: alertItem.description,
        severity,
        category,
        status: 'open',
        metadata: {
          external_id: alertItem.id,
          timestamp: alertItem.timestamp,
          ...alertItem.metadata,
        },
      });
    }
  } catch (error) {
    console.error('Error parsing generic webhook:', error);
  }

  return alerts;
}