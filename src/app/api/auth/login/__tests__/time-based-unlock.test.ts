/**
 * Time-Based Account Unlock Test
 * Tests for Task 4.1: Create unlock mechanism (time-based)
 * 
 * This test verifies that:
 * 1. Accounts are automatically unlocked when the lockout period expires
 * 2. The unlock happens during the login attempt
 * 3. Failed login counters are reset upon automatic unlock
 * 4. Audit logs record the automatic unlock event
 */

// import { db } from '@/lib/database';
import { users, authAuditLogs } from '../../../../../../database/schemas/main';
import { eq, desc } from 'drizzle-orm';
import { hashPassword } from '@/lib/password';

describe('Time-Based Account Unlock', () => {
    const testEmail = `unlock-test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    let testUserId: string;

    beforeAll(async () => {
        if (!db) {
            throw new Error('Database not available');
        }

        // Create test user
        const passwordHash = await hashPassword(testPassword);
        const [user] = await db
            .insert(users)
            .values({
                email: testEmail,
                first_name: 'Unlock',
                last_name: 'Test',
                password_hash: passwordHash,
                tenant_id: '00000000-0000-0000-0000-000000000000',
                role: 'user',
                is_active: true,
                failed_login_attempts: 0,
            })
            .returning();

        testUserId = user.id;
    });

    afterAll(async () => {
        if (!db || !testUserId) return;

        // Cleanup test data
        await db.delete(authAuditLogs).where(eq(authAuditLogs.user_id, testUserId));
        await db.delete(users).where(eq(users.id, testUserId));
    });

    test('should automatically unlock account when lockout period expires', async () => {
        if (!db) {
            throw new Error('Database not available');
        }

        // 1. Lock the account with an expired lockout time (1 second ago)
        const expiredLockTime = new Date(Date.now() - 1000);
        await db
            .update(users)
            .set({
                account_locked: true,
                locked_until: expiredLockTime,
                failed_login_attempts: 5,
                last_failed_login: new Date(),
            })
            .where(eq(users.id, testUserId));

        // 2. Verify account is locked
        const [lockedUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, testUserId))
            .limit(1);

        expect(lockedUser.account_locked).toBe(true);
        expect(lockedUser.failed_login_attempts).toBe(5);

        // 3. Attempt login (this should trigger automatic unlock)
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword,
            }),
        });

        // 4. Verify the account was unlocked
        const [unlockedUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, testUserId))
            .limit(1);

        expect(unlockedUser.account_locked).toBe(false);
        expect(unlockedUser.locked_until).toBeNull();
        expect(unlockedUser.failed_login_attempts).toBe(0);
        expect(unlockedUser.last_failed_login).toBeNull();

        // 5. Verify login was successful
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.user.email).toBe(testEmail);

        // 6. Verify audit log contains unlock event
        const [unlockLog] = await db
            .select()
            .from(authAuditLogs)
            .where(eq(authAuditLogs.user_id, testUserId))
            .orderBy(desc(authAuditLogs.created_at))
            .limit(1);

        expect(unlockLog).toBeDefined();
        expect(unlockLog.action).toBe('account_unlock');
        expect(unlockLog.result).toBe('success');
        expect(unlockLog.metadata).toMatchObject({
            reason: 'Lockout period expired',
            unlockType: 'automatic',
        });
    });

    test('should NOT unlock account if lockout period has not expired', async () => {
        if (!db) {
            throw new Error('Database not available');
        }

        // 1. Lock the account with a future lockout time (10 minutes from now)
        const futureLockTime = new Date(Date.now() + 10 * 60 * 1000);
        await db
            .update(users)
            .set({
                account_locked: true,
                locked_until: futureLockTime,
                failed_login_attempts: 5,
                last_failed_login: new Date(),
            })
            .where(eq(users.id, testUserId));

        // 2. Attempt login (should be rejected)
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword,
            }),
        });

        // 3. Verify login was rejected
        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toContain('Account is locked');

        // 4. Verify account is still locked
        const [stillLockedUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, testUserId))
            .limit(1);

        expect(stillLockedUser.account_locked).toBe(true);
        expect(stillLockedUser.locked_until).not.toBeNull();
        expect(stillLockedUser.failed_login_attempts).toBe(5);
    });

    test('should handle accounts with no locked_until timestamp', async () => {
        if (!db) {
            throw new Error('Database not available');
        }

        // 1. Reset account to unlocked state
        await db
            .update(users)
            .set({
                account_locked: false,
                locked_until: null,
                failed_login_attempts: 0,
                last_failed_login: null,
            })
            .where(eq(users.id, testUserId));

        // 2. Attempt login (should succeed)
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword,
            }),
        });

        // 3. Verify login was successful
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
    });
});
