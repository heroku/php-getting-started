# @pixelcoda/widgets

Accessible React components for pixelcoda Search Platform with BITV 2.0 compliance.

## 🚀 Features

- **Accessible Components**: BITV 2.0 compliant with ARIA roles, live regions, keyboard navigation
- **TypeScript Support**: Full type safety and IntelliSense
- **Customizable**: Flexible styling and configuration options
- **Real-time Suggestions**: Debounced autocomplete with keyboard navigation
- **Analytics Integration**: Built-in click tracking and metrics
- **Error Handling**: Graceful error states with user feedback

## 📦 Installation

```bash
yarn add @pixelcoda/widgets
```

## 🎯 Components

### SearchBox

```tsx
import { SearchBox } from '@pixelcoda/widgets';

function App() {
  const [results, setResults] = useState(null);
  
  return (
    <SearchBox
      apiBase="http://localhost:8787"
      project="demo"
      apiKey="pc_read_dev_key"
      placeholder="Search website..."
      enableSuggestions={true}
      autoFocus={true}
      collections={["pages", "news"]}
      onResults={setResults}
      onError={(error) => console.error(error)}
    />
  );
}
```

#### Props
- `apiBase` (string): API base URL
- `project` (string): Project identifier
- `apiKey` (string): Read API key
- `onResults?` (function): Callback for search results
- `onError?` (function): Error callback
- `placeholder?` (string): Input placeholder text
- `autoFocus?` (boolean): Auto-focus input on mount
- `enableSuggestions?` (boolean): Enable autocomplete suggestions
- `debounceMs?` (number): Suggestion debounce delay
- `collections?` (string[]): Limit search to collections
- `className?` (string): Additional CSS classes
- `disabled?` (boolean): Disable input

### AnswerPanel

```tsx
import { AnswerPanel } from '@pixelcoda/widgets';

function App() {
  return (
    <AnswerPanel
      apiBase="http://localhost:8787"
      project="demo"
      apiKey="pc_read_dev_key"
      query="How does the search work?"
      collections={["docs"]}
      maxPassages={6}
      temperature={0.7}
      showDebug={false}
      onCitationClick={(citation, position) => {
        console.log('Citation clicked:', citation);
      }}
    />
  );
}
```

#### Props
- `apiBase` (string): API base URL
- `project` (string): Project identifier
- `apiKey` (string): Read API key
- `query?` (string): Question to ask
- `answer?` (string): Pre-provided answer
- `citations?` (Citation[]): Pre-provided citations
- `isLoading?` (boolean): Loading state
- `error?` (string): Error message
- `onCitationClick?` (function): Citation click callback
- `showDebug?` (boolean): Show debug information
- `collections?` (string[]): Limit to collections
- `maxPassages?` (number): Max passages for RAG
- `temperature?` (number): AI temperature (0-2)

### PixelcodaSearchClient

```tsx
import { PixelcodaSearchClient } from '@pixelcoda/widgets';

const client = new PixelcodaSearchClient(
  'http://localhost:8787',
  'demo',
  'pc_read_dev_key',
  {
    timeout: 30000,
    retries: 3,
    userAgent: 'MyApp/1.0'
  }
);

// Search
const results = await client.search({
  q: 'search term',
  limit: 10,
  collections: ['pages']
});

// AI Answer
const answer = await client.ask({
  q: 'How does this work?',
  maxPassages: 6,
  includeDebug: true
});

// Suggestions
const suggestions = await client.suggest({
  q: 'sear',
  limit: 5
});

// Metrics
await client.logQuery('search term', 10, 150);
await client.logClick('search term', 'doc1', 0, '/page');
```

## 🎨 Styling

The components use CSS classes for styling. No CSS framework is required.

### CSS Classes

```css
/* SearchBox */
.pixelcoda-search-box { /* Main container */ }
.pixelcoda-search-form { /* Form element */ }
.pixelcoda-search-input-container { /* Input wrapper */ }
.pixelcoda-search-input { /* Search input */ }
.pixelcoda-search-button { /* Submit button */ }
.pixelcoda-search-suggestions { /* Suggestions dropdown */ }
.pixelcoda-search-suggestion { /* Individual suggestion */ }
.pixelcoda-search-suggestion.active { /* Active suggestion */ }
.pixelcoda-search-status { /* Status/results count */ }

/* AnswerPanel */
.pixelcoda-answer-panel { /* Main container */ }
.pixelcoda-answer-header { /* Header section */ }
.pixelcoda-answer-content { /* Content area */ }
.pixelcoda-answer-text { /* Answer text */ }
.pixelcoda-answer-loading { /* Loading state */ }
.pixelcoda-answer-error { /* Error state */ }
.pixelcoda-citations-section { /* Citations wrapper */ }
.pixelcoda-citations-list { /* Citations list */ }
.pixelcoda-citation-item { /* Individual citation */ }
.pixelcoda-citation-header { /* Citation header */ }
.pixelcoda-citation-snippet { /* Citation text */ }
.pixelcoda-debug-info { /* Debug information */ }
```

