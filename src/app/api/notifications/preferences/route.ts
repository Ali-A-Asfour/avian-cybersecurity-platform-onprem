import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth.middleware';
import { tenantMiddleware } from '@/middleware/tenant.middleware';

// Mock user preferences storage (in production, this would be in the database)
const userPreferences = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { tenant } = tenantResult;
    const _user = authResult.user!;
    const preferencesKey = `${tenant!.id}:${user.user_id}`;

    // Get user preferences or return defaults
    const preferences = userPreferences.get(preferencesKey) || {
      email_enabled: true,
      push_enabled: true,
      sms_enabled: false,
      digest_frequency: 'immediate',
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      notification_types: {
        ticket_assigned: { email: true, push: true, sms: false },
        ticket_status_change: { email: true, push: false, sms: false },
        sla_breach: { email: true, push: true, sms: true },
        high_severity_alerts: { email: true, push: true, sms: false },
        compliance_updates: { email: true, push: false, sms: false },
        escalations: { email: true, push: true, sms: true },
      },
    };

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FETCH_PREFERENCES_ERROR',
          message: 'Failed to fetch notification preferences',
        },
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { tenant } = tenantResult;
    const _user = authResult.user!;
    const body = await request.json();
    const preferencesKey = `${tenant!.id}:${user.user_id}`;

    // Validate preferences structure
    const validPreferences = {
      email_enabled: typeof body.email_enabled === 'boolean' ? body.email_enabled : true,
      push_enabled: typeof body.push_enabled === 'boolean' ? body.push_enabled : true,
      sms_enabled: typeof body.sms_enabled === 'boolean' ? body.sms_enabled : false,
      digest_frequency: ['immediate', 'hourly', 'daily', 'weekly'].includes(body.digest_frequency) 
        ? body.digest_frequency 
        : 'immediate',
      quiet_hours_enabled: typeof body.quiet_hours_enabled === 'boolean' ? body.quiet_hours_enabled : false,
      quiet_hours_start: body.quiet_hours_start || '22:00',
      quiet_hours_end: body.quiet_hours_end || '08:00',
      notification_types: body.notification_types || {},
    };

    // Store preferences (in production, this would be saved to the database)
    userPreferences.set(preferencesKey, validPreferences);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Notification preferences updated successfully',
        preferences: validPreferences,
      },
    });
  } catch {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPDATE_PREFERENCES_ERROR',
          message: 'Failed to update notification preferences',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Apply authentication and tenant middleware
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const tenantResult = await tenantMiddleware(request, authResult.user!);
    if (tenantResult instanceof NextResponse) {
      return tenantResult;
    }

    const { tenant } = tenantResult;
    const _user = authResult.user!;
    const body = await request.json();

    if (body.action === 'reset_to_defaults') {
      const preferencesKey = `${tenant!.id}:${user.user_id}`;
      
      const defaultPreferences = {
        email_enabled: true,
        push_enabled: true,
        sms_enabled: false,
        digest_frequency: 'immediate',
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
        notification_types: {
          ticket_assigned: { email: true, push: true, sms: false },
          ticket_status_change: { email: true, push: false, sms: false },
          sla_breach: { email: true, push: true, sms: true },
          high_severity_alerts: { email: true, push: true, sms: false },
          compliance_updates: { email: true, push: false, sms: false },
          escalations: { email: true, push: true, sms: true },
        },
      };

      userPreferences.set(preferencesKey, defaultPreferences);

      return NextResponse.json({
        success: true,
        data: {
          message: 'Notification preferences reset to defaults',
          preferences: defaultPreferences,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_ACTION',
          message: 'Invalid action specified',
        },
      },
      { status: 400 }
    );
  } catch {
    console.error('Error processing notification preferences action:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PREFERENCES_ACTION_ERROR',
          message: 'Failed to process notification preferences action',
        },
      },
      { status: 500 }
    );
  }
}