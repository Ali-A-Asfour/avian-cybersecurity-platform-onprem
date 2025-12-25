/**
 * Environment Configuration Validation
 * 
 * Validates required environment variables at startup
 * and provides type-safe access to configuration
 */

interface EnvironmentConfig {
  aws: {
    region: string;
    cognitoRegion: string;
    cognitoUserPoolId: string;
    cognitoClientId: string;
  };
  database: {
    secretName: string;
  };
  dynamodb: {
    sessionsTable: string;
  };
  s3: {
    firewallConfigBucket: string;
    reportsBucket: string;
    legacyBucket: string;
  };
  app: {
    nodeEnv: string;
    disableAuth: boolean;
  };
}

function validateEnvironment(): EnvironmentConfig {
  const requiredVars = [
    'AWS_REGION',
    'DYNAMODB_SESSIONS_TABLE',
    'S3_FIREWALL_CONFIG_BUCKET',
    'S3_REPORTS_BUCKET',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    aws: {
      region: process.env.AWS_REGION!,
      cognitoRegion: process.env.NEXT_PUBLIC_COGNITO_REGION || process.env.AWS_REGION!,
      cognitoUserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      cognitoClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
    },
    database: {
      secretName: process.env.DATABASE_SECRET_NAME || `avian-database-credentials-${process.env.NODE_ENV || 'dev'}`,
    },
    dynamodb: {
      sessionsTable: process.env.DYNAMODB_SESSIONS_TABLE!,
    },
    s3: {
      firewallConfigBucket: process.env.S3_FIREWALL_CONFIG_BUCKET!,
      reportsBucket: process.env.S3_REPORTS_BUCKET!,
      legacyBucket: process.env.AWS_S3_BUCKET || process.env.S3_REPORTS_BUCKET!,
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      disableAuth: process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true',
    },
  };
}

// Validate and export configuration
export const config = validateEnvironment();

// Helper functions for common checks
export const isProduction = () => config.app.nodeEnv === 'production';
export const isDevelopment = () => config.app.nodeEnv === 'development';
export const isAuthDisabled = () => config.app.disableAuth;
