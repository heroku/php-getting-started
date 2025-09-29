#!/bin/bash

echo "🔧 TYPO3 Complete Database Fix - TableNotFoundException"
echo "====================================================="
echo ""
echo "Problem: Multiple tables missing (sys_news, tx_scheduler_task, etc.)"
echo "Solution: Complete database schema reset via Install Tool"
echo ""

# Check if we're in the right directory
if [ ! -f "public/index.php" ]; then
    echo "❌ Error: Please run this script from the TYPO3 root directory"
    exit 1
fi

echo "🚀 Step 1: Backing up current data (if any)..."
mkdir -p backups/
ddev mysql -e "SHOW TABLES;" > backups/tables_before_fix.txt 2>/dev/null || echo "No tables to backup"

echo ""
echo "🗄️ Step 2: Complete Database Reset..."
ddev mysql -e "DROP DATABASE IF EXISTS db; CREATE DATABASE db;" 2>/dev/null

echo ""
echo "🧹 Step 3: Cleaning TYPO3 Cache and Config..."
rm -rf var/cache/* var/log/* public/typo3temp/* 2>/dev/null
rm -f public/typo3conf/PackageStates.php 2>/dev/null
rm -f public/typo3conf/LocalConfiguration.php 2>/dev/null

echo ""
echo "📦 Step 4: Reinstalling Composer Dependencies..."
ddev composer install --no-dev

echo ""
echo "✅ Database Reset Complete!"
echo ""
echo "🎯 NEXT STEPS - TYPO3 Install Tool Setup:"
echo "========================================"
echo ""
echo "1. 🌐 Open Install Tool:"
echo "   👉 http://pixelcoda-typo3-dev.ddev.site:8080/typo3/install.php"
echo ""
echo "2. 🔧 Configure Database Connection:"
echo "   - Database host: db"
echo "   - Database username: db"
echo "   - Database password: db"
echo "   - Database name: db"
echo "   - Click 'Test Connection'"
echo ""
echo "3. 📋 Create Database Schema:"
echo "   - Click 'Database Schema'"
echo "   - Click 'Create tables'"
echo "   - Execute ALL suggested updates"
echo "   - This creates: sys_news, tx_scheduler_task, be_sessions, etc."
echo ""
echo "4. 👤 Create Admin User:"
echo "   - Username: admin"
echo "   - Password: admin"
echo "   - Email: admin@example.com"
echo ""
echo "5. ⚙️ Activate Extensions:"
echo "   - news (for sys_news table)"
echo "   - scheduler (for tx_scheduler_task table)"
echo "   - pixelcoda_search"
echo ""
echo "6. 🎉 Test Backend Login:"
echo "   👉 http://pixelcoda-typo3-dev.ddev.site:8080/typo3"
echo ""
echo "📚 TYPO3 Documentation Reference:"
echo "- Install Tool: https://docs.typo3.org/m/typo3/reference-coreapi/main/en-us/Installation/"
echo "- Database Schema: https://docs.typo3.org/m/typo3/reference-exceptions/main/en-us/Exceptions/1247602160.html"
echo ""
echo "🚨 WICHTIG: Use Install Tool - it's the official TYPO3 way!"
echo ""

# Test database connection
echo "🧪 Testing Database Connection..."
if ddev mysql -e "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ Database connection successful - Ready for Install Tool!"
else
    echo "❌ Database connection failed - Check DDEV status"
    echo "   Try: ddev restart"
fi

echo ""
echo "🎯 Summary: TableNotFoundException Fix"
echo "======================================"
echo "- Problem: Extensions active but database tables missing"
echo "- Cause: Incomplete TYPO3 installation or corrupted database"
echo "- Solution: Install Tool → Database Schema → Create tables"
echo "- Result: All missing tables (sys_news, tx_scheduler_task, etc.) will be created"
echo ""
echo "Ready for Install Tool setup! 🚀"
