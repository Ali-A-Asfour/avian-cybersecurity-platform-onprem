# AVIAN Platform - Physical Server Setup Guide

## Overview
This guide covers setting up a physical server for AVIAN alpha testing with a real client.

**Target**: Secure, internal server for alpha testing
**Access**: Team + Client stakeholders only
**OS**: Ubuntu 22.04 LTS (recommended)

---

## 🖥️ Phase 1: Physical Server Setup

### Hardware Requirements (Minimum)
- **CPU**: 4 cores (8 recommended)
- **RAM**: 8GB (16GB recommended)
- **Storage**: 100GB SSD (500GB recommended)
- **Network**: Gigabit Ethernet
- **Backup**: External drive or network storage

### Hardware Requirements (Recommended for Client Testing)
- **CPU**: 8 cores (Intel i7 or AMD Ryzen 7)
- **RAM**: 16GB DDR4
- **Storage**: 500GB NVMe SSD
- **Network**: Gigabit Ethernet with static IP
- **UPS**: Uninterruptible Power Supply
- **Backup**: Network-attached storage (NAS)

### Operating System Installation

1. **Download Ubuntu Server 22.04 LTS**
   ```bash
   # Download from: https://ubuntu.com/download/server
   # Create bootable USB with Rufus (Windows) or dd (Linux/Mac)
   ```

2. **Install Ubuntu Server**
   - Boot from USB
   - Select "Install Ubuntu Server"
   - Configure network (static IP recommended)
   - Create admin user (not root)
   - Install OpenSSH server
   - No additional packages needed initially

3. **Initial Configuration**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install essential packages
   sudo apt install -y curl wget git vim htop ufw fail2ban
   
   # Configure timezone
   sudo timedatectl set-timezone America/New_York  # Adjust as needed
   
   # Reboot
   sudo reboot
   ```

---

## 🔒 Phase 2: Security Hardening

### SSH Security
```bash
# Edit SSH configuration
sudo nano /etc/ssh/sshd_config

# Add/modify these settings:
Port 2222                    # Change from default 22
PermitRootLogin no
PasswordAuthentication no    # Use SSH keys only
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2

# Restart SSH
sudo systemctl restart sshd
```

### Firewall Configuration
```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (use your custom port)
sudo ufw allow 2222/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny all other incoming
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Check status
sudo ufw status verbose
```

### Fail2Ban Configuration
```bash
# Configure fail2ban
sudo nano /etc/fail2ban/jail.local

# Add this configuration:
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 2222
logpath = /var/log/auth.log

# Start fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### User Management
```bash
# Create dedicated user for AVIAN
sudo adduser avian
sudo usermod -aG sudo avian
sudo usermod -aG docker avian  # We'll install Docker next

# Set up SSH keys for avian user
sudo -u avian mkdir -p /home/avian/.ssh
sudo -u avian chmod 700 /home/avian/.ssh

# Copy your public key to /home/avian/.ssh/authorized_keys
# Set proper permissions
sudo -u avian chmod 600 /home/avian/.ssh/authorized_keys
```

---

## 🐳 Phase 3: Docker Installation

### Install Docker
```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install dependencies
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Add user to docker group
sudo usermod -aG docker $USER
sudo usermod -aG docker avian

# Start and enable Docker
sudo systemctl enable docker
sudo systemctl start docker
```

### Install Docker Compose
```bash
# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### Test Docker Installation
```bash
# Test Docker (should work without sudo after reboot)
docker run hello-world

# If it doesn't work, reboot and try again
sudo reboot
```

---

## 🌐 Phase 4: Network Configuration

### Static IP Configuration (if needed)
```bash
# Edit netplan configuration
sudo nano /etc/netplan/00-installer-config.yaml

# Example configuration:
network:
  version: 2
  ethernets:
    enp0s3:  # Replace with your interface name
      dhcp4: false
      addresses:
        - 192.168.1.100/24  # Your desired static IP
      gateway4: 192.168.1.1  # Your router IP
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4

# Apply configuration
sudo netplan apply
```

### Domain/DNS Setup (Optional)
```bash
# If you have a domain name, configure DNS A record to point to your server IP
# For internal testing, you can use IP address directly
# Or add entry to client machines' hosts file:
# 192.168.1.100  avian-alpha.yourcompany.com
```

---

## 📦 Phase 5: Application Deployment

### Clone Repository
```bash
# Switch to avian user
su - avian

# Clone your repository
git clone https://github.com/your-org/avian-platform.git
cd avian-platform

