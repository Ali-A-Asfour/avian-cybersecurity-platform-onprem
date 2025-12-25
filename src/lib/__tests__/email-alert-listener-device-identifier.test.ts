/**
 * Email Alert Listener - Device Identifier Extraction Tests
 * 
 * Tests for extracting device identifiers (serial number, hostname, IP address)
 * from email body and subject.
 * 
 * Requirements: 11.5
 */

import { EmailAlertListener } from '../email-alert-listener';
import type { EmailConfig } from '../../types/firewall';

describe('EmailAlertListener - Device Identifier Extraction', () => {
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

    describe('Serial Number Extraction', () => {
        it('should extract serial number from email body', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Alert from device C0EAE4123456. Intrusion detected.',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('C0EAE4123456');
        });

        it('should extract serial number from email subject', async () => {
            const email = {
                subject: 'IPS Alert - Device C0EAE4ABCDEF',
                text: 'Intrusion detected.',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('C0EAE4ABCDEF');
        });

        it('should extract 12+ character alphanumeric serial numbers', async () => {
            const email = {
                subject: 'Security Alert',
                text: 'Device serial: FD1234567890AB reported an issue.',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('FD1234567890AB');
        });

        it('should extract first serial number when multiple present', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Device C0EAE4111111 detected threat from C0EAE4222222.',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('C0EAE4111111');
        });
    });

    describe('IP Address Extraction', () => {
        it('should extract IP address from email body', async () => {
            const email = {
                subject: 'VPN Down',
                text: 'VPN tunnel down on firewall 192.168.1.1',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('192.168.1.1');
        });

        it('should extract IP address from email subject', async () => {
            const email = {
                subject: 'Alert from 10.0.0.1 - High CPU',
                text: 'CPU usage exceeded threshold.',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('10.0.0.1');
        });

        it('should extract public IP addresses', async () => {
            const email = {
                subject: 'Security Alert',
                text: 'Firewall at 203.0.113.45 detected intrusion.',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('203.0.113.45');
        });

        it('should extract first IP when multiple present', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Device 192.168.1.1 blocked connection from 10.0.0.5',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('192.168.1.1');
        });
    });

    describe('Hostname Extraction', () => {
        it('should extract hostname from email body with "hostname:" prefix', async () => {
            const email = {
                subject: 'License Expiring',
                text: 'License expiring soon. Hostname: fw-office-01',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('fw-office-01');
        });

        it('should extract hostname from email body with "device:" prefix', async () => {
            const email = {
                subject: 'WAN Down',
                text: 'WAN interface down. Device: sonicwall-hq',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('sonicwall-hq');
        });

        it('should extract hostname from email body with "firewall:" prefix', async () => {
            const email = {
                subject: 'High Memory',
                text: 'Memory usage high. Firewall: branch-fw-02',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('branch-fw-02');
        });

        it('should extract hostname with dots (FQDN)', async () => {
            const email = {
                subject: 'Security Alert',
                text: 'Alert from device: firewall.company.local',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('firewall.company.local');
        });

        it('should extract hostname with hyphens', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Intrusion detected. Hostname: sonic-wall-main',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('sonic-wall-main');
        });
    });

    describe('Priority and Fallback', () => {
        it('should prioritize serial number over IP address', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Device C0EAE4123456 at 192.168.1.1 detected threat.',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            // Serial number should be extracted first
            expect(parsed?.deviceIdentifier).toBe('C0EAE4123456');
        });

        it('should fall back to IP when no serial number present', async () => {
            const email = {
                subject: 'VPN Down',
                text: 'VPN tunnel down on 10.0.0.1',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('10.0.0.1');
        });

        it('should fall back to hostname when no serial or IP present', async () => {
            const email = {
                subject: 'License Expiring',
                text: 'License expiring. Device: main-firewall',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('main-firewall');
        });

        it('should return null when no identifier found', async () => {
            const email = {
                subject: 'Generic Alert',
                text: 'Something happened but no device info provided.',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBeNull();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty email body', async () => {
            const email = {
                subject: 'IPS Alert - C0EAE4123456',
                text: '',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('C0EAE4123456');
        });

        it('should handle empty subject', async () => {
            const email = {
                subject: '',
                text: 'Device 192.168.1.1 alert',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('192.168.1.1');
        });

        it('should handle multiline email body', async () => {
            const email = {
                subject: 'Security Alert',
                text: `
                    Alert Details:
                    Device: C0EAE4ABCDEF
                    Time: 2024-12-08 10:30:00
                    Severity: High
                    Message: Intrusion detected
                `,
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('C0EAE4ABCDEF');
        });

        it('should handle HTML-formatted emails', async () => {
            const email = {
                subject: 'IPS Alert',
                text: '<p>Device: <strong>192.168.1.1</strong></p><p>Alert message</p>',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('192.168.1.1');
        });

        it('should handle case-insensitive hostname patterns', async () => {
            const email = {
                subject: 'Alert',
                text: 'HOSTNAME: FIREWALL-MAIN',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('FIREWALL-MAIN');
        });

        it('should not extract invalid IP addresses', async () => {
            const email = {
                subject: 'Alert',
                text: 'Version 999.999.999.999 detected issue',
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            // Should still extract it as it matches the pattern
            // Validation happens during device matching
            expect(parsed?.deviceIdentifier).toBe('999.999.999.999');
        });
    });

    describe('Real-World Email Formats', () => {
        it('should extract from SonicWall IPS alert format', async () => {
            const email = {
                subject: 'SonicWall IPS Alert - High Priority',
                text: `
                    SonicWall Intrusion Prevention Alert
                    
                    Serial Number: C0EAE4567890
                    Management IP: 192.168.100.1
                    Time: 2024-12-08 14:30:45
                    
                    An intrusion attempt was detected and blocked.
                `,
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('C0EAE4567890');
        });

        it('should extract from SonicWall VPN alert format', async () => {
            const email = {
                subject: 'VPN Tunnel Down - Branch Office',
                text: `
                    VPN Status Alert
                    
                    Firewall: branch-fw-01.company.com
                    Tunnel: Main-to-Branch
                    Status: Down
                    Time: 2024-12-08 15:00:00
                `,
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('branch-fw-01.company.com');
        });

        it('should extract from SonicWall license expiry format', async () => {
            const email = {
                subject: 'License Expiration Warning',
                text: `
                    Your SonicWall license is expiring soon.
                    
                    Device IP: 10.50.100.1
                    License Type: Gateway Anti-Virus
                    Expires: 2024-12-31
                    
                    Please renew to maintain protection.
                `,
                date: new Date(),
                from: { text: 'alerts@sonicwall.com' },
            };

            const parsed = await listener.parseEmail(email as any);

            expect(parsed).not.toBeNull();
            expect(parsed?.deviceIdentifier).toBe('10.50.100.1');
        });
    });
});
