import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserService } from '../../../../services/user.service';

import { UserRole } from '../../../../types';

// Request validation schemas
const updateUserSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100, 'First name too long').optional(),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name too long').optional(),
  role: z.nativeEnum(UserRole).optional(),
  is_active: z.boolean().optional(),
  mfa_enabled: z.boolean().optional(),
});

// GET /api/users/[id] - Get user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Validate user ID parameter
    const resolvedParams = await params;
    const _userId = resolvedParams.id;
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID',
          },
        },
        { status: 400 }
      );
    }

    // Get user
    const targetUser = await UserService.getUserById(
      userId,
      user.user_id,
      user.role,
      user.tenant_id
    );

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: targetUser,
    });
  } catch {
    console.error('Get user error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_USER_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get user',
        },
      },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Validate user ID parameter
    const resolvedParams = await params;
    const _userId = resolvedParams.id;
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID',
          },
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Update user
    const updatedUser = await UserService.updateUser(
      userId,
      validatedData,
      user.user_id,
      user.role,
      user.tenant_id
    );

    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch {
    console.error('Update user error:', error);

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
          code: 'UPDATE_USER_FAILED',
          message: error instanceof Error ? error.message : 'Failed to update user',
        },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Validate user ID parameter
    const resolvedParams = await params;
    const _userId = resolvedParams.id;
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_USER_ID',
            message: 'Invalid user ID',
          },
        },
        { status: 400 }
      );
    }

    // Delete user
    await UserService.deleteUser(
      userId,
      user.user_id,
      user.role,
      user.tenant_id
    );

    return NextResponse.json({
      success: true,
      data: { message: 'User deleted successfully' },
    });
  } catch {
    console.error('Delete user error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DELETE_USER_FAILED',
          message: error instanceof Error ? error.message : 'Failed to delete user',
        },
      },
      { status: 500 }
    );
  }
}