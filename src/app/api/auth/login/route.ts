/**
 * User Login API Endpoint
 * POST /api/auth/login
 * Part of production authentication system (Task 2.4)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { users, authAuditLogs } from '../../../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '@/lib/password';
import { createSession, setAuthCookie } from '@/lib/jwt';

/**
 * Login request body
 */
interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Account lockout configuration
 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Log authentication event
 */
async function logAuthEvent(
  userId: string | null,
  email: string,
  action: string,
  result: string,
  ipAddress?: string,
  userAgent?: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (!db) return;

  try {
    await db.insert(authAuditLogs).values({
      user_id: userId,
      email,
      action,
      result,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error('Failed to log auth event:', error);
  }
}

/**
 * Check if account is currently locked
 * Returns true if the account is still within the lockout period
 */
function isAccountLocked(user: any): boolean {
  if (!user.locked_until) {
    return false;
  }

  const now = new Date();
  const lockedUntil = new Date(user.locked_until as string | Date);

  return lockedUntil > now;
}

/**
 * Automatically unlock account if lockout period has expired
 * This implements the time-based unlock mechanism (Task 4.1)
 */
async function unlockAccountIfExpired(userId: string, lockedUntil: Date | string | null): Promise<boolean> {
  if (!db || !lockedUntil) {
    return false;
  }

  const now = new Date();
  const lockExpiry = new Date(lockedUntil);

  // Check if the lockout period has expired
  if (lockExpiry <= now) {
    // Automatically unlock the account and reset failed attempts
    await db
      .update(users)
      .set({
        account_locked: false,
        locked_until: null,
        failed_login_attempts: 0,
        last_failed_login: null,
      })
      .where(eq(users.id, userId));

    return true; // Account was unlocked
  }

  return false; // Account is still locked
}

/**
 * Handle failed login attempt
 */
async function handleFailedLogin(
  userId: string,
  currentAttempts: number
): Promise<void> {
  if (!db) return;

  const newAttempts = currentAttempts + 1;

  if (newAttempts >= MAX_FAILED_ATTEMPTS) {
    // Lock the account
    const lockedUntil = new Date(
      Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
    );

    await db
      .update(users)
      .set({
        failed_login_attempts: newAttempts,
        locked_until: lockedUntil,
        account_locked: true,
        last_failed_login: new Date(),
      })
      .where(eq(users.id, userId));
  } else {
    // Increment failed attempts
    await db
      .update(users)
      .set({
        failed_login_attempts: newAttempts,
        last_failed_login: new Date(),
      })
      .where(eq(users.id, userId));
  }
}

/**
 * Handle successful login
 */
async function handleSuccessfulLogin(userId: string): Promise<void> {
  if (!db) return;

  await db
    .update(users)
    .set({
      failed_login_attempts: 0,
      last_failed_login: null,
      locked_until: null,
      account_locked: false,
      last_login: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    // Check database connection
    if (!db) {
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    // Parse request body
    let body: LoginRequest;
    try {
      body = await req.json();
    } catch (error) {
      await logAuthEvent(
        null,
        'unknown',
        'login',
        'failure',
        ipAddress,
        userAgent,
        { error: 'Invalid JSON' }
      );
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { email, password, rememberMe = false } = body;

    // Validate required fields
    if (!email || !password) {
      await logAuthEvent(
        null,
        email || 'unknown',
        'login',
        'failure',
        ipAddress,
        userAgent,
        { error: 'Missing credentials' }
      );
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    // Generic error message to prevent user enumeration
    const genericError = 'Invalid email or password';

    if (!user) {
      await logAuthEvent(
        null,
        normalizedEmail,
        'login',
        'failure',
        ipAddress,
        userAgent,
        { error: 'User not found' }
      );
      return NextResponse.json({ error: genericError }, { status: 401 });
    }

    // Check if account is active
    if (!user.is_active) {
      await logAuthEvent(
        user.id,
        normalizedEmail,
        'login',
        'blocked',
        ipAddress,
        userAgent,
        { error: 'Account inactive' }
      );
      return NextResponse.json(
        { error: 'Account is inactive. Please contact support.' },
        { status: 403 }
      );
    }

    // Check if account is locked and attempt automatic unlock if expired
    if (user.locked_until) {
      // Try to automatically unlock if the lockout period has expired
      const wasUnlocked = await unlockAccountIfExpired(user.id, user.locked_until);

      if (wasUnlocked) {
        // Account was automatically unlocked - log the event and allow login to proceed
        await logAuthEvent(
          user.id,
          normalizedEmail,
          'account_unlock',
          'success',
          ipAddress,
          userAgent,
          { reason: 'Lockout period expired', unlockType: 'automatic' }
        );

        // Refresh user data after unlock
        const [refreshedUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);

        // Update the user object to reflect the unlocked state
        Object.assign(user, refreshedUser);
      } else if (isAccountLocked(user)) {
        // Account is still locked - calculate remaining time and reject login
        const lockedUntil = new Date(user.locked_until as string | Date);
        const minutesRemaining = Math.ceil(
          (lockedUntil.getTime() - Date.now()) / (60 * 1000)
        );

        await logAuthEvent(
          user.id,
          normalizedEmail,
          'login',
          'blocked',
          ipAddress,
          userAgent,
          { error: 'Account locked', minutesRemaining }
        );

        return NextResponse.json(
          {
            error: `Account is locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minute(s).`,
          },
          { status: 403 }
        );
      }
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      // Handle failed login
      await handleFailedLogin(user.id, user.failed_login_attempts);

      const newAttempts = user.failed_login_attempts + 1;
      const remainingAttempts = MAX_FAILED_ATTEMPTS - newAttempts;

      await logAuthEvent(
        user.id,
        normalizedEmail,
        'login',
        'failure',
        ipAddress,
        userAgent,
        {
          error: 'Invalid password',
          failedAttempts: newAttempts,
          remainingAttempts: Math.max(0, remainingAttempts),
        }
      );

      // Provide warning if close to lockout
      if (remainingAttempts > 0 && remainingAttempts <= 2) {
        return NextResponse.json(
          {
            error: genericError,
            warning: `${remainingAttempts} attempt(s) remaining before account lockout.`,
          },
          { status: 401 }
        );
      }

      return NextResponse.json({ error: genericError }, { status: 401 });
    }

    // Check if email is verified
    if (!user.email_verified) {
      await logAuthEvent(
        user.id,
        normalizedEmail,
        'login',
        'blocked',
        ipAddress,
        userAgent,
        { error: 'Email not verified' }
      );
      return NextResponse.json(
        {
          error: 'Please verify your email address before logging in. Check your inbox for the verification link.',
          code: 'EMAIL_NOT_VERIFIED'
        },
        { status: 403 }
      );
    }

    // Password is valid - create session
    const { token, expiresAt, sessionId } = await createSession(
      user.id,
      user.email,
      user.role,
      user.tenant_id,
      ipAddress,
      userAgent,
      rememberMe
    );

    // Update user's last login and reset failed attempts
    await handleSuccessfulLogin(user.id);

    // Log successful login
    await logAuthEvent(
      user.id,
      normalizedEmail,
      'login',
      'success',
      ipAddress,
      userAgent,
      {
        sessionId,
        rememberMe,
        duration: Date.now() - startTime,
      }
    );

    // Create response with user data
    const response = NextResponse.json(
      {
        success: true,
        token, // Include token in response for API clients
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role,
          tenantId: user.tenant_id,
        },
        session: {
          expiresAt: expiresAt.toISOString(),
        },
      },
      { status: 200 }
    );

    // Set httpOnly cookie with JWT token
    response.headers.set('Set-Cookie', setAuthCookie(token, rememberMe));

    return response;
  } catch (error) {
    console.error('Login error:', error);

    // Log error
    await logAuthEvent(
      null,
      'unknown',
      'login',
      'error',
      ipAddress,
      userAgent,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      }
    );

    // Generic error message for security
    return NextResponse.json(
      { error: 'Login failed. Please try again later.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/login
 * Return login configuration (for client-side)
 */
export async function GET() {
  return NextResponse.json({
    config: {
      maxFailedAttempts: MAX_FAILED_ATTEMPTS,
      lockoutDurationMinutes: LOCKOUT_DURATION_MINUTES,
      rememberMeAvailable: true,
      rememberMeDuration: '30 days',
      normalSessionDuration: '24 hours',
    },
  });
}
