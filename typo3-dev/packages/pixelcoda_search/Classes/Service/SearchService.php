<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Service;

use Exception;
use RuntimeException;
use TYPO3\CMS\Core\Configuration\ExtensionConfiguration;
use TYPO3\CMS\Core\Http\RequestFactory;
use TYPO3\CMS\Core\Log\Logger;
use TYPO3\CMS\Core\Log\LogManager;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * Search Service - communicates with pixelcoda Search API.
 */
class SearchService
{
    protected RequestFactory $requestFactory;

    protected Logger $logger;

    protected array $config;

    public function __construct(
        ?RequestFactory $requestFactory = null,
        ?ExtensionConfiguration $extensionConfiguration = null
    ) {
        $this->requestFactory = $requestFactory ?? GeneralUtility::makeInstance(RequestFactory::class);
        $this->logger = GeneralUtility::makeInstance(LogManager::class)->getLogger(self::class);

        $extConfig = $extensionConfiguration ?? GeneralUtility::makeInstance(ExtensionConfiguration::class);
        $this->config = $extConfig->get('pixelcoda_search') ?? [];
    }

    /**
     * Perform search via API.
     */
    public function search(array $params): array
    {
        $apiUrl = rtrim($this->config['api_url'] ?? '', '/');
        $projectId = $this->config['project_id'] ?? 'typo3';
        $apiKey = $this->config['api_key'] ?? '';

        if ('' === $apiUrl || '0' === $apiUrl || empty($apiKey)) {
            throw new RuntimeException('pixelcoda Search API not configured');
        }

        $url = sprintf('%s/v1/search/%s', $apiUrl, $projectId);

        $requestOptions = [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-API-Key' => $apiKey,
                'Accept' => 'application/vnd.api+json',
                'User-Agent' => 'TYPO3-pixelcoda-Search/2.0',
            ],
            'body' => json_encode($params),
            'timeout' => $this->config['timeout'] ?? 30,
        ];

