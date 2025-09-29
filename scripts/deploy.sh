#!/bin/bash

# pixelcoda Search Platform Deployment Script
# Usage: ./scripts/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying pixelcoda Search Platform to $ENVIRONMENT"

# Load environment-specific configuration
if [ -f "$PROJECT_DIR/.env.$ENVIRONMENT" ]; then
    echo "📄 Loading environment config: .env.$ENVIRONMENT"
    export $(cat "$PROJECT_DIR/.env.$ENVIRONMENT" | xargs)
elif [ -f "$PROJECT_DIR/.env" ]; then
    echo "📄 Loading default environment config: .env"
    export $(cat "$PROJECT_DIR/.env" | xargs)
else
    echo "⚠️  No environment file found. Using defaults."
fi

# Validate required environment variables
required_vars=("DATABASE_URL" "MEILI_URL" "API_WRITE_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Required environment variable $var is not set"
        exit 1
    fi
done

echo "✅ Environment validation passed"

# Build applications
echo "🔨 Building applications..."
cd "$PROJECT_DIR"

# Install dependencies
echo "📦 Installing dependencies..."
yarn install --frozen-lockfile

# Build packages first
echo "🏗️  Building packages..."
yarn -w packages/llm-adapter run build

# Build applications
echo "🏗️  Building API..."
yarn -w apps/api run build

echo "🏗️  Building Worker..."
yarn -w apps/worker run build

echo "🏗️  Building Widgets..."
yarn -w apps/widgets run build

# Run database migrations
echo "🗃️  Running database migrations..."
node scripts/migrate.js

# Health check function
health_check() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    echo "🏥 Health checking $service..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo "✅ $service is healthy"
            return 0
        fi
        
        echo "⏳ Waiting for $service... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service health check failed after $max_attempts attempts"
    return 1
}

# Deploy with Docker Compose
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🐳 Deploying with Docker Compose (production)..."
    
    # Pull latest images
    docker-compose pull
    
    # Build and start services
    docker-compose up -d --build
    
    # Wait for services to be healthy
    sleep 10
    
    # Health checks
    health_check "API" "${API_BASE:-http://localhost:8787}/health"
    
    if [ -n "$MEILI_URL" ]; then
        health_check "Meilisearch" "$MEILI_URL/health"
    fi
    
    echo "🎉 Production deployment completed!"
    
elif [ "$ENVIRONMENT" = "staging" ]; then
    echo "🧪 Deploying to staging environment..."
    
    # Use staging compose file if it exists
    if [ -f "docker-compose.staging.yml" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
    else
        docker-compose up -d --build
    fi
    
    sleep 5
    health_check "API" "${API_BASE:-http://localhost:8787}/health"
    
    echo "🎉 Staging deployment completed!"
    
else
    echo "🏠 Starting development environment..."
    
    # Start infrastructure services
    docker-compose up -d postgres meilisearch redis
    
    # Wait for services
    sleep 5
    
    # Start API in development mode
    echo "🔧 Starting API in development mode..."
    yarn -w apps/api run dev &
    API_PID=$!
    
    # Wait for API to start
    sleep 3
    health_check "API" "http://localhost:8787/health"
    
    echo "🎉 Development environment ready!"
    echo "📝 API running at: http://localhost:8787"
    echo "📊 Meilisearch dashboard: http://localhost:7700"
    echo "🗃️  PostgreSQL: localhost:5432"
    
    # Keep script running in development
    if [ "$ENVIRONMENT" = "development" ]; then
        echo "💡 Press Ctrl+C to stop services"
        trap "kill $API_PID; docker-compose down" EXIT
        wait $API_PID
    fi
fi

# Post-deployment tasks
echo "🔧 Running post-deployment tasks..."

# Create default API keys if they don't exist
if [ "$ENVIRONMENT" = "production" ] || [ "$ENVIRONMENT" = "staging" ]; then
    echo "🔑 Setting up API keys..."
    
    # This would typically be done through the admin API
    # For now, keys are created during database initialization
    echo "✅ API keys configured"
fi

# Display deployment summary
echo ""
echo "📋 Deployment Summary"
echo "===================="
echo "Environment: $ENVIRONMENT"
echo "API URL: ${API_BASE:-http://localhost:8787}"
echo "Meilisearch: ${MEILI_URL:-http://localhost:7700}"
echo "Database: ${DATABASE_URL%%@*}@***"
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔒 Production Security Checklist:"
    echo "  - API keys are secure and rotated regularly"
    echo "  - HTTPS is enabled with valid certificates"
    echo "  - Database access is restricted"
    echo "  - Rate limiting is configured"
    echo "  - Monitoring and logging are active"
    echo ""
fi

echo "🎯 Next Steps:"
echo "  1. Test API endpoints: curl ${API_BASE:-http://localhost:8787}/health"
echo "  2. Index some content: yarn -w apps/worker run dev -- <url> <project>"
echo "  3. Try search: POST ${API_BASE:-http://localhost:8787}/v1/search/<project>"
echo "  4. Check admin panel: GET ${API_BASE:-http://localhost:8787}/v1/admin/health"
echo ""
echo "✨ pixelcoda Search Platform is ready!"
