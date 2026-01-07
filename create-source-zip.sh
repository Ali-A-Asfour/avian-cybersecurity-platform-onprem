#!/bin/bash

# Script to create a clean source code zip without build artifacts and dependencies
# This creates a zip file suitable for transferring to another repository

ZIP_NAME="avian-platform-source-$(date +%Y%m%d-%H%M%S).zip"

echo "Creating source code zip: $ZIP_NAME"
echo "Excluding: node_modules, .next, .swc, and other build artifacts..."

zip -r "$ZIP_NAME" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x ".swc/*" \
  -x "*.tsbuildinfo" \
  -x ".git/*" \
  -x ".env.local" \
  -x ".env.production" \
  -x "storage/*" \
  -x ".workflow-state/*" \
  -x "*.log" \
  -x ".DS_Store" \
  -x "*.zip"

echo ""
echo "✅ Created: $ZIP_NAME"
echo ""
echo "File size:"
du -h "$ZIP_NAME"
echo ""
echo "Contents preview:"
unzip -l "$ZIP_NAME" | head -30
echo ""
echo "To extract: unzip $ZIP_NAME"
echo "After extraction, run: npm install"
