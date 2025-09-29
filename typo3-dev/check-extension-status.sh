#!/bin/bash

echo "🔍 pixelcoda Search Extension - Status Check"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "public/index.php" ]; then
    echo "❌ Error: Please run this script from the TYPO3 root directory"
    exit 1
fi

echo "📁 Extension Files Check:"
echo "-------------------------"

# Check if extension directory exists
if [ -d "public/typo3conf/ext/pixelcoda_search" ]; then
    echo "✅ Extension directory found: public/typo3conf/ext/pixelcoda_search"
    
    # Check essential files
    if [ -f "public/typo3conf/ext/pixelcoda_search/ext_emconf.php" ]; then
        echo "✅ ext_emconf.php found"
    else
        echo "❌ ext_emconf.php missing"
    fi
    
    if [ -f "public/typo3conf/ext/pixelcoda_search/ext_localconf.php" ]; then
        echo "✅ ext_localconf.php found"
    else
        echo "❌ ext_localconf.php missing"
    fi
    
    if [ -f "public/typo3conf/ext/pixelcoda_search/ext_tables.php" ]; then
        echo "✅ ext_tables.php found"
    else
        echo "❌ ext_tables.php missing"
    fi
    
    if [ -d "public/typo3conf/ext/pixelcoda_search/Classes" ]; then
        echo "✅ Classes directory found"
    else
        echo "❌ Classes directory missing"
    fi
else
    echo "❌ Extension directory not found"
fi

echo ""
echo "📦 PackageStates.php Check:"
echo "---------------------------"

if [ -f "public/typo3conf/PackageStates.php" ]; then
    echo "✅ PackageStates.php exists"
    
    if grep -q "pixelcoda_search" public/typo3conf/PackageStates.php; then
        echo "✅ pixelcoda_search found in PackageStates.php"
    else
        echo "❌ pixelcoda_search NOT found in PackageStates.php"
    fi
else
    echo "❌ PackageStates.php missing"
fi

echo ""
echo "🔧 TYPO3 Extension Status:"
echo "--------------------------"

# Check if extension is active via CLI
echo "Active extensions:"
ddev typo3 extension:list 2>/dev/null | grep -E "(Extension Key|pixelcoda|----)" || echo "❌ Unable to get extension list"

echo ""
echo "🌐 API Connection Check:"
echo "------------------------"

# Check if API is running
if curl -s http://localhost:8787/health >/dev/null 2>&1; then
    echo "✅ pixelcoda Search API is running on http://localhost:8787"
else
    echo "❌ pixelcoda Search API is not accessible on http://localhost:8787"
fi

echo ""
echo "💡 Next Steps:"
echo "-------------"
echo "1. Open TYPO3 Backend: http://pixelcoda-typo3-dev.ddev.site:8080/typo3"
echo "2. Login with: admin / admin"
echo "3. Go to Admin Tools > Extensions"
echo "4. Look for 'pixelcoda_search' and activate it"
echo "5. Go to Web > Template and include the static TypoScript"
echo "6. Add the plugin to a page via Web > Page"
echo ""
echo "📚 For detailed instructions, see: PIXELCODA_SEARCH_INSTALLATION.md"
