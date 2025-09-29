// Main components
export { SearchBox } from './components/SearchBox';
export type { SearchBoxProps } from './components/SearchBox';

export { AnswerPanel } from './components/AnswerPanel';
export type { AnswerPanelProps } from './components/AnswerPanel';

export { ChatWidget } from './components/ChatWidget';
export type { ChatWidgetProps } from './components/ChatWidget';

export { FloatingPanel } from './components/FloatingPanel';
export type { FloatingPanelProps } from './components/FloatingPanel';

// API client
export { PixelcodaSearchClient } from './client';
export type { 
  SearchParams, 
  SearchResult, 
  SearchHit,
  AskParams,
  AskResult,
  Citation,
  SuggestParams,
  SuggestResult,
  ClientOptions
} from './client';

// Legacy exports for backward compatibility
export { search, ask, suggest } from './client';
