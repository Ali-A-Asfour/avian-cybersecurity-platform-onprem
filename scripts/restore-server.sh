#!/bin/bash

# AVIAN Platform - Server Restore Script
# Comprehensive restore solution for on-premises deployment

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

# Usage function
usage() {
    log "Usage: $0 [OPTIONS] <backup-timestamp>"
    log ""
    log "Options:"
    log "  -d, --database-only    Restore only database"
    log "  -c, --config-only      Restore only configuration"
    log "  -a, --data-only        Restore only application data"
    log "  -f, --force           Skip confirmation prompts"
    log "  -h, --help            Show this help message"
    log ""
    log "Examples:"
    log "  $0 20240121_143022                    # Full restore"
    log "  $0 --database-only 20240121_143022   # Database only"
    log "  $0 --force 20240121_143022           # Skip confirmations"
    log ""
    log "Available backups:"
    find "$BACKUP_DIR" -name "avian-database-*.sql.gz" | sed 's/.*avian-database-\(.*\)\.sql\.gz/  \1/' | sort -r | head -10
}

# Parse command line arguments
DATABASE_ONLY=false
CONFIG_ONLY=false
DATA_ONLY=false
FORCE=false
BACKUP_TIMESTAMP=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--database-only)
            DATABASE_ONLY=true
            shift
            ;;
        -c|--config-only)
            CONFIG_ONLY=true
            shift
            ;;
        -a|--data-only)
            DATA_ONLY=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            if [ -z "$BACKUP_TIMESTAMP" ]; then
                BACKUP_TIMESTAMP="$1"
            else
                error "Unknown option: $1"
                usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Check if backup timestamp is provided
if [ -z "$BACKUP_TIMESTAMP" ]; then
    error "Backup timestamp is required"
    usage
    exit 1
fi

header "🔄 AVIAN Platform - Server Restore"
header "=================================="
log "Restore started at: $(date)"
log "Backup timestamp: $BACKUP_TIMESTAMP"
log ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

# Define backup file paths
DB_BACKUP_FILE="$BACKUP_DIR/avian-database-$BACKUP_TIMESTAMP.sql.gz"
CONFIG_BACKUP_FILE="$BACKUP_DIR/avian-config-$BACKUP_TIMESTAMP.tar.gz"
DATA_BACKUP_FILE="$BACKUP_DIR/avian-data-$BACKUP_TIMESTAMP.tar.gz"
MANIFEST_FILE="$BACKUP_DIR/avian-backup-manifest-$BACKUP_TIMESTAMP.txt"

# Step 1: Verify backup files exist
header "📋 Step 1: Backup Verification"

info "Verifying backup files exist..."

MISSING_FILES=()

if [ "$DATABASE_ONLY" = false ] && [ "$CONFIG_ONLY" = false ] && [ "$DATA_ONLY" = false ]; then
    # Full restore - check all files
    [ ! -f "$DB_BACKUP_FILE" ] && MISSING_FILES+=("Database backup: $DB_BACKUP_FILE")
    [ ! -f "$CONFIG_BACKUP_FILE" ] && MISSING_FILES+=("Configuration backup: $CONFIG_BACKUP_FILE")
    [ ! -f "$DATA_BACKUP_FILE" ] && MISSING_FILES+=("Data backup: $DATA_BACKUP_FILE")
else
    # Partial restore - check only requested files
    [ "$DATABASE_ONLY" = true ] && [ ! -f "$DB_BACKUP_FILE" ] && MISSING_FILES+=("Database backup: $DB_BACKUP_FILE")
    [ "$CONFIG_ONLY" = true ] && [ ! -f "$CONFIG_BACKUP_FILE" ] && MISSING_FILES+=("Configuration backup: $CONFIG_BACKUP_FILE")
    [ "$DATA_ONLY" = true ] && [ ! -f "$DATA_BACKUP_FILE" ] && MISSING_FILES+=("Data backup: $DATA_BACKUP_FILE")
fi

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    error "Missing backup files:"
    for file in "${MISSING_FILES[@]}"; do
        log "  - $file"
    done
    exit 1
fi

success "All required backup files found"

# Step 2: Verify backup integrity
header "🔍 Step 2: Backup Integrity Check"

info "Verifying backup file integrity..."

