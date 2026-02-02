/**
 * Email Alert Listener - Message Text Extraction Tests
 * 
 * Tests for extracting message text from email body.
 * 
 * Requirements: 11.6
 */

import { EmailAlertListener } from '../email-alert-listener';
import type { EmailConfig } from '../../types/firewall';

describe('EmailAlertListener - Message Text Extraction', () => {
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

    describe('Message Text Extraction', () => {
        it('should extract full message text from email body', async () => {
            const messageText = 'Critical alert from firewall. IPS detected intrusion attempt from 192.168.1.100.';
            const email = {
                subject: 'IPS Alert: Intrusion Detected',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should extract message text with multiple lines', async () => {
            const messageText = `Alert: High CPU Usage Detected
Device: SonicWall TZ400
CPU Usage: 95%
Timestamp: 2024-12-08 10:30:45
Action Required: Investigate high CPU usage`;

            const email = {
                subject: 'High CPU Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should extract message text with special characters', async () => {
            const messageText = 'Alert: VPN tunnel "Site-A <-> Site-B" is down! Connection lost @ 10:30:45.';
            const email = {
                subject: 'VPN Down',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should extract message text with device identifiers', async () => {
            const messageText = 'Device Serial: C0EAE4123456\nIP Address: 192.168.1.1\nAlert: License expiring in 15 days';
            const email = {
                subject: 'License Expiring',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should extract message text with severity information', async () => {
            const messageText = 'Severity: Critical\nMalware detected and blocked by Gateway Anti-Virus.\nThreat: Trojan.Generic\nSource: 10.0.0.50';
            const email = {
                subject: 'Gateway AV Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should extract message text with timestamp information', async () => {
            const messageText = 'Time: 2024-12-08 10:30:45\nEvent: WAN interface X1 is down\nDuration: 5 minutes';
            const email = {
                subject: 'WAN Down',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should handle empty message text', async () => {
            const email = {
                subject: 'Alert',
                text: '',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe('');
        });

        it('should handle message text with only whitespace', async () => {
            const messageText = '   \n\n   ';
            const email = {
                subject: 'Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should extract message text with HTML-like content', async () => {
            const messageText = '<Alert> IPS detected attack from <source>192.168.1.100</source> targeting <destination>10.0.0.1</destination>';
            const email = {
                subject: 'IPS Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should extract message text with JSON-like content', async () => {
            const messageText = '{"alert": "VPN Down", "tunnel": "Site-A", "timestamp": "2024-12-08T10:30:45Z"}';
            const email = {
                subject: 'VPN Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should extract message text with unicode characters', async () => {
            const messageText = 'Alert: Firewall détecté une intrusion → Action: Bloqué ✓';
            const email = {
                subject: 'Security Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should extract long message text', async () => {
            const messageText = 'A'.repeat(5000); // 5000 character message
            const email = {
                subject: 'Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
            expect(result?.message.length).toBe(5000);
        });

        it('should extract message text with mixed content', async () => {
            const messageText = `SonicWall Security Alert
            
Device: TZ400 (Serial: C0EAE4123456)
IP: 192.168.1.1
Severity: High

Event Details:
- Type: IPS Alert
- Source: 10.0.0.50:12345
- Destination: 192.168.1.100:80
- Signature: SQL Injection Attempt
- Action: Blocked

Timestamp: 2024-12-08 10:30:45 UTC

Please investigate this security event immediately.`;

            const email = {
                subject: 'IPS Alert: SQL Injection Blocked',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
            expect(result?.message).toContain('SonicWall Security Alert');
            expect(result?.message).toContain('C0EAE4123456');
            expect(result?.message).toContain('SQL Injection Attempt');
        });
    });

    describe('Message Text Preservation', () => {
        it('should preserve exact message text without modification', async () => {
            const messageText = 'Original message with    extra   spaces and\n\nmultiple\nline\nbreaks';
            const email = {
                subject: 'Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
            // Verify exact match - no trimming or normalization
            expect(result?.message).toEqual(messageText);
        });

        it('should preserve message text with leading/trailing whitespace', async () => {
            const messageText = '  Alert message with leading and trailing spaces  ';
            const email = {
                subject: 'Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });

        it('should preserve message text with tabs and special whitespace', async () => {
            const messageText = 'Alert\twith\ttabs\rand\rcarriage\rreturns';
            const email = {
                subject: 'Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toBe(messageText);
        });
    });

    describe('Integration with Other Fields', () => {
        it('should extract message text along with other parsed fields', async () => {
            const messageText = 'Critical: IPS detected intrusion from 192.168.1.100. Device: C0EAE4123456. Time: 2024-12-08 10:30:45';
            const email = {
                subject: 'IPS Alert: Intrusion Detected',
                text: messageText,
                date: new Date('2024-12-08T10:30:45Z'),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();

            // Verify message text is extracted
            expect(result?.message).toBe(messageText);

            // Verify other fields are also parsed correctly
            expect(result?.alertType).toBe('ips_alert');
            expect(result?.severity).toBe('critical');
            expect(result?.deviceIdentifier).toBeTruthy();
            expect(result?.timestamp).toBeInstanceOf(Date);
        });

        it('should extract message text even when other parsing fails', async () => {
            const messageText = 'Some alert message without clear patterns';
            const email = {
                subject: 'Unknown Alert',
                text: messageText,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();

            // Message should still be extracted even if other fields use defaults
            expect(result?.message).toBe(messageText);
            expect(result?.alertType).toBe('email_alert'); // Default
            expect(result?.severity).toBe('info'); // Default
        });
    });
});
