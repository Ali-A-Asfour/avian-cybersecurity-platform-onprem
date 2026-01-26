import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { UserService } from '../../../services/user.service';
import { authMiddleware } from '@/middleware/auth.middleware';
import { UserRole } from '../../../types';
import { 
  getMockUsers, 
  addMockUser, 
  findMockUserByEmail, 
  findMockUserById,
  updateMockUser,
  deleteMockUser,
  getNextMockUserId,
  type MockUser 
} from '@/lib/mock-users-store';
import { createUserRaw } from './create-raw';

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

// Helper function to filter users based on role and tenant
function filterUsersForRole(users: MockUser[], currentUserRole: string, currentUserTenantId: string) {
  return users.filter(user => {
    // Super admins can see all users
    if (currentUserRole === 'super_admin') {
      return true;
    }
    
    // Tenant admins can only see users from their own tenant
    if (currentUserRole === 'tenant_admin') {
      // Must be same tenant
      if (user.tenantId !== currentUserTenantId) {
        return false;
      }
      
      // Can only see tenant_admin and user roles (not helpdesk, security analysts, or super admins)
      return ['tenant_admin', 'user'].includes(user.role);
    }
    
    // Other roles cannot manage users
    return false;
  });
}

// Mock users for development when BYPASS_AUTH is true
let mockUsers = [
  {
    id: '1',
    email: 'admin@demo.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    tenantId: 'acme-corp', // Matches demo auth
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  },
  {
    id: '2',
    email: 'tenant.admin@demo.com',
    firstName: 'Tenant',
    lastName: 'Admin',
    role: 'tenant_admin',
    tenantId: 'acme-corp', // Matches demo auth
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  },
  {
    id: '3',
    email: 'analyst@demo.com',
    firstName: 'Security',
    lastName: 'Analyst',
    role: 'security_analyst',
    tenantId: 'acme-corp', // Matches demo auth
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  },
  {
    id: '4',
    email: 'helpdesk@demo.com',
    firstName: 'IT',
    lastName: 'Helpdesk',
    role: 'it_helpdesk_analyst',
    tenantId: 'acme-corp', // Matches demo auth
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  },
  {
    id: '5',
    email: 'user@demo.com',
    firstName: 'Demo',
    lastName: 'User',
    role: 'user',
    tenantId: 'acme-corp', // Matches demo auth
    isActive: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    lastLogin: null,
  },
];

