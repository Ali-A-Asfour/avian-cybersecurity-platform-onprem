# AVIAN Platform - Alpha Testing Deployment Guide

## Overview
This guide covers deploying AVIAN for alpha testing with a real client in a secure, internal environment.

**Target Environment**: Internal server, limited access, production-ready security
**Access**: Team + Client stakeholders only
**Purpose**: Real-world testing with actual client data and workflows

---

## 🚀 Quick Deployment

### Prerequisites
- Linux server (Ubuntu 20.04+ recommended)
- Docker and Docker Compose installed
- Domain name or static IP
- SSL certificate (Let's Encrypt recommended)

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Reboot to apply Docker group changes
sudo reboot
```

### 2. Application Deployment

```bash
# Clone repository
git clone <your-repo-url>
cd avian-platform

# Configure environment
cp .env.alpha .env.production

# Generate secure secrets
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env.production
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)" >> .env.production
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env.production
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env.production

# Edit configuration
nano .env.production
# Update: DATABASE_URL, REDIS_URL, domain names, email settings

# Deploy with Docker Compose
docker-compose -f docker-compose.production.yml up -d

# Run database migrations
docker-compose -f docker-compose.production.yml exec app npm run db:migrate

# Create initial admin user (optional)
docker-compose -f docker-compose.production.yml exec app npm run db:seed
```

### 3. SSL Certificate Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## ⚙️ Configuration Details

### Environment Variables to Update

**Required Changes in `.env.production`:**

```bash
# 1. Update domain/IP
NEXT_PUBLIC_API_URL=https://your-actual-domain.com
BASE_URL=https://your-actual-domain.com
CORS_ORIGIN=https://your-actual-domain.com

# 2. Database passwords (generate strong ones)
DATABASE_URL=postgresql://avian_alpha:YOUR_STRONG_PASSWORD@localhost:5432/avian_alpha
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@localhost:6379

# 3. Email service (for real notifications)
EMAIL_USER=your-company-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
EMAIL_FROM=AVIAN Security <your-company-email@gmail.com>

# 4. Client information
CLIENT_NAME=Your_Client_Name
```

### Email Service Setup (Gmail Example)

1. **Create dedicated Gmail account** for AVIAN alerts
2. **Enable 2FA** on the Gmail account
3. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this password in `EMAIL_PASSWORD`

### SMS Setup (Optional but Recommended)

1. **Create Twilio account** (free tier includes $15 credit)
2. **Get phone number** from Twilio console
3. **Add credentials** to `.env.production`:
   ```bash
   SMS_ENABLED=true
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

---

## 🔒 Security Configuration

### Firewall Setup
```bash
# Basic firewall (adjust as needed)
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw deny 5432  # Block direct database access
sudo ufw deny 6379  # Block direct Redis access
```

### Database Security
```bash
# Create dedicated database user
sudo -u postgres psql
CREATE DATABASE avian_alpha;
CREATE USER avian_alpha WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE avian_alpha TO avian_alpha;
\q
```

### Backup Configuration
```bash
# Set up automated backups
crontab -e
# Add daily backup at 2 AM
0 2 * * * /path/to/avian-platform/scripts/backup.sh
```

---

## 🧪 Alpha Testing Features

### Pre-configured for Client Testing

**Authentication & Security:**
- ✅ Password reset via email
- ✅ Account lockout protection
- ✅ Session timeout warnings
- ✅ Admin password reset capability

**Alert Management:**
- ✅ Alert acknowledgment system
- ✅ Email notifications for critical alerts
- ✅ SMS notifications (if configured)
- ✅ Alert filtering and search

**Ticketing System:**
- ✅ Create tickets from alerts
- ✅ Assign and track tickets
- ✅ Comment system
- ✅ SLA tracking

**Admin Features:**
- ✅ User management
- ✅ Password reset for users
- ✅ System settings
- ✅ Notification preferences

### Alpha Testing Optimizations

**Relaxed Rate Limits:**
- 200 requests per 15 minutes (vs 100 in production)
- 10 login attempts per 15 minutes (vs 5)

**Enhanced Logging:**
- Detailed audit trails
- Performance metrics
- Error tracking

**Flexible Configuration:**
- Easy to adjust settings
- Feature flags for testing
- Debug information available

