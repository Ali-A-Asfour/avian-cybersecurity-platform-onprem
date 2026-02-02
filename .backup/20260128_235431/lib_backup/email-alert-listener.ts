/**
 * Email Alert Listener
 * 
 * Listens for SonicWall alert emails via IMAP and creates alert records.
 * Implements email parsing, device matching, and duplicate detection.
 * 
 * Requirements: 11.1-11.10
 */

import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { db } from './database';
import { firewallDevices } from '../../database/schemas/firewall';
import { eq, or } from 'drizzle-orm';
import { AlertManager } from './alert-manager';
import { logger } from './logger';
import { config } from './config';
import { connectRedis } from './redis';
import crypto from 'crypto';
import type { EmailConfig, ParsedAlert } from '../types/firewall';

/**
 * Get IMAP configuration from environment
 * 
 * Requirements: 11.1
 */
export function getImapConfig(): EmailConfig {
    return {
        host: config.imap.host,
        port: config.imap.port,
        user: config.imap.user || '',
        password: config.imap.password || '',
        tls: config.imap.tls,
    };
}

/**
 * Email Alert Listener Class
 * 
 * Provides methods for listening to email alerts from SonicWall devices.
 */
export class EmailAlertListener {
    private imapClient: Imap | null = null;
    private config: EmailConfig;
    private isRunning: boolean = false;
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (Requirement 11.1)
    private static readonly EMAIL_DEDUP_WINDOW_SECONDS = 300; // 5 minutes (Requirement 11.10)
    private static readonly EMAIL_DEDUP_KEY_PREFIX = 'email:dedup:';

    constructor(config: EmailConfig) {
        this.config = config;
    }

    /**
     * Start the email listener
     * 
     * Requirements: 11.1
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Email alert listener already running');
            return;
        }

        logger.info('Starting email alert listener', {
            host: this.config.host,
            port: this.config.port,
            user: this.config.user,
        });

        this.isRunning = true;

        // Check for new emails immediately
        await this.checkForNewEmails();

        // Set up periodic checking
        this.checkInterval = setInterval(async () => {
            await this.checkForNewEmails();
        }, this.CHECK_INTERVAL_MS);

        logger.info('Email alert listener started');
    }

    /**
     * Stop the email listener
     * 
     * Requirements: 11.1
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('Email alert listener not running');
            return;
        }

        logger.info('Stopping email alert listener');

        this.isRunning = false;

        // Clear interval
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        // Close IMAP connection if open
        if (this.imapClient) {
            this.imapClient.end();
            this.imapClient = null;
        }

        logger.info('Email alert listener stopped');
    }

    /**
     * Check for new emails
     * 
     * Requirements: 11.1
     */
    async checkForNewEmails(): Promise<void> {
        try {
            logger.debug('Checking for new emails');

            const emails = await this.fetchUnreadEmails();

            logger.info(`Found ${emails.length} unread emails`);

            for (const { email, uid } of emails) {
                await this.processEmail(email, uid);
            }
        } catch (error) {
            logger.error('Failed to check for new emails', error instanceof Error ? error : new Error(String(error)));
        }
    }

    /**
     * Fetch unread emails from IMAP server
     * 
     * Requirements: 11.1
     */
    private async fetchUnreadEmails(): Promise<Array<{ email: ParsedMail; uid: number }>> {
        return new Promise((resolve, reject) => {
            const emails: Array<{ email: ParsedMail; uid: number }> = [];

            // Create IMAP connection
            const imap = new Imap({
                user: this.config.user,
                password: this.config.password,
                host: this.config.host,
                port: this.config.port,
                tls: this.config.tls,
                tlsOptions: { rejectUnauthorized: false },
            });

            imap.once('ready', () => {
                imap.openBox('INBOX', false, (err) => {
                    if (err) {
                        imap.end();
                        return reject(err);
                    }

                    // Search for unread emails from SonicWall
                    imap.search(['UNSEEN'], (err, results) => {
                        if (err) {
                            imap.end();
                            return reject(err);
                        }

                        if (!results || results.length === 0) {
                            imap.end();
                            return resolve([]);
                        }

                        const fetch = imap.fetch(results, { bodies: '' });

                        fetch.on('message', (msg, seqno) => {
                            let uid: number = seqno;

                            msg.once('attributes', (attrs) => {
                                uid = attrs.uid;
                            });

                            msg.on('body', (stream) => {
                                simpleParser(stream, (err, parsed) => {
                                    if (err) {
                                        logger.error('Failed to parse email', err);
                                        return;
                                    }
                                    emails.push({ email: parsed, uid });
                                });
                            });
                        });

                        fetch.once('error', (err) => {
                            imap.end();
                            reject(err);
                        });

                        fetch.once('end', () => {
                            imap.end();
                            resolve(emails);
                        });
                    });
                });
            });

            imap.once('error', (err) => {
                reject(err);
            });

            imap.connect();
        });
    }

