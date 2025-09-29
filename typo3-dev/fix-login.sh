#!/bin/bash

# TYPO3 Login Fix Script

echo "🔧 Fixing TYPO3 Login Issues..."

# 1. Clear all caches
echo "📁 Clearing caches..."
rm -rf var/cache/*
rm -rf var/log/*

# 2. Reset admin password in database (if database is accessible)
echo "🔑 Trying to reset admin password..."

# Try different database connection methods
if command -v mysql &> /dev/null; then
    mysql -udb -pdb -hdb db < reset-admin-password.sql 2>/dev/null && echo "✅ Password reset via mysql" || echo "❌ mysql failed"
elif command -v docker &> /dev/null && docker ps | grep -q mysql; then
    docker exec -i $(docker ps | grep mysql | awk '{print $1}') mysql -udb -pdb db < reset-admin-password.sql 2>/dev/null && echo "✅ Password reset via docker" || echo "❌ docker mysql failed"
else
    echo "⚠️ Could not find database connection method"
fi

# 3. Create simple admin user creation script
echo "👤 Creating admin user setup script..."
cat > create-admin.php << 'EOF'
<?php
// Simple admin user creation for TYPO3
// Run this via: php create-admin.php

require_once 'vendor/autoload.php';

use TYPO3\CMS\Core\Core\Bootstrap;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Utility\GeneralUtility;

// Bootstrap TYPO3
Bootstrap::init();

try {
    $connection = GeneralUtility::makeInstance(ConnectionPool::class)->getConnectionForTable('be_users');
    
    // Check if admin user exists
    $existingUser = $connection->select(['uid'], 'be_users', ['username' => 'admin'])->fetchAssociative();
    
    if ($existingUser) {
        // Update existing admin user
        $connection->update(
            'be_users',
            [
                'password' => password_hash('admin', PASSWORD_ARGON2I),
                'tstamp' => time(),
                'disable' => 0
            ],
            ['username' => 'admin']
        );
        echo "✅ Admin user password updated to 'admin'\n";
    } else {
        // Create new admin user
        $connection->insert(
            'be_users',
            [
                'pid' => 0,
                'tstamp' => time(),
                'username' => 'admin',
                'password' => password_hash('admin', PASSWORD_ARGON2I),
                'admin' => 1,
                'disable' => 0,
                'crdate' => time(),
                'realName' => 'Administrator',
                'email' => 'admin@example.com'
            ]
        );
        echo "✅ Admin user created with password 'admin'\n";
    }
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}
EOF

echo "🚀 Setup complete!"
echo ""
echo "Manual steps:"
echo "1. Try logging in with admin/admin"
echo "2. If that fails, run: php create-admin.php"
echo "3. Check the TYPO3 backend at: http://localhost:8080/typo3"

