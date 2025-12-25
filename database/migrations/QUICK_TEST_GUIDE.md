# Quick Test Guide - Firewall Migration

## 🚀 Fastest Way to Test (Docker)

```bash
# Start PostgreSQL
docker run -d --name avian-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=avian_platform_dev \
  -p 5432:5432 postgres:16

# Set environment
export DATABASE_URL=postgresql://postgres:password@localhost:5432/avian_platform_dev

# Run migrations
npx tsx scripts/run-migrations.ts

# Test migration
npx tsx scripts/test-firewall-migration.ts
```

## ✅ Expected Result

```
🎉 All tests passed! Migration is successful.

Total Tests: 7
Passed: 7
Failed: 0
```

## 📋 What Gets Tested

1. ✅ All 7 firewall tables exist
2. ✅ Table structures are correct
3. ✅ Foreign keys work
4. ✅ Indexes created
5. ✅ Constraints valid
6. ✅ Data operations work
7. ✅ Cleanup successful

## 🔧 Alternative: Local PostgreSQL

```bash
# Install (macOS)
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb avian_platform_dev

# Set environment
export DATABASE_URL=postgresql://postgres:password@localhost:5432/avian_platform_dev

# Run migrations and test
npx tsx scripts/run-migrations.ts
npx tsx scripts/test-firewall-migration.ts
```

## 📖 Full Documentation

- **Complete Guide:** `database/migrations/README_TESTING.md`
- **Test Status:** `database/migrations/MIGRATION_TEST_STATUS.md`
- **Task Summary:** `database/migrations/TASK_1.3_TESTING_COMPLETE.md`

## ❓ Troubleshooting

**Connection refused?**
→ PostgreSQL not running. Start it with Docker or brew.

**Database doesn't exist?**
→ Run: `createdb avian_platform_dev`

**No tenant found?**
→ Run: `npx tsx scripts/run-migrations.ts` (seeds default data)

## 🎯 Next Steps

After tests pass:
1. ✅ Mark Task 1.3 complete
2. ➡️ Move to Task 1.4: Implement Credential Encryption
