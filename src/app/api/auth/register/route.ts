/**
 * User Registration API Endpoint
 * POST /api/auth/register
 * Part of production authentication system (Task 2.3)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { users, tenants, authAuditLogs, emailVerificationTokens } from '../../../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import { hashPassword, validatePassword } from '@/lib/password';
import crypto from 'crypto';

/**
 * Registration request body
 */
interface RegisterRequest {
    email: string;
    password: string;
    name: string;
    organization?: string;
    firstName?: string;
    lastName?: string;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

/**
 * Generate email verification token
 */
function generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Send verification email (placeholder - implement with your email service)
 */
async function sendVerificationEmail(
    email: string,
    name: string,
    token: string
): Promise<void> {
    // TODO: Implement with your email service (SendGrid, AWS SES, etc.)
    const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;

    console.log('📧 Verification email would be sent to:', email);
    console.log('🔗 Verification URL:', verificationUrl);
    console.log('👤 Name:', name);

    // In production, replace with actual email sending:
    // await emailService.send({
    //   to: email,
    //   subject: 'Verify your email address',
    //   template: 'email-verification',
    //   data: { name, verificationUrl }
    // });
}

/**
 * Log authentication event
 */
async function logAuthEvent(
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
            email,
            action,
            result,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: metadata || {},
        });
    } catch (error) {
        console.error('Failed to log auth event:', error);
        // Don't throw - logging failure shouldn't break registration
    }
}

/**
 * POST /api/auth/register
 * Register a new user
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
        let body: RegisterRequest;
        try {
            body = await req.json();
        } catch {
            await logAuthEvent(
                'unknown',
                'register',
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

        const { email, password, name, organization, firstName, lastName } = body;

        // Validate required fields
        if (!email || !password || (!name && (!firstName || !lastName))) {
            await logAuthEvent(
                email || 'unknown',
                'register',
                'failure',
                ipAddress,
                userAgent,
                { error: 'Missing required fields' }
            );
            return NextResponse.json(
                {
                    error: 'Missing required fields',
                    details: {
                        email: !email ? 'Email is required' : undefined,
                        password: !password ? 'Password is required' : undefined,
                        name: !name && (!firstName || !lastName) ? 'Name is required' : undefined,
                    },
                },
                { status: 400 }
            );
        }

        // Validate email format
        if (!isValidEmail(email)) {
            await logAuthEvent(
                email,
                'register',
                'failure',
                ipAddress,
                userAgent,
                { error: 'Invalid email format' }
            );
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Normalize email (lowercase)
        const normalizedEmail = email.toLowerCase().trim();

        // Check for duplicate email
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1);

        if (existingUser.length > 0) {
            await logAuthEvent(
                normalizedEmail,
                'register',
                'failure',
                ipAddress,
                userAgent,
                { error: 'Email already exists' }
            );
            // Generic error message to prevent user enumeration
            return NextResponse.json(
                { error: 'Registration failed. Please try again or contact support.' },
                { status: 400 }
            );
        }

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            await logAuthEvent(
                normalizedEmail,
                'register',
                'failure',
                ipAddress,
                userAgent,
                { error: 'Weak password', errors: passwordValidation.errors }
            );
            return NextResponse.json(
                {
                    error: 'Password does not meet requirements',
                    details: passwordValidation.errors,
                },
                { status: 400 }
            );
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Get or create tenant
        let tenantId: string;
        if (organization) {
            // Check if tenant exists
            const existingTenant = await db
                .select()
                .from(tenants)
                .where(eq(tenants.name, organization))
                .limit(1);

            if (existingTenant.length > 0) {
                tenantId = existingTenant[0].id;
            } else {
                // Create new tenant
                const [newTenant] = await db
                    .insert(tenants)
                    .values({
                        name: organization,
                        domain: normalizedEmail.split('@')[1], // Use email domain
                        settings: {},
                        is_active: true,
                    })
                    .returning();
                tenantId = newTenant.id;
            }
        } else {
            // Use default tenant or create one
            const defaultTenant = await db
                .select()
                .from(tenants)
                .where(eq(tenants.name, 'Default Organization'))
                .limit(1);

            if (defaultTenant.length > 0) {
                tenantId = defaultTenant[0].id;
            } else {
                const [newTenant] = await db
                    .insert(tenants)
                    .values({
                        name: 'Default Organization',
                        domain: 'localhost',
                        settings: {},
                        is_active: true,
                    })
                    .returning();
                tenantId = newTenant.id;
            }
        }

        // Determine first and last name
        let userFirstName: string;
        let userLastName: string;

        if (firstName && lastName) {
            userFirstName = firstName;
            userLastName = lastName;
        } else if (name) {
            const nameParts = name.trim().split(' ');
            userFirstName = nameParts[0];
            userLastName = nameParts.slice(1).join(' ') || nameParts[0];
        } else {
            userFirstName = 'User';
            userLastName = 'User';
        }

        // Create user
        const [newUser] = await db
            .insert(users)
            .values({
                tenant_id: tenantId,
                email: normalizedEmail,
                first_name: userFirstName,
                last_name: userLastName,
                password_hash: passwordHash,
                role: 'user', // Default role
                is_active: true,
                mfa_enabled: false,
            })
            .returning();

        // Generate email verification token
        const verificationToken = generateVerificationToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db.insert(emailVerificationTokens).values({
            user_id: newUser.id,
            token: verificationToken,
            expires_at: expiresAt,
        });

        // Send verification email
        await sendVerificationEmail(
            normalizedEmail,
            `${userFirstName} ${userLastName}`,
            verificationToken
        );

        // Log successful registration
        await logAuthEvent(
            normalizedEmail,
            'register',
            'success',
            ipAddress,
            userAgent,
            {
                userId: newUser.id,
                tenantId,
                duration: Date.now() - startTime,
            }
        );

        // Return success response (no sensitive data)
        return NextResponse.json(
            {
                success: true,
                message: 'Registration successful. Please check your email to verify your account.',
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: `${newUser.first_name} ${newUser.last_name}`,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Registration error:', error);

        // Log error
        await logAuthEvent(
            'unknown',
            'register',
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
            { error: 'Registration failed. Please try again later.' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/auth/register
 * Return registration requirements (for client-side validation)
 */
export async function GET() {
    return NextResponse.json({
        requirements: {
            email: {
                required: true,
                format: 'Valid email address',
            },
            password: {
                required: true,
                minLength: 12,
                requireUppercase: true,
                requireLowercase: true,
                requireNumber: true,
                requireSpecial: true,
                specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
            },
            name: {
                required: true,
                description: 'Full name or first and last name',
            },
            organization: {
                required: false,
                description: 'Organization name (optional)',
            },
        },
    });
}
