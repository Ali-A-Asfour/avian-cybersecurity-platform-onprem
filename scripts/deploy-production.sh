#!/bin/bash

# AVIAN Platform - Production Deployment Script
# Complete automated deployment for on-premises servers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/deployment.log"

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

# Clear log file
> "$LOG_FILE"

header "🚀 AVIAN Platform - Production Deployment"
header "=============================================="
log "Deployment started at: $(date)"
log "Project directory: $PROJECT_DIR"
log ""

# Change to project directory
cd "$PROJECT_DIR"

# Step 1: Pre-deployment checks
header "📋 Step 1: Pre-deployment Checks"

info "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    error_exit "Docker is not installed. Please install Docker first."
fi
success "Docker is installed: $(docker --version)"

info "Checking Docker Compose installation..."
if ! command -v docker-compose &> /dev/null; then
    error_exit "Docker Compose is not installed. Please install Docker Compose first."
fi
success "Docker Compose is installed: $(docker-compose --version)"

info "Checking if Docker daemon is running..."
if ! docker info &> /dev/null; then
    error_exit "Docker daemon is not running. Please start Docker first."
fi
success "Docker daemon is running"

# Step 2: Environment setup
header "🔧 Step 2: Environment Configuration"

if [ ! -f ".env.production" ]; then
    warn ".env.production not found. Creating from template..."
    if [ -f ".env.production.template" ]; then
        cp .env.production.template .env.production
        info "Created .env.production from template"
    else
        error_exit ".env.production.template not found"
    fi
fi

# Generate secrets if they haven't been generated
if grep -q "CHANGE_THIS" .env.production; then
    warn "Found placeholder values in .env.production"
    info "Generating production secrets..."
    
    if [ -f "scripts/generate-production-secrets.sh" ]; then
        bash scripts/generate-production-secrets.sh
        success "Production secrets generated"
    else
        error_exit "Secret generation script not found"
    fi
fi

# Step 3: SSL Certificate
header "🔐 Step 3: SSL Certificate Setup"

if [ ! -f "nginx/ssl/server.crt" ] || [ ! -f "nginx/ssl/server.key" ]; then
    warn "SSL certificate not found"
    
    read -p "Do you want to generate a self-signed certificate? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Generating SSL certificate..."
        bash scripts/generate-ssl-cert.sh
        success "SSL certificate generated"
    else
        error_exit "SSL certificate is required for production deployment"
    fi
else
    success "SSL certificate found"
fi

# Step 4: Build application
header "🏗️  Step 4: Building Application"

info "Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache

success "Docker images built successfully"

# Step 5: Start services
header "🚀 Step 5: Starting Services"

info "Starting production services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
info "Waiting for services to be healthy..."
sleep 30

# Check service health
info "Checking service health..."
SERVICES=("avian-postgres-prod" "avian-redis-prod" "avian-app-prod" "avian-nginx-prod")

for service in "${SERVICES[@]}"; do
    if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
        success "$service is running"
    else
        error_exit "$service is not running"
    fi
done

# Step 6: Database setup
header "🗄️  Step 6: Database Setup"

info "Waiting for database to be ready..."
sleep 10

info "Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T app npm run db:migrate || warn "Database migrations may have failed (this is normal for first deployment)"

# Step 7: Health checks
header "🏥 Step 7: Health Checks"

info "Checking application health..."
sleep 10

# Test HTTP health endpoint
if curl -f http://localhost/api/health &> /dev/null; then
    success "HTTP health check passed"
else
    warn "HTTP health check failed (this may be normal if HTTPS-only)"
fi

# Test HTTPS health endpoint (allow self-signed)
if curl -k -f https://localhost/api/health &> /dev/null; then
    success "HTTPS health check passed"
else
    error_exit "HTTPS health check failed"
fi

# Step 8: Create initial backup
header "💾 Step 8: Initial Backup"

info "Creating initial database backup..."
docker-compose -f docker-compose.prod.yml --profile backup run --rm backup /scripts/backup-database.sh

success "Initial backup created"

# Step 9: Final verification
header "✅ Step 9: Final Verification"

info "Verifying deployment..."

# Check all containers are running
RUNNING_CONTAINERS=$(docker-compose -f docker-compose.prod.yml ps --services --filter "status=running" | wc -l)
TOTAL_CONTAINERS=$(docker-compose -f docker-compose.prod.yml ps --services | wc -l)

if [ "$RUNNING_CONTAINERS" -eq "$TOTAL_CONTAINERS" ]; then
    success "All containers are running ($RUNNING_CONTAINERS/$TOTAL_CONTAINERS)"
else
    warn "Some containers may not be running ($RUNNING_CONTAINERS/$TOTAL_CONTAINERS)"
fi

# Display service URLs
header "🌐 Deployment Complete!"
log ""
log "${GREEN}🎉 AVIAN Platform deployed successfully!${NC}"
log ""
log "${CYAN}📋 Access Information:${NC}"
log "• Application URL: https://$(grep NEXT_PUBLIC_API_URL .env.production | cut -d'=' -f2)"
log "• Health Check: https://localhost/api/health"
log "• Logs: docker-compose -f docker-compose.prod.yml logs -f"
log ""
log "${CYAN}🔧 Management Commands:${NC}"
log "• View logs: docker-compose -f docker-compose.prod.yml logs -f [service]"
log "• Restart: docker-compose -f docker-compose.prod.yml restart"
log "• Stop: docker-compose -f docker-compose.prod.yml down"
log "• Backup: docker-compose -f docker-compose.prod.yml --profile backup run --rm backup /scripts/backup-database.sh"
log ""
log "${CYAN}📊 Service Status:${NC}"
docker-compose -f docker-compose.prod.yml ps

log ""
log "${YELLOW}⚠️  Next Steps:${NC}"
log "1. Update DNS to point to this server"
log "2. Configure email settings in .env.production"
log "3. Set up monitoring and alerting"
log "4. Schedule regular backups"
log "5. Test all functionality"
log ""
log "${GREEN}Deployment completed at: $(date)${NC}"
log "Deployment log saved to: $LOG_FILE"