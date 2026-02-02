/**
 * Environment Configuration Validation
 * 
 * Validates required environment variables at startup
 * and provides type-safe access to configuration
 */

interface EnvironmentConfig {
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  email: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
  app: {
    nodeEnv: string;
    port: number;
    baseUrl: string;
  };
  security: {
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireLowercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSpecialChars: boolean;
    passwordHistoryCount: number;
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
    sessionTimeoutMinutes: number;
    mfaRequired: boolean;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

function validateEnvironment(): EnvironmentConfig {
  const requiredVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    database: {
      url: process.env.DATABASE_URL!,
    },
    redis: {
      url: process.env.REDIS_URL!,
    },
    jwt: {
      secret: process.env.JWT_SECRET!,
      refreshSecret: process.env.JWT_REFRESH_SECRET!,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    email: {
      host: process.env.EMAIL_HOST || 'localhost',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true',
      user: process.env.EMAIL_USER || '',
      password: process.env.EMAIL_PASSWORD || '',
      from: process.env.EMAIL_FROM || 'noreply@avian-platform.local',
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000', 10),
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    },
    security: {
      passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10),
      passwordRequireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
      passwordRequireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
      passwordRequireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
      passwordRequireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== 'false',
      passwordHistoryCount: parseInt(process.env.PASSWORD_HISTORY_COUNT || '5', 10),
      maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
      lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30', 10),
      sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60', 10),
      mfaRequired: process.env.MFA_REQUIRED === 'true',
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
  };
}

// Validate and export configuration
export const config = validateEnvironment();

// Helper functions for common checks
export const isProduction = () => config.app.nodeEnv === 'production';
export const isDevelopment = () => config.app.nodeEnv === 'development';
