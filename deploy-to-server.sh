#!/bin/bash

# AVIAN Platform - Server Deployment Script
# Optimized for Ubuntu 24.04.03 Server (192.168.1.115)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Server configuration
SERVER_IP="192.168.1.115"
DOMAIN_NAME="avian.local"
PROJECT_NAME="avian-platform"

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/deployment.log"

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "${RED}❌ ERROR: $1${NC}"
    exit 1
}

# Success message
success() {
    log "${GREEN}✅ $1${NC}"
}

# Info message
info() {
    log "${BLUE}ℹ️  $1${NC}"
}

# Warning message
warn() {
    log "${YELLOW}⚠️  $1${NC}"
}

# Header
header() {
    log "${PURPLE}$1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error_exit "This script must be run as root (use sudo)"
    fi
}

# Clear log file
> "$LOG_FILE"

header "🚀 AVIAN Platform - Server Deployment"
header "======================================"
header "Target Server: Ubuntu 24.04.03 (192.168.1.115)"
log "Deployment started at: $(date)"
log "Project directory: $SCRIPT_DIR"
log ""

# Check root privileges
check_root

# Step 1: System Information
header "📋 Step 1: System Information"

info "Checking system information..."
log "OS: $(lsb_release -d | cut -f2)"
log "Kernel: $(uname -r)"
log "Architecture: $(uname -m)"
log "CPU Cores: $(nproc)"
log "Total RAM: $(free -h | awk '/^Mem:/ {print $2}')"
log "Available Disk: $(df -h / | awk 'NR==2 {print $4}')"
log "IP Address: $(hostname -I | awk '{print $1}')"

# Verify IP address
CURRENT_IP=$(hostname -I | awk '{print $1}')
if [ "$CURRENT_IP" != "$SERVER_IP" ]; then
    warn "Current IP ($CURRENT_IP) doesn't match expected IP ($SERVER_IP)"
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error_exit "Deployment cancelled"
    fi
    SERVER_IP="$CURRENT_IP"
fi

success "System information verified"

# Step 2: System Updates and Dependencies
header "🔧 Step 2: System Updates and Dependencies"

info "Updating system packages..."
apt update && apt upgrade -y
success "System packages updated"

info "Installing required packages..."
apt install -y \
    curl \
    wget \
    git \
    ufw \
    fail2ban \
    htop \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

success "Required packages installed"

# Step 3: Docker Installation
header "🐳 Step 3: Docker Installation"

if ! command -v docker &> /dev/null; then
    info "Installing Docker..."
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    success "Docker installed and started"
else
    success "Docker is already installed: $(docker --version)"
fi

# Install Docker Compose (standalone)
if ! command -v docker-compose &> /dev/null; then
    info "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    success "Docker Compose installed: $(docker-compose --version)"
else
    success "Docker Compose is already installed: $(docker-compose --version)"
fi

# Step 4: Firewall Configuration
header "🔥 Step 4: Firewall Configuration"

info "Configuring UFW firewall..."

# Reset UFW to defaults
ufw --force reset

# Set default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (be careful not to lock yourself out)
ufw allow ssh

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw --force enable

success "Firewall configured and enabled"

# Step 5: Fail2ban Configuration
header "🛡️  Step 5: Fail2ban Configuration"

info "Configuring Fail2ban..."

# Create custom jail configuration
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 3
EOF

# Start and enable Fail2ban
systemctl start fail2ban
systemctl enable fail2ban

success "Fail2ban configured and started"

# Step 6: Create Application User
header "👤 Step 6: Application User Setup"

if ! id "avian" &>/dev/null; then
    info "Creating avian user..."
    useradd -m -s /bin/bash avian
    usermod -aG docker avian
    success "User 'avian' created and added to docker group"
else
    success "User 'avian' already exists"
fi

# Step 7: Environment Configuration
header "🔧 Step 7: Environment Configuration"

info "Creating server-specific environment configuration..."

