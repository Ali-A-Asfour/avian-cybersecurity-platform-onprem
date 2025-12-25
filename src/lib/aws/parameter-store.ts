/**
 * AWS Systems Manager Parameter Store Client
 * 
 * Cost-optimized replacement for Secrets Manager
 * Uses SecureString parameters with KMS encryption
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { getSSMClient } from './client-factory';

const ssmClient = getSSMClient();

interface DatabaseCredentials {
  username: string;
  password: string;
  host: string;
  port: string;
  database: string;
}

// Cache for 5 minutes to reduce API calls
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get database credentials from Parameter Store
 */
export async function getDatabaseCredentials(): Promise<DatabaseCredentials> {
  const parameterName = `/avian/${process.env.NODE_ENV || 'dev'}/database/credentials`;
  
  // Check cache first
  const cached = cache.get(parameterName);
  if (cached && Date.now() < cached.expires) {
    return cached.data;
  }

  try {
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true, // Decrypt SecureString parameter
    });

    const response = await ssmClient.send(command);
    
    if (!response.Parameter?.Value) {
      throw new Error(`Parameter ${parameterName} not found`);
    }

    const credentials = JSON.parse(response.Parameter.Value) as DatabaseCredentials;
    
    // Cache the result
    cache.set(parameterName, {
      data: credentials,
      expires: Date.now() + CACHE_TTL,
    });

    return credentials;
  } catch (error) {
    console.error('Failed to get database credentials from Parameter Store:', error);
    throw error;
  }
}
