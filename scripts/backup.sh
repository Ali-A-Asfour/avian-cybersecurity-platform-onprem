#!/bin/bash
#
# AVIAN Platform Backup Script
# 
# This script backs up PostgreSQL database, Redis data, and environment configuration
# Requirements: 17.1, 17.2, 17.3
#
# Usage: ./scripts/backup.sh [backup-directory]
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${1:-${PROJECT_ROOT}/backups}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Docker Compose file
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.production.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Check if services are running
check_services() {
    if ! docker compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        log_warn "Services may not be running. Backup may fail."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Create backup directory
create_backup_dir() {
    log_info "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    
    if [ ! -w "$BACKUP_DIR" ]; then
        log_error "Backup directory is not writable: $BACKUP_DIR"
        exit 1
    fi
}

# Backup PostgreSQL database
backup_postgres() {
    log_info "Backing up PostgreSQL database..."
    
    local backup_file="${BACKUP_DIR}/postgres_${DATE}.sql.gz"
    
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U avian avian | gzip > "$backup_file"; then
        local size=$(du -h "$backup_file" | cut -f1)
        log_info "PostgreSQL backup completed: $backup_file ($size)"
        return 0
    else
        log_error "PostgreSQL backup failed"
        return 1
    fi
}

# Backup Redis data
backup_redis() {
    log_info "Backing up Redis data..."
    
    local backup_file="${BACKUP_DIR}/redis_${DATE}.rdb"
    
    # Trigger Redis save
    if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD:-}" SAVE > /dev/null 2>&1; then
        # Copy RDB file from container
        if docker cp avian-redis:/data/dump.rdb "$backup_file" 2>/dev/null; then
            local size=$(du -h "$backup_file" | cut -f1)
            log_info "Redis backup completed: $backup_file ($size)"
            return 0
        else
            log_error "Failed to copy Redis backup file"
            return 1
        fi
    else
        log_error "Redis backup failed"
        return 1
    fi
}

# Backup environment configuration
backup_env() {
    log_info "Backing up environment configuration..."
    
    local env_file="${PROJECT_ROOT}/.env.production"
    local backup_file="${BACKUP_DIR}/env_${DATE}.backup"
    
    if [ -f "$env_file" ]; then
        if cp "$env_file" "$backup_file"; then
            # Set restrictive permissions on backup
            chmod 600 "$backup_file"
            log_info "Environment backup completed: $backup_file"
            return 0
        else
            log_error "Failed to backup environment file"
            return 1
        fi
    else
        log_warn "Environment file not found: $env_file"
        return 1
    fi
}

# Backup SSL certificates
backup_ssl() {
    log_info "Backing up SSL certificates..."
    
    local ssl_dir="${PROJECT_ROOT}/nginx/ssl"
    local backup_file="${BACKUP_DIR}/ssl_${DATE}.tar.gz"
    
    if [ -d "$ssl_dir" ] && [ "$(ls -A $ssl_dir)" ]; then
        if tar -czf "$backup_file" -C "$ssl_dir" .; then
            chmod 600 "$backup_file"
            log_info "SSL certificates backup completed: $backup_file"
            return 0
        else
            log_error "Failed to backup SSL certificates"
            return 1
        fi
    else
        log_warn "SSL directory not found or empty: $ssl_dir"
        return 1
    fi
}

# Create backup manifest
create_manifest() {
    log_info "Creating backup manifest..."
    
    local manifest_file="${BACKUP_DIR}/manifest_${DATE}.txt"
    
    cat > "$manifest_file" << EOF
AVIAN Platform Backup Manifest
==============================
Backup Date: $(date)
Backup Directory: $BACKUP_DIR

Files:
------
$(ls -lh "${BACKUP_DIR}"/*_${DATE}.* 2>/dev/null || echo "No backup files found")

System Information:
------------------
Hostname: $(hostname)
Docker Version: $(docker --version)
Docker Compose Version: $(docker compose version)

Services Status:
---------------
$(docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || echo "Services not running")

EOF
    
    log_info "Manifest created: $manifest_file"
}

# Rotate old backups
rotate_backups() {
    log_info "Rotating old backups (keeping last $RETENTION_DAYS days)..."
    
    local deleted_count=0
    
    # Find and delete old backup files
    while IFS= read -r file; do
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -type f \( -name "*.gz" -o -name "*.rdb" -o -name "*.backup" -o -name "*.tar.gz" -o -name "*.txt" \) -mtime +$RETENTION_DAYS)
    
    if [ $deleted_count -gt 0 ]; then
        log_info "Deleted $deleted_count old backup file(s)"
    else
        log_info "No old backups to delete"
    fi
}

# Calculate backup size
calculate_backup_size() {
    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    log_info "Total backup directory size: $total_size"
}

# Main backup function
main() {
    log_info "Starting AVIAN Platform backup..."
    log_info "Backup directory: $BACKUP_DIR"
    log_info "Timestamp: $DATE"
    echo
    
    # Pre-flight checks
    check_docker
    check_services
    create_backup_dir
    
    # Perform backups
    local success=0
    local failed=0
    
    backup_postgres && ((success++)) || ((failed++))
    backup_redis && ((success++)) || ((failed++))
    backup_env && ((success++)) || ((failed++))
    backup_ssl && ((success++)) || ((failed++))
    
    # Create manifest
    create_manifest
    
    # Rotate old backups
    rotate_backups
    
    # Calculate total size
    calculate_backup_size
    
    # Summary
    echo
    log_info "Backup completed!"
    log_info "Successful: $success"
    if [ $failed -gt 0 ]; then
        log_warn "Failed: $failed"
    fi
    
    # Exit with error if any backup failed
    if [ $failed -gt 0 ]; then
        exit 1
    fi
}

# Run main function
main "$@"
