import { SearchEngine, SearchDoc } from './base.js';

export class MeiliEngine implements SearchEngine {
  url: string; key?: string;
  constructor(url: string, key?: string) { this.url = url; this.key = key; }

  private idx(project: string) {
    return `${this.url}/indexes/${encodeURIComponent(project)}`;
  }

  async upsert(project: string, collection: string, doc: SearchDoc) {
    const body = { ...doc, _collection: collection };
    await fetch(`${this.idx(project)}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.key ? { 'Authorization': `Bearer ${this.key}` } : {}) },
      body: JSON.stringify([body])
    });
  }

  async remove(project: string, collection: string, id: string) {
    await fetch(`${this.idx(project)}/documents/${id}`, {
      method: 'DELETE',
      headers: { ...(this.key ? { 'Authorization': `Bearer ${this.key}` } : {}) }
    });
  }

  async search(project: string, query: any) {
    const payload = {
      q: query.q ?? '',
      filter: query.filters ? Object.entries(query.filters).map(([k,v]) => `${k} IN [${(v as any[]).map(x=>JSON.stringify(x)).join(',')}]`) : undefined,
      limit: query.limit ?? 10,
      offset: ((query.page ?? 1) - 1) * (query.limit ?? 10)
    };
    const res = await fetch(`${this.idx(project)}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.key ? { 'Authorization': `Bearer ${this.key}` } : {}) },
      body: JSON.stringify(payload)
    });
    return res.json();
  }
}
