<?php

$EM_CONF[$_EXTKEY] = [
    'title' => 'pixelcoda Headless Search Connector',
    'description' => 'Connects TYPO3 to pixelcoda headless search platform via webhooks. Automatically indexes pages, news, and custom content when changed.',
    'category' => 'plugin',
    'version' => '1.0.0',
    'state' => 'stable',
    'author' => 'pixelcoda GmbH',
    'author_email' => 'dev@pixelcoda.com',
    'author_company' => 'pixelcoda GmbH',
    'constraints' => [
        'depends' => [
            'typo3' => '11.5.0-12.4.99',
            'php' => '8.1.0-8.3.99'
        ],
        'conflicts' => [],
        'suggests' => [
            'news' => '10.0.0-11.99.99'
        ]
    ],
    'autoload' => [
        'psr-4' => [
            'PixelCoda\\HeadlessSearchConnector\\' => 'Classes/'
        ]
    ]
];
