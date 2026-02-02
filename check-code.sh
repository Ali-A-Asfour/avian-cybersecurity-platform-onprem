#!/bin/bash

echo "🔍 Checking What Code is Actually Deployed"
echo "=========================================="
echo ""

echo -n "Enter your server password: "
read -s PASSWORD
echo ""

./check-deployed-code.exp "$PASSWORD"