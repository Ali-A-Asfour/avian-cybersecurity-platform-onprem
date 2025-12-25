/**
 * Property-Based Test for Ticket Creation Validation
 * **Feature: avian-help-desk, Property 1: Ticket Creation Validation**
 * **Validates: Requirements 1.2, 1.6, 1.8**
 */

import { HelpDeskValidator } from '@/lib/help-desk/error-handling';

describe('Help Desk Ticket Creation Validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Property 1: Ticket Creation Validation - should require only title and description while keeping other fields optional', () => {
        // Test minimum valid ticket data (only required fields)
        const minimalValidData = {
            title: 'Test ticket title',
            description: 'Test ticket description',
            impactLevel: 'medium' as const
        };

        const result = HelpDeskValidator.validateTicketCreation(minimalValidData);
        expect(result.valid).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.title).toBe('Test ticket title');
        expect(result.data?.description).toBe('Test ticket description');
        expect(result.data?.impactLevel).toBe('medium');
        expect(result.data?.contactMethod).toBe('email'); // Default value
    });

    it('Property 1: Ticket Creation Validation - should accept all optional fields when provided', () => {
        const fullValidData = {
            title: 'Complete ticket with all fields',
            description: 'Detailed description of the issue',
            impactLevel: 'critical' as const,
            deviceId: 'PC-RECEP-01',
            contactMethod: 'phone' as const,
            phoneNumber: '+1-555-123-4567'
        };

        const result = HelpDeskValidator.validateTicketCreation(fullValidData);
        expect(result.valid).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.deviceId).toBe('PC-RECEP-01');
        expect(result.data?.contactMethod).toBe('phone');
        expect(result.data?.phoneNumber).toBe('+1-555-123-4567');
    });

    it('Property 1: Ticket Creation Validation - should reject tickets without required title', () => {
        const invalidData = {
            description: 'Description without title',
            impactLevel: 'medium' as const
        };

        const result = HelpDeskValidator.validateTicketCreation(invalidData);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(error => error.includes('title:'))).toBe(true);
    });

    it('Property 1: Ticket Creation Validation - should reject tickets without required description', () => {
        const invalidData = {
            title: 'Title without description',
            impactLevel: 'medium' as const
        };

        const result = HelpDeskValidator.validateTicketCreation(invalidData);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(error => error.includes('description:'))).toBe(true);
    });

    it('Property 1: Ticket Creation Validation - should reject tickets without impact level', () => {
        const invalidData = {
            title: 'Title without impact level',
            description: 'Description without impact level'
        };

        const result = HelpDeskValidator.validateTicketCreation(invalidData);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(error => error.includes('impactLevel:'))).toBe(true);
    });

    it('Property 1: Ticket Creation Validation - should require phone number when phone contact method is selected', () => {
        const invalidData = {
            title: 'Phone contact without number',
            description: 'Testing phone validation',
            impactLevel: 'medium' as const,
            contactMethod: 'phone' as const
            // Missing phoneNumber
        };

        const result = HelpDeskValidator.validateTicketCreation(invalidData);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(error => error.includes('Phone number is required'))).toBe(true);
    });

    it('Property 1: Ticket Creation Validation - should accept valid device ID formats', () => {
        const validDeviceIds = [
            'PC-RECEP-01',
            'LAPTOP-123',
            'SERVER_MAIN',
            'WORKSTATION-A1B2',
            'DEVICE123'
        ];

        validDeviceIds.forEach(deviceId => {
            const data = {
                title: 'Test ticket',
                description: 'Test description',
                impactLevel: 'medium' as const,
                deviceId
            };

            const result = HelpDeskValidator.validateTicketCreation(data);
            expect(result.valid).toBe(true);
            expect(result.data?.deviceId).toBe(deviceId);
        });
    });

    it('Property 1: Ticket Creation Validation - should reject invalid device ID formats', () => {
        const invalidDeviceIds = [
            'PC RECEP 01', // Spaces not allowed
            'PC@RECEP#01', // Special characters not allowed
            'PC/RECEP\\01', // Slashes not allowed
            'PC.RECEP.01', // Dots not allowed
            'PC+RECEP=01'  // Plus/equals not allowed
        ];

        invalidDeviceIds.forEach(deviceId => {
            const data = {
                title: 'Test ticket',
                description: 'Test description',
                impactLevel: 'medium' as const,
                deviceId
            };

            const result = HelpDeskValidator.validateTicketCreation(data);
            expect(result.valid).toBe(false);
            expect(result.errors?.some(error => error.includes('Device ID can only contain'))).toBe(true);
        });
    });

    it('Property 1: Ticket Creation Validation - should accept valid phone number formats', () => {
        const validPhoneNumbers = [
            '+1-555-123-4567',
            '555-123-4567',
            '(555) 123-4567',
            '+44 20 7946 0958',
            '5551234567'
        ];

        validPhoneNumbers.forEach(phoneNumber => {
            const data = {
                title: 'Test ticket',
                description: 'Test description',
                impactLevel: 'medium' as const,
                contactMethod: 'phone' as const,
                phoneNumber
            };

            const result = HelpDeskValidator.validateTicketCreation(data);
            expect(result.valid).toBe(true);
            expect(result.data?.phoneNumber).toBe(phoneNumber);
        });
    });

    it('Property 1: Ticket Creation Validation - should reject invalid phone number formats', () => {
        const invalidPhoneNumbers = [
            'abc-def-ghij',
            'phone number',
            '++++++',
            '123-abc-4567',
            '555.123.4567' // Dots not allowed in current regex
        ];

        invalidPhoneNumbers.forEach(phoneNumber => {
            const data = {
                title: 'Test ticket',
                description: 'Test description',
                impactLevel: 'medium' as const,
                contactMethod: 'phone' as const,
                phoneNumber
            };

            const result = HelpDeskValidator.validateTicketCreation(data);
            expect(result.valid).toBe(false);
            expect(result.errors?.some(error => error.includes('phoneNumber:'))).toBe(true);
        });
    });

    it('Property 1: Ticket Creation Validation - should accept valid impact levels', () => {
        const validImpactLevels = ['critical', 'medium', 'low'] as const;

        validImpactLevels.forEach(impactLevel => {
            const data = {
                title: 'Test ticket',
                description: 'Test description',
                impactLevel
            };

            const result = HelpDeskValidator.validateTicketCreation(data);
            expect(result.valid).toBe(true);
            expect(result.data?.impactLevel).toBe(impactLevel);
        });
    });

    it('Property 1: Ticket Creation Validation - should reject invalid impact levels', () => {
        const invalidImpactLevels = ['urgent', 'high', 'normal', 'trivial', 'emergency'];

        invalidImpactLevels.forEach(impactLevel => {
            const data = {
                title: 'Test ticket',
                description: 'Test description',
                impactLevel
            };

            const result = HelpDeskValidator.validateTicketCreation(data);
            expect(result.valid).toBe(false);
            expect(result.errors?.some(error => error.includes('impactLevel:'))).toBe(true);
        });
    });

    it('Property 1: Ticket Creation Validation - should trim whitespace from title and description', () => {
        const dataWithWhitespace = {
            title: '  Test ticket with spaces  ',
            description: '  Test description with spaces  ',
            impactLevel: 'medium' as const
        };

        const result = HelpDeskValidator.validateTicketCreation(dataWithWhitespace);
        expect(result.valid).toBe(true);
        expect(result.data?.title).toBe('Test ticket with spaces');
        expect(result.data?.description).toBe('Test description with spaces');
    });

    it('Property 1: Ticket Creation Validation - should enforce maximum length limits', () => {
        const longTitle = 'A'.repeat(201); // Exceeds 200 character limit
        const longDescription = 'B'.repeat(5001); // Exceeds 5000 character limit
        const longDeviceId = 'C'.repeat(51); // Exceeds 50 character limit

        // Test long title
        let data = {
            title: longTitle,
            description: 'Valid description',
            impactLevel: 'medium' as const
        };
        let result = HelpDeskValidator.validateTicketCreation(data);
        expect(result.valid).toBe(false);
        expect(result.errors?.some(error => error.includes('Title must be less than 200 characters'))).toBe(true);

        // Test long description
        data = {
            title: 'Valid title',
            description: longDescription,
            impactLevel: 'medium' as const
        };
        result = HelpDeskValidator.validateTicketCreation(data);
        expect(result.valid).toBe(false);
        expect(result.errors?.some(error => error.includes('Description must be less than 5000 characters'))).toBe(true);

        // Test long device ID
        data = {
            title: 'Valid title',
            description: 'Valid description',
            impactLevel: 'medium' as const,
            deviceId: longDeviceId
        };
        result = HelpDeskValidator.validateTicketCreation(data);
        expect(result.valid).toBe(false);
        expect(result.errors?.some(error => error.includes('Device ID must be less than 50 characters'))).toBe(true);
    });

    it('Property 1: Ticket Creation Validation - should default contact method to email when not specified', () => {
        const data = {
            title: 'Test ticket',
            description: 'Test description',
            impactLevel: 'medium' as const
            // contactMethod not specified
        };

        const result = HelpDeskValidator.validateTicketCreation(data);
        expect(result.valid).toBe(true);
        expect(result.data?.contactMethod).toBe('email');
    });
});