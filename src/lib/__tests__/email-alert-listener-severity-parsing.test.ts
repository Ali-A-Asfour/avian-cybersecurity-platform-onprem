/**
 * Email Alert Listener - Severity Parsing Tests
 * 
 * Tests for extracting severity levels from email body text.
 * 
 * Requirements: 11.3
 */

import { EmailAlertListener } from '../email-alert-listener';
import type { EmailConfig } from '../../types/firewall';

describe('EmailAlertListener - Severity Parsing', () => {
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

    describe('extractSeverity - Critical', () => {
        it('should extract critical severity from body with "critical" keyword', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'This is a critical security event that requires immediate attention.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should extract critical severity from body with "emergency" keyword', async () => {
            const email = {
                subject: 'Security Alert',
                text: 'Emergency: System under attack. Immediate action required.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should handle case-insensitive critical keyword', async () => {
            const email = {
                subject: 'Alert',
                text: 'CRITICAL: Firewall breach detected.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should handle mixed case emergency keyword', async () => {
            const email = {
                subject: 'Alert',
                text: 'EmErGeNcY: System failure imminent.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should extract critical from body with multiple severity keywords (critical takes precedence)', async () => {
            const email = {
                subject: 'Alert',
                text: 'This is a high priority issue, but actually critical. Warning: take action now.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });
    });

    describe('extractSeverity - High', () => {
        it('should extract high severity from body with "high" keyword', async () => {
            const email = {
                subject: 'VPN Alert',
                text: 'High priority: VPN tunnel has disconnected.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('high');
        });

        it('should extract high severity from body with "urgent" keyword', async () => {
            const email = {
                subject: 'License Alert',
                text: 'Urgent: License expires in 5 days.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('high');
        });

        it('should handle case-insensitive high keyword', async () => {
            const email = {
                subject: 'Alert',
                text: 'HIGH: Multiple failed login attempts detected.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('high');
        });

        it('should handle mixed case urgent keyword', async () => {
            const email = {
                subject: 'Alert',
                text: 'UrGeNt: Security feature disabled.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('high');
        });

        it('should extract high from body with multiple severity keywords (high takes precedence over medium/low)', async () => {
            const email = {
                subject: 'Alert',
                text: 'This is a medium issue, but actually high priority. Low risk of data loss.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('high');
        });
    });

    describe('extractSeverity - Medium', () => {
        it('should extract medium severity from body with "medium" keyword', async () => {
            const email = {
                subject: 'Configuration Alert',
                text: 'Medium priority: Configuration change detected.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('medium');
        });

        it('should extract medium severity from body with "warning" keyword', async () => {
            const email = {
                subject: 'System Alert',
                text: 'Warning: CPU usage is elevated.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('medium');
        });

        it('should handle case-insensitive medium keyword', async () => {
            const email = {
                subject: 'Alert',
                text: 'MEDIUM: Firmware update available.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('medium');
        });

        it('should handle mixed case warning keyword', async () => {
            const email = {
                subject: 'Alert',
                text: 'WaRnInG: Disk space running low.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('medium');
        });

        it('should extract medium from body with multiple severity keywords (medium takes precedence over low)', async () => {
            const email = {
                subject: 'Alert',
                text: 'This is a low priority issue, but actually medium. Warning: check configuration.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('medium');
        });
    });

    describe('extractSeverity - Low', () => {
        it('should extract low severity from body with "low" keyword', async () => {
            const email = {
                subject: 'Informational Alert',
                text: 'Low priority: Routine maintenance scheduled.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('low');
        });

        it('should handle case-insensitive low keyword', async () => {
            const email = {
                subject: 'Alert',
                text: 'LOW: Configuration backup completed.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('low');
        });

        it('should handle mixed case low keyword', async () => {
            const email = {
                subject: 'Alert',
                text: 'LoW: System health check passed.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('low');
        });
    });

    describe('extractSeverity - Info (Default)', () => {
        it('should default to info severity when no severity keywords found', async () => {
            const email = {
                subject: 'System Notification',
                text: 'System has been updated successfully.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('info');
        });

        it('should default to info for empty body', async () => {
            const email = {
                subject: 'Alert',
                text: '',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('info');
        });

        it('should default to info for body with only whitespace', async () => {
            const email = {
                subject: 'Alert',
                text: '   \n\t   ',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('info');
        });

        it('should default to info when body contains unrelated text', async () => {
            const email = {
                subject: 'Status Update',
                text: 'The firewall is operating normally. All systems are functional.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('info');
        });
    });

    describe('Severity Precedence', () => {
        it('should prioritize critical over all other severities', async () => {
            const email = {
                subject: 'Alert',
                text: 'This is urgent and high priority, but actually critical. Warning: low risk.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should prioritize high over medium and low', async () => {
            const email = {
                subject: 'Alert',
                text: 'This is a medium warning with low impact, but high priority action needed.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('high');
        });

        it('should prioritize medium over low', async () => {
            const email = {
                subject: 'Alert',
                text: 'This is a low priority issue, but warning: check configuration.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('medium');
        });

        it('should handle emergency as critical priority', async () => {
            const email = {
                subject: 'Alert',
                text: 'Emergency situation detected. High priority response needed.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });
    });

    describe('Edge Cases', () => {
        it('should handle severity keyword in middle of word', async () => {
            const email = {
                subject: 'Alert',
                text: 'The highlight of this report shows normal operation.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should still match "high" even if part of "highlight"
            expect(result?.severity).toBe('high');
        });

        it('should handle multiple occurrences of same severity keyword', async () => {
            const email = {
                subject: 'Alert',
                text: 'Critical alert: critical system failure. This is critical.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should handle severity keyword with punctuation', async () => {
            const email = {
                subject: 'Alert',
                text: 'CRITICAL! System breach detected!!!',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should handle severity keyword at start of body', async () => {
            const email = {
                subject: 'Alert',
                text: 'Critical: This is the first word.',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should handle severity keyword at end of body', async () => {
            const email = {
                subject: 'Alert',
                text: 'This alert is critical',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should handle body with line breaks', async () => {
            const email = {
                subject: 'Alert',
                text: 'System Alert\n\nSeverity: Critical\n\nAction Required: Immediate',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should handle body with HTML-like content', async () => {
            const email = {
                subject: 'Alert',
                text: '<div>Critical: System failure</div>',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should handle body with special characters', async () => {
            const email = {
                subject: 'Alert',
                text: '*** CRITICAL *** System @#$% failure!',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });

        it('should handle very long body text', async () => {
            const longText = 'Normal operation. '.repeat(100) + ' Critical alert detected.';
            const email = {
                subject: 'Alert',
                text: longText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
        });
    });

    describe('Real-World SonicWall Email Examples', () => {
        it('should parse typical SonicWall IPS alert email', async () => {
            const email = {
                subject: 'IPS Alert: Intrusion Detected',
                text: `
SonicWall Security Alert

Severity: Critical
Device: SonicWall TZ-400
Serial: C0EAE4123456
IP: 192.168.1.1

An intrusion attempt has been detected and blocked by the IPS engine.

Attack Type: SQL Injection
Source IP: 203.0.113.45
Destination IP: 192.168.1.100
Time: 2024-01-15 14:30:22 UTC

Action Required: Review security logs and verify no compromise occurred.
                `,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('critical');
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should parse typical SonicWall VPN down email', async () => {
            const email = {
                subject: 'VPN Tunnel Down',
                text: `
SonicWall VPN Alert

Priority: High
Device: SonicWall NSA-2650
Serial: C0EAE4789012
IP: 10.0.0.1

VPN tunnel to remote site has disconnected.

Tunnel Name: Branch-Office-VPN
Remote Gateway: 198.51.100.50
Disconnected: 2024-01-15 14:25:10 UTC

Action: Urgent - Check remote site connectivity.
                `,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('high');
            expect(result?.alertType).toBe('vpn_down');
        });

        it('should parse typical SonicWall license expiring email', async () => {
            const email = {
                subject: 'License Expiring: Gateway Anti-Virus',
                text: `
SonicWall License Notification

Priority: Medium
Device: SonicWall TZ-600
Serial: C0EAE4345678

Your Gateway Anti-Virus license will expire in 15 days.

License Type: Gateway Anti-Virus
Expiration Date: 2024-01-30
Days Remaining: 15

Warning: Renew license to maintain protection.
                `,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('medium');
            expect(result?.alertType).toBe('license_expiring');
        });

        it('should parse SonicWall high CPU alert email', async () => {
            const email = {
                subject: 'High CPU Usage Alert',
                text: `
SonicWall System Alert

Priority: Warning
Device: SonicWall NSA-3650
Serial: C0EAE4567890
IP: 172.16.0.1

CPU usage has exceeded threshold.

Current CPU: 87%
Threshold: 80%
Duration: 10 minutes

Action: Medium priority - Monitor system performance.
                `,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('medium');
            expect(result?.alertType).toBe('high_cpu');
        });

        it('should parse SonicWall informational email', async () => {
            const email = {
                subject: 'System Update Notification',
                text: `
SonicWall System Notification

Device: SonicWall TZ-400
Serial: C0EAE4123456

Firmware update has been successfully installed.

Previous Version: 7.0.1-5050
New Version: 7.0.1-5055
Update Time: 2024-01-15 02:00:00 UTC

System is operating normally.
                `,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.severity).toBe('info');
        });
    });

    describe('Requirement Coverage', () => {
        it('should extract all required severity levels from requirements 11.3', async () => {
            const severityTests = [
                { text: 'Critical alert', expected: 'critical' },
                { text: 'High priority', expected: 'high' },
                { text: 'Medium warning', expected: 'medium' },
                { text: 'Low priority', expected: 'low' },
                { text: 'Normal operation', expected: 'info' },
            ];

            for (const { text, expected } of severityTests) {
                const email = {
                    subject: 'Alert',
                    text,
                    date: new Date(),
                };

                const result = await listener.parseEmail(email as any);
                expect(result).not.toBeNull();
                expect(result?.severity).toBe(expected);
            }
        });
    });
});
