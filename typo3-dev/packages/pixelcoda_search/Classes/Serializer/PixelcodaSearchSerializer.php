<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Serializer;

use FriendsOfTypo3\Headless\Json\JsonEncoder;
use PixelCoda\PixelcodaSearch\Service\ConfigurationService;
use TYPO3\CMS\Core\Service\FlexFormService;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * Custom serializer for pixelcoda Search plugin in Headless mode.
 */
class PixelcodaSearchSerializer
{
    protected ConfigurationService $configurationService;

    protected FlexFormService $flexFormService;

    protected JsonEncoder $encoder;

    public function __construct(
        JsonEncoder $encoder,
        ?ConfigurationService $configurationService = null,
        ?FlexFormService $flexFormService = null
    ) {
        $this->encoder = $encoder;
        $this->configurationService = $configurationService ?? GeneralUtility::makeInstance(ConfigurationService::class);
        $this->flexFormService = $flexFormService ?? GeneralUtility::makeInstance(FlexFormService::class);
    }

    /**
     * Serialize the pixelcoda Search plugin for JSON output
     * This method is called by the Headless extension for each content element.
     */
    public function serialize(array $contentElement, array $context = []): array
    {
        // Create basic structure
        $data = [
            'id' => (int) $contentElement['uid'],
            'type' => $contentElement['CType'],
            'colPos' => (int) $contentElement['colPos'],
            'categories' => $contentElement['categories'] ?? '',
            'appearance' => [
                'layout' => $contentElement['layout'] ?? 'default',
                'frameClass' => $contentElement['frame_class'] ?? 'default',
                'spaceBefore' => $contentElement['space_before_class'] ?? '',
                'spaceAfter' => $contentElement['space_after_class'] ?? '',
            ],
        ];

        // Add standard content fields
        $data['content'] = [
            'header' => $contentElement['header'] ?? '',
            'subheader' => $contentElement['subheader'] ?? '',
            'headerLayout' => (int) ($contentElement['header_layout'] ?? 0),
            'headerPosition' => $contentElement['header_position'] ?? '',
            'headerLink' => $contentElement['header_link'] ?? '',
            'pluginType' => 'pixelcodasearch_search',
            'pluginName' => 'pixelcoda Search',
        ];

        // Parse FlexForm data
        $flexFormData = [];
        if (!empty($contentElement['pi_flexform'])) {
            $flexFormData = $this->flexFormService->convertFlexFormContentToArray($contentElement['pi_flexform']);
        }

        // Get plugin settings
        $settings = $this->configurationService->getPluginSettings();

        // Merge with FlexForm settings
        if (isset($flexFormData['settings'])) {
            $settings = array_merge($settings, $flexFormData['settings']);
        }

        // Add debug information if enabled
        $debugInfo = [];
        if (($settings['showDebug'] ?? false) || ($_GET['debug'] ?? false)) {
            $debugInfo = [
                'contentElement' => array_keys($contentElement),
                'flexFormData' => $flexFormData,
                'mergedSettings' => $settings,
                'hasFlexForm' => !empty($contentElement['pi_flexform']),
            ];
        }

        // Add search configuration to JSON
        $data['content']['searchConfig'] = [
            'mode' => $settings['mode'] ?? 'headless',
            'apiUrl' => $settings['api_url'] ?? '',
            'projectId' => $settings['project_id'] ?? '',
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

        // Add API endpoints
        $data['content']['endpoints'] = [
            'search' => '/api/search',
            'ask' => '/api/ask',
            'suggest' => '/api/suggest',
        ];

        // Add form configuration
        $data['content']['form'] = [
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
        $data['content']['ui'] = [
            'showSuggestions' => (bool) ($settings['enableSuggestions'] ?? true),
            'showAsk' => (bool) ($settings['enableAsk'] ?? true),
            'showDebug' => (bool) ($settings['showDebug'] ?? false),
            'template' => $settings['template'] ?? 'Default',
        ];

        // Add debug information if available
        if ([] !== $debugInfo) {
            $data['content']['debug'] = $debugInfo;
        }

        return $data;
    }

    /**
     * Parse collections string into array.
     */
    private function parseCollections(string $collections): array
    {
        return array_map('trim', explode(',', $collections));
    }
}
