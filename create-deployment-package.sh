#!/bin/bash

# AVIAN Platform - Create Deployment Package
# Creates a complete deployment package for fresh server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PACKAGE_NAME="avian-platform-deployment-$(date +%Y%m%d_%H%M%S)"
PACKAGE_DIR="/tmp/$PACKAGE_NAME"

# Logging function
log() {
    echo -e "$1"
}

# Success message
success() {
    log "${GREEN}✅ $1${NC}"
}

# Error message
error() {
    log "${RED}❌ $1${NC}"
}

# Info message
info() {
    log "${BLUE}ℹ️  $1${NC}"
}

# Header
header() {
    log "${PURPLE}$1${NC}"
}

header "📦 AVIAN Platform - Deployment Package Creator"
header "=============================================="
log "Creating deployment package: $PACKAGE_NAME"
log "Package directory: $PACKAGE_DIR"
log ""

# Step 1: Create package directory
header "📁 Step 1: Creating Package Directory"

info "Creating package directory structure..."

mkdir -p "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/scripts"
mkdir -p "$PACKAGE_DIR/nginx"
mkdir -p "$PACKAGE_DIR/database"
mkdir -p "$PACKAGE_DIR/src"
mkdir -p "$PACKAGE_DIR/docs"

success "Package directory created"

# Step 2: Copy essential files
header "📋 Step 2: Copying Essential Files"

info "Copying deployment scripts..."

# Deployment scripts
cp deploy-to-server.sh "$PACKAGE_DIR/"
cp health-check.sh "$PACKAGE_DIR/"
cp update-server.sh "$PACKAGE_DIR/"
cp transfer-to-server.sh "$PACKAGE_DIR/"

# Management scripts
cp scripts/backup-server.sh "$PACKAGE_DIR/scripts/"
cp scripts/restore-server.sh "$PACKAGE_DIR/scripts/"

success "Deployment scripts copied"

info "Copying application files..."

# Core application files
cp package.json "$PACKAGE_DIR/"
cp package-lock.json "$PACKAGE_DIR/" 2>/dev/null || true
cp Dockerfile "$PACKAGE_DIR/"
cp docker-compose.prod.yml "$PACKAGE_DIR/"
cp next.config.ts "$PACKAGE_DIR/"
cp tailwind.config.js "$PACKAGE_DIR/"
cp tsconfig.json "$PACKAGE_DIR/"
cp drizzle.config.ts "$PACKAGE_DIR/"
cp .env.production.template "$PACKAGE_DIR/"
cp .gitignore "$PACKAGE_DIR/"
cp README.md "$PACKAGE_DIR/"

success "Application files copied"

info "Copying source code..."

# Source code
cp -r src/ "$PACKAGE_DIR/"
cp -r database/ "$PACKAGE_DIR/"
cp -r public/ "$PACKAGE_DIR/" 2>/dev/null || true

success "Source code copied"

info "Copying configuration files..."

# Configuration files
cp -r nginx/ "$PACKAGE_DIR/" 2>/dev/null || mkdir -p "$PACKAGE_DIR/nginx"

success "Configuration files copied"

# Step 3: Copy documentation
header "📚 Step 3: Copying Documentation"

info "Copying documentation files..."

# Documentation
cp FRESH_SERVER_DEPLOYMENT.md "$PACKAGE_DIR/"
cp DEPLOYMENT_PACKAGE_README.md "$PACKAGE_DIR/"
cp QUICK_START_GUIDE.md "$PACKAGE_DIR/"
cp SERVER_MANAGEMENT_GUIDE.md "$PACKAGE_DIR/"

# Additional docs
cp -r docs/ "$PACKAGE_DIR/" 2>/dev/null || true

success "Documentation copied"

# Step 4: Create server-specific configurations
header "⚙️  Step 4: Creating Server-Specific Configurations"

info "Creating server configuration templates..."

# Create nginx configuration template
cat > "$PACKAGE_DIR/nginx/server.conf.template" << 'EOF'
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
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
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
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Upstream
    upstream app {
        server app:3000;
        keepalive 32;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name SERVER_IP localhost avian.local;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name SERVER_IP localhost avian.local;

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
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 86400;
        }

        # Login endpoint with stricter rate limiting
        location /api/auth/ {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
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
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Health check (no rate limiting)
        location /api/health {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            access_log off;
        }
    }
}
EOF

success "Server configuration templates created"

# Step 5: Create deployment instructions
header "📝 Step 5: Creating Deployment Instructions"

info "Creating deployment instructions..."

cat > "$PACKAGE_DIR/DEPLOY_INSTRUCTIONS.md" << EOF
# AVIAN Platform - Deployment Instructions
## Fresh Ubuntu 24.04.03 Server

## Quick Deployment

