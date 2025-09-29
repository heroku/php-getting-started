/**
 * Nuxt Composable for pixelcoda Search - Compatible with nuxt-typo3
 * 
 * Provides search and AI-powered ask functionality with JSON:API 1.0 responses
 * that can be directly consumed by nuxt-typo3 components.
 */

import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'

// JSON:API types compatible with nuxt-typo3
export interface JsonApiResource {
  type: string
  id: string
  attributes: Record<string, any>
  relationships?: Record<string, any>
  links?: Record<string, string>
  meta?: Record<string, any>
}

export interface JsonApiResponse {
  data: JsonApiResource | JsonApiResource[]
  included?: JsonApiResource[]
  meta?: Record<string, any>
  links?: Record<string, string>
  jsonapi?: { version: string }
}

export interface SearchOptions {
  q?: string
  filters?: Record<string, any>
  facets?: string[]
  page?: number
  limit?: number
  lang?: string
  collections?: string[]
}

export interface AskOptions {
  q: string
  lang?: string
  collections?: string[]
  maxPassages?: number
  temperature?: number
  includeDebug?: boolean
}

export interface UseTypo3SearchOptions {
  apiBase: string
  project: string
  apiKey: string
  defaultLanguage?: string
  autoSearch?: boolean
  debounceMs?: number
}

export interface SearchState {
  data: Ref<JsonApiResource[]>
  included: Ref<JsonApiResource[]>
  meta: Ref<Record<string, any> | null>
  links: Ref<Record<string, string> | null>
  pending: Ref<boolean>
  error: Ref<Error | null>
  refresh: () => Promise<void>
  clear: () => void
}

export interface AskState {
  answer: Ref<JsonApiResource | null>
  citations: Ref<JsonApiResource[]>
  meta: Ref<Record<string, any> | null>
  pending: Ref<boolean>
  error: Ref<Error | null>
  ask: (question: string, options?: Partial<AskOptions>) => Promise<void>
  clear: () => void
}

/**
 * Main search composable - compatible with nuxt-typo3 patterns
 */
export function useTypo3Search(
  searchOptions: Ref<SearchOptions> | SearchOptions,
  options: UseTypo3SearchOptions
): SearchState {
  const { apiBase, project, apiKey, defaultLanguage = 'de', autoSearch = true, debounceMs = 300 } = options

  // Reactive state
  const data = ref<JsonApiResource[]>([])
  const included = ref<JsonApiResource[]>([])
  const meta = ref<Record<string, any> | null>(null)
  const links = ref<Record<string, string> | null>(null)
  const pending = ref(false)
  const error = ref<Error | null>(null)

  // Reactive search options
  const searchParams = computed(() => {
    const opts = unref(searchOptions)
    return {
      lang: defaultLanguage,
      limit: 20,
      page: 1,
      ...opts
    }
  })

  // Debounced search function
  let debounceTimer: NodeJS.Timeout | null = null

  const executeSearch = async () => {
    if (!searchParams.value.q || searchParams.value.q.trim().length < 2) {
      clear()
      return
    }

    pending.value = true
    error.value = null

    try {
      const response = await $fetch<JsonApiResponse>(`${apiBase}/v1/search/${project}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: searchParams.value
      })

      // Handle JSON:API response
      if (Array.isArray(response.data)) {
        data.value = response.data
      } else {
        data.value = response.data ? [response.data] : []
      }

      included.value = response.included || []
      meta.value = response.meta || null
      links.value = response.links || null

      // Log search metrics
      if (response.meta?.search?.response_time_ms) {
        await logSearchMetrics(
          searchParams.value.q!,
          data.value.length,
          response.meta.search.response_time_ms
        )
      }

    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Search failed')
      console.error('Search error:', err)
    } finally {
      pending.value = false
    }
  }

  const refresh = async () => {
    await executeSearch()
  }

  const debouncedSearch = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(executeSearch, debounceMs)
  }

  const clear = () => {
    data.value = []
    included.value = []
    meta.value = null
    links.value = null
    error.value = null
  }

  // Auto-search when query changes
  if (autoSearch) {
    watch(searchParams, debouncedSearch, { deep: true })
  }

  // Log search metrics
  const logSearchMetrics = async (query: string, resultCount: number, responseTime: number) => {
    try {
      await $fetch(`${apiBase}/v1/metrics/query/${project}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: {
          query,
          results_count: resultCount,
          response_time_ms: responseTime,
          lang: searchParams.value.lang,
          collections: searchParams.value.collections
        }
      })
    } catch (err) {
      console.warn('Failed to log search metrics:', err)
    }
  }

  return {
    data,
    included,
    meta,
    links,
    pending,
    error,
    refresh,
    clear
  }
}

