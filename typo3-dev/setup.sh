#!/bin/bash

# TYPO3 Development Environment Setup Script
# Sets up complete DDEV environment with pixelcoda Search plugin

set -e

echo "🚀 Setting up TYPO3 Development Environment for pixelcoda Search"

# Check if DDEV is installed
if ! command -v ddev &> /dev/null; then
    echo "❌ DDEV is not installed. Please install DDEV first:"
    echo "   https://ddev.readthedocs.io/en/stable/#installation"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Navigate to TYPO3 dev directory
cd "$(dirname "$0")"

echo "📁 Working directory: $(pwd)"

# Start DDEV project
echo "🐳 Starting DDEV project..."
ddev start

# Install Composer dependencies
echo "📦 Installing Composer dependencies..."
ddev composer install

# Check if TYPO3 is already installed
if [ ! -f "public/index.php" ]; then
    echo "🏗️  Setting up TYPO3..."
    
    # Create basic TYPO3 structure
    ddev exec vendor/bin/typo3 install:setup \
        --no-interaction \
        --database-user-name=db \
        --database-user-password=db \
        --database-host-name=db \
        --database-port=3306 \
        --database-name=db \
        --admin-user-name=admin \
        --admin-password=admin \
        --site-name="pixelcoda TYPO3 Development"
        
    echo "✅ TYPO3 installation completed"
else
    echo "✅ TYPO3 already installed"
fi

# Activate required extensions
echo "🔌 Activating extensions..."
ddev exec vendor/bin/typo3 extension:activate scheduler
ddev exec vendor/bin/typo3 extension:activate headless
ddev exec vendor/bin/typo3 extension:activate news
ddev exec vendor/bin/typo3 extension:activate pixelcoda_search

# Flush caches
echo "🧹 Flushing caches..."
ddev exec vendor/bin/typo3 cache:flush

# Create demo content
echo "📝 Creating demo content..."
ddev exec vendor/bin/typo3 site:create \
    --site-name="pixelcoda Demo Site" \
    --base-url="/" \
    --language="German" \
    --locale="de_DE.UTF-8" \
    --iso-code="de" \
    --hreflang="de-DE" \
    --direction="ltr" \
    --typo3-language="default" \
    --flag="de" \
    --navigation-title="Deutsch" \
    demo-site || echo "Site might already exist"

# Import demo pages and content
cat << 'EOF' | ddev exec vendor/bin/typo3 database:import
-- Demo content for pixelcoda Search testing

