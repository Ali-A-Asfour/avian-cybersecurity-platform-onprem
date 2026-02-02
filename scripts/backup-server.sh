#!/bin/bash

# AVIAN Platform - Server Backup Script
# Comprehensive backup solution for on-premises deployment

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
COMPOSE_FILE="docker-compose.server.yml"
BACKUP_DIR="/var/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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

# Warning message
warn() {
    log "${YELLOW}⚠️  $1${NC}"
}

# Info message
info() {
    log "${BLUE}ℹ️  $1${NC}"
}

# Header
header() {
    log "${PURPLE}$1${NC}"
}

header "💾 AVIAN Platform - Backup Script"
header "================================="
log "Backup started at: $(date)"
log ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Step 1: Database Backup
header "🗄️  Step 1: Database Backup"

info "Creating database backup..."

DB_BACKUP_FILE="$BACKUP_DIR/avian-database-$TIMESTAMP.sql"

# Create database backup
if docker-compose -f $COMPOSE_FILE --profile backup run --rm backup pg_dump -h postgres -U avian -d avian > "$DB_BACKUP_FILE" 2>/dev/null; then
    success "Database backup created: $DB_BACKUP_FILE"
    
    # Compress the backup
    gzip "$DB_BACKUP_FILE"
    success "Database backup compressed: ${DB_BACKUP_FILE}.gz"
else
    error "Failed to create database backup"
    exit 1
fi

# Step 2: Configuration Backup
header "⚙️  Step 2: Configuration Backup"

info "Creating configuration backup..."

CONFIG_BACKUP_FILE="$BACKUP_DIR/avian-config-$TIMESTAMP.tar.gz"

# Create configuration backup
tar -czf "$CONFIG_BACKUP_FILE" \
    .env.server \
    docker-compose.server.yml \
    nginx/ \
    admin-credentials.txt 2>/dev/null || warn "Some configuration files may be missing"

if [ -f "$CONFIG_BACKUP_FILE" ]; then
    success "Configuration backup created: $CONFIG_BACKUP_FILE"
else
    error "Failed to create configuration backup"
fi

# Step 3: Application Data Backup
header "📁 Step 3: Application Data Backup"

info "Creating application data backup..."

DATA_BACKUP_FILE="$BACKUP_DIR/avian-data-$TIMESTAMP.tar.gz"

# Backup Docker volumes
docker run --rm \
    -v avian-cybersecurity-platform-onprem_app-uploads:/data/uploads:ro \
    -v avian-cybersecurity-platform-onprem_app-logs:/data/logs:ro \
    -v "$BACKUP_DIR":/backup \
    alpine:latest \
    tar -czf "/backup/avian-data-$TIMESTAMP.tar.gz" -C /data . 2>/dev/null || warn "Some application data may not be available"

if [ -f "$DATA_BACKUP_FILE" ]; then
    success "Application data backup created: $DATA_BACKUP_FILE"
else
    warn "Application data backup may have failed"
fi

# Step 4: System Information Backup
header "📊 Step 4: System Information Backup"

info "Creating system information backup..."

SYSINFO_FILE="$BACKUP_DIR/avian-sysinfo-$TIMESTAMP.txt"

cat > "$SYSINFO_FILE" << EOF
AVIAN Platform - System Information Backup
Generated on: $(date)
Server: $(hostname)
OS: $(lsb_release -d | cut -f2)
Kernel: $(uname -r)
Architecture: $(uname -m)
CPU Cores: $(nproc)
Total RAM: $(free -h | awk '/^Mem:/ {print $2}')
Disk Usage: $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 ")"}')

Docker Version: $(docker --version)
Docker Compose Version: $(docker-compose --version)

Container Status:
$(docker-compose -f $COMPOSE_FILE ps)

Docker Images:
$(docker images | grep avian)

Volume Information:
$(docker volume ls | grep avian)

Network Information:
$(docker network ls | grep avian)

Firewall Status:
$(ufw status)

Fail2ban Status:
$(systemctl is-active fail2ban || echo "Not running")

Recent Application Logs (last 50 lines):
$(docker-compose -f $COMPOSE_FILE logs --tail=50 app 2>/dev/null || echo "Logs not available")
EOF

success "System information backup created: $SYSINFO_FILE"

# Step 5: Backup Verification
header "✅ Step 5: Backup Verification"

info "Verifying backup integrity..."

# Check database backup
if [ -f "${DB_BACKUP_FILE}.gz" ]; then
    if gzip -t "${DB_BACKUP_FILE}.gz" 2>/dev/null; then
        success "Database backup integrity verified"
    else
        error "Database backup is corrupted"
    fi
