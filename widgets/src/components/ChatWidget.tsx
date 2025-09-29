import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PixelcodaSearchClient, Citation } from '../client';

export interface ChatWidgetProps {
  apiBase: string;
  project: string;
  apiKey: string;
  collections?: string[];
  maxPassages?: number;
  temperature?: number;
  className?: string;
  disabled?: boolean;
  enableStreaming?: boolean;
  placeholder?: string;
  title?: string;
  showDebug?: boolean;
  onCitationClick?: (citation: Citation, position: number) => void;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'error' | 'status';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  isStreaming?: boolean;
}

interface SSEEvent {
  type: 'status' | 'search_results' | 'citations' | 'answer' | 'complete' | 'error';
  message?: string;
  text?: string;
  citations?: Citation[];
  count?: number;
  method?: string;
  final?: boolean;
}

export function ChatWidget({
  apiBase,
  project,
  apiKey,
  collections,
  maxPassages = 6,
  temperature = 0.7,
  className = "",
  disabled = false,
  enableStreaming = true,
  placeholder = "Stellen Sie eine Frage...",
  title = "KI-Assistent",
  showDebug = false,
  onCitationClick
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<ChatMessage | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const client = useRef<PixelcodaSearchClient>();
  const abortController = useRef<AbortController>();

  // Initialize client
  useEffect(() => {
    client.current = new PixelcodaSearchClient(apiBase, project, apiKey);
  }, [apiBase, project, apiKey]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentStreamingMessage, scrollToBottom]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion.trim() || isProcessing || !client.current) return;

    const question = currentQuestion.trim();
    setCurrentQuestion('');
    setIsProcessing(true);

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: question,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Cancel any previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    try {
      if (enableStreaming) {
        await handleStreamingResponse(question);
      } else {
        await handleRegularResponse(question);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was cancelled
      }
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'error',
        content: error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      setCurrentStreamingMessage(null);
    }
  };

  const handleStreamingResponse = async (question: string) => {
    if (!client.current) return;

    const response = await fetch(`${apiBase}/v1/ask/${project}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        q: question,
        collections,
        maxPassages,
        temperature,
        includeDebug: showDebug
      }),
      signal: abortController.current?.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    let streamingMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    setCurrentStreamingMessage(streamingMessage);

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData: SSEEvent = JSON.parse(line.slice(6));
              
              switch (eventData.type) {
                case 'status':
                  streamingMessage = {
                    ...streamingMessage,
                    content: eventData.message || 'Verarbeitung...'
                  };
                  setCurrentStreamingMessage(streamingMessage);
                  break;

                case 'search_results':
                  streamingMessage = {
                    ...streamingMessage,
                    content: `${eventData.count} Dokumente gefunden (${eventData.method})`
                  };
                  setCurrentStreamingMessage(streamingMessage);
                  break;

                case 'citations':
                  streamingMessage = {
                    ...streamingMessage,
                    citations: eventData.citations || [],
                    content: 'Generiere Antwort...'
                  };
                  setCurrentStreamingMessage(streamingMessage);
                  break;

                case 'answer':
                  streamingMessage = {
                    ...streamingMessage,
                    content: eventData.text || '',
                    isStreaming: !eventData.final
                  };
                  setCurrentStreamingMessage(streamingMessage);
                  break;

                case 'complete':
                  streamingMessage = {
                    ...streamingMessage,
                    isStreaming: false
                  };
                  setCurrentStreamingMessage(null);
                  setMessages(prev => [...prev, streamingMessage]);
                  
                  // Log metrics
                  await client.current?.logQuery(question, streamingMessage.citations?.length || 0, Date.now() - streamingMessage.timestamp.getTime());
                  break;

                case 'error':
                  throw new Error(eventData.message || 'Streaming error');
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE event:', parseError);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  };

  const handleRegularResponse = async (question: string) => {
    if (!client.current) return;

    const result = await client.current.ask({
      q: question,
      collections,
      maxPassages,
      temperature,
      includeDebug: showDebug
    });

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      type: 'assistant',
      content: result.answer,
      citations: result.citations,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);

    // Log metrics
    await client.current.logQuery(question, result.citations.length, result.responseTime || 0);
  };

  const handleCitationClick = (citation: Citation, position: number) => {
    if (client.current && messages.length > 0) {
      const lastUserMessage = messages.filter(m => m.type === 'user').pop();
      if (lastUserMessage) {
        client.current.logClick(lastUserMessage.content, citation.id, position, citation.url);
      }
    }
    
    onCitationClick?.(citation, position);
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentStreamingMessage(null);
    if (abortController.current) {
      abortController.current.abort();
    }
    setIsProcessing(false);
  };

  return (
    <div className={`pixelcoda-chat-widget ${className}`} role="complementary" aria-label={title}>
      <header className="pixelcoda-chat-header">
        <h2 className="pixelcoda-chat-title">{title}</h2>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            className="pixelcoda-chat-clear"
            aria-label="Chat löschen"
            disabled={isProcessing}
          >
            🗑️
          </button>
        )}
      </header>

      <div 
        className="pixelcoda-chat-messages"
        role="log"
        aria-live="polite"
        aria-label="Chat-Verlauf"
      >
        {messages.map(message => (
          <div 
            key={message.id}
            className={`pixelcoda-chat-message pixelcoda-chat-message--${message.type}`}
          >
            <div className="pixelcoda-chat-message-content">
              {message.content}
            </div>
            
            {message.citations && message.citations.length > 0 && (
              <div className="pixelcoda-chat-citations">
                <h4 className="pixelcoda-chat-citations-title">Quellen:</h4>
                <ul className="pixelcoda-chat-citations-list">
                  {message.citations.map((citation, index) => (
                    <li key={citation.id} className="pixelcoda-chat-citation">
                      <span className="pixelcoda-chat-citation-ref">
                        {citation.reference || `[${index + 1}]`}
                      </span>
                      {citation.url ? (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pixelcoda-chat-citation-link"
                          onClick={() => handleCitationClick(citation, index)}
                        >
                          {citation.title}
                          <span className="sr-only"> (öffnet in neuem Tab)</span>
                        </a>
                      ) : (
                        <span className="pixelcoda-chat-citation-title">
                          {citation.title}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <time className="pixelcoda-chat-message-time">
              {message.timestamp.toLocaleTimeString()}
            </time>
          </div>
        ))}

        {currentStreamingMessage && (
          <div className="pixelcoda-chat-message pixelcoda-chat-message--assistant pixelcoda-chat-message--streaming">
            <div className="pixelcoda-chat-message-content">
              {currentStreamingMessage.content}
              {currentStreamingMessage.isStreaming && (
                <span className="pixelcoda-chat-typing-indicator" aria-label="Tippt...">
                  <span></span><span></span><span></span>
                </span>
              )}
            </div>
            
            {currentStreamingMessage.citations && currentStreamingMessage.citations.length > 0 && (
              <div className="pixelcoda-chat-citations">
                <h4 className="pixelcoda-chat-citations-title">Quellen:</h4>
                <ul className="pixelcoda-chat-citations-list">
                  {currentStreamingMessage.citations.map((citation, index) => (
                    <li key={citation.id} className="pixelcoda-chat-citation">
                      <span className="pixelcoda-chat-citation-ref">
                        {citation.reference || `[${index + 1}]`}
                      </span>
                      {citation.url ? (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pixelcoda-chat-citation-link"
                          onClick={() => handleCitationClick(citation, index)}
                        >
                          {citation.title}
                          <span className="sr-only"> (öffnet in neuem Tab)</span>
                        </a>
                      ) : (
                        <span className="pixelcoda-chat-citation-title">
                          {citation.title}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form 
        onSubmit={handleSubmit}
        className="pixelcoda-chat-form"
        role="search"
        aria-label="Frage stellen"
      >
        <div className="pixelcoda-chat-input-container">
          <label htmlFor="pixelcoda-chat-input" className="sr-only">
            Ihre Frage
          </label>
          <input
            ref={inputRef}
            id="pixelcoda-chat-input"
            type="text"
            value={currentQuestion}
            onChange={(e) => setCurrentQuestion(e.target.value)}
            placeholder={placeholder}
            disabled={disabled || isProcessing}
            className="pixelcoda-chat-input"
            aria-describedby="pixelcoda-chat-status"
            autoComplete="off"
          />
          
          <button
            type="submit"
            disabled={disabled || isProcessing || !currentQuestion.trim()}
            className="pixelcoda-chat-submit"
            aria-label={isProcessing ? 'Verarbeitung läuft...' : 'Frage senden'}
          >
            {isProcessing ? (
              <span aria-hidden="true">⏳</span>
            ) : (
              <span aria-hidden="true">➤</span>
            )}
            <span className="sr-only">
              {isProcessing ? 'Verarbeitung läuft...' : 'Senden'}
            </span>
          </button>
        </div>

        <div
          id="pixelcoda-chat-status"
          className="pixelcoda-chat-status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isProcessing && 'Verarbeitung läuft...'}
        </div>
      </form>
    </div>
  );
}
