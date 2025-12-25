# Production Authentication System - Design

## Architecture Overview

### High-Level Flow
```
User → Login Page → API (/api/auth/login) → Database → JWT Token → Protected Routes
```

### Components

1. **Frontend (Next.js)**
   - Login/Signup pages
   - Auth context provider
   - Protected route wrapper
   - Session management

2. **Backend (API Routes)**
   - Authentication endpoints
   - Authorization middleware
   - Session validation
   - Password management

3. **Database (PostgreSQL)**
   - Users table
   - Sessions table
   - Audit logs table
   - Tenants table

4. **Security Layer**
   - Password hashing (bcrypt)
   - JWT token generation/validation
   - Rate limiting
   - CSRF protection

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  email_verified BOOLEAN DEFAULT FALSE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### Audit Logs Table
```sql
CREATE TABLE auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  result VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON auth_audit_logs(user_id);
CREATE INDEX idx_audit_action ON auth_audit_logs(action);
CREATE INDEX idx_audit_created ON auth_audit_logs(created_at);
```

### Password History Table
```sql
CREATE TABLE password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_password_history_user ON password_history(user_id);
```

## API Endpoints

### POST /api/auth/register
**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "organization": "Acme Corp"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account."
}
```

### POST /api/auth/login
**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "mfaCode": "123456" // optional
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "tenant_id": "uuid"
  },
  "token": "jwt-token-here"
}
```

### POST /api/auth/logout
**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /api/auth/forgot-password
**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

### POST /api/auth/reset-password
**Request:**
```json
{
  "token": "reset-token",
  "password": "NewSecurePass123!"
}
```

### GET /api/auth/me
**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "tenant_id": "uuid",
    "mfa_enabled": false
  }
}
```

## Security Implementation

### Password Hashing
```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### JWT Token Generation
```typescript
import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: '24h',
    issuer: 'avian-platform',
    audience: 'avian-users'
  });
}

function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
}
```

### Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later'
});
```

### Account Lockout
```typescript
async function handleFailedLogin(userId: string) {
  const user = await db.users.findUnique({ where: { id: userId } });
  
  const attempts = user.failed_login_attempts + 1;
  
  if (attempts >= 5) {
    await db.users.update({
      where: { id: userId },
      data: {
        failed_login_attempts: attempts,
        locked_until: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      }
    });
  } else {
    await db.users.update({
      where: { id: userId },
      data: { failed_login_attempts: attempts }
    });
  }
}
```

## Frontend Implementation

### Auth Context
```typescript
'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    setUser(data.user);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!user
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Protected Route Component
```typescript
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

## Migration Strategy

1. **Phase 1: Database Setup**
   - Create migration files
   - Run migrations on production database
   - Seed initial admin user

2. **Phase 2: Backend Implementation**
   - Implement auth API endpoints
   - Add middleware for protected routes
   - Set up audit logging

3. **Phase 3: Frontend Implementation**
   - Build login/signup pages
   - Add auth context provider
   - Wrap protected routes

4. **Phase 4: Testing**
   - Unit tests for auth functions
   - Integration tests for API endpoints
   - E2E tests for user flows

5. **Phase 5: Deployment**
   - Deploy to staging
   - Security audit
   - Deploy to production
   - Monitor for issues

## Rollback Plan

If issues arise:
1. Revert to auth bypass mode
2. Investigate and fix issues
3. Redeploy with fixes

## Monitoring & Alerts

- Failed login rate > 10% → Alert
- Account lockouts > 5/hour → Alert
- Session creation rate spike → Alert
- Database connection failures → Alert
- JWT verification failures → Alert
