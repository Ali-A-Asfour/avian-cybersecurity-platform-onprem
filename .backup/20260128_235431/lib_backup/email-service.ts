/**
 * Email Service
 * Handles sending emails for password resets, alerts, and notifications
 */

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

/**
 * Send email (implementation depends on email provider)
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  // For development/testing, log to console
  if (process.env.NODE_ENV === 'development' || !process.env.EMAIL_ENABLED) {
    console.log('📧 Email would be sent:');
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('---');
    return;
  }

  // Production email sending
  // This can be implemented with various providers:
  // - AWS SES
  // - SendGrid
  // - Mailgun
  // - SMTP server
  
  try {
    // Example with fetch to an email API endpoint
    const response = await fetch(process.env.EMAIL_API_URL || '', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Email API error: ${response.status}`);
    }

    console.log(`✅ Email sent to ${options.to}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw new Error('Failed to send email');
  }
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

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    const html = this.generatePasswordResetHTML(data);
    const text = this.generatePasswordResetText(data);

    await sendEmail({
      to: data.email,
      subject: 'AVIAN Security - Password Reset Request',
      html,
      text,
    });
  }

  /**
   * Generate password reset HTML email
   */
  private generatePasswordResetHTML(data: PasswordResetEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #0ea5e9;
      margin-bottom: 10px;
    }
    .title {
      font-size: 24px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 20px;
    }
    .content {
      color: #4b5563;
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      background: #0ea5e9;
      color: #ffffff;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .button:hover {
      background: #0284c7;
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
      text-align: center;
    }
    .link {
      color: #0ea5e9;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🛡️ AVIAN</div>
      <div class="title">Password Reset Request</div>
    </div>
    
    <div class="content">
      <p>Hello,</p>
      
      <p>We received a request to reset the password for your AVIAN Security account associated with <strong>${data.email}</strong>.</p>
      
      <p>Click the button below to reset your password:</p>
      
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
          <li>Your password will remain unchanged until you create a new one</li>
        </ul>
      </div>
      
      <p>If you didn't request a password reset, you can safely ignore this email. Your account remains secure.</p>
    </div>
    
    <div class="footer">
      <p>This is an automated message from AVIAN Security Platform.</p>
      <p>Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} AVIAN Security. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate password reset plain text email
   */
  private generatePasswordResetText(data: PasswordResetEmailData): string {
    return `
AVIAN Security - Password Reset Request

Hello,

We received a request to reset the password for your AVIAN Security account associated with ${data.email}.

To reset your password, visit this link:
${data.resetLink}

SECURITY NOTICE:
- This link will expire in ${data.expiresInMinutes} minutes
- This link can only be used once
- If you didn't request this reset, please ignore this email
- Your password will remain unchanged until you create a new one

If you didn't request a password reset, you can safely ignore this email. Your account remains secure.

---
This is an automated message from AVIAN Security Platform.
Please do not reply to this email.

© ${new Date().getFullYear()} AVIAN Security. All rights reserved.
    `.trim();
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();