else
    error "Database backup file not found"
fi

# Check configuration backup
if [ -f "$CONFIG_BACKUP_FILE" ]; then
    if tar -tzf "$CONFIG_BACKUP_FILE" >/dev/null 2>&1; then
        success "Configuration backup integrity verified"
    else
        error "Configuration backup is corrupted"
    fi
else
    error "Configuration backup file not found"
fi

# Step 6: Cleanup Old Backups
header "🧹 Step 6: Cleanup Old Backups"

info "Cleaning up old backups (older than $RETENTION_DAYS days)..."

# Count files before cleanup
OLD_COUNT=$(find "$BACKUP_DIR" -name "avian-*" -mtime +$RETENTION_DAYS | wc -l)

if [ "$OLD_COUNT" -gt 0 ]; then
    find "$BACKUP_DIR" -name "avian-*" -mtime +$RETENTION_DAYS -delete
    success "Removed $OLD_COUNT old backup files"
else
    info "No old backup files to remove"
fi

# Step 7: Backup Summary
header "📋 Step 7: Backup Summary"

info "Calculating backup sizes..."

DB_SIZE=$(du -h "${DB_BACKUP_FILE}.gz" 2>/dev/null | cut -f1 || echo "N/A")
CONFIG_SIZE=$(du -h "$CONFIG_BACKUP_FILE" 2>/dev/null | cut -f1 || echo "N/A")
DATA_SIZE=$(du -h "$DATA_BACKUP_FILE" 2>/dev/null | cut -f1 || echo "N/A")
SYSINFO_SIZE=$(du -h "$SYSINFO_FILE" 2>/dev/null | cut -f1 || echo "N/A")

TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "avian-*" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

log ""
log "${GREEN}🎉 Backup completed successfully!${NC}"
log ""
log "${CYAN}📊 Backup Summary:${NC}"
log "• Database backup: ${DB_SIZE} (${DB_BACKUP_FILE}.gz)"
log "• Configuration backup: ${CONFIG_SIZE} ($CONFIG_BACKUP_FILE)"
log "• Application data backup: ${DATA_SIZE} ($DATA_BACKUP_FILE)"
log "• System information: ${SYSINFO_SIZE} ($SYSINFO_FILE)"
log ""
log "${CYAN}📁 Backup Directory:${NC}"
log "• Location: $BACKUP_DIR"
log "• Total backups: $TOTAL_BACKUPS"
log "• Total size: $TOTAL_SIZE"
log "• Retention: $RETENTION_DAYS days"
log ""
log "${CYAN}🔧 Restore Commands:${NC}"
log "• Database: gunzip -c ${DB_BACKUP_FILE}.gz | docker-compose -f $COMPOSE_FILE exec -T postgres psql -U avian -d avian"
log "• Configuration: tar -xzf $CONFIG_BACKUP_FILE"
log "• Application data: tar -xzf $DATA_BACKUP_FILE -C /path/to/restore/"
log ""
log "${GREEN}✅ Backup completed at: $(date)${NC}"

# Create backup manifest
MANIFEST_FILE="$BACKUP_DIR/avian-backup-manifest-$TIMESTAMP.txt"
cat > "$MANIFEST_FILE" << EOF
AVIAN Platform Backup Manifest
Generated: $(date)
Timestamp: $TIMESTAMP

Files:
- Database: ${DB_BACKUP_FILE}.gz ($DB_SIZE)
- Configuration: $CONFIG_BACKUP_FILE ($CONFIG_SIZE)
- Application Data: $DATA_BACKUP_FILE ($DATA_SIZE)
- System Information: $SYSINFO_FILE ($SYSINFO_SIZE)

Checksums:
$(md5sum "${DB_BACKUP_FILE}.gz" "$CONFIG_BACKUP_FILE" "$DATA_BACKUP_FILE" "$SYSINFO_FILE" 2>/dev/null || echo "Checksums not available")

Restore Instructions:
1. Stop services: docker-compose -f $COMPOSE_FILE down
2. Restore database: gunzip -c ${DB_BACKUP_FILE}.gz | docker-compose -f $COMPOSE_FILE exec -T postgres psql -U avian -d avian
3. Restore configuration: tar -xzf $CONFIG_BACKUP_FILE
4. Restore data: tar -xzf $DATA_BACKUP_FILE -C /restore/path/
5. Start services: docker-compose -f $COMPOSE_FILE up -d
EOF

success "Backup manifest created: $MANIFEST_FILE"