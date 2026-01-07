# AVIAN Platform Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered when deploying and operating the AVIAN platform. Issues are organized by category with symptoms, causes, and step-by-step solutions.

---

## Table of Contents

1. [Application Startup Issues](#application-startup-issues)
2. [Database Connection Issues](#database-connection-issues)
3. [Redis Connection Issues](#redis-connection-issues)
4. [Authentication Issues](#authentication-issues)
5. [Session Management Issues](#session-management-issues)
6. [Email Service Issues](#email-service-issues)
7. [Docker and Container Issues](#docker-and-container-issues)
8. [Nginx and SSL Issues](#nginx-and-ssl-issues)
9. [Performance Issues](#performance-issues)
10. [Security and Access Issues](#security-and-access-issues)
11. [Log Locations](#log-locations)
12. [Debugging Procedures](#debugging-procedures)

---

## Application Startup Issues

### Issue: Application fails to start with "Missing environment variables"

**Symptoms:**
- Application exits immediately on startup
- Error message: "Missing required environment variables: ..."

**Causes:**
- `.env.local` file missing or incomplete
- Environment variables not set in production

**Solutions:**

1. **Development environment:**
   ```bash
   # Copy example file
   cp .env.example .env.local
   
   # Edit and fill in all required values
   nano .env.local
   ```

2. **Production environment:**
   ```bash
   # Verify all required variables are set
   docker-compose -f docker-compose.production.yml config
   
   # Check for missing variables
   grep -E "^[A-Z_]+=" .env.production | sort
   ```

3. **Verify required variables:**
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `NEXTAUTH_SECRET`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

---

### Issue: Application starts but shows "Cannot connect to database"

**Symptoms:**
- Application starts but health checks fail
- `/api/health/ready` returns 503
- Logs show database connection errors

**Causes:**
- PostgreSQL not running
- Incorrect `DATABASE_URL`
- Network connectivity issues
- Database not initialized

**Solutions:**

1. **Verify PostgreSQL is running:**
   ```bash
   # Development
   docker-compose -f docker-compose.dev.yml ps postgres
   
   # Production
   docker-compose -f docker-compose.production.yml ps postgres
   ```

2. **Check DATABASE_URL format:**
   ```bash
   # Correct format:
   # postgresql://username:password@host:port/database
   
   # Example:
   # postgresql://avian:password@localhost:5432/avian
   ```

3. **Test database connection:**
   ```bash
   # Using psql
   psql "postgresql://avian:password@localhost:5432/avian"
   
   # Using Docker
   docker exec -it avian-postgres psql -U avian -d avian
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

---

### Issue: Application starts but shows "Cannot connect to Redis"

**Symptoms:**
- Application starts but sessions don't work
- Login fails with "Session creation failed"
- Logs show Redis connection errors

**Causes:**
- Redis not running
- Incorrect `REDIS_URL`
- Network connectivity issues

**Solutions:**

1. **Verify Redis is running:**
   ```bash
   # Development
   docker-compose -f docker-compose.dev.yml ps redis
   
   # Production
   docker-compose -f docker-compose.production.yml ps redis
   ```

2. **Check REDIS_URL format:**
   ```bash
   # Correct format:
   # redis://host:port
   
   # Example:
   # redis://localhost:6379
   ```

3. **Test Redis connection:**
   ```bash
   # Using redis-cli
   redis-cli -h localhost -p 6379 ping
   
   # Using Docker
   docker exec -it avian-redis redis-cli ping
   ```

4. **Check Redis logs:**
   ```bash
   docker logs avian-redis
   ```

---

## Database Connection Issues

### Issue: "Too many connections" error

**Symptoms:**
- Application logs show "too many clients already"
- New requests fail with database errors
- Existing connections work fine

**Causes:**
- Connection pool exhausted
- Connections not being released
- PostgreSQL max_connections limit reached

**Solutions:**

1. **Check current connections:**
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   SELECT * FROM pg_stat_activity WHERE datname = 'avian';
   ```

2. **Check PostgreSQL max_connections:**
   ```sql
   SHOW max_connections;
   ```

3. **Increase max_connections (if needed):**
   ```bash
   # Edit postgresql.conf
   max_connections = 200
   
   # Restart PostgreSQL
   docker-compose -f docker-compose.production.yml restart postgres
   ```

4. **Review connection pool settings:**
   ```typescript
   // In src/lib/database.ts
   max: 10,  // Reduce if too high
   ```

5. **Kill idle connections:**
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = 'avian'
     AND state = 'idle'
     AND state_change < now() - interval '5 minutes';
   ```

---

### Issue: Database queries are slow

**Symptoms:**
- API requests take several seconds
- Database CPU usage is high
- Queries timeout

**Causes:**
- Missing indexes
- Inefficient queries
- Large table scans
- Database not optimized

**Solutions:**

1. **Identify slow queries:**
   ```sql
   -- Enable query logging
   ALTER DATABASE avian SET log_min_duration_statement = 1000;
   
   -- View slow queries
   SELECT query, calls, total_time, mean_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

2. **Check for missing indexes:**
   ```sql
   -- Find tables without indexes
   SELECT schemaname, tablename, attname
   FROM pg_stats
   WHERE schemaname = 'public'
     AND tablename NOT IN (
       SELECT tablename FROM pg_indexes WHERE schemaname = 'public'
     );
   ```

3. **Analyze query plans:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
   ```

4. **Run VACUUM and ANALYZE:**
   ```sql
   VACUUM ANALYZE;
   ```

---

## Redis Connection Issues

### Issue: Redis memory usage is high

**Symptoms:**
- Redis uses excessive memory
- Application slows down
- Redis evicts keys unexpectedly

**Causes:**
- Too many sessions stored
- Session TTL not working
- Memory limit too low

**Solutions:**

1. **Check Redis memory usage:**
   ```bash
   docker exec -it avian-redis redis-cli INFO memory
   ```

2. **Check number of keys:**
   ```bash
   docker exec -it avian-redis redis-cli DBSIZE
   ```

3. **Check session TTL:**
   ```bash
   # Check a session key
   docker exec -it avian-redis redis-cli TTL "session:abc123"
   ```

4. **Increase Redis memory limit:**
   ```yaml
   # In docker-compose.production.yml
   redis:
     command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
   ```

5. **Clear expired sessions manually:**
   ```bash
   docker exec -it avian-redis redis-cli --scan --pattern "session:*" | xargs redis-cli DEL
   ```

---

## Authentication Issues

### Issue: Login fails with "Invalid credentials" for correct password

**Symptoms:**
- User enters correct password
- Login fails with "Invalid credentials"
- No account lockout message

**Causes:**
- Password hash mismatch
- Database migration not run
- bcrypt rounds mismatch

**Solutions:**

1. **Verify user exists:**
   ```sql
   SELECT id, email, email_verified, locked_until
   FROM users
   WHERE email = 'user@example.com';
   ```

2. **Check if email is verified:**
   ```sql
   UPDATE users
   SET email_verified = true
   WHERE email = 'user@example.com';
   ```

3. **Reset user password:**
   ```bash
   # Use password reset flow or update directly
   npm run reset-password -- user@example.com
   ```

4. **Check bcrypt configuration:**
   ```typescript
   // In src/lib/auth-service.ts
   const SALT_ROUNDS = 12;  // Should match
   ```

---

### Issue: Account locked after failed login attempts

**Symptoms:**
- User cannot login
- Error message: "Account locked due to too many failed attempts"
- Lockout persists even after waiting

**Causes:**
- Failed login threshold reached (5 attempts)
- `locked_until` timestamp not expiring
- System time incorrect

**Solutions:**

1. **Check lockout status:**
   ```sql
   SELECT email, failed_login_attempts, locked_until
   FROM users
   WHERE email = 'user@example.com';
   ```

2. **Manually unlock account:**
   ```sql
   UPDATE users
   SET failed_login_attempts = 0,
       locked_until = NULL
   WHERE email = 'user@example.com';
   ```

3. **Verify system time:**
   ```bash
   date
   docker exec -it avian-app date
   ```

4. **Check lockout duration (should be 30 minutes):**
   ```typescript
   // In src/lib/auth-service.ts
   const LOCKOUT_DURATION = 30 * 60 * 1000;  // 30 minutes
   ```

---

### Issue: JWT token validation fails

**Symptoms:**
- User logged in but API requests fail with 401
- Error: "Invalid token" or "Token expired"
- Token appears valid

**Causes:**
- JWT secret mismatch
- Token expired
- Token format incorrect
- Clock skew between servers

**Solutions:**

1. **Verify JWT secrets match:**
   ```bash
   # Check environment variables
   echo $JWT_SECRET
   echo $JWT_REFRESH_SECRET
   ```

2. **Check token expiration:**
   ```typescript
   // Decode token (without verification)
   const decoded = jwt.decode(token);
   console.log('Expires:', new Date(decoded.exp * 1000));
   ```

3. **Verify token format:**
   ```bash
   # Token should have 3 parts separated by dots
   echo $TOKEN | awk -F. '{print NF}'  # Should output 3
   ```

4. **Check for clock skew:**
   ```bash
   # Sync system time
   sudo ntpdate -s time.nist.gov
   ```

---

## Session Management Issues

### Issue: Users logged out unexpectedly

**Symptoms:**
- Users logged out after short time
- Session expires before expected
- "Session not found" errors

**Causes:**
- Session TTL too short
- Redis evicting sessions
- Session not being refreshed

**Solutions:**

1. **Check session TTL configuration:**
   ```typescript
   // In src/lib/session-manager.ts
   const SLIDING_WINDOW = 24 * 60 * 60 * 1000;  // 24 hours
   const ABSOLUTE_TIMEOUT = 7 * 24 * 60 * 60 * 1000;  // 7 days
   ```

2. **Verify session exists in Redis:**
   ```bash
   docker exec -it avian-redis redis-cli GET "session:SESSION_ID"
   ```

3. **Check Redis eviction policy:**
   ```bash
   docker exec -it avian-redis redis-cli CONFIG GET maxmemory-policy
   # Should be: allkeys-lru or noeviction
   ```

4. **Monitor session refresh:**
   ```typescript
   // Add logging to session refresh
   console.log('Session refreshed:', sessionId, 'TTL:', ttl);
   ```

---

## Email Service Issues

### Issue: Verification emails not being sent

**Symptoms:**
- User registers but doesn't receive email
- No errors in application logs
- Email service appears configured

**Causes:**
- SMTP credentials incorrect
- SMTP server blocking connection
- Email in spam folder
- Rate limiting by email provider

**Solutions:**

1. **Test SMTP connection:**
   ```bash
   # Using telnet
   telnet smtp.gmail.com 587
   
   # Using openssl for TLS
   openssl s_client -connect smtp.gmail.com:587 -starttls smtp
   ```

2. **Verify SMTP credentials:**
   ```bash
   # Check environment variables
   echo $SMTP_HOST
   echo $SMTP_PORT
   echo $SMTP_USER
   # Don't echo SMTP_PASS for security
   ```

3. **Check application logs:**
   ```bash
   docker logs avian-app | grep -i "email\|smtp"
   ```

4. **Test email sending manually:**
   ```typescript
   // Create test script
   import { sendVerificationEmail } from '@/lib/email-service';
   await sendVerificationEmail('test@example.com', 'test-token');
   ```

5. **Check spam folder and email provider logs**

6. **For Gmail, enable "Less secure app access" or use App Password**

---

### Issue: Password reset emails not working

**Symptoms:**
- User requests password reset
- No email received
- Reset token not generated

**Causes:**
- Same as verification email issues
- Token generation failing
- Database not storing token

**Solutions:**

1. **Verify token was created:**
   ```sql
   SELECT email, reset_token, reset_token_expires
   FROM users
   WHERE email = 'user@example.com';
   ```

2. **Check token expiration:**
   ```sql
   -- Token should expire in 1 hour
   SELECT reset_token_expires > NOW() as is_valid
   FROM users
   WHERE email = 'user@example.com';
   ```

3. **Follow email service troubleshooting steps above**

---

## Docker and Container Issues

### Issue: Container fails to start

**Symptoms:**
- `docker-compose up` fails
- Container exits immediately
- Error in container logs

**Causes:**
- Port already in use
- Volume mount issues
- Configuration errors
- Resource constraints

**Solutions:**

1. **Check container logs:**
   ```bash
   docker logs avian-app
   docker logs avian-postgres
   docker logs avian-redis
   ```

2. **Check port conflicts:**
   ```bash
   # Check if port is in use
   sudo lsof -i :3000
   sudo lsof -i :5432
   sudo lsof -i :6379
   ```

3. **Check Docker resources:**
   ```bash
   docker system df
   docker system prune  # Clean up if needed
   ```

4. **Verify volume permissions:**
   ```bash
   ls -la ./postgres-data
   ls -la ./redis-data
   ```

5. **Restart Docker daemon:**
   ```bash
   sudo systemctl restart docker
   ```

---

### Issue: Cannot connect to containers from host

**Symptoms:**
- Containers running but not accessible
- Connection refused errors
- Timeout errors

**Causes:**
- Ports not exposed
- Firewall blocking connections
- Wrong host/port configuration

**Solutions:**

1. **Verify ports are exposed:**
   ```bash
   docker-compose ps
   # Check PORTS column
   ```

2. **Check port mappings:**
   ```yaml
   # In docker-compose.yml
   ports:
     - "3000:3000"  # host:container
   ```

3. **Test from inside container:**
   ```bash
   docker exec -it avian-app curl http://localhost:3000/api/health
   ```

4. **Check firewall rules:**
   ```bash
   sudo ufw status
   sudo firewall-cmd --list-all
   ```

---

## Nginx and SSL Issues

### Issue: SSL certificate errors

**Symptoms:**
- Browser shows "Your connection is not private"
- SSL certificate invalid or expired
- HTTPS not working

**Causes:**
- Certificate expired
- Certificate not trusted
- Certificate path incorrect
- Certificate and key mismatch

**Solutions:**

1. **Check certificate expiration:**
   ```bash
   openssl x509 -in /etc/nginx/ssl/cert.pem -noout -dates
   ```

2. **Verify certificate and key match:**
   ```bash
   openssl x509 -noout -modulus -in /etc/nginx/ssl/cert.pem | openssl md5
   openssl rsa -noout -modulus -in /etc/nginx/ssl/key.pem | openssl md5
   # Hashes should match
   ```

3. **Test certificate chain:**
   ```bash
   openssl s_client -connect yourdomain.com:443 -showcerts
   ```

4. **Renew Let's Encrypt certificate:**
   ```bash
   sudo certbot renew
   sudo systemctl reload nginx
   ```

---

### Issue: Nginx returns 502 Bad Gateway

**Symptoms:**
- Nginx running but returns 502
- Application container running
- Health checks pass

**Causes:**
- Application not listening on correct port
- Nginx proxy_pass incorrect
- Application crashed
- Network connectivity issues

**Solutions:**

1. **Check application is running:**
   ```bash
   docker-compose ps avian-app
   curl http://localhost:3000/api/health
   ```

2. **Check Nginx configuration:**
   ```bash
   docker exec -it avian-nginx nginx -t
   ```

3. **Check Nginx logs:**
   ```bash
   docker logs avian-nginx
   ```

4. **Verify proxy_pass configuration:**
   ```nginx
   # Should point to correct container and port
   proxy_pass http://avian-app:3000;
   ```

5. **Check Docker network:**
   ```bash
   docker network inspect avian-network
   ```

---

## Performance Issues

### Issue: Application is slow to respond

**Symptoms:**
- API requests take several seconds
- Pages load slowly
- Timeouts occur

**Causes:**
- Database queries slow
- Redis connection issues
- Insufficient resources
- Network latency

**Solutions:**

1. **Check resource usage:**
   ```bash
   docker stats
   ```

2. **Check database performance:**
   ```sql
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   ```

3. **Check Redis performance:**
   ```bash
   docker exec -it avian-redis redis-cli --latency
   ```

4. **Enable application profiling:**
   ```typescript
   // Add timing logs
   console.time('database-query');
   const result = await db.query(...);
   console.timeEnd('database-query');
   ```

5. **Check network latency:**
   ```bash
   ping database-host
   ```

---

### Issue: High memory usage

**Symptoms:**
- Container using excessive memory
- Out of memory errors
- Application crashes

**Causes:**
- Memory leak
- Too many connections
- Large data sets in memory
- Insufficient memory limits

**Solutions:**

1. **Check memory usage:**
   ```bash
   docker stats avian-app
   ```

2. **Increase memory limits:**
   ```yaml
   # In docker-compose.yml
   services:
     avian-app:
       deploy:
         resources:
           limits:
             memory: 2G
   ```

3. **Monitor memory over time:**
   ```bash
   watch -n 5 'docker stats --no-stream avian-app'
   ```

4. **Check for memory leaks:**
   ```bash
   # Use Node.js heap snapshot
   node --inspect app.js
   ```

---

## Security and Access Issues

### Issue: Rate limiting blocking legitimate users

**Symptoms:**
- Users getting "Too many requests" errors
- Rate limit headers show limit reached
- Legitimate traffic blocked

**Causes:**
- Rate limits too strict
- Shared IP addresses (NAT, proxy)
- Bot traffic
- DDoS attack

**Solutions:**

1. **Check rate limit configuration:**
   ```typescript
   // In src/lib/rate-limiter.ts
   const LOGIN_LIMIT = 5;  // Increase if needed
   const API_LIMIT = 100;
   ```

2. **Check rate limit status:**
   ```bash
   docker exec -it avian-redis redis-cli KEYS "ratelimit:*"
   ```

3. **Whitelist IP addresses:**
   ```nginx
   # In nginx.conf
   geo $limit {
     default 1;
     10.0.0.0/8 0;  # Internal network
     192.168.0.0/16 0;
   }
   ```

4. **Temporarily reset rate limits:**
   ```bash
   docker exec -it avian-redis redis-cli FLUSHDB
   ```

---

### Issue: CORS errors in browser

**Symptoms:**
- Browser console shows CORS errors
- API requests fail from frontend
- "Access-Control-Allow-Origin" errors

**Causes:**
- CORS not configured
- Origin not whitelisted
- Credentials not allowed

**Solutions:**

1. **Check CORS configuration:**
   ```typescript
   // In next.config.ts
   async headers() {
     return [
       {
         source: '/api/:path*',
         headers: [
           { key: 'Access-Control-Allow-Origin', value: '*' },
           { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
         ],
       },
     ];
   }
   ```

2. **For production, whitelist specific origins:**
   ```typescript
   { key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' }
   ```

---

## Log Locations

### Application Logs

**Development:**
```bash
# Console output
npm run dev

# Docker logs
docker logs avian-app
docker logs -f avian-app  # Follow logs
```

**Production:**
```bash
# Docker logs
docker logs avian-app

# Log files (if configured)
/var/log/avian/app.log
/var/log/avian/error.log
```

### Database Logs

```bash
# Docker logs
docker logs avian-postgres

# PostgreSQL log files
docker exec -it avian-postgres cat /var/lib/postgresql/data/log/postgresql.log
```

### Redis Logs

```bash
# Docker logs
docker logs avian-redis

# Redis log file
docker exec -it avian-redis cat /var/log/redis/redis-server.log
```

### Nginx Logs

```bash
# Docker logs
docker logs avian-nginx

# Access logs
docker exec -it avian-nginx cat /var/log/nginx/access.log

# Error logs
docker exec -it avian-nginx cat /var/log/nginx/error.log
```

### Audit Logs

```sql
-- Authentication audit logs
SELECT * FROM authentication_audit_log
ORDER BY created_at DESC
LIMIT 100;

-- General audit logs
SELECT * FROM audit_log
ORDER BY created_at DESC
LIMIT 100;
```

---

## Debugging Procedures

### General Debugging Workflow

1. **Identify the issue:**
   - What is the error message?
   - When did it start?
   - What changed recently?

2. **Check logs:**
   - Application logs
   - Database logs
   - Redis logs
   - Nginx logs

3. **Verify services are running:**
   ```bash
   docker-compose ps
   ```

4. **Check health endpoints:**
   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3000/api/health/ready
   ```

5. **Test individual components:**
   - Database connection
   - Redis connection
   - Email service
   - Authentication

6. **Review recent changes:**
   ```bash
   git log --oneline -10
   git diff HEAD~1
   ```

### Enable Debug Logging

**Application:**
```bash
# Set LOG_LEVEL in .env.local
LOG_LEVEL=debug

# Restart application
docker-compose restart avian-app
```

**PostgreSQL:**
```sql
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();
```

**Redis:**
```bash
# Edit redis.conf
loglevel debug

# Restart Redis
docker-compose restart redis
```

### Interactive Debugging

**Access container shell:**
```bash
docker exec -it avian-app sh
docker exec -it avian-postgres bash
docker exec -it avian-redis sh
```

**Run commands inside container:**
```bash
# Check environment variables
docker exec -it avian-app env

# Check file system
docker exec -it avian-app ls -la /app

# Check network connectivity
docker exec -it avian-app ping avian-postgres
```

### Database Debugging

**Connect to database:**
```bash
docker exec -it avian-postgres psql -U avian -d avian
```

**Useful queries:**
```sql
-- Check active connections
SELECT * FROM pg_stat_activity;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Redis Debugging

**Connect to Redis:**
```bash
docker exec -it avian-redis redis-cli
```

**Useful commands:**
```bash
# Check memory usage
INFO memory

# Check number of keys
DBSIZE

# List all keys (use with caution in production)
KEYS *

# Check specific key
GET session:abc123
TTL session:abc123

# Monitor commands in real-time
MONITOR
```

---

## Getting Help

If you cannot resolve an issue using this guide:

1. **Check application logs** for detailed error messages
2. **Review recent changes** that might have caused the issue
3. **Search GitHub issues** for similar problems
4. **Contact support** with:
   - Detailed description of the issue
   - Error messages and logs
   - Steps to reproduce
   - Environment information (OS, Docker version, etc.)

---

## Appendix: Common Error Messages

| Error Message | Likely Cause | Solution |
|--------------|--------------|----------|
| "ECONNREFUSED" | Service not running | Start the service |
| "ENOTFOUND" | DNS resolution failed | Check hostname/DNS |
| "ETIMEDOUT" | Network timeout | Check firewall/network |
| "EADDRINUSE" | Port already in use | Kill process or change port |
| "Permission denied" | File permissions | Fix permissions with chmod/chown |
| "No space left on device" | Disk full | Clean up disk space |
| "Out of memory" | Memory exhausted | Increase memory limits |
| "Connection pool exhausted" | Too many connections | Increase pool size or fix leaks |
| "Invalid credentials" | Wrong username/password | Verify credentials |
| "Token expired" | JWT expired | Refresh token or re-login |
| "Rate limit exceeded" | Too many requests | Wait or increase limits |
| "CORS error" | CORS not configured | Configure CORS headers |

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Maintained By:** AVIAN Platform Team
