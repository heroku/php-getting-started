<?php

declare(strict_types=1);

$EM_CONF[$_EXTKEY] = [
    'title' => 'pixelcoda Search',
    'description' => 'AI-powered search platform for TYPO3. Supports both headless (JSON:API) and classic (Fluid) modes with vector search, RAG answers, and real-time indexing.',
    'category' => 'plugin',
    'version' => '2.0.0',
    'state' => 'stable',
    'author' => 'pixelcoda GmbH',
    'author_email' => 'dev@pixelcoda.com',
    'author_company' => 'pixelcoda GmbH',
    'constraints' => [
        'depends' => [
            'typo3' => '12.4.0-12.4.99',
            'php' => '8.1.0-8.3.99',
            'extbase' => '12.4.0-12.4.99',
            'fluid' => '12.4.0-12.4.99',
        ],
        'conflicts' => [],
        'suggests' => [
            'headless' => '4.0.0-4.99.99',
            'news' => '11.0.0-11.99.99',
            'form' => '12.4.0-12.4.99',
        ],
    ],
    'autoload' => [
        'psr-4' => [
            'PixelCoda\\PixelcodaSearch\\' => 'Classes/',
        ],
    ],
];
