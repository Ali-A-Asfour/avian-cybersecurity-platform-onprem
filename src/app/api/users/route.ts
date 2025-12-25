import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserService } from '../../../services/user.service';

import { UserRole } from '../../../types';

// Request validation schemas
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  first_name: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(UserRole),
  tenant_id: z.string().uuid('Invalid tenant ID'),
  mfa_enabled: z.boolean().optional().default(false),
});

const listUsersSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  tenant_id: z.string().uuid().optional(),
  role: z.nativeEnum(UserRole).optional(),
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

// GET /api/users - List users
export async function GET(request: NextRequest) {
  try {
    // Authenticate and authorize
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    const _user = authResult.user;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedParams = listUsersSchema.parse(queryParams);

    // List users
    const _result = await UserService.listUsers(
      validatedParams,
      user.user_id,
      user.role,
      user.tenant_id
    );

    return NextResponse.json({
      success: true,
      data: result.users,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch {
    console.error('List users error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LIST_USERS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to list users',
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/users - Create user
export async function POST(request: NextRequest) {
  try {
    // Authenticate and authorize
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    const _user = authResult.user;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Create user
    const newUser = await UserService.createUser(
      validatedData,
      user.user_id,
      user.role,
      user.tenant_id
    );

    return NextResponse.json({
      success: true,
      data: newUser,
    }, { status: 201 });
  } catch {
    console.error('Create user error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CREATE_USER_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create user',
        },
      },
      { status: 500 }
    );
  }
}