    /**
     * Process a single email
     * 
     * Requirements: 11.2-11.10
     */
    private async processEmail(email: ParsedMail, uid: number): Promise<void> {
        try {
            logger.debug('Processing email', {
                from: email.from?.text,
                subject: email.subject,
                date: email.date,
                uid,
            });

            // Check if email is from SonicWall
            if (!this.isSonicWallEmail(email)) {
                logger.debug('Email not from SonicWall, skipping', {
                    from: email.from?.text,
                });
                return;
            }

            // Parse email into alert
            const parsedAlert = await this.parseEmail(email);

            if (!parsedAlert) {
                logger.warn('Failed to parse email into alert', {
                    from: email.from?.text,
                    subject: email.subject,
                });
                return;
            }

            // Check for duplicate
            if (await this.isDuplicateEmail(parsedAlert)) {
                logger.debug('Duplicate email detected, skipping', {
                    alertType: parsedAlert.alertType,
                    deviceId: parsedAlert.deviceId,
                });
                return;
            }

            // Create alert from email
            await this.createAlertFromEmail(parsedAlert);

            // Mark email as processed (Requirement 11.9)
            await this.markEmailAsProcessed(uid);

            logger.info('Email processed successfully', {
                alertType: parsedAlert.alertType,
                deviceId: parsedAlert.deviceId,
                uid,
            });
        } catch (error) {
            logger.error('Failed to process email', error instanceof Error ? error : new Error(String(error)), {
                from: email.from?.text,
                subject: email.subject,
            });
        }
    }

    /**
     * Check if email is from SonicWall
     * 
     * Requirements: 11.1
     */
    private isSonicWallEmail(email: ParsedMail): boolean {
        const from = email.from?.text?.toLowerCase() || '';
        return from.includes('sonicwall') || from.includes('sonic-wall');
    }

    /**
     * Parse email into alert
     * 
     * Requirements: 11.2-11.5
     */
    async parseEmail(email: ParsedMail): Promise<ParsedAlert | null> {
        try {
            const subject = email.subject || '';
            const body = email.text || '';

            // Extract timestamp from email headers or body (Requirement 11.4)
            const timestamp = this.extractTimestamp(email, body);

            // Extract alert type from subject (Requirement 11.2)
            const alertType = this.extractAlertType(subject);
            if (!alertType) {
                logger.warn('Could not extract alert type from subject', { subject });
                return null;
            }

            // Extract severity from body (Requirement 11.3)
            const severity = this.extractSeverity(body);

            // Extract device identifier (Requirement 11.5)
            const deviceIdentifier = this.extractDeviceIdentifier(body, subject);

            // Match device identifier to device_id (Requirement 11.6-11.7)
            let deviceId: string | undefined;
            if (deviceIdentifier) {
                deviceId = await this.matchDevice(deviceIdentifier);
            }

            return {
                alertType,
                severity,
                message: body,
                timestamp,
                deviceIdentifier,
                deviceId,
            };
        } catch (error) {
            logger.error('Failed to parse email', error instanceof Error ? error : new Error(String(error)));
            return null;
        }
    }