-- Create root page
INSERT INTO pages (uid, pid, title, slug, doktype, hidden, starttime, endtime, sorting, crdate, tstamp, cruser_id) VALUES 
(1, 0, 'Home', '/', 1, 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(2, 1, 'Über uns', '/ueber-uns', 1, 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(3, 1, 'Produkte', '/produkte', 1, 0, 0, 0, 512, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(4, 1, 'News', '/news', 1, 0, 0, 0, 768, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(5, 1, 'Kontakt', '/kontakt', 1, 0, 0, 0, 1024, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(6, 1, 'Suche', '/suche', 1, 0, 0, 0, 1280, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1);

-- Create content elements
INSERT INTO tt_content (uid, pid, CType, header, bodytext, hidden, starttime, endtime, sorting, crdate, tstamp, cruser_id) VALUES
(1, 1, 'textmedia', 'Willkommen bei pixelcoda', 'Dies ist eine Demo-Installation von TYPO3 mit dem pixelcoda Search Plugin. Testen Sie die Suchfunktion mit verschiedenen Begriffen.', 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(2, 2, 'textmedia', 'Über pixelcoda', 'pixelcoda ist ein innovatives Unternehmen, das KI-gestützte Suchlösungen für TYPO3 entwickelt. Unsere Plattform kombiniert klassische Keyword-Suche mit modernster Vektorsuche und AI-powered Antworten.', 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(3, 3, 'textmedia', 'Unsere Produkte', 'Entdecken Sie unsere innovativen Suchlösungen: Headless Search API, TYPO3 Integration, React Widgets und KI-gestützte Antworten. Alle Produkte sind vollständig barrierefrei und mehrsprachig.', 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(4, 6, 'pixelcodasearch_search', 'pixelcoda Suche', '', 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1);

-- Update content element with FlexForm (search plugin configuration)
UPDATE tt_content SET pi_flexform = '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<T3FlexForms>
    <data>
        <sheet index="sDEF">
            <language index="lDEF">
                <field index="settings.mode">
                    <value index="vDEF">classic</value>
                </field>
                <field index="settings.template">
                    <value index="vDEF">Default</value>
                </field>
                <field index="settings.collections">
                    <value index="vDEF">pages,news</value>
                </field>
                <field index="settings.resultsPerPage">
                    <value index="vDEF">10</value>
                </field>
                <field index="settings.enableSuggestions">
                    <value index="vDEF">1</value>
                </field>
                <field index="settings.enableAsk">
                    <value index="vDEF">1</value>
                </field>
            </language>
        </sheet>
    </data>
</T3FlexForms>' WHERE uid = 4;
EOF

echo "✅ Demo content created"

# Create sample news entries (if news extension is available)
echo "📰 Creating sample news..."
ddev exec vendor/bin/typo3 database:import << 'EOF' || echo "News creation skipped (extension might not be active)"
-- Sample news entries
INSERT INTO tx_news_domain_model_news (uid, pid, title, teaser, bodytext, datetime, crdate, tstamp, cruser_id, hidden, deleted) VALUES
(1, 4, 'pixelcoda Search v2.0 veröffentlicht', 'Die neue Version bringt KI-gestützte Antworten und verbesserte Performance.', 'Mit der neuen Version 2.0 von pixelcoda Search führen wir revolutionäre KI-Features ein. Die Plattform unterstützt jetzt RAG (Retrieval-Augmented Generation) für präzise Antworten basierend auf Ihrem Content.', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1, 0, 0),
(2, 4, 'TYPO3 Headless Integration', 'Nahtlose Integration mit TYPO3-Headless und nuxt-typo3.', 'Unsere Suchplattform ist jetzt vollständig kompatibel mit TYPO3-Headless und nuxt-typo3. JSON:API 1.0 konforme Responses ermöglichen die direkte Nutzung in modernen Frontend-Frameworks.', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1, 0, 0),
(3, 4, 'Barrierefreie Suche', 'BITV 2.0 konforme Suchfunktionen für alle Nutzer.', 'Accessibility ist ein Kernfeature unserer Plattform. Alle Suchkomponenten sind BITV 2.0 konform und bieten optimale Nutzererfahrung für Menschen mit Behinderungen.', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1, 0, 0);
EOF

# Flush caches again
ddev exec vendor/bin/typo3 cache:flush

# Show setup summary
echo ""
echo "🎉 TYPO3 Development Environment Setup Complete!"
echo ""
echo "📋 Access Information:"
echo "  Frontend: https://pixelcoda-typo3-dev.ddev.site"
echo "  Backend:  https://pixelcoda-typo3-dev.ddev.site/typo3"
echo "  Login:    admin / admin"
echo ""
echo "🔗 API Endpoints:"
echo "  Health:   http://localhost:8787/health"
echo "  Search:   POST http://localhost:8787/v1/search/typo3-dev"
echo "  Ask:      POST http://localhost:8787/v1/ask/typo3-dev"
echo ""
echo "🧪 Test Pages:"
echo "  Search:   https://pixelcoda-typo3-dev.ddev.site/suche"
echo "  News:     https://pixelcoda-typo3-dev.ddev.site/news"
echo ""
echo "⚡ Next Steps:"
echo "  1. Start pixelcoda API: docker-compose up -d && yarn -w apps/api run dev"
echo "  2. Index content: ddev exec vendor/bin/typo3 pixelcoda:search:index"
echo "  3. Test search on: https://pixelcoda-typo3-dev.ddev.site/suche"
echo "  4. Check backend module: Tools → pixelcoda Search"
echo ""
echo "🎯 Happy Testing!"
