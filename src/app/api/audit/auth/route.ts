/**
 * Authentication Audit Log Query Endpoint
 * Provides read-only access to authentication audit logs
 * Requirements: 9.7, 9.8
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { authAuditLogs, users, tenants } from '../../../../../database/schemas/main';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';

interface AuthAuditLogQuery {
  userId?: string;
  email?: string;
  action?: string;
  result?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const query: AuthAuditLogQuery = {
      userId: searchParams.get('userId') || undefined,
      email: searchParams.get('email') || undefined,
      action: searchParams.get('action') || undefined,
      result: searchParams.get('result') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    // Validate limit
    if (query.limit && (query.limit < 1 || query.limit > 1000)) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 1000' },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Build query conditions
    const conditions = [];
    
    if (query.userId) {
      conditions.push(eq(authAuditLogs.user_id, query.userId));
    }
    
    if (query.email) {
      conditions.push(eq(authAuditLogs.email, query.email));
    }
    
    if (query.action) {
      conditions.push(eq(authAuditLogs.action, query.action));
    }
    
    if (query.result) {
      conditions.push(eq(authAuditLogs.result, query.result));
    }
    
    if (query.startDate) {
      conditions.push(gte(authAuditLogs.created_at, new Date(query.startDate)));
    }
    
    if (query.endDate) {
      conditions.push(lte(authAuditLogs.created_at, new Date(query.endDate)));
    }

    // Execute query with joins
    const logs = await db
      .select({
        id: authAuditLogs.id,
        user_id: authAuditLogs.user_id,
        email: authAuditLogs.email,
        action: authAuditLogs.action,
        result: authAuditLogs.result,
        ip_address: authAuditLogs.ip_address,
        user_agent: authAuditLogs.user_agent,
        metadata: authAuditLogs.metadata,
        created_at: authAuditLogs.created_at,
        user: {
          first_name: users.first_name,
          last_name: users.last_name,
          role: users.role,
        },
        tenant: {
          name: tenants.name,
        },
      })
      .from(authAuditLogs)
      .leftJoin(users, eq(authAuditLogs.user_id, users.id))
      .leftJoin(tenants, eq(users.tenant_id, tenants.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(authAuditLogs.created_at))
      .limit(query.limit || 100)
      .offset(query.offset || 0);

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(authAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({
      logs,
      pagination: {
        total: Number(count),
        limit: query.limit || 100,
        offset: query.offset || 0,
        hasMore: (query.offset || 0) + (query.limit || 100) < Number(count),
      },
    });
  } catch (error) {
    console.error('Error querying auth audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to query audit logs' },
      { status: 500 }
    );
  }
}
