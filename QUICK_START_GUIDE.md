# AVIAN Platform - Quick Start Guide
## Ubuntu 24.04.03 Server (192.168.1.115)

This guide will get your AVIAN Cybersecurity Platform up and running in under 30 minutes.

## 🚀 One-Command Deployment

### Prerequisites
- Ubuntu 24.04.03 server with sudo access
- Internet connection
- 8+ CPU cores, 16GB+ RAM, 500GB+ storage

### Deploy Now
```bash
# On your Ubuntu server (192.168.1.115)
git clone <this-repository>
cd avian-cybersecurity-platform
sudo ./deploy-to-server.sh
```

That's it! The script will:
- ✅ Install Docker and dependencies
- ✅ Configure firewall and security
- ✅ Generate SSL certificates
- ✅ Build and start all services
- ✅ Set up database and migrations
- ✅ Create automated backups
- ✅ Provide admin credentials

## 📱 Access Your Platform

After deployment completes:

1. **Open your browser**: https://192.168.1.115
2. **Login with admin credentials** (shown at end of deployment)
3. **Change the default password** immediately
4. **Start using your cybersecurity platform!**

## 🔧 Essential Commands

### Check Status
```bash
sudo ./health-check.sh
```

### View Logs
```bash
sudo docker-compose -f docker-compose.server.yml logs -f
```

### Create Backup
```bash
sudo ./scripts/backup-server.sh
```

### Update Platform
```bash
sudo ./update-server.sh
```

### Restart Services
```bash
sudo docker-compose -f docker-compose.server.yml restart
```

## 🛡️ Security Features

Your platform includes:
- **HTTPS encryption** with self-signed certificates
- **Firewall protection** (UFW configured)
- **Intrusion prevention** (Fail2ban active)
- **Database encryption** at rest
- **Secure Docker networking**
- **Automated security updates**

## 📊 What You Get

### Core Features
- **Dashboard**: Real-time security monitoring
- **Ticket System**: Incident management
- **Alert Management**: Automated notifications
- **User Management**: Role-based access control
- **Reporting**: Compliance and security reports
- **Asset Management**: IT inventory tracking

### Integrations Ready
- **Email notifications** (configure SMTP)
- **SMS alerts** (Twilio integration)
- **API endpoints** for external tools
- **Webhook support** for automation

## 🔧 Configuration

### Email Setup (Recommended)
1. Login to admin panel
2. Go to Settings → Notifications
3. Configure SMTP settings:
   - Host: your-smtp-server.com
   - Port: 587 (TLS) or 465 (SSL)
   - Username/Password: your email credentials

### User Management
1. Go to Admin → Users
2. Create additional user accounts
3. Assign appropriate roles:
   - **Admin**: Full system access
   - **Analyst**: Security monitoring
   - **Helpdesk**: Ticket management
   - **Viewer**: Read-only access

### System Monitoring
- **Health checks**: Automated every 30 seconds
- **Backups**: Every 6 hours automatically
- **Log rotation**: Daily cleanup
- **Resource monitoring**: Built-in dashboards

## 🚨 Troubleshooting

### Common Issues

**Can't access https://192.168.1.115**
```bash
# Check if services are running
sudo docker-compose -f docker-compose.server.yml ps

# Check firewall
sudo ufw status

# Check logs
sudo docker-compose -f docker-compose.server.yml logs nginx
```

**SSL Certificate Warnings**
- Normal for self-signed certificates
- Click "Advanced" → "Proceed to site" in browser
- Or install certificate in browser/OS trust store

**Forgot Admin Password**
```bash
# Check admin credentials file
sudo cat admin-credentials.txt

# Or reset via database (advanced)
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian
```

**Services Won't Start**
```bash
# Check Docker daemon
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker

# Rebuild and restart
sudo docker-compose -f docker-compose.server.yml down
sudo docker-compose -f docker-compose.server.yml up -d --build
```

## 📞 Support

### Log Files
- **Deployment**: `deployment.log`
- **Application**: `sudo docker-compose -f docker-compose.server.yml logs app`
- **Database**: `sudo docker-compose -f docker-compose.server.yml logs postgres`
- **Web server**: `sudo docker-compose -f docker-compose.server.yml logs nginx`

### Health Monitoring
```bash
# Full health check
sudo ./health-check.sh

# Quick status
sudo docker-compose -f docker-compose.server.yml ps

# Resource usage
sudo docker stats
```

### Backup & Recovery
```bash
# Create backup
sudo ./scripts/backup-server.sh

# List backups
ls -la /var/backups/avian-*

# Restore from backup
sudo ./scripts/restore-server.sh TIMESTAMP
```

## 🎯 Next Steps

### Day 1
1. ✅ Change admin password
2. ✅ Configure email notifications
3. ✅ Create user accounts for your team
4. ✅ Test all major features

### Week 1
1. Set up monitoring dashboards
2. Configure alert rules
3. Import your asset inventory
4. Set up automated reports
5. Train your team on the platform

### Month 1
1. Review security policies
2. Optimize alert thresholds
3. Set up integrations with existing tools
4. Establish backup/recovery procedures
5. Plan for scaling and growth

## 🌟 Success Indicators

Your deployment is successful when:
- ✅ All services show "Up" status
- ✅ HTTPS health check returns 200 OK
- ✅ Admin can login successfully
- ✅ Email notifications work (if configured)
- ✅ Backups complete without errors
- ✅ No critical errors in logs

---

**🎉 Congratulations! Your AVIAN Cybersecurity Platform is ready for production use.**

Need help? Check the troubleshooting section above or review the detailed logs for specific error messages.