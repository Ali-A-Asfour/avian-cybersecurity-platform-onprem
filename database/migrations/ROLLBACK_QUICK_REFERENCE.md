# Firewall Integration Rollback - Quick Reference

## 🚀 Quick Start

### Execute Rollback (Automated Test)
```bash
npm run test:firewall-rollback
```

### Execute Rollback (Manual)
```bash
psql -U postgres -d avian_db -f database/migrations/rollback_firewall_integration.sql
```

## 📋 Pre-Rollback Checklist

- [ ] Backup database: `pg_dump -U postgres -d avian_db -F c -f backup.dump`
- [ ] Verify no active connections to firewall tables
- [ ] Confirm you want to delete ALL firewall data
- [ ] Note: This action cannot be undone

## 🔍 Verify Rollback Success

```sql
-- Should return 0 rows
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'firewall_%';
```

## 🔄 Re-apply Migrations

```bash
npm run db:migrate
```

## 📊 What Gets Removed

| Object Type | Count | Examples |
|-------------|-------|----------|
| Tables | 7 | firewall_devices, firewall_alerts, etc. |
| Functions | 4 | cleanup_firewall_retention_all(), etc. |
| Indexes | 30+ | All firewall-related indexes |
| Constraints | 40+ | Foreign keys, check constraints |
| Schedules | 1 | firewall-retention-cleanup (pg_cron) |

## ⚠️ Important Notes

- **Data Loss:** All firewall data will be permanently deleted
- **Transaction:** Rollback is wrapped in BEGIN/COMMIT
- **Idempotent:** Can be run multiple times safely
- **Dependencies:** Handles foreign keys automatically with CASCADE

## 🆘 Troubleshooting

### Issue: Permission Denied
```sql
-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO your_user;
```

### Issue: Active Connections
```sql
-- Terminate active connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'avian_db' 
AND pid <> pg_backend_pid();
```

### Issue: Foreign Key Errors
The rollback handles this automatically with CASCADE, but if needed:
```sql
DROP TABLE firewall_devices CASCADE;
```

## 📚 Full Documentation

For complete documentation, see:
- `database/migrations/README_ROLLBACK.md` - Comprehensive guide
- `database/migrations/ROLLBACK_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `scripts/test-firewall-rollback.ts` - Automated test script

## 🔗 Related Commands

```bash
# Check database size before rollback
psql -U postgres -d avian_db -c "SELECT pg_size_pretty(pg_database_size('avian_db'));"

# List all firewall tables
psql -U postgres -d avian_db -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'firewall_%';"

# Count records in firewall tables
psql -U postgres -d avian_db -c "SELECT 'firewall_devices' as table, COUNT(*) FROM firewall_devices UNION ALL SELECT 'firewall_alerts', COUNT(*) FROM firewall_alerts;"

# Backup only firewall tables
pg_dump -U postgres -d avian_db -t 'firewall_*' -F c -f firewall_backup.dump

# Restore from backup
pg_restore -U postgres -d avian_db firewall_backup.dump
```

## ✅ Success Indicators

After rollback, you should see:
- ✅ 0 firewall tables
- ✅ 0 firewall functions
- ✅ 0 firewall cron schedules
- ✅ No errors in PostgreSQL logs
- ✅ Transaction committed successfully

## 🎯 Common Use Cases

### Development Testing
```bash
# Rollback and re-apply for testing
npm run test:firewall-rollback
npm run db:migrate
```

### Schema Redesign
```bash
# Backup, rollback, modify migrations, re-apply
pg_dump -U postgres -d avian_db -F c -f backup.dump
npm run test:firewall-rollback
# Modify migration files
npm run db:migrate
```

### Emergency Cleanup
```bash
# Quick removal of firewall integration
psql -U postgres -d avian_db -f database/migrations/rollback_firewall_integration.sql
```

---

**Last Updated:** December 7, 2025  
**Version:** 1.0  
**Status:** Production Ready
