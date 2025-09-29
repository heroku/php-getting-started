<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\DataProcessing;

use PixelCoda\PixelcodaSearch\Service\ConfigurationService;
use TYPO3\CMS\Core\Service\FlexFormService;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Frontend\ContentObject\ContentObjectRenderer;
use TYPO3\CMS\Frontend\ContentObject\DataProcessorInterface;

/**
 * DataProcessor for adding pixelcoda Search configuration to content elements.
 */
class SearchConfigProcessor implements DataProcessorInterface
{
    protected ConfigurationService $configurationService;

    protected FlexFormService $flexFormService;

    public function __construct(
        ?ConfigurationService $configurationService = null,
        ?FlexFormService $flexFormService = null
    ) {
        $this->configurationService = $configurationService ?? GeneralUtility::makeInstance(ConfigurationService::class);
        $this->flexFormService = $flexFormService ?? GeneralUtility::makeInstance(FlexFormService::class);
    }

    /**
     * Process content element data and add search configuration.
     */
    public function process(
        ContentObjectRenderer $cObj,
        array $contentObjectConfiguration,
        array $processorConfiguration,
        array $processedData
    ): array {

        // Only process if this is a pixelcoda search content element
        if ('pixelcodasearch_search' !== $processedData['data']['CType']) {
            return $processedData;
        }

        // Parse FlexForm data
        $flexFormData = [];
        if (!empty($processedData['data']['pi_flexform'])) {
            $flexFormData = $this->flexFormService->convertFlexFormContentToArray(
                $processedData['data']['pi_flexform']
            );
        }

        // Get plugin settings
        $settings = $this->configurationService->getPluginSettings();

        // Merge with FlexForm settings
        if (isset($flexFormData['settings'])) {
            $settings = array_merge($settings, $flexFormData['settings']);
        }

        // Add search configuration directly to processed data
        $processedData['searchConfig'] = [
            'pluginType' => 'pixelcodasearch_search',
            'pluginName' => 'pixelcoda Search',
            'mode' => $settings['mode'] ?? 'headless',
            'apiUrl' => $settings['api_url'] ?? 'http://localhost:8787',
            'projectId' => $settings['project_id'] ?? 'typo3',
            'collections' => $this->parseCollections($settings['collections'] ?? 'pages,news'),
            'resultsPerPage' => (int) ($settings['resultsPerPage'] ?? 10),
            'maxPassages' => (int) ($settings['maxPassages'] ?? 6),
            'enableSuggestions' => (bool) ($settings['enableSuggestions'] ?? true),
            'enableAsk' => (bool) ($settings['enableAsk'] ?? true),
            'enableMetrics' => (bool) ($settings['enableMetrics'] ?? true),
            'showDebug' => (bool) ($settings['showDebug'] ?? false),
            'placeholder' => $settings['placeholder'] ?? 'Website durchsuchen...',
            'template' => $settings['template'] ?? 'Default',
            'cssClass' => $settings['cssClass'] ?? 'pixelcoda-search',
            'minQueryLength' => (int) ($settings['minQueryLength'] ?? 2),
            'debounceMs' => (int) ($settings['debounceMs'] ?? 300),
        ];

        // Also add individual fields for TypoScript access
        foreach ($processedData['searchConfig'] as $key => $value) {
            $processedData[$key] = $value;
        }

        // Add API endpoints
        $processedData['endpoints'] = [
            'search' => '/api/search',
            'ask' => '/api/ask',
            'suggest' => '/api/suggest',
        ];

        // Add form configuration
        $processedData['form'] = [
            'method' => 'POST',
            'action' => '/api/search',
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
        ];

        // Add UI configuration
        $processedData['ui'] = [
            'showSuggestions' => (bool) ($settings['enableSuggestions'] ?? true),
            'showAsk' => (bool) ($settings['enableAsk'] ?? true),
            'showDebug' => (bool) ($settings['showDebug'] ?? false),
            'template' => $settings['template'] ?? 'Default',
        ];

        return $processedData;
    }

    /**
     * Parse collections string into array.
     */
    private function parseCollections(string $collections): array
    {
        return array_map('trim', explode(',', $collections));
    }
}
