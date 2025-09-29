<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Controller\Api;

use Psr\Http\Message\ResponseInterface;
use TYPO3\CMS\Core\Http\JsonResponse;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Extbase\Mvc\Controller\ActionController;
use TYPO3\CMS\Core\Database\ConnectionPool;
use PixelCoda\PixelcodaSearch\Service\SearchService;

/**
 * Headless API Controller for JSON:API 1.0 compatible search responses
 * Compatible with nuxt-typo3 and TYPO3-Headless
 */
class HeadlessSearchController extends ActionController
{
    private SearchService $searchService;

    public function __construct(SearchService $searchService)
    {
        $this->searchService = $searchService;
    }

    /**
     * JSON:API 1.0 compatible search endpoint
     * GET /api/v1/search?q=query&page[number]=1&page[size]=10
     */
    public function searchAction(): ResponseInterface
    {
        $request = $this->request;
        $params = $request->getQueryParams();
        
        // Extract JSON:API parameters
        $query = trim($params['q'] ?? '');
        $page = (int)($params['page']['number'] ?? $params['page'] ?? 1);
        $limit = (int)($params['page']['size'] ?? $params['limit'] ?? 10);
        $collections = $params['collections'] ?? [];
        $lang = $params['lang'] ?? 'de';
        
        // Validate parameters
        if (empty($query) || strlen($query) < 2) {
            return $this->createJsonApiError(400, 'Query parameter "q" is required and must be at least 2 characters');
        }
        
        if ($limit > 100) {
            $limit = 100; // Cap at 100 results per page
        }
        
        $startTime = microtime(true);
        
        try {
            // Perform search using the search service
            $searchResults = $this->searchService->search($query, [
                'page' => $page,
                'limit' => $limit,
                'collections' => $collections,
                'lang' => $lang
            ]);
            
            $responseTime = round((microtime(true) - $startTime) * 1000);
            
            // Transform results to JSON:API format
            $jsonApiResponse = $this->transformToJsonApi($searchResults, [
                'query' => $query,
                'page' => $page,
                'limit' => $limit,
                'responseTime' => $responseTime,
                'collections' => $collections,
                'lang' => $lang
            ]);
            
            return new JsonResponse($jsonApiResponse);
            
        } catch (\Exception $e) {
            return $this->createJsonApiError(500, 'Search failed: ' . $e->getMessage());
        }
    }

    /**
     * JSON:API compatible suggestions endpoint
     * GET /api/v1/suggest?q=query&limit=5
     */
    public function suggestAction(): ResponseInterface
    {
        $params = $this->request->getQueryParams();
        $query = trim($params['q'] ?? '');
        $limit = (int)($params['limit'] ?? 5);
        
        if (empty($query) || strlen($query) < 2) {
            return $this->createJsonApiError(400, 'Query parameter "q" is required and must be at least 2 characters');
        }
        
        try {
            $suggestions = $this->searchService->getSuggestions($query, $limit);
            
            $jsonApiResponse = [
                'data' => array_map(fn($suggestion, $index) => [
                    'type' => 'suggestion',
                    'id' => "suggestion-{$index}",
                    'attributes' => [
                        'text' => $suggestion['title'],
                        'url' => $suggestion['url'],
                        'type' => $suggestion['type'],
                        'subtitle' => $suggestion['subtitle'] ?? null
                    ]
                ], $suggestions, array_keys($suggestions)),
                'meta' => [
                    'query' => $query,
                    'total' => count($suggestions),
                    'generated_at' => date('c')
                ],
                'jsonapi' => ['version' => '1.0']
            ];
            
            return new JsonResponse($jsonApiResponse);
            
        } catch (\Exception $e) {
            return $this->createJsonApiError(500, 'Suggestions failed: ' . $e->getMessage());
        }
    }

