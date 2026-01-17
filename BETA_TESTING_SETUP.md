# Beta Testing Setup Guide - Skip Email for Now

## ✅ What's Ready for Beta Testing

All 7 required features are complete and ready for testing:

1. ✅ **Password Reset Flow** - Working (uses console logging instead of email)
2. ✅ **Account Lockout** - Working (5 failed attempts = 15min lockout)
3. ✅ **Session Management** - Working (24-hour sessions)
4. ✅ **Session Timeout Warning** - Working (5-minute warning modal)
5. ✅ **Alert Acknowledgment** - Working (acknowledge button, filters)
6. ✅ **Basic Ticketing System** - Working (full ticketing workflow)
7. ✅ **Notification System** - Working (console logging, SMS optional)

---

## 🚀 Quick Setup (No Email Required)

### 1. Environment Configuration

Create `.env.local` with minimal configuration:

```bash
# Database
DATABASE_URL="your-database-url"

# Authentication
JWT_SECRET="your-jwt-secret-here"
NEXTAUTH_SECRET="your-nextauth-secret-here"

# Application
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Notifications (console logging only for now)
EMAIL_ENABLED="false"
SMS_ENABLED="false"

# Optional: Enable SMS for critical alerts
# SMS_ENABLED="true"
# TWILIO_ACCOUNT_SID="your-twilio-sid"
# TWILIO_AUTH_TOKEN="your-twilio-token"
# TWILIO_PHONE_NUMBER="+15551234567"
```

### 2. Database Setup

Run the migration to create notification tables:
```bash
npm run db:push
```

### 3. Start the Application

```bash
npm run dev
```

---

## 📱 Optional: SMS Setup (Recommended for Critical Alerts)

If you want SMS notifications for critical alerts:

### 1. Create Free Twilio Account
- Go to https://www.twilio.com/try-twilio
- Sign up (no credit card required)
- Get $15 free credit

### 2. Get Credentials
- Go to https://console.twilio.com/
- Copy Account SID
- Copy Auth Token  
- Get a phone number

### 3. Update Environment
```bash
SMS_ENABLED="true"
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+15551234567"
```

### 4. Verify Your Phone
- In Twilio console, add your phone number as verified
- This allows SMS delivery during trial period

---

## 🧪 Testing Features

### 1. Password Reset (Console Logging)
1. Go to `/forgot-password`
2. Enter email address
3. Check server console for "reset link"
4. Copy the reset link from console
5. Visit the link to reset password

**Expected**: Console shows email content instead of sending actual email

### 2. Account Lockout
1. Go to `/login`
2. Enter wrong password 5 times
3. Account gets locked for 15 minutes
4. Try logging in - should show lockout message

**Expected**: Clear lockout message, automatic unlock after 15 minutes

### 3. Session Timeout Warning
1. Log in successfully
2. Wait for session to approach expiration (or modify JWT expiration for testing)
3. Warning modal appears 5 minutes before expiration
4. Can extend session or logout

**Expected**: Beautiful modal with countdown timer

### 4. Alert Acknowledgment
1. Go to `/alerts`
2. See list of alerts with "Acknowledge" buttons
3. Click acknowledge on an alert
4. Alert shows green "Ack" badge
5. Use filters to show acknowledged/unacknowledged

**Expected**: Acknowledgment status tracked, filters work

### 5. Notification System
1. Create a test alert (via API or database)
2. Check server console for notification logs
3. Go to `/settings/notifications` to configure preferences
4. Create another alert
5. Verify notification respects preferences

**Expected**: Console shows email/SMS content, preferences respected

### 6. Ticketing System
1. Go to `/tickets` or `/help-desk/tickets/new`
2. Create a new ticket
3. Assign to a user
4. Add comments
5. Update status

**Expected**: Full ticketing workflow works

---

## 📊 What You'll See in Console

### Password Reset
```
📧 Email would be sent (EMAIL_ENABLED=false):
To: user@example.com
Subject: AVIAN Security - Password Reset Request
---
Reset Link: http://localhost:3000/reset-password?token=abc123...
```

### Alert Notifications
```
📧 Email would be sent (EMAIL_ENABLED=false):
To: analyst@example.com
Subject: 🚨 CRITICAL ALERT: Firewall Offline
---

📱 SMS NOTIFICATION (Development Mode)
============================================================
To: +15551234567
Message: CRITICAL SECURITY ALERT

Firewall Offline

Severity: critical

Firewall device is not responding to health checks

Immediate action required. Log in to AVIAN to investigate.
============================================================
```

### Ticket Notifications
```
📧 Email would be sent (EMAIL_ENABLED=false):
To: technician@example.com
Subject: Ticket #TKT-1234 Assigned to You
---
```

---

## 🎯 Beta Testing Focus Areas

### Core Functionality
- [ ] User login/logout works
- [ ] Password reset flow (check console for links)
- [ ] Account lockout after 5 failed attempts
- [ ] Session timeout warning appears
- [ ] Alert acknowledgment works
- [ ] Ticket creation and management
- [ ] Notification preferences can be configured

### User Experience
- [ ] UI is intuitive and responsive
- [ ] Dark mode works properly
- [ ] Error messages are clear
- [ ] Loading states work
- [ ] Forms validate properly

### Security
- [ ] Cannot access pages without login
- [ ] Session expires properly
- [ ] Account lockout prevents brute force
- [ ] Password reset tokens work once
- [ ] Users can only see their own data

### Performance
- [ ] Pages load quickly
- [ ] No console errors
- [ ] Database queries are efficient
- [ ] Notifications don't slow down alert creation

---

## 🔧 Troubleshooting

### "Email service not configured" Messages
**This is expected!** Email is disabled for now. The system logs what would be sent instead of actually sending emails.

### SMS Not Working
1. Check `SMS_ENABLED="true"` in environment
2. Verify Twilio credentials are correct
3. Make sure phone number is verified in Twilio console (trial accounts)
4. Check Twilio console for error messages

### Database Connection Issues
1. Verify `DATABASE_URL` is correct
2. Make sure database is running
3. Run `npm run db:push` to create tables

### Session Issues
1. Clear browser cookies
2. Check `JWT_SECRET` is set
3. Restart the application

---

## 📈 Success Metrics

### Ready for Production When:
- [ ] All core features tested and working
- [ ] No critical bugs found
- [ ] User feedback is positive
- [ ] Performance is acceptable
- [ ] Security testing passed

### Optional Enhancements (Post-Beta):
- [ ] Configure email service for actual email delivery
- [ ] Add phone number verification for SMS
- [ ] Implement quiet hours for SMS
- [ ] Add notification history UI
- [ ] Create weekly reports
- [ ] Add more notification types

---

## 📞 Support

### If You Need Help:
1. Check server console for error messages
2. Check browser console for JavaScript errors
3. Verify environment variables are set correctly
4. Make sure database migration ran successfully

### Common Issues:
- **"useAuth must be used within AuthProvider"** - Clear cookies and refresh
- **Database connection errors** - Check DATABASE_URL and database status
- **JWT errors** - Make sure JWT_SECRET is set and restart app
- **Notification not showing** - Check user preferences and console logs

---

## 🎉 You're Ready!

The system is now ready for beta testing without requiring email service configuration. Users will see console logs instead of receiving actual emails, which is perfect for testing the notification logic and user experience.

When you're ready to add email later, just:
1. Choose an email provider (SendGrid, Mailgun, AWS SES)
2. Get API credentials
3. Set `EMAIL_ENABLED="true"`
4. Configure the email service

**Happy testing!** 🚀