### Example Styling

```css
.pixelcoda-search-box {
  max-width: 600px;
  margin: 0 auto;
}

.pixelcoda-search-input {
  width: 100%;
  padding: 12px 48px 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
}

.pixelcoda-search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.pixelcoda-search-suggestions {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
}

.pixelcoda-citation-item {
  border-left: 3px solid #3b82f6;
  padding: 16px;
  margin: 8px 0;
  background: #f8fafc;
}
```

## ♿ Accessibility Features

### BITV 2.0 Compliance
- **Semantic HTML**: Proper roles and landmarks
- **ARIA Labels**: Descriptive labels for screen readers
- **Keyboard Navigation**: Full keyboard support
- **Live Regions**: Dynamic content announcements
- **Focus Management**: Logical tab order
- **Screen Reader Support**: Optimized for assistive technologies

### Keyboard Shortcuts
- **Enter**: Submit search / select suggestion
- **Arrow Keys**: Navigate suggestions
- **Escape**: Close suggestions / clear focus
- **Tab**: Navigate between elements

### Screen Reader Support
- Search form has `role="search"`
- Results announced via `aria-live="polite"`
- Suggestions list with `role="listbox"`
- Citations with proper heading structure
- Status updates in live regions

## 🌐 Internationalization

The components support internationalization through:
- Configurable text props
- Language detection from API responses
- RTL language support
- Locale-aware formatting

```tsx
<SearchBox
  placeholder="Search website..."
  // German
  placeholder="Website durchsuchen..."
  // French  
  placeholder="Rechercher sur le site..."
/>
```

## 🔧 Advanced Usage

### Custom Error Handling

```tsx
<SearchBox
  onError={(error) => {
    // Custom error handling
    if (error.message.includes('rate limit')) {
      showRateLimitWarning();
    } else {
      showGenericError(error.message);
    }
  }}
/>
```

### Result Processing

```tsx
<SearchBox
  onResults={(results) => {
    // Process JSON:API response
    const hits = results.data || [];
    const meta = results.meta || {};
    
    console.log(`Found ${meta.pagination?.total || 0} results`);
    
    // Transform for your UI
    const processedResults = hits.map(hit => ({
      id: hit.id,
      title: hit.attributes.title,
      url: hit.attributes.url,
      snippet: hit.attributes.summary || hit.attributes.content
    }));
    
    setSearchResults(processedResults);
  }}
/>
```

### Citation Handling

```tsx
<AnswerPanel
  onCitationClick={(citation, position) => {
    // Track citation clicks
    analytics.track('citation_click', {
      query: currentQuery,
      citation_id: citation.id,
      position: position,
      url: citation.url
    });
    
    // Open in new tab or navigate
    if (citation.url) {
      window.open(citation.url, '_blank');
    }
  }}
/>
```

## 📚 TypeScript Types

```typescript
import type {
  SearchParams,
  SearchResult,
  SearchHit,
  AskParams,
  AskResult,
  Citation,
  SuggestParams,
  SuggestResult,
  ClientOptions
} from '@pixelcoda/widgets';
```

## 🔗 Integration Examples

### Next.js
```tsx
'use client';
import { SearchBox, AnswerPanel } from '@pixelcoda/widgets';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  
  return (
    <div className="container mx-auto p-4">
      <SearchBox
        apiBase={process.env.NEXT_PUBLIC_API_BASE!}
        project={process.env.NEXT_PUBLIC_PROJECT!}
        apiKey={process.env.NEXT_PUBLIC_API_KEY!}
        onResults={setResults}
      />
      
      {query && (
        <AnswerPanel
          apiBase={process.env.NEXT_PUBLIC_API_BASE!}
          project={process.env.NEXT_PUBLIC_PROJECT!}
          apiKey={process.env.NEXT_PUBLIC_API_KEY!}
          query={query}
        />
      )}
    </div>
  );
}
```

### Nuxt.js (with nuxt-typo3)
```vue
<template>
  <div>
    <SearchBox
      :api-base="$config.public.pixelcodaApiBase"
      :project="$config.public.pixelcodaProject"
      :api-key="$config.public.pixelcodaApiKey"
      @results="handleResults"
    />
  </div>
</template>

<script setup>
const handleResults = (results) => {
  // Results are JSON:API compatible with nuxt-typo3
  navigateTo({
    path: '/search-results',
    query: { data: JSON.stringify(results) }
  });
};
</script>
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## 🆘 Support

For issues and questions:
- GitHub Issues: [Report bugs](https://github.com/CasianBlanaru/typo3-search/issues)
- Documentation: [Full API docs](https://github.com/CasianBlanaru/typo3-search/wiki)

---

Built with ❤️ by [pixelcoda](https://pixelcoda.com)