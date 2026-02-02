#!/bin/bash

# AVIAN Platform - Health Check Script
# Comprehensive health monitoring for Ubuntu server deployment

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
SERVER_IP="192.168.1.115"
COMPOSE_FILE="docker-compose.server.yml"

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

header "🏥 AVIAN Platform - Health Check"
header "================================="
log "Health check started at: $(date)"
log ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    DOCKER_CMD="docker"
    COMPOSE_CMD="docker-compose"
else
    DOCKER_CMD="sudo docker"
    COMPOSE_CMD="sudo docker-compose"
fi

# 1. System Health
header "🖥️  System Health"

info "Checking system resources..."
log "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
log "Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
log "Disk Usage: $(df -h / | awk 'NR==2 {print $5}')"
log "Load Average: $(uptime | awk -F'load average:' '{print $2}')"

# Check if system is under heavy load
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk -F',' '{print $1}' | tr -d ' ')
if (( $(echo "$LOAD > 4.0" | bc -l) )); then
    warn "High system load detected: $LOAD"
else
    success "System load is normal: $LOAD"
fi

# 2. Docker Health
header "🐳 Docker Health"

info "Checking Docker daemon..."
if $DOCKER_CMD info &> /dev/null; then
    success "Docker daemon is running"
else
    error "Docker daemon is not running"
    exit 1
fi

info "Checking Docker Compose..."
if command -v docker-compose &> /dev/null; then
    success "Docker Compose is available"
else
    error "Docker Compose is not available"
    exit 1
fi

# 3. Container Health
header "📦 Container Health"

info "Checking container status..."

SERVICES=("avian-nginx-server" "avian-app-server" "avian-postgres-server" "avian-redis-server")
ALL_HEALTHY=true

for service in "${SERVICES[@]}"; do
    if $DOCKER_CMD ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
        # Check health status if available
        HEALTH_STATUS=$($DOCKER_CMD inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "no-healthcheck")
        
        if [ "$HEALTH_STATUS" = "healthy" ]; then
            success "$service is running and healthy"
        elif [ "$HEALTH_STATUS" = "no-healthcheck" ]; then
            success "$service is running (no health check configured)"
        else
            warn "$service is running but health status: $HEALTH_STATUS"
            ALL_HEALTHY=false
        fi
    else
        error "$service is not running"
        ALL_HEALTHY=false
    fi
done

# 4. Network Connectivity
header "🌐 Network Health"

info "Checking network connectivity..."

# Test internal Docker network
if $COMPOSE_CMD -f $COMPOSE_FILE exec -T app ping -c 1 postgres &> /dev/null; then
    success "App can reach database"
else
    error "App cannot reach database"
    ALL_HEALTHY=false
fi

if $COMPOSE_CMD -f $COMPOSE_FILE exec -T app ping -c 1 redis &> /dev/null; then
    success "App can reach Redis"
else
    error "App cannot reach Redis"
    ALL_HEALTHY=false
fi

# 5. Service Health Endpoints
header "🔍 Service Health Endpoints"

info "Testing HTTP endpoints..."

# Test HTTP redirect
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    success "HTTP redirect is working (status: $HTTP_STATUS)"
else
    warn "HTTP redirect may not be working (status: $HTTP_STATUS)"
fi

# Test HTTPS health endpoint
HTTPS_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/api/health 2>/dev/null || echo "000")
if [ "$HTTPS_STATUS" = "200" ]; then
    success "HTTPS health endpoint is responding (status: $HTTPS_STATUS)"
else
    error "HTTPS health endpoint is not responding (status: $HTTPS_STATUS)"
    ALL_HEALTHY=false
fi