# Make scripts executable
chmod +x scripts/*.sh
```

### Generate Configuration
```bash
# Generate secure secrets
./scripts/generate-secrets.sh

# Copy alpha template
cp .env.alpha .env.production

# Edit configuration
nano .env.production
```

### Key Configuration Updates
```bash
# In .env.production, update these values:

# Your server IP or domain
NEXT_PUBLIC_API_URL=https://192.168.1.100
BASE_URL=https://192.168.1.100
CORS_ORIGIN=https://192.168.1.100
NEXTAUTH_URL=https://192.168.1.100

# Database passwords (use generated ones from secrets script)
DATABASE_URL=postgresql://avian_alpha:YOUR_GENERATED_PASSWORD@localhost:5432/avian_alpha
REDIS_URL=redis://:YOUR_GENERATED_REDIS_PASSWORD@localhost:6379

# Email configuration (for notifications)
EMAIL_ENABLED=true
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-alerts@yourcompany.com
EMAIL_PASSWORD=your-gmail-app-password
EMAIL_FROM=AVIAN Security <your-alerts@yourcompany.com>

# Client information
CLIENT_NAME=Your_Client_Name
ENVIRONMENT=alpha
```

### Deploy Application
```bash
# Run automated deployment
./scripts/alpha-deploy.sh

# This will:
# 1. Build Docker containers
# 2. Start all services
# 3. Run database migrations
# 4. Optionally seed initial admin user
# 5. Perform health checks
```

---

## 🔐 Phase 6: SSL Certificate Setup

### Option 1: Let's Encrypt (if you have a domain)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Set up auto-renewal cron job
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Option 2: Self-Signed Certificate (for IP address)
```bash
# Create SSL directory
mkdir -p nginx/ssl

# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=192.168.1.100"

# Update nginx configuration to use SSL
# (This is already configured in docker-compose.alpha.yml)
```

---

## 🔍 Phase 7: Testing & Verification

### Health Checks
```bash
# Check all services are running
docker-compose -f docker-compose.alpha.yml ps

# Test application health
curl -k https://192.168.1.100/api/health/live

# Check logs
docker-compose -f docker-compose.alpha.yml logs -f app
```

### Create Test Users
```bash
# Access the application at https://your-server-ip
# Login with default admin (if seeded):
# Email: admin@avian-platform.com
# Password: Admin123!

# Or create admin user manually:
docker-compose -f docker-compose.alpha.yml exec app npm run create-admin
```

### Test Key Features
1. **Login/Logout** - Test authentication
2. **Password Reset** - Test email functionality
3. **Alert Creation** - Test alert system
4. **Ticket Creation** - Test ticketing workflow
5. **Notifications** - Test email/SMS alerts
6. **Admin Functions** - Test user management

---

## 📊 Phase 8: Monitoring & Maintenance

### System Monitoring
```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# Check system resources
htop                    # CPU and memory usage
df -h                   # Disk usage
docker stats            # Container resource usage
```

### Log Management
```bash
# View application logs
docker-compose -f docker-compose.alpha.yml logs -f

# View system logs
sudo journalctl -f

# View nginx logs
docker-compose -f docker-compose.alpha.yml logs nginx
```

### Backup Setup
```bash
# Create backup directory
sudo mkdir -p /backup/avian

# Set up automated backups
crontab -e
# Add: 0 2 * * * /home/avian/avian-platform/scripts/backup.sh

# Test backup
./scripts/backup.sh
```

---

## 🚨 Troubleshooting

### Common Issues

**Docker permission denied:**
```bash
# Add user to docker group and reboot
sudo usermod -aG docker $USER
sudo reboot
```

**Port already in use:**
```bash
# Check what's using the port
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Stop conflicting services
sudo systemctl stop apache2  # If Apache is running
sudo systemctl stop nginx    # If nginx is running outside Docker
```

**Database connection failed:**
```bash
# Check PostgreSQL container
docker-compose -f docker-compose.alpha.yml logs postgres

# Check database connectivity
docker-compose -f docker-compose.alpha.yml exec postgres psql -U avian_alpha -d avian_alpha -c "SELECT 1;"
```

**SSL certificate issues:**
```bash
# For self-signed certificates, clients need to accept the certificate
# Or add certificate to client's trusted certificates

# Check certificate
openssl x509 -in nginx/ssl/cert.pem -text -noout
```

---

## 📋 Pre-Client Checklist

Before giving client access:

### Security
- [ ] Firewall configured and active
- [ ] SSH hardened (key-only, custom port)
- [ ] Fail2ban configured
- [ ] SSL certificate installed
- [ ] Strong passwords generated
- [ ] Regular backups configured

### Application
- [ ] All services healthy
- [ ] Database migrations completed
- [ ] Admin user created
- [ ] Email notifications working
- [ ] SMS notifications configured (optional)
- [ ] All features tested

### Documentation
- [ ] Client user accounts created
- [ ] Login credentials provided securely
- [ ] Basic user guide prepared
- [ ] Support contact information ready

---

## 📞 Next Steps

1. **Complete server setup** following this guide
2. **Deploy AVIAN application** using the deployment script
3. **Test all functionality** thoroughly
4. **Create client user accounts**
5. **Provide secure access** to client stakeholders
6. **Begin alpha testing** with real client workflows

---

**Estimated Setup Time**: 2-4 hours (depending on experience)
**Recommended Team**: 1-2 technical team members
**Client Involvement**: Minimal during setup, full access after completion