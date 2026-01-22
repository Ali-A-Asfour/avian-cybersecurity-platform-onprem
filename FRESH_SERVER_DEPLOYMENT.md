# AVIAN Platform - Fresh Server Deployment
## From Zero to Production on Ubuntu 24.04.03 (192.168.1.115)

This guide will take your fresh Ubuntu server from nothing to a fully operational AVIAN Cybersecurity Platform.

## 🚀 Step-by-Step Deployment

### Step 1: Transfer Files to Your Server

**Option A: Direct Git Clone (Recommended)**
```bash
# SSH into your server
ssh user@192.168.1.115

# Clone the repository
git clone <repository-url>
cd avian-cybersecurity-platform

# Make scripts executable
chmod +x *.sh
chmod +x scripts/*.sh
```

**Option B: Manual File Transfer**
```bash
# From your local machine, copy files to server
scp -r avian-cybersecurity-platform/ user@192.168.1.115:~/

# SSH into server
ssh user@192.168.1.115
cd avian-cybersecurity-platform

# Make scripts executable
chmod +x *.sh
chmod +x scripts/*.sh
```

### Step 2: Run the Automated Deployment
```bash
# On your Ubuntu server
sudo ./deploy-to-server.sh
```

That's it! The script will handle everything:
- ✅ System updates and security hardening
- ✅ Docker installation and configuration
- ✅ Firewall setup (UFW + Fail2ban)
- ✅ SSL certificate generation
- ✅ Database setup and migrations
- ✅ Application deployment
- ✅ Automated backup configuration
- ✅ Health monitoring setup

## 📋 What Happens During Deployment

### System Preparation (5-10 minutes)
- Updates Ubuntu packages
- Installs Docker and Docker Compose
- Configures UFW firewall
- Sets up Fail2ban intrusion prevention
- Creates application user and directories

### Security Setup (2-3 minutes)
- Generates SSL certificates for 192.168.1.115
- Creates secure passwords for all services
- Configures encrypted database storage
- Sets up secure Docker networking

### Application Deployment (10-15 minutes)
- Builds Docker images
- Starts PostgreSQL database
- Starts Redis cache
- Deploys AVIAN application
- Configures Nginx reverse proxy
- Runs database migrations

### Final Configuration (2-3 minutes)
- Sets up automated backups
- Configures log rotation
- Performs health checks
- Creates admin user account

## 🎯 Expected Results

After successful deployment:

### Services Running
```bash
# Check with:
sudo docker-compose -f docker-compose.server.yml ps

# You should see:
# avian-nginx-server     Up
# avian-app-server       Up  
# avian-postgres-server  Up
# avian-redis-server     Up
```

### Access Points
- **Web Interface**: https://192.168.1.115
- **Health Check**: https://192.168.1.115/api/health
- **Admin Login**: Credentials in `admin-credentials.txt`

### Security Features Active
- **Firewall**: UFW enabled (ports 22, 80, 443 open)
- **Intrusion Prevention**: Fail2ban monitoring SSH
- **SSL Encryption**: Self-signed certificate for HTTPS
- **Network Isolation**: Secure Docker network

## 🔧 Post-Deployment Steps

### 1. First Login
```bash
# Get admin credentials
sudo cat admin-credentials.txt

# Open browser to: https://192.168.1.115
# Login with the credentials shown
# IMPORTANT: Change password immediately!
```

### 2. Basic Configuration
1. **Change Admin Password**
   - Go to Profile → Change Password
   - Use a strong, unique password

2. **Configure Email Notifications**
   - Go to Settings → Notifications
   - Add your SMTP server details
   - Test email functionality

3. **Create User Accounts**
   - Go to Admin → Users
   - Create accounts for your team
   - Assign appropriate roles

### 3. System Verification
```bash
# Run health check
sudo ./health-check.sh

# Check all services
sudo docker-compose -f docker-compose.server.yml ps

# Test backup system
sudo ./scripts/backup-server.sh
```

## 📊 System Specifications

