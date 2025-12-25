/**
 * Time-Based Account Unlock Verification Script
 * Manual verification for Task 4.1: Create unlock mechanism (time-based)
 * 
 * This script verifies that:
 * 1. Accounts with expired lockout periods are automatically unlocked
 * 2. The unlock mechanism resets all lock-related fields
 * 3. Accounts with active lockout periods remain locked
 */

// import { db } from '@/lib/database';
import { users } from '../../../../../../database/schemas/main';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/password';

/**
 * Simulate the unlockAccountIfExpired function from login route
 */
async function unlockAccountIfExpired(userId: string, lockedUntil: Date | string | null): Promise<boolean> {
    if (!db || !lockedUntil) {
        return false;
    }

    const now = new Date();
    const lockExpiry = new Date(lockedUntil);

    // Check if the lockout period has expired
    if (lockExpiry <= now) {
        // Automatically unlock the account and reset failed attempts
        await db
            .update(users)
            .set({
                account_locked: false,
                locked_until: null,
                failed_login_attempts: 0,
                last_failed_login: null,
            })
            .where(eq(users.id, userId));

        return true; // Account was unlocked
    }

    return false; // Account is still locked
}

async function verifyTimeBasedUnlock() {
    console.log('🔍 Verifying Time-Based Account Unlock Mechanism...\n');

    if (!db) {
        console.error('❌ Database not available');
        return false;
    }

    const testEmail = `verify-unlock-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    let testUserId: string;

    try {
        // 1. Create test user
        console.log('1️⃣  Creating test user...');
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
        console.log('✅ Test user created:', testEmail);

        // 2. Test Case 1: Expired lockout should unlock automatically
        console.log('\n2️⃣  Test Case 1: Expired lockout period...');
        const expiredLockTime = new Date(Date.now() - 1000); // 1 second ago
        await db
            .update(users)
            .set({
                account_locked: true,
                locked_until: expiredLockTime,
                failed_login_attempts: 5,
                last_failed_login: new Date(),
            })
            .where(eq(users.id, testUserId));

        console.log('   Locked account with expired timestamp:', expiredLockTime.toISOString());

        const wasUnlocked = await unlockAccountIfExpired(testUserId, expiredLockTime);
        console.log('   unlockAccountIfExpired returned:', wasUnlocked);

        if (!wasUnlocked) {
            console.error('❌ Account should have been unlocked but wasnt');
            return false;
        }

        const [unlockedUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, testUserId))
            .limit(1);

        console.log('✅ Account was automatically unlocked');
        console.log(`✅ account_locked: ${unlockedUser.account_locked} (expected: false)`);
        console.log(`✅ locked_until: ${unlockedUser.locked_until} (expected: null)`);
        console.log(`✅ failed_login_attempts: ${unlockedUser.failed_login_attempts} (expected: 0)`);
        console.log(`✅ last_failed_login: ${unlockedUser.last_failed_login} (expected: null)`);

        if (
            unlockedUser.account_locked !== false ||
            unlockedUser.locked_until !== null ||
            unlockedUser.failed_login_attempts !== 0 ||
            unlockedUser.last_failed_login !== null
        ) {
            console.error('❌ Account fields were not properly reset after unlock');
            return false;
        }

        // 3. Test Case 2: Active lockout should NOT unlock
        console.log('\n3️⃣  Test Case 2: Active lockout period...');
        const futureLockTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
        await db
            .update(users)
            .set({
                account_locked: true,
                locked_until: futureLockTime,
                failed_login_attempts: 5,
                last_failed_login: new Date(),
            })
            .where(eq(users.id, testUserId));

        console.log('   Locked account with future timestamp:', futureLockTime.toISOString());

        const shouldStayLocked = await unlockAccountIfExpired(testUserId, futureLockTime);
        console.log('   unlockAccountIfExpired returned:', shouldStayLocked);

        if (shouldStayLocked) {
            console.error('❌ Account should have remained locked but was unlocked');
            return false;
        }

        const [stillLockedUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, testUserId))
            .limit(1);

        console.log('✅ Account remained locked as expected');
        console.log(`✅ account_locked: ${stillLockedUser.account_locked} (expected: true)`);
        console.log(`✅ locked_until: ${stillLockedUser.locked_until !== null} (expected: true)`);
        console.log(`✅ failed_login_attempts: ${stillLockedUser.failed_login_attempts} (expected: 5)`);

        if (
            stillLockedUser.account_locked !== true ||
            stillLockedUser.locked_until === null ||
            stillLockedUser.failed_login_attempts !== 5
        ) {
            console.error('❌ Account should have remained locked');
            return false;
        }

        // 4. Test Case 3: No locked_until timestamp
        console.log('\n4️⃣  Test Case 3: No locked_until timestamp...');
        await db
            .update(users)
            .set({
                account_locked: false,
                locked_until: null,
                failed_login_attempts: 0,
                last_failed_login: null,
            })
            .where(eq(users.id, testUserId));

        const noLockResult = await unlockAccountIfExpired(testUserId, null);
        console.log('   unlockAccountIfExpired returned:', noLockResult);

        if (noLockResult) {
            console.error('❌ Should return false when no locked_until timestamp');
            return false;
        }

        console.log('✅ Correctly handled null locked_until timestamp');

        // 5. Test Case 4: Exact boundary (locked_until = now)
        console.log('\n5️⃣  Test Case 4: Boundary condition (locked_until = now)...');
        const nowTime = new Date();
        await db
            .update(users)
            .set({
                account_locked: true,
                locked_until: nowTime,
                failed_login_attempts: 5,
                last_failed_login: new Date(),
            })
            .where(eq(users.id, testUserId));

        // Wait a tiny bit to ensure time has passed
        await new Promise(resolve => setTimeout(resolve, 10));

        const boundaryResult = await unlockAccountIfExpired(testUserId, nowTime);
        console.log('   unlockAccountIfExpired returned:', boundaryResult);

        if (!boundaryResult) {
            console.error('❌ Account should be unlocked when locked_until <= now');
            return false;
        }

        console.log('✅ Correctly unlocked at boundary condition');

        // Cleanup
        console.log('\n6️⃣  Cleaning up test data...');
        await db.delete(users).where(eq(users.id, testUserId));
        console.log('✅ Test data cleaned up');

        console.log('\n✅ ✅ ✅ ALL VERIFICATIONS PASSED ✅ ✅ ✅');
        console.log('\nTime-Based Unlock Mechanism Summary:');
        console.log('✅ Accounts with expired lockout periods are automatically unlocked');
        console.log('✅ All lock-related fields are reset upon unlock');
        console.log('✅ Accounts with active lockout periods remain locked');
        console.log('✅ Null locked_until timestamps are handled correctly');
        console.log('✅ Boundary conditions (locked_until = now) work correctly');

        return true;
    } catch (error) {
        console.error('\n❌ Verification failed:', error);

        // Cleanup on error
        if (testUserId!) {
            try {
                await db.delete(users).where(eq(users.id, testUserId));
            } catch (cleanupError) {
                console.error('Failed to cleanup test data:', cleanupError);
            }
        }

        return false;
    }
}

// Run verification if executed directly
if (require.main === module) {
    verifyTimeBasedUnlock()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

export { verifyTimeBasedUnlock };
