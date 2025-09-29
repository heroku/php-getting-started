import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SearchBox } from './SearchBox';
import { AnswerPanel } from './AnswerPanel';
import { ChatWidget } from './ChatWidget';
import { PixelcodaSearchClient, SearchResult, Citation } from '../client';

export interface FloatingPanelProps {
  apiBase: string;
  project: string;
  apiKey: string;
  collections?: string[];
  className?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  mode?: 'search' | 'chat' | 'both';
  triggerText?: string;
  triggerIcon?: string;
  title?: string;
  searchPlaceholder?: string;
  chatPlaceholder?: string;
  enableKeyboardShortcut?: boolean;
  keyboardShortcut?: string[];
  zIndex?: number;
  maxWidth?: number;
  maxHeight?: number;
  onOpen?: () => void;
  onClose?: () => void;
  onCitationClick?: (citation: Citation, position: number) => void;
}

export function FloatingPanel({
  apiBase,
  project,
  apiKey,
  collections,
  className = "",
  position = 'bottom-right',
  mode = 'both',
  triggerText = "Suche & KI",
  triggerIcon = "🔍",
  title = "Pixelcoda Suche",
  searchPlaceholder = "Website durchsuchen...",
  chatPlaceholder = "Stellen Sie eine Frage...",
  enableKeyboardShortcut = true,
  keyboardShortcut = ['Control', 'k'],
  zIndex = 1000,
  maxWidth = 400,
  maxHeight = 600,
  onOpen,
  onClose,
  onCitationClick
}: FloatingPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'chat'>(mode === 'search' ? 'search' : mode === 'chat' ? 'chat' : 'search');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [hasResults, setHasResults] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFocusableRef = useRef<HTMLElement>(null);
  const lastFocusableRef = useRef<HTMLElement>(null);

  // Focus trap refs
  const focusableElements = useRef<HTMLElement[]>([]);

  // Handle panel open/close
  const openPanel = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
    
    // Focus first element after opening
    setTimeout(() => {
      const firstFocusable = panelRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      firstFocusable?.focus();
    }, 100);
  }, [onOpen]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    onClose?.();
    
    // Return focus to trigger
    triggerRef.current?.focus();
  }, [onClose]);

  // Keyboard shortcut handling
  useEffect(() => {
    if (!enableKeyboardShortcut) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isShortcut = keyboardShortcut.every(key => {
        if (key === 'Control') return event.ctrlKey;
        if (key === 'Meta') return event.metaKey;
        if (key === 'Alt') return event.altKey;
        if (key === 'Shift') return event.shiftKey;
        return event.key.toLowerCase() === key.toLowerCase();
      });

      if (isShortcut) {
        event.preventDefault();
        if (isOpen) {
          closePanel();
        } else {
          openPanel();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, enableKeyboardShortcut, keyboardShortcut, openPanel, closePanel]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const updateFocusableElements = () => {
      if (!panelRef.current) return;
      
      const elements = Array.from(
        panelRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ) as HTMLElement[];
      
      focusableElements.current = elements;
      firstFocusableRef.current = elements[0];
      lastFocusableRef.current = elements[elements.length - 1];
    };

    updateFocusableElements();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePanel();
        return;
      }

      if (event.key === 'Tab') {
        const elements = focusableElements.current;
        if (elements.length === 0) return;

        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === elements[0]) {
            event.preventDefault();
            elements[elements.length - 1].focus();
          }
        } else {
          // Tab
          if (document.activeElement === elements[elements.length - 1]) {
            event.preventDefault();
            elements[0].focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Update focusable elements when DOM changes
    const observer = new MutationObserver(updateFocusableElements);
    observer.observe(panelRef.current, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      observer.disconnect();
    };
  }, [isOpen, closePanel]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        closePanel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closePanel]);

  const handleSearchResults = (results: SearchResult) => {
    setSearchResults(results);
    setHasResults(results.hits?.hits?.length > 0 || false);
  };

  const handleSearchError = (error: Error) => {
    console.error('Search error:', error);
    setSearchResults(null);
    setHasResults(false);
  };

  const handleTabChange = (tab: 'search' | 'chat') => {
    setActiveTab(tab);
  };

  const positionClasses = {
    'bottom-right': 'pixelcoda-floating-panel--bottom-right',
    'bottom-left': 'pixelcoda-floating-panel--bottom-left',
    'top-right': 'pixelcoda-floating-panel--top-right',
    'top-left': 'pixelcoda-floating-panel--top-left'
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPanel}
        className={`pixelcoda-floating-trigger ${positionClasses[position]} ${className}`}
        style={{ zIndex }}
        aria-label={`${triggerText} öffnen${enableKeyboardShortcut ? ` (${keyboardShortcut.join('+')})` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="pixelcoda-floating-trigger-icon" aria-hidden="true">
          {triggerIcon}
        </span>
        <span className="pixelcoda-floating-trigger-text">
          {triggerText}
        </span>
      </button>

      {/* Floating Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className={`pixelcoda-floating-panel ${positionClasses[position]} ${className}`}
          style={{ 
            zIndex: zIndex + 1, 
            maxWidth: `${maxWidth}px`, 
            maxHeight: `${maxHeight}px` 
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pixelcoda-floating-panel-title"
        >
          <header className="pixelcoda-floating-panel-header">
            <h2 
              id="pixelcoda-floating-panel-title" 
              className="pixelcoda-floating-panel-title"
            >
              {title}
            </h2>
            
            {mode === 'both' && (
              <div 
                className="pixelcoda-floating-panel-tabs"
                role="tablist"
                aria-label="Suchfunktionen"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'search'}
                  aria-controls="pixelcoda-search-panel"
                  id="pixelcoda-search-tab"
                  className={`pixelcoda-floating-panel-tab ${
                    activeTab === 'search' ? 'pixelcoda-floating-panel-tab--active' : ''
                  }`}
                  onClick={() => handleTabChange('search')}
                >
                  Suche
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'chat'}
                  aria-controls="pixelcoda-chat-panel"
                  id="pixelcoda-chat-tab"
                  className={`pixelcoda-floating-panel-tab ${
                    activeTab === 'chat' ? 'pixelcoda-floating-panel-tab--active' : ''
                  }`}
                  onClick={() => handleTabChange('chat')}
                >
                  KI-Chat
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={closePanel}
              className="pixelcoda-floating-panel-close"
              aria-label="Panel schließen"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </header>

          <div className="pixelcoda-floating-panel-content">
            {/* Search Panel */}
            {(mode === 'search' || (mode === 'both' && activeTab === 'search')) && (
              <div
                id="pixelcoda-search-panel"
                role="tabpanel"
                aria-labelledby="pixelcoda-search-tab"
                className="pixelcoda-floating-panel-section"
              >
                <SearchBox
                  apiBase={apiBase}
                  project={project}
                  apiKey={apiKey}
                  collections={collections}
                  placeholder={searchPlaceholder}
                  onResults={handleSearchResults}
                  onError={handleSearchError}
                  autoFocus={activeTab === 'search'}
                  className="pixelcoda-floating-search-box"
                />

                {hasResults && searchResults && (
                  <div className="pixelcoda-floating-search-results">
                    <h3 className="pixelcoda-floating-search-results-title">
                      Suchergebnisse ({searchResults.hits?.estimatedTotalHits || 0})
                    </h3>
                    <ul className="pixelcoda-floating-search-results-list">
                      {searchResults.hits?.hits?.slice(0, 5).map((hit: any, index: number) => (
                        <li key={hit.id || index} className="pixelcoda-floating-search-result">
                          {hit.url ? (
                            <a
                              href={hit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pixelcoda-floating-search-result-link"
                              onClick={() => {
                                // Log click
                                const client = new PixelcodaSearchClient(apiBase, project, apiKey);
                                client.logClick(searchResults.meta?.search?.query || '', hit.id, index, hit.url);
                              }}
                            >
                              <h4 className="pixelcoda-floating-search-result-title">
                                {hit.title || 'Untitled'}
                              </h4>
                              {hit.summary && (
                                <p className="pixelcoda-floating-search-result-summary">
                                  {hit.summary}
                                </p>
                              )}
                              <span className="sr-only"> (öffnet in neuem Tab)</span>
                            </a>
                          ) : (
                            <div className="pixelcoda-floating-search-result-content">
                              <h4 className="pixelcoda-floating-search-result-title">
                                {hit.title || 'Untitled'}
                              </h4>
                              {hit.summary && (
                                <p className="pixelcoda-floating-search-result-summary">
                                  {hit.summary}
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Chat Panel */}
            {(mode === 'chat' || (mode === 'both' && activeTab === 'chat')) && (
              <div
                id="pixelcoda-chat-panel"
                role="tabpanel"
                aria-labelledby="pixelcoda-chat-tab"
                className="pixelcoda-floating-panel-section"
              >
                <ChatWidget
                  apiBase={apiBase}
                  project={project}
                  apiKey={apiKey}
                  collections={collections}
                  placeholder={chatPlaceholder}
                  title=""
                  className="pixelcoda-floating-chat-widget"
                  onCitationClick={onCitationClick}
                />
              </div>
            )}
          </div>

          <footer className="pixelcoda-floating-panel-footer">
            <p className="pixelcoda-floating-panel-hint">
              {enableKeyboardShortcut && (
                <span>
                  <kbd>{keyboardShortcut.join('+')}</kbd> zum Öffnen/Schließen • 
                </span>
              )}
              <kbd>Esc</kbd> zum Schließen
            </p>
          </footer>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="pixelcoda-floating-panel-backdrop"
          style={{ zIndex }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
