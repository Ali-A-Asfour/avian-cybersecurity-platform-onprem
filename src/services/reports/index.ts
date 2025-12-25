// Reports module services exports
export { ReportGenerator } from './ReportGenerator';
export { DataAggregator } from './DataAggregator';
export { TemplateEngine } from './TemplateEngine';
export { PDFGenerator } from './PDFGenerator';
export { HistoricalDataStore } from './HistoricalDataStore';
export { ReportSnapshotService } from './ReportSnapshotService';
export { AlertClassificationService } from './AlertClassificationService';

// Error handling and validation services
export { ReportErrorHandler, ErrorCategory, ErrorSeverity } from './ReportErrorHandler';
export { DataAvailabilityValidator, DataType } from './DataAvailabilityValidator';

// Export types for error handling
export type {
    RetryConfig,
    ErrorContext,
    UserErrorMessage,
    DataAvailabilityAssessment,
    DataTypeAvailability,
    DegradationStrategy,
    DatePeriod
} from './ReportErrorHandler';
export type {
    DataAvailabilityThresholds
} from './DataAvailabilityValidator';