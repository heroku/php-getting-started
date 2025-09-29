# 🚀 Pixelcoda Search Platform - Schnellstart

Die Pixelcoda Search Platform ist eine moderne, API-basierte Suchplattform mit KI-Unterstützung für TYPO3 und andere CMS-Systeme.

## 🎯 Schnellstart (5 Minuten)

### 1. Repository klonen
```bash
git clone git@github.com:CasianBlanaru/typo3-search.git
cd typo3-search
```

### 2. Abhängigkeiten installieren
```bash
yarn install
```

### 3. Services starten
```bash
# Datenbank-Services starten
docker-compose up -d postgres meilisearch redis

# API starten
yarn workspace @pixelcoda/api dev
```

### 4. Demo-Seite öffnen
```bash
open demo/index.html
```

Die API läuft nun unter: **http://localhost:8787**

## 📝 TYPO3 Integration (Optional)

### TYPO3 Entwicklungsumgebung starten:
```bash
cd typo3-dev
ddev start
# Öffne: http://pixelcoda-typo3-dev.ddev.site
```

### Plugin aktivieren:
1. TYPO3 Backend öffnen (admin/admin)
2. Admin Tools → Extensions
3. "pixelcoda_search" aktivieren
4. Content-Element "Pixelcoda Search" zu einer Seite hinzufügen

## 🔧 API-Endpunkte

- **Health Check**: `GET http://localhost:8787/health`
- **Suche**: `POST http://localhost:8787/v1/search/{project}`
- **Vorschläge**: `POST http://localhost:8787/v1/suggest/{project}`
- **KI-Antworten**: `POST http://localhost:8787/v1/ask/{project}`

## 📊 Beispiel-Anfragen

### Suche:
```bash
curl -X POST http://localhost:8787/v1/search/demo \
  -H "Content-Type: application/json" \
  -d '{"q": "TYPO3", "limit": 10}'
```

### KI-Antwort:
```bash
curl -X POST http://localhost:8787/v1/ask/demo \
  -H "Content-Type: application/json" \
  -d '{"q": "Was ist Pixelcoda Search?"}'
```

## 📂 Projektstruktur

```
pixelcoda-headless-search-starter/
├── apps/
│   ├── api/            # Such-API (Hono.js)
│   ├── worker/         # Background Jobs
│   ├── widgets/        # React Widgets
│   └── typo3-connector/# TYPO3 Extension
├── typo3-dev/
│   └── packages/
│       └── pixelcoda_search/  # TYPO3 Plugin
├── demo/
│   └── index.html      # Demo-Seite
└── docker-compose.yml  # Services
```

## 🐛 Fehlerbehebung

### API startet nicht?
```bash
# Services prüfen
docker-compose ps

# Logs anzeigen
docker-compose logs -f api

# Neustart
docker-compose restart
```

### Port bereits belegt?
```bash
# Port 8787 freigeben
lsof -i :8787 | grep LISTEN
kill -9 <PID>
```

## 🚀 Nächste Schritte

1. **Umgebungsvariablen konfigurieren**: `.env`-Datei aus `env.example` erstellen
2. **Inhalte indexieren**: Dokumente über die API hinzufügen
3. **KI-Provider einrichten**: OpenAI/Ollama für intelligente Antworten
4. **Widgets integrieren**: React-Komponenten in Ihre Anwendung einbinden

## 📚 Weitere Ressourcen

- **Hauptdokumentation**: Siehe [README.md](README.md)
- **TYPO3 Integration**: Siehe [typo3-dev/README.md](typo3-dev/README.md)
- **Sicherheit**: Siehe [SECURITY.md](SECURITY.md)
- **GitHub**: https://github.com/CasianBlanaru/typo3-search
