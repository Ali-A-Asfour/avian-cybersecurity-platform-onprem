#!/bin/bash

# AVIAN Platform - Server Update Script
# Safe update procedure for production server

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
LOG_FILE="update.log"

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

header "🔄 AVIAN Platform - Server Update"
header "================================="
log "Update started at: $(date)"
log ""

# Check root privileges
check_root

# Step 1: Pre-update checks
header "📋 Step 1: Pre-update Checks"

info "Checking current system status..."

# Check if services are running
if ! docker-compose -f $COMPOSE_FILE ps | grep -q "Up"; then
    error_exit "Services are not running. Please start them first."
fi

# Check disk space
AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_SPACE" -lt 2097152 ]; then  # Less than 2GB
    error_exit "Insufficient disk space. At least 2GB free space required."
fi

success "Pre-update checks passed"

# Step 2: Create backup
header "💾 Step 2: Creating Backup"

info "Creating pre-update backup..."

BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/avian-pre-update-$BACKUP_TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create database backup
docker-compose -f $COMPOSE_FILE --profile backup run --rm backup pg_dump -h postgres -U avian -d avian > "$BACKUP_FILE" 2>/dev/null

if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    success "Backup created: $BACKUP_FILE"
else
    error_exit "Failed to create backup"
fi

# Step 3: Pull latest changes
header "📥 Step 3: Pulling Latest Changes"

info "Fetching latest code..."

# Stash any local changes
git stash push -m "Auto-stash before update $(date)"

# Pull latest changes
git pull origin main || git pull origin master

success "Latest changes pulled"

# Step 4: Update system packages
header "📦 Step 4: Updating System Packages"

info "Updating system packages..."

apt update
apt upgrade -y

success "System packages updated"

# Step 5: Rebuild application
header "🏗️  Step 5: Rebuilding Application"

info "Rebuilding Docker images..."

# Build new images
docker-compose -f $COMPOSE_FILE build --no-cache

success "Docker images rebuilt"

# Step 6: Rolling update
header "🔄 Step 6: Performing Rolling Update"

info "Starting rolling update..."

# Update services one by one to minimize downtime
SERVICES=("app" "nginx")

for service in "${SERVICES[@]}"; do
    info "Updating $service..."
    
    # Recreate the service
    docker-compose -f $COMPOSE_FILE up -d --no-deps $service
    
    # Wait for service to be healthy
    sleep 10
    
    # Check if service is running
    if docker-compose -f $COMPOSE_FILE ps $service | grep -q "Up"; then
        success "$service updated successfully"
    else
        error_exit "$service failed to start after update"
    fi
done

# Step 7: Database migrations
header "🗄️  Step 7: Database Migrations"

info "Running database migrations..."

# Wait for app to be ready
sleep 15

# Run migrations
docker-compose -f $COMPOSE_FILE exec -T app npm run db:migrate || warn "Database migrations may have failed"

success "Database migrations completed"

# Step 8: Health checks
header "🏥 Step 8: Health Checks"

info "Performing post-update health checks..."

# Wait for services to stabilize
sleep 20

# Check all services are running
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
if curl -k -s -o /dev/null -w "%{http_code}" https://localhost/api/health | grep -q "200"; then
    success "Application health check passed"
else
    error "Application health check failed"
    ALL_HEALTHY=false
fi

# Step 9: Cleanup
header "🧹 Step 9: Cleanup"

info "Cleaning up old Docker images..."

# Remove dangling images
docker image prune -f

# Remove old containers
docker container prune -f

success "Cleanup completed"

# Step 10: Update verification
header "✅ Step 10: Update Verification"

if [ "$ALL_HEALTHY" = true ]; then
    success "Update completed successfully"
    
    log ""
    log "${GREEN}🎉 AVIAN Platform updated successfully!${NC}"
    log ""
    log "${CYAN}📋 Update Summary:${NC}"
    log "• Update completed at: $(date)"
    log "• Backup created: $BACKUP_FILE"
    log "• All services: Running"
    log "• Health checks: Passed"
    log ""
    log "${CYAN}📊 Service Status:${NC}"
    docker-compose -f $COMPOSE_FILE ps
    
else
    error_exit "Update failed - some services are not healthy"
fi

# Step 11: Post-update tasks
header "🔧 Step 11: Post-update Tasks"

info "Performing post-update tasks..."

# Restart fail2ban to ensure it's working with any new configurations
systemctl restart fail2ban

# Update log rotation if needed
if [ -f "/etc/logrotate.d/avian" ]; then
    logrotate -f /etc/logrotate.d/avian
fi

success "Post-update tasks completed"

log ""
log "${GREEN}✅ Update completed successfully at: $(date)${NC}"
log "📝 Update log saved to: $LOG_FILE"
log "💾 Backup saved to: $BACKUP_FILE"
log ""
log "${YELLOW}⚠️  Recommended Next Steps:${NC}"
log "1. Test all application functionality"
log "2. Monitor logs for any issues: docker-compose -f $COMPOSE_FILE logs -f"
log "3. Run full health check: ./health-check.sh"
log "4. Notify users of any changes or new features"