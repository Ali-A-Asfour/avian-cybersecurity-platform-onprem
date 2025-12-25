import { NextRequest, NextResponse } from 'next/server';
// import { db } from '@/lib/database';
import { redisClient } from '@/lib/redis';

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
    await db.execute('SELECT 1');
    readinessCheck.checks.database = true;

    // Check if migrations are up to date (basic check)
    try {
      await db.execute('SELECT 1 FROM users LIMIT 1');
      readinessCheck.checks.migrations = true;
    } catch {
      readinessCheck.checks.migrations = false;
    }

    // Check Redis connection
    await redisClient.ping();
    readinessCheck.checks.redis = true;

  } catch {
    // Individual checks will remain false
  }

  // Determine overall readiness
  readinessCheck.ready = Object.values(readinessCheck.checks).every(check => check);

  const statusCode = readinessCheck.ready ? 200 : 503;
  return NextResponse.json(readinessCheck, { status: statusCode });
}