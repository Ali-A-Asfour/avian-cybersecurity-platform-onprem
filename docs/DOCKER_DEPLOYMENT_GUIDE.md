# AVIAN Platform - Docker Deployment Guide

This guide provides complete instructions for deploying the AVIAN platform using Docker in both development and production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Development)](#quick-start-development)
3. [Production Deployment](#production-deployment)
4. [Environment Configuration](#environment-configuration)
5. [SSL/TLS Certificate Setup](#ssltls-certificate-setup)
6. [Database Setup](#database-setup)
7. [Backup and Recovery](#backup-and-recovery)
8. [Monitoring and Health Checks](#monitoring-and-health-checks)
9. [Troubleshooting](#troubleshooting)
10. [Security Best Practices](#security-best-practices)

---

## Prerequisites

### Required Software

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **Git**: For cloning the repository

### System Requirements

**Minimum**:
- 2 CPU cores
- 4 GB RAM
- 20 GB disk space

**Recommended (Production)**:
- 4+ CPU cores
- 8+ GB RAM
- 50+ GB disk space (SSD preferred)

### Installation

#### Ubuntu/Debian

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

#### macOS

```bash
# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Verify installation
docker --version
docker compose version
```

#### Windows

1. Install Docker Desktop from https://www.docker.com/products/docker-desktop
2. Enable WSL 2 backend
3. Verify installation in PowerShell:
   ```powershell
   docker --version
   docker compose version
   ```

---

## Quick Start (Development)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd avian-platform
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables (use development defaults)
nano .env.local
```

**Minimum required variables for development**:
```env
DATABASE_URL=postgresql://avian:avian_dev_password@postgres:5432/avian
REDIS_URL=redis://:avian_dev_redis_password@redis:6379
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_REFRESH_SECRET=dev_jwt_refresh_secret_change_in_production
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev_nextauth_secret_change_in_production
```

### 3. Start Services

```bash
# Start all services in detached mode
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Check service status
docker compose -f docker-compose.dev.yml ps
```

### 4. Run Database Migrations

```bash
# Access the app container
docker compose -f docker-compose.dev.yml exec app sh

# Run migrations
npm run db:migrate

# Exit container
exit
```

### 5. Access the Application

- **Application**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 6. Stop Services

```bash
# Stop services
docker compose -f docker-compose.dev.yml down

# Stop and remove volumes (WARNING: deletes data)
docker compose -f docker-compose.dev.yml down -v
```

---

## Production Deployment

### Step 1: Server Setup

#### 1.1 Provision Server

**Recommended Specifications**:
- Ubuntu 22.04 LTS or later
- 4+ CPU cores
- 8+ GB RAM
- 50+ GB SSD storage
- Static IP address
- Domain name configured

#### 1.2 Initial Server Configuration

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install required packages
sudo apt-get install -y \
  curl \
  git \
  ufw \
  certbot

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Verify firewall
sudo ufw status
```

#### 1.3 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get install docker-compose-plugin

# Start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Step 2: Clone and Configure

#### 2.1 Clone Repository

```bash
# Clone to /opt/avian (recommended for production)
sudo mkdir -p /opt/avian
sudo chown $USER:$USER /opt/avian
cd /opt/avian
git clone <repository-url> .
```

#### 2.2 Configure Environment Variables

```bash
# Copy production template
cp .env.production.template .env.production

# Edit with production values
nano .env.production
```

**Required production variables**:
```env
# Database
DATABASE_URL=postgresql://avian:STRONG_PASSWORD_HERE@postgres:5432/avian
POSTGRES_DB=avian
POSTGRES_USER=avian
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE

# Redis
REDIS_URL=redis://:STRONG_PASSWORD_HERE@redis:6379
REDIS_PASSWORD=STRONG_PASSWORD_HERE

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=GENERATED_SECRET_HERE
JWT_REFRESH_SECRET=GENERATED_SECRET_HERE

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=GENERATED_SECRET_HERE

# SMTP (for email)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@your-domain.com

# Application
NODE_ENV=production
```

#### 2.3 Generate Secrets

```bash
# Generate strong secrets
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
```

### Step 3: SSL/TLS Certificate Setup

#### Option A: Let's Encrypt (Recommended)

```bash
# Stop any services using port 80
sudo systemctl stop nginx 2>/dev/null || true

# Obtain certificate
sudo certbot certonly --standalone \
  -d your-domain.com \
  -d www.your-domain.com \
  --agree-tos \
  --email your-email@example.com

# Create SSL directory
mkdir -p nginx/ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# Set permissions
sudo chown $USER:$USER nginx/ssl/*.pem
chmod 644 nginx/ssl/cert.pem
chmod 600 nginx/ssl/key.pem
```

#### Option B: Self-Signed Certificate (Testing Only)

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"

# Set permissions
chmod 644 nginx/ssl/cert.pem
chmod 600 nginx/ssl/key.pem
```

**⚠️ Warning**: Self-signed certificates should NOT be used in production.

#### Setup Auto-Renewal (Let's Encrypt)

```bash
# Test renewal
sudo certbot renew --dry-run

# Create renewal script
sudo tee /etc/cron.daily/certbot-renew << 'EOF'
#!/bin/bash
certbot renew --quiet --post-hook "cd /opt/avian && docker compose -f docker-compose.production.yml restart nginx"
EOF

# Make executable
sudo chmod +x /etc/cron.daily/certbot-renew
```

### Step 4: Build and Deploy

#### 4.1 Build Images

```bash
cd /opt/avian

# Build the application image
docker compose -f docker-compose.production.yml build

# Verify build
docker images | grep avian
```

#### 4.2 Start Services

```bash
# Start all services
docker compose -f docker-compose.production.yml up -d

# View logs
docker compose -f docker-compose.production.yml logs -f

# Check service status
docker compose -f docker-compose.production.yml ps
```

Expected output:
```
NAME                IMAGE               STATUS              PORTS
avian-nginx         nginx:alpine        Up (healthy)        0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
avian-app           avian-app:latest    Up (healthy)        
avian-postgres      postgres:16-alpine  Up (healthy)        
avian-redis         redis:7-alpine      Up (healthy)        
```

#### 4.3 Run Database Migrations

```bash
# Wait for database to be ready (check logs)
docker compose -f docker-compose.production.yml logs postgres

# Run migrations
docker compose -f docker-compose.production.yml exec app node -e "
  const { exec } = require('child_process');
  exec('npm run db:migrate', (error, stdout, stderr) => {
    console.log(stdout);
    if (error) console.error(stderr);
  });
"
```

#### 4.4 Verify Deployment

```bash
# Check health endpoints
curl http://localhost/health
curl https://your-domain.com/api/health

# Check all services are healthy
docker compose -f docker-compose.production.yml ps

# View application logs
docker compose -f docker-compose.production.yml logs app
```

### Step 5: Post-Deployment Configuration

#### 5.1 Create Admin User

```bash
# Access the app container
docker compose -f docker-compose.production.yml exec app sh

# Run user creation script (if available)
# Or use the application's admin interface
```

#### 5.2 Configure Monitoring

See [Monitoring and Health Checks](#monitoring-and-health-checks) section.

#### 5.3 Setup Backups

See [Backup and Recovery](#backup-and-recovery) section.

---

## Environment Configuration

### Development Environment Variables

```env
# Database
DATABASE_URL=postgresql://avian:avian_dev_password@postgres:5432/avian

# Redis
REDIS_URL=redis://:avian_dev_redis_password@redis:6379

# JWT Secrets (development only)
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_REFRESH_SECRET=dev_jwt_refresh_secret_change_in_production

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev_nextauth_secret_change_in_production

# Application
NODE_ENV=development
```

### Production Environment Variables

```env
# Database
DATABASE_URL=postgresql://avian:${POSTGRES_PASSWORD}@postgres:5432/avian
POSTGRES_DB=avian
POSTGRES_USER=avian
POSTGRES_PASSWORD=<generate-strong-password>

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
REDIS_PASSWORD=<generate-strong-password>

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=<generated-secret>
JWT_REFRESH_SECRET=<generated-secret>

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<generated-secret>

# SMTP Configuration
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@your-domain.com

# Application
NODE_ENV=production
```

---

## SSL/TLS Certificate Setup

See [Step 3: SSL/TLS Certificate Setup](#step-3-ssltls-certificate-setup) in the Production Deployment section.

For detailed SSL configuration, see `nginx/README.md`.

---

## Database Setup

### Initial Setup

Database is automatically initialized when you start the services. Migrations are run separately.

### Running Migrations

```bash
# Development
docker compose -f docker-compose.dev.yml exec app npm run db:migrate

# Production
docker compose -f docker-compose.production.yml exec app npm run db:migrate
```

### Database Access

```bash
# Development (PostgreSQL exposed on port 5432)
psql postgresql://avian:avian_dev_password@localhost:5432/avian

# Production (access through Docker)
docker compose -f docker-compose.production.yml exec postgres psql -U avian -d avian
```

### Database Backup

See [Backup and Recovery](#backup-and-recovery) section.

---

## Backup and Recovery

### Automated Backup Script

Create `/opt/avian/scripts/backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/avian/backups"
DATE=$(date +%Y%m%d_%H%M%S)
COMPOSE_FILE="/opt/avian/docker-compose.production.yml"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U avian avian | \
  gzip > "$BACKUP_DIR/postgres_$DATE.sql.gz"

# Backup Redis
echo "Backing up Redis..."
docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli --rdb /data/dump.rdb SAVE
docker cp avian-redis:/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Backup environment file
echo "Backing up environment..."
cp /opt/avian/.env.production "$BACKUP_DIR/env_$DATE.backup"

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "*.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.backup" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Setup Automated Backups

```bash
# Make script executable
chmod +x /opt/avian/scripts/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/avian/scripts/backup.sh >> /var/log/avian-backup.log 2>&1") | crontab -
```

### Manual Backup

```bash
# Run backup script
/opt/avian/scripts/backup.sh
```

### Restore from Backup

```bash
# Stop services
cd /opt/avian
docker compose -f docker-compose.production.yml down

# Restore PostgreSQL
gunzip < /opt/avian/backups/postgres_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.production.yml exec -T postgres psql -U avian avian

# Restore Redis
docker cp /opt/avian/backups/redis_YYYYMMDD_HHMMSS.rdb avian-redis:/data/dump.rdb
docker compose -f docker-compose.production.yml restart redis

# Start services
docker compose -f docker-compose.production.yml up -d
```

---

## Monitoring and Health Checks

### Health Check Endpoints

- **Application Health**: `https://your-domain.com/api/health`
- **Liveness**: `https://your-domain.com/api/health/live`
- **Readiness**: `https://your-domain.com/api/health/ready`

### Check Service Status

```bash
# Check all services
docker compose -f docker-compose.production.yml ps

# Check specific service health
docker compose -f docker-compose.production.yml exec app curl http://localhost:3000/api/health
```

### View Logs

```bash
# All services
docker compose -f docker-compose.production.yml logs -f

# Specific service
docker compose -f docker-compose.production.yml logs -f app
docker compose -f docker-compose.production.yml logs -f nginx
docker compose -f docker-compose.production.yml logs -f postgres
docker compose -f docker-compose.production.yml logs -f redis

# Last 100 lines
docker compose -f docker-compose.production.yml logs --tail=100 app
```

### Resource Usage

```bash
# Container resource usage
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

---

## Troubleshooting

### Common Issues

#### 1. Services Won't Start

**Check logs**:
```bash
docker compose -f docker-compose.production.yml logs
```

**Check service status**:
```bash
docker compose -f docker-compose.production.yml ps
```

**Restart services**:
```bash
docker compose -f docker-compose.production.yml restart
```

#### 2. Database Connection Errors

**Verify DATABASE_URL**:
```bash
docker compose -f docker-compose.production.yml exec app printenv DATABASE_URL
```

**Check PostgreSQL is running**:
```bash
docker compose -f docker-compose.production.yml exec postgres pg_isready -U avian
```

**Test connection**:
```bash
docker compose -f docker-compose.production.yml exec app node -e "
  const postgres = require('postgres');
  const sql = postgres(process.env.DATABASE_URL);
  sql\`SELECT 1\`.then(() => console.log('Connected')).catch(console.error);
"
```

#### 3. SSL Certificate Errors

**Verify certificates exist**:
```bash
ls -la nginx/ssl/
```

**Check certificate validity**:
```bash
openssl x509 -in nginx/ssl/cert.pem -text -noout | grep -A2 Validity
```

**Test SSL configuration**:
```bash
docker run --rm -v $(pwd)/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t
```

#### 4. Application Not Accessible

**Check Nginx is running**:
```bash
docker compose -f docker-compose.production.yml ps nginx
```

**Check firewall**:
```bash
sudo ufw status
```

**Test from server**:
```bash
curl http://localhost/health
curl https://localhost/api/health -k
```

#### 5. Out of Memory

**Check memory usage**:
```bash
docker stats
free -h
```

**Increase Redis memory limit** (in docker-compose.production.yml):
```yaml
redis:
  command: redis-server --maxmemory 512mb ...
```

**Restart services**:
```bash
docker compose -f docker-compose.production.yml restart
```

### Debug Mode

Enable debug logging:

```bash
# Edit .env.production
LOG_LEVEL=debug

# Restart services
docker compose -f docker-compose.production.yml restart app
```

---

## Security Best Practices

### 1. Use Strong Secrets

```bash
# Generate strong secrets
openssl rand -base64 32
```

### 2. Keep Software Updated

```bash
# Update Docker images
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d

# Update system packages
sudo apt-get update && sudo apt-get upgrade -y
```

### 3. Configure Firewall

```bash
# Only allow necessary ports
sudo ufw default deny incoming
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 4. Regular Backups

- Automate daily backups
- Test restore procedures regularly
- Store backups off-site

### 5. Monitor Logs

```bash
# Check for suspicious activity
docker compose -f docker-compose.production.yml logs | grep -i error
docker compose -f docker-compose.production.yml logs | grep -i fail
```

### 6. Limit Access

- Use SSH keys instead of passwords
- Disable root SSH login
- Use VPN for administrative access
- Implement IP whitelisting if possible

### 7. SSL/TLS Best Practices

- Use Let's Encrypt certificates
- Enable HSTS
- Use TLS 1.2+ only
- Regularly renew certificates

---

## Additional Resources

- **Nginx Configuration**: `nginx/README.md`
- **Database Migrations**: `database/migrations/README.md`
- **Input Validation**: `docs/INPUT_VALIDATION.md`
- **TLS Configuration**: `docs/TLS_CONFIGURATION.md`

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review application logs
3. Check GitHub issues
4. Contact support team

---

**Last Updated**: January 2026
**Version**: 1.0.0
