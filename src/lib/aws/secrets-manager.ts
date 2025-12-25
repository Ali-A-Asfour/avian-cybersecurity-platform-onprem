/**
 * Copyright 2024 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * AWS Secrets Manager Client
 * 
 * Provides secure retrieval of secrets from AWS Secrets Manager with caching
 * to minimize API calls and improve performance.
 */

import {
    SecretsManagerClient,
    GetSecretValueCommand,
    GetSecretValueCommandInput,
} from '@aws-sdk/client-secrets-manager';
import { getSecretsManagerClient } from './client-factory';

// Use optimized client from factory
const client = getSecretsManagerClient();

// Cache secrets with 5-minute TTL to reduce API calls
interface CachedSecret {
    value: string;
    expiry: number;
}

const secretCache = new Map<string, CachedSecret>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieve a secret from AWS Secrets Manager
 * 
 * Implements caching to reduce API calls and improve performance.
 * Secrets are cached for 5 minutes before being refreshed.
 * 
 * @param secretName - Name or ARN of the secret
 * @returns Secret value as string
 * @throws Error if secret retrieval fails
 */
export async function getSecret(secretName: string): Promise<string> {
    // Check cache first
    const cached = secretCache.get(secretName);
    if (cached && Date.now() < cached.expiry) {
        return cached.value;
    }

    try {
        // Retrieve from Secrets Manager
        const input: GetSecretValueCommandInput = {
            SecretId: secretName,
        };

        const command = new GetSecretValueCommand(input);
        const response = await client.send(command);

        if (!response.SecretString) {
            throw new Error(`Secret ${secretName} has no string value`);
        }

        const value = response.SecretString;

        // Cache for 5 minutes
        secretCache.set(secretName, {
            value,
            expiry: Date.now() + CACHE_TTL_MS,
        });

        return value;
    } catch (error) {
        console.error(`Failed to retrieve secret ${secretName}:`, error);
        throw new Error(`Failed to retrieve secret: ${secretName}`);
    }
}

/**
 * Retrieve a JSON secret from AWS Secrets Manager
 * 
 * Parses the secret value as JSON and returns the parsed object.
 * Useful for secrets that contain structured data (e.g., API credentials).
 * 
 * @param secretName - Name or ARN of the secret
 * @returns Parsed JSON object
 * @throws Error if secret retrieval or parsing fails
 */
export async function getSecretJSON<T = Record<string, unknown>>(
    secretName: string
): Promise<T> {
    const secretString = await getSecret(secretName);

    try {
        return JSON.parse(secretString) as T;
    } catch (error) {
        console.error(`Failed to parse secret ${secretName} as JSON:`, error);
        throw new Error(`Secret ${secretName} is not valid JSON`);
    }
}

/**
 * Clear the secret cache
 * 
 * Useful for testing or when secrets are rotated and need immediate refresh.
 * In production, secrets will automatically refresh after cache TTL expires.
 */
export function clearSecretCache(): void {
    secretCache.clear();
}

/**
 * Get database credentials from Secrets Manager
 * 
 * Retrieves RDS database credentials stored by CDK during deployment.
 * 
 * @returns Database credentials object
 */
export async function getDatabaseCredentials(): Promise<{
    username: string;
    password: string;
    host: string;
    port: number;
    dbname: string;
}> {
    const secretName = process.env.DATABASE_SECRET_ARN || '/avian/database/credentials';
    return getSecretJSON(secretName);
}

/**
 * Get SonicWall API credentials from Secrets Manager
 * 
 * @returns SonicWall API credentials
 */
export async function getSonicWallCredentials(): Promise<{
    apiUrl: string;
    username: string;
    password: string;
}> {
    const secretName = process.env.SONICWALL_SECRET_ARN || '/avian/sonicwall/credentials';
    return getSecretJSON(secretName);
}

/**
 * Get Microsoft Graph API credentials from Secrets Manager
 * 
 * @returns Microsoft Graph OAuth credentials
 */
export async function getMicrosoftGraphCredentials(): Promise<{
    tenantId: string;
    clientId: string;
    clientSecret: string;
}> {
    const secretName = process.env.MICROSOFT_GRAPH_SECRET_ARN || '/avian/microsoft/credentials';
    return getSecretJSON(secretName);
}
