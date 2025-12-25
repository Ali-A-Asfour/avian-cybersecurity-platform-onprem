/**
 * Help Desk Error Handling Tests
 * 
 * Comprehensive tests for error handling, validation, and recovery mechanisms.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
    HelpDeskValidator,
    HelpDeskBusinessRules,
    HelpDeskErrors,
    HelpDeskRetryManager,
    HelpDeskErrorCode,
} from '../error-handling';
import { TicketStatus, UserRole, TicketCategory } from '@/types';

describe('HelpDeskValidator', () => {
    describe('validateTicketCreation', () => {
        it('should validate valid ticket creation data', () => {
            const validData = {
                title: 'Test Ticket',
                description: 'This is a test ticket description',
                impactLevel: 'medium',
                deviceId: 'PC-TEST-01',
                contactMethod: 'email',
            };

            const result = HelpDeskValidator.validateTicketCreation(validData);

            expect(result.valid).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.errors).toBeUndefined();
        });

        it('should reject ticket creation with missing required fields', () => {
            const invalidData = {
                title: '',
                description: '',
            };

            const result = HelpDeskValidator.validateTicketCreation(invalidData);

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors).toContain('title: Title is required');
            expect(result.errors).toContain('description: Description is required');
        });

        it('should reject ticket creation with invalid impact level', () => {
            const invalidData = {
                title: 'Test Ticket',
                description: 'Test description',
                impactLevel: 'invalid',
            };

            const result = HelpDeskValidator.validateTicketCreation(invalidData);

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.some(error => error.includes('Invalid option: expected one of'))).toBe(true);
        });

        it('should require phone number when phone contact method is selected', () => {
            const invalidData = {
                title: 'Test Ticket',
                description: 'Test description',
                impactLevel: 'medium',
                contactMethod: 'phone',
                // phoneNumber missing
            };

            const result = HelpDeskValidator.validateTicketCreation(invalidData);

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.some(error => error.includes('Phone number is required'))).toBe(true);
        });

        it('should validate device ID format', () => {
            const invalidData = {
                title: 'Test Ticket',
                description: 'Test description',
                impactLevel: 'medium',
                deviceId: 'invalid device id!',
            };

            const result = HelpDeskValidator.validateTicketCreation(invalidData);

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.some(error => error.includes('Device ID can only contain'))).toBe(true);
        });
    });

    describe('validateTicketResolution', () => {
        it('should validate valid resolution data', () => {
            const validData = {
                resolution: 'Fixed the issue by restarting the service',
                createKnowledgeArticle: false,
            };

            const result = HelpDeskValidator.validateTicketResolution(validData);

            expect(result.valid).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should require resolution description', () => {
            const invalidData = {
                resolution: '',
            };

            const result = HelpDeskValidator.validateTicketResolution(invalidData);

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.some(error => error.includes('Resolution description must be at least'))).toBe(true);
        });

        it('should require knowledge article title when creating KB article', () => {
            const invalidData = {
                resolution: 'Fixed the issue by restarting the service',
                createKnowledgeArticle: true,
                // knowledgeArticleTitle missing
            };

            const result = HelpDeskValidator.validateTicketResolution(invalidData);

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.some(error => error.includes('Knowledge article title is required'))).toBe(true);
        });
    });

    describe('validateFileUpload', () => {
        it('should validate valid file upload', () => {
            const validFile = {
                size: 1024 * 1024, // 1MB
                type: 'image/jpeg',
                name: 'test-image.jpg',
            };

            const result = HelpDeskValidator.validateFileUpload(validFile, 0);

            expect(result.valid).toBe(true);
            expect(result.errors).toBeUndefined();
        });

        it('should reject file that is too large', () => {
            const largeFile = {
                size: 15 * 1024 * 1024, // 15MB
                type: 'image/jpeg',
                name: 'large-image.jpg',
            };

            const result = HelpDeskValidator.validateFileUpload(largeFile, 0);

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.some(error => error.includes('File size exceeds maximum'))).toBe(true);
        });

        it('should reject invalid file type', () => {
            const invalidFile = {
                size: 1024,
                type: 'application/x-executable',
                name: 'malware.exe',
            };

            const result = HelpDeskValidator.validateFileUpload(invalidFile, 0);

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.some(error => error.includes('File type not allowed'))).toBe(true);
        });

        it('should reject when attachment limit is exceeded', () => {
            const validFile = {
                size: 1024,
                type: 'image/jpeg',
                name: 'test.jpg',
            };

            const result = HelpDeskValidator.validateFileUpload(validFile, 5); // Already at limit

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors?.some(error => error.includes('Maximum of'))).toBe(true);
        });
    });

    describe('sanitizeInput', () => {
        it('should remove script tags', () => {
            const maliciousInput = '<script>alert("xss")</script>Hello World';
            const sanitized = HelpDeskValidator.sanitizeInput(maliciousInput);

            expect(sanitized).toBe('Hello World');
            expect(sanitized).not.toContain('<script>');
        });

        it('should remove javascript URLs', () => {
            const maliciousInput = 'javascript:alert("xss")';
            const sanitized = HelpDeskValidator.sanitizeInput(maliciousInput);

            expect(sanitized).not.toContain('javascript:');
        });

        it('should remove event handlers', () => {
            const maliciousInput = '<div onclick="alert()">Hello</div>';
            const sanitized = HelpDeskValidator.sanitizeInput(maliciousInput);

            expect(sanitized).not.toContain('onclick=');
        });
    });

    describe('email and phone validation', () => {
        it('should validate correct email addresses', () => {
            expect(HelpDeskValidator.isValidEmail('user@example.com')).toBe(true);
            expect(HelpDeskValidator.isValidEmail('test.email+tag@domain.co.uk')).toBe(true);
        });

        it('should reject invalid email addresses', () => {
            expect(HelpDeskValidator.isValidEmail('invalid-email')).toBe(false);
            expect(HelpDeskValidator.isValidEmail('@domain.com')).toBe(false);
            expect(HelpDeskValidator.isValidEmail('user@')).toBe(false);
        });

        it('should validate correct phone numbers', () => {
            expect(HelpDeskValidator.isValidPhoneNumber('+1-555-123-4567')).toBe(true);
            expect(HelpDeskValidator.isValidPhoneNumber('(555) 123-4567')).toBe(true);
            expect(HelpDeskValidator.isValidPhoneNumber('5551234567')).toBe(true);
        });

        it('should reject invalid phone numbers', () => {
            expect(HelpDeskValidator.isValidPhoneNumber('123')).toBe(false);
            expect(HelpDeskValidator.isValidPhoneNumber('abc-def-ghij')).toBe(false);
        });
    });
});

describe('HelpDeskBusinessRules', () => {
    describe('validateTicketAssignment', () => {
        it('should allow assignment to unassigned ticket', () => {
            const ticket = {
                id: '1',
                assignee: 'Unassigned',
                category: TicketCategory.IT_SUPPORT,
            };

            const result = HelpDeskBusinessRules.validateTicketAssignment(
                ticket,
                'analyst1',
                UserRole.IT_HELPDESK_ANALYST
            );

            expect(result.valid).toBe(true);
        });

        it('should reject assignment to already assigned ticket', () => {
            const ticket = {
                id: '1',
                assignee: 'analyst2',
                category: TicketCategory.IT_SUPPORT,
            };

            const result = HelpDeskBusinessRules.validateTicketAssignment(
                ticket,
                'analyst1',
                UserRole.IT_HELPDESK_ANALYST
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('already assigned');
        });

        it('should reject assignment when user role cannot access category', () => {
            const ticket = {
                id: '1',
                assignee: 'Unassigned',
                category: TicketCategory.SECURITY_INCIDENT,
            };

            const result = HelpDeskBusinessRules.validateTicketAssignment(
                ticket,
                'analyst1',
                UserRole.IT_HELPDESK_ANALYST // Cannot access security incidents
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('cannot be assigned tickets in category');
        });
    });

    describe('validateStateTransition', () => {
        it('should allow valid state transitions', () => {
            const validTransitions = [
                [TicketStatus.NEW, TicketStatus.IN_PROGRESS],
                [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
                [TicketStatus.RESOLVED, TicketStatus.CLOSED],
            ];

            validTransitions.forEach(([from, to]) => {
                const result = HelpDeskBusinessRules.validateStateTransition(
                    from,
                    to,
                    UserRole.IT_HELPDESK_ANALYST,
                    true
                );
                expect(result.valid).toBe(true);
            });
        });

        it('should reject invalid state transitions', () => {
            const result = HelpDeskBusinessRules.validateStateTransition(
                TicketStatus.CLOSED,
                TicketStatus.NEW,
                UserRole.IT_HELPDESK_ANALYST
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid state transition');
        });

        it('should require resolution when transitioning to resolved', () => {
            const result = HelpDeskBusinessRules.validateStateTransition(
                TicketStatus.IN_PROGRESS,
                TicketStatus.RESOLVED,
                UserRole.IT_HELPDESK_ANALYST,
                false // no resolution
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Resolution description is required');
        });

        it('should prevent users from closing tickets', () => {
            const result = HelpDeskBusinessRules.validateStateTransition(
                TicketStatus.RESOLVED,
                TicketStatus.CLOSED,
                UserRole.USER
            );

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Only help desk analysts can close tickets');
        });
    });
});

describe('HelpDeskErrors', () => {
    it('should create appropriate error objects', () => {
        const ticketNotFoundError = HelpDeskErrors.ticketNotFound('123');
        expect(ticketNotFoundError.code).toBe(HelpDeskErrorCode.TICKET_NOT_FOUND);
        expect(ticketNotFoundError.message).toContain('123');
        expect(ticketNotFoundError.statusCode).toBe(404);

        const alreadyAssignedError = HelpDeskErrors.ticketAlreadyAssigned('analyst1');
        expect(alreadyAssignedError.code).toBe(HelpDeskErrorCode.TICKET_ALREADY_ASSIGNED);
        expect(alreadyAssignedError.message).toContain('analyst1');
        expect(alreadyAssignedError.statusCode).toBe(400);

        const fileTooLargeError = HelpDeskErrors.fileTooLarge('10MB');
        expect(fileTooLargeError.code).toBe(HelpDeskErrorCode.FILE_TOO_LARGE);
        expect(fileTooLargeError.message).toContain('10MB');
        expect(fileTooLargeError.statusCode).toBe(400);
    });
});

describe('HelpDeskRetryManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should succeed on first attempt when operation succeeds', async () => {
        const successfulOperation = jest.fn().mockResolvedValue('success');

        const result = await HelpDeskRetryManager.executeWithRetry(successfulOperation);

        expect(result).toBe('success');
        expect(successfulOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
        const failingOperation = jest.fn()
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Timeout'))
            .mockResolvedValue('success');

        const result = await HelpDeskRetryManager.executeWithRetry(
            failingOperation,
            {
                maxRetries: 3,
                baseDelay: 10, // Short delay for testing
                shouldRetry: (error) => error.message.includes('Network') || error.message.includes('Timeout'),
            }
        );

        expect(result).toBe('success');
        expect(failingOperation).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
        const failingOperation = jest.fn()
            .mockRejectedValue(new Error('Validation error'));

        await expect(
            HelpDeskRetryManager.executeWithRetry(
                failingOperation,
                {
                    maxRetries: 3,
                    shouldRetry: (error) => !error.message.includes('Validation'),
                }
            )
        ).rejects.toThrow('Validation error');

        expect(failingOperation).toHaveBeenCalledTimes(1);
    });

    it('should throw last error after max retries exceeded', async () => {
        const networkError = new Error('Network error');
        (networkError as any).code = 'ECONNREFUSED';

        const failingOperation = jest.fn()
            .mockRejectedValue(networkError);

        await expect(
            HelpDeskRetryManager.executeWithRetry(
                failingOperation,
                {
                    maxRetries: 2,
                    baseDelay: 10,
                }
            )
        ).rejects.toThrow('Network error');

        expect(failingOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should call onRetry callback', async () => {
        const networkError = new Error('First failure');
        (networkError as any).code = 'ECONNREFUSED';

        const failingOperation = jest.fn()
            .mockRejectedValueOnce(networkError)
            .mockResolvedValue('success');

        const onRetry = jest.fn();

        await HelpDeskRetryManager.executeWithRetry(
            failingOperation,
            {
                maxRetries: 2,
                baseDelay: 10,
                onRetry,
            }
        );

        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
});