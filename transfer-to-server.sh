#!/bin/bash

# AVIAN Platform - File Transfer Script
# Transfer deployment files to fresh Ubuntu server

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
SERVER_USER="ubuntu"  # Change this to your server username
PROJECT_NAME="avian-cybersecurity-platform"

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
    log "Usage: $0 [OPTIONS]"
    log ""
    log "Options:"
    log "  -u, --user USERNAME    Server username (default: ubuntu)"
    log "  -i, --ip IP_ADDRESS    Server IP address (default: 192.168.1.115)"
    log "  -k, --key SSH_KEY      SSH private key file"
    log "  -h, --help            Show this help message"
    log ""
    log "Examples:"
    log "  $0                                    # Use defaults"
    log "  $0 -u myuser -i 192.168.1.100       # Custom user and IP"
    log "  $0 -k ~/.ssh/my_key                 # Use specific SSH key"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--user)
            SERVER_USER="$2"
            shift 2
            ;;
        -i|--ip)
            SERVER_IP="$2"
            shift 2
            ;;
        -k|--key)
            SSH_KEY="-i $2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

header "📁 AVIAN Platform - File Transfer to Server"
header "============================================="
log "Target server: ${SERVER_USER}@${SERVER_IP}"
log "Transfer started at: $(date)"
log ""

# Step 1: Check local files
header "📋 Step 1: Checking Local Files"

info "Verifying required files exist..."

REQUIRED_FILES=(
    "deploy-to-server.sh"
    "health-check.sh"
    "update-server.sh"
    "scripts/backup-server.sh"
    "scripts/restore-server.sh"
    "package.json"
    "Dockerfile"
    "src/"
    "database/"
    "nginx/"
)

MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -e "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    error "Missing required files:"
    for file in "${MISSING_FILES[@]}"; do
        log "  - $file"
    done
    exit 1
fi

success "All required files found"

# Step 2: Test SSH connection
header "🔐 Step 2: Testing SSH Connection"

info "Testing SSH connection to ${SERVER_USER}@${SERVER_IP}..."

if ssh $SSH_KEY -o ConnectTimeout=10 -o BatchMode=yes "${SERVER_USER}@${SERVER_IP}" exit 2>/dev/null; then
    success "SSH connection successful"
else
    error "Cannot connect to server via SSH"
    log ""
    log "${YELLOW}Troubleshooting SSH connection:${NC}"
    log "1. Verify server IP: $SERVER_IP"
    log "2. Verify username: $SERVER_USER"
    log "3. Check SSH key permissions: chmod 600 ~/.ssh/id_rsa"
    log "4. Test manual connection: ssh ${SERVER_USER}@${SERVER_IP}"
    exit 1
fi

# Step 3: Check server requirements
header "🖥️  Step 3: Checking Server Requirements"

info "Checking server specifications..."

