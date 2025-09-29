#!/bin/bash

echo "🔄 Restoring pixelcoda_search Extension..."
echo "========================================="

# Restore extension
mv public/typo3conf/ext/pixelcoda_search_backup public/typo3conf/ext/pixelcoda_search

# Clear caches
ddev typo3 cache:flush

# Regenerate autoload
ddev composer dump-autoload

echo "✅ Extension restored!"
echo ""
echo "🎯 Next steps:"
echo "1. Go to TYPO3 Backend: http://pixelcoda-typo3-dev.ddev.site:8080/typo3"
echo "2. Admin Tools > Extensions"
echo "3. Activate pixelcoda_search extension"
echo "4. Add plugin to pages"
