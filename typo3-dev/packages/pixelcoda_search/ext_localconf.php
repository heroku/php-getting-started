<?php

declare(strict_types=1);

use PixelCoda\PixelcodaSearch\Controller\Api\PluginConfigController;
use PixelCoda\PixelcodaSearch\Controller\SearchController;
use PixelCoda\PixelcodaSearch\Eid\SuggestEid;
use TYPO3\CMS\Core\Imaging\IconProvider\SvgIconProvider;
use TYPO3\CMS\Core\Imaging\IconRegistry;
use TYPO3\CMS\Core\Utility\ExtensionManagementUtility;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Extbase\Utility\ExtensionUtility;

defined('TYPO3') || exit();

// ExtensionUtility removed - not needed anymore

// Register DataHandler hooks for automatic indexing (temporarily disabled due to signature issues)
// $GLOBALS['TYPO3_CONF_VARS']['SC_OPTIONS']['t3lib/class.t3lib_tcemain.php']['processDatamapClass'][] = DatamapHook::class;
// $GLOBALS['TYPO3_CONF_VARS']['SC_OPTIONS']['t3lib/class.t3lib_tcemain.php']['processCmdmapClass'][] = DatamapHook::class;

// CLI commands are now registered via Configuration/Services.yaml

// Auto-include TypoScript setup
ExtensionManagementUtility::addTypoScriptSetup(
    '@import "EXT:pixelcoda_search/Configuration/TypoScript/setup.typoscript"'
);

// Auto-include TypoScript constants
ExtensionManagementUtility::addTypoScriptConstants(
    '@import "EXT:pixelcoda_search/Configuration/TypoScript/constants.typoscript"'
);

// Plugin registration removed - using Content Element only (TYPO3 Best Practice)
// The search functionality is provided as a Content Element (CType: pixelcodasearch_search)
// This prevents duplicate registration and follows TYPO3 Headless best practices

// Register AJAX endpoints for search suggestions
$GLOBALS['TYPO3_CONF_VARS']['FE']['eID_include']['pixelcoda_suggest']
    = SuggestEid::class . '::processRequest';

// Register API routes for plugin configuration
$GLOBALS['TYPO3_CONF_VARS']['FE']['eID_include']['pixelcoda_config']
    = PluginConfigController::class . '::getPluginConfig';

// Register page type for JSON API (headless mode)
$GLOBALS['TYPO3_CONF_VARS']['FE']['PageTypesToNoCache'][1699] = true;

// Extension configuration with environment fallbacks
$GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search'] = [
    'api_url' => $_ENV['PIXELCODA_API_URL'] ?? 'http://host.docker.internal:8787',
    'api_key' => $_ENV['PIXELCODA_API_KEY'] ?? 'pc_write_dev_key',
    'hmac_secret' => $_ENV['PIXELCODA_HMAC_SECRET'] ?? 'dev_hmac_secret_key',
    'project_id' => $_ENV['PIXELCODA_PROJECT_ID'] ?? 'typo3-dev',
    'typo3_headless_url' => $_ENV['TYPO3_HEADLESS_URL'] ?? 'http://localhost:8080/api',
    'enabled_tables' => ['pages', 'tt_content', 'tx_news_domain_model_news'],
    'default_mode' => 'classic', // classic|headless
    'enable_auto_index' => true,
    'enable_vector_search' => true,
    'batch_size' => 50,
    'timeout' => 30,
    'debug_mode' => true,
];

// Static TypoScript files are now added in ext_tables.php

// Add page TSconfig
ExtensionManagementUtility::addPageTSConfig(
    '@import "EXT:pixelcoda_search/Configuration/TsConfig/Page/All.tsconfig"'
);

// Register icon for backend module
$iconRegistry = GeneralUtility::makeInstance(
    IconRegistry::class
);
$iconRegistry->registerIcon(
    'pixelcoda-search',
    SvgIconProvider::class,
    ['source' => 'EXT:pixelcoda_search/Resources/Public/Icons/Extension.svg']
);

// Register the search plugin for the search results page
ExtensionUtility::configurePlugin(
    'PixelcodaSearch',
    'SearchResults',
    [
        SearchController::class => 'search,suggest',
    ],
    // non-cacheable actions
    [
        SearchController::class => 'search,suggest',
    ]
);

// Register EID handler for AJAX autocomplete
$GLOBALS['TYPO3_CONF_VARS']['FE']['eID_include']['search_suggest']
    = SuggestEid::class . '::processRequest';