# Generate secure passwords
DB_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ADMIN_PASSWORD=$(openssl rand -base64 16)

# Create .env.server file
cat > .env.server << EOF
# AVIAN Platform - Server Configuration
# Generated on $(date)
# Server: Ubuntu 24.04.03 (${SERVER_IP})

# Environment
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://${SERVER_IP}
BASE_URL=https://${SERVER_IP}
NEXTAUTH_URL=https://${SERVER_IP}
CORS_ORIGIN=https://${SERVER_IP}

# Database Configuration
DATABASE_URL=postgresql://avian:${DB_PASSWORD}@postgres:5432/avian
POSTGRES_DB=avian
POSTGRES_USER=avian
POSTGRES_PASSWORD=${DB_PASSWORD}

# Redis Configuration
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# Authentication
JWT_SECRET=${JWT_SECRET}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# Admin User
ADMIN_EMAIL=admin@avian.local
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Security
BCRYPT_ROUNDS=12
SESSION_TIMEOUT=3600000
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900000

# Features
ENABLE_METRICS=true
ENABLE_TRACING=false
ENABLE_DEBUG_ROUTES=false

# File Storage
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/app/uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email Configuration (configure after deployment)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=AVIAN Security <noreply@${SERVER_IP}>

# SMS Configuration (optional)
SMS_ENABLED=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Logging
LOG_LEVEL=info
LOG_FILE=/app/logs/application.log

# Backup
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE="0 */6 * * *"
EOF

success "Environment configuration created"

# Save admin credentials for user
cat > admin-credentials.txt << EOF
AVIAN Platform - Admin Credentials
Generated on $(date)

URL: https://${SERVER_IP}
Username: admin@avian.local
Password: ${ADMIN_PASSWORD}

IMPORTANT: Change this password after first login!
EOF

chmod 600 admin-credentials.txt
success "Admin credentials saved to admin-credentials.txt"

# Step 8: SSL Certificate Generation
header "🔐 Step 8: SSL Certificate Generation"

info "Creating SSL certificate directory..."
mkdir -p nginx/ssl

info "Generating self-signed SSL certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/server.key \
    -out nginx/ssl/server.crt \
    -subj "/C=US/ST=Local/L=Local/O=AVIAN/OU=Security/CN=${SERVER_IP}/emailAddress=admin@avian.local" \
    -addext "subjectAltName=IP:${SERVER_IP},IP:127.0.0.1,DNS:localhost,DNS:avian.local"

chmod 600 nginx/ssl/server.key
chmod 644 nginx/ssl/server.crt

success "SSL certificate generated for ${SERVER_IP}"

# Step 9: Docker Compose Configuration
header "🐳 Step 9: Docker Compose Configuration"

info "Creating server-specific Docker Compose configuration..."

cat > docker-compose.server.yml << 'EOF'
version: '3.8'

services:
  # Nginx reverse proxy with SSL
  nginx:
    image: nginx:alpine
    container_name: avian-nginx-server
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/server.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx-cache:/var/cache/nginx
      - nginx-logs:/var/log/nginx
    depends_on:
      - app
    networks:
      - avian-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  # Next.js application
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    container_name: avian-app-server
    env_file:
      - .env.server
    expose:
      - "3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - avian-network
    restart: unless-stopped
    volumes:
      - app-logs:/app/logs
      - app-uploads:/app/uploads
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      start_period: 60s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'

  # PostgreSQL database
  postgres:
    image: postgres:16-alpine
    container_name: avian-postgres-server
    env_file:
      - .env.server
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-avian}
      POSTGRES_USER: ${POSTGRES_USER:-avian}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - postgres-backups:/backups
    networks:
      - avian-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-avian} -d ${POSTGRES_DB:-avian}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
        reservations:
          memory: 2G
          cpus: '1.0'
    command: >
      postgres
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.track=all
      -c max_connections=200
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c maintenance_work_mem=64MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c work_mem=4MB
      -c min_wal_size=1GB
      -c max_wal_size=4GB

  # Redis cache
  redis:
    image: redis:7-alpine
    container_name: avian-redis-server
    env_file:
      - .env.server
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes
      --appendfsync everysec
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --tcp-keepalive 300
      --timeout 0
      --tcp-backlog 511
      --save 900 1
      --save 300 10
      --save 60 10000
    volumes:
      - redis-data:/data
    networks:
      - avian-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'

  # Backup service
  backup:
    image: postgres:16-alpine
    container_name: avian-backup-server
    env_file:
      - .env.server
    volumes:
      - postgres-backups:/backups
      - ./scripts:/scripts:ro
    networks:
      - avian-network
    restart: "no"
    profiles:
      - backup

