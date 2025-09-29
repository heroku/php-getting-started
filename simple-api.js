#!/usr/bin/env node

/**
 * pixelcoda Search API - Simple Working Version
 * No dependencies, pure Node.js for immediate testing
 */

import {
    createServer
} from 'http';
import {
    URL
} from 'url';

const PORT = 8787;

// Simple JSON:API response helper
function jsonApiResponse(data, included = [], meta = {}) {
    return {
        data,
        included,
        meta,
        jsonapi: {
            version: '1.0'
        }
    };
}

// Request handler
const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('Content-Type', 'application/vnd.api+json');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;
    const method = req.method;

    console.log(`${new Date().toISOString()} ${method} ${path}`);

    try {
        // Health endpoint
        if (path === '/health' && method === 'GET') {
            res.writeHead(200);
            res.end(JSON.stringify({
                ok: true,
                service: 'pixelcoda-search-api',
                version: '2.0.0',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // Search endpoint
        if (path.match(/^\/v1\/search\//) && method === 'POST') {
            const project = path.split('/')[3];
            const body = await getRequestBody(req);
            const query = body.q || '';

            const searchResults = jsonApiResponse([{
                    type: 'searchResult',
                    id: 'demo-result-1',
                    attributes: {
                        title: 'pixelcoda Search Platform',
                        content: 'A modern, API-first search platform with AI agents, designed for TYPO3 and other CMS systems.',
                        summary: 'Modern search platform with AI capabilities',
                        url: '/platform',
                        collection: 'pages',
                        language: 'en',
                        score: 0.95
                    },
                    meta: {
                        relevance: 0.95,
                        collection: 'pages'
                    }
                },
                {
                    type: 'searchResult',
                    id: 'demo-result-2',
                    attributes: {
                        title: 'TYPO3 Integration Guide',
                        content: 'Complete guide for integrating pixelcoda Search with TYPO3. Supports both classic and headless modes.',
                        summary: 'TYPO3 integration documentation',
                        url: '/docs/typo3',
                        collection: 'docs',
                        language: 'en',
                        score: 0.87
                    },
                    meta: {
                        relevance: 0.87,
                        collection: 'docs'
                    }
                }
            ], [], {
                pagination: {
                    page: body.page || 1,
                    pages: 1,
                    count: 2,
                    total: 2
                },
                search: {
                    query: query,
                    response_time_ms: 45,
                    collections: body.collections || [],
                    language: body.lang || 'en'
                }
            });

            res.writeHead(200);
            res.end(JSON.stringify(searchResults, null, 2));
            return;
        }

        // Ask endpoint
        if (path.match(/^\/v1\/ask\//) && method === 'POST') {
            const project = path.split('/')[3];
            const body = await getRequestBody(req);
            const question = body.q || '';

            const askResult = jsonApiResponse({
                type: 'answer',
                id: `answer-${Date.now()}`,
                attributes: {
                    text: `Based on your question "${question}", I can tell you that pixelcoda Search is a modern, AI-powered search platform designed for TYPO3. It combines traditional keyword search with vector search and provides AI-generated answers with proper source citations.`,
                    query: question,
                    language: body.lang || 'en',
                    generated_at: new Date().toISOString(),
                    confidence: 0.89,
                    search_method: 'demo'
                },
                relationships: {
                    citations: {
                        data: [{
                                type: 'citation',
                                id: 'citation-0'
                            },
                            {
                                type: 'citation',
                                id: 'citation-1'
                            }
                        ]
                    }
                }
            }, [{
                    type: 'citation',
                    id: 'citation-0',
                    attributes: {
                        title: 'pixelcoda Search Documentation',
                        url: '/docs',
                        snippet: 'pixelcoda Search is a modern, API-first search platform...',
                        collection: 'docs',
                        reference: '[1]'
                    }
                },
                {
                    type: 'citation',
                    id: 'citation-1',
                    attributes: {
                        title: 'TYPO3 Integration',
                        url: '/docs/typo3',
                        snippet: 'The platform supports both classic TYPO3 plugins and headless...',
                        collection: 'docs',
                        reference: '[2]'
                    }
                }
            ], {
                query: {
                    text: question,
                    language: body.lang || 'en',
                    max_passages: body.maxPassages || 6
                },
                generation: {
                    response_time_ms: 1200,
                    search_method: 'demo',
                    passages_found: 2,
                    passages_used: 2,
                    citations_count: 2
                }
            });

            res.writeHead(200);
            res.end(JSON.stringify(askResult, null, 2));
            return;
        }

        // Index endpoint (stub)
        if (path.match(/^\/v1\/index\//) && method === 'POST') {
            const body = await getRequestBody(req);

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                processed: body.documents ? .length || 0,
                message: 'Documents indexed successfully (demo mode)'
            }));
            return;
        }

        // 404 for other routes
        res.writeHead(404);
        res.end(JSON.stringify({
            errors: [{
                status: '404',
                title: 'Not Found',
                detail: `Route ${path} not found`
            }]
        }));

    } catch (error) {
        console.error('Request error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
            errors: [{
                status: '500',
                title: 'Internal Server Error',
                detail: error.message
            }]
        }));
    }
});

// Helper to read request body
function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

// Start server
server.listen(PORT, () => {
    console.log(`🚀 pixelcoda Search API running on http://localhost:${PORT}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   GET  /health`);
    console.log(`   POST /v1/search/:project`);
    console.log(`   POST /v1/ask/:project`);
    console.log(`   POST /v1/index/:project/:collection`);
    console.log(``);
    console.log(`🧪 Test with:`);
    console.log(`   curl http://localhost:${PORT}/health`);
    console.log(`   curl -X POST http://localhost:${PORT}/v1/search/demo -H "Content-Type: application/json" -d '{"q":"test"}'`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down pixelcoda Search API');
    server.close();
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down pixelcoda Search API');
    server.close();
    process.exit(0);
});