/**
 * Email Alert Listener - Malformed Email Error Handling Tests
 * 
 * Tests for handling malformed, corrupt, and invalid email data.
 * Ensures the system gracefully handles edge cases and errors.
 * 
 * Requirements: 11.1-11.10 (Error Handling)
 * Task: 6.5 - Test error handling for malformed emails
 */

import { EmailAlertListener } from '../email-alert-listener';
import type { EmailConfig } from '../../types/firewall';

describe('EmailAlertListener - Malformed Email Error Handling', () => {
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

    describe('Null and Undefined Handling', () => {
        it('should handle null email object gracefully', async () => {
            const result = await listener.parseEmail(null as any);
            expect(result).toBeNull();
        });

        it('should handle undefined email object gracefully', async () => {
            const result = await listener.parseEmail(undefined as any);
            expect(result).toBeNull();
        });

        it('should handle email with all null fields', async () => {
            const email = {
                subject: null,
                text: null,
                date: null,
                from: null,
            };

            const result = await listener.parseEmail(email as any);
            // Should still attempt to parse and return a result with defaults
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('email_alert'); // Default type
            expect(result?.severity).toBe('info'); // Default severity
        });

        it('should handle email with all undefined fields', async () => {
            const email = {
                subject: undefined,
                text: undefined,
                date: undefined,
                from: undefined,
            };

            const result = await listener.parseEmail(email as any);
            // Should still attempt to parse and return a result with defaults
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('email_alert');
            expect(result?.severity).toBe('info');
        });
    });

    describe('Empty and Whitespace Handling', () => {
        it('should handle email with empty strings', async () => {
            const email = {
                subject: '',
                text: '',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('email_alert');
            expect(result?.severity).toBe('info');
            expect(result?.message).toBe('');
        });

        it('should handle email with only whitespace in subject', async () => {
            const email = {
                subject: '   \t\n   ',
                text: 'Some content',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('email_alert');
        });

        it('should handle email with only whitespace in body', async () => {
            const email = {
                subject: 'IPS Alert',
                text: '   \t\n   ',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
            expect(result?.severity).toBe('info'); // No severity keywords in whitespace
        });
    });

    describe('Invalid Date Handling', () => {
        it('should handle invalid date object', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert',
                date: new Date('invalid'),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.timestamp).toBeInstanceOf(Date);
            expect(result?.timestamp.getTime()).not.toBeNaN();
        });

        it('should handle date as string instead of Date object', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert',
                date: '2024-12-08T10:30:00Z' as any,
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.timestamp).toBeInstanceOf(Date);
        });

        it('should handle date as number (timestamp)', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert',
                date: Date.now() as any,
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.timestamp).toBeInstanceOf(Date);
        });

        it('should handle missing date field', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert',
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.timestamp).toBeInstanceOf(Date);
            // Should use current time as fallback
            const now = new Date();
            const diff = Math.abs(now.getTime() - result!.timestamp.getTime());
            expect(diff).toBeLessThan(5000); // Within 5 seconds
        });
    });

    describe('Malformed Content Handling', () => {
        it('should handle email with binary/non-text content', async () => {
            const email = {
                subject: 'IPS Alert',
                text: '\x00\x01\x02\x03\x04\x05',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle email with extremely long subject', async () => {
            const longSubject = 'IPS Alert: ' + 'A'.repeat(10000);
            const email = {
                subject: longSubject,
                text: 'Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle email with extremely long body', async () => {
            const longBody = 'Critical alert. ' + 'B'.repeat(100000);
            const email = {
                subject: 'IPS Alert',
                text: longBody,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
            expect(result?.severity).toBe('critical');
        });

        it('should handle email with special Unicode characters', async () => {
            const email = {
                subject: 'IPS Alert: 🔥 攻撃検出 🚨',
                text: 'Critical alert with émojis and spëcial çharacters',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle email with HTML entities', async () => {
            const email = {
                subject: 'IPS Alert: &lt;Attack&gt; Detected',
                text: 'Critical alert &amp; warning &quot;message&quot;',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle email with malformed JSON in body', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert {invalid json: [broken',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
            expect(result?.severity).toBe('critical');
        });
    });

    describe('Invalid Device Identifier Handling', () => {
        it('should handle email with no device identifier', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert with no device information',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.deviceIdentifier).toBeNull();
            expect(result?.deviceId).toBeUndefined();
        });

        it('should handle email with malformed IP address', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert from device 999.999.999.999',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should still extract the malformed IP
            expect(result?.deviceIdentifier).toBe('999.999.999.999');
        });

        it('should handle email with partial IP address', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert from device 192.168.1',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should not match partial IP
            expect(result?.deviceIdentifier).toBeNull();
        });

        it('should handle email with multiple device identifiers', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Alert from C0EAE4123456 at 192.168.1.1 hostname: firewall-01',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should extract the first valid identifier (serial number)
            expect(result?.deviceIdentifier).toBe('C0EAE4123456');
        });

        it('should handle email with ambiguous device identifier', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Alert from device ABC123',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // ABC123 is too short to match serial number pattern (needs 12+ chars)
            // and doesn't match IP or hostname patterns, so deviceIdentifier will be null
            expect(result?.deviceIdentifier).toBeNull();
        });
    });

    describe('Malformed Timestamp Handling', () => {
        it('should handle email with invalid timestamp format in body', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert. Time: not-a-valid-date',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.timestamp).toBeInstanceOf(Date);
            expect(result?.timestamp.getTime()).not.toBeNaN();
        });

        it('should handle email with multiple conflicting timestamps', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Time: 2024-01-01 10:00:00\nTimestamp: 2024-12-31 23:59:59',
                date: new Date('2024-06-15T12:00:00Z'),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.timestamp).toBeInstanceOf(Date);
            // Should use the first matched timestamp or header date
        });

        it('should handle email with future timestamp', async () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 10);

            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert',
                date: futureDate,
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.timestamp).toBeInstanceOf(Date);
            // Should still accept future dates (might be clock skew)
            expect(result?.timestamp.getTime()).toBe(futureDate.getTime());
        });

        it('should handle email with very old timestamp', async () => {
            const oldDate = new Date('1970-01-01T00:00:00Z');

            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert',
                date: oldDate,
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.timestamp).toBeInstanceOf(Date);
            expect(result?.timestamp.getTime()).toBe(oldDate.getTime());
        });
    });

    describe('Malformed Severity Handling', () => {
        it('should handle email with conflicting severity indicators', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical high medium low info alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should match the first/highest severity found
            expect(result?.severity).toBe('critical');
        });

        it('should handle email with misspelled severity', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critcal alert with typo',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should default to info when no valid severity found
            expect(result?.severity).toBe('info');
        });

        it('should handle email with severity in different language', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Alerte critique détectée',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should default to info for non-English severity
            expect(result?.severity).toBe('info');
        });

        it('should handle email with numeric severity', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Severity: 5 - Alert detected',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            // Should default to info when severity is numeric
            expect(result?.severity).toBe('info');
        });
    });

    describe('Edge Cases and Boundary Conditions', () => {
        it('should handle email with circular reference (if possible)', async () => {
            const email: any = {
                subject: 'IPS Alert',
                text: 'Critical alert',
                date: new Date(),
            };
            // Create circular reference
            email.self = email;

            const result = await listener.parseEmail(email);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle email with very nested object structure', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert',
                date: new Date(),
                metadata: {
                    level1: {
                        level2: {
                            level3: {
                                level4: {
                                    level5: 'deep value',
                                },
                            },
                        },
                    },
                },
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
        });

        it('should handle email with array fields instead of strings', async () => {
            const email = {
                subject: ['IPS', 'Alert'] as any,
                text: ['Critical', 'alert'] as any,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            // Should handle gracefully, might fail or coerce to string
            // The important thing is it doesn't crash
            expect(result).toBeDefined();
        });

        it('should handle email with numeric fields instead of strings', async () => {
            const email = {
                subject: 12345 as any,
                text: 67890 as any,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            // Should handle gracefully
            expect(result).toBeDefined();
        });

        it('should handle email with boolean fields instead of strings', async () => {
            const email = {
                subject: true as any,
                text: false as any,
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            // Should handle gracefully
            expect(result).toBeDefined();
        });
    });

    describe('Error Recovery', () => {
        it('should continue processing after encountering malformed email', async () => {
            // First, process a malformed email
            const malformedEmail = {
                subject: null,
                text: null,
                date: null,
            };

            const result1 = await listener.parseEmail(malformedEmail as any);
            expect(result1).not.toBeNull();

            // Then, process a valid email
            const validEmail = {
                subject: 'IPS Alert',
                text: 'Critical alert',
                date: new Date(),
            };

            const result2 = await listener.parseEmail(validEmail as any);
            expect(result2).not.toBeNull();
            expect(result2?.alertType).toBe('ips_alert');
            expect(result2?.severity).toBe('critical');
        });

        it('should handle multiple malformed emails in sequence', async () => {
            const malformedEmails = [
                { subject: null, text: null, date: null },
                { subject: undefined, text: undefined, date: undefined },
                { subject: '', text: '', date: new Date('invalid') },
            ];

            for (const email of malformedEmails) {
                const result = await listener.parseEmail(email as any);
                // Should not crash and should return some result
                expect(result).toBeDefined();
            }
        });
    });

    describe('Security and Injection Handling', () => {
        it('should handle email with SQL injection attempt in subject', async () => {
            const email = {
                subject: "IPS Alert'; DROP TABLE firewall_devices; --",
                text: 'Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.alertType).toBe('ips_alert');
            // Message comes from the text field, not subject
            // The SQL injection attempt is in the subject, so it won't be in the message
            expect(result?.message).toBe('Critical alert');
            // But we should verify the system doesn't crash with SQL injection in subject
            expect(result?.severity).toBe('critical');
        });

        it('should handle email with XSS attempt in body', async () => {
            const email = {
                subject: 'IPS Alert',
                text: '<script>alert("XSS")</script> Critical alert',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toContain('<script>');
        });

        it('should handle email with command injection attempt', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Critical alert; rm -rf / ; echo "pwned"',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toContain('rm -rf');
        });

        it('should handle email with path traversal attempt', async () => {
            const email = {
                subject: 'IPS Alert',
                text: 'Device: ../../../../etc/passwd',
                date: new Date(),
            };

            const result = await listener.parseEmail(email as any);
            expect(result).not.toBeNull();
            expect(result?.message).toContain('../');
        });
    });
});