### Resource Allocation
- **PostgreSQL**: 4GB RAM, 2 CPU cores
- **Redis**: 1GB RAM, 0.5 CPU cores  
- **Application**: 2GB RAM, 1 CPU core
- **Nginx**: 512MB RAM, 0.5 CPU cores
- **Total Used**: ~8GB RAM, 4 CPU cores

### Network Configuration
- **HTTP**: Port 80 (redirects to HTTPS)
- **HTTPS**: Port 443 (main access)
- **SSH**: Port 22 (for management)
- **Internal Network**: 172.21.0.0/16 (Docker)

### Storage Layout
- **Application Data**: Docker volumes
- **Database**: Persistent PostgreSQL storage
- **Backups**: `/var/backups/` (automated)
- **Logs**: Docker logging + system logs
- **SSL Certificates**: `nginx/ssl/`

## 🛠️ Management Commands

### Daily Operations
```bash
# Check system health
sudo ./health-check.sh

# View service logs
sudo docker-compose -f docker-compose.server.yml logs -f

# Restart services
sudo docker-compose -f docker-compose.server.yml restart

# Create manual backup
sudo ./scripts/backup-server.sh
```

### Maintenance
```bash
# Update the platform
sudo ./update-server.sh

# View system resources
sudo docker stats

# Check disk space
df -h

# Review security logs
sudo journalctl -u fail2ban --since="24 hours ago"
```

## 🚨 Troubleshooting Fresh Deployment

### If Deployment Fails

**Check Prerequisites**
```bash
# Verify Ubuntu version
lsb_release -a

# Check available resources
free -h
df -h
nproc
```

**Common Issues**

1. **Insufficient Resources**
   - Need: 8+ CPU cores, 16GB+ RAM, 500GB+ storage
   - Check: `free -h` and `df -h`

2. **Network Issues**
   - Check internet connectivity: `ping google.com`
   - Verify firewall isn't blocking: `sudo ufw status`

3. **Permission Issues**
   - Run deployment as root: `sudo ./deploy-to-server.sh`
   - Check script permissions: `ls -la *.sh`

4. **Docker Issues**
   - Restart Docker: `sudo systemctl restart docker`
   - Check Docker status: `sudo systemctl status docker`

### Recovery Commands
```bash
# Clean restart if deployment fails
sudo docker-compose -f docker-compose.server.yml down
sudo docker system prune -af
sudo ./deploy-to-server.sh

# Check deployment logs
tail -f deployment.log

# Manual service start
sudo docker-compose -f docker-compose.server.yml up -d
```

## 📞 Support Information

### Log Files
- **Deployment**: `deployment.log`
- **Application**: `sudo docker-compose -f docker-compose.server.yml logs app`
- **Database**: `sudo docker-compose -f docker-compose.server.yml logs postgres`
- **Web Server**: `sudo docker-compose -f docker-compose.server.yml logs nginx`
- **System**: `sudo journalctl -u docker`

### Configuration Files
- **Environment**: `.env.server`
- **Docker Compose**: `docker-compose.server.yml`
- **Nginx**: `nginx/server.conf`
- **Admin Credentials**: `admin-credentials.txt`

### Health Checks
```bash
# Application health
curl -k https://192.168.1.115/api/health

# Database health  
sudo docker-compose -f docker-compose.server.yml exec postgres pg_isready

# Redis health
sudo docker-compose -f docker-compose.server.yml exec redis redis-cli ping

# System health
sudo ./health-check.sh
```

## 🎉 Success Criteria

Your deployment is successful when:

- ✅ All 4 services show "Up" status
- ✅ HTTPS health check returns 200 OK
- ✅ Admin login works at https://192.168.1.115
- ✅ No critical errors in logs
- ✅ Backup system creates first backup
- ✅ Firewall and security services active

## 🚀 Ready to Deploy?

1. **SSH into your fresh Ubuntu server**: `ssh user@192.168.1.115`
2. **Clone or transfer the files**
3. **Run**: `sudo ./deploy-to-server.sh`
4. **Wait 20-30 minutes for complete deployment**
5. **Access your platform**: https://192.168.1.115

---

**Your fresh Ubuntu server will be transformed into a production-ready cybersecurity platform!** 🎯