// Request validation schemas
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  first_name: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(UserRole),
  tenant_id: z.string().uuid('Invalid tenant ID'), // Required for all roles
  mfa_enabled: z.boolean().optional().default(false),
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  first_name: z.string().min(1, 'First name is required').max(100, 'First name too long').optional(),
  last_name: z.string().min(1, 'Last name is required').max(100, 'Last name too long').optional(),
  role: z.nativeEnum(UserRole).optional(),
  is_active: z.boolean().optional(),
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
    // Check if we're in bypass mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      const currentUser = getCurrentUserFromToken(request);
      
      if (!currentUser) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }
      
      // Get users from shared store
      const allUsers = getMockUsers();
      
      // Filter users based on role and tenant
      const filteredUsers = filterUsersForRole(allUsers, currentUser.role, currentUser.tenantId);
      
      return NextResponse.json({
        success: true,
        data: filteredUsers,
        meta: {
          total: filteredUsers.length,
          page: 1,
          limit: 20,
        },
      });
    }

    // Authenticate and authorize
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    const user = authResult.user;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedParams = listUsersSchema.parse(queryParams);

    // List users
    const result = await UserService.listUsers(
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
  } catch (error) {
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
      
      // Simple validation for demo mode
      if (!body.email || !body.first_name || !body.last_name || !body.password || !body.role) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Missing required fields',
            },
          },
          { status: 400 }
        );
      }
      
      // Validate permissions based on current user role
      if (currentUser.role === 'tenant_admin') {
        // Tenant admins can only create users in their own tenant
        if (body.tenant_id && body.tenant_id !== currentUser.tenantId) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Cannot create users in other tenants',
              },
            },
            { status: 403 }
          );
        }
        
        // Tenant admins can only create tenant_admin and user roles
        if (!['tenant_admin', 'user'].includes(body.role)) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'Cannot create users with this role',
              },
            },
            { status: 403 }
          );
        }
        
        // Force the tenant ID to be the current user's tenant
        body.tenant_id = currentUser.tenantId;
      } else if (currentUser.role !== 'super_admin') {
        // Only super admins and tenant admins can create users
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions to create users',
            },
          },
          { status: 403 }
        );
      }

      // Auto-assign cross-tenant roles to default tenant if no tenant_id provided
      const isCrossTenantRole = body.role === 'security_analyst' || body.role === 'it_helpdesk_analyst';
      if (isCrossTenantRole && !body.tenant_id) {
        // Use the current user's tenant as default for cross-tenant roles
        body.tenant_id = currentUser.tenantId;
      }

      // Ensure tenant_id is set for all users (fallback to current user's tenant)
      if (!body.tenant_id) {
        body.tenant_id = currentUser.tenantId;
      }

      // Check for duplicate email
      if (findMockUserByEmail(body.email)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Email already exists',
            },
          },
          { status: 400 }
        );
      }

      // Create new mock user
      const newUser: MockUser = {
        id: getNextMockUserId(),
        email: body.email,
        firstName: body.first_name,
        lastName: body.last_name,
        role: body.role,
        tenantId: body.tenant_id || currentUser.tenantId,
        isActive: true,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        lastLogin: null,
        password: body.password, // Store password for authentication
      };

      // Add to shared store
      const createdUser = addMockUser(newUser);

      return NextResponse.json({
        success: true,
        data: createdUser,
      }, { status: 201 });
    }

    // Authenticate and authorize
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    const user = authResult.user;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Use raw SQL approach to bypass ORM issues
    try {
      const newUser = await createUserRaw(
        validatedData.email,
        validatedData.first_name,
        validatedData.last_name,
        validatedData.role,
        validatedData.tenant_id,
        validatedData.password
      );

      return NextResponse.json({
        success: true,
        data: newUser,
      }, { status: 201 });
    } catch (rawError) {
      console.error('Raw SQL user creation failed:', rawError);
      
      // Fallback to UserService if raw SQL fails
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
    }
  } catch (error) {
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

// PUT /api/users - Update user (requires user ID in query params)
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'User ID is required' } },
        { status: 400 }
      );
    }

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
      const validatedData = updateUserSchema.parse(body);
      
      // Find the user to update
      const existingUser = findMockUserById(userId);
      if (!existingUser) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
          { status: 404 }
        );
      }
      
      // Check permissions
      if (currentUser.role === 'tenant_admin') {
        // Tenant admins can only update users in their own tenant
        if (existingUser.tenantId !== currentUser.tenantId) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Cannot update users from other tenants' } },
            { status: 403 }
          );
        }
        
        // Tenant admins can only update tenant_admin and user roles
        if (validatedData.role && !['tenant_admin', 'user'].includes(validatedData.role)) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Cannot assign this role' } },
            { status: 403 }
          );
        }
        
        // Cannot update users with higher privileges
        if (!['tenant_admin', 'user'].includes(existingUser.role)) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Cannot update users with higher privileges' } },
            { status: 403 }
          );
        }
      } else if (currentUser.role !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
          { status: 403 }
        );
      }
      
      // Check for email conflicts if email is being updated
      if (validatedData.email && validatedData.email !== existingUser.email) {
        const emailExists = findMockUserByEmail(validatedData.email);
        if (emailExists) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Email already exists' } },
            { status: 400 }
          );
        }
      }
      
      // Update the user
      const updates: Partial<MockUser> = {};
      if (validatedData.email) updates.email = validatedData.email;
      if (validatedData.first_name) updates.firstName = validatedData.first_name;
      if (validatedData.last_name) updates.lastName = validatedData.last_name;
      if (validatedData.role) updates.role = validatedData.role;
      if (validatedData.is_active !== undefined) updates.isActive = validatedData.is_active;
      
      const updatedUser = updateMockUser(userId, updates);
      
      if (!updatedUser) {
        return NextResponse.json(
          { success: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update user' } },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: updatedUser,
      });
    }

    // Production mode - use UserService
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Update user via UserService
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
  } catch (error) {
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

// DELETE /api/users - Delete user (requires user ID in query params)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'User ID is required' } },
        { status: 400 }
      );
    }

    // Check if we're in bypass mode
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      const currentUser = getCurrentUserFromToken(request);
      
      if (!currentUser) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }
      
      // Find the user to delete
      const existingUser = findMockUserById(userId);
      if (!existingUser) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
          { status: 404 }
        );
      }
      
      // Check permissions
      if (currentUser.role === 'tenant_admin') {
        // Tenant admins can only delete users in their own tenant
        if (existingUser.tenantId !== currentUser.tenantId) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete users from other tenants' } },
            { status: 403 }
          );
        }
        
        // Cannot delete users with higher privileges
        if (!['tenant_admin', 'user'].includes(existingUser.role)) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete users with higher privileges' } },
            { status: 403 }
          );
        }
      } else if (currentUser.role !== 'super_admin') {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
          { status: 403 }
        );
      }
      
      // Prevent self-deletion
      if (existingUser.email === currentUser.email) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete your own account' } },
          { status: 403 }
        );
      }
      
      // Delete the user
      const deleted = deleteMockUser(userId);
      
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: { code: 'DELETE_FAILED', message: 'Failed to delete user' } },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'User deleted successfully',
      });
    }

    // Production mode - use UserService
    const authResult = await authMiddleware(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: authResult.error || 'Authentication required' } },
        { status: 401 }
      );
    }

    const user = authResult.user;

    // Delete user via UserService
    await UserService.deleteUser(
      userId,
      user.user_id,
      user.role,
      user.tenant_id
    );

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
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