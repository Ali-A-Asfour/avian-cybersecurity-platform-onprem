/**
 * Unit tests for ReportErrorHandler
 * 
 * Tests error categorization, retry mechanisms, user-friendly messaging,
 * and graceful degradation strategies.
 */

import { ReportErrorHandler, ErrorCategory, ErrorSeverity } from '../ReportErrorHandler';
import { ReportError } from '@/types/reports';

describe('ReportErrorHandler', () => {
    let errorHandler: ReportErrorHandler;

    beforeEach(() => {
        errorHandler = new ReportErrorHandler();
    });

    describe('Error Categorization', () => {
        it('should categorize database errors as DATA category', async () => {
            const error = new Error('Database connection failed');
            const context = ReportErrorHandler.createContext('test', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.category).toBe(ErrorCategory.DATA);
            expect(response.error.code).toBe('DATA_CONNECTION_ERROR');
        });

        it('should categorize template errors as GENERATION category', async () => {
            const error = new Error('Template rendering failed');
            const context = ReportErrorHandler.createContext('generateReport', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.category).toBe(ErrorCategory.GENERATION);
            expect(response.error.code).toBe('GENERATION_TEMPLATE_ERROR');
        });

        it('should categorize PDF errors as EXPORT category', async () => {
            const error = new Error('PDF generation failed');
            const context = ReportErrorHandler.createContext('exportPDF', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.category).toBe(ErrorCategory.EXPORT);
            expect(response.error.code).toBe('EXPORT_GENERAL_ERROR');
        });

        it('should categorize validation errors as VALIDATION category', async () => {
            const error = new Error('Invalid date range provided');
            const context = ReportErrorHandler.createContext('validate', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.category).toBe(ErrorCategory.VALIDATION);
            expect(response.error.code).toBe('VALIDATION_INVALID_INPUT');
        });

        it('should categorize network errors as NETWORK category', async () => {
            const error = new Error('Network timeout occurred');
            const context = ReportErrorHandler.createContext('fetchData', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.category).toBe(ErrorCategory.NETWORK);
            expect(response.error.code).toBe('NETWORK_TIMEOUT');
        });

        it('should categorize authentication errors as AUTHENTICATION category', async () => {
            const error = new Error('Authentication token expired');
            const context = ReportErrorHandler.createContext('authenticate', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.category).toBe(ErrorCategory.AUTHENTICATION);
            expect(response.error.code).toBe('AUTHENTICATION_GENERAL_ERROR');
        });

        it('should categorize authorization errors as AUTHORIZATION category', async () => {
            const error = new Error('Access denied to resource');
            const context = ReportErrorHandler.createContext('authorize', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.category).toBe(ErrorCategory.AUTHORIZATION);
            expect(response.error.code).toBe('AUTHORIZATION_ACCESS_DENIED');
        });
    });

    describe('Error Severity Assessment', () => {
        it('should assign CRITICAL severity to system failures', async () => {
            const error = new Error('System failure detected');
            const context = ReportErrorHandler.createContext('system', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.severity).toBe(ErrorSeverity.CRITICAL);
        });

        it('should assign HIGH severity to data integrity issues', async () => {
            const error = new Error('Data corruption detected');
            const context = ReportErrorHandler.createContext('dataCheck', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.severity).toBe(ErrorSeverity.HIGH);
        });

        it('should assign MEDIUM severity to generation issues', async () => {
            const error = new Error('Report generation timeout');
            const context = ReportErrorHandler.createContext('generate', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.severity).toBe(ErrorSeverity.MEDIUM);
        });

        it('should assign LOW severity to validation issues', async () => {
            const error = new Error('Invalid input format');
            const context = ReportErrorHandler.createContext('validate', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.severity).toBe(ErrorSeverity.LOW);
        });
    });

    describe('Retry Logic', () => {
        it('should identify retryable errors correctly', async () => {
            const networkError = new Error('Connection timeout');
            const context = ReportErrorHandler.createContext('network', 'tenant1');

            const response = await errorHandler.handleError(networkError, context);

            expect(response.error.retryable).toBe(true);
        });

        it('should identify non-retryable errors correctly', async () => {
            const validationError = new Error('Invalid tenant ID');
            const context = ReportErrorHandler.createContext('validate', 'tenant1');

            const response = await errorHandler.handleError(validationError, context);

            expect(response.error.retryable).toBe(false);
        });

        it('should handle retry configuration validation', () => {
            const validConfig = {
                maxAttempts: 3,
                baseDelayMs: 1000,
                maxDelayMs: 30000,
                backoffMultiplier: 2
            };

            const validation = errorHandler.validateConfiguration(validConfig);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it('should reject invalid retry configuration', () => {
            const invalidConfig = {
                maxAttempts: 15, // Too high
                baseDelayMs: 50,  // Too low
                backoffMultiplier: 10 // Too high
            };

            const validation = errorHandler.validateConfiguration(invalidConfig);

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });

    describe('User-Friendly Messages', () => {
        it('should generate appropriate message for data errors', async () => {
            const error = new Error('Insufficient data for report period');
            const context = ReportErrorHandler.createContext('generate', 'tenant1', 'user1', 'weekly');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.userMessage?.title).toBe('Data Unavailable');
            expect(response.error.details?.userMessage?.message).toContain('weekly report');
            expect(response.error.details?.userMessage?.suggestions).toBeInstanceOf(Array);
            expect(response.error.details?.userMessage?.suggestions.length).toBeGreaterThan(0);
        });

        it('should generate appropriate message for generation errors', async () => {
            const error = new Error('Template rendering failed');
            const context = ReportErrorHandler.createContext('generate', 'tenant1', 'user1', 'monthly');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.userMessage?.title).toBe('Report Generation Failed');
            expect(response.error.details?.userMessage?.message).toContain('monthly report');
            expect(response.error.details?.userMessage?.supportContact).toBeDefined();
        });

        it('should generate appropriate message for export errors', async () => {
            const error = new Error('PDF export failed');
            const context = ReportErrorHandler.createContext('export', 'tenant1', 'user1', 'quarterly');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.userMessage?.title).toBe('PDF Export Failed');
            expect(response.error.details?.userMessage?.message).toContain('quarterly report');
            expect(response.error.details?.userMessage?.documentationUrl).toBeDefined();
        });

        it('should generate appropriate message for validation errors', async () => {
            const error = new Error('Invalid date range');
            const context = ReportErrorHandler.createContext('validate', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.userMessage?.title).toBe('Invalid Request');
            expect(response.error.details?.userMessage?.suggestions).toContain('Verify that your date range is valid and not in the future');
        });

        it('should generate appropriate message for authentication errors', async () => {
            const error = new Error('Authentication required');
            const context = ReportErrorHandler.createContext('auth', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.userMessage?.title).toBe('Authentication Required');
            expect(response.error.details?.userMessage?.message).toContain('log in');
        });

        it('should generate appropriate message for authorization errors', async () => {
            const error = new Error('Access denied');
            const context = ReportErrorHandler.createContext('authorize', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.userMessage?.title).toBe('Access Denied');
            expect(response.error.details?.userMessage?.message).toContain('permission');
        });

        it('should generate appropriate message for network errors', async () => {
            const error = new Error('Connection failed');
            const context = ReportErrorHandler.createContext('network', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.userMessage?.title).toBe('Connection Issue');
            expect(response.error.details?.userMessage?.message).toContain('connectivity');
        });

        it('should generate fallback message for unknown errors', async () => {
            const error = new Error('Unknown system error');
            const context = ReportErrorHandler.createContext('unknown', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.userMessage?.title).toBe('System Error');
            expect(response.error.details?.userMessage?.message).toContain('unexpected error');
        });
    });

    describe('Error Context Creation', () => {
        it('should create proper error context with all fields', () => {
            const context = ReportErrorHandler.createContext(
                'generateReport',
                'tenant123',
                'user456',
                'weekly',
                'report789',
                'snapshot101',
                'req123',
                'Mozilla/5.0',
                '192.168.1.1'
            );

            expect(context.operation).toBe('generateReport');
            expect(context.tenantId).toBe('tenant123');
            expect(context.userId).toBe('user456');
            expect(context.reportType).toBe('weekly');
            expect(context.reportId).toBe('report789');
            expect(context.snapshotId).toBe('snapshot101');
            expect(context.requestId).toBe('req123');
            expect(context.userAgent).toBe('Mozilla/5.0');
            expect(context.ipAddress).toBe('192.168.1.1');
            expect(context.timestamp).toBeInstanceOf(Date);
        });

        it('should create minimal context with required fields only', () => {
            const context = ReportErrorHandler.createContext('test');

            expect(context.operation).toBe('test');
            expect(context.timestamp).toBeInstanceOf(Date);
            expect(context.tenantId).toBeUndefined();
            expect(context.userId).toBeUndefined();
        });
    });

    describe('ReportError Normalization', () => {
        it('should handle existing ReportError objects', async () => {
            const reportError: ReportError = {
                code: 'CUSTOM_ERROR',
                message: 'Custom error message',
                category: 'validation',
                retryable: false,
                details: { custom: 'data' }
            };

            const context = ReportErrorHandler.createContext('test');
            const response = await errorHandler.handleError(reportError, context);

            expect(response.error.code).toBe('CUSTOM_ERROR');
            expect(response.error.message).toContain('Custom error message'); // May be enhanced with user message
            expect(response.error.category).toBe('validation');
            expect(response.error.retryable).toBe(false);
        });

        it('should normalize standard Error objects', async () => {
            const standardError = new Error('Standard error message');
            standardError.name = 'CustomError';

            const context = ReportErrorHandler.createContext('test');
            const response = await errorHandler.handleError(standardError, context);

            expect(response.error.code).toBeDefined();
            expect(response.error.category).toBeDefined();
            expect(response.error.retryable).toBeDefined();
            expect(response.error.details?.originalError).toBe('CustomError');
        });
    });

    describe('Error Response Structure', () => {
        it('should create properly structured error response', async () => {
            const error = new Error('Test error');
            const context = ReportErrorHandler.createContext('test', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response).toHaveProperty('error');
            expect(response).toHaveProperty('timestamp');
            expect(response).toHaveProperty('requestId');

            expect(response.error).toHaveProperty('code');
            expect(response.error).toHaveProperty('message');
            expect(response.error).toHaveProperty('category');
            expect(response.error).toHaveProperty('retryable');
            expect(response.error).toHaveProperty('details');

            expect(response.timestamp).toBeInstanceOf(Date);
            expect(typeof response.requestId).toBe('string');
        });

        it('should include support information in error details', async () => {
            const error = new Error('Test error');
            const context = ReportErrorHandler.createContext('test', 'tenant1');

            const response = await errorHandler.handleError(error, context);

            expect(response.error.details?.supportInfo).toBeDefined();
            expect(response.error.details?.supportInfo.requestId).toBeDefined();
            expect(response.error.details?.supportInfo.timestamp).toBeDefined();
            expect(response.error.details?.supportInfo.category).toBeDefined();
        });
    });
});