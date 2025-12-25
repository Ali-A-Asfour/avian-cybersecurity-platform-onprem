/**
 * Property-Based Test for Resolution Requirement Validation
 * **Feature: avian-help-desk, Property 6: Resolution Requirement Validation**
 * **Validates: Requirements 3.1**
 */

import { HelpDeskValidator, HelpDeskBusinessRules } from '@/lib/help-desk/error-handling';
import { TicketStatus, UserRole } from '@/types';

describe('Help Desk Resolution Requirement Validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Property 6: Resolution Requirement Validation - should require resolution description when resolving tickets', () => {
        // Test that resolution description is required
        const resolutionDataWithoutDescription = {
            createKnowledgeArticle: false
        };

        const result = HelpDeskValidator.validateTicketResolution(resolutionDataWithoutDescription);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(error => error.includes('resolution:'))).toBe(true);
    });

    it('Property 6: Resolution Requirement Validation - should accept valid resolution with minimum required description', () => {
        const validResolutionData = {
            resolution: 'Fixed the issue by restarting the service',
            createKnowledgeArticle: false
        };

        const result = HelpDeskValidator.validateTicketResolution(validResolutionData);
        expect(result.valid).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.resolution).toBe('Fixed the issue by restarting the service');
    });

    it('Property 6: Resolution Requirement Validation - should reject resolution descriptions that are too short', () => {
        const shortResolutionData = {
            resolution: 'Fixed', // Too short (less than 10 characters)
            createKnowledgeArticle: false
        };

        const result = HelpDeskValidator.validateTicketResolution(shortResolutionData);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(error => error.includes('at least 10 characters'))).toBe(true);
    });

    it('Property 6: Resolution Requirement Validation - should reject resolution descriptions that are too long', () => {
        const longResolution = 'A'.repeat(2001); // Exceeds 2000 character limit
        const longResolutionData = {
            resolution: longResolution,
            createKnowledgeArticle: false
        };

        const result = HelpDeskValidator.validateTicketResolution(longResolutionData);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(error => error.includes('less than 2000 characters'))).toBe(true);
    });

    it('Property 6: Resolution Requirement Validation - should require knowledge article title when creating KB article', () => {
        const resolutionWithKBButNoTitle = {
            resolution: 'Fixed the issue by restarting the service',
            createKnowledgeArticle: true
            // Missing knowledgeArticleTitle
        };

        const result = HelpDeskValidator.validateTicketResolution(resolutionWithKBButNoTitle);
        expect(result.valid).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors?.some(error => error.includes('Knowledge article title is required'))).toBe(true);
    });

    it('Property 6: Resolution Requirement Validation - should accept valid resolution with knowledge article creation', () => {
        const validResolutionWithKB = {
            resolution: 'Fixed the issue by restarting the email service and updating the configuration',
            createKnowledgeArticle: true,
            knowledgeArticleTitle: 'How to fix email service issues'
        };

        const result = HelpDeskValidator.validateTicketResolution(validResolutionWithKB);
        expect(result.valid).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.resolution).toBe('Fixed the issue by restarting the email service and updating the configuration');
        expect(result.data?.createKnowledgeArticle).toBe(true);
        expect(result.data?.knowledgeArticleTitle).toBe('How to fix email service issues');
    });

    it('Property 6: Resolution Requirement Validation - should trim whitespace from resolution description', () => {
        const resolutionWithWhitespace = {
            resolution: '  Fixed the issue by restarting the service  ',
            createKnowledgeArticle: false
        };

        const result = HelpDeskValidator.validateTicketResolution(resolutionWithWhitespace);
        expect(result.valid).toBe(true);
        expect(result.data?.resolution).toBe('Fixed the issue by restarting the service');
    });

    it('Property 6: Resolution Requirement Validation - should validate state transition requires resolution', () => {
        // Test business rule validation for state transitions
        const validTransitionWithResolution = HelpDeskBusinessRules.validateStateTransition(
            TicketStatus.IN_PROGRESS,
            TicketStatus.RESOLVED,
            UserRole.IT_HELPDESK_ANALYST,
            true // has resolution
        );

        expect(validTransitionWithResolution.valid).toBe(true);

        const invalidTransitionWithoutResolution = HelpDeskBusinessRules.validateStateTransition(
            TicketStatus.IN_PROGRESS,
            TicketStatus.RESOLVED,
            UserRole.IT_HELPDESK_ANALYST,
            false // no resolution
        );

        expect(invalidTransitionWithoutResolution.valid).toBe(false);
        expect(invalidTransitionWithoutResolution.error).toContain('Resolution description is required');
    });

    it('Property 6: Resolution Requirement Validation - should accept various valid resolution lengths', () => {
        const validResolutions = [
            'Fixed issue', // Minimum length (10 characters)
            'Fixed the issue by restarting the service and checking the logs',
            'A'.repeat(100), // Medium length
            'A'.repeat(1999) // Just under maximum length
        ];

        validResolutions.forEach(resolution => {
            const data = {
                resolution,
                createKnowledgeArticle: false
            };

            const result = HelpDeskValidator.validateTicketResolution(data);
            expect(result.valid).toBe(true);
            expect(result.data?.resolution).toBe(resolution);
        });
    });

    it('Property 6: Resolution Requirement Validation - should handle boolean values for createKnowledgeArticle', () => {
        const testCases = [
            { createKnowledgeArticle: true, shouldRequireTitle: true },
            { createKnowledgeArticle: false, shouldRequireTitle: false }
        ];

        testCases.forEach(({ createKnowledgeArticle, shouldRequireTitle }) => {
            const data = {
                resolution: 'Fixed the issue by restarting the service',
                createKnowledgeArticle,
                ...(shouldRequireTitle ? { knowledgeArticleTitle: 'Test Article' } : {})
            };

            const result = HelpDeskValidator.validateTicketResolution(data);
            expect(result.valid).toBe(true);
            expect(result.data?.createKnowledgeArticle).toBe(createKnowledgeArticle);
        });
    });

    it('Property 6: Resolution Requirement Validation - should default createKnowledgeArticle to false when not provided', () => {
        const data = {
            resolution: 'Fixed the issue by restarting the service'
            // createKnowledgeArticle not provided
        };

        const result = HelpDeskValidator.validateTicketResolution(data);
        expect(result.valid).toBe(true);
        expect(result.data?.createKnowledgeArticle).toBe(false);
    });
});