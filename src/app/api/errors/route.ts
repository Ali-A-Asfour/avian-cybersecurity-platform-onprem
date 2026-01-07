import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/database';
import { authenticateRequest } from '@/middleware/auth.middleware';

/**
 * GET /api/errors
 * 
 * Returns recent errors with filtering and pagination
 * Requires super admin authentication
 */
export async function GET(request: NextRequest) {
  // Authenticate request
  const authResult = await authenticateRequest(request);
  if (!authResult.authenticated || !authResult.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Only allow super admins to view errors
  if (authResult.user.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Forbidden - Super admin access required' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const errorType = searchParams.get('error_type');
    const userId = searchParams.get('user_id');
    const tenantId = searchParams.get('tenant_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const client = await getClient();

    // Build query with filters
    let query = `
      SELECT 
        et.id,
        et.error_type,
        et.error_message,
        et.error_stack,
        et.context,
        et.request_id,
        et.created_at,
        u.email as user_email,
        t.name as tenant_name
      FROM error_tracking et
      LEFT JOIN users u ON et.user_id = u.id
      LEFT JOIN tenants t ON et.tenant_id = t.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (errorType) {
      query += ` AND et.error_type = $${paramIndex}`;
      params.push(errorType);
      paramIndex++;
    }

    if (userId) {
      query += ` AND et.user_id = $${paramIndex}`;
      params.push(parseInt(userId));
      paramIndex++;
    }

    if (tenantId) {
      query += ` AND et.tenant_id = $${paramIndex}`;
      params.push(parseInt(tenantId));
      paramIndex++;
    }

    query += ` ORDER BY et.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM error_tracking et WHERE 1=1`;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (errorType) {
      countQuery += ` AND et.error_type = $${countParamIndex}`;
      countParams.push(errorType);
      countParamIndex++;
    }

    if (userId) {
      countQuery += ` AND et.user_id = $${countParamIndex}`;
      countParams.push(parseInt(userId));
      countParamIndex++;
    }

    if (tenantId) {
      countQuery += ` AND et.tenant_id = $${countParamIndex}`;
      countParams.push(parseInt(tenantId));
      countParamIndex++;
    }

    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      success: true,
      data: {
        errors: result.rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching errors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch errors' },
      { status: 500 }
    );
  }
}
