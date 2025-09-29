<?php

declare(strict_types=1);

defined('TYPO3') || exit();

use TYPO3\CMS\Core\Utility\ExtensionManagementUtility;

// Add the content element to the New Content Element Wizard
ExtensionManagementUtility::addTcaSelectItem(
    'tt_content',
    'CType',
    [
        'LLL:EXT:pixelcoda_search/Resources/Private/Language/locallang_db.xlf:tt_content.CType.pixelcodasearch_search',
        'pixelcodasearch_search',
        'content-text',
    ],
    'text',
    'after'
);

// Configure the content element
$GLOBALS['TCA']['tt_content']['types']['pixelcodasearch_search'] = [
    'showitem' => '
        --div--;LLL:EXT:core/Resources/Private/Language/Form/locallang_tabs.xlf:general,
            --palette--;;general,
            --palette--;;headers,
        --div--;LLL:EXT:pixelcoda_search/Resources/Private/Language/locallang_db.xlf:tabs.plugin,
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
    ',
];

// Add FlexForm configuration
ExtensionManagementUtility::addPiFlexFormValue(
    '',
    'FILE:EXT:pixelcoda_search/Configuration/FlexForms/PluginSettings.xml',
    'pixelcodasearch_search'
);

// Add to content element groups
ExtensionManagementUtility::addToAllTCAtypes(
    'tt_content',
    'pi_flexform',
    'pixelcodasearch_search',
    'after:header'
);
