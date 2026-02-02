import { NextRequest, NextResponse } from 'next/server';
import { dataIngestionService, DataSourceType, EventSeverity } from '@/services/data-ingestion.service';
import { logger } from '@/lib/logger';
import { validateRequest } from '@/lib/validation';
import { z } from 'zod';

const syslogIngestionSchema = z.object({
  tenant_id: z.string().uuid(),
  source_id: z.string(),
  messages: z.array(z.object({
    facility: z.number().min(0).max(23),
    severity: z.number().min(0).max(7),
    timestamp: z.string(),
    hostname: z.string(),
    appname: z.string().optional(),
    procid: z.string().optional(),
    msgid: z.string().optional(),
    message: z.string(),
    raw: z.string()
  }))
});

export async function POST(request: NextRequest) {
  try {
    // This endpoint is for internal syslog server use
    // Authentication is handled via API key or internal service token
    const apiKey = request.headers.get('x-api-key');
    const internalToken = request.headers.get('x-internal-token');

    if (!apiKey && !internalToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // TODO: Validate API key or internal token
    // For now, we'll accept any key for internal services

    const body = await request.json();
    const validationResult = validateRequest(syslogIngestionSchema, body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.errors },
        { status: 400 }
      );
    }

    const { tenant_id, source_id, messages } = validationResult.data;
    const processedEvents = [];

    for (const syslogMsg of messages) {
      try {
        // Parse firewall-specific information from the message
        const firewallEvent = parseFirewallMessage(syslogMsg.message);

        if (firewallEvent) {
          const securityEvent = await dataIngestionService.ingestSecurityEvent({
            source_type: DataSourceType.SYSLOG,
            source_id,
            tenant_id,
            event_type: `firewall_${firewallEvent.action}`,
            severity: mapSyslogSeverity(syslogMsg.severity),
            timestamp: new Date(syslogMsg.timestamp),
            raw_data: {
              syslog: syslogMsg,
              firewall: firewallEvent
            },
            normalized_data: {
              event_id: crypto.randomUUID(),
              event_type: `firewall_${firewallEvent.action}`,
              severity: mapSyslogSeverity(syslogMsg.severity),
              source_ip: firewallEvent.source_ip,
              destination_ip: firewallEvent.destination_ip,
              source_port: firewallEvent.source_port,
              destination_port: firewallEvent.destination_port,
              protocol: firewallEvent.protocol,
              description: `Firewall ${firewallEvent.action}: ${firewallEvent.source_ip}:${firewallEvent.source_port} → ${firewallEvent.destination_ip}:${firewallEvent.destination_port}`,
              threat_indicators: firewallEvent.action === 'deny' ? [{
                type: 'ip_address',
                value: firewallEvent.source_ip,
                confidence: 0.6
              }] : []
            },
            tags: ['syslog', 'firewall', firewallEvent.action, `protocol:${firewallEvent.protocol}`]
          });

          processedEvents.push(securityEvent);
        }
      } catch (error) {
        logger.error('Failed to process syslog message', {
          error,
          message: syslogMsg.message
        });
      }
    }

    return NextResponse.json({
      processed: processedEvents.length,
      total: messages.length,
      events: processedEvents
    });
  } catch (error) {
    logger.error('Failed to ingest syslog messages', { error });
    return NextResponse.json(
      { error: 'Failed to ingest syslog messages' },
      { status: 500 }
    );
  }
}

function parseFirewallMessage(message: string): any | null {
  // pfSense firewall log format
  const pfSenseRegex = /(\w+),(\d+),(\d+),(\d+),(\w+),(\w+),(\d+\.\d+\.\d+\.\d+),(\d+\.\d+\.\d+\.\d+),(\d+),(\d+)/;
  let match = message.match(pfSenseRegex);
  if (match) {
    return {
      action: match[1].toLowerCase() === 'block' ? 'deny' : 'allow',
      source_ip: match[7],
      destination_ip: match[8],
      source_port: parseInt(match[9]) || 0,
      destination_port: parseInt(match[10]) || 0,
      protocol: match[5].toLowerCase()
    };
  }

  // Fortinet firewall log format
  const fortinetRegex = /action=(\w+).*srcip=(\d+\.\d+\.\d+\.\d+).*dstip=(\d+\.\d+\.\d+\.\d+).*srcport=(\d+).*dstport=(\d+).*proto=(\w+)/;
  match = message.match(fortinetRegex);
  if (match) {
    return {
      action: match[1].toLowerCase(),
      source_ip: match[2],
      destination_ip: match[3],
      source_port: parseInt(match[4]) || 0,
      destination_port: parseInt(match[5]) || 0,
      protocol: match[6].toLowerCase()
    };
  }

  // Cisco ASA firewall log format
  const ciscoRegex = /(\w+)\s+connection.*from\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)\s+to\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)/;
  match = message.match(ciscoRegex);
  if (match) {
    return {
      action: match[1].toLowerCase().includes('deny') ? 'deny' : 'allow',
      source_ip: match[2],
      destination_ip: match[4],
      source_port: parseInt(match[3]) || 0,
      destination_port: parseInt(match[5]) || 0,
      protocol: 'tcp'
    };
  }

  // SonicWall firewall log format
  const sonicwallRegex = /msg="([^"]+)".*src=(\d+\.\d+\.\d+\.\d+):(\d+)\s+dst=(\d+\.\d+\.\d+\.\d+):(\d+)\s+proto=(\w+)/;
  match = message.match(sonicwallRegex);
  if (match) {
    const msg = match[1].toLowerCase();
    const action = msg.includes('denied') || msg.includes('dropped') || msg.includes('blocked') ? 'deny' : 'allow';

    return {
      action,
      source_ip: match[2],
      destination_ip: match[4],
      source_port: parseInt(match[3]) || 0,
      destination_port: parseInt(match[5]) || 0,
      protocol: match[6].split('/')[0].toLowerCase() // Extract protocol from "tcp/https"
    };
  }

  // Generic firewall pattern
  const genericRegex = /(\d+\.\d+\.\d+\.\d+):(\d+)\s*[→>-]\s*(\d+\.\d+\.\d+\.\d+):(\d+)/;
  match = message.match(genericRegex);
  if (match) {
    const action = message.toLowerCase().includes('block') ||
      message.toLowerCase().includes('deny') ||
      message.toLowerCase().includes('drop') ? 'deny' : 'allow';

    return {
      action,
      source_ip: match[1],
      destination_ip: match[3],
      source_port: parseInt(match[2]) || 0,
      destination_port: parseInt(match[4]) || 0,
      protocol: 'tcp'
    };
  }

  return null;
}

function mapSyslogSeverity(syslogSeverity: number): EventSeverity {
  switch (syslogSeverity) {
    case 0:
    case 1:
    case 2:
      return EventSeverity.CRITICAL;
    case 3:
      return EventSeverity.HIGH;
    case 4:
      return EventSeverity.MEDIUM;
    case 5:
    case 6:
    case 7:
    default:
      return EventSeverity.LOW;
  }
}