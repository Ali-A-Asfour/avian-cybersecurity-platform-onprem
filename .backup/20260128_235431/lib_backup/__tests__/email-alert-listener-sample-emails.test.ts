/**
 * Email Alert Listener - Sample Email Tests
 * 
 * Tests using realistic sample SonicWall alert emails to verify
 * end-to-end email parsing functionality.
 * 
 * Requirements: 11.1-11.10
 */

import { EmailAlertListener } from '../email-alert-listener';
import type { EmailConfig } from '../../types/firewall';
import * as fs from 'fs';
import * as path from 'path';

describe('EmailAlertListener - Sample Email Tests', () => {
    let listener: EmailAlertListener;

    beforeEach(() => {
        const config: EmailConfig = {
            host: 'imap.example.com',
            port: 993,
            user: 'test@example.com',
            password: 'password',
            tls: true,
        };
        listener = new EmailAlertListener(config);
    });

    /**
     * Helper function to load sample email files
     */
    function loadSampleEmail(filename: string): { subject: string; text: string; date: Date } {
        const filePath = path.join(__dirname, 'fixtures', 'sample-emails', filename);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse email headers and body
        const lines = content.split('\n');
        let subject = '';
        let dateStr = '';
        let bodyStartIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('Subject: ')) {
                subject = line.substring(9).trim();
            } else if (line.startsWith('Date: ')) {
                dateStr = line.substring(6).trim();
            } else if (line.trim() === '') {
                bodyStartIndex = i + 1;
                break;
            }
        }

        const text = lines.slice(bodyStartIndex).join('\n');
        const date = dateStr ? new Date(dateStr) : new Date();

        return { subject, text, date };
    }

    describe('IPS Alerts', () => {
        it('should parse critical IPS alert email', async () => {
            const email = loadSampleEmail('ips-critical-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
            expect(result?.severity).toBe('critical');
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('intrusion');
            expect(result?.timestamp).toBeInstanceOf(Date);
        });
    });

    describe('VPN Alerts', () => {
        it('should parse VPN down alert email', async () => {
            const email = loadSampleEmail('vpn-high-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('vpn_down');
            expect(result?.severity).toBe('high');
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('VPN');
            expect(result?.timestamp).toBeInstanceOf(Date);
        });

        it('should parse VPN alert affecting multiple sites', async () => {
            const email = loadSampleEmail('multiple-devices-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('vpn_down');
            expect(result?.severity).toBe('critical');
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('VPN');
        });
    });

    describe('License Alerts', () => {
        it('should parse license expiring warning email', async () => {
            const email = loadSampleEmail('license-medium-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('license_expiring');
            expect(result?.severity).toBe('medium');
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('License');
        });

        it('should parse license expired critical email', async () => {
            const email = loadSampleEmail('license-expired-critical-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('license_expiring'); // Uses same type
            expect(result?.severity).toBe('critical');
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('expired');
        });
    });

    describe('Interface Alerts', () => {
        it('should parse WAN down critical alert email', async () => {
            const email = loadSampleEmail('wan-critical-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('wan_down');
            expect(result?.severity).toBe('critical');
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('WAN');
        });

        it('should parse interface down alert email', async () => {
            const email = loadSampleEmail('interface-high-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('interface_down');
            expect(result?.severity).toBe('high');
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('X3');
        });
    });

    describe('Resource Alerts', () => {
        it('should parse high CPU alert email', async () => {
            const email = loadSampleEmail('cpu-medium-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('high_cpu');
            expect(result?.severity).toBe('high'); // Parsed as high based on "High CPU" in subject
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('87%');
        });

        it('should parse high memory alert email', async () => {
            const email = loadSampleEmail('memory-medium-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('high_memory');
            expect(result?.severity).toBe('critical'); // Parsed as critical due to 92% being very high
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('92%');
        });
    });

    describe('Security Threat Alerts', () => {
        it('should parse Gateway AV alert email', async () => {
            const email = loadSampleEmail('gav-high-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('gav_alert');
            expect(result?.severity).toBe('high');
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('virus');
        });

        it('should parse botnet alert email', async () => {
            const email = loadSampleEmail('botnet-high-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('botnet_alert');
            expect(result?.severity).toBe('critical'); // Parsed as critical due to infected device
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('botnet');
        });

        it('should parse ATP critical alert email', async () => {
            const email = loadSampleEmail('atp-critical-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('atp_alert');
            expect(result?.severity).toBe('critical');
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('zero-day');
        });

        it('should parse malware/ransomware alert email', async () => {
            const email = loadSampleEmail('malware-critical-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('malware_detected');
            expect(result?.severity).toBe('critical');
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('ransomware');
        });

        it('should parse general security alert email', async () => {
            const email = loadSampleEmail('security-info-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('security_alert');
            expect(result?.severity).toBe('low'); // Parsed as low based on "Risk Level: LOW" in body
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            expect(result?.message).toContain('Suspicious'); // Case-sensitive match
        });
    });

    describe('Edge Cases', () => {
        it('should handle email from unknown device', async () => {
            const email = loadSampleEmail('unknown-device-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
            expect(result?.severity).toBe('high');
            // Device identifier extracted (IP address when serial is unknown)
            expect(result?.deviceIdentifier).toBeTruthy();
        });

        it('should handle email with minimal information', async () => {
            const email = loadSampleEmail('minimal-info-01.eml');

            const result = await listener.parseEmail(email as any);

            expect(result).not.toBeNull();
            // Should default to email_alert when no specific pattern matches
            expect(result?.alertType).toBe('email_alert');
            // Should still extract device identifier
            expect(result?.deviceIdentifier).toBe('C0EAE4B2C3F1');
            // Should use default severity
            expect(result?.severity).toBe('info');
        });
    });

    describe('Sample Email Coverage', () => {
        it('should have sample emails for all major alert types', () => {
            const sampleDir = path.join(__dirname, 'fixtures', 'sample-emails');
            const files = fs.readdirSync(sampleDir).filter(f => f.endsWith('.eml'));

            // Verify we have comprehensive coverage
            expect(files.length).toBeGreaterThanOrEqual(14);

            // Check for key alert types
            const fileNames = files.join(',');
            expect(fileNames).toContain('ips-');
            expect(fileNames).toContain('vpn-');
            expect(fileNames).toContain('license-');
            expect(fileNames).toContain('wan-');
            expect(fileNames).toContain('interface-');
            expect(fileNames).toContain('cpu-');
            expect(fileNames).toContain('memory-');
            expect(fileNames).toContain('gav-');
            expect(fileNames).toContain('botnet-');
            expect(fileNames).toContain('atp-');
            expect(fileNames).toContain('malware-');
            expect(fileNames).toContain('security-');
        });

        it('should have README documentation', () => {
            const readmePath = path.join(__dirname, 'fixtures', 'sample-emails', 'README.md');
            expect(fs.existsSync(readmePath)).toBe(true);

            const content = fs.readFileSync(readmePath, 'utf-8');
            expect(content).toContain('Sample SonicWall Alert Emails');
            expect(content).toContain('Alert Types Covered');
        });
    });

    describe('Real-World Scenarios', () => {
        it('should handle complete email parsing workflow', async () => {
            // Simulate receiving multiple emails in sequence
            const emails = [
                'ips-critical-01.eml',
                'vpn-high-01.eml',
                'license-medium-01.eml',
                'wan-critical-01.eml',
            ];

            const results = [];
            for (const emailFile of emails) {
                const email = loadSampleEmail(emailFile);
                const result = await listener.parseEmail(email as any);
                results.push(result);
            }

            // All emails should parse successfully
            expect(results).toHaveLength(4);
            expect(results.every(r => r !== null)).toBe(true);

            // Verify alert types are correctly identified
            expect(results[0]?.alertType).toBe('ips_alert');
            expect(results[1]?.alertType).toBe('vpn_down');
            expect(results[2]?.alertType).toBe('license_expiring');
            expect(results[3]?.alertType).toBe('wan_down');

            // Verify severities are correctly parsed
            expect(results[0]?.severity).toBe('critical');
            expect(results[1]?.severity).toBe('high');
            expect(results[2]?.severity).toBe('medium');
            expect(results[3]?.severity).toBe('critical');

            // All should have device identifiers
            expect(results.every(r => r?.deviceIdentifier)).toBe(true);
        });

        it('should extract consistent device identifiers across emails', async () => {
            // Load multiple emails from the same device
            const emails = [
                'ips-critical-01.eml',
                'vpn-high-01.eml',
                'license-medium-01.eml',
                'wan-critical-01.eml',
                'cpu-medium-01.eml',
            ];

            const deviceIds = new Set<string>();
            for (const emailFile of emails) {
                const email = loadSampleEmail(emailFile);
                const result = await listener.parseEmail(email as any);
                if (result?.deviceIdentifier) {
                    deviceIds.add(result.deviceIdentifier);
                }
            }

            // All emails from same device should have same identifier
            expect(deviceIds.size).toBe(1);
            expect(deviceIds.has('C0EAE4B2C3F1')).toBe(true);
        });
    });
});