/**
 * AI-powered ask composable
 */
export function useTypo3Ask(options: UseTypo3SearchOptions): AskState {
  const { apiBase, project, apiKey, defaultLanguage = 'de' } = options

  // Reactive state
  const answer = ref<JsonApiResource | null>(null)
  const citations = ref<JsonApiResource[]>([])
  const meta = ref<Record<string, any> | null>(null)
  const pending = ref(false)
  const error = ref<Error | null>(null)

  const ask = async (question: string, askOptions: Partial<AskOptions> = {}) => {
    if (!question.trim()) {
      clear()
      return
    }

    pending.value = true
    error.value = null

    try {
      const payload: AskOptions = {
        q: question.trim(),
        lang: defaultLanguage,
        maxPassages: 6,
        temperature: 0.7,
        includeDebug: false,
        ...askOptions
      }

      const response = await $fetch<JsonApiResponse>(`${apiBase}/v1/ask/${project}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: payload
      })

      // Handle JSON:API response
      if (Array.isArray(response.data)) {
        answer.value = response.data[0] || null
      } else {
        answer.value = response.data || null
      }

      citations.value = response.included?.filter(res => res.type === 'citation') || []
      meta.value = response.meta || null

    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Ask failed')
      console.error('Ask error:', err)
    } finally {
      pending.value = false
    }
  }

  const clear = () => {
    answer.value = null
    citations.value = []
    meta.value = null
    error.value = null
  }

  return {
    answer,
    citations,
    meta,
    pending,
    error,
    ask,
    clear
  }
}

/**
 * Combined search and ask composable
 */
export function useTypo3SearchWithAsk(
  searchOptions: Ref<SearchOptions> | SearchOptions,
  options: UseTypo3SearchOptions
) {
  const searchState = useTypo3Search(searchOptions, options)
  const askState = useTypo3Ask(options)

  // Auto-ask when search query changes (optional)
  const autoAsk = ref(false)

  watch(
    () => unref(searchOptions).q,
    (newQuery) => {
      if (autoAsk.value && newQuery && newQuery.trim().length > 5) {
        askState.ask(newQuery, {
          collections: unref(searchOptions).collections,
          lang: unref(searchOptions).lang
        })
      }
    }
  )

  return {
    search: searchState,
    ask: askState,
    autoAsk
  }
}

/**
 * Click tracking composable
 */
export function useTypo3SearchTracking(options: UseTypo3SearchOptions) {
  const { apiBase, project, apiKey } = options

  const logClick = async (
    query: string,
    resource: JsonApiResource,
    position: number
  ) => {
    try {
      await $fetch(`${apiBase}/v1/metrics/click/${project}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: {
          query,
          document_id: resource.id,
          position,
          url: resource.attributes.url,
          collection: resource.attributes.collection
        }
      })
    } catch (err) {
      console.warn('Failed to log click metrics:', err)
    }
  }

  return { logClick }
}

/**
 * Search suggestions composable
 */
export function useTypo3SearchSuggestions(options: UseTypo3SearchOptions) {
  const { apiBase, project, apiKey, defaultLanguage = 'de', debounceMs = 300 } = options

  const suggestions = ref<JsonApiResource[]>([])
  const pending = ref(false)
  const error = ref<Error | null>(null)

  let debounceTimer: NodeJS.Timeout | null = null

  const getSuggestions = async (query: string, collections?: string[]) => {
    if (!query || query.length < 2) {
      suggestions.value = []
      return
    }

    pending.value = true
    error.value = null

    try {
      const response = await $fetch<JsonApiResponse>(`${apiBase}/v1/suggest/${project}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: {
          q: query,
          limit: 5,
          collections
        }
      })

      suggestions.value = Array.isArray(response.data) ? response.data : []

    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Suggestions failed')
      console.error('Suggestions error:', err)
    } finally {
      pending.value = false
    }
  }

  const debouncedGetSuggestions = (query: string, collections?: string[]) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => getSuggestions(query, collections), debounceMs)
  }

  return {
    suggestions,
    pending,
    error,
    getSuggestions,
    debouncedGetSuggestions
  }
}

// Utility function to check if running in Nuxt
function unref<T>(val: T | Ref<T>): T {
  return typeof val === 'object' && val !== null && 'value' in val ? val.value : val
}
