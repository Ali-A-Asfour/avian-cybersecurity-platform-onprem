# AVIAN Platform - Server Management Guide
## Complete Operations Manual for Ubuntu 24.04.03

This comprehensive guide covers all aspects of managing your AVIAN Platform on Ubuntu 24.04.03.

## 📋 Table of Contents

1. [Daily Operations](#daily-operations)
2. [Monitoring & Health Checks](#monitoring--health-checks)
3. [Backup & Recovery](#backup--recovery)
4. [Updates & Maintenance](#updates--maintenance)
5. [Security Management](#security-management)
6. [Performance Optimization](#performance-optimization)
7. [Troubleshooting](#troubleshooting)
8. [Emergency Procedures](#emergency-procedures)

---

## 🔄 Daily Operations

### Morning Health Check
```bash
# Run comprehensive health check
sudo ./health-check.sh

# Quick service status
sudo docker-compose -f docker-compose.server.yml ps

# Check system resources
sudo docker stats --no-stream

# Review overnight logs
sudo docker-compose -f docker-compose.server.yml logs --since="24h" | grep -i error
```

### Service Management Commands
```bash
# Start all services
sudo docker-compose -f docker-compose.server.yml up -d

# Stop all services
sudo docker-compose -f docker-compose.server.yml down

# Restart specific service
sudo docker-compose -f docker-compose.server.yml restart [service-name]

# View service logs
sudo docker-compose -f docker-compose.server.yml logs -f [service-name]

# Scale services (if needed)
sudo docker-compose -f docker-compose.server.yml up -d --scale app=2
```

### Available Services
- `nginx` - Web server and reverse proxy
- `app` - Main AVIAN application
- `postgres` - Database server
- `redis` - Cache and session store

---

## 📊 Monitoring & Health Checks

### Automated Health Monitoring
```bash
# Full system health check
sudo ./health-check.sh

# Quick application health
curl -k https://192.168.1.115/api/health

# Database health
sudo docker-compose -f docker-compose.server.yml exec postgres pg_isready -U avian -d avian

# Redis health
sudo docker-compose -f docker-compose.server.yml exec redis redis-cli ping
```

### Performance Monitoring
```bash
# Container resource usage
sudo docker stats

# System resource usage
htop

# Disk usage
df -h

# Network connections
sudo netstat -tulpn | grep -E ':(80|443|5432|6379)'

# Memory usage by service
sudo docker-compose -f docker-compose.server.yml exec app ps aux --sort=-%mem | head -10
```

### Log Analysis
```bash
# Application errors (last 100 lines)
sudo docker-compose -f docker-compose.server.yml logs --tail=100 app | grep -i error

# Nginx access logs
sudo docker-compose -f docker-compose.server.yml logs nginx | grep -E '(4[0-9]{2}|5[0-9]{2})'

# Database slow queries
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Security events
sudo journalctl -u fail2ban --since="24 hours ago"
```

### Custom Monitoring Setup
```bash
# Create monitoring script
cat > /usr/local/bin/avian-monitor.sh << 'EOF'
#!/bin/bash
# AVIAN Platform Monitoring Script

# Check if all services are running
SERVICES_DOWN=$(docker-compose -f /path/to/docker-compose.server.yml ps --services --filter "status=exited" | wc -l)

if [ $SERVICES_DOWN -gt 0 ]; then
    echo "ALERT: $SERVICES_DOWN services are down" | mail -s "AVIAN Alert" admin@yourdomain.com
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "ALERT: Disk usage is ${DISK_USAGE}%" | mail -s "AVIAN Disk Alert" admin@yourdomain.com
fi
EOF

chmod +x /usr/local/bin/avian-monitor.sh

# Add to cron (every 5 minutes)
(crontab -l; echo "*/5 * * * * /usr/local/bin/avian-monitor.sh") | crontab -
```

---

## 💾 Backup & Recovery

### Automated Backup System
```bash
# Manual backup
sudo ./scripts/backup-server.sh

# Check backup status
ls -la /var/backups/avian-*

# Verify backup integrity
sudo gzip -t /var/backups/avian-database-*.sql.gz
```

### Backup Schedule Management
```bash
# View current cron jobs
sudo crontab -l

# Edit backup schedule
sudo crontab -e

# Example schedules:
# Every 6 hours: 0 */6 * * * /usr/local/bin/avian-backup.sh
# Daily at 2 AM: 0 2 * * * /usr/local/bin/avian-backup.sh
# Weekly on Sunday: 0 2 * * 0 /usr/local/bin/avian-backup.sh
```

### Recovery Procedures
```bash
# List available backups
ls -la /var/backups/avian-database-*.sql.gz | tail -10

# Full system restore
sudo ./scripts/restore-server.sh TIMESTAMP

# Database-only restore
sudo ./scripts/restore-server.sh --database-only TIMESTAMP

# Configuration-only restore
sudo ./scripts/restore-server.sh --config-only TIMESTAMP

# Application data restore
sudo ./scripts/restore-server.sh --data-only TIMESTAMP
```

### Backup Best Practices
```bash
# Test restore procedure monthly
sudo ./scripts/restore-server.sh --database-only $(ls /var/backups/avian-database-*.sql.gz | tail -1 | sed 's/.*avian-database-\(.*\)\.sql\.gz/\1/')

# Offsite backup (example with rsync)
rsync -avz /var/backups/avian-* backup-server:/remote/backup/path/

# Backup verification script
cat > /usr/local/bin/verify-backups.sh << 'EOF'
#!/bin/bash
for backup in /var/backups/avian-database-*.sql.gz; do
    if ! gzip -t "$backup" 2>/dev/null; then
        echo "CORRUPTED: $backup"
    fi
done
EOF
```

---

## 🔄 Updates & Maintenance

### System Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Update Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Application Updates
```bash
# Safe application update
sudo ./update-server.sh

# Manual update process
git pull origin main
sudo docker-compose -f docker-compose.server.yml build --no-cache
sudo docker-compose -f docker-compose.server.yml up -d
```

### Maintenance Windows
```bash
# Schedule maintenance mode
cat > /usr/local/bin/maintenance-mode.sh << 'EOF'
#!/bin/bash
case $1 in
    on)
        # Create maintenance page
        echo "System under maintenance" > /tmp/maintenance.html
        # Redirect traffic to maintenance page
        ;;
    off)
        # Remove maintenance mode
        rm -f /tmp/maintenance.html
        ;;
esac
EOF
```

### Database Maintenance
```bash
# Database vacuum and analyze
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian -c "VACUUM ANALYZE;"

# Reindex database
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian -c "REINDEX DATABASE avian;"

# Check database statistics
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian -c "SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del FROM pg_stat_user_tables;"
```

---

## 🛡️ Security Management

### Firewall Management
```bash
# Check firewall status
sudo ufw status verbose

# Add new rule
sudo ufw allow from 192.168.1.0/24 to any port 22

# Remove rule
sudo ufw delete allow 80

# Reset firewall (careful!)
sudo ufw --force reset
```

### Fail2ban Management
```bash
# Check fail2ban status
sudo fail2ban-client status

# Check specific jail
sudo fail2ban-client status sshd

# Unban IP address
sudo fail2ban-client set sshd unbanip 192.168.1.100

# Add IP to whitelist
sudo fail2ban-client set sshd addignoreip 192.168.1.100
```

### SSL Certificate Management
```bash
# Check certificate expiration
openssl x509 -in nginx/ssl/server.crt -noout -dates

# Generate new certificate
sudo ./scripts/generate-ssl-cert.sh

# Install Let's Encrypt certificate (if domain available)
sudo certbot certonly --standalone -d yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/server.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/server.key
```

### Security Auditing
```bash
# Check for security updates
sudo apt list --upgradable | grep -i security

# Audit user accounts
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian -c "SELECT email, role, created_at, last_login FROM users;"

# Check failed login attempts
sudo docker-compose -f docker-compose.server.yml logs app | grep -i "failed login"

# Review system logs for security events
sudo journalctl --since="24 hours ago" | grep -i -E "(failed|error|unauthorized|denied)"
```

---

## ⚡ Performance Optimization

### Database Optimization
```bash
# Analyze database performance
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Optimize database configuration
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian -c "SHOW shared_buffers;"

# Check index usage
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian -c "SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes ORDER BY idx_scan DESC;"
```

### Application Performance
```bash
# Monitor application metrics
curl -k https://192.168.1.115/api/metrics

# Check memory usage
sudo docker-compose -f docker-compose.server.yml exec app node -e "console.log(process.memoryUsage())"

# Profile application performance
sudo docker-compose -f docker-compose.server.yml exec app npm run profile
```

### System Optimization
```bash
# Optimize Docker
sudo docker system prune -f

# Clean up logs
sudo journalctl --vacuum-time=7d

# Optimize disk I/O
sudo echo 'vm.swappiness=10' >> /etc/sysctl.conf
sudo sysctl -p
```

### Scaling Considerations
```bash
# Scale application horizontally
sudo docker-compose -f docker-compose.server.yml up -d --scale app=3

# Load balancer configuration (nginx)
# Edit nginx/server.conf to add multiple upstream servers

# Database connection pooling
# Configure in application settings
```

---

## 🚨 Troubleshooting

### Common Issues and Solutions

#### Services Won't Start
```bash
# Check Docker daemon
sudo systemctl status docker
sudo systemctl restart docker

# Check disk space
df -h

# Check memory usage
free -h

# Review service logs
sudo docker-compose -f docker-compose.server.yml logs [service-name]
```

#### Database Connection Issues
```bash
# Check database status
sudo docker-compose -f docker-compose.server.yml exec postgres pg_isready

# Check database logs
sudo docker-compose -f docker-compose.server.yml logs postgres

# Reset database connections
sudo docker-compose -f docker-compose.server.yml restart postgres

# Check database configuration
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian -c "SHOW max_connections;"
```

#### Application Performance Issues
```bash
# Check application logs
sudo docker-compose -f docker-compose.server.yml logs app | grep -i -E "(error|slow|timeout)"

# Monitor resource usage
sudo docker stats avian-app-server

# Check database queries
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian -c "SELECT query, mean_time FROM pg_stat_statements WHERE mean_time > 1000 ORDER BY mean_time DESC;"
```

#### Network Connectivity Issues
```bash
# Check port availability
sudo netstat -tulpn | grep -E ':(80|443)'

# Test internal connectivity
sudo docker-compose -f docker-compose.server.yml exec app ping postgres

# Check firewall rules
sudo ufw status numbered

# Test external connectivity
curl -k https://192.168.1.115/api/health
```

### Diagnostic Commands
```bash
# Generate system report
cat > /tmp/system-report.txt << EOF
System Information:
$(uname -a)
$(lsb_release -a)

Docker Information:
$(docker version)
$(docker-compose --version)

Service Status:
$(sudo docker-compose -f docker-compose.server.yml ps)

Resource Usage:
$(free -h)
$(df -h)

Network Status:
$(sudo netstat -tulpn | grep -E ':(80|443|5432|6379)')

Recent Errors:
$(sudo docker-compose -f docker-compose.server.yml logs --since="1h" | grep -i error | tail -20)
EOF

echo "System report generated: /tmp/system-report.txt"
```

---

## 🚑 Emergency Procedures

### Service Recovery
```bash
# Emergency restart all services
sudo docker-compose -f docker-compose.server.yml down
sudo docker-compose -f docker-compose.server.yml up -d

# Force rebuild if corrupted
sudo docker-compose -f docker-compose.server.yml down
sudo docker system prune -af
sudo docker-compose -f docker-compose.server.yml build --no-cache
sudo docker-compose -f docker-compose.server.yml up -d
```

### Database Recovery
```bash
# Emergency database restore
sudo docker-compose -f docker-compose.server.yml down
sudo ./scripts/restore-server.sh --database-only $(ls /var/backups/avian-database-*.sql.gz | tail -1 | sed 's/.*avian-database-\(.*\)\.sql\.gz/\1/')
sudo docker-compose -f docker-compose.server.yml up -d
```

### Security Incident Response
```bash
# Immediate lockdown
sudo ufw deny incoming
sudo docker-compose -f docker-compose.server.yml down

# Investigate
sudo journalctl --since="1 hour ago" | grep -i -E "(failed|unauthorized|attack)"
sudo fail2ban-client status

# Recovery
# 1. Analyze logs
# 2. Update security rules
# 3. Restore from clean backup if needed
# 4. Restart services
```

### Disaster Recovery
```bash
# Complete system rebuild
sudo ./deploy-to-server.sh

# Restore from backup
sudo ./scripts/restore-server.sh LATEST_BACKUP_TIMESTAMP

# Verify integrity
sudo ./health-check.sh
```

---

## 📞 Support Contacts

### Log Locations
- **Deployment logs**: `deployment.log`
- **Application logs**: `docker-compose -f docker-compose.server.yml logs app`
- **System logs**: `journalctl -u docker`
- **Security logs**: `journalctl -u fail2ban`

### Key Files
- **Configuration**: `.env.server`
- **Docker Compose**: `docker-compose.server.yml`
- **Nginx Config**: `nginx/server.conf`
- **SSL Certificates**: `nginx/ssl/`
- **Admin Credentials**: `admin-credentials.txt`

### Emergency Contacts
- **System Administrator**: [Your contact info]
- **Security Team**: [Security contact]
- **Vendor Support**: [Vendor contact if applicable]

---

**This guide covers comprehensive server management for your AVIAN Platform. Keep it handy for daily operations and emergency situations.**