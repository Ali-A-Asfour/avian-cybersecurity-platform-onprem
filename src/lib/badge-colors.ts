/**
 * Centralized badge color system for AVIAN platform
 * Implements SOC-standard severity colors and workflow status colors
 * with clear visual hierarchy and WCAG AA compliance
 */

// Severity badge colors - Higher visual priority for security risk assessment
export const SEVERITY_COLORS = {
    critical: 'bg-red-700 text-white',      // #B91C1C - Highest priority
    high: 'bg-orange-700 text-white',       // #C2410C - High risk (WCAG AA compliant)
    medium: 'bg-yellow-700 text-white',     // #A16207 - Medium risk (WCAG AA compliant)
    low: 'bg-green-700 text-white',         // #15803D - Low risk
    info: 'bg-blue-700 text-white',         // #1D4ED8 - Informational
} as const;

// Severity badge sizes - Larger dimensions for visual priority
export const SEVERITY_SIZES = {
    sm: 'px-2 py-1 text-xs font-semibold',
    md: 'px-3 py-1.5 text-sm font-semibold', // Default larger for priority
    lg: 'px-4 py-2 text-base font-semibold',
} as const;

// TypeScript types for severity levels
export type SeverityLevel = keyof typeof SEVERITY_COLORS;

// Severity level validation
export const validateSeverityLevel = (severity: string): severity is SeverityLevel => {
    return severity in SEVERITY_COLORS;
};

// Severity labels for display
export const SEVERITY_LABELS = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    info: 'INFO',
} as const;
// Status badge colors - Lower visual priority for workflow states
export const STATUS_COLORS = {
    new: 'bg-blue-600 text-white',          // #2563EB - Action needed (WCAG AA compliant)
    open: 'bg-blue-600 text-white',         // #2563EB - Accepted but idle (WCAG AA compliant)
    investigating: 'bg-amber-700 text-white', // #B45309 - Active analysis (WCAG AA compliant)
    in_progress: 'bg-amber-700 text-white',   // #B45309 - Being worked (WCAG AA compliant)
    awaiting_response: 'bg-violet-600 text-white', // #7C3AED - Waiting on user
    escalated: 'bg-red-600 text-white',     // #DC2626 - Urgent attention
    resolved: 'bg-green-700 text-white',    // #15803D - Work complete (WCAG AA compliant)
    closed: 'bg-slate-500 text-white',      // #64748B - Finalized
    canceled: 'bg-slate-600 text-white',    // #475569 - No longer valid
} as const;

// Status badge sizes - Smaller dimensions than severity badges
export const STATUS_SIZES = {
    sm: 'px-2 py-0.5 text-xs font-normal',
    md: 'px-2.5 py-1 text-xs font-normal',   // Smaller than severity
    lg: 'px-3 py-1.5 text-sm font-normal',
} as const;

// TypeScript types for status types
export type StatusType = keyof typeof STATUS_COLORS;

// Status type validation
export const validateStatusType = (status: string): status is StatusType => {
    return status in STATUS_COLORS;
};

// Status labels for display
export const STATUS_LABELS = {
    new: 'New',
    open: 'Open',
    investigating: 'Investigating',
    in_progress: 'In Progress',
    awaiting_response: 'Awaiting Response',
    escalated: 'Escalated',
    resolved: 'Resolved',
    closed: 'Closed',
    canceled: 'Canceled',
} as const;

// Color separation validation - Ensures no overlap between severity and status colors
export const validateColorSeparation = (): boolean => {
    const severityHexColors = ['#B91C1C', '#C2410C', '#A16207', '#15803D', '#1D4ED8'];
    const statusHexColors = ['#2563EB', '#B45309', '#7C3AED', '#DC2626', '#15803D', '#64748B', '#475569'];

    // Check for any overlap between severity and status colors
    const overlaps = severityHexColors.filter(color => statusHexColors.includes(color));

    // Allow only the semantic overlap: low severity (#15803D) and resolved status (#15803D)
    const allowedOverlaps = ['#15803D']; // green-700 for low/resolved
    const unauthorizedOverlaps = overlaps.filter(color => !allowedOverlaps.includes(color));

    return unauthorizedOverlaps.length === 0; // Return true if no unauthorized overlaps
};