import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { getRedisClient } from '@/lib/redis';

interface ReadinessCheck {
  ready: boolean;
  timestamp: string;
  checks: {
    database: boolean;
    redis: boolean;
    migrations: boolean;
  };
}

export async function GET(request: NextRequest) {
  const readinessCheck: ReadinessCheck = {
    ready: true,
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      redis: false,
      migrations: false
    }
  };

  try {
    // Check database connection
    const db = await getDb();
    await db.execute('SELECT 1');
    readinessCheck.checks.database = true;

    // Check if migrations are up to date (basic check)
    try {
      await db.execute('SELECT 1 FROM users LIMIT 1');
      readinessCheck.checks.migrations = true;
    } catch (error) {
      readinessCheck.checks.migrations = false;
    }

    // Check Redis connection
    const redis = await getRedisClient();
    await redis.ping();
    readinessCheck.checks.redis = true;

  } catch (error) {
    // Individual checks will remain false
  }

  // Determine overall readiness
  readinessCheck.ready = Object.values(readinessCheck.checks).every(check => check);

  const statusCode = readinessCheck.ready ? 200 : 503;
  return NextResponse.json(readinessCheck, { status: statusCode });
}