# Admin Password Reset - Beta Testing Guide

## Overview
This feature allows tenant admins and super admins to reset user passwords without requiring email or SMS services. Perfect for beta testing when external services aren't configured.

**Implementation Date**: Current Session
**Status**: ✅ READY FOR BETA TESTING

---

## How It Works

### 🔐 Permissions

**Super Admin:**
- Can reset passwords for **any user** on the platform
- Access to all tenants and users

**Tenant Admin:**
- Can reset passwords for **users in their organization only**
- Limited to their tenant's users

**Other Roles:**
- No access to password reset functionality

---

## 🚀 How to Use

### Method 1: From Navigation (Logged In)

1. **Log in** as a tenant admin or super admin
2. **Navigate** to "Password Reset" in the sidebar
3. **Select user** from the list
4. **Enter new password** or generate random one
5. **Click "Reset Password"**
6. **Share new password** with the user securely

### Method 2: From Login Page (Not Logged In)

1. **Go to login page** (`/login`)
2. **Click "Admin Password Reset"** link at bottom
3. **Log in** with admin credentials when prompted
4. **Follow steps above**

---

## 📱 User Interface

### User Selection
- **List of users** the admin can manage
- **User details**: Name, email, role, status
- **Visual selection** with highlighted cards
- **Inactive users** clearly marked

### Password Reset Form
- **Selected user info** displayed prominently
- **New password field** with show/hide toggle
- **Confirm password field** for verification
- **Generate random password** button (12 characters)
- **Password requirements** clearly shown
- **One-click reset** with loading states

### Success/Error Handling
- **Success messages** with user confirmation
- **Error messages** for validation issues
- **Loading states** during reset process
- **Auto-clear messages** after 5 seconds

---

## 🔧 Technical Details

### API Endpoints

**GET /api/admin/users**
- Returns users the admin can manage
- Filters by tenant for tenant admins
- Includes user details and status

**POST /api/admin/reset-password**
- Resets user password
- Validates admin permissions
- Clears account lockouts
- Logs reset activity

### Security Features

**Permission Validation:**
- JWT token verification
- Role-based access control
- Tenant boundary enforcement

**Password Security:**
- Bcrypt hashing (12 rounds)
- Minimum 8 character requirement
- Automatic lockout clearing

**Audit Logging:**
- All resets logged to console
- Admin and target user recorded
- Timestamp and action tracked

---

## 🧪 Testing Scenarios

### Test Cases

1. **Super Admin Reset**
   - Log in as super admin
   - Reset password for user in different tenant
   - Verify success and user can log in

2. **Tenant Admin Reset**
   - Log in as tenant admin
   - Reset password for user in same tenant
   - Try to reset user in different tenant (should fail)

3. **Password Validation**
   - Try password less than 8 characters
   - Try mismatched passwords
   - Verify error messages

4. **Account Unlock**
   - Lock user account (5 failed logins)
   - Reset password via admin
   - Verify user can log in immediately

5. **Random Password Generation**
   - Click "Generate Random Password"
   - Verify 12-character password created
   - Verify password works for login

### Expected Behaviors

**✅ Should Work:**
- Super admin resets any user password
- Tenant admin resets users in their tenant
- Password validation and confirmation
- Random password generation
- Account lockout clearing
- Immediate login with new password

**❌ Should Fail:**
- Non-admin users accessing the page
- Tenant admin resetting users outside their tenant
- Passwords under 8 characters
- Mismatched password confirmation

---

## 🎯 Beta Testing Benefits

### No External Dependencies
- **No email service** required
- **No SMS service** required
- **No SMTP configuration** needed
- **Works immediately** after setup

### Admin Control
- **Instant password resets** for stuck users
- **Account unlock capability** for locked accounts
- **Secure password generation** with random passwords
- **Full audit trail** of reset activities

### User Experience
- **Immediate access** after password reset
- **No waiting for emails** that might not arrive
- **Clear communication** of new passwords
- **Professional interface** for admins

---

## 📋 Setup Checklist

### Prerequisites
- [ ] Database migration completed (`npm run db:push`)
- [ ] Admin users created with proper roles
- [ ] Authentication system working

### Testing Steps
1. [ ] Create test users with different roles
2. [ ] Test super admin password reset
3. [ ] Test tenant admin password reset
4. [ ] Test permission boundaries
5. [ ] Test password validation
6. [ ] Test account unlock functionality
7. [ ] Verify audit logging

---

## 🔒 Security Considerations

### Access Control
- **JWT authentication** required for all operations
- **Role validation** on every request
- **Tenant boundary** enforcement for tenant admins
- **No password exposure** in logs or responses

### Password Handling
- **Secure hashing** with bcrypt
- **No plaintext storage** anywhere
- **Immediate hash** upon receipt
- **Memory clearing** after processing

### Audit Trail
- **All resets logged** with admin and target user
- **Timestamp tracking** for compliance
- **Permission validation** logged
- **Failed attempts** recorded

---

## 🚨 Important Notes

### For Beta Testing
- **Share passwords securely** (not via email/chat)
- **Use temporary passwords** and have users change them
- **Document any issues** encountered
- **Test with real user scenarios**

### Production Considerations
- **Add email notifications** when email service available
- **Implement password expiration** for admin-reset passwords
- **Add more detailed audit logging** to database
- **Consider approval workflows** for sensitive resets

---

## 🔧 Troubleshooting

### Common Issues

**"Insufficient permissions" error:**
- Verify user has admin role
- Check tenant boundaries for tenant admins
- Ensure JWT token is valid

**"User not found" error:**
- Verify user exists in database
- Check user is in correct tenant
- Refresh user list

**Password reset fails:**
- Check password meets requirements
- Verify passwords match
- Check network connectivity

**Can't access admin page:**
- Verify admin role in database
- Clear browser cache and cookies
- Check authentication token

### Debug Steps
1. Check browser console for errors
2. Verify JWT token in localStorage
3. Check server logs for API errors
4. Validate user roles in database
5. Test with different admin accounts

---

## 📞 Support

### If You Need Help
- Check server console for detailed error logs
- Verify database schema is up to date
- Test with known working admin accounts
- Check JWT token expiration

### Common Solutions
- **Clear browser cache** and re-login
- **Run database migration** if tables missing
- **Verify environment variables** are set
- **Check user roles** in database directly

---

## 🎉 Ready for Beta!

This admin password reset system provides a complete solution for managing user passwords during beta testing without requiring any external email or SMS services. 

**Key Benefits:**
- ✅ Works immediately without configuration
- ✅ Secure and role-based access control
- ✅ Professional user interface
- ✅ Complete audit trail
- ✅ Handles account lockouts automatically
- ✅ Perfect for beta testing scenarios

**Perfect for scenarios like:**
- New user onboarding
- Forgotten password recovery
- Account lockout resolution
- Temporary password assignment
- Beta testing user management

Start testing immediately - no additional setup required! 🚀