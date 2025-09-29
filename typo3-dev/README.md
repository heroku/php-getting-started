# TYPO3 Development Environment for pixelcoda Search

This DDEV environment provides a complete TYPO3 installation for testing and developing the pixelcoda Search plugin.

## 🚀 Quick Start

### 1. Prerequisites
- [DDEV](https://ddev.readthedocs.io/en/stable/#installation) installed
- Docker Desktop running
- Git installed

### 2. Setup
```bash
# Navigate to TYPO3 dev directory
cd typo3-dev

# Start DDEV project
ddev start

# Install Composer dependencies
ddev composer install

# Run TYPO3 setup
ddev exec vendor/bin/typo3 install:setup \
  --no-interaction \
  --database-user-name=db \
  --database-user-password=db \
  --database-host-name=db \
  --database-port=3306 \
  --database-name=db \
  --admin-user-name=admin \
  --admin-password=admin \
  --site-name="pixelcoda TYPO3 Dev"

# Activate extension
ddev exec vendor/bin/typo3 extension:activate pixelcoda_search

# Flush caches
ddev exec vendor/bin/typo3 cache:flush
```

### 3. Start pixelcoda Search API
```bash
# In separate terminal
cd .. # Back to main directory
docker-compose up -d postgres meilisearch redis
yarn -w apps/api run dev
```

### 4. Access TYPO3
- **Frontend**: https://pixelcoda-typo3-dev.ddev.site
- **Backend**: https://pixelcoda-typo3-dev.ddev.site/typo3
- **Login**: admin / admin

## 🔧 Development

### Testing the Plugin

1. **Backend Module**:
   - Navigate to "Tools" → "pixelcoda Search" in TYPO3 Backend
   - Test API connection
   - Check indexing status

2. **Frontend Plugin**:
   - Create new page
   - Add "pixelcoda Search" content element
   - Configure plugin settings
   - View page in frontend

3. **Index Content**:
   ```bash
   # Index all TYPO3 content
   ddev exec vendor/bin/typo3 pixelcoda:search:index
   
   # Index specific table
   ddev exec vendor/bin/typo3 pixelcoda:search:index pages
   
   # Full reindex
   ddev exec vendor/bin/typo3 pixelcoda:search:reindex --confirm
   ```

### Testing Modes

#### Classic Mode (Fluid Templates)
1. Plugin Settings: Mode = "Classic"
2. Access frontend
3. Search form appears directly on page
4. Results rendered server-side

#### Headless Mode (JSON:API)
1. Plugin Settings: Mode = "Headless"  
2. Call API endpoint: `POST /v1/search/typo3-dev`
3. Receive JSON:API 1.0 response
4. Compatible with nuxt-typo3

### Webhook Integration Testing

1. **Edit page in backend**
2. **Save** → Webhook automatically triggered
3. **Check logs**:
   ```bash
   # TYPO3 logs
   ddev logs -f
   
   # API logs
   docker-compose logs -f api
   ```

## 📁 Directory Structure

```
typo3-dev/
├── .ddev/                          # DDEV configuration
│   └── config.yaml
├── packages/
│   └── pixelcoda_search/           # Our TYPO3 plugin
│       ├── Classes/                # PHP classes
│       │   ├── Controller/         # Extbase controllers
│       │   ├── Service/           # Services (API communication)
│       │   ├── Hook/              # DataHandler hooks
│       │   └── Command/           # CLI commands
│       ├── Configuration/         # TYPO3 configuration
│       │   ├── FlexForms/         # Plugin settings
│       │   ├── TypoScript/        # TS setup/constants
│       │   └── TsConfig/          # Page TSconfig
│       └── Resources/             # Frontend resources
│           ├── Private/           # Templates, Language
│           └── Public/            # CSS, JS, Icons
├── public/                        # TYPO3 web root
├── var/                          # TYPO3 var directory
└── composer.json                 # Dependencies
```

## 🎨 Template Variants

The plugin supports different template variants:

### Default Template
- Standard search form with results list
- Complete accessibility features
- Responsive design

### Minimal Template  
- Compact search box
- Reduced UI elements
- Suitable for sidebars

### Advanced Template
- Extended filter options
- Faceted search
- AI Ask integration

### Cards Template
- Card-based layout
- Visual highlighting
- Modern UI

## 🔧 Configuration

### Extension Configuration
```php
// LocalConfiguration.php
$GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search'] = [
    'api_url' => 'http://host.docker.internal:8787',
    'api_key' => 'pc_write_dev_key',
    'hmac_secret' => 'dev_hmac_secret_key',
    'project_id' => 'typo3-dev',
    'typo3_headless_url' => 'https://pixelcoda-typo3-dev.ddev.site/api',
    'enabled_tables' => ['pages', 'tt_content', 'tx_news_domain_model_news'],
    'default_mode' => 'classic',
    'enable_auto_index' => true,
    'debug_mode' => true
];
```

### TypoScript Configuration
```typoscript
plugin.tx_pixelcodasearch_search {
    settings {
        mode = classic
        resultsPerPage = 10
        enableSuggestions = 1
        enableAsk = 1
        collections = pages,news
        template = Default
    }
}
```

## 🧪 Testing

### Unit Tests
```bash
# PHP Unit Tests
ddev exec vendor/bin/phpunit packages/pixelcoda_search/Tests/

# Code Style
ddev exec vendor/bin/php-cs-fixer fix packages/pixelcoda_search/

# Static Analysis
ddev exec vendor/bin/phpstan analyse packages/pixelcoda_search/Classes/
```

### Functional Testing

1. **Search Function**:
   - Enter various search terms
   - Check result relevance
   - Test pagination

2. **AI Ask Feature**:
   - Ask natural language questions
   - Evaluate answer quality
   - Check source citations

3. **Accessibility**:
   - Test with screen reader
   - Check keyboard navigation
   - Validate ARIA labels

4. **Performance**:
   - Measure response times
   - Test with large datasets
   - Simulate concurrent users

## 🔒 Security

### Development Environment
- Default credentials for local development
- Debug mode enabled
- HTTPS via DDEV

### Production Preparation
```bash
# Generate secure API keys
PIXELCODA_API_KEY=$(openssl rand -hex 32)
PIXELCODA_HMAC_SECRET=$(openssl rand -hex 32)

# Configure in extension settings
# Disable debug mode
# Enforce HTTPS
```

## 📊 Monitoring

### TYPO3 Logs
```bash
# Show extension logs
ddev exec tail -f var/log/typo3_*.log

# Webhook activity
ddev exec grep "pixelcoda" var/log/typo3_*.log
```

### API Logs
```bash
# API container logs
docker-compose logs -f api

# Search metrics
curl -H "X-API-Key: pc_read_dev_key" \
     http://localhost:8787/v1/metrics/typo3-dev/queries
```

## 🆘 Troubleshooting

### Common Issues

1. **Plugin not visible**:
   ```bash
   ddev exec vendor/bin/typo3 extension:activate pixelcoda_search
   ddev exec vendor/bin/typo3 cache:flush
   ```

2. **API connection fails**:
   - API server running on port 8787?
   - `host.docker.internal` reachable?
   - API key configured correctly?

3. **No search results**:
   ```bash
   # Check indexing
   ddev exec vendor/bin/typo3 pixelcoda:search:index
   
   # API health check
   curl http://localhost:8787/health
   ```

4. **Webhooks not working**:
   - HMAC secret configured?
   - Check API logs for webhook reception
   - Check TYPO3 logs for hook execution

### Debug Commands

```bash
# Check TYPO3 configuration
ddev exec vendor/bin/typo3 configuration:show EXTENSIONS.pixelcoda_search

# Extension status
ddev exec vendor/bin/typo3 extension:list | grep pixelcoda

# Cache status
ddev exec vendor/bin/typo3 cache:listgroups
```

## 🤝 Contributing

1. Make changes in `packages/pixelcoda_search/`
2. Run tests: `ddev exec composer test`
3. Check code style: `ddev exec composer cs-fix`
4. Perform functional tests in frontend
5. Create pull request

---

**Happy Coding!** 🎉

Built with ❤️ by [pixelcoda](https://pixelcoda.com) for the TYPO3 community.