#!/bin/bash
#
# AVIAN Platform Restore Script
# 
# This script restores PostgreSQL database, Redis data, and environment configuration from backup
# Requirements: 17.4, 17.5
#
# Usage: ./scripts/restore.sh <backup-timestamp>
# Example: ./scripts/restore.sh 20260106_143022
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"

# Docker Compose file
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.production.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Show usage
usage() {
    cat << EOF
Usage: $0 <backup-timestamp> [options]

Restore AVIAN Platform from backup.

Arguments:
  backup-timestamp    Timestamp of the backup to restore (e.g., 20260106_143022)

Options:
  --postgres-only     Restore only PostgreSQL database
  --redis-only        Restore only Redis data
  --env-only          Restore only environment configuration
  --ssl-only          Restore only SSL certificates
  --skip-postgres     Skip PostgreSQL restore
  --skip-redis        Skip Redis restore
  --skip-env          Skip environment restore
  --skip-ssl          Skip SSL restore
  --no-confirm        Skip confirmation prompts (dangerous!)

Examples:
  $0 20260106_143022                    # Restore everything
  $0 20260106_143022 --postgres-only    # Restore only database
  $0 20260106_143022 --skip-redis       # Restore everything except Redis

Available backups:
$(ls -1 "$BACKUP_DIR"/postgres_*.sql.gz 2>/dev/null | sed 's/.*postgres_\(.*\)\.sql\.gz/  \1/' | sort -r | head -10 || echo "  No backups found")

EOF
    exit 1
}

# Parse arguments
BACKUP_TIMESTAMP=""
RESTORE_POSTGRES=true
RESTORE_REDIS=true
RESTORE_ENV=true
RESTORE_SSL=true
NO_CONFIRM=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --postgres-only)
            RESTORE_REDIS=false
            RESTORE_ENV=false
            RESTORE_SSL=false
            shift
            ;;
        --redis-only)
            RESTORE_POSTGRES=false
            RESTORE_ENV=false
            RESTORE_SSL=false
            shift
            ;;
        --env-only)
            RESTORE_POSTGRES=false
            RESTORE_REDIS=false
            RESTORE_SSL=false
            shift
            ;;
        --ssl-only)
            RESTORE_POSTGRES=false
            RESTORE_REDIS=false
            RESTORE_ENV=false
            shift
            ;;
        --skip-postgres)
            RESTORE_POSTGRES=false
            shift
            ;;
        --skip-redis)
            RESTORE_REDIS=false
            shift
            ;;
        --skip-env)
            RESTORE_ENV=false
            shift
            ;;
        --skip-ssl)
            RESTORE_SSL=false
            shift
            ;;
        --no-confirm)
            NO_CONFIRM=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [ -z "$BACKUP_TIMESTAMP" ]; then
                BACKUP_TIMESTAMP="$1"
            else
                log_error "Unknown option: $1"
                usage
            fi
            shift
            ;;
    esac
done

# Check if timestamp provided
if [ -z "$BACKUP_TIMESTAMP" ]; then
    log_error "Backup timestamp is required"
    usage
fi

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Verify backup files exist
verify_backup_files() {
    log_step "Verifying backup files..."
    
    local missing=0
    
    if [ "$RESTORE_POSTGRES" = true ]; then
        if [ ! -f "${BACKUP_DIR}/postgres_${BACKUP_TIMESTAMP}.sql.gz" ]; then
            log_error "PostgreSQL backup not found: postgres_${BACKUP_TIMESTAMP}.sql.gz"
            ((missing++))
        else
            log_info "Found PostgreSQL backup"
        fi
    fi
    
    if [ "$RESTORE_REDIS" = true ]; then
        if [ ! -f "${BACKUP_DIR}/redis_${BACKUP_TIMESTAMP}.rdb" ]; then
            log_error "Redis backup not found: redis_${BACKUP_TIMESTAMP}.rdb"
            ((missing++))
        else
            log_info "Found Redis backup"
        fi
    fi
    
    if [ "$RESTORE_ENV" = true ]; then
        if [ ! -f "${BACKUP_DIR}/env_${BACKUP_TIMESTAMP}.backup" ]; then
            log_warn "Environment backup not found: env_${BACKUP_TIMESTAMP}.backup"
        else
            log_info "Found environment backup"
        fi
    fi
    
    if [ "$RESTORE_SSL" = true ]; then
        if [ ! -f "${BACKUP_DIR}/ssl_${BACKUP_TIMESTAMP}.tar.gz" ]; then
            log_warn "SSL backup not found: ssl_${BACKUP_TIMESTAMP}.tar.gz"
        else
            log_info "Found SSL backup"
        fi
    fi
    
    if [ $missing -gt 0 ]; then
        log_error "Missing required backup files. Cannot proceed."
        exit 1
    fi
}

