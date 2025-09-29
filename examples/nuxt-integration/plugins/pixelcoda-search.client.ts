/**
 * Nuxt Plugin for pixelcoda Search Integration
 * 
 * Provides global configuration and utilities for search functionality
 * Compatible with nuxt-typo3 ecosystem
 */

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  
  // Global search configuration
  const searchConfig = {
    apiBase: config.public.pixelcodaSearch?.apiBase || 'http://localhost:8787',
    project: config.public.pixelcodaSearch?.project || 'demo',
    apiKey: config.public.pixelcodaSearch?.apiKey || '',
    defaultLanguage: config.public.pixelcodaSearch?.defaultLanguage || 'de',
    enableMetrics: config.public.pixelcodaSearch?.enableMetrics !== false,
    debounceMs: config.public.pixelcodaSearch?.debounceMs || 300
  }

  // Validate configuration
  if (!searchConfig.apiKey) {
    console.warn('pixelcoda Search: API key not configured. Search functionality will be limited.')
  }

  // Global search state management
  const globalSearchState = reactive({
    currentQuery: '',
    recentQueries: [] as string[],
    isSearching: false
  })

  // Provide global utilities
  return {
    provide: {
      pixelcodaSearch: {
        config: searchConfig,
        state: globalSearchState,
        
        // Utility functions
        addToRecentQueries: (query: string) => {
          if (query.trim() && !globalSearchState.recentQueries.includes(query)) {
            globalSearchState.recentQueries.unshift(query)
            globalSearchState.recentQueries = globalSearchState.recentQueries.slice(0, 10)
          }
        },
        
        clearRecentQueries: () => {
          globalSearchState.recentQueries = []
        },
        
        // Format results for nuxt-typo3 compatibility
        formatForNuxtTypo3: (searchResults: any[]) => {
          return searchResults.map(result => ({
            type: result.type,
            id: result.id,
            attributes: {
              ...result.attributes,
              // Ensure compatibility with nuxt-typo3 expected fields
              title: result.attributes.title || '',
              slug: result.attributes.url || `/${result.type}/${result.id}`,
              content: result.attributes.content || result.attributes.summary || '',
              language: result.attributes.language || searchConfig.defaultLanguage
            },
            meta: result.meta
          }))
        }
      }
    }
  }
})