    /**
     * Extract alert type from email subject
     * 
     * Requirements: 11.2
     */
    private extractAlertType(subject: string): string | null {
        const patterns = [
            { pattern: /IPS\s+Alert/i, type: 'ips_alert' },
            { pattern: /VPN\s+Down/i, type: 'vpn_down' },
            { pattern: /VPN\s+Tunnel\s+Down/i, type: 'vpn_down' },
            { pattern: /License\s+Expir/i, type: 'license_expiring' },
            { pattern: /WAN\s+Down/i, type: 'wan_down' },
            { pattern: /Interface\s+Down/i, type: 'interface_down' },
            { pattern: /High\s+CPU/i, type: 'high_cpu' },
            { pattern: /High\s+Memory/i, type: 'high_memory' },
            { pattern: /Gateway\s+AV/i, type: 'gav_alert' },
            { pattern: /Anti-Virus/i, type: 'gav_alert' },
            { pattern: /Malware/i, type: 'malware_detected' },
            { pattern: /Botnet/i, type: 'botnet_alert' },
            { pattern: /ATP/i, type: 'atp_alert' },
            { pattern: /Intrusion/i, type: 'ips_alert' },
            { pattern: /Security\s+Alert/i, type: 'security_alert' },
        ];

        for (const { pattern, type } of patterns) {
            if (pattern.test(subject)) {
                return type;
            }
        }

        // Default to generic alert
        return 'email_alert';
    }

    /**
     * Extract timestamp from email headers or body
     * 
     * Requirements: 11.4
     */
    private extractTimestamp(email: ParsedMail, body: string): Date {
        // First, try to use the email header date (most reliable)
        if (email.date && email.date instanceof Date && !isNaN(email.date.getTime())) {
            return email.date;
        }

        // Second, try to parse timestamp from email body
        // Common patterns in SonicWall emails:
        // - "Time: 2024-12-08 10:30:45"
        // - "Timestamp: 12/08/2024 10:30:45"
        // - "Date/Time: Dec 8, 2024 10:30:45"
        // - ISO format: "2024-12-08T10:30:45Z"

        const timestampPatterns = [
            // ISO 8601 format
            /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/,
            // Time: YYYY-MM-DD HH:MM:SS
            /(?:time|timestamp|date):\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/i,
            // MM/DD/YYYY HH:MM:SS
            /(?:time|timestamp|date):\s*(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i,
            // Month DD, YYYY HH:MM:SS
            /(?:time|timestamp|date):\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}\s+\d{2}:\d{2}:\d{2})/i,
        ];

        for (const pattern of timestampPatterns) {
            const match = body.match(pattern);
            if (match) {
                const parsedDate = new Date(match[1]);
                if (!isNaN(parsedDate.getTime())) {
                    logger.debug('Extracted timestamp from email body', {
                        extracted: match[1],
                        parsed: parsedDate.toISOString(),
                    });
                    return parsedDate;
                }
            }
        }

