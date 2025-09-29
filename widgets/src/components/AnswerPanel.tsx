import React, { useState, useRef, useEffect } from 'react';
import { PixelcodaSearchClient, AskResult, Citation } from '../client';

export interface AnswerPanelProps {
  apiBase: string;
  project: string;
  apiKey: string;
  query?: string;
  answer?: string;
  citations?: Citation[];
  isLoading?: boolean;
  error?: string;
  onCitationClick?: (citation: Citation, position: number) => void;
  showDebug?: boolean;
  className?: string;
  collections?: string[];
  maxPassages?: number;
  temperature?: number;
}

export function AnswerPanel({
  apiBase,
  project,
  apiKey,
  query,
  answer,
  citations = [],
  isLoading = false,
  error,
  onCitationClick,
  showDebug = false,
  className = "",
  collections,
  maxPassages = 6,
  temperature = 0.7
}: AnswerPanelProps) {
  const [localAnswer, setLocalAnswer] = useState<string>('');
  const [localCitations, setLocalCitations] = useState<Citation[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set());

  const client = useRef<PixelcodaSearchClient>();
  const abortController = useRef<AbortController>();

  // Initialize client
  useEffect(() => {
    client.current = new PixelcodaSearchClient(apiBase, project, apiKey);
  }, [apiBase, project, apiKey]);

  // Auto-ask when query changes
  useEffect(() => {
    if (query && query.trim() && client.current && !answer) {
      askQuestion(query.trim());
    }
  }, [query, answer]);

  const askQuestion = async (q: string) => {
    if (!client.current) return;

    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    setLocalLoading(true);
    setLocalError('');
    setLocalAnswer('');
    setLocalCitations([]);
    setDebugInfo(null);

    try {
      const result = await client.current.ask({
        q,
        collections,
        maxPassages,
        temperature,
        includeDebug: showDebug
      });

      setLocalAnswer(result.answer);
      setLocalCitations(result.citations);
      
      if (showDebug && result.debug) {
        setDebugInfo(result.debug);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was cancelled
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      setLocalError(errorMessage);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleCitationClick = (citation: Citation, position: number) => {
    // Log click metrics
    if (client.current && query) {
      client.current.logClick(query, citation.id, position, citation.url);
    }
    
    onCitationClick?.(citation, position);
  };

  const toggleCitationExpansion = (index: number) => {
    setExpandedCitations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Use props or local state
  const displayAnswer = answer || localAnswer;
  const displayCitations = citations.length > 0 ? citations : localCitations;
  const displayLoading = isLoading || localLoading;
  const displayError = error || localError;

  if (!query && !displayAnswer && !displayLoading && !displayError) {
    return null;
  }

  return (
    <section 
      className={`pixelcoda-answer-panel ${className}`}
      aria-labelledby="pixelcoda-answer-heading"
    >
      <header className="pixelcoda-answer-header">
        <h2 id="pixelcoda-answer-heading" className="pixelcoda-answer-title">
          KI-Antwort
        </h2>
        {query && (
          <div className="pixelcoda-answer-query" aria-label="Gestellte Frage">
            <strong>Frage:</strong> {query}
          </div>
        )}
      </header>

      <div className="pixelcoda-answer-content">
        {displayLoading && (
          <div 
            className="pixelcoda-answer-loading"
            aria-live="polite"
            role="status"
          >
            <span aria-hidden="true">⏳</span>
            <span>KI generiert Antwort...</span>
          </div>
        )}

        {displayError && (
          <div 
            className="pixelcoda-answer-error"
            role="alert"
            aria-live="assertive"
          >
            <span aria-hidden="true">⚠️</span>
            <span>Fehler: {displayError}</span>
          </div>
        )}

        {displayAnswer && (
          <div 
            className="pixelcoda-answer-text"
            aria-live="polite"
          >
            {displayAnswer}
          </div>
        )}

        {displayCitations.length > 0 && (
          <div className="pixelcoda-citations-section">
            <h3 
              id="pixelcoda-citations-heading" 
              className="pixelcoda-citations-title"
            >
              Quellen ({displayCitations.length})
            </h3>
            <ul 
              className="pixelcoda-citations-list"
              aria-labelledby="pixelcoda-citations-heading"
            >
              {displayCitations.map((citation, index) => (
                <li 
                  key={citation.id}
                  className="pixelcoda-citation-item"
                >
                  <div className="pixelcoda-citation-header">
                    <span 
                      className="pixelcoda-citation-reference"
                      aria-label={`Quelle ${index + 1}`}
                    >
                      {citation.reference || `[${index + 1}]`}
                    </span>
                    
                    <div className="pixelcoda-citation-meta">
                      {citation.url ? (
                        <a
                          href={citation.url}
                          className="pixelcoda-citation-title"
                          onClick={() => handleCitationClick(citation, index)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {citation.title}
                          <span className="sr-only"> (öffnet in neuem Tab)</span>
                        </a>
                      ) : (
                        <span className="pixelcoda-citation-title">
                          {citation.title}
                        </span>
                      )}
                      
                      {citation.collection && (
                        <span className="pixelcoda-citation-collection">
                          {citation.collection}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="pixelcoda-citation-toggle"
                      onClick={() => toggleCitationExpansion(index)}
                      aria-expanded={expandedCitations.has(index)}
                      aria-label={
                        expandedCitations.has(index) 
                          ? 'Textausschnitt verbergen' 
                          : 'Textausschnitt anzeigen'
                      }
                    >
                      {expandedCitations.has(index) ? '▼' : '▶'}
                    </button>
                  </div>

                  {expandedCitations.has(index) && (
                    <div className="pixelcoda-citation-snippet">
                      {citation.snippet}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showDebug && debugInfo && (
          <details className="pixelcoda-debug-info">
            <summary>Debug-Informationen</summary>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </details>
        )}
      </div>
    </section>
  );
}
