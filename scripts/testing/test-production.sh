#!/bin/bash

# AVIAN Platform Production Build Test
echo "🏗️ Testing production build..."

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use > /dev/null 2>&1

# Build for production
echo "📦 Building for production..."
if npm run build; then
    echo "✅ Production build: PASSED"
else
    echo "❌ Production build: FAILED"
    exit 1
fi

# Start production server
echo "🚀 Starting production server..."
npm run start > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for production server..."
sleep 10

# Test production server
echo "🔍 Testing production server..."
if curl -s http://localhost:3000/api/health/live | grep -q "ok"; then
    echo "✅ Production server: PASSED"
else
    echo "❌ Production server: FAILED"
fi

echo ""
echo "🎯 Production build test complete!"
echo "📱 Production server running at: http://localhost:3000"
echo "🛑 To stop: kill $SERVER_PID"
echo ""

# Keep server running for manual testing
wait $SERVER_PID