        // Last resort: use current time
        logger.debug('Could not extract timestamp from email, using current time');
        return new Date();
    }

    /**
     * Extract severity from email body
     * 
     * Requirements: 11.3
     */
    private extractSeverity(body: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
        const lowerBody = body.toLowerCase();

        if (lowerBody.includes('critical') || lowerBody.includes('emergency')) {
            return 'critical';
        }
        if (lowerBody.includes('high') || lowerBody.includes('urgent')) {
            return 'high';
        }
        if (lowerBody.includes('medium') || lowerBody.includes('warning')) {
            return 'medium';
        }
        if (lowerBody.includes('low')) {
            return 'low';
        }

        // Default to info
        return 'info';
    }

    /**
     * Extract device identifier from email
     * 
     * Requirements: 11.5
     */
    private extractDeviceIdentifier(body: string, subject: string): string | null {
        const text = `${subject} ${body}`;

        // Try to extract serial number (format: C0EAE4XXXXXX)
        const serialMatch = text.match(/\b[A-Z0-9]{12,}\b/);
        if (serialMatch) {
            return serialMatch[0];
        }

        // Try to extract IP address
        const ipMatch = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
        if (ipMatch) {
            return ipMatch[0];
        }

        // Try to extract hostname
        const hostnameMatch = text.match(/(?:hostname|device|firewall):\s*([a-zA-Z0-9\-\.]+)/i);
        if (hostnameMatch) {
            return hostnameMatch[1];
        }

        return null;
    }

    /**
     * Match device identifier to device_id
     * 
     * Requirements: 11.6-11.7
     */
    async matchDevice(identifier: string): Promise<string | undefined> {
        try {
            // Try matching by serial number
            let device = await db.query.firewallDevices.findFirst({
                where: eq(firewallDevices.serialNumber, identifier),
            });

            if (device) {
                return device.id;
            }

            // Try matching by management IP
            device = await db.query.firewallDevices.findFirst({
                where: eq(firewallDevices.managementIp, identifier),
            });

            if (device) {
                return device.id;
            }

            // Try matching by hostname (if stored in model field)
            // Requirement 11.6: Try matching by hostname (if available)
            device = await db.query.firewallDevices.findFirst({
                where: eq(firewallDevices.model, identifier),
            });

            if (device) {
                return device.id;
            }

            logger.warn('Could not match device identifier to device', { identifier });
            return undefined;
        } catch (error) {
            logger.error('Failed to match device', error instanceof Error ? error : new Error(String(error)), {
                identifier,
            });
            return undefined;
        }
    }

    /**
     * Check if email is a duplicate
     * 
     * Requirements: 11.10
     * 
     * Email-specific deduplication with 5-minute window:
     * - Same alert_type + device_id within 5 minutes = duplicate
     * - Uses Redis for fast deduplication checks with 5-minute TTL
     * - Separate from AlertManager's 2-minute deduplication window
     */
    private async isDuplicateEmail(alert: ParsedAlert): Promise<boolean> {
        try {
            // Only deduplicate if we have a device ID
            if (!alert.deviceId) {
                logger.debug('Skipping email deduplication for alert without device ID', {
                    alertType: alert.alertType,
                });
                return false;
            }

            const redis = await connectRedis();
            if (!redis) {
                // If Redis not available, skip deduplication
                logger.warn('Redis not available, skipping email deduplication');
                return false;
            }

            // Create deduplication key based on alert characteristics
            // Key format: email:dedup:<hash of alert_type + device_id>
            const dedupKey = this.createEmailDedupKey(
                alert.alertType,
                alert.deviceId
            );

            // Check if key exists in Redis
            const exists = await redis.exists(dedupKey);

            if (exists) {
                // Duplicate found
                logger.debug('Duplicate email detected', {
                    alertType: alert.alertType,
                    deviceId: alert.deviceId,
                    dedupKey: dedupKey,
                    dedupWindowSeconds: EmailAlertListener.EMAIL_DEDUP_WINDOW_SECONDS,
                });
                return true;
            }

            // Not a duplicate, set key with 5-minute TTL
            await redis.setEx(
                dedupKey,
                EmailAlertListener.EMAIL_DEDUP_WINDOW_SECONDS,
                new Date().toISOString()
            );

            logger.debug('Email deduplication key created', {
                alertType: alert.alertType,
                deviceId: alert.deviceId,
                dedupKey: dedupKey,
                ttlSeconds: EmailAlertListener.EMAIL_DEDUP_WINDOW_SECONDS,
            });

            return false;
        } catch (error) {
            logger.error('Email deduplication check failed', error instanceof Error ? error : new Error(String(error)), {
                alertType: alert.alertType,
                deviceId: alert.deviceId,
            });
            // On error, allow email processing (fail open)
            return false;
        }
    }

    /**
     * Create deduplication key for email alerts
     * 
     * Requirements: 11.10
     */
    private createEmailDedupKey(alertType: string, deviceId: string): string {
        // Create a deterministic key based on alert type and device
        const components = [alertType, deviceId];

        const hash = crypto
            .createHash('sha256')
            .update(components.join(':'))
            .digest('hex')
            .substring(0, 16);

        return `${EmailAlertListener.EMAIL_DEDUP_KEY_PREFIX}${hash}`;
    }

    /**
     * Create alert from parsed email
     * 
     * Requirements: 11.6-11.8
     */
    private async createAlertFromEmail(alert: ParsedAlert): Promise<void> {
        try {
            // Get tenant_id from device
            let tenantId: string;

            if (alert.deviceId) {
                const device = await db.query.firewallDevices.findFirst({
                    where: eq(firewallDevices.id, alert.deviceId),
                });

                if (!device) {
                    logger.error('Device not found for alert', { deviceId: alert.deviceId });
                    return;
                }

                tenantId = device.tenantId;
            } else {
                // If no device match, create alert with device_id=null and flag for review (Requirement 11.7)
                logger.warn('Creating alert without device match - flagged for review', {
                    alertType: alert.alertType,
                    deviceIdentifier: alert.deviceIdentifier,
                });

                // Get the first available tenant for unmatched alerts
                // In production, you might want to use a dedicated "system" tenant
                // or allow configuration of which tenant receives unmatched alerts
                const firstTenant = await db.query.tenants.findFirst();

                if (!firstTenant) {
                    logger.error('No tenant found to assign unmatched alert');
                    return;
                }

                tenantId = firstTenant.id;

                logger.info('Assigning unmatched alert to tenant', {
                    tenantId,
                    alertType: alert.alertType,
                    deviceIdentifier: alert.deviceIdentifier,
                });
            }

            // Create alert using AlertManager
            await AlertManager.createAlert({
                tenantId,
                deviceId: alert.deviceId, // Will be undefined/null if no match
                alertType: alert.alertType,
                severity: alert.severity,
                message: alert.message,
                source: 'email', // Requirement 11.8
                metadata: {
                    deviceIdentifier: alert.deviceIdentifier,
                    emailTimestamp: alert.timestamp.toISOString(),
                    needsReview: !alert.deviceId, // Flag for manual review if no device match
                    unmatchedDevice: !alert.deviceId, // Additional flag for filtering
                },
            });

            logger.info('Alert created from email', {
                alertType: alert.alertType,
                deviceId: alert.deviceId,
                severity: alert.severity,
                needsReview: !alert.deviceId,
            });
        } catch (error) {
            logger.error('Failed to create alert from email', error instanceof Error ? error : new Error(String(error)), {
                alertType: alert.alertType,
                deviceId: alert.deviceId,
            });
            throw error;
        }
    }

    /**
     * Mark email as processed
     * 
     * Requirements: 11.9
     * Marks email as read and moves it to processed folder
     */
    private async markEmailAsProcessed(uid: number): Promise<void> {
        return new Promise((resolve, reject) => {
            // Create IMAP connection
            const imap = new Imap({
                user: this.config.user,
                password: this.config.password,
                host: this.config.host,
                port: this.config.port,
                tls: this.config.tls,
                tlsOptions: { rejectUnauthorized: false },
            });

            imap.once('ready', () => {
                imap.openBox('INBOX', false, (err) => {
                    if (err) {
                        imap.end();
                        return reject(err);
                    }

                    // Mark email as read (add \Seen flag)
                    imap.addFlags(uid, ['\\Seen'], (err) => {
                        if (err) {
                            logger.error('Failed to mark email as read', err, { uid });
                            imap.end();
                            return reject(err);
                        }

                        logger.debug('Email marked as read', { uid });

                        // Try to move email to Processed folder
                        // If folder doesn't exist, just leave it marked as read
                        imap.move(uid, 'Processed', (err) => {
                            if (err) {
                                // Folder might not exist, which is okay
                                logger.debug('Could not move email to Processed folder (folder may not exist)', {
                                    uid,
                                    error: err.message,
                                });
                            } else {
                                logger.debug('Email moved to Processed folder', { uid });
                            }

                            imap.end();
                            resolve();
                        });
                    });
                });
            });

            imap.once('error', (err) => {
                reject(err);
            });

            imap.connect();
        });
    }
}
