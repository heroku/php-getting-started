#!/bin/bash

echo "🔧 TYPO3 Database Fix - be_sessions Table Error"
echo "============================================="
echo ""

# Check if we're in the right directory
if [ ! -f "public/index.php" ]; then
    echo "❌ Error: Please run this script from the TYPO3 root directory"
    exit 1
fi

echo "🚀 Step 1: Restarting DDEV..."
ddev restart

echo ""
echo "🗄️ Step 2: Resetting Database..."
ddev mysql -e "DROP DATABASE IF EXISTS db; CREATE DATABASE db;" 2>/dev/null

echo ""
echo "🧹 Step 3: Cleaning Cache and Temp Files..."
rm -rf var/cache/* var/log/* public/typo3temp/* 2>/dev/null
rm -f public/typo3conf/PackageStates.php 2>/dev/null

echo ""
echo "📦 Step 4: Updating Composer..."
ddev composer install --no-dev

echo ""
echo "✅ Database Reset Complete!"
echo ""
echo "🎯 Next Steps:"
echo "=============="
echo ""
echo "1. Open TYPO3 Install Tool:"
echo "   👉 http://pixelcoda-typo3-dev.ddev.site:8080/typo3/install.php"
echo ""
echo "2. Configure Database Connection:"
echo "   - Host: db"
echo "   - Username: db"
echo "   - Password: db" 
echo "   - Database: db"
echo ""
echo "3. Create Database Schema:"
echo "   - Click 'Database Schema'"
echo "   - Click 'Create tables'"
echo "   - Execute all updates"
echo ""
echo "4. Create Admin User:"
echo "   - Username: admin"
echo "   - Password: admin"
echo ""
echo "5. After successful setup:"
echo "   👉 http://pixelcoda-typo3-dev.ddev.site:8080/typo3"
echo ""
echo "📚 For detailed instructions, see: TYPO3_DATABASE_FIX.md"
echo ""

# Test database connection
echo "🧪 Testing Database Connection..."
if ddev mysql -e "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    echo "   Try: ddev restart"
fi

echo ""
echo "🎉 Ready for Install Tool setup!"
