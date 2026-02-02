# AVIAN Platform - On-Premises Deployment Package
## Ubuntu 24.04.03 Server (192.168.1.115)

This deployment package contains everything needed to deploy the AVIAN Cybersecurity Platform to your Ubuntu 24.04.03 server.

## 🚀 Quick Deployment

### Prerequisites Check
Your server should have:
- Ubuntu 24.04.03 LTS ✅
- 8+ CPU cores, 16GB+ RAM, 500GB+ SSD storage
- Internet connection for initial setup
- SSH access with sudo privileges

### One-Command Deployment
```bash
# On your Ubuntu server (192.168.1.115)
git clone <this-repository>
cd avian-cybersecurity-platform
sudo ./deploy-to-server.sh
```

## 📋 What This Package Includes

### Core Application Files
- Complete Next.js application with all features
- Database schemas and migrations
- Docker configuration for production
- Nginx reverse proxy with SSL
- Automated backup system

### Deployment Scripts
- `deploy-to-server.sh` - Main deployment script
- `server-setup.sh` - System preparation
- `generate-server-config.sh` - Configuration generator
- `health-check.sh` - Post-deployment verification

### Configuration Files
- `.env.server` - Server-specific environment variables
- `docker-compose.server.yml` - Optimized for your server
- `nginx/server.conf` - Nginx configuration for 192.168.1.115
- SSL certificate generation scripts

## 🔧 Server-Specific Optimizations

### Network Configuration
- Configured for IP address: 192.168.1.115
- HTTP (port 80) and HTTPS (port 443) enabled
- Internal Docker network: 172.21.0.0/16
- Database and Redis not exposed externally

### Resource Allocation
- PostgreSQL: 4GB RAM, 2 CPU cores
- Redis: 1GB RAM, 0.5 CPU cores
- Application: 2GB RAM, 1 CPU core
- Nginx: 512MB RAM, 0.5 CPU cores

### Security Features
- Self-signed SSL certificate for HTTPS
- Firewall configuration (UFW)
- Fail2ban for intrusion prevention
- Secure Docker network isolation
- Database encryption at rest

## 📊 Expected Performance

### System Requirements Met
- CPU: Optimized for 8+ cores
- RAM: 16GB total (8GB allocated to services)
- Storage: 500GB+ (with automated cleanup)
- Network: Gigabit Ethernet recommended

### Concurrent Users
- Up to 100 concurrent users
- 1000+ tickets/alerts per day
- Real-time monitoring and notifications
- Automated backup every 6 hours

## 🛠️ Management Commands

### Service Management
```bash
# Check status
sudo docker-compose -f docker-compose.server.yml ps

# View logs
sudo docker-compose -f docker-compose.server.yml logs -f

# Restart services
sudo docker-compose -f docker-compose.server.yml restart

# Update application
git pull && sudo ./update-server.sh
```

### Database Management
```bash
# Create backup
sudo ./scripts/backup-server.sh

# Restore backup
sudo ./scripts/restore-server.sh backup-file.sql

# Access database
sudo docker-compose -f docker-compose.server.yml exec postgres psql -U avian -d avian
```

### Monitoring
```bash
# System health
sudo ./health-check.sh

# Resource usage
sudo docker stats

# Application logs
sudo docker-compose -f docker-compose.server.yml logs app
```

## 🔒 Security Configuration

### Firewall Rules (UFW)
```bash
# SSH (adjust port if needed)
sudo ufw allow 22/tcp

# HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw --force enable
```

### SSL Certificate
- Self-signed certificate generated automatically
- Valid for 192.168.1.115 and localhost
- 2048-bit RSA encryption
- Automatic renewal script included

### User Access
- Default admin user: admin@avian.local
- Password: Generated during deployment
- Additional users can be created via web interface

## 📞 Support & Troubleshooting

### Common Issues
1. **Port conflicts**: Check if ports 80/443 are in use
2. **Docker issues**: Ensure Docker service is running
3. **Database connection**: Check PostgreSQL container status
4. **SSL warnings**: Normal for self-signed certificates

### Log Files
- Deployment: `deployment.log`
- Application: `docker-compose -f docker-compose.server.yml logs app`
- Nginx: `docker-compose -f docker-compose.server.yml logs nginx`
- Database: `docker-compose -f docker-compose.server.yml logs postgres`

### Health Checks
- Application: `https://192.168.1.115/api/health`
- Database: `sudo docker-compose -f docker-compose.server.yml exec postgres pg_isready`
- Redis: `sudo docker-compose -f docker-compose.server.yml exec redis redis-cli ping`

## 🎯 Success Criteria

Deployment is successful when:
- ✅ All services show "Up" status
- ✅ HTTPS health check returns 200 OK at https://192.168.1.115/api/health
- ✅ Login page loads at https://192.168.1.115
- ✅ Admin user can log in successfully
- ✅ Database backup completes without errors
- ✅ No critical errors in application logs

## 📈 Next Steps After Deployment

1. **Access the application**: https://192.168.1.115
2. **Login with admin credentials** (shown during deployment)
3. **Configure email notifications** in Settings
4. **Create additional user accounts**
5. **Set up monitoring dashboards**
6. **Schedule regular backups**
7. **Configure firewall rules** for your network

---

**Ready to deploy? Run `sudo ./deploy-to-server.sh` on your Ubuntu server!** 🚀