# Security Configuration Guide

This guide provides comprehensive security configuration instructions for the AVIAN platform.

**Requirements**: 20.2

## Table of Contents

1. [Firewall Configuration](#firewall-configuration)
2. [Secret Generation](#secret-generation)
3. [Secret Rotation](#secret-rotation)
4. [Security Best Practices](#security-best-practices)
5. [Security Checklist](#security-checklist)

---

## Firewall Configuration

### Ubuntu/Debian (UFW)

#### Initial Setup

```bash
# Reset firewall to default
sudo ufw --force reset

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow ssh
# Or specific port: sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Verify status
sudo ufw status verbose
```

#### Expected Output

```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere
80/tcp                     ALLOW IN    Anywhere
443/tcp                     ALLOW IN    Anywhere
```

#### Advanced Rules

```bash
# Allow SSH from specific IP only (recommended)
sudo ufw delete allow ssh
sudo ufw allow from YOUR_IP_ADDRESS to any port 22

# Rate limit SSH to prevent brute force
sudo ufw limit ssh

# Allow specific IP ranges (e.g., office network)
sudo ufw allow from 192.168.1.0/24

# Block specific IP
sudo ufw deny from MALICIOUS_IP
```

### CentOS/RHEL (firewalld)

```bash
# Start and enable firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# Allow HTTP and HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Allow SSH
sudo firewall-cmd --permanent --add-service=ssh

# Reload firewall
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-all
```

### Docker-Specific Firewall Rules

Docker bypasses UFW by default. To prevent this:

```bash
# Edit Docker daemon configuration
sudo nano /etc/docker/daemon.json
```

Add:
```json
{
  "iptables": false
}
```

```bash
# Restart Docker
sudo systemctl restart docker

# Manually add Docker rules to UFW
sudo ufw route allow proto tcp from any to any port 3000
```

### Cloud Provider Firewalls

#### AWS Security Groups

```bash
# Inbound Rules:
# - Type: SSH, Protocol: TCP, Port: 22, Source: Your IP
# - Type: HTTP, Protocol: TCP, Port: 80, Source: 0.0.0.0/0
# - Type: HTTPS, Protocol: TCP, Port: 443, Source: 0.0.0.0/0

# Outbound Rules:
# - Type: All traffic, Protocol: All, Port: All, Destination: 0.0.0.0/0
```

#### Azure Network Security Groups

```bash
# Inbound Security Rules:
# - Priority: 100, Name: SSH, Port: 22, Protocol: TCP, Source: Your IP
# - Priority: 110, Name: HTTP, Port: 80, Protocol: TCP, Source: Any
# - Priority: 120, Name: HTTPS, Port: 443, Protocol: TCP, Source: Any
```

#### Google Cloud Firewall Rules

```bash
# Create firewall rules
gcloud compute firewall-rules create allow-http --allow tcp:80
gcloud compute firewall-rules create allow-https --allow tcp:443
gcloud compute firewall-rules create allow-ssh --allow tcp:22 --source-ranges=YOUR_IP/32
```

---

## Secret Generation

### Generate Strong Secrets

All secrets should be cryptographically random and at least 32 characters long.

#### Using OpenSSL (Recommended)

```bash
# Generate 32-byte (256-bit) secret
openssl rand -base64 32

# Generate 64-byte (512-bit) secret
openssl rand -base64 64

# Generate hex secret
openssl rand -hex 32
```

#### Using /dev/urandom

```bash
# Generate base64 secret
head -c 32 /dev/urandom | base64

# Generate hex secret
head -c 32 /dev/urandom | xxd -p -c 32
```

### Required Secrets

Generate secrets for all of these:

```bash
# JWT Secrets
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"

# NextAuth Secret
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"

# Database Password
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"

# Redis Password
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"

# Session Secret (if needed)
echo "SESSION_SECRET=$(openssl rand -base64 32)"
```

### Store Secrets Securely

#### Option 1: Environment File (Production)

```bash
# Create .env.production with restrictive permissions
touch .env.production
chmod 600 .env.production

# Edit file
nano .env.production
```

Add secrets:
```env
JWT_SECRET=<generated-secret>
JWT_REFRESH_SECRET=<generated-secret>
NEXTAUTH_SECRET=<generated-secret>
POSTGRES_PASSWORD=<generated-secret>
REDIS_PASSWORD=<generated-secret>
```

#### Option 2: Docker Secrets (Recommended for Swarm)

```bash
# Create secrets
echo "your-jwt-secret" | docker secret create jwt_secret -
echo "your-db-password" | docker secret create postgres_password -

# Reference in docker-compose.yml
services:
  app:
    secrets:
      - jwt_secret
      - postgres_password
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret

secrets:
  jwt_secret:
    external: true
  postgres_password:
    external: true
```

#### Option 3: HashiCorp Vault (Enterprise)

```bash
# Store secret in Vault
vault kv put secret/avian/jwt JWT_SECRET="your-secret"

# Retrieve secret
vault kv get -field=JWT_SECRET secret/avian/jwt
```

### Secret Strength Requirements

- **Minimum Length**: 32 characters
- **Character Set**: Use base64 or hex encoding
- **Randomness**: Use cryptographically secure random number generator
- **Uniqueness**: Each secret must be unique (don't reuse)

---

## Secret Rotation

### Rotation Schedule

| Secret Type | Rotation Frequency | Priority |
|-------------|-------------------|----------|
| JWT Secrets | Every 90 days | High |
| Database Passwords | Every 180 days | High |
| Redis Passwords | Every 180 days | Medium |
| SSL Certificates | Every 90 days (auto) | Critical |
| API Keys | Every 90 days | High |

### JWT Secret Rotation

JWT secret rotation requires careful planning to avoid disrupting active sessions.

#### Step 1: Generate New Secret

```bash
# Generate new JWT secret
NEW_JWT_SECRET=$(openssl rand -base64 32)
echo "New JWT Secret: $NEW_JWT_SECRET"
```

#### Step 2: Update Configuration (Dual-Key Period)

Support both old and new secrets temporarily:

```env
# .env.production
JWT_SECRET=<new-secret>
JWT_SECRET_OLD=<old-secret>  # Keep for 24 hours
JWT_REFRESH_SECRET=<new-refresh-secret>
JWT_REFRESH_SECRET_OLD=<old-refresh-secret>
```

#### Step 3: Update Application Code

Modify JWT verification to accept both secrets:

```typescript
// Verify with new secret first, fall back to old
try {
  return jwt.verify(token, process.env.JWT_SECRET);
} catch (error) {
  if (process.env.JWT_SECRET_OLD) {
    return jwt.verify(token, process.env.JWT_SECRET_OLD);
  }
  throw error;
}
```

#### Step 4: Deploy Changes

```bash
# Restart services with new configuration
docker compose -f docker-compose.production.yml restart app
```

#### Step 5: Remove Old Secret (After 24 Hours)

```env
# .env.production
JWT_SECRET=<new-secret>
JWT_REFRESH_SECRET=<new-refresh-secret>
# Remove JWT_SECRET_OLD and JWT_REFRESH_SECRET_OLD
```

### Database Password Rotation

#### Step 1: Generate New Password

```bash
NEW_DB_PASSWORD=$(openssl rand -base64 32)
```

#### Step 2: Update Database Password

```bash
# Connect to PostgreSQL
docker compose -f docker-compose.production.yml exec postgres psql -U avian

# Change password
ALTER USER avian WITH PASSWORD 'new-password-here';
\q
```

#### Step 3: Update Environment Configuration

```bash
# Update .env.production
nano .env.production

# Change POSTGRES_PASSWORD
POSTGRES_PASSWORD=<new-password>
DATABASE_URL=postgresql://avian:<new-password>@postgres:5432/avian
```

#### Step 4: Restart Services

```bash
docker compose -f docker-compose.production.yml restart app
```

### Redis Password Rotation

#### Step 1: Generate New Password

```bash
NEW_REDIS_PASSWORD=$(openssl rand -base64 32)
```

#### Step 2: Update Redis Configuration

```bash
# Stop Redis
docker compose -f docker-compose.production.yml stop redis

# Update docker-compose.production.yml
# Change REDIS_PASSWORD environment variable

# Start Redis with new password
docker compose -f docker-compose.production.yml up -d redis
```

#### Step 3: Update Application Configuration

```bash
# Update .env.production
REDIS_PASSWORD=<new-password>
REDIS_URL=redis://:<new-password>@redis:6379

# Restart app
docker compose -f docker-compose.production.yml restart app
```

### SSL Certificate Rotation

SSL certificates should be rotated automatically with Let's Encrypt.

#### Verify Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer
```

#### Manual Renewal

```bash
# Renew certificates
sudo certbot renew

# Copy new certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# Restart Nginx
docker compose -f docker-compose.production.yml restart nginx
```

### Rotation Checklist

- [ ] Generate new secret with sufficient entropy
- [ ] Test new secret in staging environment
- [ ] Update production configuration
- [ ] Deploy changes with zero downtime
- [ ] Verify application functionality
- [ ] Monitor for errors
- [ ] Remove old secrets after grace period
- [ ] Document rotation in change log
- [ ] Update backup encryption keys if needed

---

## Security Best Practices

### 1. Principle of Least Privilege

- Run containers as non-root users
- Use minimal base images (Alpine)
- Limit container capabilities
- Use read-only file systems where possible

### 2. Network Security

- Don't expose database ports to host in production
- Use Docker networks for inter-container communication
- Implement rate limiting at Nginx level
- Use HTTPS for all external communication

### 3. Secret Management

- Never commit secrets to version control
- Use environment variables or secret management systems
- Rotate secrets regularly
- Use different secrets for each environment

### 4. Access Control

- Use SSH keys instead of passwords
- Disable root SSH login
- Implement MFA for administrative access
- Use VPN for administrative access when possible

### 5. Monitoring and Logging

- Enable audit logging for all security events
- Monitor failed login attempts
- Set up alerts for suspicious activity
- Regularly review logs

### 6. Updates and Patches

- Keep Docker images updated
- Update system packages regularly
- Subscribe to security advisories
- Test updates in staging before production

### 7. Backup and Recovery

- Automate daily backups
- Test restore procedures regularly
- Store backups off-site
- Encrypt backup files

### 8. SSL/TLS

- Use Let's Encrypt for free SSL certificates
- Enable HSTS with preload
- Use TLS 1.2+ only
- Disable weak cipher suites

### 9. Application Security

- Validate all user input
- Sanitize HTML content
- Implement rate limiting
- Use prepared statements for database queries

### 10. Incident Response

- Have an incident response plan
- Document security procedures
- Maintain contact list for security team
- Conduct regular security drills

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets generated with sufficient entropy
- [ ] Firewall configured correctly
- [ ] SSL/TLS certificates installed
- [ ] Database passwords changed from defaults
- [ ] Redis password set
- [ ] SSH key-based authentication enabled
- [ ] Root SSH login disabled
- [ ] System packages updated
- [ ] Docker images updated
- [ ] Security headers configured

### Post-Deployment

- [ ] Application accessible via HTTPS
- [ ] HTTP redirects to HTTPS
- [ ] Health endpoints responding
- [ ] Database connection working
- [ ] Redis connection working
- [ ] Audit logging enabled
- [ ] Backup script configured
- [ ] Monitoring configured
- [ ] Log rotation configured
- [ ] SSL certificate auto-renewal configured

### Ongoing Maintenance

- [ ] Review logs weekly
- [ ] Update system packages monthly
- [ ] Rotate secrets quarterly
- [ ] Test backups monthly
- [ ] Review firewall rules quarterly
- [ ] Conduct security audit annually
- [ ] Update SSL certificates (auto)
- [ ] Review access logs for suspicious activity

### Incident Response

- [ ] Incident response plan documented
- [ ] Security contact list maintained
- [ ] Backup restore procedure tested
- [ ] Rollback procedure documented
- [ ] Communication plan established

---

## Security Hardening

### SSH Hardening

Edit `/etc/ssh/sshd_config`:

```bash
# Disable root login
PermitRootLogin no

# Disable password authentication
PasswordAuthentication no

# Use SSH protocol 2 only
Protocol 2

# Limit authentication attempts
MaxAuthTries 3

# Set login grace time
LoginGraceTime 30

# Allow specific users only
AllowUsers your-username

# Restart SSH
sudo systemctl restart sshd
```

### System Hardening

```bash
# Enable automatic security updates
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Install fail2ban
sudo apt-get install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Configure fail2ban for SSH
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
```

### Docker Security

```bash
# Run Docker rootless (optional)
dockerd-rootless-setuptool.sh install

# Enable Docker content trust
export DOCKER_CONTENT_TRUST=1

# Scan images for vulnerabilities
docker scan avian-platform:latest
```

---

## Compliance

### GDPR Compliance

- Implement data encryption at rest and in transit
- Enable audit logging for data access
- Implement data retention policies
- Provide data export functionality
- Implement right to be forgotten

### HIPAA Compliance

- Enable encryption for all PHI data
- Implement access controls
- Enable comprehensive audit logging
- Implement backup and disaster recovery
- Conduct regular security assessments

### SOC 2 Compliance

- Implement access controls
- Enable audit logging
- Implement change management
- Conduct regular security training
- Maintain security documentation

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)

---

**Last Updated**: January 2026
**Version**: 1.0.0
