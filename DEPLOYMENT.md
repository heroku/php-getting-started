# Pixelcoda Search - Deployment Guide

## 🚀 Die bessere TYPO3-Suche als T3AS

Diese Lösung bietet **Headless + Classic Modi**, **bessere Relevanz**, **Transparenz**, **DSGVO-Compliance** und **Developer Experience** als T3AS.

## ✅ Implementierte Features

### 🔍 **JSON:API 1.0 Kompatibilität**
- `/v1/search` und `/v1/ask` Endpoints
- Vollständig kompatibel mit `nuxt-typo3`
- Parameter-Alias Support: `page[number]`/`page[size]`
- Meta-Informationen: `total`, `response_time_ms`, `search_methods`

### 🧠 **Hybrid Retrieval System**
- **BM25 + Vector ANN**: Beste semantische und lexikalische Suche
- **Reciprocal Rank Fusion (RRF)**: Intelligente Ergebnis-Fusion
- **Cross-Encoder Re-Ranking**: Top-50→Top-10 Optimierung
- Konfigurierbare Gewichtung via `HYBRID_ALPHA`

### 💬 **SSE-Streaming Chat-Widget**
- Real-time KI-Antworten mit Server-Sent Events
- Strikte Grounding mit verlinkten Quellen
- A11y-kompatibel (ARIA Live Regions, Focus Trap)
- FloatingPanel mit Keyboard Shortcuts (Ctrl+K)

### 📊 **Admin-Konsole & Telemetry**
- **No-Result-Queries**: Automatische Synonym-Vorschläge
- **CTR-Tracking**: Click-Through-Rate Analyse
- **A/B-Testing**: Re-Ranker Performance Tests
- **Rules-Engine**: Boost/Demote/Pin Regeln

### 🔒 **Privacy & DSGVO-Compliance**
- **PII-Redaction**: Automatische Anonymisierung (E-Mail, Telefon, etc.)
- **LLM-Adapter Switch**: OpenAI/Azure/Ollama/Local
- **HMAC-Webhooks**: Sichere TYPO3-Integration
- **Audit-Logging**: Vollständige Nachverfolgbarkeit

### 🎨 **Dual-Mode TYPO3 Integration**
- **Classic Mode**: Extbase/Fluid Templates
- **Headless Mode**: JSON:API für nuxt-typo3
- **DataHandler-Hook**: Automatische Indexierung
- **Webhook-Integration**: Real-time Updates

## 🛠 Installation & Setup

### 1. **Environment Konfiguration**

```bash
# Kopiere Beispiel-Konfiguration
cp env.ai.example .env

# Konfiguriere deine Umgebung
vim .env
```

**Wichtige Einstellungen:**
```env
# Database (PostgreSQL + pgvector)
DATABASE_URL=postgresql://user:pass@localhost:5432/pixelcoda_search

# Search Engine
MEILI_URL=http://localhost:7700
MEILI_KEY=your_master_key

# Hybrid Search
ENABLE_VECTOR_SEARCH=true
HYBRID_ALPHA=0.5  # 0=nur BM25, 1=nur Vector
RRF_K=60
ENABLE_RERANKING=true

# LLM Provider (wähle einen)
OPENAI_API_KEY=sk-...          # Cloud
# OLLAMA_BASE_URL=http://localhost:11434  # Local/DSGVO
# AZURE_OPENAI_API_KEY=...     # Enterprise

# Privacy & Security
ENABLE_PII_REDACTION=true
CORS_ALLOWLIST=https://your-typo3-site.com
WEBHOOK_SECRET=your-secure-secret
```

### 2. **Datenbank Setup**

```bash
# PostgreSQL + pgvector installieren
docker run -d \
  --name pixelcoda-db \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# Datenbank initialisieren
yarn install
yarn dev  # Startet API und führt Migrationen aus
```

### 3. **Search Engine Setup**

```bash
# MeiliSearch starten
docker run -d \
  --name meilisearch \
  -p 7700:7700 \
  -e MEILI_MASTER_KEY=your_master_key \
  getmeili/meilisearch:v1.5

# Optional: Ollama für lokale LLMs (DSGVO-konform)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1
ollama pull nomic-embed-text
```

### 4. **TYPO3 Extension Installation**

```bash
# Extension installieren
composer require pixelcoda/pixelcoda-search

# Extension aktivieren
./vendor/bin/typo3 extension:activate pixelcoda_search

# Konfiguration
# In Extension Configuration:
API_URL=http://localhost:8787
API_KEY=your_api_key
PROJECT_ID=typo3-main
```

### 5. **Widget Integration**

#### **Headless Mode (nuxt-typo3)**
```vue
<template>
  <div>
    <!-- Inline Search -->
    <PixelcodaSearchBox
      :api-base="$config.pixelcodaApiBase"
      project="typo3-main"
      :api-key="$config.pixelcodaApiKey"
      @results="handleResults"
    />
    
    <!-- Floating Panel (Ctrl+K) -->
    <FloatingPanel
      :api-base="$config.pixelcodaApiBase"
      project="typo3-main"
      :api-key="$config.pixelcodaApiKey"
      mode="both"
      position="bottom-right"
      :enable-keyboard-shortcut="true"
    />
    
    <!-- Chat Widget mit SSE -->
    <ChatWidget
      :api-base="$config.pixelcodaApiBase"
      project="typo3-main"
      :api-key="$config.pixelcodaApiKey"
      :enable-streaming="true"
      @citation-click="handleCitationClick"
    />
  </div>
</template>

<script setup>
import { 
  PixelcodaSearchBox, 
  FloatingPanel, 
  ChatWidget 
} from '@pixelcoda/search-widgets'

const handleResults = (results) => {
  // Verarbeite Suchergebnisse
  console.log(`${results.meta.pagination.total} Ergebnisse gefunden`)
}

const handleCitationClick = (citation, position) => {
  // Tracking für Analytics
  console.log(`Citation clicked: ${citation.title}`)
}
</script>
```

