import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * Logout user and clear session
 */
export async function POST(request: NextRequest) {
    try {
        console.log('🚪 /api/auth/logout called');
        
        // In bypass mode, just return success
        if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
            const response = NextResponse.json({
                success: true,
                message: 'Logged out successfully'
            });

            // Clear auth cookie
            response.cookies.set('auth-token', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 0 // Expire immediately
            });

            return response;
        }

        // For production mode, implement proper session cleanup
        // This would involve invalidating the session in the database
        const response = NextResponse.json({
            success: true,
            message: 'Logged out successfully'
        });

        // Clear auth cookie
        response.cookies.set('auth-token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0
        });

        return response;

    } catch (error) {
        console.error('❌ Error in /api/auth/logout:', error);
        return NextResponse.json({
            success: false,
            error: 'Logout failed'
        }, { status: 500 });
    }
}