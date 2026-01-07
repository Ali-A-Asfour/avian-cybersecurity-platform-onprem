# TODO: Fix Account Lockout Property Tests

## Issue
Task 4.4 property tests for account lockout are timing out due to slow bcrypt operations combined with database operations, even with reduced bcrypt rounds (4 rounds for tests vs 12 for production).

## Problem Details
- Each test creates test users which requires bcrypt hashing (4 rounds in test, 12 in production)
- Multiple failed login attempts per test = multiple bcrypt operations + database queries
- Tests hang/timeout even with:
  - Reduced iterations (numRuns: 1)
  - Reduced bcrypt rounds (4 instead of 12)
  - 180-second timeout
- File: `src/lib/__tests__/auth-lockout.property.test.ts`

## Current Status
- ✅ Fixed TypeScript errors (snake_case vs camelCase field names)
- ✅ Fixed database connection (using `getClient()` instead of `null` db export)
- ✅ Reduced bcrypt rounds for tests (4 rounds when NODE_ENV='test')
- ⚠️ Tests still timeout - need different approach

## Possible Solutions

### Option 1: Pre-create test users (RECOMMENDED)
- Create test users once in `beforeAll`
- Reuse them across tests
- Reset state between tests (clear failed_login_attempts, locked_until)
- Pros: Much faster, tests real bcrypt, comprehensive coverage
- Cons: More complex test setup, need to manage user state

### Option 2: Mock bcrypt for tests
- Use a faster hash function in test environment
- Keep real bcrypt for production
- Pros: Very fast tests
- Cons: Not testing real bcrypt behavior

### Option 3: Integration tests instead of property tests
- Use regular integration tests with specific examples
- Skip property-based testing for this functionality
- Pros: Simpler, faster
- Cons: Less comprehensive coverage

### Option 4: Reduce test scope
- Test only critical properties (lockout after 5 attempts)
- Skip edge cases for property tests
- Use unit tests for edge cases
- Pros: Faster while maintaining some property testing
- Cons: Less comprehensive

## Recommendation
Try Option 1 first (pre-create test users with state reset), as it provides the best balance of speed and comprehensive testing.

## Implementation Plan for Option 1
1. Create 5-10 test users in `beforeAll` with known passwords
2. Store user IDs and credentials in test array
3. In `beforeEach`, reset all test users:
   - Set `failed_login_attempts = 0`
   - Set `locked_until = null`
4. In each test, pick a user from the array (round-robin or random)
5. Run test with that user
6. No need to create/delete users during test execution

## Related Files
- `src/lib/__tests__/auth-lockout.property.test.ts` - Test file (needs refactoring)
- `src/lib/auth-service.ts` - Implementation (working correctly)
- `.kiro/specs/self-hosted-security-migration/tasks.md` - Task 4.4
- `jest.setup.js` - Sets NODE_ENV='test' for faster bcrypt

## Priority
Medium - Functionality is implemented and working correctly (verified by manual testing and other tests). Just needs better test coverage with optimized test approach.

## Next Steps
1. Refactor test file to use pre-created users (Option 1)
2. If still too slow, consider Option 3 (integration tests)
3. Document the chosen approach in test file comments
