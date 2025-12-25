/**
 * Email Alert Listener - Mark Email as Read Tests
 * 
 * Tests the functionality of marking emails as read and moving them to processed folder.
 * 
 * Requirements: 11.9
 */

import { EmailAlertListener } from '../email-alert-listener';
import type { EmailConfig } from '../../types/firewall';
import Imap from 'imap';

// Mock IMAP
jest.mock('imap');

// Mock logger
jest.mock('../logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

// Mock database
jest.mock('../database', () => ({
    db: {
        query: {
            firewallDevices: {
                findFirst: jest.fn(),
            },
            tenants: {
                findFirst: jest.fn(),
            },
        },
    },
}));

// Mock alert manager
jest.mock('../alert-manager', () => ({
    AlertManager: {
        createAlert: jest.fn(),
        deduplicateAlert: jest.fn().mockResolvedValue(false),
    },
}));

// Mock config
jest.mock('../config', () => ({
    config: {
        imap: {
            host: 'imap.example.com',
            port: 993,
            user: 'test@example.com',
            password: 'password',
            tls: true,
        },
        redis: {
            url: 'redis://localhost:6379',
        },
    },
}));

// Mock redis
jest.mock('../redis', () => ({
    connectRedis: jest.fn().mockResolvedValue({
        exists: jest.fn().mockResolvedValue(0),
        setEx: jest.fn().mockResolvedValue('OK'),
    }),
}));

describe('EmailAlertListener - Mark Email as Read', () => {
    let listener: EmailAlertListener;
    let mockImapInstance: any;
    let config: EmailConfig;

    beforeEach(() => {
        config = {
            host: 'imap.example.com',
            port: 993,
            user: 'test@example.com',
            password: 'password',
            tls: true,
        };

        // Create mock IMAP instance
        mockImapInstance = {
            once: jest.fn(),
            connect: jest.fn(),
            end: jest.fn(),
            openBox: jest.fn(),
            addFlags: jest.fn(),
            move: jest.fn(),
        };

        // Mock IMAP constructor
        (Imap as any).mockImplementation(() => mockImapInstance);

        listener = new EmailAlertListener(config);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('markEmailAsProcessed', () => {
        it('should mark email as read by adding \\Seen flag', async () => {
            const uid = 123;

            // Setup IMAP mock behavior
            mockImapInstance.once.mockImplementation((event: string, callback: Function) => {
                if (event === 'ready') {
                    callback();
                }
            });

            mockImapInstance.openBox.mockImplementation((box: string, readOnly: boolean, callback: Function) => {
                callback(null);
            });

            mockImapInstance.addFlags.mockImplementation((uid: number, flags: string[], callback: Function) => {
                callback(null);
            });

            mockImapInstance.move.mockImplementation((uid: number, folder: string, callback: Function) => {
                callback(null);
            });

            // Call the private method through reflection
            await (listener as any).markEmailAsProcessed(uid);

            // Verify addFlags was called with correct parameters
            expect(mockImapInstance.addFlags).toHaveBeenCalledWith(uid, ['\\Seen'], expect.any(Function));
        });

        it('should attempt to move email to Processed folder', async () => {
            const uid = 456;

            // Setup IMAP mock behavior
            mockImapInstance.once.mockImplementation((event: string, callback: Function) => {
                if (event === 'ready') {
                    callback();
                }
            });

            mockImapInstance.openBox.mockImplementation((box: string, readOnly: boolean, callback: Function) => {
                callback(null);
            });

            mockImapInstance.addFlags.mockImplementation((uid: number, flags: string[], callback: Function) => {
                callback(null);
            });

            mockImapInstance.move.mockImplementation((uid: number, folder: string, callback: Function) => {
                callback(null);
            });

            // Call the private method
            await (listener as any).markEmailAsProcessed(uid);

            // Verify move was called with correct parameters
            expect(mockImapInstance.move).toHaveBeenCalledWith(uid, 'Processed', expect.any(Function));
        });

        it('should handle case when Processed folder does not exist', async () => {
            const uid = 789;

            // Setup IMAP mock behavior
            mockImapInstance.once.mockImplementation((event: string, callback: Function) => {
                if (event === 'ready') {
                    callback();
                }
            });

            mockImapInstance.openBox.mockImplementation((box: string, readOnly: boolean, callback: Function) => {
                callback(null);
            });

            mockImapInstance.addFlags.mockImplementation((uid: number, flags: string[], callback: Function) => {
                callback(null);
            });

            // Simulate folder not existing
            mockImapInstance.move.mockImplementation((uid: number, folder: string, callback: Function) => {
                callback(new Error('Folder does not exist'));
            });

            // Should not throw error even if move fails
            await expect((listener as any).markEmailAsProcessed(uid)).resolves.not.toThrow();

            // Verify addFlags was still called (email marked as read)
            expect(mockImapInstance.addFlags).toHaveBeenCalledWith(uid, ['\\Seen'], expect.any(Function));
        });

        it('should reject if marking as read fails', async () => {
            const uid = 999;

            // Setup IMAP mock behavior
            mockImapInstance.once.mockImplementation((event: string, callback: Function) => {
                if (event === 'ready') {
                    callback();
                }
            });

            mockImapInstance.openBox.mockImplementation((box: string, readOnly: boolean, callback: Function) => {
                callback(null);
            });

            // Simulate addFlags failure
            mockImapInstance.addFlags.mockImplementation((uid: number, flags: string[], callback: Function) => {
                callback(new Error('Failed to add flags'));
            });

            // Should reject with error
            await expect((listener as any).markEmailAsProcessed(uid)).rejects.toThrow('Failed to add flags');
        });

        it('should reject if IMAP connection fails', async () => {
            const uid = 111;

            // Setup IMAP mock to fail on connection
            mockImapInstance.once.mockImplementation((event: string, callback: Function) => {
                if (event === 'error') {
                    callback(new Error('Connection failed'));
                }
            });

            // Should reject with error
            await expect((listener as any).markEmailAsProcessed(uid)).rejects.toThrow('Connection failed');
        });

        it('should close IMAP connection after processing', async () => {
            const uid = 222;

            // Setup IMAP mock behavior
            mockImapInstance.once.mockImplementation((event: string, callback: Function) => {
                if (event === 'ready') {
                    callback();
                }
            });

            mockImapInstance.openBox.mockImplementation((box: string, readOnly: boolean, callback: Function) => {
                callback(null);
            });

            mockImapInstance.addFlags.mockImplementation((uid: number, flags: string[], callback: Function) => {
                callback(null);
            });

            mockImapInstance.move.mockImplementation((uid: number, folder: string, callback: Function) => {
                callback(null);
            });

            await (listener as any).markEmailAsProcessed(uid);

            // Verify connection was closed
            expect(mockImapInstance.end).toHaveBeenCalled();
        });

        it('should mark email as read even if move to Processed folder fails', async () => {
            const uid = 333;
            let addFlagsCalled = false;

            // Setup IMAP mock behavior
            mockImapInstance.once.mockImplementation((event: string, callback: Function) => {
                if (event === 'ready') {
                    callback();
                }
            });

            mockImapInstance.openBox.mockImplementation((box: string, readOnly: boolean, callback: Function) => {
                callback(null);
            });

            mockImapInstance.addFlags.mockImplementation((uid: number, flags: string[], callback: Function) => {
                addFlagsCalled = true;
                callback(null);
            });

            mockImapInstance.move.mockImplementation((uid: number, folder: string, callback: Function) => {
                callback(new Error('Move failed'));
            });

            await (listener as any).markEmailAsProcessed(uid);

            // Verify email was marked as read despite move failure
            expect(addFlagsCalled).toBe(true);
        });
    });

    describe('Integration with processEmail', () => {
        it('should call markEmailAsProcessed after successfully creating alert', async () => {
            const uid = 555;
            const mockEmail = {
                from: { text: 'alerts@sonicwall.com' },
                subject: 'IPS Alert',
                text: 'Critical alert detected',
                date: new Date(),
            };

            // Mock the private method
            const markEmailSpy = jest.spyOn(listener as any, 'markEmailAsProcessed').mockResolvedValue(undefined);

            // Mock other methods
            jest.spyOn(listener as any, 'isSonicWallEmail').mockReturnValue(true);
            jest.spyOn(listener, 'parseEmail').mockResolvedValue({
                alertType: 'ips_alert',
                severity: 'critical',
                message: 'Critical alert detected',
                timestamp: new Date(),
                deviceIdentifier: '192.168.1.1',
                deviceId: 'device-123',
            });
            jest.spyOn(listener as any, 'isDuplicateEmail').mockResolvedValue(false);
            jest.spyOn(listener as any, 'createAlertFromEmail').mockResolvedValue(undefined);

            await (listener as any).processEmail(mockEmail, uid);

            // Verify markEmailAsProcessed was called with correct UID
            expect(markEmailSpy).toHaveBeenCalledWith(uid);
        });

        it('should not call markEmailAsProcessed if email is not from SonicWall', async () => {
            const uid = 666;
            const mockEmail = {
                from: { text: 'spam@example.com' },
                subject: 'Spam email',
                text: 'Buy now!',
                date: new Date(),
            };

            // Mock the private method
            const markEmailSpy = jest.spyOn(listener as any, 'markEmailAsProcessed').mockResolvedValue(undefined);

            // Mock isSonicWallEmail to return false
            jest.spyOn(listener as any, 'isSonicWallEmail').mockReturnValue(false);

            await (listener as any).processEmail(mockEmail, uid);

            // Verify markEmailAsProcessed was NOT called
            expect(markEmailSpy).not.toHaveBeenCalled();
        });

        it('should not call markEmailAsProcessed if email is duplicate', async () => {
            const uid = 777;
            const mockEmail = {
                from: { text: 'alerts@sonicwall.com' },
                subject: 'IPS Alert',
                text: 'Critical alert detected',
                date: new Date(),
            };

            // Mock the private method
            const markEmailSpy = jest.spyOn(listener as any, 'markEmailAsProcessed').mockResolvedValue(undefined);

            // Mock other methods
            jest.spyOn(listener as any, 'isSonicWallEmail').mockReturnValue(true);
            jest.spyOn(listener, 'parseEmail').mockResolvedValue({
                alertType: 'ips_alert',
                severity: 'critical',
                message: 'Critical alert detected',
                timestamp: new Date(),
                deviceIdentifier: '192.168.1.1',
                deviceId: 'device-123',
            });
            jest.spyOn(listener as any, 'isDuplicateEmail').mockResolvedValue(true); // Duplicate

            await (listener as any).processEmail(mockEmail, uid);

            // Verify markEmailAsProcessed was NOT called
            expect(markEmailSpy).not.toHaveBeenCalled();
        });
    });
});
