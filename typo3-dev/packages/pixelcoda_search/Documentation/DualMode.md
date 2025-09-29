# Pixelcoda Search - Dual Mode Support

## Übersicht

Das Pixelcoda Search Plugin unterstützt zwei Rendering-Modi:

1. **Headless Mode** - JSON-Output für moderne JavaScript-Frontends
2. **Standard Mode** - Traditionelles TYPO3 mit Fluid Templates

## Konfiguration

### Mode auswählen

Die Mode-Auswahl erfolgt über TypoScript Constants:

```typoscript
# In deinem Site Package oder Template Record
plugin.tx_pixelcodasearch_search.settings.mode = headless
# oder
plugin.tx_pixelcodasearch_search.settings.mode = standard
```

### Im TYPO3 Backend

1. Gehe zu **Template** Modul
2. Wähle deine Root-Seite
3. Öffne **Constant Editor**
4. Navigiere zu **Plugin > Pixelcoda Search**
5. Wähle **Plugin Mode**: 
   - `headless` für JSON-Output
   - `standard` für Fluid Templates

## Headless Mode

### Features
- JSON-Output kompatibel mit TYPO3 Headless Extension
- Strukturierte Daten für React/Vue/Next.js
- Keine HTML-Ausgabe

### JSON-Struktur
```json
{
  "id": 123,
  "type": "pixelcodasearch_search",
  "content": {
    "pluginType": "pixelcodasearch_search",
    "searchConfig": {
      "mode": "headless",
      "placeholder": "Website durchsuchen...",
      "collections": "pages,news",
      "enableSuggestions": 1,
      "enableAsk": 1
    },
    "endpoints": {
      "search": "/api/search",
      "ask": "/api/ask",
      "suggest": "/api/suggest"
    },
    "ui": {
      "showSuggestions": 1,
      "showAsk": 1,
      "template": "Default"
    }
  }
}
```

### Frontend-Integration
```javascript
// React/Vue Component
fetch('https://your-site.com/?type=834&id=1')
  .then(res => res.json())
  .then(data => {
    // Nutze data.content.searchConfig für die Konfiguration
    const searchWidget = new SearchWidget(data.content.searchConfig);
  });
```

## Standard Mode

### Features
- Vollständige HTML-Ausgabe mit Fluid Templates
- Integrierte Styles und JavaScript
- Keine zusätzliche Frontend-Entwicklung nötig

### Template-Anpassung

Templates befinden sich in:
```
EXT:pixelcoda_search/Resources/Private/Templates/Search/
```

Du kannst sie in deinem Site Package überschreiben:
```
EXT:site_package/Resources/Private/Extensions/pixelcoda_search/Templates/
```

### Styling

Das Standard-Template enthält bereits Basis-Styles. Du kannst diese überschreiben:

```css
/* In deinem Site Package CSS */
.pixelcoda-search-container {
    /* Deine Anpassungen */
}

.search-wrapper {
    /* Deine Anpassungen */
}
```

## Automatische Erkennung

Das Plugin erkennt automatisch den Headless-Modus wenn:
- Der Query-Parameter `?type=834` gesetzt ist (Headless JSON Type)
- Das Request-Attribut `headless` gesetzt ist
- Die Konstante `plugin.tx_pixelcodasearch_search.settings.mode = headless` ist

## Migration zwischen Modi

### Von Standard zu Headless
1. Setze `mode = headless` in den Constants
2. Implementiere die Frontend-Komponente (React/Vue)
3. Teste den JSON-Output

### Von Headless zu Standard
1. Setze `mode = standard` in den Constants
2. Passe ggf. die Fluid Templates an
3. Füge Custom CSS hinzu

## Troubleshooting

### Plugin zeigt keine Ausgabe
- Prüfe ob der richtige Mode gesetzt ist
- Leere den TYPO3 Cache
- Prüfe die TypoScript-Konfiguration

### JSON-Output funktioniert nicht
- Stelle sicher, dass die Headless Extension installiert ist
- Prüfe ob `?type=834` korrekt konfiguriert ist
- Überprüfe die ext_typoscript_setup.typoscript

### Fluid Templates werden nicht geladen
- Prüfe die Template-Pfade in den Constants
- Stelle sicher, dass die Template-Dateien existieren
- Überprüfe die Dateirechte

## Best Practices

1. **Entwicklung**: Nutze Standard Mode für schnelles Prototyping
2. **Production**: Nutze Headless Mode für moderne SPAs
3. **Hybrid**: Du kannst beide Modi auf verschiedenen Seiten nutzen
4. **Testing**: Teste beide Modi während der Entwicklung
