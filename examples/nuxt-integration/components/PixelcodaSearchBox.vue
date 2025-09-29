<template>
  <div 
    class="pixelcoda-search-box"
    :class="{ 'is-loading': pending }"
  >
    <form 
      role="search" 
      :aria-label="$t('search.label', 'Website durchsuchen')"
      @submit.prevent="performSearch"
      class="search-form"
    >
      <div class="search-input-container">
        <label 
          :for="inputId" 
          class="sr-only"
        >
          {{ $t('search.inputLabel', 'Suchbegriff eingeben') }}
        </label>
        
        <input
          :id="inputId"
          ref="searchInput"
          v-model="localQuery"
          type="search"
          :placeholder="placeholder"
          :disabled="disabled || pending"
          :aria-describedby="`${inputId}-status`"
          :aria-expanded="showSuggestions"
          aria-haspopup="listbox"
          aria-autocomplete="list"
          autocomplete="off"
          class="search-input"
          @focus="handleFocus"
          @blur="handleBlur"
          @keydown="handleKeyDown"
        />

        <button
          type="submit"
          :disabled="disabled || pending || !localQuery.trim()"
          :aria-label="pending ? $t('search.searching', 'Suchen läuft...') : $t('search.submit', 'Suche starten')"
          class="search-button"
        >
          <Icon 
            :name="pending ? 'mdi:loading' : 'mdi:magnify'" 
            :class="{ 'animate-spin': pending }"
          />
          <span class="sr-only">
            {{ pending ? $t('search.searching', 'Suchen läuft...') : $t('search.submit', 'Suchen') }}
          </span>
        </button>
      </div>

      <!-- Suggestions dropdown -->
      <ul
        v-if="showSuggestions && suggestions.length > 0"
        ref="suggestionsList"
        role="listbox"
        :aria-label="$t('search.suggestions', 'Suchvorschläge')"
        class="search-suggestions"
      >
        <li
          v-for="(suggestion, index) in suggestions"
          :key="suggestion.id"
          role="option"
          :aria-selected="index === activeSuggestion"
          :class="['search-suggestion', { 'is-active': index === activeSuggestion }]"
          @click="selectSuggestion(suggestion.attributes.text)"
          @mouseenter="activeSuggestion = index"
        >
          {{ suggestion.attributes.text }}
        </li>
      </ul>
    </form>

    <!-- Status/Results summary -->
    <div
      :id="`${inputId}-status`"
      aria-live="polite"
      aria-atomic="true"
      class="search-status"
    >
      <template v-if="error">
        <Icon name="mdi:alert-circle" class="text-red-500" />
        {{ $t('search.error', 'Suchfehler') }}: {{ error.message }}
      </template>
      <template v-else-if="pending">
        {{ $t('search.searching', 'Suchen läuft...') }}
      </template>
      <template v-else-if="searchMeta?.pagination">
        {{ $t('search.results', '{count} Ergebnisse gefunden', { 
          count: searchMeta.pagination.total 
        }) }}
        ({{ searchMeta.search?.response_time_ms }}ms)
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTypo3Search, useTypo3SearchSuggestions, useTypo3SearchTracking } from '../composables/useTypo3Search'

interface Props {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  enableSuggestions?: boolean
  collections?: string[]
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Website durchsuchen...',
  disabled: false,
  autoFocus: false,
  enableSuggestions: true,
  collections: undefined,
  className: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'search': [results: any]
  'error': [error: Error]
}>()

// Get global search configuration
const { $pixelcodaSearch } = useNuxtApp()
const config = $pixelcodaSearch.config

// Generate unique input ID for accessibility
const inputId = `pixelcoda-search-${Math.random().toString(36).substr(2, 9)}`

// Local reactive state
const localQuery = ref(props.modelValue || '')
const showSuggestions = ref(false)
const activeSuggestion = ref(-1)
const searchInput = ref<HTMLInputElement>()
const suggestionsList = ref<HTMLUListElement>()

// Search composables
const searchOptions = computed(() => ({
  q: localQuery.value,
  collections: props.collections,
  lang: config.defaultLanguage,
  limit: 20
}))

const { 
  data: searchResults, 
  meta: searchMeta, 
  pending, 
  error, 
  refresh 
} = useTypo3Search(searchOptions, config)

const { 
  suggestions, 
  debouncedGetSuggestions 
} = useTypo3SearchSuggestions(config)

const { logClick } = useTypo3SearchTracking(config)

