<?php

$EM_CONF[$_EXTKEY] = [
    'title' => 'TYPO3 Headless And PWA Demo Site Package',
    'description' => 'Provides site package for TYPO3 Headless And PWA Demo',
    'state' => 'stable',
    'author' => 'Łukasz Uznański',
    'author_email' => 'extensions@macopedia.pl',
    'category' => 'fe',
    'version' => '1.0.0',
    'constraints' => [
        'depends' => [
            'typo3' => '12.4.0-12.4.99',
            'headless' => '4.0.0-4.99.99',
        ],
        'conflicts' => [],
        'suggests' => [],
    ],
];
