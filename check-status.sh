#!/bin/bash

echo "🔍 Checking Container Status"
echo "============================"
echo ""

echo -n "Enter your server password: "
read -s PASSWORD
echo ""

./quick-status-check.exp "$PASSWORD"