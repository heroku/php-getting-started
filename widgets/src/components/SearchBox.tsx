import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PixelcodaSearchClient, SearchResult, SearchHit, SuggestResult } from '../client';

export interface SearchBoxProps {
  apiBase: string;
  project: string;
  apiKey: string;
  onResults?: (results: SearchResult) => void;
  onError?: (error: Error) => void;
  placeholder?: string;
  autoFocus?: boolean;
  enableSuggestions?: boolean;
  debounceMs?: number;
  collections?: string[];
  className?: string;
  disabled?: boolean;
}

export function SearchBox({
  apiBase,
  project,
  apiKey,
  onResults,
  onError,
  placeholder = "Website durchsuchen...",
  autoFocus = false,
  enableSuggestions = true,
  debounceMs = 300,
  collections,
  className = "",
  disabled = false
}: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [lastQuery, setLastQuery] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const client = useRef<PixelcodaSearchClient>();
  const debounceRef = useRef<NodeJS.Timeout>();

  // Initialize client
  useEffect(() => {
    client.current = new PixelcodaSearchClient(apiBase, project, apiKey);
  }, [apiBase, project, apiKey]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Debounced suggestions
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!enableSuggestions || !client.current || q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const result = await client.current.suggest({ q, limit: 5, collections });
      setSuggestions(result.suggestions);
      setShowSuggestions(result.suggestions.length > 0);
    } catch (error) {
      console.warn('Failed to fetch suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [enableSuggestions, collections]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setActiveSuggestion(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, debounceMs);
  };

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !client.current) return;

    setIsLoading(true);
    setStatus('Suchen…');
    setShowSuggestions(false);
    
    const startTime = Date.now();

    try {
      const results = await client.current.search({
        q: searchQuery.trim(),
        limit: 20,
        collections
      });

      const responseTime = Date.now() - startTime;
      const hitCount = results.hits?.estimatedTotalHits ?? results.hits?.hits?.length ?? 0;
      
      setStatus(`${hitCount} Ergebnisse gefunden (${responseTime}ms)`);
      setLastQuery(searchQuery.trim());
      
      // Log metrics
      await client.current.logQuery(searchQuery.trim(), hitCount, responseTime);
      
      onResults?.(results);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Suchfehler');
      setStatus(`Fehler: ${err.message}`);
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [collections, onResults, onError]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch(query);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestion(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (activeSuggestion >= 0) {
          const selectedSuggestion = suggestions[activeSuggestion];
          setQuery(selectedSuggestion);
          performSearch(selectedSuggestion);
        } else {
          performSearch(query);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setActiveSuggestion(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    performSearch(suggestion);
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setActiveSuggestion(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`pixelcoda-search-box ${className}`}>
      <form 
        role="search" 
        aria-label="Website durchsuchen"
        onSubmit={handleSubmit}
        className="pixelcoda-search-form"
      >
        <div className="pixelcoda-search-input-container">
          <label htmlFor="pixelcoda-search-input" className="sr-only">
            Suche
          </label>
          <input
            ref={inputRef}
            id="pixelcoda-search-input"
            type="search"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => enableSuggestions && suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            aria-describedby="pixelcoda-search-status"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            autoComplete="off"
            className="pixelcoda-search-input"
          />
          
          <button
            type="submit"
            disabled={disabled || isLoading || !query.trim()}
            className="pixelcoda-search-button"
            aria-label={isLoading ? 'Suchen läuft...' : 'Suche starten'}
          >
            {isLoading ? (
              <span aria-hidden="true">⏳</span>
            ) : (
              <span aria-hidden="true">🔍</span>
            )}
            <span className="sr-only">
              {isLoading ? 'Suchen läuft...' : 'Suchen'}
            </span>
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul
            ref={suggestionsRef}
            role="listbox"
            aria-label="Suchvorschläge"
            className="pixelcoda-search-suggestions"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                role="option"
                aria-selected={index === activeSuggestion}
                className={`pixelcoda-search-suggestion ${
                  index === activeSuggestion ? 'active' : ''
                }`}
                onClick={() => handleSuggestionClick(suggestion)}
                onMouseEnter={() => setActiveSuggestion(index)}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </form>

      <div
        id="pixelcoda-search-status"
        aria-live="polite"
        aria-atomic="true"
        className="pixelcoda-search-status"
      >
        {status}
      </div>
    </div>
  );
}
