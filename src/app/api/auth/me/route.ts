import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';

/**
 * GET /api/auth/me
 * Get current user information from session
 */
export async function GET(request: NextRequest) {
    try {
        console.log('🔍 /api/auth/me called');
        
        // Apply authentication middleware
        const authResult = await authMiddleware(request);
        if (!authResult.success) {
            console.log('❌ Auth failed:', authResult.error);
            return NextResponse.json({
                success: false,
                error: 'Authentication required'
            }, { status: 401 });
        }

        const user = authResult.user!;
        console.log('✅ User authenticated:', user);

        // In bypass mode, we need to get user details from mock store or token
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            // Try to get user details from mock store if we have an email
            if (user.email) {
                try {
                    const { findMockUserByEmail } = await import('@/lib/mock-users-store');
                    const mockUser = findMockUserByEmail(user.email);
                    
                    if (mockUser) {
                        return NextResponse.json({
                            success: true,
                            user: {
                                id: mockUser.id,
                                email: mockUser.email,
                                name: `${mockUser.firstName} ${mockUser.lastName}`,
                                role: mockUser.role,
                                tenantId: mockUser.tenantId
                            }
                        });
                    }
                } catch (error) {
                    console.log('Could not load mock user store:', error.message);
                }
            }
            
            // Fallback to user info from JWT token
            return NextResponse.json({
                success: true,
                user: {
                    id: user.user_id,
                    email: user.email || `user-${user.user_id}@demo.com`,
                    name: user.email ? user.email.split('@')[0] : `User ${user.user_id}`,
                    role: user.role,
                    tenantId: user.tenant_id
                }
            });
        }

        // For production mode, get user from database
        try {
            const { getDb } = await import('@/lib/database');
            const { users } = await import('../../../../../database/schemas/main');
            const { eq } = await import('drizzle-orm');
            
            const db = await getDb();
            const [dbUser] = await db
                .select()
                .from(users)
                .where(eq(users.id, user.user_id))
                .limit(1);

            if (!dbUser) {
                console.log('❌ User not found in database:', user.user_id);
                return NextResponse.json({
                    success: false,
                    error: 'User not found'
                }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                user: {
                    id: dbUser.id,
                    email: dbUser.email,
                    name: `${dbUser.first_name} ${dbUser.last_name}`,
                    role: dbUser.role,
                    tenantId: dbUser.tenant_id
                }
            });
        } catch (dbError) {
            console.error('❌ Database error in /api/auth/me:', dbError);
            
            // Fallback to user info from JWT token
            return NextResponse.json({
                success: true,
                user: {
                    id: user.user_id,
                    email: user.email || `user-${user.user_id}@demo.com`,
                    name: `User ${user.user_id}`,
                    role: user.role,
                    tenantId: user.tenant_id
                }
            });
        }

    } catch (error) {
        console.error('❌ Error in /api/auth/me:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 });
    }
}