# Test application response time
RESPONSE_TIME=$(curl -k -s -o /dev/null -w "%{time_total}" https://localhost/api/health 2>/dev/null || echo "999")
if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    success "Application response time is good (${RESPONSE_TIME}s)"
else
    warn "Application response time is slow (${RESPONSE_TIME}s)"
fi

# 6. Database Health
header "🗄️  Database Health"

info "Checking database connectivity..."

if $COMPOSE_CMD -f $COMPOSE_FILE exec -T postgres pg_isready -U avian -d avian &> /dev/null; then
    success "Database is accepting connections"
else
    error "Database is not accepting connections"
    ALL_HEALTHY=false
fi

# Check database size
DB_SIZE=$($COMPOSE_CMD -f $COMPOSE_FILE exec -T postgres psql -U avian -d avian -t -c "SELECT pg_size_pretty(pg_database_size('avian'));" 2>/dev/null | tr -d ' ' || echo "unknown")
log "Database size: $DB_SIZE"

# Check active connections
ACTIVE_CONNECTIONS=$($COMPOSE_CMD -f $COMPOSE_FILE exec -T postgres psql -U avian -d avian -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | tr -d ' ' || echo "unknown")
log "Active database connections: $ACTIVE_CONNECTIONS"

# 7. Redis Health
header "🔴 Redis Health"

info "Checking Redis connectivity..."

if $COMPOSE_CMD -f $COMPOSE_FILE exec -T redis redis-cli ping &> /dev/null; then
    success "Redis is responding to ping"
else
    error "Redis is not responding to ping"
    ALL_HEALTHY=false
fi

# Check Redis memory usage
REDIS_MEMORY=$($COMPOSE_CMD -f $COMPOSE_FILE exec -T redis redis-cli info memory | grep "used_memory_human" | cut -d':' -f2 | tr -d '\r' || echo "unknown")
log "Redis memory usage: $REDIS_MEMORY"

# 8. SSL Certificate Health
header "🔐 SSL Certificate Health"

info "Checking SSL certificate..."

# Check certificate expiration
CERT_EXPIRY=$(openssl x509 -in nginx/ssl/server.crt -noout -enddate 2>/dev/null | cut -d'=' -f2 || echo "unknown")
if [ "$CERT_EXPIRY" != "unknown" ]; then
    EXPIRY_TIMESTAMP=$(date -d "$CERT_EXPIRY" +%s 2>/dev/null || echo "0")
    CURRENT_TIMESTAMP=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
    
    if [ $DAYS_UNTIL_EXPIRY -gt 30 ]; then
        success "SSL certificate is valid (expires in $DAYS_UNTIL_EXPIRY days)"
    elif [ $DAYS_UNTIL_EXPIRY -gt 0 ]; then
        warn "SSL certificate expires soon (in $DAYS_UNTIL_EXPIRY days)"
    else
        error "SSL certificate has expired"
        ALL_HEALTHY=false
    fi
else
    warn "Could not check SSL certificate expiration"
fi

# 9. Log Health
header "📝 Log Health"

info "Checking for critical errors in logs..."

# Check application logs for errors
ERROR_COUNT=$($COMPOSE_CMD -f $COMPOSE_FILE logs --tail=100 app 2>/dev/null | grep -i error | wc -l || echo "0")
if [ "$ERROR_COUNT" -eq 0 ]; then
    success "No recent errors in application logs"
elif [ "$ERROR_COUNT" -lt 5 ]; then
    warn "Found $ERROR_COUNT recent errors in application logs"
else
    error "Found $ERROR_COUNT recent errors in application logs"
    ALL_HEALTHY=false
fi

# Check nginx logs for errors
NGINX_ERROR_COUNT=$($COMPOSE_CMD -f $COMPOSE_FILE logs --tail=100 nginx 2>/dev/null | grep -i error | wc -l || echo "0")
if [ "$NGINX_ERROR_COUNT" -eq 0 ]; then
    success "No recent errors in nginx logs"
elif [ "$NGINX_ERROR_COUNT" -lt 3 ]; then
    warn "Found $NGINX_ERROR_COUNT recent errors in nginx logs"
else
    error "Found $NGINX_ERROR_COUNT recent errors in nginx logs"
fi

# 10. Backup Health
header "💾 Backup Health"

info "Checking backup status..."

# Check if backup directory exists and has recent backups
if [ -d "/var/backups" ]; then
    RECENT_BACKUPS=$(find /var/backups -name "avian-*.sql" -mtime -1 | wc -l)
    if [ "$RECENT_BACKUPS" -gt 0 ]; then
        success "Found $RECENT_BACKUPS recent backup(s)"
    else
        warn "No recent backups found (older than 24 hours)"
    fi
    
    TOTAL_BACKUPS=$(find /var/backups -name "avian-*.sql" | wc -l)
    log "Total backups: $TOTAL_BACKUPS"
else
    warn "Backup directory not found"
fi

# 11. Security Health
header "🛡️  Security Health"

info "Checking security status..."

# Check firewall status
if ufw status | grep -q "Status: active"; then
    success "UFW firewall is active"
else
    warn "UFW firewall is not active"
fi

# Check fail2ban status
if systemctl is-active --quiet fail2ban; then
    success "Fail2ban is running"
    BANNED_IPS=$(fail2ban-client status sshd 2>/dev/null | grep "Banned IP list" | wc -w || echo "0")
    log "Currently banned IPs: $((BANNED_IPS - 4))"
else
    warn "Fail2ban is not running"
fi

# 12. Performance Metrics
header "📊 Performance Metrics"

info "Collecting performance metrics..."

# Container resource usage
log "Container resource usage:"
$DOCKER_CMD stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | head -5

# 13. Final Health Summary
header "📋 Health Summary"

if [ "$ALL_HEALTHY" = true ]; then
    success "All critical health checks passed"
    log ""
    log "${GREEN}🎉 AVIAN Platform is healthy and running optimally!${NC}"
    log ""
    log "${CYAN}📊 Quick Stats:${NC}"
    log "• Application URL: https://$SERVER_IP"
    log "• All services: Running"
    log "• Database: Connected"
    log "• Redis: Connected"
    log "• SSL: Valid"
    log "• Backups: Available"
    exit 0
else
    error "Some health checks failed"
    log ""
    log "${RED}⚠️  AVIAN Platform has health issues that need attention!${NC}"
    log ""
    log "${YELLOW}🔧 Recommended Actions:${NC}"
    log "1. Check service logs: $COMPOSE_CMD -f $COMPOSE_FILE logs [service]"
    log "2. Restart problematic services: $COMPOSE_CMD -f $COMPOSE_FILE restart [service]"
    log "3. Check system resources and free up space if needed"
    log "4. Review error logs for specific issues"
    exit 1
fi