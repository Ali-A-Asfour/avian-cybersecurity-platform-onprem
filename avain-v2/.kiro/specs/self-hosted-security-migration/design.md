# Design Document: Self-Hosted Security Migration

## Overview

This design document specifies the architecture for migrating the AVIAN Cybersecurity Platform from AWS-managed services to a self-hosted deployment using open-source components. The design maintains multi-tenant isolation, implements enterprise-grade security controls, and provides a production-ready deployment on EC2 infrastructure.

### Design Goals

1. **Zero AWS Service Dependencies**: Replace all AWS-managed services (Cognito, Secrets Manager, DynamoDB, S3) with open-source alternatives
2. **Security First**: Implement industry-standard security controls (MFA, RBAC, audit logging, rate limiting)
3. **Multi-Tenant Isolation**: Ensure complete data isolation between tenants
4. **Production Ready**: Provide Docker-based deployment with monitoring, backups, and recovery
5. **Maintainability**: Use well-established open-source libraries with active communities

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Application** | Next.js 16 | Web application framework |
| **Database** | PostgreSQL 16 | Primary data store |
| **Cache/Sessions** | Redis 7 | Session management and caching |
| **Authentication** | Passport.js + JWT | User authentication |
| **MFA** | otplib + qrcode | TOTP-based 2FA |
| **Password Hashing** | bcryptjs | Secure password storage |
| **Email** | Nodemailer | Email delivery |
| **Reverse Proxy** | Nginx | SSL termination and load balancing |
| **Containerization** | Docker + Docker Compose | Application deployment |
| **Process Manager** | PM2 (optional) | Node.js process management |

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         EC2 Instance                         │
│                                                              │
│  ┌────────────┐                                             │
│  │   Nginx    │ ← HTTPS (443)                               │
│  │  (Reverse  │                                             │
│  │   Proxy)   │                                             │
│  └─────┬──────┘                                             │
│        │                                                     │
│        ↓                                                     │
│  ┌────────────┐      ┌──────────┐      ┌──────────┐       │
│  │  Next.js   │─────→│  Redis   │      │PostgreSQL│       │
│  │    App     │      │ (Session)│      │   (DB)   │       │
│  │  (Port     │      │          │      │          │       │
│  │   3000)    │      └──────────┘      └──────────┘       │
│  └────────────┘                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Application                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Routes (src/app/api/)                │  │
│  │                                                        │  │
│  │  /auth/*     /users/*    /tenants/*    /admin/*      │  │
│  └────────┬─────────────────────────────────────────────┘  │
│           │                                                  │
│           ↓                                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Middleware Layer                         │  │
│  │                                                        │  │
│  │  • Authentication (Passport.js)                       │  │
│  │  • Authorization (RBAC)                               │  │
│  │  • Rate Limiting (Redis)                              │  │
│  │  • Tenant Isolation                                   │  │
│  │  • Audit Logging                                      │  │
│  └────────┬─────────────────────────────────────────────┘  │
│           │                                                  │
│           ↓                                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Service Layer                            │  │
│  │                                                        │  │
│  │  • AuthService (Login, MFA, Sessions)                 │  │
│  │  • UserService (CRUD, Password Management)            │  │
│  │  • TenantService (Multi-tenancy)                      │  │
│  │  • EmailService (Verification, Reset)                 │  │
│  │  • AuditService (Logging)                             │  │
│  └────────┬─────────────────────────────────────────────┘  │
│           │                                                  │
│           ↓                                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Data Access Layer                        │  │
│  │                                                        │  │
│  │  • Drizzle ORM (PostgreSQL)                           │  │
│  │  • Redis Client (Sessions, Cache)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```


## Components and Interfaces

### 1. Authentication Service

**Purpose**: Manages user authentication, session creation, and token generation.

**Key Methods**:
```typescript
interface AuthService {
  // User authentication
  login(email: string, password: string, tenantId: string): Promise<LoginResult>
  logout(userId: string, sessionId: string): Promise<void>
  refreshToken(refreshToken: string): Promise<TokenPair>
  
  // MFA operations
  setupMFA(userId: string): Promise<MFASetupData>
  verifyMFA(userId: string, token: string): Promise<boolean>
  generateBackupCodes(userId: string): Promise<string[]>
  
  // Session management
  createSession(userId: string, metadata: SessionMetadata): Promise<Session>
  validateSession(sessionId: string): Promise<boolean>
  invalidateSession(sessionId: string): Promise<void>
  invalidateAllUserSessions(userId: string): Promise<void>
}

interface LoginResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  requiresMFA?: boolean
  user?: UserProfile
}

interface TokenPair {
  accessToken: string
  refreshToken: string
}

interface MFASetupData {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}
```

**Dependencies**:
- PostgreSQL (user data, password hashes)
- Redis (session storage)
- bcryptjs (password verification)
- jsonwebtoken (JWT generation/verification)
- otplib (TOTP generation/verification)

**Security Controls**:
- Password hashing with bcrypt (12 rounds)
- JWT tokens with short expiration (15 minutes access, 7 days refresh)
- Session tokens stored in Redis with TTL
- Failed login attempt tracking and account lockout
- MFA secrets encrypted at rest

### 2. User Service

**Purpose**: Manages user lifecycle, password policies, and profile management.

**Key Methods**:
```typescript
interface UserService {
  // User management
  createUser(data: CreateUserData): Promise<User>
  getUserById(userId: string): Promise<User | null>
  getUserByEmail(email: string, tenantId: string): Promise<User | null>
  updateUser(userId: string, data: UpdateUserData): Promise<User>
  deleteUser(userId: string): Promise<void>
  
  // Password management
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>
  resetPassword(token: string, newPassword: string): Promise<void>
  validatePasswordStrength(password: string): Promise<ValidationResult>
  checkPasswordHistory(userId: string, password: string): Promise<boolean>
  
  // Email verification
  sendVerificationEmail(userId: string): Promise<void>
  verifyEmail(token: string): Promise<boolean>
  
  // Account security
  lockAccount(userId: string, duration: number): Promise<void>
  unlockAccount(userId: string): Promise<void>
  incrementFailedLoginAttempts(userId: string): Promise<number>
  resetFailedLoginAttempts(userId: string): Promise<void>
}

interface CreateUserData {
  email: string
  password: string
  firstName: string
  lastName: string
  tenantId: string
  role: UserRole
}
```

**Dependencies**:
- PostgreSQL (users, password_history tables)
- EmailService (verification, password reset emails)
- AuditService (logging user actions)

**Security Controls**:
- Password complexity validation (min 12 chars, mixed case, numbers, symbols)
- Password history tracking (prevent reuse of last 5 passwords)
- Email verification required before login
- Account lockout after 5 failed attempts (30 minutes)
- Password expiration after 90 days


### 3. Session Manager

**Purpose**: Manages user sessions in Redis with proper TTL and security controls.

**Key Methods**:
```typescript
interface SessionManager {
  // Session operations
  createSession(userId: string, metadata: SessionMetadata): Promise<string>
  getSession(sessionId: string): Promise<SessionData | null>
  updateSession(sessionId: string, data: Partial<SessionData>): Promise<void>
  deleteSession(sessionId: string): Promise<void>
  deleteAllUserSessions(userId: string): Promise<void>
  
  // Session validation
  validateSession(sessionId: string): Promise<boolean>
  refreshSession(sessionId: string): Promise<void>
  
  // Session queries
  getUserSessions(userId: string): Promise<SessionData[]>
  getActiveSessions(): Promise<number>
}

interface SessionData {
  sessionId: string
  userId: string
  tenantId: string
  ipAddress: string
  userAgent: string
  createdAt: number
  lastActivity: number
  expiresAt: number
}

interface SessionMetadata {
  ipAddress: string
  userAgent: string
}
```

**Redis Data Structure**:
```
Key Pattern: session:{sessionId}
Value: JSON-encoded SessionData
TTL: 24 hours (sliding window)

Key Pattern: user_sessions:{userId}
Value: Set of sessionId
TTL: 7 days

Key Pattern: session_token:{tokenHash}
Value: sessionId
TTL: 24 hours
```

**Security Controls**:
- Session tokens are cryptographically random (32 bytes)
- Session data includes IP and user agent for anomaly detection
- Sliding window expiration (extends on activity)
- Absolute expiration (7 days maximum)
- Ability to invalidate all sessions on password change

### 4. RBAC Service

**Purpose**: Enforces role-based access control and tenant isolation.

**Key Methods**:
```typescript
interface RBACService {
  // Role checks
  hasRole(userRole: UserRole, requiredRole: UserRole): boolean
  hasPermission(userRole: UserRole, permission: string): boolean
  getPermissions(role: UserRole): string[]
  
  // Tenant access
  canAccessTenant(userTenantId: string, targetTenantId: string, userRole: UserRole): boolean
  canManageUser(managerRole: UserRole, targetRole: UserRole, sameTenant: boolean): boolean
  
  // Resource access
  canAccessResource(userId: string, resourceType: string, resourceId: string): Promise<boolean>
  filterByTenant<T>(query: Query<T>, tenantId: string): Query<T>
}

enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  SECURITY_ANALYST = 'security_analyst',
  IT_HELPDESK_ANALYST = 'it_helpdesk_analyst',
  USER = 'user'
}

type Permission = 
  | 'platform:manage'
  | 'tenants:create' | 'tenants:read' | 'tenants:update' | 'tenants:delete'
  | 'users:create' | 'users:read' | 'users:update' | 'users:delete'
  | 'tickets:create' | 'tickets:read' | 'tickets:update' | 'tickets:delete'
  | 'alerts:read' | 'alerts:update'
  | 'compliance:read' | 'compliance:update'
  | 'reports:generate' | 'reports:read'
  | 'audit:read'
  | 'system:configure'
```

**Role Hierarchy**:
```
SUPER_ADMIN (Level 4)
  ├─ Full platform access
  ├─ All tenant access
  └─ System configuration

TENANT_ADMIN (Level 3)
  ├─ Tenant management
  ├─ User management (within tenant)
  └─ All tenant features

SECURITY_ANALYST (Level 2)
  ├─ Ticket management
  ├─ Alert management
  └─ Compliance read access

IT_HELPDESK_ANALYST (Level 2)
  ├─ Ticket management
  └─ Report read access

USER (Level 1)
  ├─ Read-only access
  └─ Own data access
```

**Security Controls**:
- Hierarchical role system (higher roles inherit lower permissions)
- Tenant isolation enforced at query level
- Permission checks before every data access
- Audit logging of all authorization failures


### 5. Rate Limiter

**Purpose**: Prevents abuse and brute force attacks using Redis-based rate limiting.

**Key Methods**:
```typescript
interface RateLimiter {
  // Rate limit checks
  checkLimit(key: string, maxRequests: number, windowSeconds: number): Promise<RateLimitResult>
  incrementCounter(key: string, windowSeconds: number): Promise<number>
  resetCounter(key: string): Promise<void>
  
  // Specific limiters
  checkLoginAttempts(identifier: string): Promise<RateLimitResult>
  checkAPIRequests(userId: string): Promise<RateLimitResult>
  checkIPRequests(ipAddress: string): Promise<RateLimitResult>
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}
```

**Redis Data Structure**:
```
Key Pattern: ratelimit:{type}:{identifier}:{window}
Value: Counter (number of requests)
TTL: Window duration

Example:
ratelimit:login:192.168.1.1:900 = 3 (TTL: 900s)
ratelimit:api:user-123:3600 = 45 (TTL: 3600s)
```

**Rate Limit Policies**:
```typescript
const RATE_LIMITS = {
  login: {
    maxAttempts: 5,
    windowSeconds: 900, // 15 minutes
    identifier: 'ip_address'
  },
  api: {
    maxRequests: 100,
    windowSeconds: 3600, // 1 hour
    identifier: 'user_id'
  },
  registration: {
    maxAttempts: 3,
    windowSeconds: 3600, // 1 hour
    identifier: 'ip_address'
  },
  passwordReset: {
    maxAttempts: 3,
    windowSeconds: 3600, // 1 hour
    identifier: 'email'
  }
}
```

**Implementation**:
- Sliding window algorithm using Redis
- Distributed rate limiting (works across multiple app instances)
- Exponential backoff for repeated violations
- Rate limit headers in API responses (X-RateLimit-*)

### 6. Audit Logger

**Purpose**: Records all security-relevant events for compliance and forensics.

**Key Methods**:
```typescript
interface AuditLogger {
  // Event logging
  logAuthEvent(event: AuthEvent): Promise<void>
  logDataAccess(event: DataAccessEvent): Promise<void>
  logAdminAction(event: AdminActionEvent): Promise<void>
  logSecurityEvent(event: SecurityEvent): Promise<void>
  
  // Query logs
  getAuditLogs(filters: AuditLogFilters): Promise<AuditLog[]>
  exportAuditLogs(filters: AuditLogFilters, format: 'json' | 'csv'): Promise<string>
}

interface AuditLog {
  id: string
  timestamp: Date
  tenantId?: string
  userId?: string
  action: string
  resourceType: string
  resourceId?: string
  result: 'success' | 'failure'
  ipAddress: string
  userAgent: string
  metadata: Record<string, any>
}

interface AuthEvent {
  action: 'login' | 'logout' | 'mfa_setup' | 'mfa_verify' | 'password_change' | 'password_reset'
  userId?: string
  email: string
  result: 'success' | 'failure'
  reason?: string
  ipAddress: string
  userAgent: string
}
```

**Logged Events**:
- Authentication: login, logout, MFA setup/verify, password changes
- Authorization: permission denials, tenant access violations
- Data Access: read/write/delete operations on sensitive data
- Administrative: user creation/deletion, role changes, tenant management
- Security: rate limit violations, suspicious activity, account lockouts

**Storage**:
- PostgreSQL `auth_audit_logs` and `audit_logs` tables
- Immutable records (no updates or deletes)
- Indexed by timestamp, user_id, action, ip_address
- Retention: minimum 1 year


### 7. Email Service

**Purpose**: Sends transactional emails for verification, password reset, and notifications.

**Key Methods**:
```typescript
interface EmailService {
  // Email operations
  sendVerificationEmail(user: User, token: string): Promise<void>
  sendPasswordResetEmail(user: User, token: string): Promise<void>
  sendPasswordChangedNotification(user: User): Promise<void>
  sendMFAEnabledNotification(user: User): Promise<void>
  sendAccountLockedNotification(user: User): Promise<void>
  
  // Template rendering
  renderTemplate(templateName: string, data: Record<string, any>): Promise<string>
}

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
  from: {
    name: string
    address: string
  }
}
```

**Email Templates**:
- `verification.html` - Email verification with token link
- `password-reset.html` - Password reset with token link
- `password-changed.html` - Notification of password change
- `mfa-enabled.html` - Notification of MFA activation
- `account-locked.html` - Notification of account lockout

**Configuration**:
```typescript
// Environment variables
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=noreply@example.com
EMAIL_PASSWORD=<secure-password>
EMAIL_FROM_NAME=AVIAN Security Platform
EMAIL_FROM_ADDRESS=noreply@example.com
```

**Security Controls**:
- TLS/SSL for SMTP connections
- Token-based links with expiration
- Rate limiting on email sending
- Email validation before sending
- No sensitive data in email body (only tokens)

### 8. Middleware Layer

**Purpose**: Provides cross-cutting concerns for all API routes.

**Middleware Stack**:
```typescript
// Request flow through middleware
Request
  ↓
1. CORS Middleware (validate origin)
  ↓
2. Security Headers Middleware (CSP, HSTS, etc.)
  ↓
3. Rate Limiting Middleware (check limits)
  ↓
4. Body Parser Middleware (parse JSON, validate size)
  ↓
5. Authentication Middleware (verify JWT)
  ↓
6. Authorization Middleware (check permissions)
  ↓
7. Tenant Isolation Middleware (inject tenant filter)
  ↓
8. Audit Logging Middleware (log request)
  ↓
Route Handler
  ↓
9. Error Handler Middleware (catch errors)
  ↓
10. Response Logger Middleware (log response)
  ↓
Response
```

**Authentication Middleware**:
```typescript
async function authMiddleware(req: NextRequest): Promise<AuthResult> {
  // Extract JWT from Authorization header
  const token = extractBearerToken(req.headers.get('authorization'))
  
  if (!token) {
    return { success: false, error: 'No token provided' }
  }
  
  // Verify JWT signature and expiration
  const payload = await AuthService.verifyAccessToken(token)
  
  // Validate session exists in Redis
  const sessionValid = await SessionManager.validateSession(payload.sessionId)
  
  if (!sessionValid) {
    return { success: false, error: 'Session expired' }
  }
  
  // Attach user to request context
  return { success: true, user: payload }
}
```

**Authorization Middleware**:
```typescript
function requireRole(role: UserRole) {
  return async (req: AuthenticatedRequest): Promise<void> => {
    if (!RBACService.hasRole(req.user.role, role)) {
      throw new ForbiddenError('Insufficient permissions')
    }
  }
}

function requirePermission(permission: Permission) {
  return async (req: AuthenticatedRequest): Promise<void> => {
    if (!RBACService.hasPermission(req.user.role, permission)) {
      throw new ForbiddenError('Insufficient permissions')
    }
  }
}
```

**Tenant Isolation Middleware**:
```typescript
async function tenantIsolationMiddleware(req: AuthenticatedRequest): Promise<void> {
  // Extract tenant ID from request (URL param, body, or JWT)
  const targetTenantId = extractTenantId(req)
  
  // Super admins can access any tenant
  if (req.user.role === UserRole.SUPER_ADMIN) {
    return
  }
  
  // Other users can only access their own tenant
  if (req.user.tenantId !== targetTenantId) {
    await AuditLogger.logSecurityEvent({
      action: 'tenant_access_violation',
      userId: req.user.userId,
      targetTenantId,
      ipAddress: req.ip
    })
    throw new ForbiddenError('Access denied to this tenant')
  }
}
```


## Data Models

### User Model (PostgreSQL)

```typescript
interface User {
  id: string                    // UUID
  tenant_id: string             // UUID, foreign key to tenants
  email: string                 // Unique per tenant
  first_name: string
  last_name: string
  role: UserRole
  password_hash: string         // bcrypt hash
  
  // MFA fields
  mfa_enabled: boolean
  mfa_secret: string | null     // Encrypted TOTP secret
  mfa_backup_codes: string[]    // Array of encrypted backup codes
  mfa_setup_completed: boolean
  
  // Account security
  account_locked: boolean
  failed_login_attempts: number
  last_failed_login: Date | null
  locked_until: Date | null
  
  // Email verification
  email_verified: boolean
  
  // Password management
  password_expires_at: Date
  password_changed_at: Date
  
  // Metadata
  last_login: Date | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}
```

### Session Model (Redis)

```typescript
interface Session {
  session_id: string            // Cryptographically random token
  user_id: string               // UUID
  tenant_id: string             // UUID
  
  // Security metadata
  ip_address: string
  user_agent: string
  
  // Timestamps
  created_at: number            // Unix timestamp
  last_activity: number         // Unix timestamp
  expires_at: number            // Unix timestamp
  
  // Session data
  data: Record<string, any>     // Additional session data
}
```

### Password History Model (PostgreSQL)

```typescript
interface PasswordHistory {
  id: string                    // UUID
  user_id: string               // UUID, foreign key to users
  password_hash: string         // bcrypt hash
  created_at: Date
}
```

### Email Verification Token Model (PostgreSQL)

```typescript
interface EmailVerificationToken {
  id: string                    // UUID
  user_id: string               // UUID, foreign key to users
  token: string                 // Cryptographically random token
  expires_at: Date
  created_at: Date
}
```

### Password Reset Token Model (PostgreSQL)

```typescript
interface PasswordResetToken {
  id: string                    // UUID
  user_id: string               // UUID, foreign key to users
  token: string                 // Cryptographically random token
  expires_at: Date
  created_at: Date
}
```

### Audit Log Model (PostgreSQL)

```typescript
interface AuditLog {
  id: string                    // UUID
  tenant_id: string | null      // UUID, foreign key to tenants
  user_id: string | null        // UUID, foreign key to users
  
  // Event details
  action: string                // e.g., 'login', 'user_created'
  resource_type: string         // e.g., 'user', 'tenant'
  resource_id: string | null    // UUID of affected resource
  result: 'success' | 'failure'
  
  // Request metadata
  ip_address: string
  user_agent: string
  
  // Additional data
  details: Record<string, any>  // JSON field
  
  // Timestamp
  created_at: Date
}
```

### Tenant Model (PostgreSQL - Existing)

```typescript
interface Tenant {
  id: string                    // UUID
  name: string
  domain: string                // Unique
  logo_url: string | null
  theme_color: string | null
  settings: Record<string, any> // JSON field
  is_active: boolean
  created_at: Date
  updated_at: Date
}
```

## Database Schema Changes

### New Indexes

```sql
-- Improve session lookup performance
CREATE INDEX idx_users_email_tenant ON users(email, tenant_id);
CREATE INDEX idx_users_tenant_active ON users(tenant_id, is_active);

-- Improve audit log queries
CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action_created ON audit_logs(action, created_at DESC);

-- Improve token lookups
CREATE INDEX idx_email_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX idx_password_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_history_user_created ON password_history(user_id, created_at DESC);
```

### New Columns

```sql
-- Add password expiration tracking
ALTER TABLE users ADD COLUMN password_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP DEFAULT NOW();

-- Update existing users
UPDATE users SET password_expires_at = NOW() + INTERVAL '90 days';
UPDATE users SET password_changed_at = NOW();
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Authentication Properties

**Property 1: Password Hashing Consistency**
*For any* user registration or password change, the password SHALL be hashed using bcrypt with salt rounds >= 12
**Validates: Requirements 3.2**

**Property 2: Password Verification Correctness**
*For any* login attempt, password verification SHALL correctly validate the password against the stored bcrypt hash
**Validates: Requirements 3.3**

**Property 3: JWT Generation on Authentication**
*For any* successful authentication, a valid JWT token SHALL be generated with correct claims (user_id, tenant_id, role)
**Validates: Requirements 3.4**

**Property 4: JWT Validation on Protected Routes**
*For any* request to a protected route, JWT validation SHALL occur and reject invalid/expired tokens
**Validates: Requirements 3.5**

**Property 5: Token Refresh Mechanism**
*For any* valid refresh token, a new access token SHALL be generated with updated expiration
**Validates: Requirements 3.6**

**Property 6: Failed Login Counter Increment**
*For any* failed login attempt, the failed_login_attempts counter SHALL increment by exactly 1
**Validates: Requirements 3.7**

**Property 7: Account Lockout on Threshold**
*For any* user with failed_login_attempts >= 5, the account SHALL be locked for 30 minutes
**Validates: Requirements 3.8**

### Session Management Properties

**Property 8: Session Creation with TTL**
*For any* user login, a session SHALL be created in Redis with TTL set to 24 hours
**Validates: Requirements 2.2**

**Property 9: Session Expiration**
*For any* session with TTL expired, Redis SHALL automatically remove it
**Validates: Requirements 2.3**

**Property 10: Session Token Uniqueness**
*For any* session creation, the generated token SHALL be cryptographically unique (32 bytes random)
**Validates: Requirements 7.1, 7.2**

**Property 11: Secure Cookie Flags**
*For any* session cookie, httpOnly and secure flags SHALL be set in production
**Validates: Requirements 7.3**

**Property 12: SameSite Cookie Policy**
*For any* session cookie, SameSite SHALL be set to Strict
**Validates: Requirements 7.4**

**Property 13: Session Invalidation on Logout**
*For any* logout request, the session SHALL be removed from Redis
**Validates: Requirements 7.5**

**Property 14: Session Inactivity Expiration**
*For any* session with no activity for 24 hours, the session SHALL expire
**Validates: Requirements 7.6**

**Property 15: Session Absolute Expiration**
*For any* session older than 7 days, the session SHALL expire regardless of activity
**Validates: Requirements 7.7**

**Property 16: Session Invalidation on Suspicious Activity**
*For any* detected suspicious activity, all user sessions SHALL be invalidated
**Validates: Requirements 7.8**

### MFA Properties

**Property 17: TOTP Secret Generation**
*For any* MFA enablement, a unique TOTP secret SHALL be generated
**Validates: Requirements 4.2**

**Property 18: QR Code Generation**
*For any* MFA setup, a valid QR code SHALL be generated for the TOTP secret
**Validates: Requirements 4.3**

**Property 19: Backup Code Generation**
*For any* MFA setup, exactly 10 unique backup codes SHALL be generated
**Validates: Requirements 4.4**

**Property 20: MFA Requirement After Password**
*For any* login with MFA enabled, TOTP code SHALL be required after password verification
**Validates: Requirements 4.5**

**Property 21: TOTP Time Window Validation**
*For any* TOTP validation, the time window SHALL accept codes from current period ±1 period
**Validates: Requirements 4.6**

**Property 22: MFA Data Encryption**
*For any* stored MFA secret or backup code, it SHALL be encrypted at rest
**Validates: Requirements 4.7**

**Property 23: Backup Code Invalidation**
*For any* backup code usage, that specific code SHALL be marked as used and rejected on subsequent attempts
**Validates: Requirements 4.8**

### RBAC and Tenant Isolation Properties

**Property 24: Permission Verification**
*For any* resource access, role permissions SHALL be verified before allowing access
**Validates: Requirements 5.2, 5.6**

**Property 25: Tenant Isolation for Non-Admins**
*For any* non-super_admin user, data access SHALL be restricted to their tenant_id only
**Validates: Requirements 5.3, 16.3**

**Property 26: Super Admin Cross-Tenant Access**
*For any* super_admin user, access to any tenant SHALL be allowed
**Validates: Requirements 5.4**

**Property 27: Tenant Admin Restriction**
*For any* tenant_admin user management action, the target user SHALL be in the same tenant
**Validates: Requirements 5.5**

**Property 28: Authorization Failure Logging**
*For any* authorization failure, an audit log entry SHALL be created
**Validates: Requirements 5.7**

**Property 29: Tenant Filtering on Queries**
*For any* database query by non-super_admin, tenant_id filtering SHALL be applied
**Validates: Requirements 16.1**

**Property 30: Tenant Ownership Verification**
*For any* data access, tenant ownership SHALL be verified before returning data
**Validates: Requirements 16.2**

**Property 31: JWT Tenant Validation**
*For any* JWT token, the tenant_id claim SHALL be validated against the requested resource
**Validates: Requirements 16.4**

**Property 32: Cross-Tenant Access Logging**
*For any* cross-tenant access attempt, an audit log entry SHALL be created
**Validates: Requirements 16.5**


### Password Policy Properties

**Property 33: Password Minimum Length**
*For any* password submission, validation SHALL enforce minimum 12 characters
**Validates: Requirements 6.1**

**Property 34: Password Complexity Requirements**
*For any* password submission, validation SHALL enforce uppercase, lowercase, numbers, and special characters
**Validates: Requirements 6.2**

**Property 35: Password History Prevention**
*For any* password change, the new password SHALL not match any of the last 5 passwords
**Validates: Requirements 6.3**

**Property 36: Password History Hashing**
*For any* password history entry, the password SHALL be stored as a bcrypt hash
**Validates: Requirements 6.4**

**Property 37: Password Expiration Enforcement**
*For any* password older than 90 days, the system SHALL enforce expiration
**Validates: Requirements 6.5**

**Property 38: Password Change on Expiration**
*For any* login with expired password, password change SHALL be required before access
**Validates: Requirements 6.6**

**Property 39: Dual Password Validation**
*For any* password submission, validation SHALL occur on both client and server side
**Validates: Requirements 6.7**

### Rate Limiting Properties

**Property 40: Login Rate Limiting**
*For any* IP address, login attempts SHALL be limited to 5 per 15 minutes
**Validates: Requirements 8.1**

**Property 41: API Rate Limiting**
*For any* user, API requests SHALL be limited to 100 per hour
**Validates: Requirements 8.2**

**Property 42: Rate Limit HTTP Status**
*For any* rate limit violation, HTTP 429 status SHALL be returned
**Validates: Requirements 8.3**

**Property 43: Rate Limit Headers**
*For any* API response, rate limit headers (X-RateLimit-*) SHALL be included
**Validates: Requirements 8.5**

**Property 44: Exponential Backoff**
*For any* repeated rate limit violations, the backoff duration SHALL increase exponentially
**Validates: Requirements 8.6**

**Property 45: Rate Limit Violation Logging**
*For any* rate limit violation, an audit log entry SHALL be created
**Validates: Requirements 8.7**

### Audit Logging Properties

**Property 46: Authentication Event Logging**
*For any* authentication event (login, logout, MFA), an audit log entry SHALL be created
**Validates: Requirements 9.1**

**Property 47: Authorization Failure Logging**
*For any* authorization failure, an audit log entry SHALL be created
**Validates: Requirements 9.2**

**Property 48: Data Access Logging**
*For any* data access or modification, an audit log entry SHALL be created
**Validates: Requirements 9.3**

**Property 49: Administrative Action Logging**
*For any* administrative action, an audit log entry SHALL be created
**Validates: Requirements 9.4**

**Property 50: Audit Log Required Fields**
*For any* audit log entry, it SHALL include timestamp, user_id, ip_address, and action
**Validates: Requirements 9.5**

**Property 51: Audit Log Retention**
*For any* audit log entry, it SHALL be retained for minimum 1 year
**Validates: Requirements 9.7**

**Property 52: Audit Log Immutability**
*For any* audit log entry, modification or deletion SHALL be prevented
**Validates: Requirements 9.8**

### Email Verification Properties

**Property 53: Verification Email on Registration**
*For any* user registration, a verification email SHALL be sent
**Validates: Requirements 10.1**

**Property 54: Verification Token Uniqueness**
*For any* verification token, it SHALL be unique with 24-hour expiration
**Validates: Requirements 10.2**

**Property 55: Email Verification on Valid Token**
*For any* valid verification token, the email SHALL be marked as verified
**Validates: Requirements 10.3**

**Property 56: Login Prevention for Unverified**
*For any* unverified account, login SHALL be blocked
**Validates: Requirements 10.4**

**Property 57: Verification Email Resend**
*For any* resend request, a new verification email SHALL be sent
**Validates: Requirements 10.5**

**Property 58: New Token on Expiration**
*For any* expired verification token, a new token SHALL be generated on request
**Validates: Requirements 10.6**

### Password Reset Properties

**Property 59: Reset Email on Request**
*For any* password reset request, a reset email SHALL be sent
**Validates: Requirements 11.1**

**Property 60: Reset Token Uniqueness**
*For any* reset token, it SHALL be unique with 1-hour expiration
**Validates: Requirements 11.2**

**Property 61: Password Change on Valid Token**
*For any* valid reset token, password change SHALL be allowed
**Validates: Requirements 11.3**

**Property 62: Session Invalidation on Reset**
*For any* password reset, all existing sessions SHALL be invalidated
**Validates: Requirements 11.4**

**Property 63: Password Reuse Prevention on Reset**
*For any* password reset, the new password SHALL not match password history
**Validates: Requirements 11.5**

**Property 64: Password Reset Logging**
*For any* password reset attempt, an audit log entry SHALL be created
**Validates: Requirements 11.6**


## Error Handling

### Error Categories

```typescript
// Base error class
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

// Authentication errors
class AuthenticationError extends AppError {
  constructor(message: string, details?: any) {
    super('AUTHENTICATION_ERROR', message, 401, details)
  }
}

class InvalidCredentialsError extends AuthenticationError {
  constructor() {
    super('Invalid email or password')
  }
}

class AccountLockedError extends AuthenticationError {
  constructor(lockedUntil: Date) {
    super('Account is locked due to too many failed login attempts', { lockedUntil })
  }
}

class MFARequiredError extends AuthenticationError {
  constructor() {
    super('MFA verification required')
  }
}

class InvalidMFACodeError extends AuthenticationError {
  constructor() {
    super('Invalid MFA code')
  }
}

// Authorization errors
class AuthorizationError extends AppError {
  constructor(message: string, details?: any) {
    super('AUTHORIZATION_ERROR', message, 403, details)
  }
}

class InsufficientPermissionsError extends AuthorizationError {
  constructor(requiredPermission: string) {
    super(`Insufficient permissions: ${requiredPermission}`)
  }
}

class TenantAccessDeniedError extends AuthorizationError {
  constructor(tenantId: string) {
    super(`Access denied to tenant: ${tenantId}`)
  }
}

// Validation errors
class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details)
  }
}

class PasswordValidationError extends ValidationError {
  constructor(reasons: string[]) {
    super('Password does not meet requirements', { reasons })
  }
}

class EmailNotVerifiedError extends ValidationError {
  constructor() {
    super('Email address not verified')
  }
}

// Rate limiting errors
class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('RATE_LIMIT_EXCEEDED', 'Too many requests', 429, { retryAfter })
  }
}

// Resource errors
class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`, 404)
  }
}

class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409)
  }
}

// System errors
class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super('DATABASE_ERROR', message, 500, { originalError: originalError?.message })
  }
}

class RedisError extends AppError {
  constructor(message: string, originalError?: Error) {
    super('REDIS_ERROR', message, 500, { originalError: originalError?.message })
  }
}
```

### Error Handling Strategy

**API Route Error Handler**:
```typescript
async function errorHandler(error: Error, req: NextRequest): Promise<NextResponse> {
  // Log error with context
  await AuditLogger.logSecurityEvent({
    action: 'error_occurred',
    userId: req.user?.userId,
    ipAddress: req.ip,
    userAgent: req.headers.get('user-agent'),
    metadata: {
      error: error.message,
      stack: error.stack,
      path: req.nextUrl.pathname
    }
  })
  
  // Handle known errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      { status: error.statusCode }
    )
  }
  
  // Handle unknown errors (don't leak details)
  logger.error('Unhandled error', error)
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      }
    },
    { status: 500 }
  )
}
```

**Database Error Handling**:
```typescript
async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error.code === '23505') {
      // Unique constraint violation
      throw new ConflictError('Resource already exists')
    }
    if (error.code === '23503') {
      // Foreign key violation
      throw new ValidationError('Referenced resource does not exist')
    }
    if (error.code === '23502') {
      // Not null violation
      throw new ValidationError('Required field is missing')
    }
    throw new DatabaseError('Database operation failed', error)
  }
}
```

**Redis Error Handling**:
```typescript
async function withRedisErrorHandling<T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    logger.error('Redis operation failed', error)
    
    // If fallback provided, return it (graceful degradation)
    if (fallback !== undefined) {
      return fallback
    }
    
    throw new RedisError('Cache operation failed', error)
  }
}
```

### Graceful Degradation

**Redis Unavailable**:
- Session validation falls back to JWT-only validation
- Rate limiting disabled (log warning)
- Caching disabled (direct database queries)
- Application continues to function

**Database Unavailable**:
- Health check returns unhealthy
- All requests return 503 Service Unavailable
- Application does not start if database unreachable

**Email Service Unavailable**:
- Email operations queued for retry
- User notified of email delivery delay
- Critical operations (verification, reset) logged for manual follow-up


## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit tests for specific scenarios and property-based tests for universal correctness guarantees:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
**Property Tests**: Verify universal properties across all inputs

Both approaches are complementary and necessary for comprehensive coverage.

### Property-Based Testing Configuration

**Library**: fast-check (already in devDependencies)
**Minimum Iterations**: 100 per property test
**Tag Format**: `Feature: self-hosted-security-migration, Property {number}: {property_text}`

Each correctness property defined in this document MUST be implemented as a property-based test.

### Test Organization

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── auth/
│   │   │   ├── password-hashing.test.ts
│   │   │   ├── jwt-generation.test.ts
│   │   │   ├── mfa-setup.test.ts
│   │   │   └── account-lockout.test.ts
│   │   ├── session/
│   │   │   ├── session-creation.test.ts
│   │   │   ├── session-expiration.test.ts
│   │   │   └── session-security.test.ts
│   │   ├── rbac/
│   │   │   ├── permission-checks.test.ts
│   │   │   └── tenant-isolation.test.ts
│   │   ├── password-policy/
│   │   │   ├── validation.test.ts
│   │   │   └── history.test.ts
│   │   └── rate-limiting/
│   │       └── rate-limiter.test.ts
│   └── property/
│       ├── auth.property.test.ts
│       ├── session.property.test.ts
│       ├── mfa.property.test.ts
│       ├── rbac.property.test.ts
│       ├── password-policy.property.test.ts
│       ├── rate-limiting.property.test.ts
│       ├── audit-logging.property.test.ts
│       ├── email-verification.property.test.ts
│       └── password-reset.property.test.ts
```

### Unit Test Examples

**Password Hashing Test**:
```typescript
describe('AuthService - Password Hashing', () => {
  it('should hash password with bcrypt salt rounds >= 12', async () => {
    const password = 'SecurePassword123!'
    const hash = await AuthService.hashPassword(password)
    
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/)
    expect(hash).not.toBe(password)
    
    // Verify salt rounds
    const rounds = parseInt(hash.split('$')[2])
    expect(rounds).toBeGreaterThanOrEqual(12)
  })
  
  it('should verify correct password', async () => {
    const password = 'SecurePassword123!'
    const hash = await AuthService.hashPassword(password)
    const isValid = await AuthService.verifyPassword(password, hash)
    
    expect(isValid).toBe(true)
  })
  
  it('should reject incorrect password', async () => {
    const password = 'SecurePassword123!'
    const hash = await AuthService.hashPassword(password)
    const isValid = await AuthService.verifyPassword('WrongPassword', hash)
    
    expect(isValid).toBe(false)
  })
})
```

**Account Lockout Test**:
```typescript
describe('AuthService - Account Lockout', () => {
  it('should lock account after 5 failed attempts', async () => {
    const user = await createTestUser()
    
    // Simulate 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await AuthService.login(user.email, 'wrong-password', user.tenant_id)
    }
    
    // Verify account is locked
    const updatedUser = await UserService.getUserById(user.id)
    expect(updatedUser.account_locked).toBe(true)
    expect(updatedUser.locked_until).toBeInstanceOf(Date)
    
    // Verify locked_until is ~30 minutes from now
    const lockDuration = updatedUser.locked_until.getTime() - Date.now()
    expect(lockDuration).toBeGreaterThan(29 * 60 * 1000)
    expect(lockDuration).toBeLessThan(31 * 60 * 1000)
  })
  
  it('should prevent login for locked account', async () => {
    const user = await createLockedUser()
    
    await expect(
      AuthService.login(user.email, user.password, user.tenant_id)
    ).rejects.toThrow(AccountLockedError)
  })
})
```

### Property-Based Test Examples

**Property 1: Password Hashing Consistency**:
```typescript
// Feature: self-hosted-security-migration, Property 1: Password Hashing Consistency
describe('Property: Password Hashing Consistency', () => {
  it('should hash all passwords with bcrypt salt rounds >= 12', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 12, maxLength: 128 }),
        async (password) => {
          const hash = await AuthService.hashPassword(password)
          
          // Verify bcrypt format
          expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/)
          
          // Verify salt rounds >= 12
          const rounds = parseInt(hash.split('$')[2])
          expect(rounds).toBeGreaterThanOrEqual(12)
          
          // Verify hash is different from password
          expect(hash).not.toBe(password)
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

**Property 8: Session Creation with TTL**:
```typescript
// Feature: self-hosted-security-migration, Property 8: Session Creation with TTL
describe('Property: Session Creation with TTL', () => {
  it('should create session with 24-hour TTL for all logins', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.uuid(),
          tenantId: fc.uuid(),
          ipAddress: fc.ipV4(),
          userAgent: fc.string()
        }),
        async (sessionData) => {
          const sessionId = await SessionManager.createSession(
            sessionData.userId,
            {
              ipAddress: sessionData.ipAddress,
              userAgent: sessionData.userAgent
            }
          )
          
          // Verify session exists in Redis
          const session = await SessionManager.getSession(sessionId)
          expect(session).not.toBeNull()
          expect(session.userId).toBe(sessionData.userId)
          
          // Verify TTL is set to 24 hours (±1 minute tolerance)
          const ttl = await redis.ttl(`session:${sessionId}`)
          expect(ttl).toBeGreaterThan(24 * 60 * 60 - 60)
          expect(ttl).toBeLessThanOrEqual(24 * 60 * 60)
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

**Property 25: Tenant Isolation for Non-Admins**:
```typescript
// Feature: self-hosted-security-migration, Property 25: Tenant Isolation for Non-Admins
describe('Property: Tenant Isolation for Non-Admins', () => {
  it('should restrict data access to own tenant for non-super_admin users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userTenantId: fc.uuid(),
          targetTenantId: fc.uuid(),
          role: fc.constantFrom(
            UserRole.TENANT_ADMIN,
            UserRole.SECURITY_ANALYST,
            UserRole.IT_HELPDESK_ANALYST,
            UserRole.USER
          )
        }),
        async (testData) => {
          // Skip if same tenant (should be allowed)
          if (testData.userTenantId === testData.targetTenantId) {
            return true
          }
          
          // Verify cross-tenant access is denied
          const canAccess = RBACService.canAccessTenant(
            testData.userTenantId,
            testData.targetTenantId,
            testData.role
          )
          
          expect(canAccess).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

**Property 40: Login Rate Limiting**:
```typescript
// Feature: self-hosted-security-migration, Property 40: Login Rate Limiting
describe('Property: Login Rate Limiting', () => {
  it('should limit login attempts to 5 per IP per 15 minutes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        async (ipAddress) => {
          // Clear any existing rate limit
          await RateLimiter.resetCounter(`login:${ipAddress}`)
          
          // Make 5 login attempts (should all be allowed)
          for (let i = 0; i < 5; i++) {
            const result = await RateLimiter.checkLoginAttempts(ipAddress)
            expect(result.allowed).toBe(true)
            await RateLimiter.incrementCounter(`login:${ipAddress}`, 900)
          }
          
          // 6th attempt should be blocked
          const result = await RateLimiter.checkLoginAttempts(ipAddress)
          expect(result.allowed).toBe(false)
          expect(result.retryAfter).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### Integration Tests

**Authentication Flow Test**:
```typescript
describe('Integration: Complete Authentication Flow', () => {
  it('should complete full registration and login flow', async () => {
    // 1. Register user
    const userData = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
      tenantId: testTenant.id,
      role: UserRole.USER
    }
    
    const user = await UserService.createUser(userData)
    expect(user.email_verified).toBe(false)
    
    // 2. Verify email sent
    expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.id }),
      expect.any(String)
    )
    
    // 3. Verify email
    const token = await getVerificationToken(user.id)
    await UserService.verifyEmail(token)
    
    const verifiedUser = await UserService.getUserById(user.id)
    expect(verifiedUser.email_verified).toBe(true)
    
    // 4. Login
    const loginResult = await AuthService.login(
      userData.email,
      userData.password,
      userData.tenantId
    )
    
    expect(loginResult.success).toBe(true)
    expect(loginResult.accessToken).toBeDefined()
    expect(loginResult.refreshToken).toBeDefined()
    
    // 5. Verify session created
    const sessions = await SessionManager.getUserSessions(user.id)
    expect(sessions).toHaveLength(1)
  })
})
```

### Test Coverage Requirements

- **Minimum 80% code coverage** for all production code
- **100% coverage** for security-critical functions (auth, RBAC, encryption)
- **All 64 correctness properties** implemented as property-based tests
- **Edge cases** covered by unit tests
- **Integration tests** for critical user flows


## Deployment Architecture

### Docker Compose Setup

**Production Deployment Structure**:
```yaml
# docker-compose.production.yml
version: '3.8'

services:
  # Nginx reverse proxy with SSL termination
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/dhparam.pem:/etc/nginx/dhparam.pem:ro
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - avian-network

  # Next.js application
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://avian:${DB_PASSWORD}@postgres:5432/avian
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - EMAIL_HOST=${EMAIL_HOST}
      - EMAIL_PORT=${EMAIL_PORT}
      - EMAIL_USER=${EMAIL_USER}
      - EMAIL_PASSWORD=${EMAIL_PASSWORD}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - avian-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

  # PostgreSQL database
  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=avian
      - POSTGRES_USER=avian
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d:ro
    restart: unless-stopped
    networks:
      - avian-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U avian"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis for sessions and caching
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - avian-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local

networks:
  avian-network:
    driver: bridge
```

### Dockerfile

```dockerfile
# Multi-stage build for production
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Build stage
FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Nginx Configuration

```nginx
# nginx/nginx.conf
upstream app {
    server app:3000;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name _;

    # SSL configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_dhparam /etc/nginx/dhparam.pem;

    # SSL protocols and ciphers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # SSL session cache
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;

    # Remove server header
    server_tokens off;

    # Client body size limit
    client_max_body_size 10M;

    # Proxy settings
    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no auth required)
    location /api/health {
        proxy_pass http://app;
        access_log off;
    }
}
```

### Environment Variables

```bash
# .env.production (DO NOT COMMIT)

# Database
DATABASE_URL=postgresql://avian:SECURE_PASSWORD@postgres:5432/avian
DB_PASSWORD=SECURE_PASSWORD

# Redis
REDIS_URL=redis://:SECURE_PASSWORD@redis:6379
REDIS_PASSWORD=SECURE_PASSWORD

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=SECURE_RANDOM_STRING_32_BYTES
JWT_REFRESH_SECRET=SECURE_RANDOM_STRING_32_BYTES

# Email Configuration
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=noreply@example.com
EMAIL_PASSWORD=SECURE_PASSWORD
EMAIL_FROM_NAME=AVIAN Security Platform
EMAIL_FROM_ADDRESS=noreply@example.com

# Application
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10485760

# Features
ENABLE_METRICS=true
ENABLE_TRACING=true
ENABLE_DEBUG_ROUTES=false
```

### EC2 Deployment Steps

**1. Prepare EC2 Instance**:
```bash
# Update system
sudo yum update -y  # Amazon Linux
# or
sudo apt update && sudo apt upgrade -y  # Ubuntu

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

**2. Setup Application**:
```bash
# Clone repository
git clone <your-repo-url> /opt/avian
cd /opt/avian

# Create environment file
cp .env.example .env.production
nano .env.production  # Edit with production values

# Generate SSL certificates (Let's Encrypt)
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# Generate DH parameters
openssl dhparam -out nginx/dhparam.pem 2048

# Set proper permissions
chmod 600 .env.production
chmod 600 nginx/ssl/*.pem
```

**3. Initialize Database**:
```bash
# Start only PostgreSQL first
docker-compose -f docker-compose.production.yml up -d postgres

# Wait for PostgreSQL to be ready
sleep 10

# Run migrations
docker-compose -f docker-compose.production.yml run --rm app npm run db:migrate

# Seed initial data (optional)
docker-compose -f docker-compose.production.yml run --rm app npm run db:seed
```

**4. Start Application**:
```bash
# Build and start all services
docker-compose -f docker-compose.production.yml up -d --build

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Verify health
curl https://your-domain.com/api/health/live
```

**5. Setup Systemd Service** (optional, for auto-restart):
```bash
# Create systemd service file
sudo nano /etc/systemd/system/avian.service
```

```ini
[Unit]
Description=AVIAN Cybersecurity Platform
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/avian
ExecStart=/usr/local/bin/docker-compose -f docker-compose.production.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.production.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable avian
sudo systemctl start avian
sudo systemctl status avian
```

### Backup and Recovery

**Automated Backup Script**:
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/avian/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker-compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U avian avian | gzip > $BACKUP_DIR/postgres_$TIMESTAMP.sql.gz

# Backup Redis
docker-compose -f docker-compose.production.yml exec -T redis \
  redis-cli --rdb /data/dump.rdb
docker cp $(docker-compose -f docker-compose.production.yml ps -q redis):/data/dump.rdb \
  $BACKUP_DIR/redis_$TIMESTAMP.rdb

# Backup environment file
cp .env.production $BACKUP_DIR/env_$TIMESTAMP

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +30 -delete

echo "Backup completed: $TIMESTAMP"
```

**Setup Cron Job**:
```bash
# Add to crontab
crontab -e

# Run backup daily at 2 AM
0 2 * * * /opt/avian/backup.sh >> /var/log/avian-backup.log 2>&1
```

**Recovery Procedure**:
```bash
# Stop application
docker-compose -f docker-compose.production.yml down

# Restore PostgreSQL
gunzip < backups/postgres_TIMESTAMP.sql.gz | \
  docker-compose -f docker-compose.production.yml exec -T postgres \
  psql -U avian avian

# Restore Redis
docker cp backups/redis_TIMESTAMP.rdb \
  $(docker-compose -f docker-compose.production.yml ps -q redis):/data/dump.rdb
docker-compose -f docker-compose.production.yml restart redis

# Start application
docker-compose -f docker-compose.production.yml up -d
```

### Monitoring and Maintenance

**Health Checks**:
- Liveness: `/api/health/live` - Application is running
- Readiness: `/api/health/ready` - Application is ready to serve traffic

**Log Management**:
```bash
# View logs
docker-compose -f docker-compose.production.yml logs -f app
docker-compose -f docker-compose.production.yml logs -f postgres
docker-compose -f docker-compose.production.yml logs -f redis

# Log rotation (configure in docker-compose.yml)
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

**Updates and Maintenance**:
```bash
# Pull latest code
cd /opt/avian
git pull

# Rebuild and restart
docker-compose -f docker-compose.production.yml up -d --build

# Run migrations if needed
docker-compose -f docker-compose.production.yml run --rm app npm run db:migrate
```


## Security Considerations

### Secrets Management

**Environment Variables**:
- All secrets stored in `.env.production` file
- File permissions set to 600 (owner read/write only)
- Never commit `.env.production` to version control
- Use `.env.example` as template with placeholder values

**Secret Generation**:
```bash
# Generate JWT secrets
openssl rand -base64 32

# Generate database password
openssl rand -base64 24

# Generate Redis password
openssl rand -base64 24
```

**Secret Rotation**:
- JWT secrets: Rotate every 90 days
- Database password: Rotate every 180 days
- Redis password: Rotate every 180 days
- Email password: Rotate per email provider policy

### Network Security

**Firewall Rules** (AWS Security Group or iptables):
```bash
# Allow HTTPS
sudo ufw allow 443/tcp

# Allow HTTP (for redirect to HTTPS)
sudo ufw allow 80/tcp

# Allow SSH (restrict to specific IPs)
sudo ufw allow from YOUR_IP to any port 22

# Deny all other inbound traffic
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable firewall
sudo ufw enable
```

**Docker Network Isolation**:
- Application containers communicate via internal Docker network
- Only Nginx exposed to public internet
- PostgreSQL and Redis not accessible from outside
- Use Docker secrets for sensitive data in production

### SSL/TLS Configuration

**Certificate Management**:
```bash
# Install certbot
sudo apt install certbot

# Obtain certificate
sudo certbot certonly --standalone -d your-domain.com

# Auto-renewal (add to crontab)
0 0 1 * * certbot renew --quiet --post-hook "docker-compose -f /opt/avian/docker-compose.production.yml restart nginx"
```

**TLS Best Practices**:
- Use TLS 1.2 and 1.3 only
- Disable weak ciphers
- Enable HSTS with long max-age
- Use strong DH parameters (2048-bit minimum)
- Enable OCSP stapling

### Database Security

**PostgreSQL Hardening**:
```sql
-- Create read-only user for reporting
CREATE USER avian_readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE avian TO avian_readonly;
GRANT USAGE ON SCHEMA public TO avian_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO avian_readonly;

-- Enable row-level security for tenant isolation
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant isolation
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Disable remote root login
ALTER USER postgres WITH PASSWORD 'secure_password';
```

**Connection Security**:
- Use SSL/TLS for database connections in production
- Limit connection pool size to prevent resource exhaustion
- Use prepared statements to prevent SQL injection
- Enable query logging for audit purposes

### Redis Security

**Redis Hardening**:
```bash
# redis.conf
requirepass SECURE_PASSWORD
bind 127.0.0.1
protected-mode yes
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
```

**Connection Security**:
- Require password authentication
- Bind to localhost only (within Docker network)
- Enable persistence (AOF) for session data
- Set memory limits to prevent OOM

### Application Security

**Security Headers** (configured in Nginx):
- `Strict-Transport-Security`: Force HTTPS
- `X-Frame-Options`: Prevent clickjacking
- `X-Content-Type-Options`: Prevent MIME sniffing
- `Content-Security-Policy`: Restrict resource loading
- `Referrer-Policy`: Control referrer information
- `Permissions-Policy`: Control browser features

**Input Validation**:
- Validate all user input on server side
- Use Zod schemas for type-safe validation
- Sanitize HTML input to prevent XSS
- Limit request body size to prevent DoS
- Validate file uploads (type, size, content)

**Output Encoding**:
- Escape HTML output to prevent XSS
- Use parameterized queries to prevent SQL injection
- Encode JSON responses properly
- Set proper Content-Type headers

### Monitoring and Alerting

**Security Monitoring**:
- Monitor failed login attempts
- Alert on account lockouts
- Track rate limit violations
- Monitor cross-tenant access attempts
- Alert on suspicious activity patterns

**Log Monitoring**:
- Centralize logs for analysis
- Monitor for error patterns
- Alert on critical errors
- Track authentication events
- Monitor database query performance

**Metrics to Track**:
- Active sessions count
- Failed login rate
- API request rate
- Database connection pool usage
- Redis memory usage
- Response time percentiles

### Incident Response

**Security Incident Procedures**:

1. **Detection**: Monitor logs and alerts for suspicious activity
2. **Containment**: Isolate affected systems, revoke compromised credentials
3. **Investigation**: Analyze audit logs, identify scope of breach
4. **Remediation**: Patch vulnerabilities, rotate secrets, update systems
5. **Recovery**: Restore from backups if needed, verify system integrity
6. **Post-Incident**: Document incident, update procedures, improve monitoring

**Emergency Contacts**:
- System Administrator: [contact info]
- Security Team: [contact info]
- Database Administrator: [contact info]
- On-Call Engineer: [contact info]

### Compliance Considerations

**Data Protection**:
- Encrypt sensitive data at rest (MFA secrets, backup codes)
- Encrypt data in transit (TLS for all connections)
- Implement data retention policies
- Provide data export capabilities
- Support data deletion requests

**Audit Requirements**:
- Log all authentication events
- Log all data access and modifications
- Log all administrative actions
- Retain logs for minimum 1 year
- Prevent log tampering

**Access Control**:
- Implement least privilege principle
- Enforce strong password policies
- Require MFA for administrative accounts
- Regular access reviews
- Immediate revocation on termination


## Migration Strategy

### Phase 1: Preparation (Week 1)

**Tasks**:
1. Review current AWS dependencies
2. Set up development environment with Docker
3. Install and configure PostgreSQL, Redis locally
4. Create migration plan and timeline
5. Backup current production data

**Deliverables**:
- Migration plan document
- Development environment setup
- Backup of production data

### Phase 2: Core Authentication Migration (Week 2-3)

**Tasks**:
1. Remove AWS Cognito dependencies
2. Implement Passport.js authentication
3. Implement JWT token generation/validation
4. Migrate user authentication logic
5. Update API routes to use new auth
6. Test authentication flows

**Deliverables**:
- Working Passport.js authentication
- JWT token system
- Updated API routes
- Unit tests for authentication

### Phase 3: Session Management Migration (Week 3-4)

**Tasks**:
1. Remove DynamoDB session dependencies
2. Implement Redis session manager
3. Migrate session storage logic
4. Implement session security controls
5. Test session management

**Deliverables**:
- Redis session manager
- Session security implementation
- Unit tests for sessions

### Phase 4: Security Features Implementation (Week 4-6)

**Tasks**:
1. Implement MFA with TOTP
2. Implement password policies
3. Implement rate limiting
4. Implement audit logging
5. Implement email verification
6. Implement password reset
7. Test all security features

**Deliverables**:
- MFA system
- Password policy enforcement
- Rate limiting system
- Audit logging system
- Email verification/reset flows
- Security feature tests

### Phase 5: Configuration and Secrets Migration (Week 6)

**Tasks**:
1. Remove AWS Secrets Manager dependencies
2. Implement environment variable configuration
3. Create .env.example template
4. Document secret generation procedures
5. Update configuration loading logic

**Deliverables**:
- Environment-based configuration
- Configuration documentation
- Secret generation scripts

### Phase 6: Docker and Deployment Setup (Week 7)

**Tasks**:
1. Create Dockerfile
2. Create docker-compose.yml files
3. Configure Nginx reverse proxy
4. Set up SSL/TLS certificates
5. Create deployment scripts
6. Create backup scripts
7. Document deployment procedures

**Deliverables**:
- Docker configuration
- Nginx configuration
- Deployment scripts
- Backup/recovery scripts
- Deployment documentation

### Phase 7: Testing and Validation (Week 8)

**Tasks**:
1. Run full test suite
2. Perform security testing
3. Load testing
4. Penetration testing
5. Fix identified issues
6. Document test results

**Deliverables**:
- Test results report
- Security audit report
- Performance benchmarks
- Issue resolution documentation

### Phase 8: Production Deployment (Week 9)

**Tasks**:
1. Provision EC2 instance
2. Configure security groups/firewall
3. Deploy application
4. Migrate production data
5. Configure monitoring
6. Verify all functionality
7. Update DNS records

**Deliverables**:
- Production deployment
- Migrated data
- Monitoring setup
- Deployment verification report

### Phase 9: Post-Deployment (Week 10)

**Tasks**:
1. Monitor system performance
2. Monitor security logs
3. Address any issues
4. Optimize performance
5. Update documentation
6. Train team on new system

**Deliverables**:
- Performance optimization report
- Updated documentation
- Team training materials

### Rollback Plan

**If migration fails**:
1. Keep AWS infrastructure running during migration
2. Maintain ability to switch back to AWS
3. Use feature flags to toggle between old/new auth
4. Keep data synchronized during transition
5. Document rollback procedures

**Rollback Triggers**:
- Critical security vulnerabilities discovered
- Performance degradation > 50%
- Data integrity issues
- Unresolvable bugs in production
- User experience significantly impacted

**Rollback Procedure**:
1. Switch DNS back to AWS infrastructure
2. Disable new authentication system
3. Re-enable AWS Cognito
4. Verify data consistency
5. Monitor for issues
6. Investigate root cause

### Data Migration

**User Data Migration**:
```sql
-- Export users from AWS Cognito to PostgreSQL
-- This is a conceptual example - actual implementation depends on Cognito export format

INSERT INTO users (
  id, tenant_id, email, first_name, last_name, role,
  password_hash, email_verified, created_at, updated_at
)
SELECT
  cognito_user_id,
  tenant_id,
  email,
  given_name,
  family_name,
  'user',
  '', -- Password hash will be reset, users must use password reset
  email_verified,
  created_at,
  NOW()
FROM cognito_export;

-- Send password reset emails to all migrated users
```

**Session Migration**:
- No migration needed - users will re-authenticate
- Invalidate all existing Cognito sessions
- Users redirected to new login flow

**Audit Log Migration**:
```sql
-- Migrate CloudTrail logs to PostgreSQL audit_logs table
INSERT INTO audit_logs (
  id, tenant_id, user_id, action, resource_type,
  resource_id, details, ip_address, user_agent, created_at
)
SELECT
  event_id,
  tenant_id,
  user_id,
  event_name,
  resource_type,
  resource_id,
  event_data,
  source_ip,
  user_agent,
  event_time
FROM cloudtrail_export;
```

### Testing Checklist

**Functional Testing**:
- [ ] User registration works
- [ ] Email verification works
- [ ] Login with password works
- [ ] MFA setup works
- [ ] MFA login works
- [ ] Password reset works
- [ ] Session management works
- [ ] Logout works
- [ ] Token refresh works
- [ ] RBAC permissions work
- [ ] Tenant isolation works
- [ ] Rate limiting works
- [ ] Audit logging works

**Security Testing**:
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Session hijacking prevention
- [ ] Brute force protection
- [ ] Password policy enforcement
- [ ] MFA bypass prevention
- [ ] Tenant isolation enforcement
- [ ] Authorization bypass prevention

**Performance Testing**:
- [ ] Login performance < 500ms
- [ ] API response time < 200ms
- [ ] Database query performance
- [ ] Redis performance
- [ ] Concurrent user handling
- [ ] Load testing (1000+ concurrent users)

**Integration Testing**:
- [ ] End-to-end user flows
- [ ] Multi-tenant scenarios
- [ ] Error handling
- [ ] Backup and recovery
- [ ] Monitoring and alerting

### Success Criteria

**Migration Complete When**:
- All AWS dependencies removed
- All tests passing (unit, integration, property)
- Security audit passed
- Performance benchmarks met
- Production deployment successful
- Zero critical bugs in production
- User acceptance testing passed
- Documentation complete
- Team trained on new system

**Performance Targets**:
- Login: < 500ms (p95)
- API requests: < 200ms (p95)
- Database queries: < 50ms (p95)
- Session validation: < 10ms (p95)
- Uptime: > 99.9%

**Security Targets**:
- Zero critical vulnerabilities
- Zero high-severity vulnerabilities
- All security controls implemented
- All audit requirements met
- Penetration testing passed

