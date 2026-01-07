/**
 * Email Service
 * 
 * Implements email sending using Nodemailer with SMTP
 * Supports email verification and password reset emails
 * 
 * Requirements: 10.1, 11.1
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from './config';
import { logger } from './logger';

/**
 * Email options
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email service for sending transactional emails
 */
export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Initialize email transporter
   */
  private static getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure, // true for 465, false for other ports
        auth: {
          user: config.email.user,
          pass: config.email.password,
        },
      });

      logger.info('Email transporter initialized', {
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
      });
    }

    return this.transporter;
  }

  /**
   * Send an email
   * Requirements: 10.1, 11.1
   */
  static async sendEmail(options: EmailOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      const transporter = this.getTransporter();

      const info = await transporter.sendMail({
        from: config.email.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error('Failed to send email', error instanceof Error ? error : new Error(String(error)), {
        to: options.to,
        subject: options.subject,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  /**
   * Send email verification email
   * Requirements: 10.1
   */
  static async sendVerificationEmail(
    email: string,
    verificationToken: string
  ): Promise<{ success: boolean; error?: string }> {
    const verificationUrl = `${config.app.baseUrl}/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h1 style="color: #2c3e50; margin-top: 0;">Verify Your Email Address</h1>
            <p>Thank you for registering with AVIAN Cybersecurity Platform!</p>
            <p>Please click the button below to verify your email address and activate your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #7f8c8d; font-size: 14px;">
              Or copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #3498db; word-break: break-all;">${verificationUrl}</a>
            </p>
            <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px;">
              This verification link will expire in 24 hours.
            </p>
            <p style="color: #7f8c8d; font-size: 14px;">
              If you didn't create an account with us, please ignore this email.
            </p>
          </div>
          <div style="text-align: center; color: #95a5a6; font-size: 12px;">
            <p>© ${new Date().getFullYear()} AVIAN Cybersecurity Platform. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Verify Your Email Address

Thank you for registering with AVIAN Cybersecurity Platform!

Please visit the following link to verify your email address and activate your account:

${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create an account with us, please ignore this email.

© ${new Date().getFullYear()} AVIAN Cybersecurity Platform. All rights reserved.
    `.trim();

    return await this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address - AVIAN Platform',
      html,
      text,
    });
  }

  /**
   * Send password reset email
   * Requirements: 11.1
   */
  static async sendPasswordResetEmail(
    email: string,
    resetToken: string
  ): Promise<{ success: boolean; error?: string }> {
    const resetUrl = `${config.app.baseUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h1 style="color: #2c3e50; margin-top: 0;">Reset Your Password</h1>
            <p>We received a request to reset your password for your AVIAN Cybersecurity Platform account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p style="color: #7f8c8d; font-size: 14px;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #e74c3c; word-break: break-all;">${resetUrl}</a>
            </p>
            <p style="color: #e74c3c; font-size: 14px; margin-top: 30px; font-weight: bold;">
              This password reset link will expire in 1 hour.
            </p>
            <p style="color: #7f8c8d; font-size: 14px;">
              If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </p>
            <p style="color: #7f8c8d; font-size: 14px;">
              For security reasons, we recommend changing your password if you didn't make this request.
            </p>
          </div>
          <div style="text-align: center; color: #95a5a6; font-size: 12px;">
            <p>© ${new Date().getFullYear()} AVIAN Cybersecurity Platform. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Reset Your Password

We received a request to reset your password for your AVIAN Cybersecurity Platform account.

Visit the following link to reset your password:

${resetUrl}

This password reset link will expire in 1 hour.

If you didn't request a password reset, please ignore this email and your password will remain unchanged.

For security reasons, we recommend changing your password if you didn't make this request.

© ${new Date().getFullYear()} AVIAN Cybersecurity Platform. All rights reserved.
    `.trim();

    return await this.sendEmail({
      to: email,
      subject: 'Reset Your Password - AVIAN Platform',
      html,
      text,
    });
  }

  /**
   * Send password changed notification email
   */
  static async sendPasswordChangedEmail(
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h1 style="color: #2c3e50; margin-top: 0;">Password Changed Successfully</h1>
            <p>Your password for your AVIAN Cybersecurity Platform account has been changed successfully.</p>
            <p style="color: #27ae60; font-weight: bold;">
              ✓ Your account is secure
            </p>
            <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px;">
              If you didn't make this change, please contact our support team immediately.
            </p>
          </div>
          <div style="text-align: center; color: #95a5a6; font-size: 12px;">
            <p>© ${new Date().getFullYear()} AVIAN Cybersecurity Platform. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
Password Changed Successfully

Your password for your AVIAN Cybersecurity Platform account has been changed successfully.

✓ Your account is secure

If you didn't make this change, please contact our support team immediately.

© ${new Date().getFullYear()} AVIAN Cybersecurity Platform. All rights reserved.
    `.trim();

    return await this.sendEmail({
      to: email,
      subject: 'Password Changed - AVIAN Platform',
      html,
      text,
    });
  }

  /**
   * Verify email configuration (for testing)
   */
  static async verifyConnection(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      logger.info('Email configuration verified successfully');
      return true;
    } catch (error) {
      logger.error('Email configuration verification failed', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
}
