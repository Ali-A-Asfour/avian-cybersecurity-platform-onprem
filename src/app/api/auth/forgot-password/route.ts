/**
 * Forgot Password API
 * Handles password reset requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { users } from '../../../../../database/schemas/main';
import { passwordResetTokens } from '../../../../../database/schemas/password-reset';
import { eq, and, gt } from 'drizzle-orm';
import { emailService } from '@/lib/email-service';
import crypto from 'crypto';

const RESET_TOKEN_EXPIRY_MINUTES = 30;
const MAX_RESET_REQUESTS_PER_HOUR = 3;

/**
 * POST /api/auth/forgot-password
 * Request a password reset
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate input
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Email is required',
          },
        },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const userResults = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    // Always return success to prevent email enumeration
    // Even if user doesn't exist, we return success
    if (userResults.length === 0) {
      console.log(`Password reset requested for non-existent email: ${normalizedEmail}`);
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    const user = userResults[0];

    // Check if account is locked
    if (user.account_locked) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Check if account is active
    if (!user.is_active) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Rate limiting: Check recent reset requests
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTokens = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          gt(passwordResetTokens.createdAt, oneHourAgo)
        )
      );

    if (recentTokens.length >= MAX_RESET_REQUESTS_PER_HOUR) {
      console.log(`Rate limit exceeded for password reset: ${normalizedEmail}`);
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Get client IP and user agent for security logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Store reset token
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
      used: false,
      ipAddress,
      userAgent,
    });

    // Generate reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`;
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail({
        email: normalizedEmail,
        resetLink,
        expiresInMinutes: RESET_TOKEN_EXPIRY_MINUTES,
      });

      console.log(`Password reset email sent to: ${normalizedEmail}`);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      // Don't reveal email sending failure to user
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });

  } catch (error) {
    console.error('Error in POST /api/auth/forgot-password:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred processing your request',
        },
      },
      { status: 500 }
    );
  }
}
