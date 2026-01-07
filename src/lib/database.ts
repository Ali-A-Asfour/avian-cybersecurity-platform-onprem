import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { logger } from './logger';
import { config } from './config';

// Database connection configuration
let client: postgres.Sql | null = null;

// Skip database connection during build time
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Initialize database connection using DATABASE_URL with retry logic
 */
async function initializeDatabaseConnection(): Promise<postgres.Sql> {
  if (client) {
    return client;
  }

  if (isBuildTime) {
    logger.warn('Skipping database connection during build time');
    throw new Error('Database not available during build');
  }

  const maxRetries = 5;
  const baseDelay = 1000; // 1 second
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const connectionString = config.database.url;
      
      logger.info('Initializing database connection', { attempt, maxRetries });

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
      logger.info('Database connection established successfully', { attempt });

      return client;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn('Database connection attempt failed', lastError, { 
        attempt, 
        maxRetries,
        willRetry: attempt < maxRetries 
      });

      // Clean up failed client
      if (client) {
        try {
          await client.end();
        } catch (endError) {
          logger.warn('Error closing failed connection', endError instanceof Error ? endError : new Error(String(endError)));
        }
        client = null;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        logger.error('Failed to initialize database connection after all retries', lastError);
        throw lastError;
      }

      // Exponential backoff: wait before retrying
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.info('Waiting before retry', { delay, nextAttempt: attempt + 1 });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Failed to initialize database connection');
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
let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Get drizzle database instance (lazy initialization)
 */
export async function getDb() {
  if (!dbInstance) {
    const database = await getDatabase();
    dbInstance = drizzle(database, {
      logger: process.env.NODE_ENV === 'development' ? {
        logQuery: (query, params) => {
          logger.debug('Database Query', {
            query: query.replace(/\$\d+/g, '?'), // Replace parameter placeholders for logging
            paramCount: params?.length || 0,
            category: 'database',
          });
        },
      } : false,
    });
  }
  return dbInstance;
}

// Export synchronous db for backwards compatibility (will be null until initialized)
export const db = dbInstance;

/**
 * Database transaction wrapper
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
 * Database health check
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