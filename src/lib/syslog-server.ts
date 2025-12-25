import * as dgram from 'dgram';
import * as tls from 'tls';
import * as net from 'net';
import * as fs from 'fs';
// import { logger } from '@/lib/logger';
import { dataIngestionService, DataSourceType, EventSeverity } from '@/services/data-ingestion.service';
import { firewallStreamProcessor } from '@/lib/firewall-stream-processor';

export interface SyslogMessage {
  facility: number;
  severity: number;
  timestamp: Date;
  hostname: string;
  appname?: string;
  procid?: string;
  msgid?: string;
  message: string;
  raw: string;
}

export interface SyslogServerConfig {
  port: number;
  host?: string;
  protocol: 'udp' | 'tcp' | 'tls';
  tls?: {
    cert: string;
    key: string;
    ca?: string;
  };
  tenantMapping: Map<string, string>; // hostname/IP -> tenant_id mapping
}

export class SyslogServer {
  private config: SyslogServerConfig;
  private server?: dgram.Socket | net.Server | tls.Server;
  private isRunning: boolean = false;

  constructor(config: SyslogServerConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting syslog server', {
        port: this.config.port,
        protocol: this.config.protocol
      });

      switch (this.config.protocol) {
        case 'udp':
          await this.startUDPServer();
          break;
        case 'tcp':
          await this.startTCPServer();
          break;
        case 'tls':
          await this.startTLSServer();
          break;
        default:
          throw new Error(`Unsupported protocol: ${this.config.protocol}`);
      }

      this.isRunning = true;
      logger.info('Syslog server started successfully', {
        port: this.config.port,
        protocol: this.config.protocol
      });
    } catch (error) {
      logger.error('Failed to start syslog server', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.server) {
        if (this.config.protocol === 'udp') {
          (this.server as dgram.Socket).close();
        } else {
          (this.server as net.Server).close();
        }
        this.server = undefined;
      }

      this.isRunning = false;
      logger.info('Syslog server stopped');
    } catch (error) {
      logger.error('Failed to stop syslog server', { error });
    }
  }

  private async startUDPServer(): Promise<void> {
    const server = dgram.createSocket('udp4');

    server.on('message', async (msg, rinfo) => {
      try {
        const syslogMsg = this.parseSyslogMessage(msg.toString(), rinfo.address);
        await this.processSyslogMessage(syslogMsg, rinfo.address);
      } catch (error) {
        logger.error('Failed to process UDP syslog message', {
          error,
          remoteAddress: rinfo.address
        });
      }
    });

    server.on('error', (error) => {
      logger.error('UDP syslog server error', { error });
    });

    return new Promise((resolve, reject) => {
      server.bind(this.config.port, this.config.host, () => {
        this.server = server;
        resolve();
      });

      server.on('error', reject);
    });
  }

  private async startTCPServer(): Promise<void> {
    const server = net.createServer((socket) => {
      socket.on('data', async (data) => {
        try {
          const messages = data.toString().split('\n').filter(msg => msg.trim());
          for (const msgStr of messages) {
            const syslogMsg = this.parseSyslogMessage(msgStr, socket.remoteAddress || '');
            await this.processSyslogMessage(syslogMsg, socket.remoteAddress || '');
          }
        } catch (error) {
          logger.error('Failed to process TCP syslog message', {
            error,
            remoteAddress: socket.remoteAddress
          });
        }
      });

      socket.on('error', (error) => {
        logger.error('TCP syslog socket error', { error });
      });
    });

    server.on('error', (error) => {
      logger.error('TCP syslog server error', { error });
    });

    return new Promise((resolve, reject) => {
      server.listen(this.config.port, this.config.host, () => {
        this.server = server;
        resolve();
      });

      server.on('error', reject);
    });
  }

  private async startTLSServer(): Promise<void> {
    if (!this.config.tls) {
      throw new Error('TLS configuration required for TLS syslog server');
    }

    const options: tls.TlsOptions = {
      cert: fs.readFileSync(this.config.tls.cert),
      key: fs.readFileSync(this.config.tls.key)
    };

    if (this.config.tls.ca) {
      options.ca = fs.readFileSync(this.config.tls.ca);
    }

    const server = tls.createServer(options, (socket) => {
      socket.on('data', async (data) => {
        try {
          const messages = data.toString().split('\n').filter(msg => msg.trim());
          for (const msgStr of messages) {
            const syslogMsg = this.parseSyslogMessage(msgStr, socket.remoteAddress || '');
            await this.processSyslogMessage(syslogMsg, socket.remoteAddress || '');
          }
        } catch (error) {
          logger.error('Failed to process TLS syslog message', {
            error,
            remoteAddress: socket.remoteAddress
          });
        }
      });

      socket.on('error', (error) => {
        logger.error('TLS syslog socket error', { error });
      });
    });

    server.on('error', (error) => {
      logger.error('TLS syslog server error', { error });
    });

    return new Promise((resolve, reject) => {
      server.listen(this.config.port, this.config.host, () => {
        this.server = server;
        resolve();
      });

      server.on('error', reject);
    });
  }

  private parseSyslogMessage(message: string, sourceIP: string): SyslogMessage {
    // RFC 3164 and RFC 5424 syslog parsing
    const rfc5424Regex = /^<(\d+)>(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/;
    const rfc3164Regex = /^<(\d+)>(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.*)$/;

    let match = message.match(rfc5424Regex);
    if (match) {
      // RFC 5424 format
      const priority = parseInt(match[1]);
      const facility = Math.floor(priority / 8);
      const severity = priority % 8;

      return {
        facility,
        severity,
        timestamp: new Date(match[3]),
        hostname: match[4],
        appname: match[5] !== '-' ? match[5] : undefined,
        procid: match[6] !== '-' ? match[6] : undefined,
        msgid: match[7] !== '-' ? match[7] : undefined,
        message: match[8],
        raw: message
      };
    }

    match = message.match(rfc3164Regex);
    if (match) {
      // RFC 3164 format
      const priority = parseInt(match[1]);
      const facility = Math.floor(priority / 8);
      const severity = priority % 8;

      return {
        facility,
        severity,
        timestamp: this.parseRFC3164Timestamp(match[2]),
        hostname: match[3],
        message: match[4],
        raw: message
      };
    }

    // Fallback for non-standard formats
    return {
      facility: 16, // Local use 0
      severity: 6,  // Info
      timestamp: new Date(),
      hostname: sourceIP,
      message: message,
      raw: message
    };
  }

  private parseRFC3164Timestamp(timestampStr: string): Date {
    // Parse "MMM dd HH:mm:ss" format
    const currentYear = new Date().getFullYear();
    const date = new Date(`${timestampStr} ${currentYear}`);

    // If the parsed date is in the future, assume it's from last year
    if (date > new Date()) {
      date.setFullYear(currentYear - 1);
    }

    return date;
  }

  private async processSyslogMessage(syslogMsg: SyslogMessage, sourceIP: string): Promise<void> {
    try {
      // Determine tenant from hostname or source IP
      const _tenantId = this.resolveTenantId(syslogMsg.hostname, sourceIP);
      if (!tenantId) {
        logger.warn('No tenant mapping found for syslog message', {
          hostname: syslogMsg.hostname,
          sourceIP
        });
        return;
      }

      // Parse firewall-specific information from the message
      const firewallEvent = this.parseFirewallMessage(syslogMsg);
      if (!firewallEvent) {
        // Not a firewall message, skip or handle as generic syslog
        return;
      }

      // STREAM PROCESSING: Analyze in real-time, only store threats
      const processingResult = await firewallStreamProcessor.processLog(
        tenantId,
        firewallEvent,
        syslogMsg.timestamp
      );

      // If it's not a threat, we're done - metrics are already updated in memory
      if (!processingResult.shouldStore) {
        return;
      }

      // Only threats/alerts reach this point - store them
      const threat = processingResult.threat!;
      logger.info('Threat detected in firewall logs', {
        type: threat.type,
        severity: threat.severity,
        description: threat.description
      });

      // Create security event for threats only
      const securityEvent = {
        source_type: DataSourceType.SYSLOG,
        source_id: `syslog-${sourceIP}`,
        tenant_id: tenantId,
        event_type: `firewall_${firewallEvent.action}`,
        severity: this.mapSyslogSeverity(syslogMsg.severity),
        timestamp: syslogMsg.timestamp,
        raw_data: {
          syslog: syslogMsg,
          firewall: firewallEvent
        },
        normalized_data: {
          event_id: crypto.randomUUID(),
          event_type: `firewall_${firewallEvent.action}`,
          severity: this.mapSyslogSeverity(syslogMsg.severity),
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
      };

      await dataIngestionService.ingestSecurityEvent(securityEvent);
    } catch (error) {
      logger.error('Failed to process syslog message', { error, syslogMsg });
    }
  }

  private resolveTenantId(hostname: string, sourceIP: string): string | null {
    // Try hostname first, then IP address
    return this.config.tenantMapping.get(hostname) ||
      this.config.tenantMapping.get(sourceIP) ||
      null;
  }

  private parseFirewallMessage(syslogMsg: SyslogMessage): any | null {
    const message = syslogMsg.message;

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
        protocol: 'tcp' // Default for Cisco ASA
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
        protocol: 'tcp' // Default
      };
    }

    return null;
  }

  private mapSyslogSeverity(syslogSeverity: number): EventSeverity {
    // Syslog severity levels: 0=Emergency, 1=Alert, 2=Critical, 3=Error, 4=Warning, 5=Notice, 6=Info, 7=Debug
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

  isListening(): boolean {
    return this.isRunning;
  }

  getConfig(): SyslogServerConfig {
    return { ...this.config };
  }
}

// Singleton syslog server manager
export class SyslogServerManager {
  private static instance: SyslogServerManager;
  private servers: Map<string, SyslogServer> = new Map();

  public static getInstance(): SyslogServerManager {
    if (!SyslogServerManager.instance) {
      SyslogServerManager.instance = new SyslogServerManager();
    }
    return SyslogServerManager.instance;
  }

  async createServer(id: string, config: SyslogServerConfig): Promise<SyslogServer> {
    if (this.servers.has(id)) {
      throw new Error(`Syslog server with id ${id} already exists`);
    }

    const server = new SyslogServer(config);
    await server.start();

    this.servers.set(id, server);
    return server;
  }

  async stopServer(id: string): Promise<boolean> {
    const server = this.servers.get(id);
    if (!server) {
      return false;
    }

    await server.stop();
    this.servers.delete(id);
    return true;
  }

  getServer(id: string): SyslogServer | undefined {
    return this.servers.get(id);
  }

  getAllServers(): Map<string, SyslogServer> {
    return new Map(this.servers);
  }

  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.values()).map(server => server.stop());
    await Promise.all(stopPromises);
    this.servers.clear();
  }
}

export const syslogServerManager = SyslogServerManager.getInstance();