<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Controller\Api;

use Exception;
use PDO;
use PixelCoda\PixelcodaSearch\Service\ConfigurationService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Http\JsonResponse;
use TYPO3\CMS\Core\Service\FlexFormService;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * API Controller for pixelcoda Search Plugin Configuration.
 *
 * Provides plugin configuration data for frontend applications
 */
class PluginConfigController
{
    protected ConfigurationService $configurationService;

    protected FlexFormService $flexFormService;

    protected ConnectionPool $connectionPool;

    public function __construct(
        ?ConfigurationService $configurationService = null,
        ?FlexFormService $flexFormService = null,
        ?ConnectionPool $connectionPool = null
    ) {
        $this->configurationService = $configurationService ?? GeneralUtility::makeInstance(ConfigurationService::class);
        $this->flexFormService = $flexFormService ?? GeneralUtility::makeInstance(FlexFormService::class);
        $this->connectionPool = $connectionPool ?? GeneralUtility::makeInstance(ConnectionPool::class);
    }

    /**
     * Get plugin configuration for a specific content element.
     *
     * Route: GET /api/pixelcoda/search/config/{contentElementId}
     */
    public function getPluginConfig(ServerRequestInterface $request): ResponseInterface
    {
        // Set CORS headers
        $headers = [
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, X-Requested-With',
            'Content-Type' => 'application/json',
        ];

        // Handle preflight OPTIONS request
        if ('OPTIONS' === $request->getMethod()) {
            return new JsonResponse(null, 200, $headers);
        }

        try {
            // Get content element ID from route
            $contentElementId = (int) ($request->getAttribute('routing')->getArgument('contentElementId') ?? 0);

            if ($contentElementId <= 0) {
                return new JsonResponse([
                    'error' => 'Invalid content element ID',
                ], 400, $headers);
            }

            // Get content element from database
            $contentElement = $this->getContentElement($contentElementId);

            if (!$contentElement) {
                return new JsonResponse([
                    'error' => 'Content element not found',
                ], 404, $headers);
            }

            // Check if it's a pixelcoda search plugin
            if (!$this->isPixelcodaSearchPlugin($contentElement)) {
                return new JsonResponse([
                    'error' => 'Content element is not a pixelcoda Search plugin',
                ], 400, $headers);
            }

            // Parse FlexForm data
            $flexFormData = [];
            if (!empty($contentElement['pi_flexform'])) {
                $flexFormData = $this->flexFormService->convertFlexFormContentToArray(
                    $contentElement['pi_flexform']
                );
            }

            // Get plugin settings
            $settings = $this->configurationService->getPluginSettings();

            // Merge with FlexForm settings
            if (isset($flexFormData['settings'])) {
                $settings = array_merge($settings, $flexFormData['settings']);
            }

            // Build response data
            $responseData = [
                'data' => [
                    'type' => 'pixelcodasearch_config',
                    'id' => (string) $contentElementId,
                    'attributes' => [
                        'pluginType' => 'pixelcodasearch_search',
                        'pluginName' => 'pixelcoda Search',
                        'mode' => $settings['mode'] ?? 'headless',
                        'config' => [
                            'apiUrl' => $settings['api_url'] ?? 'http://localhost:8787',
                            'projectId' => $settings['project_id'] ?? 'typo3',
                            'collections' => $this->parseCollections($settings['collections'] ?? 'pages,news'),
                            'resultsPerPage' => (int) ($settings['resultsPerPage'] ?? 10),
                            'enableSuggestions' => (bool) ($settings['enableSuggestions'] ?? true),
                            'enableAsk' => (bool) ($settings['enableAsk'] ?? true),
                            'placeholder' => $settings['placeholder'] ?? 'Website durchsuchen...',
                            'template' => $settings['template'] ?? 'Default',
                            'cssClass' => $settings['cssClass'] ?? 'pixelcoda-search',
                            'minQueryLength' => (int) ($settings['minQueryLength'] ?? 2),
                            'debounceMs' => (int) ($settings['debounceMs'] ?? 300),
                        ],
                        'endpoints' => [
                            'search' => '/api/pixelcoda/search',
                            'ask' => '/api/pixelcoda/ask',
                            'suggest' => '/api/pixelcoda/suggest',
                            'config' => '/api/pixelcoda/search/config/' . $contentElementId,
                        ],
                        'form' => [
                            'method' => 'POST',
                            'action' => '/api/pixelcoda/search',
                            'fields' => [
                                'query' => [
                                    'type' => 'text',
                                    'name' => 'q',
                                    'placeholder' => $settings['placeholder'] ?? 'Website durchsuchen...',
                                    'required' => true,
                                    'minLength' => (int) ($settings['minQueryLength'] ?? 2),
                                ],
                                'collections' => [
                                    'type' => 'hidden',
                                    'name' => 'collections',
                                    'value' => $settings['collections'] ?? 'pages,news',
                                ],
                            ],
                        ],
                        'ui' => [
                            'showSuggestions' => (bool) ($settings['enableSuggestions'] ?? true),
                            'showAsk' => (bool) ($settings['enableAsk'] ?? true),
                            'showDebug' => (bool) ($settings['showDebug'] ?? false),
                            'template' => $settings['template'] ?? 'Default',
                        ],
                    ],
                ],
                'meta' => [
                    'contentElementId' => $contentElementId,
                    'timestamp' => time(),
                    'version' => '2.0',
                ],
            ];

            return new JsonResponse($responseData, 200, $headers);

        } catch (Exception $exception) {
            return new JsonResponse([
                'error' => 'Failed to get plugin configuration',
                'message' => $exception->getMessage(),
            ], 500, $headers);
        }
    }

    /**
     * Get content element from database.
     */
    private function getContentElement(int $uid): ?array
    {
        $queryBuilder = $this->connectionPool->getQueryBuilderForTable('tt_content');

        $result = $queryBuilder
            ->select('*')
            ->from('tt_content')
            ->where(
                $queryBuilder->expr()->eq('uid', $queryBuilder->createNamedParameter($uid, PDO::PARAM_INT)),
                $queryBuilder->expr()->eq('deleted', 0),
                $queryBuilder->expr()->eq('hidden', 0)
            )
            ->executeQuery()
            ->fetchAssociative();

        return $result ?: null;
    }

    /**
     * Check if content element is a pixelcoda search plugin.
     */
    private function isPixelcodaSearchPlugin(array $contentElement): bool
    {
        // Only check for Content Element type (not list_type plugin anymore)
        return 'pixelcodasearch_search' === $contentElement['CType'];
    }

    /**
     * Parse collections string into array.
     */
    private function parseCollections(string $collections): array
    {
        return array_map('trim', explode(',', $collections));
    }
}
