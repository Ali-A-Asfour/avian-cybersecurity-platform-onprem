/**
 * Optimized AWS SDK Client Factory
 * 
 * Provides singleton AWS SDK clients with optimized configuration
 * for connection pooling, timeouts, and retry behavior
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { SSMClient } from '@aws-sdk/client-ssm';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';

// Optimized HTTP handler configuration
const httpHandler = new NodeHttpHandler({
  connectionTimeout: 5000, // 5 seconds
  socketTimeout: 30000, // 30 seconds
  maxSockets: 50, // Connection pool size
  keepAlive: true,
  keepAliveMsecs: 1000,
});

// Common client configuration
const commonConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  requestHandler: httpHandler,
  maxAttempts: 3, // Retry configuration
  retryMode: 'adaptive' as const,
};

// Singleton clients with optimized configuration
let dynamoClient: DynamoDBClient | null = null;
let s3Client: S3Client | null = null;
let secretsClient: SecretsManagerClient | null = null;
let cognitoClient: CognitoIdentityProviderClient | null = null;
let ssmClient: SSMClient | null = null;

export function getDynamoDBClient(): DynamoDBClient {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient(commonConfig);
  }
  return dynamoClient;
}

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client(commonConfig);
  }
  return s3Client;
}

export function getSecretsManagerClient(): SecretsManagerClient {
  if (!secretsClient) {
    secretsClient = new SecretsManagerClient(commonConfig);
  }
  return secretsClient;
}

export function getCognitoClient(): CognitoIdentityProviderClient {
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient(commonConfig);
  }
  return cognitoClient;
}

export function getSSMClient(): SSMClient {
  if (!ssmClient) {
    ssmClient = new SSMClient(commonConfig);
  }
  return ssmClient;
}

// Cleanup function for graceful shutdown
export function closeAllClients(): void {
  dynamoClient?.destroy();
  s3Client?.destroy();
  secretsClient?.destroy();
  cognitoClient?.destroy();
  ssmClient?.destroy();
  
  dynamoClient = null;
  s3Client = null;
  secretsClient = null;
  cognitoClient = null;
  ssmClient = null;
}
