import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findMockUserById, updateMockUser } from '@/lib/mock-users-store';

// Helper function to get current user from demo auth token
function getCurrentUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie');
  
  let token = null;
  
  // Try to get token from Authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  // Try to get token from cookies
  if (!token && cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    token = cookies['auth-token'];
  }
  
  if (!token) return null;
  
  try {
    // Decode the base64 token (demo mode uses simple base64 encoding)
    const decoded = JSON.parse(atob(token));
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenantId,
    };
  } catch {
    return null;
  }
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/users/reset-password - Reset user password
export async function POST(request: NextRequest) {
  try {
    // Check if we're in bypass mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      const currentUser = getCurrentUserFromToken(request);
      
      if (!currentUser) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }
      
      const body = await request.json();
      const validatedData = resetPasswordSchema.parse(body);
      
      // Find the user
      const existingUser = findMockUserById(validatedData.userId);
      if (!existingUser) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
          { status: 404 }
        );
      }
      
      // Check permissions
      if (currentUser.role === 'tenant_admin') {
        // Tenant admins can only reset passwords for users in their own tenant
        if (existingUser.tenantId !== currentUser.tenantId) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Cannot reset password for users from other tenants' } },
            { status: 403 }
          );
        }
        
        // Cannot reset passwords for users with higher privileges
        if (!['tenant_admin', 'user'].includes(existingUser.role)) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Cannot reset password for users with higher privileges' } },
            { status: 403 }
          );
        }
      } else if (currentUser.role !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
          { status: 403 }
        );
      }
      
      // Update the password
      const updatedUser = updateMockUser(validatedData.userId, {
        password: validatedData.newPassword,
      });
      
      if (!updatedUser) {
        return NextResponse.json(
          { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to reset password' } },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Password reset successfully',
      });
    }

    // Production mode would integrate with actual password reset service
    return NextResponse.json(
      { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Password reset not implemented in production mode' } },
      { status: 501 }
    );
  } catch (error) {
    console.error('Reset password error:', error);

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
          code: 'RESET_PASSWORD_FAILED',
          message: error instanceof Error ? error.message : 'Failed to reset password',
        },
      },
      { status: 500 }
    );
  }
}