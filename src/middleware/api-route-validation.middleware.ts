/**
 * API Route Validation Middleware
 * 
 * Provides system-wide validation for all API routes to ensure
 * Security Incident creation workflow enforcement across all endpoints.
 * 
 * Requirements: 13.1, 13.2, 13.7, 13.9
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSystemWideIncidentCreation } from './incident-workflow.middleware';
import { logger } from '../lib/logger';

/**
 * Middleware to validate all API routes for incident creation attempts
 * This should be applied to all API routes to ensure system-wide enforcement
 */
export async function validateApiRoute(request: NextRequest): Promise<NextResponse | null> {
    try {
        // Apply system-wide incident creation validation
        const validationResult = await validateSystemWideIncidentCreation(request);

        if (!validationResult.success) {
            logger.error('API route validation failed', {
                url: request.url,
                method: request.method,
                error: validationResult.error,
                timestamp: new Date().toISOString()
            });

            return NextResponse.json(
                {
                    success: false,
                    error: validationResult.error,
                },
                { status: 403 } // Forbidden
            );
        }

        // Validation passed, allow request to continue
        return null;
    } catch (error) {
        logger.error('API route validation error', error instanceof Error ? error : new Error(String(error)), {
            url: request.url,
            method: request.method
        });

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Unable to validate API request'
                },
            },
            { status: 500 }
        );
    }
}

/**
 * Helper function to check if a request is attempting incident creation
 */
export function isIncidentCreationAttempt(request: NextRequest): boolean {
    const url = new URL(request.url);
    const method = request.method;

    if (method !== 'POST') {
        return false;
    }

    // Check for incident creation patterns
    const incidentCreationPatterns = [
        '/incidents',
        '/incident',
        'create-incident',
        'new-incident',
        'add-incident',
        'bulk-incident',
        'batch-incident'
    ];

    return incidentCreationPatterns.some(pattern =>
        url.pathname.includes(pattern) && !url.pathname.includes('/escalate')
    );
}

/**
 * Validation result for API routes
 */
export interface ApiValidationResult {
    isValid: boolean;
    error?: {
        code: string;
        message: string;
        details?: Record<string, any>;
    };
}

/**
 * Comprehensive API validation that can be used in any API route
 */
export async function validateApiRequest(request: NextRequest): Promise<ApiValidationResult> {
    try {
        const validationResult = await validateSystemWideIncidentCreation(request);

        return {
            isValid: validationResult.success,
            error: validationResult.error
        };
    } catch (error) {
        return {
            isValid: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Unable to validate API request'
            }
        };
    }
}