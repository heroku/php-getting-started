<?php
defined('TYPO3') || die();

use PixelCoda\HeadlessSearchConnector\Hook\DatamapHook;
use PixelCoda\HeadlessSearchConnector\Command\IndexCommand;
use PixelCoda\HeadlessSearchConnector\Command\ReindexCommand;

// Register DataHandler hooks for automatic indexing
$GLOBALS['TYPO3_CONF_VARS']['SC_OPTIONS']['t3lib/class.t3lib_tcemain.php']['processDatamapClass'][] = DatamapHook::class;
$GLOBALS['TYPO3_CONF_VARS']['SC_OPTIONS']['t3lib/class.t3lib_tcemain.php']['processCmdmapClass'][] = DatamapHook::class;

// Register CLI commands
$GLOBALS['TYPO3_CONF_VARS']['CONSOLE']['commands']['pixelcoda:search:index'] = [
    'class' => IndexCommand::class
];
$GLOBALS['TYPO3_CONF_VARS']['CONSOLE']['commands']['pixelcoda:search:reindex'] = [
    'class' => ReindexCommand::class
];

// Register configuration
$GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search'] = [
    'api_url' => $_ENV['PIXELCODA_API_URL'] ?? 'http://localhost:8787',
    'api_key' => $_ENV['PIXELCODA_API_KEY'] ?? '',
    'hmac_secret' => $_ENV['PIXELCODA_HMAC_SECRET'] ?? '',
    'project_id' => $_ENV['PIXELCODA_PROJECT_ID'] ?? 'typo3',
    'enabled_tables' => ['pages', 'tt_content', 'tx_news_domain_model_news'],
    'batch_size' => 50,
    'timeout' => 30
];
