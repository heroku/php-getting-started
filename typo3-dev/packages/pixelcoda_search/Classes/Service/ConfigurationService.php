<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Service;

use TYPO3\CMS\Core\Configuration\ExtensionConfiguration;
use TYPO3\CMS\Core\Service\FlexFormService;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Frontend\ContentObject\ContentObjectRenderer;

/**
 * Configuration Service - handles plugin settings and FlexForm data.
 */
class ConfigurationService
{
    public $config;

    protected ExtensionConfiguration $extensionConfiguration;

    protected FlexFormService $flexFormService;

    public function __construct(
        ?ExtensionConfiguration $extensionConfiguration = null,
        ?FlexFormService $flexFormService = null
    ) {
        $this->extensionConfiguration = $extensionConfiguration ?? GeneralUtility::makeInstance(ExtensionConfiguration::class);
        $this->flexFormService = $flexFormService ?? GeneralUtility::makeInstance(FlexFormService::class);
    }

    /**
     * Get merged plugin settings (TypoScript + FlexForm + Extension Config).
     */
    public function getPluginSettings(array $typoScriptSettings = []): array
    {
        // Start with extension configuration
        $settings = $this->extensionConfiguration->get('pixelcoda_search') ?? [];

        // Merge with TypoScript settings
        $settings = array_merge($settings, $typoScriptSettings);

        // Get FlexForm data if available
        $contentObject = $this->getContentObjectRenderer();
        if ($contentObject && !empty($contentObject->data['pi_flexform'])) {
            $flexFormData = $this->flexFormService->convertFlexFormContentToArray($contentObject->data['pi_flexform']);
            $settings = array_merge($settings, $this->normalizeFlexFormData($flexFormData));
        }

        // Apply defaults
        return array_merge($this->getDefaultSettings(), $settings);
    }

    /**
     * Get API configuration for frontend JavaScript.
     */
    public function getApiConfigForFrontend(): array
    {
        return [
            'apiUrl' => $this->config['api_url'] ?? '',
            'projectId' => $this->config['project_id'] ?? 'typo3',
            // Note: Don't expose write API key to frontend!
            'readApiKey' => $this->config['read_api_key'] ?? '',
            'enableMetrics' => $this->config['enable_metrics'] ?? true,
            'debugMode' => $this->config['debug_mode'] ?? false,
        ];
    }

    /**
     * Validate configuration.
     */
    public function validateConfiguration(): array
    {
        $errors = [];
        $warnings = [];

        if (empty($this->config['api_url'])) {
            $errors[] = 'API URL is not configured';
        }

        if (empty($this->config['api_key'])) {
            $errors[] = 'API key is not configured';
        }

        if (empty($this->config['project_id'])) {
            $warnings[] = 'Project ID not set, using default';
        }

        if (empty($this->config['hmac_secret'])) {
            $warnings[] = 'HMAC secret not set, webhook verification disabled';
        }

        return [
            'valid' => [] === $errors,
            'errors' => $errors,
            'warnings' => $warnings,
        ];
    }

    /**
     * Get available templates.
     */
    public function getAvailableTemplates(): array
    {
        return [
            'Default' => 'Standard Template',
            'Minimal' => 'Minimales Template',
            'Advanced' => 'Erweiterte Ansicht',
            'Cards' => 'Karten-Layout',
        ];
    }

    /**
     * Get available collections.
     */
    public function getAvailableCollections(): array
    {
        return [
            'pages' => 'Seiten',
            'news' => 'News',
            'tt_content' => 'Inhaltselemente',
        ];
    }

    /**
     * Get default plugin settings.
     */
    protected function getDefaultSettings(): array
    {
        return [
            'mode' => 'classic', // classic|headless
            'resultsPerPage' => 10,
            'maxPassages' => 6,
            'enableSuggestions' => true,
            'enableAsk' => true,
            'showDebug' => false,
            'enableMetrics' => true,
            'collections' => ['pages', 'news'],
            'placeholder' => 'Website durchsuchen...',
            'noResultsText' => 'Keine Ergebnisse gefunden.',
            'searchButtonText' => 'Suchen',
            'askButtonText' => 'Fragen',
            'loadingText' => 'Lädt...',
            'errorText' => 'Ein Fehler ist aufgetreten.',
            'template' => 'Default',
            'cssClass' => 'pixelcoda-search',
            'enableAutoComplete' => true,
            'minQueryLength' => 2,
            'debounceMs' => 300,
        ];
    }

    /**
     * Normalize FlexForm data structure.
     */
    protected function normalizeFlexFormData(array $flexFormData): array
    {
        $normalized = [];

        // Map FlexForm fields to settings
        $fieldMapping = [
            'settings.mode' => 'mode',
            'settings.resultsPerPage' => 'resultsPerPage',
            'settings.maxPassages' => 'maxPassages',
            'settings.enableSuggestions' => 'enableSuggestions',
            'settings.enableAsk' => 'enableAsk',
            'settings.showDebug' => 'showDebug',
            'settings.collections' => 'collections',
            'settings.placeholder' => 'placeholder',
            'settings.template' => 'template',
            'settings.cssClass' => 'cssClass',
        ];

        foreach ($fieldMapping as $flexFormKey => $settingKey) {
            $value = $this->getFlexFormValue($flexFormData, $flexFormKey);
            if (null !== $value) {
                $normalized[$settingKey] = $value;
            }
        }

        // Handle special cases
        if (isset($normalized['collections']) && is_string($normalized['collections'])) {
            $normalized['collections'] = GeneralUtility::trimExplode(',', $normalized['collections'], true);
        }

        // Convert string booleans
        $booleanFields = ['enableSuggestions', 'enableAsk', 'showDebug', 'enableMetrics'];
        foreach ($booleanFields as $field) {
            if (isset($normalized[$field])) {
                $normalized[$field] = (bool) $normalized[$field];
            }
        }

        // Convert numeric fields
        $numericFields = ['resultsPerPage', 'maxPassages', 'minQueryLength', 'debounceMs'];
        foreach ($numericFields as $field) {
            if (isset($normalized[$field])) {
                $normalized[$field] = (int) $normalized[$field];
            }
        }

        return $normalized;
    }

    /**
     * Get value from FlexForm data structure.
     */
    protected function getFlexFormValue(array $flexFormData, string $key): mixed
    {
        $keys = explode('.', $key);
        $current = $flexFormData;

        foreach ($keys as $keyPart) {
            if (!is_array($current) || !isset($current[$keyPart])) {
                return null;
            }

            $current = $current[$keyPart];
        }

        return $current;
    }

    /**
     * Get content object renderer.
     */
    protected function getContentObjectRenderer(): ?ContentObjectRenderer
    {
        return $GLOBALS['TSFE']->cObj ?? null;
    }
}
