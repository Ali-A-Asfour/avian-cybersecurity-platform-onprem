import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { logger } from './logger';
import { getSecret } from './aws/secrets-manager';

// Database connection configuration with AWS Secrets Manager integration
let connectionString: string | null = null;
let client: postgres.Sql | null = null;

// Skip database connection during build time
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Initialize database connection using AWS Secrets Manager
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
      
      const secret = await getSecret(databaseSecretArn);
      const { username, password, host, port = 5432, dbname } = JSON.parse(secret);
      
      connectionString = `postgresql://${username}:${password}@${host}:${port}/${dbname}?sslmode=require`;
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
export const db = {
  async query(sql: any, params?: any[]) {
    const database = await getDatabase();
    return database(sql, params);
  },
  
  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const database = await getDatabase();
    return database.begin(callback);
  },

  // Add other drizzle methods as needed
  select: async (table: any) => {
    const database = await getDatabase();
    return drizzle(database).select().from(table);
  },

  insert: async (table: any) => {
    const database = await getDatabase();
    return drizzle(database).insert(table);
  },

  update: async (table: any) => {
    const database = await getDatabase();
    return drizzle(database).update(table);
  },

  delete: async (table: any) => {
    const database = await getDatabase();
    return drizzle(database).delete().from(table);
  }
};

/**
 * Database transaction wrapper with AWS integration
 */
export async function withTransaction<T>(
  callback: (tx: any) => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  try {
    const database = await getDatabase();
    
    const result = await database.begin(async (tx) => {
      return await callback(drizzle(tx));
    });

    const duration = Date.now() - startTime;
    logger.debug('Database transaction completed', { duration });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Database transaction failed', error instanceof Error ? error : new Error(String(error)), { duration });
    throw error;
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
    logger.error('Database health check failed', error instanceof Error ? error : new Error(String(error)));
    return {
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Keep existing SafeQueryBuilder class
export class SafeQueryBuilder {
  static validateTableName(tableName: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName);
  }

  static validateColumnName(columnName: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(columnName);
  }

  static sanitizeOrderBy(orderBy: string): string {
    const sanitized = orderBy.replace(/[^a-zA-Z0-9_.\s]/g, '');
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

  static validateLimit(limit: any): number {
    const numLimit = parseInt(limit, 10);
    if (isNaN(numLimit) || numLimit < 0 || numLimit > 10000) {
      throw new Error('Invalid LIMIT value');
    }
    return numLimit;
  }

  static validateOffset(offset: any): number {
    const numOffset = parseInt(offset, 10);
    if (isNaN(numOffset) || numOffset < 0) {
      throw new Error('Invalid OFFSET value');
    }
    return numOffset;
  }
}

// Export for direct access if needed
export async function getClient() {
  return await getDatabase();
}