if [ "$DATABASE_ONLY" = false ] && [ "$CONFIG_ONLY" = false ] && [ "$DATA_ONLY" = false ] || [ "$DATABASE_ONLY" = true ]; then
    if [ -f "$DB_BACKUP_FILE" ]; then
        if gzip -t "$DB_BACKUP_FILE" 2>/dev/null; then
            success "Database backup integrity verified"
        else
            error "Database backup is corrupted"
            exit 1
        fi
    fi
fi

if [ "$DATABASE_ONLY" = false ] && [ "$CONFIG_ONLY" = false ] && [ "$DATA_ONLY" = false ] || [ "$CONFIG_ONLY" = true ]; then
    if [ -f "$CONFIG_BACKUP_FILE" ]; then
        if tar -tzf "$CONFIG_BACKUP_FILE" >/dev/null 2>&1; then
            success "Configuration backup integrity verified"
        else
            error "Configuration backup is corrupted"
            exit 1
        fi
    fi
fi

if [ "$DATABASE_ONLY" = false ] && [ "$CONFIG_ONLY" = false ] && [ "$DATA_ONLY" = false ] || [ "$DATA_ONLY" = true ]; then
    if [ -f "$DATA_BACKUP_FILE" ]; then
        if tar -tzf "$DATA_BACKUP_FILE" >/dev/null 2>&1; then
            success "Application data backup integrity verified"
        else
            error "Application data backup is corrupted"
            exit 1
        fi
    fi
fi

# Step 3: Show restore plan and get confirmation
header "📋 Step 3: Restore Plan"

log "The following will be restored:"
if [ "$DATABASE_ONLY" = false ] && [ "$CONFIG_ONLY" = false ] && [ "$DATA_ONLY" = false ]; then
    log "  ✓ Database (PostgreSQL)"
    log "  ✓ Configuration files"
    log "  ✓ Application data"
    log "  ✓ Full system restore"
else
    [ "$DATABASE_ONLY" = true ] && log "  ✓ Database (PostgreSQL) only"
    [ "$CONFIG_ONLY" = true ] && log "  ✓ Configuration files only"
    [ "$DATA_ONLY" = true ] && log "  ✓ Application data only"
fi

log ""
warn "This will overwrite current data!"

if [ "$FORCE" = false ]; then
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        info "Restore cancelled by user"
        exit 0
    fi
fi

# Step 4: Stop services (if not config-only restore)
if [ "$CONFIG_ONLY" = false ]; then
    header "🛑 Step 4: Stopping Services"
    
    info "Stopping AVIAN services..."
    
    if docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
        docker-compose -f $COMPOSE_FILE down
        success "Services stopped"
    else
        info "Services were not running"
    fi
fi

# Step 5: Restore database
if [ "$CONFIG_ONLY" = false ] && [ "$DATA_ONLY" = false ]; then
    header "🗄️  Step 5: Database Restore"
    
    info "Starting database for restore..."
    
    # Start only database service
    docker-compose -f $COMPOSE_FILE up -d postgres
    
    # Wait for database to be ready
    info "Waiting for database to be ready..."
    sleep 15
    
    # Check if database is ready
    if ! docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U avian -d avian; then
        error "Database is not ready"
        exit 1
    fi
    
    info "Restoring database from backup..."
    
    # Drop existing database and recreate
    docker-compose -f $COMPOSE_FILE exec -T postgres psql -U avian -d postgres -c "DROP DATABASE IF EXISTS avian;"
    docker-compose -f $COMPOSE_FILE exec -T postgres psql -U avian -d postgres -c "CREATE DATABASE avian;"
    
    # Restore database
    gunzip -c "$DB_BACKUP_FILE" | docker-compose -f $COMPOSE_FILE exec -T postgres psql -U avian -d avian
    
    success "Database restored successfully"
    
    # Stop database
    docker-compose -f $COMPOSE_FILE stop postgres
fi

# Step 6: Restore configuration
if [ "$DATABASE_ONLY" = false ] && [ "$DATA_ONLY" = false ]; then
    header "⚙️  Step 6: Configuration Restore"
    
    info "Backing up current configuration..."
    
    # Backup current config
    CURRENT_BACKUP="config-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$CURRENT_BACKUP" \
        .env.server \
        docker-compose.server.yml \
        nginx/ \
        admin-credentials.txt 2>/dev/null || warn "Some current config files may not exist"
    
    info "Restoring configuration from backup..."
    
    # Extract configuration
    tar -xzf "$CONFIG_BACKUP_FILE"
    
    success "Configuration restored successfully"
    success "Current configuration backed up to: $CURRENT_BACKUP"
