#!/bin/bash

# TYPO3 Rendering Mode Switcher
# ==============================

echo "🔄 TYPO3 Rendering Mode Switcher"
echo "================================="
echo ""

# Check current mode
CURRENT_MODE=$(grep "renderingMode:" config/sites/main/config.yaml | awk '{print $2}')
echo "Current mode: $CURRENT_MODE"
echo ""

# Ask for new mode
echo "Select rendering mode:"
echo "1) Headless (JSON output for React/Vue/Next.js)"
echo "2) Standard (Traditional TYPO3 with Fluid)"
echo ""
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        NEW_MODE="headless"
        echo "Switching to Headless mode..."
        ;;
    2)
        NEW_MODE="standard"
        echo "Switching to Standard mode..."
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Update config file
sed -i.bak "s/renderingMode: .*/renderingMode: $NEW_MODE/" config/sites/main/config.yaml

# Clear caches
echo "Clearing TYPO3 caches..."
rm -rf var/cache/*
rm -rf public/typo3temp/var/cache/*

# DDEV specific cache clear
if command -v ddev &> /dev/null; then
    ddev exec typo3 cache:flush
fi

echo ""
echo "✅ Successfully switched to $NEW_MODE mode!"
echo ""
echo "Configuration updated in: config/sites/main/config.yaml"
echo ""

if [ "$NEW_MODE" == "headless" ]; then
    echo "📌 Headless Mode Active:"
    echo "   - JSON output enabled"
    echo "   - Access via: https://pixelcoda-typo3-dev.ddev.site/?type=834"
    echo "   - Or normal pages will return JSON"
    echo "   - Connect your React/Vue/Next.js frontend"
else
    echo "📌 Standard Mode Active:"
    echo "   - Fluid templates enabled"
    echo "   - Access via: https://pixelcoda-typo3-dev.ddev.site/"
    echo "   - Traditional TYPO3 rendering"
fi

echo ""
echo "🔄 Remember to restart your frontend application if in Headless mode!"
echo ""
