/**
 * Report Service Integration Example
 * 
 * Demonstrates how to integrate the ReportErrorHandler and DataAvailabilityValidator
 * with existing report services for comprehensive error handling.
 * 
 * This file shows the integration pattern that should be applied to existing services.
 */

import { logger } from '@/lib/logger';
import { EnhancedDateRange, WeeklyReport, ReportError } from '@/types/reports';
import { ReportGenerator } from './ReportGenerator';
import { ReportErrorHandler, ErrorContext } from './ReportErrorHandler';
import { DataAvailabilityValidator } from './DataAvailabilityValidator';

/**
 * Enhanced Report Service with comprehensive error handling
 * 
 * This demonstrates how to wrap existing services with error handling
 * and data validation for improved reliability and user experience.
 */
export class EnhancedReportService {
    private readonly reportGenerator: ReportGenerator;
    private readonly errorHandler: ReportErrorHandler;
    private readonly dataValidator: DataAvailabilityValidator;

    constructor(
        reportGenerator: ReportGenerator,
        errorHandler: ReportErrorHandler,
        dataValidator: DataAvailabilityValidator
    ) {
        this.reportGenerator = reportGenerator;
        this.errorHandler = errorHandler;
        this.dataValidator = dataValidator;
    }

    /**
     * Generate weekly report with comprehensive error handling and data validation
     * 
     * This method demonstrates the integration pattern for all report generation methods.
     */
    async generateWeeklyReportWithValidation(
        tenantId: string,
        dateRange: EnhancedDateRange,
        generatedBy: string,
        requestId?: string,
        userAgent?: string,
        ipAddress?: string
    ): Promise<WeeklyReport> {
        const context = ReportErrorHandler.createContext(
            'generateWeeklyReport',
            tenantId,
            generatedBy,
            'weekly',
            undefined, // reportId - will be generated
            undefined, // snapshotId - will be generated
            requestId,
            userAgent,
            ipAddress
        );

        try {
            // Step 1: Validate data availability before attempting generation
            logger.info('Validating data availability for weekly report', {
                tenantId,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });

            const dataAssessment = await this.dataValidator.validateDataAvailability(
                tenantId,
                dateRange,
                'weekly'
            );

            // Step 2: Handle insufficient data scenarios
            if (!dataAssessment.isAvailable) {
                const dataGapMessage = this.dataValidator.generateDataGapMessage(dataAssessment);

                logger.warn('Insufficient data for weekly report generation', {
                    tenantId,
                    overallScore: dataAssessment.overallScore,
                    estimatedQuality: dataAssessment.estimatedReportQuality,
                    missingDataPeriods: dataAssessment.missingDataPeriods.length,
                    category: 'reports'
                });

                // Create a data availability error
                const dataError: ReportError = {
                    code: 'DATA_INSUFFICIENT_FOR_REPORT',
                    message: 'Insufficient data available for report generation',
                    category: 'data',
                    retryable: false,
                    details: {
                        dataAssessment,
                        dataGapMessage,
                        degradationStrategy: dataAssessment.degradationStrategy
                    }
                };

                const errorResponse = await this.errorHandler.handleError(dataError, context);
                throw new Error(errorResponse.error.message);
            }

            // Step 3: Log data quality warnings if applicable
            if (dataAssessment.estimatedReportQuality === 'fair' || dataAssessment.estimatedReportQuality === 'poor') {
                logger.warn('Report will be generated with data quality limitations', {
                    tenantId,
                    estimatedQuality: dataAssessment.estimatedReportQuality,
                    overallScore: dataAssessment.overallScore,
                    recommendations: dataAssessment.recommendations,
                    category: 'reports'
                });
            }

            // Step 4: Attempt report generation with error handling
            const report = await this.reportGenerator.generateWeeklyReport(tenantId, dateRange, generatedBy);

            logger.info('Weekly report generated successfully with validation', {
                reportId: report.id,
                tenantId,
                dataQuality: dataAssessment.estimatedReportQuality,
                overallScore: dataAssessment.overallScore,
                category: 'reports'
            });

            return report;

        } catch (error) {
            // Step 5: Handle any errors that occur during generation
            logger.error('Weekly report generation failed', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                generatedBy,
                dateRange: { start: dateRange.startDate, end: dateRange.endDate },
                category: 'reports'
            });

            // Use error handler to process and categorize the error
            const errorResponse = await this.errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                context
            );

            // Re-throw with enhanced error information
            const enhancedError = new Error(errorResponse.error.message);
            (enhancedError as any).code = errorResponse.error.code;
            (enhancedError as any).category = errorResponse.error.category;
            (enhancedError as any).retryable = errorResponse.error.retryable;
            (enhancedError as any).requestId = errorResponse.requestId;
            (enhancedError as any).userMessage = errorResponse.error.details?.userMessage;