fi

# Step 7: Restore application data
if [ "$DATABASE_ONLY" = false ] && [ "$CONFIG_ONLY" = false ]; then
    header "📁 Step 7: Application Data Restore"
    
    info "Restoring application data..."
    
    # Create temporary directory for extraction
    TEMP_DIR="/tmp/avian-restore-$$"
    mkdir -p "$TEMP_DIR"
    
    # Extract data backup
    tar -xzf "$DATA_BACKUP_FILE" -C "$TEMP_DIR"
    
    # Restore to Docker volumes using a temporary container
    if [ -d "$TEMP_DIR/uploads" ]; then
        docker run --rm \
            -v avian-cybersecurity-platform-onprem_app-uploads:/data \
            -v "$TEMP_DIR":/backup \
            alpine:latest \
            sh -c "rm -rf /data/* && cp -r /backup/uploads/* /data/ 2>/dev/null || true"
        success "Uploads data restored"
    fi
    
    if [ -d "$TEMP_DIR/logs" ]; then
        docker run --rm \
            -v avian-cybersecurity-platform-onprem_app-logs:/data \
            -v "$TEMP_DIR":/backup \
            alpine:latest \
            sh -c "rm -rf /data/* && cp -r /backup/logs/* /data/ 2>/dev/null || true"
        success "Logs data restored"
    fi
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    success "Application data restored successfully"
fi

# Step 8: Start services
if [ "$CONFIG_ONLY" = false ]; then
    header "🚀 Step 8: Starting Services"
    
    info "Starting all services..."
    
    docker-compose -f $COMPOSE_FILE up -d
    
    # Wait for services to start
    info "Waiting for services to start..."
    sleep 30
    
    success "Services started"
fi

# Step 9: Verify restore
header "✅ Step 9: Restore Verification"

info "Verifying restore..."

if [ "$CONFIG_ONLY" = false ]; then
    # Check services are running
    SERVICES=("avian-nginx-server" "avian-app-server" "avian-postgres-server" "avian-redis-server")
    ALL_HEALTHY=true
    
    for service in "${SERVICES[@]}"; do
        if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
            success "$service is running"
        else
            error "$service is not running"
            ALL_HEALTHY=false
        fi
    done
    
    # Test application health
    sleep 15
    if curl -k -s -o /dev/null -w "%{http_code}" https://localhost/api/health | grep -q "200"; then
        success "Application health check passed"
    else
        error "Application health check failed"
        ALL_HEALTHY=false
    fi
    
    if [ "$ALL_HEALTHY" = true ]; then
        success "All services are healthy"
    else
        error "Some services are not healthy"
    fi
fi

# Step 10: Restore summary
header "📋 Step 10: Restore Summary"

log ""
log "${GREEN}🎉 Restore completed successfully!${NC}"
log ""
log "${CYAN}📊 Restore Summary:${NC}"
log "• Restore completed at: $(date)"
log "• Backup timestamp: $BACKUP_TIMESTAMP"

if [ "$DATABASE_ONLY" = false ] && [ "$CONFIG_ONLY" = false ] && [ "$DATA_ONLY" = false ]; then
    log "• Database: Restored"
    log "• Configuration: Restored"
    log "• Application data: Restored"
    log "• Restore type: Full system restore"
else
    [ "$DATABASE_ONLY" = true ] && log "• Database: Restored"
    [ "$CONFIG_ONLY" = true ] && log "• Configuration: Restored"
    [ "$DATA_ONLY" = true ] && log "• Application data: Restored"
    log "• Restore type: Partial restore"
fi

log ""
log "${CYAN}🔧 Post-Restore Actions:${NC}"
log "1. Test all application functionality"
log "2. Verify user accounts and permissions"
log "3. Check system logs: docker-compose -f $COMPOSE_FILE logs -f"
log "4. Run health check: ./health-check.sh"
log "5. Update passwords if necessary"
log ""

if [ -f "$MANIFEST_FILE" ]; then
    log "${CYAN}📄 Backup Manifest:${NC}"
    cat "$MANIFEST_FILE"
fi

log ""
log "${GREEN}✅ Restore completed successfully at: $(date)${NC}"