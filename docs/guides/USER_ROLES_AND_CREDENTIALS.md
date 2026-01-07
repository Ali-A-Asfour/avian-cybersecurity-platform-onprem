# User Roles and Login Credentials

## Available User Roles

The system supports 5 different user roles with varying levels of access and permissions:

### 1. Super Admin (`super_admin`)
**Highest level of access** - Full system control across all tenants

**Permissions:**
- Access to all features and data across all tenants
- View system metrics and error logs
- Manage all users and tenants
- Create, update, and delete playbooks
- Activate and deprecate playbooks
- Generate and schedule quarterly reports
- Access audit logs
- Override tenant restrictions

**Login Credentials:**
- Email: `admin@demo.com`
- Password: `password123`
- Name: Super Admin

---

### 2. Tenant Admin (`tenant_admin`)
**Tenant-level administrative access** - Manages users and settings within their tenant

**Permissions:**
- Manage users within their tenant
- View audit logs for their tenant
- Generate quarterly reports (read-only)
- Access tenant-specific dashboard
- **Cannot access:** Alerts & Incidents, Security Tickets, Helpdesk Tickets

**Login Credentials:**
- Email: `tenant.admin@demo.com`
- Password: `password123`
- Name: Tenant Admin

---

### 3. Security Analyst (`security_analyst`)
**Security operations** - Monitors and responds to security events

**Permissions:**
- View and manage alerts and incidents
- View playbooks (read-only)
- Access security tickets
- Generate reports (read-only)
- Monitor security events
- **Cannot:** Create/modify playbooks, schedule reports

**Login Credentials:**
- Email: `analyst@demo.com`
- Password: `password123`
- Name: Security Analyst

---

### 4. IT Helpdesk Analyst (`it_helpdesk_analyst`)
**IT support operations** - Handles helpdesk tickets and user support

**Permissions:**
- View and manage helpdesk tickets
- Access user support features
- View basic system information
- **Cannot:** Access security features, manage users, view sensitive data

**Login Credentials:**
- Email: `helpdesk@demo.com`
- Password: `password123`
- Name: IT Helpdesk

---

### 5. User (`user`)
**Standard user access** - Basic system access

**Permissions:**
- View own data and tickets
- Submit tickets
- Basic dashboard access
- **Cannot:** Access administrative features, view other users' data

**Login Credentials:**
- Email: `user@demo.com`
- Password: `password123`
- Name: Demo User

---

## Login Endpoints

### Production Login (Real Authentication)
**Endpoint:** `POST /api/auth/login`

Uses bcrypt password verification and full authentication flow including:
- Account lockout after 5 failed attempts (15-minute lockout)
- Email verification requirement
- Session management with JWT tokens
- Audit logging

**Request Body:**
```json
{
  "email": "admin@demo.com",
  "password": "password123",
  "rememberMe": false
}
```

### Demo Login (Testing Only)
**Endpoint:** `POST /api/auth/demo-login`

Bypasses real authentication for quick testing. Uses different passwords:
- `admin@demo.com` → `admin123`
- `analyst@demo.com` → `analyst123`
- `helpdesk@demo.com` → `helpdesk123`
- `user@demo.com` → `user123`

⚠️ **Note:** Demo login uses different passwords than production login!

---

## Role-Based Access Matrix

| Feature | Super Admin | Tenant Admin | Security Analyst | IT Helpdesk | User |
|---------|-------------|--------------|------------------|-------------|------|
| **System Metrics** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Error Logs** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Audit Logs** | ✅ | ✅ (tenant only) | ❌ | ❌ | ❌ |
| **User Management** | ✅ (all tenants) | ✅ (own tenant) | ❌ | ❌ | ❌ |
| **Alerts & Incidents** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Playbook Management** | ✅ (full CRUD) | ❌ | 👁️ (read-only) | ❌ | ❌ |
| **Security Tickets** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Helpdesk Tickets** | ✅ | ❌ | ✅ | ✅ | 👁️ (own only) |
| **Report Generation** | ✅ | 👁️ (read-only) | 👁️ (read-only) | ❌ | ❌ |
| **Report Scheduling** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Cross-Tenant Access** | ✅ | ❌ | ❌ | ❌ | ❌ |

**Legend:**
- ✅ Full access
- 👁️ Read-only access
- ❌ No access

---

## Current Demo Users in Database

Based on the seed file (`database/seeds/create-admin.sql`), the following users are available:

| Email | Role | Name | Password | Status |
|-------|------|------|----------|--------|
| `admin@demo.com` | super_admin | Super Admin | `password123` | ✅ Active |
| `tenant.admin@demo.com` | tenant_admin | Tenant Admin | `password123` | ✅ Active |
| `analyst@demo.com` | security_analyst | Security Analyst | `password123` | ✅ Active |
| `helpdesk@demo.com` | it_helpdesk_analyst | IT Helpdesk | `password123` | ✅ Active |
| `user@demo.com` | user | Demo User | `password123` | ✅ Active |

**All accounts:**
- Email verified: ✅ Yes
- Account active: ✅ Yes
- MFA enabled: ❌ No
- Tenant: Demo Corporation (`demo.avian-platform.com`)

---

## Adding Additional Demo Users

To add demo users for the missing roles (`it_helpdesk_analyst` and `user`), you can:

1. **Update the seed file** (`database/seeds/create-admin.sql`) to include:
   ```sql
   -- IT Helpdesk Analyst
   INSERT INTO users (
     tenant_id, email, first_name, last_name, role,
     password_hash, is_active, email_verified
   ) VALUES (
     tenant_uuid,
     'helpdesk@demo.com',
     'IT',
     'Helpdesk',
     'it_helpdesk_analyst',
     '$2b$12$LXCZ.cNJu7CWWJgHq.E3MOzLBPVXYSv7b/.Kk8/ctYz044cvmbgjC',
     true,
     true
   );
   
   -- Regular User
   INSERT INTO users (
     tenant_id, email, first_name, last_name, role,
     password_hash, is_active, email_verified
   ) VALUES (
     tenant_uuid,
     'user@demo.com',
     'Demo',
     'User',
     'user',
     '$2b$12$LXCZ.cNJu7CWWJgHq.E3MOzLBPVXYSv7b/.Kk8/ctYz044cvmbgjC',
     true,
     true
   );
   ```

2. **Re-run the seed script:**
   ```bash
   docker exec avian-postgres-dev psql -U avian -d avian -f /path/to/create-admin.sql
   ```

---

## Password Hash Reference

The password hash used in the seed file:
```
$2b$12$LXCZ.cNJu7CWWJgHq.E3MOzLBPVXYSv7b/.Kk8/ctYz044cvmbgjC
```

This hash corresponds to the password: `password123`

Generated using bcrypt with 12 salt rounds.

---

## Security Notes

1. **Production Deployment:** Change all default passwords before deploying to production
2. **Password Requirements:** Minimum 12 characters with uppercase, lowercase, numbers, and special characters
3. **Account Lockout:** 5 failed login attempts = 15-minute lockout
4. **Email Verification:** Required before first login
5. **MFA:** Currently disabled for demo accounts but available in the system
6. **Session Duration:** 
   - Normal session: 24 hours
   - Remember me: 30 days

---

## Related Files

- **Seed File:** `database/seeds/create-admin.sql`
- **Database Schema:** `database/schemas/main.ts`
- **Login Endpoint:** `src/app/api/auth/login/route.ts`
- **Demo Login:** `src/app/api/auth/demo-login/route.ts`
- **Password Utils:** `src/lib/password.ts`
- **Permissions:** `src/lib/permissions.ts`
- **Role Types:** `src/types/index.ts`
