/**
 * AWS Secrets Manager Client for Microsoft Credentials
 * 
 * This module provides secure credential retrieval for Microsoft Graph API
 * authentication. Credentials are stored per-tenant in AWS Secrets Manager
 * with the naming convention: edr/tenant/{tenantId}/microsoft-credentials
 * 
 * Security Features:
 * - IAM role-based authentication (no hardcoded credentials)
 * - In-memory caching for polling cycle duration only
 * - Automatic credential refresh on expiration
 * - Audit logging via CloudTrail
 * 
 * @module secrets-manager
 */

import {
    SecretsManagerClient,
    GetSecretValueCommand,
    CreateSecretCommand,
    UpdateSecretCommand,
    DescribeSecretCommand,
    PutSecretValueCommand,
    ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager';

/**
 * Microsoft API credentials structure
 */
export interface MicrosoftCredentials {
    clientId: string;
    clientSecret: string;
    tenantId: string;
    authority?: string; // Optional: defaults to https://login.microsoftonline.com
}

/**
 * Secret metadata for tracking
 */
export interface SecretMetadata {
    secretName: string;
    createdDate?: Date;
    lastAccessedDate?: Date;
    lastChangedDate?: Date;
}

/**
 * In-memory cache for credentials during polling cycle
 * Cache is cleared after each polling execution
 */
const credentialCache = new Map<string, {
    credentials: MicrosoftCredentials;
    timestamp: number;
}>();

/**
 * Cache TTL in milliseconds (5 minutes)
 * Credentials are only cached for the duration of a polling cycle
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * AWS Secrets Manager client
 * Uses IAM role credentials from the execution environment
 */
const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Generate secret name for a tenant
 * Format: edr/tenant/{tenantId}/microsoft-credentials
 */
export function getSecretName(tenantId: string): string {
    return `edr/tenant/${tenantId}/microsoft-credentials`;
}

/**
 * Retrieve Microsoft credentials for a tenant from AWS Secrets Manager
 * 
 * This function:
 * 1. Checks in-memory cache first
 * 2. If not cached or expired, retrieves from Secrets Manager
 * 3. Caches credentials for the polling cycle duration
 * 4. Returns parsed credentials object
 * 
 * @param tenantId - The tenant UUID
 * @returns Microsoft API credentials
 * @throws Error if secret not found or invalid format
 * 
 * @example
 * ```typescript
 * const credentials = await getCredentials('123e4567-e89b-12d3-a456-426614174000');
 * console.log(credentials.clientId); // "abc123..."
 * ```
 */
export async function getCredentials(
    tenantId: string
): Promise<MicrosoftCredentials> {
    // Check cache first
    const cached = credentialCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[SecretsManager] Using cached credentials for tenant ${tenantId}`);
        return cached.credentials;
    }

    const secretName = getSecretName(tenantId);

    try {
        console.log(`[SecretsManager] Retrieving credentials for tenant ${tenantId}`);

        const command = new GetSecretValueCommand({
            SecretId: secretName,
        });

        const response = await client.send(command);

        if (!response.SecretString) {
            throw new Error(`Secret ${secretName} has no SecretString value`);
        }

        const credentials = JSON.parse(response.SecretString) as MicrosoftCredentials;

        // Validate required fields
        if (!credentials.clientId || !credentials.clientSecret || !credentials.tenantId) {
            throw new Error(
                `Invalid credentials format for ${secretName}. Required: clientId, clientSecret, tenantId`
            );
        }

        // Cache credentials
        credentialCache.set(tenantId, {
            credentials,
            timestamp: Date.now(),
        });

        console.log(`[SecretsManager] Successfully retrieved credentials for tenant ${tenantId}`);
        return credentials;
    } catch (error) {
        if (error instanceof ResourceNotFoundException) {
            throw new Error(
                `Credentials not found for tenant ${tenantId}. Secret name: ${secretName}`
            );
        }
        throw error;
    }
}

/**
 * Store or update Microsoft credentials for a tenant
 * 
 * This function:
 * 1. Checks if secret exists
 * 2. Creates new secret if not exists
 * 3. Updates existing secret if exists
 * 4. Clears cache for the tenant
 * 
 * @param tenantId - The tenant UUID
 * @param credentials - Microsoft API credentials to store
 * @returns Secret ARN
 * 
 * @example
 * ```typescript
 * await storeCredentials('123e4567-e89b-12d3-a456-426614174000', {
 *   clientId: 'abc123...',
 *   clientSecret: 'secret123...',
 *   tenantId: '987fcdeb-51a2-43f7-9876-543210fedcba'
 * });
 * ```
 */
export async function storeCredentials(
    tenantId: string,
    credentials: MicrosoftCredentials
): Promise<string> {
    const secretName = getSecretName(tenantId);

    // Validate credentials
    if (!credentials.clientId || !credentials.clientSecret || !credentials.tenantId) {
        throw new Error(
            'Invalid credentials. Required fields: clientId, clientSecret, tenantId'
        );
    }

    const secretString = JSON.stringify(credentials);

    try {
        // Check if secret exists
        const describeCommand = new DescribeSecretCommand({
            SecretId: secretName,
        });

        await client.send(describeCommand);

        // Secret exists, update it
        console.log(`[SecretsManager] Updating existing secret ${secretName}`);
        const updateCommand = new PutSecretValueCommand({
            SecretId: secretName,
            SecretString: secretString,
        });

        const response = await client.send(updateCommand);

        // Clear cache
        credentialCache.delete(tenantId);

        console.log(`[SecretsManager] Successfully updated credentials for tenant ${tenantId}`);
        return response.ARN || secretName;
    } catch (error) {
        if (error instanceof ResourceNotFoundException) {
            // Secret doesn't exist, create it
            console.log(`[SecretsManager] Creating new secret ${secretName}`);
            const createCommand = new CreateSecretCommand({
                Name: secretName,
                Description: `Microsoft Graph API credentials for tenant ${tenantId}`,
                SecretString: secretString,
                Tags: [
                    { Key: 'TenantId', Value: tenantId },
                    { Key: 'Purpose', Value: 'EDR-Integration' },
                    { Key: 'Service', Value: 'Microsoft-Graph-API' },
                ],
            });

            const response = await client.send(createCommand);

            // Clear cache
            credentialCache.delete(tenantId);

            console.log(`[SecretsManager] Successfully created credentials for tenant ${tenantId}`);
            return response.ARN || secretName;
        }
        throw error;
    }
}

/**
 * Get secret metadata without retrieving the actual credentials
 * Useful for checking if credentials exist and when they were last updated
 * 
 * @param tenantId - The tenant UUID
 * @returns Secret metadata
 * @throws Error if secret not found
 */
export async function getSecretMetadata(
    tenantId: string
): Promise<SecretMetadata> {
    const secretName = getSecretName(tenantId);

    try {
        const command = new DescribeSecretCommand({
            SecretId: secretName,
        });

        const response = await client.send(command);

        return {
            secretName,
            createdDate: response.CreatedDate,
            lastAccessedDate: response.LastAccessedDate,
            lastChangedDate: response.LastChangedDate,
        };
    } catch (error) {
        if (error instanceof ResourceNotFoundException) {
            throw new Error(
                `Credentials not found for tenant ${tenantId}. Secret name: ${secretName}`
            );
        }
        throw error;
    }
}

/**
 * Check if credentials exist for a tenant
 * 
 * @param tenantId - The tenant UUID
 * @returns true if credentials exist, false otherwise
 */
export async function credentialsExist(tenantId: string): Promise<boolean> {
    try {
        await getSecretMetadata(tenantId);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Clear the in-memory credential cache
 * Should be called after each polling cycle completes
 * 
 * @example
 * ```typescript
 * // After polling cycle
 * clearCache();
 * ```
 */
export function clearCache(): void {
    const size = credentialCache.size;
    credentialCache.clear();
    console.log(`[SecretsManager] Cleared credential cache (${size} entries)`);
}

/**
 * Clear cache for a specific tenant
 * Useful when credentials are updated
 * 
 * @param tenantId - The tenant UUID
 */
export function clearTenantCache(tenantId: string): void {
    const existed = credentialCache.delete(tenantId);
    if (existed) {
        console.log(`[SecretsManager] Cleared cache for tenant ${tenantId}`);
    }
}

/**
 * Get cache statistics for monitoring
 * 
 * @returns Cache size and tenant IDs
 */
export function getCacheStats(): { size: number; tenantIds: string[] } {
    return {
        size: credentialCache.size,
        tenantIds: Array.from(credentialCache.keys()),
    };
}
