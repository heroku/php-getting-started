export type SearchDoc = {
  id: string;
  project_id: string;
  collection: string;
  lang: string;
  url?: string;
  title?: string;
  summary?: string;
  content?: string;
  facets?: Record<string, any>;
  boost?: number;
};

export interface SearchEngine {
  upsert(project: string, collection: string, doc: SearchDoc): Promise<void>;
  remove(project: string, collection: string, id: string): Promise<void>;
  search(project: string, query: any): Promise<any>;
}