// Watch for external model value changes
watch(() => props.modelValue, (newValue) => {
  if (newValue !== localQuery.value) {
    localQuery.value = newValue || ''
  }
})

// Emit model value changes
watch(localQuery, (newValue) => {
  emit('update:modelValue', newValue)
  
  // Get suggestions for non-empty queries
  if (props.enableSuggestions && newValue.trim().length >= 2) {
    debouncedGetSuggestions(newValue, props.collections)
  } else {
    suggestions.value = []
    showSuggestions.value = false
  }
})

// Watch search results
watch(searchResults, (results) => {
  if (results.length > 0) {
    emit('search', {
      data: results,
      meta: searchMeta.value,
      query: localQuery.value
    })
    
    // Add to recent queries
    $pixelcodaSearch.addToRecentQueries(localQuery.value)
  }
})

// Watch search errors
watch(error, (err) => {
  if (err) {
    emit('error', err)
  }
})

// Auto-focus
onMounted(() => {
  if (props.autoFocus && searchInput.value) {
    searchInput.value.focus()
  }
})

// Methods
const performSearch = () => {
  if (!localQuery.value.trim()) return
  
  showSuggestions.value = false
  activeSuggestion.value = -1
  refresh()
}

const selectSuggestion = (suggestion: string) => {
  localQuery.value = suggestion
  showSuggestions.value = false
  activeSuggestion.value = -1
  performSearch()
}

const handleFocus = () => {
  if (props.enableSuggestions && suggestions.value.length > 0) {
    showSuggestions.value = true
  }
}

const handleBlur = () => {
  // Delay hiding suggestions to allow clicks
  setTimeout(() => {
    showSuggestions.value = false
    activeSuggestion.value = -1
  }, 150)
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (!showSuggestions.value || suggestions.value.length === 0) {
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      activeSuggestion.value = activeSuggestion.value < suggestions.value.length - 1 
        ? activeSuggestion.value + 1 
        : 0
      break
      
    case 'ArrowUp':
      event.preventDefault()
      activeSuggestion.value = activeSuggestion.value > 0 
        ? activeSuggestion.value - 1 
        : suggestions.value.length - 1
      break
      
    case 'Enter':
      event.preventDefault()
      if (activeSuggestion.value >= 0) {
        selectSuggestion(suggestions.value[activeSuggestion.value].attributes.text)
      } else {
        performSearch()
      }
      break
      
    case 'Escape':
      showSuggestions.value = false
      activeSuggestion.value = -1
      searchInput.value?.blur()
      break
  }
}

// Handle result clicks for analytics
const handleResultClick = (result: any, position: number) => {
  if (config.enableMetrics) {
    logClick(localQuery.value, result, position)
  }
}

// Expose for parent components
defineExpose({
  focus: () => searchInput.value?.focus(),
  clear: () => {
    localQuery.value = ''
    suggestions.value = []
    showSuggestions.value = false
  },
  search: performSearch,
  handleResultClick
})
</script>

<style scoped>
.pixelcoda-search-box {
  @apply relative w-full;
}

.search-form {
  @apply relative;
}

.search-input-container {
  @apply flex items-center relative;
}

.search-input {
  @apply w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent;
  @apply disabled:bg-gray-100 disabled:cursor-not-allowed;
}

.search-button {
  @apply absolute right-2 top-1/2 transform -translate-y-1/2;
  @apply p-2 text-gray-500 hover:text-blue-600 focus:text-blue-600;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 rounded;
  @apply disabled:text-gray-300 disabled:cursor-not-allowed;
}

.search-suggestions {
  @apply absolute top-full left-0 right-0 z-50;
  @apply bg-white border border-gray-200 rounded-lg shadow-lg;
  @apply max-h-60 overflow-y-auto;
  @apply mt-1;
}

.search-suggestion {
  @apply px-4 py-2 cursor-pointer;
  @apply hover:bg-gray-50 focus:bg-gray-50;
  @apply border-b border-gray-100 last:border-b-0;
}

.search-suggestion.is-active {
  @apply bg-blue-50 text-blue-900;
}

.search-status {
  @apply mt-2 text-sm text-gray-600;
  @apply flex items-center gap-2;
}

.is-loading .search-input {
  @apply bg-gray-50;
}

/* Screen reader only class */
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden;
  @apply whitespace-nowrap border-0;
  clip: rect(0, 0, 0, 0);
}

/* Animation for loading spinner */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
