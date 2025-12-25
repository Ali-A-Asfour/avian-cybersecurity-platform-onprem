import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { logger } from './logger';
import { getDatabaseCredentials } from './aws/parameter-store';

// Database connection configuration with AWS Secrets Manager integration
let connectionString: string | null = null;
let client: postgres.Sql | null = null;

// Skip database connection during build time
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Initialize database connection using AWS Secrets Manager or local DATABASE_URL
 */
async function initializeDatabaseConnection(): Promise<postgres.Sql> {
  if (client) {
    return client;
  }

  if (isBuildTime) {
    logger.warn('Skipping database connection during build time');
    throw new Error('Database not available during build');
  }

  try {
    // Check if we're in AWS environment (has DATABASE_SECRET_ARN)
    const databaseSecretArn = process.env.DATABASE_SECRET_ARN;
    
    if (databaseSecretArn) {
      // AWS environment - use Secrets Manager
      logger.info('Initializing database connection with AWS Secrets Manager');
      
      const credentials = await getDatabaseCredentials();
      connectionString = `postgresql://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.dbname}?sslmode=require`;
    } else if (process.env.DATABASE_URL) {
      // Local development - use DATABASE_URL
      logger.info('Using DATABASE_URL for local development');
      connectionString = process.env.DATABASE_URL;
    } else {
      throw new Error('No database configuration found. Set DATABASE_SECRET_ARN (AWS) or DATABASE_URL (local)');
    }

    // Validate connection string format
    if (!connectionString.match(/^postgresql:\/\/[^\/]+\/[^\/\s]+/)) {
      throw new Error('Invalid database connection string format');
    }

    // Create postgres client with security configurations
    client = postgres(connectionString, {
      max: 10, // Connection pool size
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
      prepare: true, // Use prepared statements
      transform: {
        undefined: null, // Convert undefined to null
      },
      onnotice: (notice) => {
        logger.warn('Database notice', { notice: notice.message });
      },
    });

    // Test the connection
    await client`SELECT 1 as connection_test`;
    logger.info('Database connection established successfully');

    return client;
  } catch (error) {
    logger.error('Failed to initialize database connection', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Get database connection (lazy initialization)
 */
async function getDatabase() {
  if (!client) {
    client = await initializeDatabaseConnection();
  }
  return client;
}

// Create drizzle instance with lazy initialization
export const db = client ? drizzle(client, {
  logger: process.env.NODE_ENV === 'development' ? {
    logQuery: (query, params) => {
      logger.debug('Database Query', {
        query: query.replace(/\$\d+/g, '?'), // Replace parameter placeholders for logging
        paramCount: params?.length || 0,
        category: 'database',
      });
    },
  } : false,
}) : null;

/**
 * Database transaction wrapper with AWS integration
 */
export async function withTransaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const database = await getDatabase();
    
    const result = await database.begin(async (tx) => {
      const drizzleTx = drizzle(tx);
      return await callback(drizzleTx as any);
    });

    const duration = Date.now() - startTime;
    logger.debug('Database transaction completed', { duration, category: 'database' });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Database transaction failed', error instanceof Error ? error : new Error(String(error)), { duration, category: 'database' });
    throw error;
  }
}

/**
 * Safe query builder that prevents SQL injection
 */
export class SafeQueryBuilder {
  /**
   * Validate table name to prevent SQL injection
   */
  static validateTableName(tableName: string): boolean {
    // Only allow alphanumeric characters and underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName);
  }

  /**
   * Validate column name to prevent SQL injection
   */
  static validateColumnName(columnName: string): boolean {
    // Only allow alphanumeric characters, underscores, and dots (for joins)
    return /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(columnName);
  }

  /**
   * Sanitize ORDER BY clause
   */
  static sanitizeOrderBy(orderBy: string): string {
    // Remove any non-alphanumeric characters except underscore, dot, and space
    const sanitized = orderBy.replace(/[^a-zA-Z0-9_.\s]/g, '');

    // Validate that it only contains valid column names and ASC/DESC
    const parts = sanitized.split(/\s+/);
    for (let i = 0; i < parts.length; i += 2) {
      if (!this.validateColumnName(parts[i])) {
        throw new Error(`Invalid column name in ORDER BY: ${parts[i]}`);
      }
      if (parts[i + 1] && !['ASC', 'DESC'].includes(parts[i + 1].toUpperCase())) {
        throw new Error(`Invalid sort direction: ${parts[i + 1]}`);
      }
    }

    return sanitized;
  }

  /**
   * Validate LIMIT value
   */
  static validateLimit(limit: any): number {
    const numLimit = parseInt(limit, 10);
    if (isNaN(numLimit) || numLimit < 0 || numLimit > 10000) {
      throw new Error('Invalid LIMIT value');
    }
    return numLimit;
  }

  /**
   * Validate OFFSET value
   */
  static validateOffset(offset: any): number {
    const numOffset = parseInt(offset, 10);
    if (isNaN(numOffset) || numOffset < 0) {
      throw new Error('Invalid OFFSET value');
    }
    return numOffset;
  }
}

/**
 * Database health check with AWS integration
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const database = await getDatabase();
    await database`SELECT 1 as health_check`;

    const latency = Date.now() - startTime;
    return { healthy: true, latency };
  } catch (error) {
    logger.error('Database health check failed', error instanceof Error ? error : new Error(String(error)), { category: 'database' });
    return {
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Export client getter for direct access if needed
export async function getClient() {
  return await getDatabase();
}