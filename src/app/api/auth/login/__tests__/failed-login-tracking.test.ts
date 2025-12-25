/**
 * Failed Login Tracking Tests
 * Tests for Task 4.1: Implement failed login tracking
 * 
 * Validates:
 * - Failed login attempts are tracked
 * - Account locks after 5 failed attempts
 * - Lock duration is 15 minutes
 * - Successful login resets failed attempts
 * - Audit logs are created for failed attempts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
// import { db } from '@/lib/database';
import { users, authAuditLogs } from '../../../../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/password';

describe('Failed Login Tracking', () => {
    let testUserId: string;
    const testEmail = 'test-failed-login@example.com';
    const correctPassword = 'CorrectPassword123!';
    const wrongPassword = 'WrongPassword123!';

    beforeEach(async () => {
        if (!db) throw new Error('Database not available');

        // Create test user
        const passwordHash = await hashPassword(correctPassword);
        const [user] = await db
            .insert(users)
            .values({
                email: testEmail,
                first_name: 'Test',
                last_name: 'User',
                password_hash: passwordHash,
                tenant_id: '00000000-0000-0000-0000-000000000000',
                role: 'user',
                is_active: true,
                failed_login_attempts: 0,
            })
            .returning();

        testUserId = user.id;
    });

    afterEach(async () => {
        if (!db) return;

        // Clean up test data
        await db.delete(authAuditLogs).where(eq(authAuditLogs.email, testEmail));
        await db.delete(users).where(eq(users.id, testUserId));
    });

    it('should track failed login attempts', async () => {
        const _request = new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: wrongPassword,
            }),
        });

        const response = await POST(request as any);
        expect(response.status).toBe(401);

        // Check that failed_login_attempts was incremented
        const [user] = await db!
            .select()
            .from(users)
            .where(eq(users.id, testUserId))
            .limit(1);

        expect(user.failed_login_attempts).toBe(1);
        expect(user.last_failed_login).toBeTruthy();
    });

    it('should increment failed attempts on multiple failures', async () => {
        // Attempt 3 failed logins
        for (let i = 0; i < 3; i++) {
            const _request = new Request('http://localhost/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail,
                    password: wrongPassword,
                }),
            });

            await POST(request as any);
        }

        // Check that failed_login_attempts is now 3
        const [user] = await db!
            .select()
            .from(users)
            .where(eq(users.id, testUserId))
            .limit(1);

        expect(user.failed_login_attempts).toBe(3);
    });

    it('should lock account after 5 failed attempts', async () => {
        // Attempt 5 failed logins
        for (let i = 0; i < 5; i++) {
            const _request = new Request('http://localhost/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail,
                    password: wrongPassword,
                }),
            });

            await POST(request as any);
        }

        // Check that account is locked
        const [user] = await db!
            .select()
            .from(users)
            .where(eq(users.id, testUserId))
            .limit(1);

        expect(user.failed_login_attempts).toBe(5);
        expect(user.account_locked).toBe(true);
        expect(user.locked_until).toBeTruthy();

        // Verify lock duration is approximately 15 minutes
        const lockedUntil = new Date(user.locked_until as string);
        const now = new Date();
        const diffMinutes = (lockedUntil.getTime() - now.getTime()) / (60 * 1000);

        expect(diffMinutes).toBeGreaterThan(14);
        expect(diffMinutes).toBeLessThan(16);
    });

    it('should prevent login when account is locked', async () => {
        // Lock the account by failing 5 times
        for (let i = 0; i < 5; i++) {
            const _request = new Request('http://localhost/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail,
                    password: wrongPassword,
                }),
            });

            await POST(request as any);
        }

        // Try to login with correct password
        const _request = new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: correctPassword,
            }),
        });

        const response = await POST(request as any);
        expect(response.status).toBe(403);

        const data = await response.json();
        expect(data.error).toContain('locked');
    });

    it('should reset failed attempts on successful login', async () => {
        // Fail 3 times
        for (let i = 0; i < 3; i++) {
            const _request = new Request('http://localhost/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail,
                    password: wrongPassword,
                }),
            });

            await POST(request as any);
        }

        // Verify failed attempts were tracked
        let [user] = await db!
            .select()
            .from(users)
            .where(eq(users.id, testUserId))
            .limit(1);
        expect(user.failed_login_attempts).toBe(3);

        // Successful login
        const _request = new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: correctPassword,
            }),
        });

        const response = await POST(request as any);
        expect(response.status).toBe(200);

        // Check that failed attempts were reset
        [user] = await db!
            .select()
            .from(users)
            .where(eq(users.id, testUserId))
            .limit(1);

        expect(user.failed_login_attempts).toBe(0);
        expect(user.last_failed_login).toBeNull();
        expect(user.locked_until).toBeNull();
        expect(user.account_locked).toBe(false);
    });

    it('should log failed login attempts in audit logs', async () => {
        const _request = new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-forwarded-for': '192.168.1.1',
            },
            body: JSON.stringify({
                email: testEmail,
                password: wrongPassword,
            }),
        });

        await POST(request as any);

        // Check audit log was created
        const logs = await db!
            .select()
            .from(authAuditLogs)
            .where(eq(authAuditLogs.email, testEmail));

        expect(logs.length).toBeGreaterThan(0);

        const failedLog = logs.find(log => log.result === 'failure');
        expect(failedLog).toBeTruthy();
        expect(failedLog?.action).toBe('login');
        expect(failedLog?.ip_address).toBe('192.168.1.1');
    });

    it('should show warning when close to lockout', async () => {
        // Fail 3 times (2 attempts remaining)
        for (let i = 0; i < 3; i++) {
            const _request = new Request('http://localhost/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: testEmail,
                    password: wrongPassword,
                }),
            });

            await POST(request as any);
        }

        // Next failure should show warning
        const _request = new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: wrongPassword,
            }),
        });

        const response = await POST(request as any);
        const data = await response.json();

        expect(data.warning).toBeTruthy();
        expect(data.warning).toContain('1 attempt');
    });
});