#### **Classic Mode (Fluid Templates)**
```html
<!-- In TYPO3 Template -->
<f:section name="Main">
  <!-- Search Form Plugin -->
  <div class="search-container">
    <f:cObject typoscriptObjectPath="lib.pixelcodaSearch" />
  </div>
  
  <!-- Optional: Floating Search -->
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      new PixelcodaFloatingPanel({
        apiBase: '{settings.apiBase}',
        project: '{settings.projectId}',
        apiKey: '{settings.apiKey}',
        mode: 'both'
      });
    });
  </script>
</f:section>
```

## 📈 Performance & Monitoring

### **Telemetry Dashboard**
- **URL**: `/v1/admin/telemetry/typo3-main`
- **Metriken**: Queries, CTR, Response Time, No-Result Rate
- **A/B Tests**: Re-Ranker Performance Vergleiche

### **Admin-Funktionen**
```bash
# Synonym-Mining aus No-Result-Queries
curl -X GET "http://localhost:8787/v1/admin/synonym-suggestions/typo3-main" \
  -H "Authorization: Bearer $API_KEY"

# Boost-Regel erstellen
curl -X POST "http://localhost:8787/v1/admin/boost-rules/typo3-main" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query_pattern": "typo3",
    "boost_factor": 1.5,
    "active": true
  }'
```

## 🔧 Konfiguration & Tuning

### **Hybrid Search Optimierung**
```env
# Gewichtung zwischen BM25 und Vector
HYBRID_ALPHA=0.5    # Balanced
# HYBRID_ALPHA=0.3  # Mehr BM25 (exakte Begriffe)
# HYBRID_ALPHA=0.7  # Mehr Vector (semantisch)

# Reciprocal Rank Fusion
RRF_K=60           # Standard-Wert
HYBRID_MAX_CANDIDATES=50  # Vor Fusion
HYBRID_FINAL_COUNT=20     # Nach Fusion

# Re-Ranking
ENABLE_RERANKING=true     # Top-50→Top-10
```

### **LLM Provider Wechsel**
```env
# Für maximale Privacy: Ollama (lokal)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Für Enterprise: Azure OpenAI
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4

# Für Development: OpenAI
OPENAI_API_KEY=sk-your-key
```

## 🎯 Akzeptanzkriterien - Status

### ✅ **JSON:API 1.0 Kompatibilität**
- [x] `/v1/search` mit `page[number]`/`page[size]`
- [x] `/v1/ask` mit `type:"answer"` und `included` Quellen
- [x] Meta-Informationen: `total`, `links.self/next/prev`

### ✅ **Hybrid Retrieval**
- [x] BM25 + Vector ANN parallel
- [x] Reciprocal Rank Fusion (RRF)
- [x] Cross-Encoder Re-Ranking (Top-50→Top-10)
- [x] Konfigurierbare Gewichtung

### ✅ **Widgets & UX**
- [x] InlineSearch mit A11y (ARIA Live)
- [x] ChatWidget mit SSE-Streaming
- [x] FloatingPanel mit Focus Trap + ESC
- [x] CSS-Variablen + i18n (de/en)

### ✅ **TYPO3 Integration**
- [x] Classic FE-Plugin (SearchController + Fluid)
- [x] Headless JSON:API Controller
- [x] DataHandler-Hook → HMAC Webhook
- [x] Dual-Mode Support

### ✅ **Admin & Analytics**
- [x] Telemetry Dashboard (CTR, No-Result, Top Queries)
- [x] Synonym-Mining aus Telemetry
- [x] Rules-Engine (Boost/Demote/Pin)
- [x] A/B Testing für Re-Ranker

### ✅ **Privacy & Security**
- [x] LLM Provider Switch (OpenAI/Azure/Ollama)
- [x] PII-Redaction pre-LLM
- [x] HMAC-Webhooks + CORS-Allowlist
- [x] Audit-Logs

## 🚀 Deployment

### **Development**
```bash
yarn dev  # Startet API auf :8787
```

### **Production**
```bash
# Build
yarn build

# Deploy (Heroku/Railway/Vercel)
git push heroku main

# Docker
docker build -t pixelcoda-search .
docker run -p 8787:8787 pixelcoda-search
```

### **TYPO3 Setup**
1. Extension aktivieren: `pixelcoda_search`
2. TypoScript Template einbinden
3. Plugin auf Seite einfügen
4. API-Konfiguration in Extension Settings

## 📊 Erwartete Verbesserungen

- **CTR**: +20-30% durch bessere Relevanz
- **No-Result Rate**: -50% durch Synonym-Mining
- **Response Time**: <200ms durch Hybrid Caching
- **User Engagement**: +40% durch Chat-Widget

---

## 🎉 Resultat

**Die beste TYPO3-Suche ist jetzt bereit!** 

- ✅ **Besser als T3AS**: Hybrid Retrieval + KI-Chat
- ✅ **Dual-Mode**: Classic + Headless Support  
- ✅ **DSGVO-konform**: Lokale LLMs + PII-Redaction
- ✅ **Developer-friendly**: JSON:API 1.0 + TypeScript
- ✅ **Production-ready**: Telemetry + A/B Testing

**Next Steps**: Indexierung starten, Widgets integrieren, Telemetry überwachen! 🚀
