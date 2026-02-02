#!/bin/bash

echo "🔧 Fixing Dashboard toFixed() JavaScript Errors"
echo "Issue: Cannot read properties of undefined (reading 'toFixed')"
echo "Solution: Adding null safety checks to all dashboard components"
echo ""

# Copy fixed dashboard components to server
echo "📁 Copying fixed dashboard components to server..."

# DeviceCoverageChart - main fix for division by zero
scp src/components/dashboard/tenant-admin/DeviceCoverageChart.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/dashboard/tenant-admin/

# ComplianceGauge - fix for undefined score values
scp src/components/dashboard/ComplianceGauge.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/dashboard/

# SLAMetrics - already had null safety, but ensuring consistency
scp src/components/dashboard/SLAMetrics.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/dashboard/

# DashboardGrid - fix for undefined nested properties
scp src/components/dashboard/DashboardGrid.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/dashboard/

# RoleBasedDashboard - fix for undefined tenant properties
scp src/components/dashboard/RoleBasedDashboard.tsx avian@192.168.1.116:/home/avian/avian-cybersecurity-platform-onprem/src/components/dashboard/

echo "✅ All dashboard components copied to server"
echo ""

# Rebuild and restart the application
echo "🔄 Rebuilding and restarting application..."
ssh avian@192.168.1.116 "
cd /home/avian/avian-cybersecurity-platform-onprem
echo '=== Stopping containers ==='
sudo docker-compose -f docker-compose.prod.yml down

echo '=== Rebuilding application with fixes ==='
sudo docker-compose -f docker-compose.prod.yml build --no-cache app

echo '=== Starting containers ==='
sudo docker-compose -f docker-compose.prod.yml up -d

echo '=== Waiting for services to start ==='
sleep 30

echo '=== Checking service status ==='
sudo docker-compose -f docker-compose.prod.yml ps
"

echo ""
echo "🧪 Testing dashboard after fixes..."
sleep 5

# Test the platform
if curl -k -s -I https://192.168.1.116 | grep -q "200\|302"; then
    echo "✅ AVIAN platform is accessible"
    
    # Test login
    echo "🔐 Testing login..."
    LOGIN_RESPONSE=$(curl -k -s -X POST "https://192.168.1.116/api/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"admin@avian.local","password":"admin123"}')
    
    if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
        echo "✅ Login working"
        
        # Extract token and test dashboard widgets
        TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty' 2>/dev/null)
        if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
            echo "🧪 Testing dashboard widgets API..."
            WIDGETS_RESPONSE=$(curl -k -s "https://192.168.1.116/api/dashboard/widgets" -H "Authorization: Bearer $TOKEN")
            
            if echo "$WIDGETS_RESPONSE" | grep -q '"success":true'; then
                echo "✅ Dashboard widgets API working"
            else
                echo "⚠️  Dashboard widgets API issue: $WIDGETS_RESPONSE"
            fi
        fi
    else
        echo "⚠️  Login issue: $LOGIN_RESPONSE"
    fi
else
    echo "❌ Platform not accessible yet - may need more time to start"
fi

echo ""
echo "🎯 Dashboard toFixed() Error Fixes Applied:"
echo "   ✅ DeviceCoverageChart: Safe division and null checks"
echo "   ✅ ComplianceGauge: Null safety for score values"
echo "   ✅ SLAMetrics: Consistent null safety"
echo "   ✅ DashboardGrid: Safe nested property access"
echo "   ✅ RoleBasedDashboard: Safe tenant property access"
echo ""
echo "🌐 Test the tenant dashboard at: https://192.168.1.116"
echo "🔑 Login: admin@avian.local / admin123"
echo ""
echo "Expected Result: No more 'Cannot read properties of undefined (reading 'toFixed')' errors"