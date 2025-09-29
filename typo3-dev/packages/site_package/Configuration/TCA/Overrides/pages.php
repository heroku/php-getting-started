<?php
defined('TYPO3') || die();

call_user_func(
    static function ($extensionKey) {
        \TYPO3\CMS\Core\Utility\ExtensionManagementUtility::registerPageTSConfigFile(
            $extensionKey,
            'Configuration/TSConfig/Mod/ContentElements.tsconfig',
            'SitePackage :: Content Elements'
        );

        \TYPO3\CMS\Core\Utility\ExtensionManagementUtility::registerPageTSConfigFile(
            $extensionKey,
            'Configuration/TSConfig/Mod/BackendLayouts.tsconfig',
            'SitePackage :: Backend Layouts'
        );

        \TYPO3\CMS\Core\Utility\ExtensionManagementUtility::registerPageTSConfigFile(
            $extensionKey,
            'Configuration/TSConfig/Mod/All.tsconfig',
            'SitePackage :: All'
        );

    },
    'site_package'
);
