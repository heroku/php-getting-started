#!/bin/bash

echo "🚀 Installing pixelcoda Search Extension for TYPO3 12..."

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Step 1: Clear all caches
echo "1. Clearing caches..."
ddev typo3 cache:flush

# Step 2: Ensure extension is in the correct location
echo "2. Checking extension location..."
if [ ! -d "public/typo3conf/ext/pixelcoda_search" ]; then
    echo "❌ Extension not found in public/typo3conf/ext/pixelcoda_search"
    exit 1
fi

# Step 3: Update composer autoload
echo "3. Updating Composer autoload..."
ddev composer dump-autoload

# Step 4: Create/Update PackageStates.php manually
echo "4. Updating PackageStates.php..."
cat > public/typo3conf/PackageStates.php << 'EOF'
<?php
# PackageStates.php

return [
    'packages' => [
        'core' => ['packagePath' => 'typo3/cms-core/'],
        'scheduler' => ['packagePath' => 'typo3/cms-scheduler/'],
        'extbase' => ['packagePath' => 'typo3/cms-extbase/'],
        'fluid' => ['packagePath' => 'typo3/cms-fluid/'],
        'frontend' => ['packagePath' => 'typo3/cms-frontend/'],
        'fluid_styled_content' => ['packagePath' => 'typo3/cms-fluid-styled-content/'],
        'install' => ['packagePath' => 'typo3/cms-install/'],
        'backend' => ['packagePath' => 'typo3/cms-backend/'],
        'dashboard' => ['packagePath' => 'typo3/cms-dashboard/'],
        'filelist' => ['packagePath' => 'typo3/cms-filelist/'],
        'lowlevel' => ['packagePath' => 'typo3/cms-lowlevel/'],
        'form' => ['packagePath' => 'typo3/cms-form/'],
        'reports' => ['packagePath' => 'typo3/cms-reports/'],
        'redirects' => ['packagePath' => 'typo3/cms-redirects/'],
        'seo' => ['packagePath' => 'typo3/cms-seo/'],
        'setup' => ['packagePath' => 'typo3/cms-setup/'],
        'rte_ckeditor' => ['packagePath' => 'typo3/cms-rte-ckeditor/'],
        'extensionmanager' => ['packagePath' => 'typo3/cms-extensionmanager/'],
        'felogin' => ['packagePath' => 'typo3/cms-felogin/'],
        'info' => ['packagePath' => 'typo3/cms-info/'],
        'sys_note' => ['packagePath' => 'typo3/cms-sys-note/'],
        't3editor' => ['packagePath' => 'typo3/cms-t3editor/'],
        'tstemplate' => ['packagePath' => 'typo3/cms-tstemplate/'],
        'viewpage' => ['packagePath' => 'typo3/cms-viewpage/'],
        'news' => ['packagePath' => 'georgringer/news/'],
        'headless' => ['packagePath' => 'friendsoftypo3/headless/'],
        'pixelcoda_search' => ['packagePath' => 'typo3conf/ext/pixelcoda_search/'],
    ],
    'version' => 5,
];
EOF

# Step 5: Clear caches again
echo "5. Clearing caches again..."
ddev typo3 cache:flush

# Step 6: Run extension setup
echo "6. Running extension setup..."
ddev typo3 extension:setup

# Step 7: Import TypoScript template
echo "7. Setting up TypoScript..."
ddev typo3 database:import setup-typoscript.sql

# Step 8: Clear final caches
echo "8. Final cache clear..."
ddev typo3 cache:flush

echo ""
echo "✅ Installation completed!"
echo ""
echo "📋 Next steps:"
echo "1. Login to TYPO3 Backend: http://pixelcoda-typo3-dev.ddev.site:8080/typo3"
echo "2. Go to 'Template' module"
echo "3. Select your root page"
echo "4. Include static template: 'pixelcoda Search'"
echo "5. Add the plugin to a page via 'Web > Page' module"
echo ""
echo "🔧 Extension status:"
ddev typo3 extension:list | grep -E "(Extension Key|pixelcoda)"
