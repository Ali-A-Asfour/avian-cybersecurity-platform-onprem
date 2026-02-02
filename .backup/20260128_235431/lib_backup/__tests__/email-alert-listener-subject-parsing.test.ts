/**
 * Email Alert Listener - Subject Parsing Tests
 * 
 * Tests for extracting alert types from email subjects using regex patterns.
 * 
 * Requirements: 11.2
 */

import { EmailAlertListener } from '../email-alert-listener';
import type { EmailConfig } from '../../types/firewall';

describe('EmailAlertListener - Subject Parsing', () => {
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

    describe('extractAlertType', () => {
        it('should extract IPS alert type from subject', async () => {
            const email = {
                subject: 'IPS Alert: Intrusion Detected',
                text: 'Critical alert from firewall',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should extract VPN down alert type from subject', async () => {
            const email = {
                subject: 'VPN Down: Tunnel Disconnected',
                text: 'High priority alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('vpn_down');
        });

        it('should extract VPN tunnel down alert type from subject', async () => {
            const email = {
                subject: 'VPN Tunnel Down: Connection Lost',
                text: 'High priority alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('vpn_down');
        });

        it('should extract license expiring alert type from subject', async () => {
            const email = {
                subject: 'License Expiring: IPS License expires in 15 days',
                text: 'Warning alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('license_expiring');
        });

        it('should extract WAN down alert type from subject', async () => {
            const email = {
                subject: 'WAN Down: Primary WAN Interface Offline',
                text: 'Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('wan_down');
        });

        it('should extract interface down alert type from subject', async () => {
            const email = {
                subject: 'Interface Down: X1 Interface Disconnected',
                text: 'High priority alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('interface_down');
        });

        it('should extract high CPU alert type from subject', async () => {
            const email = {
                subject: 'High CPU: CPU Usage at 95%',
                text: 'Warning alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('high_cpu');
        });

        it('should extract high memory alert type from subject', async () => {
            const email = {
                subject: 'High Memory: Memory Usage at 92%',
                text: 'Warning alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('high_memory');
        });

        it('should extract Gateway AV alert type from subject', async () => {
            const email = {
                subject: 'Gateway AV: Virus Detected',
                text: 'High priority alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('gav_alert');
        });

        it('should extract Anti-Virus alert type from subject', async () => {
            const email = {
                subject: 'Anti-Virus: Malware Blocked',
                text: 'High priority alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('gav_alert');
        });

        it('should extract malware detected alert type from subject', async () => {
            const email = {
                subject: 'Malware: Trojan Detected',
                text: 'Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('malware_detected');
        });

        it('should extract botnet alert type from subject', async () => {
            const email = {
                subject: 'Botnet: C&C Communication Blocked',
                text: 'High priority alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('botnet_alert');
        });

        it('should extract ATP alert type from subject', async () => {
            const email = {
                subject: 'ATP: Advanced Threat Detected',
                text: 'Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('atp_alert');
        });

        it('should extract intrusion alert type from subject', async () => {
            const email = {
                subject: 'Intrusion: Attack Attempt Blocked',
                text: 'High priority alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should extract security alert type from subject', async () => {
            const email = {
                subject: 'Security Alert: Suspicious Activity',
                text: 'Medium priority alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('security_alert');
        });

        it('should handle case-insensitive matching', async () => {
            const email = {
                subject: 'ips alert: intrusion detected',
                text: 'Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle mixed case matching', async () => {
            const email = {
                subject: 'VpN DoWn: Tunnel Disconnected',
                text: 'High priority alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('vpn_down');
        });

        it('should default to email_alert for unknown patterns', async () => {
            const email = {
                subject: 'Unknown Alert Type: Something Happened',
                text: 'Info alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('email_alert');
        });

        it('should handle subjects with extra whitespace', async () => {
            const email = {
                subject: '  IPS   Alert  :  Intrusion Detected  ',
                text: 'Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle subjects with special characters', async () => {
            const email = {
                subject: '[URGENT] IPS Alert - Intrusion Detected!!!',
                text: 'Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should prioritize more specific patterns over generic ones', async () => {
            const email = {
                subject: 'VPN Tunnel Down - Security Alert',
                text: 'High priority alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should match VPN Tunnel Down before Security Alert
            expect(result?.alertType).toBe('vpn_down');
        });

        it('should handle empty subject gracefully', async () => {
            const email = {
                subject: '',
                text: 'Alert with no subject',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            // Should default to email_alert when no pattern matches
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('email_alert');
        });

        it('should handle undefined subject gracefully', async () => {
            const email = {
                text: 'Alert with undefined subject',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            // Should default to email_alert when no pattern matches
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('email_alert');
        });
    });

    describe('Pattern Coverage', () => {
        it('should cover all required alert types from requirements', async () => {
            const requiredPatterns = [
                { subject: 'IPS Alert', expectedType: 'ips_alert' },
                { subject: 'VPN Down', expectedType: 'vpn_down' },
                { subject: 'License Expiring', expectedType: 'license_expiring' },
            ];

            for (const { subject, expectedType } of requiredPatterns) {
                const email = {
                    subject,
                    text: 'Test alert',
                    date: new Date(),
                };

                const result = await listener.parseEmail(email as any);
                expect(result).not.toBeNull();
                expect(result?.alertType).toBe(expectedType);
            }
        });
    });
});