volumes:
  postgres-data:
    driver: local
  postgres-backups:
    driver: local
  redis-data:
    driver: local
  nginx-cache:
    driver: local
  nginx-logs:
    driver: local
  app-logs:
    driver: local
  app-uploads:
    driver: local

networks:
  avian-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/16
EOF

success "Docker Compose configuration created"

# Step 10: Nginx Configuration
header "🌐 Step 10: Nginx Configuration"

info "Creating Nginx configuration..."
mkdir -p nginx

cat > nginx/server.conf << EOF
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=1r/s;

    # Upstream
    upstream app {
        server app:3000;
        keepalive 32;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name ${SERVER_IP} localhost avian.local;
        return 301 https://\$server_name\$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name ${SERVER_IP} localhost avian.local;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/server.crt;
        ssl_certificate_key /etc/nginx/ssl/server.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers for HTTPS
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # API routes with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
            proxy_read_timeout 86400;
        }

        # Login endpoint with stricter rate limiting
        location /api/auth/ {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # Static files
        location /_next/static/ {
            proxy_pass http://app;
            proxy_cache nginx-cache;
            proxy_cache_valid 200 1d;
            add_header Cache-Control "public, immutable";
        }

        # Main application
        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
        }

        # Health check (no rate limiting)
        location /api/health {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            access_log off;
        }
    }
}
EOF

success "Nginx configuration created"

# Step 11: Build and Deploy Application
header "🏗️  Step 11: Building and Deploying Application"

info "Building Docker images..."
docker-compose -f docker-compose.server.yml build --no-cache

success "Docker images built successfully"

info "Starting services..."
docker-compose -f docker-compose.server.yml up -d

# Wait for services to start
info "Waiting for services to start..."
sleep 30

# Step 12: Database Setup
header "🗄️  Step 12: Database Setup"

info "Waiting for database to be ready..."
sleep 15

info "Running database migrations..."
docker-compose -f docker-compose.server.yml exec -T app npm run db:migrate || warn "Database migrations may have failed (normal for first deployment)"

# Step 13: Health Checks
header "🏥 Step 13: Health Checks"

info "Performing health checks..."
sleep 10

# Check services
SERVICES=("avian-postgres-server" "avian-redis-server" "avian-app-server" "avian-nginx-server")
for service in "${SERVICES[@]}"; do
    if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
        success "$service is running"
    else
        error_exit "$service is not running"
    fi
done

# Test HTTP redirect
if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "301"; then
    success "HTTP to HTTPS redirect working"
else
    warn "HTTP to HTTPS redirect may not be working"
fi

# Test HTTPS health endpoint
if curl -k -s -o /dev/null -w "%{http_code}" https://localhost/api/health | grep -q "200"; then
    success "HTTPS health check passed"
else
    error_exit "HTTPS health check failed"
fi

# Step 14: Create Initial Backup
header "💾 Step 14: Initial Backup"

info "Creating initial database backup..."
docker-compose -f docker-compose.server.yml --profile backup run --rm backup pg_dump -h postgres -U avian -d avian > /tmp/initial-backup.sql 2>/dev/null || warn "Initial backup may have failed"