### 1. Transfer Files to Server
\`\`\`bash
# Option A: Use the transfer script (from your local machine)
./transfer-to-server.sh -u YOUR_USERNAME -i 192.168.1.115

# Option B: Manual transfer
scp -r $PACKAGE_NAME/ user@192.168.1.115:~/avian-platform/
\`\`\`

### 2. SSH into Server
\`\`\`bash
ssh user@192.168.1.115
cd avian-platform
\`\`\`

### 3. Run Deployment
\`\`\`bash
sudo ./deploy-to-server.sh
\`\`\`

### 4. Access Platform
- URL: https://192.168.1.115
- Admin credentials: Check admin-credentials.txt after deployment

## What Gets Installed

- ✅ Docker and Docker Compose
- ✅ UFW Firewall (ports 22, 80, 443)
- ✅ Fail2ban intrusion prevention
- ✅ SSL certificates for HTTPS
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ Nginx reverse proxy
- ✅ AVIAN application
- ✅ Automated backups (every 6 hours)
- ✅ Health monitoring
- ✅ Log rotation

## Management Commands

\`\`\`bash
# Check system health
sudo ./health-check.sh

# View logs
sudo docker-compose -f docker-compose.server.yml logs -f

# Create backup
sudo ./scripts/backup-server.sh

# Update platform
sudo ./update-server.sh

# Restart services
sudo docker-compose -f docker-compose.server.yml restart
\`\`\`

## Troubleshooting

If deployment fails:
1. Check deployment.log for errors
2. Verify server meets requirements (8+ CPU, 16GB+ RAM)
3. Ensure internet connectivity
4. Run: sudo ./deploy-to-server.sh (script is idempotent)

## Support

- Deployment logs: deployment.log
- Application logs: sudo docker-compose -f docker-compose.server.yml logs app
- Health check: sudo ./health-check.sh
- Documentation: See *.md files in this package
EOF

success "Deployment instructions created"

# Step 6: Set permissions
header "🔐 Step 6: Setting File Permissions"

info "Setting executable permissions..."

chmod +x "$PACKAGE_DIR"/*.sh
chmod +x "$PACKAGE_DIR"/scripts/*.sh

success "File permissions set"

# Step 7: Create package archive
header "📦 Step 7: Creating Package Archive"

info "Creating deployment package archive..."

cd /tmp
tar -czf "${PACKAGE_NAME}.tar.gz" "$PACKAGE_NAME"

PACKAGE_SIZE=$(du -sh "${PACKAGE_NAME}.tar.gz" | cut -f1)

success "Package archive created: ${PACKAGE_NAME}.tar.gz ($PACKAGE_SIZE)"

# Step 8: Create checksums
header "🔍 Step 8: Creating Checksums"

info "Generating checksums..."

cd /tmp
md5sum "${PACKAGE_NAME}.tar.gz" > "${PACKAGE_NAME}.md5"
sha256sum "${PACKAGE_NAME}.tar.gz" > "${PACKAGE_NAME}.sha256"

success "Checksums created"

# Step 9: Final summary
header "✅ Step 9: Package Summary"

log ""
log "${GREEN}🎉 Deployment package created successfully!${NC}"
log ""
log "${CYAN}📦 Package Information:${NC}"
log "• Package name: ${PACKAGE_NAME}.tar.gz"
log "• Package size: $PACKAGE_SIZE"
log "• Location: /tmp/${PACKAGE_NAME}.tar.gz"
log "• MD5 checksum: /tmp/${PACKAGE_NAME}.md5"
log "• SHA256 checksum: /tmp/${PACKAGE_NAME}.sha256"
log ""
log "${CYAN}📁 Package Contents:${NC}"
log "• Deployment scripts (deploy-to-server.sh, health-check.sh, etc.)"
log "• Complete AVIAN application source code"
log "• Database schemas and migrations"
log "• Docker configuration files"
log "• Nginx configuration templates"
log "• Management and backup scripts"
log "• Complete documentation"
log ""
log "${CYAN}🚀 Deployment Steps:${NC}"
log "1. Transfer package to server:"
log "   ${YELLOW}scp /tmp/${PACKAGE_NAME}.tar.gz user@192.168.1.115:~/${NC}"
log ""
log "2. SSH into server and extract:"
log "   ${YELLOW}ssh user@192.168.1.115${NC}"
log "   ${YELLOW}tar -xzf ${PACKAGE_NAME}.tar.gz${NC}"
log "   ${YELLOW}cd ${PACKAGE_NAME}${NC}"
log ""
log "3. Run deployment:"
log "   ${YELLOW}sudo ./deploy-to-server.sh${NC}"
log ""
log "4. Access platform:"
log "   ${YELLOW}https://192.168.1.115${NC}"
log ""
log "${GREEN}✅ Package creation completed at: $(date)${NC}"

# Create quick deployment script
cat > /tmp/quick-deploy-${PACKAGE_NAME}.sh << EOF
#!/bin/bash
# Quick deployment script for AVIAN Platform

SERVER_IP="192.168.1.115"
SERVER_USER="ubuntu"  # Change this to your server username
PACKAGE_FILE="${PACKAGE_NAME}.tar.gz"

echo "🚀 AVIAN Platform Quick Deployment"
echo "=================================="
echo "Server: \${SERVER_USER}@\${SERVER_IP}"
echo "Package: \${PACKAGE_FILE}"
echo ""

# Transfer package
echo "📤 Transferring package to server..."
scp "\${PACKAGE_FILE}" "\${SERVER_USER}@\${SERVER_IP}:~/"

# Deploy on server
echo "🚀 Running deployment on server..."
ssh "\${SERVER_USER}@\${SERVER_IP}" "
    tar -xzf \${PACKAGE_FILE}
    cd ${PACKAGE_NAME}
    sudo ./deploy-to-server.sh
"

echo ""
echo "✅ Deployment completed!"
echo "🌐 Access your platform: https://\${SERVER_IP}"
EOF

chmod +x /tmp/quick-deploy-${PACKAGE_NAME}.sh

log ""
log "${BLUE}💡 Bonus: Quick deployment script created: /tmp/quick-deploy-${PACKAGE_NAME}.sh${NC}"
log "   Edit the SERVER_USER variable and run this script for one-command deployment!"