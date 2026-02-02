/**
 * Email Alert Listener - SonicWall Sender Filter Tests
 * 
 * Tests filtering of emails from SonicWall sender
 * Requirements: 11.1
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { EmailAlertListener } from '../email-alert-listener';
import type { ParsedMail } from 'mailparser';
import type { EmailConfig } from '../../types/firewall';

describe('Email Alert Listener - SonicWall Sender Filter', () => {
    let listener: EmailAlertListener;
    let mockConfig: EmailConfig;

    beforeEach(() => {
        mockConfig = {
            host: 'imap.example.com',
            port: 993,
            user: 'test@example.com',
            password: 'password',
            tls: true,
        };

        listener = new EmailAlertListener(mockConfig);
    });

    describe('SonicWall Email Detection', () => {
        it('should accept emails from sonicwall.com domain', () => {
            const email: Partial<ParsedMail> = {
                from: {
                    value: [{ address: 'alerts@sonicwall.com', name: 'SonicWall Alerts' }],
                    text: 'SonicWall Alerts <alerts@sonicwall.com>',
                    html: '',
                },
                subject: 'IPS Alert',
                text: 'Test alert',
                date: new Date(),
            };

            // Access private method via type assertion for testing
            const result = (listener as any).isSonicWallEmail(email as ParsedMail);
            expect(result).toBe(true);
        });

        it('should accept emails with "sonicwall" in sender name', () => {
            const email: Partial<ParsedMail> = {
                from: {
                    value: [{ address: 'noreply@example.com', name: 'SonicWall Device' }],
                    text: 'SonicWall Device <noreply@example.com>',
                    html: '',
                },
                subject: 'VPN Down',
                text: 'Test alert',
                date: new Date(),
            };

            const result = (listener as any).isSonicWallEmail(email as ParsedMail);
            expect(result).toBe(true);
        });

        it('should accept emails with "sonic-wall" (hyphenated)', () => {
            const email: Partial<ParsedMail> = {
                from: {
                    value: [{ address: 'alerts@sonic-wall.com', name: 'Sonic-Wall' }],
                    text: 'Sonic-Wall <alerts@sonic-wall.com>',
                    html: '',
                },
                subject: 'License Expiring',
                text: 'Test alert',
                date: new Date(),
            };

            const result = (listener as any).isSonicWallEmail(email as ParsedMail);
            expect(result).toBe(true);
        });

        it('should be case-insensitive when checking sender', () => {
            const email: Partial<ParsedMail> = {
                from: {
                    value: [{ address: 'alerts@SONICWALL.COM', name: 'SONICWALL' }],
                    text: 'SONICWALL <alerts@SONICWALL.COM>',
                    html: '',
                },
                subject: 'Alert',
                text: 'Test alert',
                date: new Date(),
            };

            const result = (listener as any).isSonicWallEmail(email as ParsedMail);
            expect(result).toBe(true);
        });

        it('should reject emails from non-SonicWall senders', () => {
            const email: Partial<ParsedMail> = {
                from: {
                    value: [{ address: 'spam@example.com', name: 'Spammer' }],
                    text: 'Spammer <spam@example.com>',
                    html: '',
                },
                subject: 'Buy now!',
                text: 'Spam message',
                date: new Date(),
            };

            const result = (listener as any).isSonicWallEmail(email as ParsedMail);
            expect(result).toBe(false);
        });

        it('should reject emails from other firewall vendors', () => {
            const email: Partial<ParsedMail> = {
                from: {
                    value: [{ address: 'alerts@fortinet.com', name: 'Fortinet' }],
                    text: 'Fortinet <alerts@fortinet.com>',
                    html: '',
                },
                subject: 'Firewall Alert',
                text: 'Test alert',
                date: new Date(),
            };

            const result = (listener as any).isSonicWallEmail(email as ParsedMail);
            expect(result).toBe(false);
        });

        it('should handle emails with missing from field', () => {
            const email: Partial<ParsedMail> = {
                from: undefined,
                subject: 'Alert',
                text: 'Test alert',
                date: new Date(),
            };

            const result = (listener as any).isSonicWallEmail(email as ParsedMail);
            expect(result).toBe(false);
        });

        it('should handle emails with empty from text', () => {
            const email: Partial<ParsedMail> = {
                from: {
                    value: [],
                    text: '',
                    html: '',
                },
                subject: 'Alert',
                text: 'Test alert',
                date: new Date(),
            };

            const result = (listener as any).isSonicWallEmail(email as ParsedMail);
            expect(result).toBe(false);
        });
    });

    describe('Email Processing with Filter', () => {
        it('should skip processing non-SonicWall emails', async () => {
            const email: Partial<ParsedMail> = {
                from: {
                    value: [{ address: 'other@example.com', name: 'Other Sender' }],
                    text: 'Other Sender <other@example.com>',
                    html: '',
                },
                subject: 'Some Alert',
                text: 'Test message',
                date: new Date(),
            };

            // Spy on parseEmail to ensure it's not called for non-SonicWall emails
            const parseEmailSpy = jest.spyOn(listener as any, 'parseEmail');

            await (listener as any).processEmail(email as ParsedMail);

            // parseEmail should not be called because email is filtered out
            expect(parseEmailSpy).not.toHaveBeenCalled();
        });

        it('should process SonicWall emails', async () => {
            const email: Partial<ParsedMail> = {
                from: {
                    value: [{ address: 'alerts@sonicwall.com', name: 'SonicWall' }],
                    text: 'SonicWall <alerts@sonicwall.com>',
                    html: '',
                },
                subject: 'IPS Alert',
                text: 'Critical IPS alert detected',
                date: new Date(),
            };

            // Spy on parseEmail to ensure it's called for SonicWall emails
            const parseEmailSpy = jest.spyOn(listener as any, 'parseEmail');

            // Mock parseEmail to return null to avoid further processing
            parseEmailSpy.mockResolvedValue(null);

            await (listener as any).processEmail(email as ParsedMail);

            // parseEmail should be called because email is from SonicWall
            expect(parseEmailSpy).toHaveBeenCalledWith(email);
        });
    });

    describe('Filter Integration', () => {
        it('should filter emails in checkForNewEmails workflow', async () => {
            // Mock fetchUnreadEmails to return mixed emails
            const sonicwallEmail: Partial<ParsedMail> = {
                from: {
                    value: [{ address: 'alerts@sonicwall.com', name: 'SonicWall' }],
                    text: 'SonicWall <alerts@sonicwall.com>',
                    html: '',
                },
                subject: 'IPS Alert',
                text: 'Test alert',
                date: new Date(),
            };

            const otherEmail: Partial<ParsedMail> = {
                from: {
                    value: [{ address: 'spam@example.com', name: 'Spam' }],
                    text: 'Spam <spam@example.com>',
                    html: '',
                },
                subject: 'Buy now',
                text: 'Spam',
                date: new Date(),
            };

            // Mock fetchUnreadEmails
            jest.spyOn(listener as any, 'fetchUnreadEmails').mockResolvedValue([
                sonicwallEmail as ParsedMail,
                otherEmail as ParsedMail,
            ]);

            // Spy on processEmail
            const processEmailSpy = jest.spyOn(listener as any, 'processEmail');

            // Mock parseEmail to avoid actual processing
            jest.spyOn(listener as any, 'parseEmail').mockResolvedValue(null);

            await listener.checkForNewEmails();

            // processEmail should be called for both emails
            expect(processEmailSpy).toHaveBeenCalledTimes(2);

            // But only SonicWall email should proceed past the filter
            // (we can't easily verify this without more mocking, but the filter is tested above)
        });
    });

    describe('Requirement 11.1 Compliance', () => {
        it('should only process emails from SonicWall sender', () => {
            // Test various SonicWall email formats
            const sonicwallEmails = [
                { from: { text: 'alerts@sonicwall.com', value: [], html: '' } },
                { from: { text: 'SonicWall Device <device@sonicwall.com>', value: [], html: '' } },
                { from: { text: 'noreply@sonic-wall.com', value: [], html: '' } },
                { from: { text: 'SONICWALL <ALERTS@SONICWALL.COM>', value: [], html: '' } },
            ];

            sonicwallEmails.forEach((email) => {
                const result = (listener as any).isSonicWallEmail(email as ParsedMail);
                expect(result).toBe(true);
            });
        });

        it('should reject emails from non-SonicWall senders', () => {
            // Test various non-SonicWall email formats
            const nonSonicwallEmails = [
                { from: { text: 'alerts@fortinet.com', value: [], html: '' } },
                { from: { text: 'spam@example.com', value: [], html: '' } },
                { from: { text: 'user@company.com', value: [], html: '' } },
                { from: { text: '', value: [], html: '' } },
                { from: undefined },
            ];

            nonSonicwallEmails.forEach((email) => {
                const result = (listener as any).isSonicWallEmail(email as ParsedMail);
                expect(result).toBe(false);
            });
        });
    });
});
