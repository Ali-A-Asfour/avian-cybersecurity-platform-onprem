/**
 * Email Service
 * Handles sending emails via SMTP using nodemailer
 */

import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface PasswordResetEmailData {
  email: string;
  resetLink: string;
  expiresInMinutes: number;
}

// Create transporter lazily so missing config doesn't crash on import
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Send email via SMTP
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  // Dev/disabled mode - log to console only
  if (process.env.NODE_ENV === 'development' || process.env.EMAIL_ENABLED !== 'true') {
    console.log('📧 Email would be sent:');
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('---');
    return;
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP configuration missing: SMTP_HOST, SMTP_USER, SMTP_PASSWORD required');
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  console.log(`✅ Email sent to ${options.to}`);
}

export class EmailService {
  private static instance: EmailService;

  private constructor() {}

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    await sendEmail({
      to: data.email,
      subject: 'AVIAN Security - Password Reset Request',
      html: this.generatePasswordResetHTML(data),
      text: this.generatePasswordResetText(data),
    });
  }

  private generatePasswordResetHTML(data: PasswordResetEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .container { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 40px; }
    .logo { font-size: 32px; font-weight: bold; color: #0ea5e9; text-align: center; margin-bottom: 10px; }
    .title { font-size: 24px; font-weight: 600; color: #1f2937; text-align: center; margin-bottom: 20px; }
    .button { display: inline-block; background: #0ea5e9; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280; text-align: center; }
    .link { color: #0ea5e9; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🛡️ AVIAN</div>
    <div class="title">Password Reset Request</div>
    <p>Hello,</p>
    <p>We received a request to reset the password for your AVIAN Security account associated with <strong>${data.email}</strong>.</p>
    <div style="text-align: center;">
      <a href="${data.resetLink}" class="button">Reset Password</a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p class="link">${data.resetLink}</p>
    <div class="warning">
      <strong>⚠️ Security Notice:</strong>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>This link will expire in <strong>${data.expiresInMinutes} minutes</strong></li>
        <li>This link can only be used once</li>
        <li>If you didn't request this reset, please ignore this email</li>
      </ul>
    </div>
    <div class="footer">
      <p>This is an automated message from AVIAN Security Platform. Do not reply.</p>
      <p>&copy; ${new Date().getFullYear()} AVIAN Security. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`.trim();
  }

  private generatePasswordResetText(data: PasswordResetEmailData): string {
    return `AVIAN Security - Password Reset\n\nReset your password: ${data.resetLink}\n\nThis link expires in ${data.expiresInMinutes} minutes and can only be used once.\n\nIf you didn't request this, ignore this email.`;
  }
}

export const emailService = EmailService.getInstance();
