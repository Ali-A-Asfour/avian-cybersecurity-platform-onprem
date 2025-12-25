#!/bin/bash

# AVIAN Platform Local Testing Script
echo "🧪 Testing AVIAN Platform locally..."

# Load nvm and use correct Node version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install and use the correct Node version if needed
if ! nvm use > /dev/null 2>&1; then
    echo "📦 Installing Node.js LTS..."
    nvm install --lts
    nvm use
fi

echo "📋 Using Node.js $(node --version)"

# Start the development server in background
echo "🚀 Starting development server..."
npm run dev > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 10

# Function to test endpoint
test_endpoint() {
    local url=$1
    local name=$2
    local expected=$3
    
    response=$(curl -s "$url" 2>/dev/null)
    if echo "$response" | grep -q "$expected"; then
        echo "✅ $name: PASSED"
        return 0
    else
        echo "❌ $name: FAILED"
        echo "   Response: $response"
        return 1
    fi
}

# Test endpoints
echo "🔍 Testing endpoints..."

test_endpoint "http://localhost:3000/api/health/live" "Health check" "alive"
test_endpoint "http://localhost:3000" "Main page" "AVIAN"
test_endpoint "http://localhost:3000/login" "Login page" "login"

echo ""
echo "🎯 Local testing complete!"
echo "📱 Open your browser to: http://localhost:3000"
echo "📋 Server log: tail -f server.log"
echo "🛑 To stop the server: kill $SERVER_PID"
echo ""

# Keep server running
echo "Press Ctrl+C to stop the server..."
wait $SERVER_PID
