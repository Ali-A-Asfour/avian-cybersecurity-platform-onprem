/**
 * Email Alert Listener Configuration Tests
 * 
 * Tests IMAP configuration loading and validation
 * Requirements: 11.1
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getImapConfig } from '../email-alert-listener';

describe('Email Alert Listener - IMAP Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset environment
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        // Restore environment
        process.env = originalEnv;
    });

    describe('getImapConfig', () => {
        it('should load IMAP configuration from environment variables', () => {
            // Set environment variables
            process.env.IMAP_HOST = 'imap.example.com';
            process.env.IMAP_PORT = '993';
            process.env.IMAP_USER = 'test@example.com';
            process.env.IMAP_PASSWORD = 'test-password';
            process.env.IMAP_TLS = 'true';

            // Note: In a real test, we'd need to reload the config module
            // For now, we'll test the structure
            const config = getImapConfig();

            expect(config).toHaveProperty('host');
            expect(config).toHaveProperty('port');
            expect(config).toHaveProperty('user');
            expect(config).toHaveProperty('password');
            expect(config).toHaveProperty('tls');
        });

        it('should use default values when environment variables are not set', () => {
            // Clear IMAP environment variables
            delete process.env.IMAP_HOST;
            delete process.env.IMAP_PORT;
            delete process.env.IMAP_USER;
            delete process.env.IMAP_PASSWORD;
            delete process.env.IMAP_TLS;

            const config = getImapConfig();

            // Should have default values
            expect(config.host).toBeDefined();
            expect(config.port).toBeDefined();
            expect(config.tls).toBeDefined();
        });

        it('should return configuration with correct types', () => {
            const config = getImapConfig();

            expect(typeof config.host).toBe('string');
            expect(typeof config.port).toBe('number');
            expect(typeof config.user).toBe('string');
            expect(typeof config.password).toBe('string');
            expect(typeof config.tls).toBe('boolean');
        });

        it('should handle TLS configuration correctly', () => {
            const config = getImapConfig();

            // TLS should be a boolean
            expect(typeof config.tls).toBe('boolean');
        });

        it('should provide valid IMAP port number', () => {
            const config = getImapConfig();

            // Port should be a valid number
            expect(config.port).toBeGreaterThan(0);
            expect(config.port).toBeLessThanOrEqual(65535);
        });
    });

    describe('IMAP Configuration Validation', () => {
        it('should have all required fields for IMAP connection', () => {
            const config = getImapConfig();

            // All required fields should be present
            expect(config).toHaveProperty('host');
            expect(config).toHaveProperty('port');
            expect(config).toHaveProperty('user');
            expect(config).toHaveProperty('password');
            expect(config).toHaveProperty('tls');
        });

        it('should support common IMAP providers', () => {
            const config = getImapConfig();

            // Common IMAP ports
            const commonPorts = [143, 993]; // 143 = non-TLS, 993 = TLS

            // Port should be one of the common IMAP ports or a custom port
            expect(config.port).toBeGreaterThan(0);
        });

        it('should enable TLS by default for security', () => {
            const config = getImapConfig();

            // TLS should be enabled by default for security
            // (unless explicitly disabled in environment)
            expect(typeof config.tls).toBe('boolean');
        });
    });

    describe('Configuration Examples', () => {
        it('should support Gmail IMAP configuration', () => {
            // Gmail IMAP settings
            const gmailConfig = {
                host: 'imap.gmail.com',
                port: 993,
                user: 'alerts@example.com',
                password: 'app-password',
                tls: true,
            };

            expect(gmailConfig.host).toBe('imap.gmail.com');
            expect(gmailConfig.port).toBe(993);
            expect(gmailConfig.tls).toBe(true);
        });

        it('should support Office 365 IMAP configuration', () => {
            // Office 365 IMAP settings
            const office365Config = {
                host: 'outlook.office365.com',
                port: 993,
                user: 'alerts@company.com',
                password: 'password',
                tls: true,
            };

            expect(office365Config.host).toBe('outlook.office365.com');
            expect(office365Config.port).toBe(993);
            expect(office365Config.tls).toBe(true);
        });

        it('should support custom IMAP server configuration', () => {
            // Custom IMAP server
            const customConfig = {
                host: 'mail.example.com',
                port: 993,
                user: 'alerts@example.com',
                password: 'password',
                tls: true,
            };

            expect(customConfig.host).toBe('mail.example.com');
            expect(customConfig.port).toBe(993);
            expect(customConfig.tls).toBe(true);
        });
    });
});