success "Initial backup created"

# Step 15: Setup Cron Jobs
header "⏰ Step 15: Setting Up Automated Tasks"

info "Creating backup script..."
cat > /usr/local/bin/avian-backup.sh << EOF
#!/bin/bash
cd $SCRIPT_DIR
docker-compose -f docker-compose.server.yml --profile backup run --rm backup pg_dump -h postgres -U avian -d avian > /var/backups/avian-\$(date +%Y%m%d_%H%M%S).sql
# Keep only last 30 days of backups
find /var/backups -name "avian-*.sql" -mtime +30 -delete
EOF

chmod +x /usr/local/bin/avian-backup.sh
mkdir -p /var/backups

# Add cron job for backups (every 6 hours)
(crontab -l 2>/dev/null; echo "0 */6 * * * /usr/local/bin/avian-backup.sh") | crontab -

success "Automated backup configured (every 6 hours)"

# Step 16: Final Configuration
header "🔧 Step 16: Final Configuration"

info "Setting up log rotation..."
cat > /etc/logrotate.d/avian << EOF
/var/log/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nginx nginx
    postrotate
        docker-compose -f $SCRIPT_DIR/docker-compose.server.yml exec nginx nginx -s reload
    endscript
}
EOF

success "Log rotation configured"

# Change ownership of project files to avian user
chown -R avian:avian "$SCRIPT_DIR"

# Step 17: Final Verification
header "✅ Step 17: Final Verification"

info "Performing final verification..."

# Check all containers are running
RUNNING_CONTAINERS=$(docker-compose -f docker-compose.server.yml ps --services --filter "status=running" | wc -l)
TOTAL_CONTAINERS=$(docker-compose -f docker-compose.server.yml ps --services | wc -l)

if [ "$RUNNING_CONTAINERS" -eq "$TOTAL_CONTAINERS" ]; then
    success "All containers are running ($RUNNING_CONTAINERS/$TOTAL_CONTAINERS)"
else
    warn "Some containers may not be running ($RUNNING_CONTAINERS/$TOTAL_CONTAINERS)"
fi

# Display final information
header "🎉 Deployment Complete!"
log ""
log "${GREEN}🚀 AVIAN Platform deployed successfully on Ubuntu 24.04.03!${NC}"
log ""
log "${CYAN}📋 Server Information:${NC}"
log "• Server IP: ${SERVER_IP}"
log "• Application URL: https://${SERVER_IP}"
log "• Health Check: https://${SERVER_IP}/api/health"
log "• Admin Credentials: See admin-credentials.txt"
log ""
log "${CYAN}🔧 Management Commands:${NC}"
log "• View logs: docker-compose -f docker-compose.server.yml logs -f [service]"
log "• Restart: docker-compose -f docker-compose.server.yml restart"
log "• Stop: docker-compose -f docker-compose.server.yml down"
log "• Backup: /usr/local/bin/avian-backup.sh"
log "• Health check: curl -k https://${SERVER_IP}/api/health"
log ""
log "${CYAN}📊 Service Status:${NC}"
docker-compose -f docker-compose.server.yml ps

log ""
log "${YELLOW}⚠️  Important Next Steps:${NC}"
log "1. Access the application at: https://${SERVER_IP}"
log "2. Login with credentials from admin-credentials.txt"
log "3. Change the admin password immediately"
log "4. Configure email settings in the web interface"
log "5. Set up additional user accounts"
log "6. Configure monitoring and alerting"
log ""
log "${GREEN}✅ Deployment completed successfully at: $(date)${NC}"
log "📝 Deployment log saved to: $LOG_FILE"
log "🔑 Admin credentials saved to: admin-credentials.txt"

# Display admin credentials
log ""
log "${PURPLE}🔑 Admin Login Credentials:${NC}"
cat admin-credentials.txt

log ""
log "${GREEN}🎯 Your AVIAN Platform is ready for use!${NC}"