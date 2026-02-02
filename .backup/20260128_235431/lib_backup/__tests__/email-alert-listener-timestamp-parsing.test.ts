/**
 * Email Alert Listener - Timestamp Parsing Tests
 * 
 * Tests timestamp extraction from email headers and body
 * Requirements: 11.4
 */

import { EmailAlertListener } from '../email-alert-listener';
import type { ParsedMail } from 'mailparser';
import type { EmailConfig } from '../../types/firewall';

describe('EmailAlertListener - Timestamp Parsing', () => {
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

    describe('extractTimestamp from email headers', () => {
        it('should use email.date from headers when available', async () => {
            const testDate = new Date('2024-12-08T10:30:45Z');
            const email: ParsedMail = {
                date: testDate,
                subject: 'IPS Alert',
                text: 'Test alert body',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp).toEqual(testDate);
        });

        it('should handle valid Date object from headers', async () => {
            const testDate = new Date('2024-01-15T14:22:33Z');
            const email: ParsedMail = {
                date: testDate,
                subject: 'VPN Down',
                text: 'VPN tunnel is down',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp).toEqual(testDate);
        });
    });

    describe('extractTimestamp from email body', () => {
        it('should parse ISO 8601 format from body when header date missing', async () => {
            const email: ParsedMail = {
                date: undefined,
                subject: 'IPS Alert',
                text: 'Alert detected at 2024-12-08T10:30:45Z. Please investigate.',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp).toEqual(new Date('2024-12-08T10:30:45Z'));
        });

        it('should parse "Time: YYYY-MM-DD HH:MM:SS" format from body', async () => {
            const email: ParsedMail = {
                date: undefined,
                subject: 'License Expiring',
                text: 'Time: 2024-12-08 10:30:45\nLicense will expire soon.',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp.getFullYear()).toBe(2024);
            expect(result?.timestamp.getMonth()).toBe(11); // December (0-indexed)
            expect(result?.timestamp.getDate()).toBe(8);
            expect(result?.timestamp.getHours()).toBe(10);
            expect(result?.timestamp.getMinutes()).toBe(30);
        });

        it('should parse "Timestamp: MM/DD/YYYY HH:MM:SS" format from body', async () => {
            const email: ParsedMail = {
                date: undefined,
                subject: 'WAN Down',
                text: 'Timestamp: 12/08/2024 10:30:45\nWAN interface is down.',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp.getFullYear()).toBe(2024);
            expect(result?.timestamp.getMonth()).toBe(11); // December
            expect(result?.timestamp.getDate()).toBe(8);
        });

        it('should parse "Date: Month DD, YYYY HH:MM:SS" format from body', async () => {
            const email: ParsedMail = {
                date: undefined,
                subject: 'High CPU',
                text: 'Date: Dec 8, 2024 10:30:45\nCPU usage is high.',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp.getFullYear()).toBe(2024);
            expect(result?.timestamp.getMonth()).toBe(11); // December
            expect(result?.timestamp.getDate()).toBe(8);
        });

        it('should handle ISO format with milliseconds', async () => {
            const email: ParsedMail = {
                date: undefined,
                subject: 'Security Alert',
                text: 'Event occurred at 2024-12-08T10:30:45.123Z',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp).toEqual(new Date('2024-12-08T10:30:45.123Z'));
        });

        it('should handle ISO format with timezone offset', async () => {
            const email: ParsedMail = {
                date: undefined,
                subject: 'Botnet Alert',
                text: 'Detected at 2024-12-08T10:30:45-05:00',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp).toEqual(new Date('2024-12-08T10:30:45-05:00'));
        });
    });

    describe('extractTimestamp fallback behavior', () => {
        it('should use current time when no timestamp found in headers or body', async () => {
            const beforeTest = new Date();

            const email: ParsedMail = {
                date: undefined,
                subject: 'Generic Alert',
                text: 'This is an alert without any timestamp information.',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            const afterTest = new Date();

            expect(result).not.toBeNull();
            expect(result?.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
            expect(result?.timestamp.getTime()).toBeLessThanOrEqual(afterTest.getTime());
        });

        it('should use current time when header date is invalid', async () => {
            const beforeTest = new Date();

            const email: ParsedMail = {
                date: new Date('invalid'),
                subject: 'Alert',
                text: 'Alert body',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            const afterTest = new Date();

            expect(result).not.toBeNull();
            expect(result?.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
            expect(result?.timestamp.getTime()).toBeLessThanOrEqual(afterTest.getTime());
        });

        it('should prefer header date over body timestamp when both present', async () => {
            const headerDate = new Date('2024-12-08T10:30:45Z');
            const email: ParsedMail = {
                date: headerDate,
                subject: 'IPS Alert',
                text: 'Time: 2024-12-07 09:00:00\nAlert detected.',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp).toEqual(headerDate);
        });
    });

    describe('extractTimestamp with various body formats', () => {
        it('should handle case-insensitive timestamp labels', async () => {
            const email: ParsedMail = {
                date: undefined,
                subject: 'Alert',
                text: 'TIME: 2024-12-08 10:30:45\nAlert details.',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp.getFullYear()).toBe(2024);
        });

        it('should handle multiple timestamps and use the first valid one', async () => {
            const email: ParsedMail = {
                date: undefined,
                subject: 'Alert',
                text: 'Event: 2024-12-08T10:30:45Z\nReported: 2024-12-08T11:00:00Z',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp).toEqual(new Date('2024-12-08T10:30:45Z'));
        });

        it('should handle timestamp with extra whitespace', async () => {
            const email: ParsedMail = {
                date: undefined,
                subject: 'Alert',
                text: 'Time:   2024-12-08 10:30:45  \nAlert body.',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp.getFullYear()).toBe(2024);
        });
    });

    describe('extractTimestamp edge cases', () => {
        it('should handle empty email body', async () => {
            const headerDate = new Date('2024-12-08T10:30:45Z');
            const email: ParsedMail = {
                date: headerDate,
                subject: 'Alert',
                text: '',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp).toEqual(headerDate);
        });

        it('should handle null email body', async () => {
            const headerDate = new Date('2024-12-08T10:30:45Z');
            const email: ParsedMail = {
                date: headerDate,
                subject: 'Alert',
                text: undefined,
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            expect(result).not.toBeNull();
            expect(result?.timestamp).toEqual(headerDate);
        });

        it('should handle malformed timestamp in body', async () => {
            const beforeTest = new Date();

            const email: ParsedMail = {
                date: undefined,
                subject: 'Alert',
                text: 'Time: not-a-valid-date\nAlert body.',
                from: { text: 'sonicwall@example.com', value: [] },
            } as ParsedMail;

            const result = await listener.parseEmail(email);

            const afterTest = new Date();

            expect(result).not.toBeNull();
            // Should fall back to current time
            expect(result?.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
            expect(result?.timestamp.getTime()).toBeLessThanOrEqual(afterTest.getTime());
        });
    });
});
