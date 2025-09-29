#!/bin/bash

# TYPO3 Complete Mode Switcher
# =============================
# Switches between Headless and Standard mode

echo "🔄 TYPO3 Complete Mode Switcher"
echo "================================"
echo ""

# Check current mode
CURRENT_MODE=$(grep "renderingMode:" config/sites/main/config.yaml | awk '{print $2}')
echo "Current mode: $CURRENT_MODE"
echo ""

echo "Select new mode:"
echo "1) Headless (JSON output)"
echo "2) Standard (HTML output)"
echo ""
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        NEW_MODE="headless"
        echo ""
        echo "🚀 Switching to HEADLESS mode..."
        
        # Update site config
        sed -i.bak "s/renderingMode: .*/renderingMode: headless/" config/sites/main/config.yaml
        
        # Activate headless extension
        cp config/system/PackageStates.php.headless config/system/PackageStates.php
        
        echo "✅ Headless extension activated"
        ;;
    2)
        NEW_MODE="standard"
        echo ""
        echo "📄 Switching to STANDARD mode..."
        
        # Update site config
        sed -i.bak "s/renderingMode: .*/renderingMode: standard/" config/sites/main/config.yaml
        
        # Deactivate headless extension
        cp config/system/PackageStates.php.standard config/system/PackageStates.php
        
        echo "✅ Headless extension deactivated"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Clear all caches
echo ""
echo "🧹 Clearing all caches..."
rm -rf var/cache/*
rm -rf var/log/*
ddev exec typo3 cache:flush 2>/dev/null || true

echo ""
echo "✨ Successfully switched to $NEW_MODE mode!"
echo ""

if [ "$NEW_MODE" == "headless" ]; then
    echo "📌 Headless Mode Active:"
    echo "   - JSON API: https://pixelcoda-typo3-dev.ddev.site/"
    echo "   - All pages return JSON"
    echo "   - Connect your React/Vue/Next.js frontend"
else
    echo "📌 Standard Mode Active:"
    echo "   - HTML output: https://pixelcoda-typo3-dev.ddev.site/"
    echo "   - Traditional TYPO3 with Fluid templates"
    echo "   - SEO-friendly HTML pages"
fi

echo ""
echo "🔄 Please reload your browser to see the changes!"
echo ""
