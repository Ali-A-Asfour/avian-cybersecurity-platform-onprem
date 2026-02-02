#!/bin/bash

# Check Server Database Structure for Tickets Table
echo "🔍 Checking server database structure..."

echo "=== TICKETS TABLE STRUCTURE ==="
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "\d tickets"

echo ""
echo "=== SAMPLE TICKETS DATA ==="
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assigned_to, assignee FROM tickets LIMIT 3;" 2>/dev/null || \
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assigned_to FROM tickets LIMIT 3;" 2>/dev/null || \
sudo docker exec avian-postgres-prod psql -U avian -d avian -c "SELECT id, title, status, assignee FROM tickets LIMIT 3;"