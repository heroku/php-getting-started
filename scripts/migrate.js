#!/usr/bin/env node

/**
 * Database Migration Runner for pixelcoda Search
 * Runs database migrations and initializes the schema
 */

import {
    Pool
} from 'pg';
import {
    readFileSync
} from 'fs';
import {
    fileURLToPath
} from 'url';
import {
    dirname,
    join
} from 'path';

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ DATABASE_URL environment variable is required');
        process.exit(1);
    }

    console.log('🚀 Starting database migrations...');

    const pool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: false
        } : false
    });

    try {
        // Test connection
        console.log('📡 Testing database connection...');
        const client = await pool.connect();
        console.log('✅ Database connection successful');
        client.release();

        // Read and execute init script
        console.log('📜 Reading migration script...');
        const initScript = readFileSync(join(__dirname, 'init-db.sql'), 'utf8');

        console.log('⚡ Executing migrations...');
        await pool.query(initScript);

        console.log('✅ Database migrations completed successfully');

        // Verify tables exist
        console.log('🔍 Verifying table creation...');
        const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

        const tables = tablesResult.rows.map(row => row.table_name);
        console.log('📋 Created tables:', tables.join(', '));

        // Verify pgvector extension
        const extensionsResult = await pool.query(`
      SELECT extname 
      FROM pg_extension 
      WHERE extname = 'vector'
    `);

        if (extensionsResult.rows.length > 0) {
            console.log('✅ pgvector extension is installed');
        } else {
            console.warn('⚠️  pgvector extension not found - vector search will not work');
        }

        // Check API keys
        const apiKeysResult = await pool.query('SELECT COUNT(*) as count FROM api_keys');
        console.log(`🔑 API keys in database: ${apiKeysResult.rows[0].count}`);

        console.log('🎉 Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migrations if called directly
if (
    import.meta.url === `file://${process.argv[1]}`) {
    runMigrations().catch(error => {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    });
}

export {
    runMigrations
};