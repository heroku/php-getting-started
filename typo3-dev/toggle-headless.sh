#!/bin/bash

# TYPO3 Headless Extension Toggle Script
# =======================================

echo "🔄 TYPO3 Headless Extension Toggle"
echo "==================================="
echo ""

# Check current mode from config
CURRENT_MODE=$(grep "renderingMode:" config/sites/main/config.yaml | awk '{print $2}')
echo "Current mode in config: $CURRENT_MODE"
echo ""

if [ "$CURRENT_MODE" == "headless" ]; then
    echo "📦 Activating Headless Extension..."
    
    # Activate headless extension
    ddev exec typo3 extension:activate headless
    
    echo "✅ Headless Extension activated"
    echo "   JSON output enabled"
    
elif [ "$CURRENT_MODE" == "standard" ]; then
    echo "📦 Deactivating Headless Extension..."
    
    # Deactivate headless extension
    ddev exec typo3 extension:deactivate headless
    
    echo "✅ Headless Extension deactivated"
    echo "   Standard HTML output enabled"
    
else
    echo "❌ Unknown mode: $CURRENT_MODE"
    exit 1
fi

# Clear all caches
echo ""
echo "🧹 Clearing all caches..."
rm -rf var/cache/*
ddev exec typo3 cache:flush

echo ""
echo "✅ Done! Please reload your browser."
echo ""