    /**
     * AI-powered ask endpoint for RAG functionality
     * POST /api/v1/ask
     */
    public function askAction(): ResponseInterface
    {
        if ($this->request->getMethod() !== 'POST') {
            return $this->createJsonApiError(405, 'Method not allowed');
        }
        
        $body = json_decode($this->request->getBody()->getContents(), true);
        
        if (!$body || empty($body['q'])) {
            return $this->createJsonApiError(400, 'Request body must contain "q" parameter');
        }
        
        $query = trim($body['q']);
        $maxPassages = (int)($body['maxPassages'] ?? 6);
        $temperature = (float)($body['temperature'] ?? 0.7);
        $collections = $body['collections'] ?? [];
        $lang = $body['lang'] ?? 'de';
        
        try {
            // Call external Pixelcoda Search API for AI functionality
            $apiResponse = $this->callPixelcodaSearchAPI('/v1/ask/' . $this->getProjectId(), [
                'q' => $query,
                'maxPassages' => $maxPassages,
                'temperature' => $temperature,
                'collections' => $collections,
                'lang' => $lang
            ]);
            
            if (!$apiResponse) {
                return $this->createJsonApiError(503, 'AI service unavailable');
            }
            
            // Return the API response directly (already JSON:API formatted)
            return new JsonResponse($apiResponse);
            
        } catch (\Exception $e) {
            return $this->createJsonApiError(500, 'Ask failed: ' . $e->getMessage());
        }
    }

    /**
     * Get page content in JSON:API format for indexing
     * GET /api/v1/pages/{uid}
     */
    public function pageAction(): ResponseInterface
    {
        $uid = (int)$this->request->getAttribute('routing')->getArgument('uid');
        
        if ($uid <= 0) {
            return $this->createJsonApiError(400, 'Invalid page UID');
        }
        
        try {
            $pageData = $this->getPageForIndexing($uid);
            
            if (!$pageData) {
                return $this->createJsonApiError(404, 'Page not found');
            }
            
            $jsonApiResponse = [
                'data' => [
                    'type' => 'pages',
                    'id' => (string)$pageData['uid'],
                    'attributes' => [
                        'title' => $pageData['title'],
                        'slug' => $pageData['slug'],
                        'abstract' => $pageData['abstract'],
                        'description' => $pageData['description'],
                        'keywords' => $pageData['keywords'],
                        'content' => $pageData['content'],
                        'locale' => $pageData['sys_language_uid'] === 0 ? 'de' : 'en', // Simplified
                        'created_at' => date('c', $pageData['crdate']),
                        'updated_at' => date('c', $pageData['tstamp']),
                        'hidden' => (bool)$pageData['hidden'],
                        'fe_group' => $pageData['fe_group']
                    ],
                    'meta' => [
                        'pid' => $pageData['pid'],
                        'sys_language_uid' => $pageData['sys_language_uid'],
                        'boost' => $this->calculateBoost($pageData)
                    ]
                ],
                'jsonapi' => ['version' => '1.0']
            ];
            
            return new JsonResponse($jsonApiResponse);
            
        } catch (\Exception $e) {
            return $this->createJsonApiError(500, 'Failed to get page: ' . $e->getMessage());
        }
    }

    /**
     * Transform search results to JSON:API 1.0 format
     */
    private function transformToJsonApi(array $searchResults, array $meta): array
    {
        $data = [];
        
        foreach ($searchResults['hits'] as $index => $hit) {
            $data[] = [
                'type' => 'searchResult',
                'id' => $hit['uid'] ?? "result-{$index}",
                'attributes' => [
                    'title' => $hit['title'],
                    'abstract' => $hit['abstract'],
                    'url' => $hit['url'],
                    'page' => $hit['page'] ?? null,
                    'type' => $hit['type'] ?? 'page',
                    'content_type' => $hit['contentType'] ?? null,
                    'date' => $hit['date'] ? date('c', $hit['date']) : null,
                    'score' => $hit['score'] ?? null,
                    'categories' => $hit['categories'] ?? [],
                    'tags' => $hit['tags'] ?? []
                ],
                'meta' => [
                    'relevance' => $hit['score'] ?? 0,
                    'collection' => $hit['type'] ?? 'pages'
                ]
            ];
        }
        
        $totalResults = $searchResults['total'] ?? count($data);
        $totalPages = ceil($totalResults / $meta['limit']);
        
        return [
            'data' => $data,
            'meta' => [
                'pagination' => [
                    'page' => $meta['page'],
                    'pages' => $totalPages,
                    'count' => count($data),
                    'total' => $totalResults
                ],
                'search' => [
                    'query' => $meta['query'],
                    'response_time_ms' => $meta['responseTime'],
                    'collections' => $meta['collections'],
                    'language' => $meta['lang']
                ]
            ],
            'links' => $this->createPaginationLinks($meta, $totalPages),
            'jsonapi' => ['version' => '1.0']
        ];
    }

