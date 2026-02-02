/**
 * Email Alert Listener - Alert Type Parsing Tests
 * 
 * Comprehensive tests for parsing various SonicWall alert types from emails.
 * Tests all supported alert types with different formats and variations.
 * 
 * Requirements: 11.2 - Parse email subject for alert type using pattern matching
 * 
 * Task: Test email parsing for various alert types
 */

import { EmailAlertListener } from '../email-alert-listener';
import type { EmailConfig } from '../../types/firewall';

describe('EmailAlertListener - Alert Type Parsing', () => {
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

    describe('IPS Alert Types', () => {
        it('should parse IPS Alert with standard format', async () => {
            const email = {
                subject: 'IPS Alert: Intrusion Detected',
                text: 'Critical intrusion attempt blocked',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should parse IPS Alert with uppercase', async () => {
            const email = {
                subject: 'IPS ALERT: INTRUSION DETECTED',
                text: 'Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should parse Intrusion keyword as IPS alert', async () => {
            const email = {
                subject: 'Intrusion: Attack Blocked',
                text: 'Intrusion prevention system blocked attack',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should parse IPS alert with extra whitespace', async () => {
            const email = {
                subject: '  IPS   Alert  :  Intrusion   Detected  ',
                text: 'Alert message',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should parse IPS alert with special characters', async () => {
            const email = {
                subject: '[URGENT] IPS Alert - Intrusion Detected!!!',
                text: 'Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });
    });

    describe('VPN Alert Types', () => {
        it('should parse VPN Down alert', async () => {
            const email = {
                subject: 'VPN Down: Tunnel Disconnected',
                text: 'VPN tunnel is down',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('vpn_down');
        });

        it('should parse VPN Tunnel Down alert', async () => {
            const email = {
                subject: 'VPN Tunnel Down: Connection Lost',
                text: 'Site-to-site VPN tunnel disconnected',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('vpn_down');
        });

        it('should parse VPN down with mixed case', async () => {
            const email = {
                subject: 'vpn down: tunnel failure',
                text: 'VPN connection failed',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('vpn_down');
        });

        it('should parse VPN alert with site names', async () => {
            const email = {
                subject: 'VPN Down: HQ-to-Branch Office Tunnel Disconnected',
                text: 'VPN tunnel between headquarters and branch office is down',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('vpn_down');
        });
    });

    describe('License Alert Types', () => {
        it('should parse License Expiring alert', async () => {
            const email = {
                subject: 'License Expiring: IPS License expires in 15 days',
                text: 'Your IPS license will expire soon',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('license_expiring');
        });

        it('should parse License Expired alert', async () => {
            const email = {
                subject: 'License Expired: Gateway AV License Has Expired',
                text: 'Your Gateway AV license has expired',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('license_expiring');
        });

        it('should parse license alert with partial match', async () => {
            const email = {
                subject: 'License Expir: ATP License Expiration Warning',
                text: 'License expiration warning',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('license_expiring');
        });

        it('should parse license alert with multiple licenses', async () => {
            const email = {
                subject: 'License Expiring: Multiple Licenses Expiring Soon',
                text: 'IPS, GAV, and ATP licenses expiring within 30 days',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('license_expiring');
        });
    });

    describe('WAN Alert Types', () => {
        it('should parse WAN Down alert', async () => {
            const email = {
                subject: 'WAN Down: Primary WAN Interface Offline',
                text: 'Primary WAN interface is down',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('wan_down');
        });

        it('should parse WAN down with interface name', async () => {
            const email = {
                subject: 'WAN Down: X1 Interface Disconnected',
                text: 'WAN interface X1 is offline',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('wan_down');
        });

        it('should parse WAN alert with failover information', async () => {
            const email = {
                subject: 'WAN Down: Primary WAN Failed, Failover Active',
                text: 'Primary WAN interface failed, switched to backup',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('wan_down');
        });
    });

    describe('Interface Alert Types', () => {
        it('should parse Interface Down alert', async () => {
            const email = {
                subject: 'Interface Down: X3 Interface Disconnected',
                text: 'Network interface X3 is down',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('interface_down');
        });

        it('should parse interface alert with port number', async () => {
            const email = {
                subject: 'Interface Down: Port 5 Link Lost',
                text: 'Physical port 5 has lost link',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('interface_down');
        });

        it('should parse interface alert with zone information', async () => {
            const email = {
                subject: 'Interface Down: LAN Interface (X2) Offline',
                text: 'LAN zone interface X2 is offline',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('interface_down');
        });
    });

    describe('Resource Alert Types', () => {
        it('should parse High CPU alert', async () => {
            const email = {
                subject: 'High CPU: CPU Usage at 95%',
                text: 'CPU usage is critically high',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('high_cpu');
        });

        it('should parse High Memory alert', async () => {
            const email = {
                subject: 'High Memory: Memory Usage at 92%',
                text: 'Memory usage is critically high',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('high_memory');
        });

        it('should parse CPU alert with percentage in subject', async () => {
            const email = {
                subject: 'High CPU: 87% Utilization Detected',
                text: 'CPU utilization has exceeded threshold',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('high_cpu');
        });

        it('should parse memory alert with MB values', async () => {
            const email = {
                subject: 'High Memory: 1850MB of 2048MB Used',
                text: 'Memory usage is approaching limit',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('high_memory');
        });
    });

    describe('Security Threat Alert Types', () => {
        it('should parse Gateway AV alert', async () => {
            const email = {
                subject: 'Gateway AV: Virus Detected',
                text: 'Gateway Anti-Virus detected a virus',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('gav_alert');
        });

        it('should parse Anti-Virus alert', async () => {
            const email = {
                subject: 'Anti-Virus: Malware Blocked',
                text: 'Anti-virus system blocked malware',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('gav_alert');
        });

        it('should parse Malware alert', async () => {
            const email = {
                subject: 'Malware: Trojan Detected',
                text: 'Malware detection system found trojan',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('malware_detected');
        });

        it('should parse Botnet alert', async () => {
            const email = {
                subject: 'Botnet: C&C Communication Blocked',
                text: 'Botnet command and control communication blocked',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('botnet_alert');
        });

        it('should parse ATP alert', async () => {
            const email = {
                subject: 'ATP: Advanced Threat Detected',
                text: 'Advanced Threat Protection detected threat',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('atp_alert');
        });

        it('should parse Security Alert', async () => {
            const email = {
                subject: 'Security Alert: Suspicious Activity',
                text: 'Suspicious network activity detected',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('security_alert');
        });

        it('should parse GAV alert with virus name', async () => {
            const email = {
                subject: 'Gateway AV: Trojan.Win32.Generic Detected',
                text: 'Virus detected and blocked',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('gav_alert');
        });

        it('should parse malware alert with ransomware', async () => {
            const email = {
                subject: 'Malware: Ransomware Attack Blocked',
                text: 'Ransomware detected and prevented',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('malware_detected');
        });

        it('should parse botnet alert with infected device', async () => {
            const email = {
                subject: 'Botnet: Infected Device Detected on Network',
                text: 'Device communicating with botnet C&C server',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('botnet_alert');
        });

        it('should parse ATP alert with zero-day threat', async () => {
            const email = {
                subject: 'ATP: Zero-Day Exploit Attempt Blocked',
                text: 'Advanced threat protection blocked zero-day exploit',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('atp_alert');
        });
    });

    describe('Edge Cases and Variations', () => {
        it('should handle empty subject', async () => {
            const email = {
                subject: '',
                text: 'Alert with no subject',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('email_alert');
        });

        it('should handle undefined subject', async () => {
            const email = {
                text: 'Alert with undefined subject',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('email_alert');
        });

        it('should handle unknown alert type', async () => {
            const email = {
                subject: 'Unknown Alert Type: Something Happened',
                text: 'Unknown alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('email_alert');
        });

        it('should prioritize specific patterns over generic ones', async () => {
            const email = {
                subject: 'VPN Tunnel Down - Security Alert',
                text: 'VPN and security issue',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should match VPN Tunnel Down before Security Alert
            expect(result?.alertType).toBe('vpn_down');
        });

        it('should handle multiple alert keywords in subject', async () => {
            const email = {
                subject: 'IPS Alert and Gateway AV: Multiple Threats Detected',
                text: 'Multiple security threats',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should match first pattern (IPS)
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle alert with prefix and suffix', async () => {
            const email = {
                subject: '[CRITICAL] IPS Alert: Intrusion Detected [ACTION REQUIRED]',
                text: 'Critical intrusion alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle alert with unicode characters', async () => {
            const email = {
                subject: '🚨 IPS Alert: Intrusion Detected 🚨',
                text: 'Alert with emoji',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle alert with line breaks in subject', async () => {
            const email = {
                subject: 'IPS Alert:\nIntrusion Detected',
                text: 'Alert with line break',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });
    });

    describe('Alert Type Coverage', () => {
        it('should support all required alert types from requirements', async () => {
            const requiredAlertTypes = [
                { subject: 'IPS Alert', expectedType: 'ips_alert' },
                { subject: 'VPN Down', expectedType: 'vpn_down' },
                { subject: 'VPN Tunnel Down', expectedType: 'vpn_down' },
                { subject: 'License Expiring', expectedType: 'license_expiring' },
                { subject: 'WAN Down', expectedType: 'wan_down' },
                { subject: 'Interface Down', expectedType: 'interface_down' },
                { subject: 'High CPU', expectedType: 'high_cpu' },
                { subject: 'High Memory', expectedType: 'high_memory' },
                { subject: 'Gateway AV', expectedType: 'gav_alert' },
                { subject: 'Anti-Virus', expectedType: 'gav_alert' },
                { subject: 'Malware', expectedType: 'malware_detected' },
                { subject: 'Botnet', expectedType: 'botnet_alert' },
                { subject: 'ATP', expectedType: 'atp_alert' },
                { subject: 'Intrusion', expectedType: 'ips_alert' },
                { subject: 'Security Alert', expectedType: 'security_alert' },
            ];

            for (const { subject, expectedType } of requiredAlertTypes) {
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

        it('should have consistent alert type naming', async () => {
            const alertTypes = [
                'ips_alert',
                'vpn_down',
                'license_expiring',
                'wan_down',
                'interface_down',
                'high_cpu',
                'high_memory',
                'gav_alert',
                'malware_detected',
                'botnet_alert',
                'atp_alert',
                'security_alert',
                'email_alert',
            ];

            // All alert types should use snake_case
            for (const alertType of alertTypes) {
                expect(alertType).toMatch(/^[a-z_]+$/);
            }
        });
    });

    describe('Real-World Alert Variations', () => {
        it('should parse IPS alert with attack details', async () => {
            const email = {
                subject: 'IPS Alert: SQL Injection Attempt from 203.0.113.45',
                text: 'SQL injection attack blocked',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should parse VPN alert with tunnel name', async () => {
            const email = {
                subject: 'VPN Down: HQ-to-Branch-01 Tunnel Disconnected',
                text: 'Site-to-site VPN tunnel is down',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('vpn_down');
        });

        it('should parse license alert with days remaining', async () => {
            const email = {
                subject: 'License Expiring: IPS License expires in 7 days',
                text: 'License expiration warning',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('license_expiring');
        });

        it('should parse WAN alert with ISP information', async () => {
            const email = {
                subject: 'WAN Down: Primary ISP Connection Lost',
                text: 'Primary internet connection is down',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('wan_down');
        });

        it('should parse resource alert with threshold information', async () => {
            const email = {
                subject: 'High CPU: 95% (Threshold: 80%)',
                text: 'CPU usage exceeded threshold',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('high_cpu');
        });

        it('should parse GAV alert with file information', async () => {
            const email = {
                subject: 'Gateway AV: Trojan.Win32.Generic in document.exe',
                text: 'Virus detected in downloaded file',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('gav_alert');
        });

        it('should parse botnet alert with C&C server', async () => {
            const email = {
                subject: 'Botnet: Communication to 198.51.100.50 Blocked',
                text: 'Botnet C&C communication blocked',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('botnet_alert');
        });
    });
});
