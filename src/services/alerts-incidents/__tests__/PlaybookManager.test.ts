/**
 * Unit tests for PlaybookManager service
 * Tests role-based access control, classification linking, and automatic attachment
 */

import { PlaybookManager, UserRole, PlaybookClassificationLinkInput } from '../PlaybookManager';
import { db } from '../../../lib/database';
import { logger } from '../../../lib/logger';
import {
    CreateInvestigationPlaybookInput,
    UpdateInvestigationPlaybookInput,
    SecurityAlert,
    AlertSeverity,
    AlertStatus,
    AlertSourceSystem,
} from '../../../types/alerts-incidents';

// Mock dependencies
jest.mock('../../../lib/database', () => ({
    db: {
        transaction: jest.fn(),
        select: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
}));

jest.mock('../../../lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

describe('PlaybookManager', () => {
    const mockDb = db as any;
    const mockLogger = logger as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('createPlaybook', () => {
        const validInput: CreateInvestigationPlaybookInput = {
            name: 'Malware Investigation',
            version: '1.0',
            status: 'draft',
            purpose: 'Guide for investigating malware alerts',
            initialValidationSteps: ['Check alert details', 'Verify threat indicators'],
            sourceInvestigationSteps: ['Analyze file hash', 'Check network connections'],
            containmentChecks: ['Isolate affected device', 'Block malicious IPs'],
            decisionGuidance: {
                escalateToIncident: 'If malware is confirmed and spreading',
                resolveBenign: 'If file is confirmed safe',
                resolveFalsePositive: 'If alert is triggered by legitimate software',
            },
            createdBy: 'user-123',
        };

        const validClassifications: PlaybookClassificationLinkInput[] = [
            { classification: 'malware', isPrimary: true },
            { classification: 'suspicious_activity', isPrimary: false },
        ];

        it('should reject creation with Security Analyst role', async () => {
            await expect(
                PlaybookManager.createPlaybook(validInput, validClassifications, 'security_analyst')
            ).rejects.toThrow('Insufficient permissions. Only Super Admins can create playbooks.');
        });

        it('should reject creation with missing name', async () => {
            const invalidInput = { ...validInput, name: '' };

            await expect(
                PlaybookManager.createPlaybook(invalidInput, validClassifications, 'super_admin')
            ).rejects.toThrow('Playbook name is required');
        });

        it('should reject creation with missing version', async () => {
            const invalidInput = { ...validInput, version: '' };

            await expect(
                PlaybookManager.createPlaybook(invalidInput, validClassifications, 'super_admin')
            ).rejects.toThrow('Playbook version is required');
        });

        it('should reject creation with no classifications', async () => {
            await expect(
                PlaybookManager.createPlaybook(validInput, [], 'super_admin')
            ).rejects.toThrow('At least one classification must be linked to the playbook');
        });

        it('should reject creation with no primary classifications', async () => {
            const nonPrimaryClassifications = [
                { classification: 'malware', isPrimary: false },
                { classification: 'suspicious_activity', isPrimary: false },
            ];

            await expect(
                PlaybookManager.createPlaybook(validInput, nonPrimaryClassifications, 'super_admin')
            ).rejects.toThrow('At least one classification must be marked as primary');
        });
    });

    describe('updatePlaybook', () => {
        it('should reject update with Security Analyst role', async () => {
            await expect(
                PlaybookManager.updatePlaybook('playbook-123', {}, undefined, 'security_analyst')
            ).rejects.toThrow('Insufficient permissions. Only Super Admins can update playbooks.');
        });
    });

    describe('deletePlaybook', () => {
        it('should reject deletion with Security Analyst role', async () => {
            await expect(
                PlaybookManager.deletePlaybook('playbook-123', 'security_analyst')
            ).rejects.toThrow('Insufficient permissions. Only Super Admins can delete playbooks.');
        });
    });

    describe('getPlaybooks', () => {
        it('should return empty array when no playbooks exist', async () => {
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    orderBy: jest.fn().mockResolvedValue([]),
                }),
            });

            const result = await PlaybookManager.getPlaybooks();
            expect(result).toEqual([]);
        });
    });

    describe('getPlaybookById', () => {
        it('should return null when playbook not found', async () => {
            mockDb.select.mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue([]), // No playbook found
                    }),
                }),
            });

            const result = await PlaybookManager.getPlaybookById('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('activatePlaybook', () => {
        it('should reject activation with Security Analyst role', async () => {
            await expect(
                PlaybookManager.activatePlaybook('playbook-123', 'security_analyst')
            ).rejects.toThrow('Insufficient permissions. Only Super Admins can activate playbooks.');
        });
    });

    describe('deprecatePlaybook', () => {
        it('should reject deprecation with Security Analyst role', async () => {
            await expect(
                PlaybookManager.deprecatePlaybook('playbook-123', 'security_analyst')
            ).rejects.toThrow('Insufficient permissions. Only Super Admins can deprecate playbooks.');
        });
    });

    describe('attachPlaybooksToAlert', () => {
        const mockAlert: SecurityAlert = {
            id: 'alert-123',
            tenantId: 'tenant-123',
            sourceSystem: 'edr' as AlertSourceSystem,
            sourceId: 'edr-alert-456',
            alertType: 'edr_alert',
            classification: 'malware',
            severity: 'high' as AlertSeverity,
            title: 'Malware Detected',
            description: 'Suspicious file detected',
            metadata: {},
            seenCount: 1,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            defenderIncidentId: null,
            defenderAlertId: null,
            defenderSeverity: null,
            threatName: null,
            affectedDevice: null,
            affectedUser: null,
            status: 'open' as AlertStatus,
            assignedTo: null,
            assignedAt: null,
            detectedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        it('should return alert with empty playbooks on error', async () => {
            mockDb.select.mockImplementation(() => {
                throw new Error('Database error');
            });

            const result = await PlaybookManager.attachPlaybooksToAlert(mockAlert);

            expect(result).toEqual({
                alert: mockAlert,
                playbooks: [],
            });

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to attach playbooks to alert',
                expect.any(Error),
                expect.objectContaining({
                    alertId: 'alert-123',
                    classification: 'malware',
                })
            );
        });
    });

    describe('error handling', () => {
        it('should log errors appropriately', async () => {
            mockDb.select.mockImplementation(() => {
                throw new Error('Database error');
            });

            await expect(
                PlaybookManager.getPlaybooks()
            ).rejects.toThrow('Database error');

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to get playbooks',
                expect.any(Error),
                expect.any(Object)
            );
        });
    });
});