    /**
     * Create JSON:API pagination links
     */
    private function createPaginationLinks(array $meta, int $totalPages): array
    {
        $baseUrl = $this->request->getUri()->withQuery('')->withFragment('');
        $queryParams = http_build_query([
            'q' => $meta['query'],
            'page[size]' => $meta['limit']
        ]);
        
        $links = [
            'self' => $baseUrl . '?' . $queryParams . '&page[number]=' . $meta['page'],
            'first' => $baseUrl . '?' . $queryParams . '&page[number]=1',
            'last' => $baseUrl . '?' . $queryParams . '&page[number]=' . $totalPages
        ];
        
        if ($meta['page'] > 1) {
            $links['prev'] = $baseUrl . '?' . $queryParams . '&page[number]=' . ($meta['page'] - 1);
        }
        
        if ($meta['page'] < $totalPages) {
            $links['next'] = $baseUrl . '?' . $queryParams . '&page[number]=' . ($meta['page'] + 1);
        }
        
        return $links;
    }

    /**
     * Create JSON:API error response
     */
    private function createJsonApiError(int $status, string $detail): ResponseInterface
    {
        $error = [
            'errors' => [
                [
                    'status' => (string)$status,
                    'title' => $this->getStatusTitle($status),
                    'detail' => $detail
                ]
            ],
            'jsonapi' => ['version' => '1.0']
        ];
        
        return new JsonResponse($error, $status);
    }

    /**
     * Get page data for indexing
     */
    private function getPageForIndexing(int $uid): ?array
    {
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('pages');
            
        $page = $queryBuilder
            ->select('*')
            ->from('pages')
            ->where(
                $queryBuilder->expr()->eq('uid', $uid),
                $queryBuilder->expr()->eq('deleted', 0)
            )
            ->executeQuery()
            ->fetchAssociative();
            
        if (!$page) {
            return null;
        }
        
        // Get content elements for this page
        $contentBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('tt_content');
            
        $contentElements = $contentBuilder
            ->select('header', 'bodytext', 'CType')
            ->from('tt_content')
            ->where(
                $contentBuilder->expr()->eq('pid', $uid),
                $contentBuilder->expr()->eq('deleted', 0),
                $contentBuilder->expr()->eq('hidden', 0)
            )
            ->orderBy('sorting')
            ->executeQuery()
            ->fetchAllAssociative();
            
        // Combine content
        $content = '';
        foreach ($contentElements as $element) {
            if ($element['header']) {
                $content .= strip_tags($element['header']) . ' ';
            }
            if ($element['bodytext']) {
                $content .= strip_tags($element['bodytext']) . ' ';
            }
        }
        
        $page['content'] = trim($content);
        
        return $page;
    }

    /**
     * Call external Pixelcoda Search API
     */
    private function callPixelcodaSearchAPI(string $endpoint, array $data): ?array
    {
        $apiBase = $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search']['api_base'] ?? '';
        $apiKey = $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search']['api_key'] ?? '';
        
        if (empty($apiBase) || empty($apiKey)) {
            throw new \RuntimeException('Pixelcoda Search API not configured');
        }
        
        $url = rtrim($apiBase, '/') . $endpoint;
        
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $apiKey
                ],
                'content' => json_encode($data),
                'timeout' => 30
            ]
        ]);
        
        $response = file_get_contents($url, false, $context);
        
        if ($response === false) {
            return null;
        }
        
        return json_decode($response, true);
    }

    /**
     * Get project ID from configuration
     */
    private function getProjectId(): string
    {
        return $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search']['project_id'] ?? 'typo3-main';
    }

    /**
     * Calculate boost factor for content
     */
    private function calculateBoost(array $pageData): float
    {
        $boost = 1.0;
        
        // Boost based on page type
        if ($pageData['doktype'] == 1) { // Standard page
            $boost = 1.2;
        }
        
        // Boost if has good abstract
        if (!empty($pageData['abstract']) && strlen($pageData['abstract']) > 100) {
            $boost += 0.1;
        }
        
        // Boost if not hidden and public
        if (!$pageData['hidden'] && $pageData['fe_group'] === '0') {
            $boost += 0.1;
        }
        
        // Boost recent content
        $daysSinceUpdate = (time() - $pageData['tstamp']) / (24 * 60 * 60);
        if ($daysSinceUpdate < 30) {
            $boost += 0.2;
        }
        
        return min($boost, 2.0);
    }

    /**
     * Get HTTP status title
     */
    private function getStatusTitle(int $status): string
    {
        $titles = [
            400 => 'Bad Request',
            404 => 'Not Found',
            405 => 'Method Not Allowed',
            500 => 'Internal Server Error',
            503 => 'Service Unavailable'
        ];
        
        return $titles[$status] ?? 'Error';
    }
}