# Confirm restore operation
confirm_restore() {
    if [ "$NO_CONFIRM" = true ]; then
        return 0
    fi
    
    echo
    log_warn "⚠️  WARNING: This will overwrite current data!"
    echo
    echo "Restore configuration:"
    echo "  Backup timestamp: $BACKUP_TIMESTAMP"
    echo "  PostgreSQL: $([ "$RESTORE_POSTGRES" = true ] && echo "YES" || echo "NO")"
    echo "  Redis: $([ "$RESTORE_REDIS" = true ] && echo "YES" || echo "NO")"
    echo "  Environment: $([ "$RESTORE_ENV" = true ] && echo "YES" || echo "NO")"
    echo "  SSL: $([ "$RESTORE_SSL" = true ] && echo "YES" || echo "NO")"
    echo
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " -r
    echo
    
    if [ "$REPLY" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi
}

# Stop services
stop_services() {
    log_step "Stopping services..."
    
    if docker compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        docker compose -f "$COMPOSE_FILE" down
        log_info "Services stopped"
    else
        log_info "Services already stopped"
    fi
}

# Restore PostgreSQL database
restore_postgres() {
    log_step "Restoring PostgreSQL database..."
    
    local backup_file="${BACKUP_DIR}/postgres_${BACKUP_TIMESTAMP}.sql.gz"
    
    # Start only PostgreSQL
    docker compose -f "$COMPOSE_FILE" up -d postgres
    
    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    sleep 5
    
    local retries=30
    while ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U avian > /dev/null 2>&1; do
        ((retries--))
        if [ $retries -eq 0 ]; then
            log_error "PostgreSQL failed to start"
            return 1
        fi
        sleep 1
    done
    
    # Drop and recreate database
    log_info "Dropping existing database..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U avian -d postgres -c "DROP DATABASE IF EXISTS avian;" || true
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U avian -d postgres -c "CREATE DATABASE avian;"
    
    # Restore from backup
    log_info "Restoring database from backup..."
    if gunzip < "$backup_file" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U avian -d avian > /dev/null; then
        log_info "PostgreSQL restore completed successfully"
        return 0
    else
        log_error "PostgreSQL restore failed"
        return 1
    fi
}

# Restore Redis data
restore_redis() {
    log_step "Restoring Redis data..."
    
    local backup_file="${BACKUP_DIR}/redis_${BACKUP_TIMESTAMP}.rdb"
    
    # Start only Redis
    docker compose -f "$COMPOSE_FILE" up -d redis
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    sleep 3
    
    # Stop Redis to replace RDB file
    docker compose -f "$COMPOSE_FILE" stop redis
    
    # Copy backup file to container
    log_info "Copying Redis backup to container..."
    if docker cp "$backup_file" avian-redis:/data/dump.rdb; then
        # Set proper permissions
        docker compose -f "$COMPOSE_FILE" start redis
        
        # Wait for Redis to load data
        sleep 2
        
        log_info "Redis restore completed successfully"
        return 0
    else
        log_error "Redis restore failed"
        return 1
    fi
}

# Restore environment configuration
restore_env() {
    log_step "Restoring environment configuration..."
    
    local backup_file="${BACKUP_DIR}/env_${BACKUP_TIMESTAMP}.backup"
    local env_file="${PROJECT_ROOT}/.env.production"
    
    if [ -f "$backup_file" ]; then
        # Backup current env file if it exists
        if [ -f "$env_file" ]; then
            cp "$env_file" "${env_file}.pre-restore.$(date +%Y%m%d_%H%M%S)"
            log_info "Current environment file backed up"
        fi
        
        # Restore from backup
        if cp "$backup_file" "$env_file"; then
            chmod 600 "$env_file"
            log_info "Environment configuration restored successfully"
            return 0
        else
            log_error "Failed to restore environment configuration"
            return 1
        fi
    else
        log_warn "Environment backup file not found, skipping"
        return 1
    fi
}

# Restore SSL certificates
restore_ssl() {
    log_step "Restoring SSL certificates..."
    
    local backup_file="${BACKUP_DIR}/ssl_${BACKUP_TIMESTAMP}.tar.gz"
    local ssl_dir="${PROJECT_ROOT}/nginx/ssl"
    
    if [ -f "$backup_file" ]; then
        # Backup current SSL directory if it exists
        if [ -d "$ssl_dir" ] && [ "$(ls -A $ssl_dir)" ]; then
            local ssl_backup="${ssl_dir}.pre-restore.$(date +%Y%m%d_%H%M%S)"
            mv "$ssl_dir" "$ssl_backup"
            log_info "Current SSL directory backed up to: $ssl_backup"
        fi
        
        # Create SSL directory
        mkdir -p "$ssl_dir"
        
        # Restore from backup
        if tar -xzf "$backup_file" -C "$ssl_dir"; then
            chmod 600 "$ssl_dir"/*.pem 2>/dev/null || true
            log_info "SSL certificates restored successfully"
            return 0
        else
            log_error "Failed to restore SSL certificates"
            return 1
        fi
    else
        log_warn "SSL backup file not found, skipping"
        return 1
    fi
}

# Start services
start_services() {
    log_step "Starting all services..."
    
    if docker compose -f "$COMPOSE_FILE" up -d; then
        log_info "Services started successfully"
        
        # Wait for services to be healthy
        log_info "Waiting for services to be healthy..."
        sleep 10
        
        # Check service status
        docker compose -f "$COMPOSE_FILE" ps
        
        return 0
    else
        log_error "Failed to start services"
        return 1
    fi
}

# Verify restore
verify_restore() {
    log_step "Verifying restore..."
    
    # Check if services are running
    if ! docker compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        log_error "Services are not running"
        return 1
    fi
    
    # Check PostgreSQL
    if [ "$RESTORE_POSTGRES" = true ]; then
        if docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U avian -d avian -c "SELECT 1;" > /dev/null 2>&1; then
            log_info "PostgreSQL is accessible"
        else
            log_error "PostgreSQL is not accessible"
            return 1
        fi
    fi
    
    # Check Redis
    if [ "$RESTORE_REDIS" = true ]; then
        if docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli --no-auth-warning -a "${REDIS_PASSWORD:-}" PING > /dev/null 2>&1; then
            log_info "Redis is accessible"
        else
            log_error "Redis is not accessible"
            return 1
        fi
    fi
    
    log_info "Restore verification completed"
    return 0
}

# Main restore function
main() {
    log_info "Starting AVIAN Platform restore..."
    log_info "Backup timestamp: $BACKUP_TIMESTAMP"
    echo
    
    # Pre-flight checks
    check_docker
    verify_backup_files
    confirm_restore
    
    # Stop services
    stop_services
    
    # Perform restores
    local success=0
    local failed=0
    
    [ "$RESTORE_POSTGRES" = true ] && { restore_postgres && ((success++)) || ((failed++)); }
    [ "$RESTORE_REDIS" = true ] && { restore_redis && ((success++)) || ((failed++)); }
    [ "$RESTORE_ENV" = true ] && { restore_env && ((success++)) || ((failed++)); }
    [ "$RESTORE_SSL" = true ] && { restore_ssl && ((success++)) || ((failed++)); }
    
    # Start services
    start_services
    
    # Verify restore
    verify_restore
    
    # Summary
    echo
    log_info "Restore completed!"
    log_info "Successful: $success"
    if [ $failed -gt 0 ]; then
        log_warn "Failed: $failed"
    fi
    
    echo
    log_info "Next steps:"
    echo "  1. Verify application is working: https://your-domain.com"
    echo "  2. Check logs: docker compose -f $COMPOSE_FILE logs -f"
    echo "  3. Test critical functionality"
    
    # Exit with error if any restore failed
    if [ $failed -gt 0 ]; then
        exit 1
    fi
}

# Run main function
main "$@"
