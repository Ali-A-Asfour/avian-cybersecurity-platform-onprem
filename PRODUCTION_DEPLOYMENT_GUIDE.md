# AVIAN Platform - Production Deployment Guide

## 🚀 Quick Start Deployment

### Prerequisites
- Ubuntu 22.04 LTS (recommended) or similar Linux distribution
- 8+ CPU cores, 16GB+ RAM, 500GB+ SSD storage
- Docker and Docker Compose installed
- Root or sudo access
- Static IP address (recommended)

### One-Command Deployment
```bash
# Clone the repository
git clone <repository-url>
cd avian-cybersecurity-platform-amualis

# Run the automated deployment script
sudo ./scripts/deploy-production.sh
```

The script will:
1. ✅ Check system requirements
2. 🔧 Generate production secrets
3. 🔐 Create SSL certificates
4. 🏗️ Build Docker images
5. 🚀 Start all services
6. 🗄️ Set up database
7. 💾 Create initial backup
8. ✅ Verify deployment

---

## 📋 Manual Deployment Steps

If you prefer manual control or need to troubleshoot:

### Step 1: System Preparation
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

# Reboot to apply changes
sudo reboot
```

### Step 2: Application Setup
```bash
# Clone repository
git clone <repository-url>
cd avian-cybersecurity-platform-amualis

# Generate production secrets
./scripts/generate-production-secrets.sh

# Generate SSL certificate
./scripts/generate-ssl-cert.sh

# Configure environment (edit as needed)
nano .env.production
```

### Step 3: Deploy Application
```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate

# Create initial backup
docker-compose -f docker-compose.prod.yml --profile backup run --rm backup /scripts/backup-database.sh
```

---

## 🔧 Configuration

### Required Environment Variables

Edit `.env.production` and update these critical settings:

```bash
# Your server's domain or IP address
NEXT_PUBLIC_API_URL=https://your-server-ip-or-domain.com
BASE_URL=https://your-server-ip-or-domain.com
NEXTAUTH_URL=https://your-server-ip-or-domain.com
CORS_ORIGIN=https://your-server-ip-or-domain.com

# Email configuration (required for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=AVIAN Security <noreply@your-domain.com>

# Optional: SMS notifications
SMS_ENABLED=true
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+15551234567
```

### SSL Certificate Options

#### Option 1: Self-Signed (Default)
```bash
./scripts/generate-ssl-cert.sh
```

#### Option 2: Let's Encrypt (Recommended for production)
```bash
# Install certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/server.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/server.key
sudo chown $USER:$USER nginx/ssl/server.*
```

#### Option 3: Commercial Certificate
Place your certificate files in:
- `nginx/ssl/server.crt` (certificate)
- `nginx/ssl/server.key` (private key)

---

## 🛠️ Management Commands

### Service Management
```bash
# View all services
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop services
docker-compose -f docker-compose.prod.yml down

# Update application
git pull
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Database Management
```bash
# Create backup
docker-compose -f docker-compose.prod.yml --profile backup run --rm backup /scripts/backup-database.sh

# Access database
docker-compose -f docker-compose.prod.yml exec postgres psql -U avian -d avian

# Run migrations
docker-compose -f docker-compose.prod.yml exec app npm run db:migrate
```

### Monitoring
```bash
# System resources
docker stats

# Application health
curl -k https://localhost/api/health

# Service logs
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f nginx
docker-compose -f docker-compose.prod.yml logs -f postgres
```

---

## 🔒 Security Checklist

### Server Security
- [ ] SSH key-only authentication
- [ ] Firewall configured (UFW)
- [ ] Fail2ban installed
- [ ] Regular security updates
- [ ] Non-root user for deployment

### Application Security
- [ ] Strong passwords generated
- [ ] SSL certificate installed
- [ ] HTTPS enforced
- [ ] Rate limiting configured
- [ ] Security headers enabled

### Network Security
- [ ] Database not exposed to internet
- [ ] Redis not exposed to internet
- [ ] Only ports 80/443 open
- [ ] VPN access for administration

---

## 📊 Monitoring & Maintenance

### Daily Checks
```bash
# Service health
docker-compose -f docker-compose.prod.yml ps

# Disk space
df -h

# Application logs
docker-compose -f docker-compose.prod.yml logs --tail=100 app | grep ERROR
```

### Weekly Tasks
```bash
# System updates
sudo apt update && sudo apt upgrade -y

# Create backup
docker-compose -f docker-compose.prod.yml --profile backup run --rm backup /scripts/backup-database.sh

# Check SSL certificate expiration
openssl x509 -in nginx/ssl/server.crt -noout -dates
```

### Monthly Tasks
- Review user access and permissions
- Analyze application performance
- Update application if new version available
- Test backup restoration process

---

## 🚨 Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check Docker daemon
sudo systemctl status docker

# Check logs
docker-compose -f docker-compose.prod.yml logs

# Restart Docker
sudo systemctl restart docker
```

#### Database Connection Issues
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Reset database password
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "ALTER USER avian PASSWORD 'new-password';"
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in nginx/ssl/server.crt -noout -text

# Regenerate certificate
./scripts/generate-ssl-cert.sh
docker-compose -f docker-compose.prod.yml restart nginx
```

#### Application Not Accessible
```bash
# Check nginx status
docker-compose -f docker-compose.prod.yml logs nginx

# Check firewall
sudo ufw status

# Test internal connectivity
docker-compose -f docker-compose.prod.yml exec nginx curl http://app:3000/api/health
```

### Emergency Recovery
```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restore from backup (if available)
# 1. Copy backup file to postgres-backups volume
# 2. Restore database
docker-compose -f docker-compose.prod.yml exec postgres psql -U avian -d avian < /backups/backup-file.sql

# Restart services
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📞 Support

### Log Files
- Application: `docker-compose -f docker-compose.prod.yml logs app`
- Nginx: `docker-compose -f docker-compose.prod.yml logs nginx`
- Database: `docker-compose -f docker-compose.prod.yml logs postgres`
- Deployment: `deployment.log`

### Health Checks
- Application: `https://your-server/api/health`
- Database: `docker-compose -f docker-compose.prod.yml exec postgres pg_isready`
- Redis: `docker-compose -f docker-compose.prod.yml exec redis redis-cli ping`

### Performance Monitoring
```bash
# Container resource usage
docker stats

# System resources
htop

# Network connections
netstat -tulpn
```

---

## 🎯 Success Criteria

Your deployment is successful when:

- ✅ All services show "Up" status
- ✅ HTTPS health check returns 200 OK
- ✅ Login page loads without errors
- ✅ User can log in successfully
- ✅ Email notifications work
- ✅ Database backup completes
- ✅ No errors in application logs

---

**Deployment completed successfully! 🎉**

Your AVIAN Platform is now ready for production use.