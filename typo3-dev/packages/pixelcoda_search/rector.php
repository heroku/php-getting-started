<?php

declare(strict_types=1);

use Rector\Config\RectorConfig;
use Rector\Set\ValueObject\LevelSetList;
use Rector\Set\ValueObject\SetList;

return RectorConfig::configure()
    ->withPaths([
        __DIR__ . '/Classes',
    ])
    ->withSkip([
        __DIR__ . '/Tests/Functional/Fixtures',
        __DIR__ . '/Resources',
    ])
    ->withPhpSets(
        php81: true,
    )
    ->withSets([
        // PHP version sets
        LevelSetList::UP_TO_PHP_81,

        // Code quality sets
        SetList::CODE_QUALITY,
        SetList::DEAD_CODE,
        SetList::TYPE_DECLARATION,
        SetList::EARLY_RETURN,
        SetList::CODING_STYLE,
    ])
    // Removed duplicate rules already included in the sets above
    ->withRules([])
    ->withImportNames(
        importShortClasses: true,
        removeUnusedImports: true,
    )
    ->withSkip([
        Rector\Php71\Rector\FuncCall\RemoveExtraParametersRector::class,
        Rector\CodeQuality\Rector\FuncCall\RemoveSoleValueSprintfRector::class,
        Rector\DeadCode\Rector\Cast\RecastingRemovalRector::class => [
            __DIR__ . '/Classes/Service/SearchService.php',
        ],
    ]);
