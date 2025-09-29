<?php

declare(strict_types=1);
defined('TYPO3') || exit();

use TYPO3\CMS\Core\Utility\ExtensionManagementUtility;

// Add static TypoScript for plugin configuration
ExtensionManagementUtility::addStaticFile(
    'pixelcoda_search',
    'Configuration/TypoScript',
    'pixelcoda Search'
);

// Plugin registration removed - using Content Element only
// The search functionality is registered as a Content Element (CType: pixelcodasearch_search)
// in Configuration/TCA/Overrides/tt_content.php and Configuration/TsConfig/Page/ContentElement.tsconfig

// Add TCA configuration for the custom CType
$GLOBALS['TCA']['tt_content']['types']['pixelcodasearch_search'] = [
    'showitem' => '
        --div--;LLL:EXT:core/Resources/Private/Language/Form/locallang_tabs.xlf:general,
            --palette--;;general,
            --palette--;;headers,
            pi_flexform,
        --div--;LLL:EXT:frontend/Resources/Private/Language/locallang_ttc.xlf:tabs.appearance,
            --palette--;;frames,
            --palette--;;appearanceLinks,
        --div--;LLL:EXT:core/Resources/Private/Language/Form/locallang_tabs.xlf:language,
            --palette--;;language,
        --div--;LLL:EXT:core/Resources/Private/Language/Form/locallang_tabs.xlf:access,
            --palette--;;hidden,
            --palette--;;access,
        --div--;LLL:EXT:core/Resources/Private/Language/Form/locallang_tabs.xlf:categories,
            categories,
        --div--;LLL:EXT:core/Resources/Private/Language/Form/locallang_tabs.xlf:notes,
            rowDescription,
        --div--;LLL:EXT:core/Resources/Private/Language/Form/locallang_tabs.xlf:extended,
    ',
];

// Add FlexForm configuration for the custom CType
$GLOBALS['TCA']['tt_content']['types']['pixelcodasearch_search']['columnsOverrides'] = [
    'pi_flexform' => [
        'config' => [
            'ds' => [
                'default' => 'FILE:EXT:pixelcoda_search/Configuration/FlexForms/Search.xml',
            ],
        ],
    ],
];

// Configure the list plugin type as well (for traditional plugin approach)
$GLOBALS['TCA']['tt_content']['types']['list']['subtypes_excludelist']['pixelcodasearch_search'] = 'layout,select_key,pages,recursive';
$GLOBALS['TCA']['tt_content']['types']['list']['subtypes_addlist']['pixelcodasearch_search'] = 'pi_flexform';

// Add FlexForm configuration for the plugin
$GLOBALS['TCA']['tt_content']['columns']['pi_flexform']['config']['ds']['pixelcodasearch_search'] = 'FILE:EXT:pixelcoda_search/Configuration/FlexForms/Search.xml';

// Backend module temporarily disabled - controller not yet implemented
// ExtensionManagementUtility::addModule(
//     'tools',
//     'PixelcodaSearchM1',
//     '',
//     '',
//     [
//         'routeTarget' => \PixelCoda\PixelcodaSearch\Controller\Backend\SearchModuleController::class . '::handleRequest',
//         'access' => 'user,group',
//         'name' => 'tools_PixelcodaSearchM1',
//         'icon' => 'EXT:pixelcoda_search/Resources/Public/Icons/Extension.svg',
//         'labels' => 'LLL:EXT:pixelcoda_search/Resources/Private/Language/locallang_mod.xlf'
//     ]
// );