# Get server info
SERVER_INFO=$(ssh $SSH_KEY "${SERVER_USER}@${SERVER_IP}" "
    echo 'OS:' \$(lsb_release -d | cut -f2)
    echo 'Kernel:' \$(uname -r)
    echo 'CPU Cores:' \$(nproc)
    echo 'Total RAM:' \$(free -h | awk '/^Mem:/ {print \$2}')
    echo 'Available Disk:' \$(df -h / | awk 'NR==2 {print \$4}')
    echo 'Architecture:' \$(uname -m)
")

log "$SERVER_INFO"

# Check if Ubuntu 24.04
if ssh $SSH_KEY "${SERVER_USER}@${SERVER_IP}" "lsb_release -r | grep -q '24.04'"; then
    success "Ubuntu 24.04 detected"
else
    warn "Server is not Ubuntu 24.04 - deployment may need adjustments"
fi

# Check resources
CPU_CORES=$(ssh $SSH_KEY "${SERVER_USER}@${SERVER_IP}" "nproc")
if [ "$CPU_CORES" -ge 8 ]; then
    success "CPU cores sufficient: $CPU_CORES"
else
    warn "CPU cores may be insufficient: $CPU_CORES (recommended: 8+)"
fi

# Step 4: Create project directory on server
header "📁 Step 4: Preparing Server Directory"

info "Creating project directory on server..."

ssh $SSH_KEY "${SERVER_USER}@${SERVER_IP}" "
    # Remove existing directory if it exists
    rm -rf $PROJECT_NAME
    
    # Create new directory
    mkdir -p $PROJECT_NAME
    
    # Create subdirectories
    mkdir -p $PROJECT_NAME/{scripts,nginx,database,src}
"

success "Server directory prepared"

# Step 5: Transfer files
header "📤 Step 5: Transferring Files"

info "Transferring project files to server..."

# Create list of files to transfer
TRANSFER_LIST=(
    "deploy-to-server.sh"
    "health-check.sh"
    "update-server.sh"
    "FRESH_SERVER_DEPLOYMENT.md"
    "DEPLOYMENT_PACKAGE_README.md"
    "QUICK_START_GUIDE.md"
    "SERVER_MANAGEMENT_GUIDE.md"
    "package.json"
    "package-lock.json"
    "Dockerfile"
    "docker-compose.prod.yml"
    "next.config.ts"
    "tailwind.config.js"
    "tsconfig.json"
    "drizzle.config.ts"
    ".env.production.template"
    ".gitignore"
    "README.md"
    "scripts/"
    "src/"
    "database/"
    "nginx/"
    "public/"
)

# Transfer files with progress
for item in "${TRANSFER_LIST[@]}"; do
    if [ -e "$item" ]; then
        info "Transferring: $item"
        if [ -d "$item" ]; then
            # Directory transfer
            scp $SSH_KEY -r "$item" "${SERVER_USER}@${SERVER_IP}:${PROJECT_NAME}/"
        else
            # File transfer
            scp $SSH_KEY "$item" "${SERVER_USER}@${SERVER_IP}:${PROJECT_NAME}/"
        fi
    else
        warn "Skipping missing item: $item"
    fi
done

success "File transfer completed"

# Step 6: Set permissions on server
header "🔐 Step 6: Setting File Permissions"

info "Setting executable permissions on scripts..."

ssh $SSH_KEY "${SERVER_USER}@${SERVER_IP}" "
    cd $PROJECT_NAME
    
    # Make scripts executable
    chmod +x *.sh
    chmod +x scripts/*.sh
    
    # Set proper ownership
    sudo chown -R \$USER:\$USER .
    
    # Verify permissions
    ls -la *.sh
"

success "File permissions set"

# Step 7: Verify transfer
header "✅ Step 7: Verifying Transfer"

info "Verifying all files transferred correctly..."

# Check critical files exist on server
CRITICAL_FILES=(
    "deploy-to-server.sh"
    "health-check.sh"
    "package.json"
    "Dockerfile"
    "src/app"
    "database/schemas"
)

for file in "${CRITICAL_FILES[@]}"; do
    if ssh $SSH_KEY "${SERVER_USER}@${SERVER_IP}" "[ -e $PROJECT_NAME/$file ]"; then
        success "$file transferred successfully"
    else
        error "$file not found on server"
        exit 1
    fi
done

# Step 8: Display next steps
header "🚀 Step 8: Ready for Deployment"

log ""
log "${GREEN}🎉 Files successfully transferred to server!${NC}"
log ""
log "${CYAN}📋 Next Steps:${NC}"
log "1. SSH into your server:"
log "   ${YELLOW}ssh ${SERVER_USER}@${SERVER_IP}${NC}"
log ""
log "2. Navigate to project directory:"
log "   ${YELLOW}cd ${PROJECT_NAME}${NC}"
log ""
log "3. Run the deployment script:"
log "   ${YELLOW}sudo ./deploy-to-server.sh${NC}"
log ""
log "4. Wait for deployment to complete (20-30 minutes)"
log ""
log "5. Access your platform:"
log "   ${YELLOW}https://${SERVER_IP}${NC}"
log ""
log "${CYAN}📊 Server Information:${NC}"
log "$SERVER_INFO"
log ""
log "${CYAN}🔧 Management Commands (after deployment):${NC}"
log "• Health check: ${YELLOW}sudo ./health-check.sh${NC}"
log "• View logs: ${YELLOW}sudo docker-compose -f docker-compose.server.yml logs -f${NC}"
log "• Create backup: ${YELLOW}sudo ./scripts/backup-server.sh${NC}"
log "• Update platform: ${YELLOW}sudo ./update-server.sh${NC}"
log ""
log "${GREEN}✅ Transfer completed at: $(date)${NC}"

# Create connection script for convenience
cat > connect-to-server.sh << EOF
#!/bin/bash
# Quick connect script
ssh $SSH_KEY ${SERVER_USER}@${SERVER_IP}
EOF

chmod +x connect-to-server.sh

log ""
log "${BLUE}💡 Tip: Use ${YELLOW}./connect-to-server.sh${NC} to quickly SSH into your server${NC}"