        try {
            $response = $this->requestFactory->request($url, 'POST', $requestOptions);

            if (200 !== $response->getStatusCode()) {
                throw new RuntimeException(
                    sprintf('Search API returned status %s: ', $response->getStatusCode())
                    . $response->getBody()->getContents()
                );
            }

            $result = json_decode((string) $response->getBody()->getContents(), true);

            if (!$result) {
                throw new RuntimeException('Invalid JSON response from Search API');
            }

            $this->logger->info('Search completed', [
                'query' => $params['q'],
                'results' => count($result['data'] ?? []),
                'response_time' => $result['meta']['search']['response_time_ms'] ?? 0,
            ]);

            return $result;

        } catch (Exception $exception) {
            $this->logger->error('Search API error', [
                'query' => $params['q'],
                'error' => $exception->getMessage(),
                'url' => $url,
            ]);

            throw $exception;
        }
    }

    /**
     * Ask AI-powered question via API.
     */
    public function ask(array $params): array
    {
        $apiUrl = rtrim($this->config['api_url'] ?? '', '/');
        $projectId = $this->config['project_id'] ?? 'typo3';
        $apiKey = $this->config['api_key'] ?? '';

        if ('' === $apiUrl || '0' === $apiUrl || empty($apiKey)) {
            throw new RuntimeException('pixelcoda Search API not configured');
        }

        $url = sprintf('%s/v1/ask/%s', $apiUrl, $projectId);

        $requestOptions = [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-API-Key' => $apiKey,
                'Accept' => 'application/vnd.api+json',
                'User-Agent' => 'TYPO3-pixelcoda-Search/2.0',
            ],
            'body' => json_encode($params),
            'timeout' => ($this->config['timeout'] ?? 30) * 2, // Longer timeout for AI
        ];

        try {
            $response = $this->requestFactory->request($url, 'POST', $requestOptions);

            if (200 !== $response->getStatusCode()) {
                throw new RuntimeException(
                    sprintf('Ask API returned status %s: ', $response->getStatusCode())
                    . $response->getBody()->getContents()
                );
            }

            $result = json_decode((string) $response->getBody()->getContents(), true);

            if (!$result) {
                throw new RuntimeException('Invalid JSON response from Ask API');
            }

            $this->logger->info('Ask completed', [
                'question' => $params['q'],
                'citations' => count($result['included'] ?? []),
                'response_time' => $result['meta']['generation']['response_time_ms'] ?? 0,
            ]);

            return $result;

        } catch (Exception $exception) {
            $this->logger->error('Ask API error', [
                'question' => $params['q'],
                'error' => $exception->getMessage(),
                'url' => $url,
            ]);

            throw $exception;
        }
    }

    /**
     * Get search suggestions via API.
     */
    public function suggest(array $params): array
    {
        $apiUrl = rtrim($this->config['api_url'] ?? '', '/');
        $projectId = $this->config['project_id'] ?? 'typo3';
        $apiKey = $this->config['api_key'] ?? '';

        if ('' === $apiUrl || '0' === $apiUrl || empty($apiKey)) {
            return ['data' => []]; // Return empty suggestions if not configured
        }

        $url = sprintf('%s/v1/suggest/%s', $apiUrl, $projectId);

        $requestOptions = [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-API-Key' => $apiKey,
                'Accept' => 'application/vnd.api+json',
                'User-Agent' => 'TYPO3-pixelcoda-Search/2.0',
            ],
            'body' => json_encode($params),
            'timeout' => 10, // Short timeout for suggestions
        ];

        try {
            $response = $this->requestFactory->request($url, 'POST', $requestOptions);

            if (200 !== $response->getStatusCode()) {
                return ['data' => []]; // Return empty on error
            }

            $result = json_decode((string) $response->getBody()->getContents(), true);

            return $result ?? ['data' => []];

        } catch (Exception $exception) {
            $this->logger->warning('Suggest API error', [
                'query' => $params['q'] ?? '',
                'error' => $exception->getMessage(),
            ]);

            return ['data' => []];
        }
    }

    /**
     * Log click metrics.
     */
    public function logClick(string $query, string $documentId, int $position, ?string $url = null): void
    {
        if (!($this->config['enable_metrics'] ?? true)) {
            return;
        }

        $apiUrl = rtrim($this->config['api_url'] ?? '', '/');
        $projectId = $this->config['project_id'] ?? 'typo3';
        $apiKey = $this->config['api_key'] ?? '';

        if ('' === $apiUrl || '0' === $apiUrl || empty($apiKey)) {
            return;
        }

        $metricsUrl = sprintf('%s/v1/metrics/click/%s', $apiUrl, $projectId);

        $requestOptions = [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-API-Key' => $apiKey,
                'User-Agent' => 'TYPO3-pixelcoda-Search/2.0',
            ],
            'body' => json_encode([
                'query' => $query,
                'document_id' => $documentId,
                'position' => $position,
                'url' => $url,
            ]),
            'timeout' => 5,
        ];

        try {
            $this->requestFactory->request($metricsUrl, 'POST', $requestOptions);
        } catch (Exception $exception) {
            $this->logger->warning('Failed to log click metrics', [
                'error' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * Check API health.
     */
    public function checkApiHealth(): array
    {
        $apiUrl = rtrim($this->config['api_url'] ?? '', '/');

        if ('' === $apiUrl || '0' === $apiUrl) {
            return ['status' => 'not_configured', 'message' => 'API URL not configured'];
        }

        try {
            $response = $this->requestFactory->request($apiUrl . '/health', 'GET', [
                'timeout' => 5,
            ]);

            if (200 === $response->getStatusCode()) {
                return ['status' => 'healthy', 'message' => 'API is responding'];
            }

            return ['status' => 'unhealthy', 'message' => 'API returned status ' . $response->getStatusCode()];

        } catch (Exception $exception) {
            return ['status' => 'error', 'message' => $exception->getMessage()];
        }
    }

    /**
     * Get search suggestions.
     */
    public function getSuggestions(string $query, int $limit = 5, string $collections = 'pages,tt_content'): array
    {
        $params = [
            'q' => $query,
            'limit' => $limit,
            'collections' => explode(',', $collections),
        ];

        $result = $this->suggest($params);

        return $result['data'] ?? [];
    }

    /**
     * Index a single record.
     */
    public function indexRecord(string $table, int $id, string $action = 'update', bool $force = false): bool
    {
        // This is a placeholder - actual implementation would extract record data
        // and send it to the indexing API
        $this->logger->info('Indexing record', [
            'table' => $table,
            'id' => $id,
            'action' => $action,
            'force' => $force,
        ]);

        // For now, just return true to avoid errors
        // TODO: Implement actual record indexing
        return true;
    }

    /**
     * Delete a record from the search index.
     */
    public function deleteRecord(string $table, int $id): bool
    {
        // This is a placeholder - actual implementation would call delete API
        $this->logger->info('Deleting record from index', [
            'table' => $table,
            'id' => $id,
        ]);

        // For now, just return true to avoid errors
        // TODO: Implement actual record deletion
        return true;
    }

    /**
     * Index all records from a table.
     */
    public function indexTable(string $table, bool $force = false): int
    {
        // This is a placeholder - actual implementation would fetch all records
        // and index them
        $this->logger->info('Indexing table', [
            'table' => $table,
            'force' => $force,
        ]);

        // For now, just return 0 to avoid errors
        // TODO: Implement actual table indexing
        return 0;
    }

    /**
     * Get record count for a table.
     */
    public function getTableRecordCount(string $table): int
    {
        // This is a placeholder - actual implementation would count records
        $this->logger->info('Getting table record count', [
            'table' => $table,
        ]);

        // For now, just return 0 to avoid errors
        // TODO: Implement actual record counting
        return 0;
    }

    /**
     * Clear index for a specific table.
     */
    public function clearTableIndex(string $table): bool
    {
        // This is a placeholder - actual implementation would clear table index
        $this->logger->info('Clearing table index', [
            'table' => $table,
        ]);

        // For now, just return true to avoid errors
        // TODO: Implement actual index clearing
        return true;
    }

    /**
     * Clear all indexes.
     */
    public function clearAllIndexes(): bool
    {
        // This is a placeholder - actual implementation would clear all indexes
        $this->logger->info('Clearing all indexes');

        // For now, just return true to avoid errors
        // TODO: Implement actual index clearing
        return true;
    }

    /**
     * Get index statistics.
     */
    public function getIndexStatistics(): ?array
    {
        // This is a placeholder - actual implementation would get stats from API
        $this->logger->info('Getting index statistics');

        // For now, just return null to avoid errors
        // TODO: Implement actual statistics retrieval
        return null;
    }
}