---

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Check application health
curl https://your-domain.com/api/health/live

# Check all services
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f app
```

### Database Maintenance
```bash
# Backup database
./scripts/backup.sh

# View database size
docker-compose -f docker-compose.production.yml exec postgres psql -U avian_alpha -d avian_alpha -c "SELECT pg_size_pretty(pg_database_size('avian_alpha'));"

# Monitor connections
docker-compose -f docker-compose.production.yml exec postgres psql -U avian_alpha -d avian_alpha -c "SELECT count(*) FROM pg_stat_activity;"
```

### Performance Monitoring
```bash
# View resource usage
docker stats

# Check disk space
df -h

# Monitor logs for errors
docker-compose -f docker-compose.production.yml logs app | grep ERROR
```

---

## 👥 User Management for Alpha Testing

### Initial Setup
```bash
# Create admin user
docker-compose -f docker-compose.production.yml exec app npm run db:seed

# Or create manually via admin interface at:
# https://your-domain.com/admin/users
```

### Default Test Accounts
After running `db:seed`, these accounts are available:

**Super Admin:**
- Email: `admin@avian-platform.com`
- Password: `Admin123!`
- Role: Super Admin

**Security Analyst:**
- Email: `analyst@avian-platform.com`
- Password: `Analyst123!`
- Role: Security Analyst

**Client User:**
- Email: `user@client.com`
- Password: `User123!`
- Role: User

### Client User Creation
1. **Via Admin Interface:**
   - Login as admin
   - Go to `/admin/users`
   - Create client users with appropriate roles

2. **Via API:**
   ```bash
   curl -X POST https://your-domain.com/api/admin/users \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "email": "client-user@client.com",
       "password": "TempPassword123!",
       "role": "user",
       "firstName": "Client",
       "lastName": "User"
     }'
   ```

---

## 🚨 Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs app

# Check environment variables
docker-compose -f docker-compose.production.yml exec app env | grep -E "(DATABASE|JWT|EMAIL)"
```

**Database connection issues:**
```bash
# Test database connection
docker-compose -f docker-compose.production.yml exec postgres psql -U avian_alpha -d avian_alpha -c "SELECT 1;"

# Check database logs
docker-compose -f docker-compose.production.yml logs postgres
```

**Email not working:**
```bash
# Test email configuration
docker-compose -f docker-compose.production.yml exec app node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
transporter.verify().then(console.log).catch(console.error);
"
```

**SSL certificate issues:**
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate
sudo certbot renew --dry-run
```

### Emergency Procedures

**Reset admin password:**
```bash
docker-compose -f docker-compose.production.yml exec app npm run reset-admin-password
```

**Restore from backup:**
```bash
./scripts/restore.sh /path/to/backup.tar.gz
```

**Emergency shutdown:**
```bash
docker-compose -f docker-compose.production.yml down
```

---

## 📋 Alpha Testing Checklist

### Pre-Deployment
- [ ] Server configured with Docker
- [ ] SSL certificate installed
- [ ] Environment variables configured
- [ ] Database passwords generated
- [ ] Email service configured
- [ ] Firewall rules applied

### Post-Deployment
- [ ] Application health check passes
- [ ] Database migrations completed
- [ ] Admin user created
- [ ] Email notifications working
- [ ] SSL certificate valid
- [ ] Backup system configured

### Client Onboarding
- [ ] Client users created
- [ ] Initial training completed
- [ ] Test alerts generated
- [ ] Ticket workflow tested
- [ ] Password reset tested
- [ ] Contact information updated

### Ongoing Monitoring
- [ ] Daily health checks
- [ ] Weekly backup verification
- [ ] Monthly security updates
- [ ] Client feedback collection
- [ ] Performance monitoring

---

## 📞 Support & Contacts

**Technical Issues:**
- Check logs first: `docker-compose logs app`
- Review troubleshooting section above
- Contact development team

**Client Issues:**
- Admin password reset: `/admin/password-reset`
- User management: `/admin/users`
- System settings: `/settings`

**Emergency Contacts:**
- Development Team: [your-team-email]
- System Administrator: [admin-email]
- Client Point of Contact: [client-email]

---

**Deployment Date:** January 19, 2024
**Version:** Alpha Testing Release
**Next Review:** Weekly during alpha testing phase