            throw enhancedError;
        }
    }

    /**
     * Validate report generation parameters with enhanced validation
     * 
     * This method shows how to integrate data validation with parameter validation.
     */
    async validateReportParameters(
        tenantId: string,
        dateRange: EnhancedDateRange,
        reportType: 'weekly' | 'monthly' | 'quarterly',
        userId?: string
    ): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
        dataAssessment?: any;
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Basic parameter validation
            if (!tenantId || typeof tenantId !== 'string') {
                errors.push('Valid tenant ID is required');
            }

            if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
                errors.push('Valid date range is required');
            }

            if (dateRange && dateRange.startDate >= dateRange.endDate) {
                errors.push('Start date must be before end date');
            }

            if (dateRange && !dateRange.timezone) {
                errors.push('Timezone is required for proper date handling');
            }

            // If basic validation fails, don't proceed with data validation
            if (errors.length > 0) {
                return { isValid: false, errors, warnings };
            }

            // Enhanced data availability validation
            const dataAssessment = await this.dataValidator.validateDataAvailability(
                tenantId,
                dateRange,
                reportType
            );

            // Add data-related warnings
            if (!dataAssessment.isAvailable) {
                errors.push('Insufficient data available for report generation');
            } else if (dataAssessment.estimatedReportQuality === 'poor') {
                warnings.push('Report quality may be limited due to data gaps');
            } else if (dataAssessment.estimatedReportQuality === 'fair') {
                warnings.push('Some data limitations may affect report completeness');
            }

            // Add specific recommendations as warnings
            dataAssessment.recommendations.forEach(recommendation => {
                warnings.push(recommendation);
            });

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                dataAssessment
            };

        } catch (error) {
            logger.error('Failed to validate report parameters', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                reportType,
                category: 'reports'
            });

            errors.push('Unable to validate report parameters due to system error');
            return { isValid: false, errors, warnings };
        }
    }

    /**
     * Get data availability status for UI display
     * 
     * This method provides data availability information for the frontend
     * to show users what data is available before they attempt report generation.
     */
    async getDataAvailabilityStatus(
        tenantId: string,
        dateRange: EnhancedDateRange,
        reportType: 'weekly' | 'monthly' | 'quarterly'
    ): Promise<{
        available: boolean;
        quality: string;
        score: number;
        message: string;
        recommendations: string[];
        canGenerate: boolean;
        degradationInfo?: any;
    }> {
        try {
            const assessment = await this.dataValidator.validateDataAvailability(
                tenantId,
                dateRange,
                reportType
            );

            const message = this.dataValidator.generateDataGapMessage(assessment);

            return {
                available: assessment.isAvailable,
                quality: assessment.estimatedReportQuality,
                score: assessment.overallScore,
                message,
                recommendations: assessment.recommendations,
                canGenerate: assessment.isAvailable || assessment.degradationStrategy?.strategy !== 'skip',
                degradationInfo: assessment.degradationStrategy
            };

        } catch (error) {
            logger.error('Failed to get data availability status', error instanceof Error ? error : new Error(String(error)), {
                tenantId,
                reportType,
                category: 'reports'
            });

            return {
                available: false,
                quality: 'unknown',
                score: 0,
                message: 'Unable to assess data availability due to system error',
                recommendations: ['Contact support for assistance'],
                canGenerate: false
            };
        }
    }
}

/**
 * Factory function to create enhanced report service with all dependencies
 */
export function createEnhancedReportService(
    reportGenerator: ReportGenerator,
    historicalDataStore: any // HistoricalDataStore type
): EnhancedReportService {
    const errorHandler = new ReportErrorHandler();
    const dataValidator = new DataAvailabilityValidator(historicalDataStore);

    return new EnhancedReportService(
        reportGenerator,
        errorHandler,
        dataValidator
    );
}

/**
 * Example usage in API endpoints
 * 
 * This shows how the enhanced service would be used in actual API routes.
 */
export class ReportAPIIntegrationExample {
    private enhancedReportService: EnhancedReportService;

    constructor(enhancedReportService: EnhancedReportService) {
        this.enhancedReportService = enhancedReportService;
    }

    /**
     * Example API endpoint handler with comprehensive error handling
     */
    async handleWeeklyReportRequest(
        tenantId: string,
        dateRange: EnhancedDateRange,
        userId: string,
        requestId: string,
        userAgent?: string,
        ipAddress?: string
    ): Promise<{
        success: boolean;
        data?: WeeklyReport;
        error?: {
            code: string;
            message: string;
            userMessage?: any;
            retryable?: boolean;
            requestId: string;
        };
    }> {
        try {
            // First, validate parameters and data availability
            const validation = await this.enhancedReportService.validateReportParameters(
                tenantId,
                dateRange,
                'weekly',
                userId
            );

            if (!validation.isValid) {
                return {
                    success: false,
                    error: {
                        code: 'VALIDATION_FAILED',
                        message: validation.errors.join(', '),
                        retryable: false,
                        requestId
                    }
                };
            }

            // Generate the report with comprehensive error handling
            const report = await this.enhancedReportService.generateWeeklyReportWithValidation(
                tenantId,
                dateRange,
                userId,
                requestId,
                userAgent,
                ipAddress
            );

            return {
                success: true,
                data: report
            };

        } catch (error: any) {
            // The enhanced service provides structured error information
            return {
                success: false,
                error: {
                    code: error.code || 'UNKNOWN_ERROR',
                    message: error.message,
                    userMessage: error.userMessage,
                    retryable: error.retryable || false,
                    requestId: error.requestId || requestId
                }
            };
        }
    }
}