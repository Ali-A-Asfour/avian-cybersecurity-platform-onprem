import { NextRequest, NextResponse } from 'next/server';
import { enhancedAuthMiddleware } from '../../../../middleware/enhanced-auth.middleware';
import { SessionService } from '../../../../lib/session-service-compat';
import { AuthenticationService } from '../../../../services/auth.service';

/**
 * Check authentication status and session health
 */
export async function GET(request: NextRequest) {
  try {
    // Use enhanced auth middleware to get comprehensive status
    const authResult = await enhancedAuthMiddleware(request, {
      allowIdleTimeout: true, // Allow checking even if idle
      bypassInDevelopment: true, // Allow bypass in development mode
    });

    if (!authResult.success) {
      return NextResponse.json({
        success: true,
        data: {
          authenticated: false,
          status: 'unauthenticated',
          error: authResult.error,
          requires_reauth: authResult.requiresReauth || false,
          lockout_info: authResult.lockoutInfo,
        },
      });
    }

    const user = authResult.user!;

    // Handle development mode bypass
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
      // Check for tenant switching parameter
      const { searchParams } = new URL(request.url);
      const switchTenant = searchParams.get('switch_tenant');
      
      let currentTenantId = user.tenant_id;
      let tenantName = 'Demo Corporation';
      
      // Allow switching between different mock tenants
      if (switchTenant) {
        const tenantMap = {
          'demo': { id: 'dev-tenant-123', name: 'Demo Corporation' },
          'acme': { id: 'acme-corp-456', name: 'ACME Corporation' },
          'techstart': { id: 'techstart-789', name: 'TechStart Inc' },
          'finance': { id: 'global-finance-101', name: 'Global Finance Ltd' },
        };
        
        const selectedTenant = tenantMap[switchTenant as keyof typeof tenantMap];
        if (selectedTenant) {
          currentTenantId = selectedTenant.id;
          tenantName = selectedTenant.name;
        }
      }
      
      return NextResponse.json({
        success: true,
        data: {
          authenticated: true,
          status: 'authenticated',
          user: {
            user_id: user.user_id,
            tenant_id: currentTenantId,
            role: user.role,
            tenant_name: tenantName,
          },
          session: {
            created_at: new Date().toISOString(),
            last_activity: new Date().toISOString(),
            extended_session: false,
            remember_me: false,
            time_remaining: 3600,
            idle_time_remaining: 3600,
            needs_reauth: false,
          },
          security: {
            auth_method: 'development_bypass',
            mfa_verified: false,
            needs_new_backup_codes: false,
            remaining_backup_codes: 10,
          },
          warnings: [],
          recommendations: [],
        },
      });
    }

    // Get additional session information
    const sessionData = await SessionService.getSession(user.user_id);
    const _authStatus = await SessionService.getAuthStatus(user.user_id);
    const idleCheck = await SessionService.checkSessionIdleTimeout(user.user_id);

    // Check if user needs new backup codes
    const needsNewBackupCodes = await AuthenticationService.needsNewBackupCodes(user.user_id);
    const remainingBackupCodes = await AuthenticationService.getRemainingBackupCodesCount(user.user_id);

    // Calculate session time remaining
    const sessionCreated = sessionData ? new Date(sessionData.created_at) : new Date();
    const sessionAge = Math.floor((Date.now() - sessionCreated.getTime()) / 1000);
    const maxSessionAge = sessionData?.extended_session ? 28800 : 3600; // 8 hours or 1 hour
    const sessionTimeRemaining = Math.max(0, maxSessionAge - sessionAge);

    const responseData = {
      authenticated: true,
      status: authResult.requiresReauth ? 'needs_reauth' : 'authenticated',
      user: {
        user_id: user.user_id,
        tenant_id: user.tenant_id,
        role: user.role,
        session_id: user.session_id,
      },
      session: {
        created_at: sessionData?.created_at,
        last_activity: user.last_activity,
        extended_session: sessionData?.extended_session || false,
        remember_me: sessionData?.remember_me || false,
        time_remaining: sessionTimeRemaining,
        idle_time_remaining: idleCheck.timeRemaining || 0,
        needs_reauth: authResult.requiresReauth || false,
      },
      security: {
        auth_method: sessionData?.auth_method || 'unknown',
        mfa_verified: sessionData?.mfa_verified || false,
        needs_new_backup_codes: needsNewBackupCodes,
        remaining_backup_codes: remainingBackupCodes,
      },
      warnings: [] as string[],
      recommendations: [] as string[],
    };

    // Add warnings and recommendations
    if (authResult.requiresReauth) {
      responseData.warnings.push('Session requires re-authentication due to inactivity');
      responseData.recommendations.push('Please log in again to continue');
    }

    if (needsNewBackupCodes) {
      responseData.warnings.push('Low backup codes remaining');
      responseData.recommendations.push('Generate new backup codes for account recovery');
    }

    if (sessionTimeRemaining < 300) { // Less than 5 minutes
      responseData.warnings.push('Session will expire soon');
      responseData.recommendations.push('Save your work and refresh your session');
    }

    if (idleCheck.timeRemaining && idleCheck.timeRemaining < 300) { // Less than 5 minutes
      responseData.warnings.push('Session will timeout due to inactivity soon');
      responseData.recommendations.push('Interact with the application to maintain your session');
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });

  } catch (error) {
    console.error('Auth status check error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'AUTH_STATUS_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Failed to check authentication status',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Refresh session activity (heartbeat)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await enhancedAuthMiddleware(request, {
      bypassInDevelopment: true, // Allow bypass in development mode
    });

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: authResult.error || 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    if (authResult.requiresReauth) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'REAUTHENTICATION_REQUIRED',
            message: 'Session requires re-authentication',
          },
        },
        { status: 401 }
      );
    }

    // Update session activity
    const updated = await SessionService.updateSessionActivity(authResult.user.user_id);

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SESSION_UPDATE_FAILED',
            message: 'Failed to update session activity',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Session activity updated',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Session refresh error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SESSION_REFRESH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to refresh session',
        },
      },
      { status: 500 }
    );
  }
}