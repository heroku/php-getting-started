<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Hook;

use Exception;
use PixelCoda\PixelcodaSearch\Service\SearchService;
use Psr\Log\LoggerAwareInterface;
use Psr\Log\LoggerAwareTrait;
use TYPO3\CMS\Core\DataHandling\DataHandler;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * DataHandler hook for automatic content indexing.
 *
 * This hook listens to TYPO3 DataHandler operations and automatically
 * indexes content when it's created, updated, or deleted.
 */
class DatamapHook implements LoggerAwareInterface
{
    use LoggerAwareTrait;

    public $logger;

    private SearchService $searchService;

    public function __construct()
    {
        $this->searchService = GeneralUtility::makeInstance(SearchService::class);
    }

    /**
     * Hook that is called before the datamap is processed.
     */
    public function processDatamap_beforeStart(DataHandler $dataHandler): void
    {
        // Initialize any pre-processing if needed
        $this->logger?->debug('pixelcoda Search: DataHandler processing started');
    }

    /**
     * Hook that is called after a record has been processed.
     *
     * @param string     $status     The status of the operation (new, update)
     * @param string     $table      The table name
     * @param int|string $id         The record ID
     * @param array      $fieldArray The field values
     */
    public function processDatamap_afterDatabaseOperations(
        string $status,
        string $table,
        $id,
        array $fieldArray,
        DataHandler $dataHandler
    ): void {
        // Only index supported tables
        $enabledTables = $this->getEnabledTables();

        if (!in_array($table, $enabledTables, true)) {
            return;
        }

        try {
            switch ($status) {
                case 'new':
                    // Get the actual ID for new records
                    $actualId = $dataHandler->substNEWwithIDs[$id] ?? $id;
                    $this->indexRecord($table, (int) $actualId, 'create');

                    break;

                case 'update':
                    $this->indexRecord($table, (int) $id, 'update');

                    break;
            }
        } catch (Exception $exception) {
            $this->logger?->error('pixelcoda Search indexing failed', [
                'table' => $table,
                'id' => $id,
                'status' => $status,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * Hook that is called after all commands have been processed.
     */
    public function processCmdmap_afterFinish(DataHandler $dataHandler): void
    {
        $enabledTables = $this->getEnabledTables();

        // Process all commands that were executed
        foreach ($dataHandler->cmdmap as $table => $commands) {
            if (!in_array($table, $enabledTables, true)) {
                continue;
            }

            foreach ($commands as $id => $commandData) {
                foreach ($commandData as $command => $value) {
                    try {
                        switch ($command) {
                            case 'delete':
                                $this->deleteFromIndex($table, (int) $id);

                                break;

                            case 'copy':
                                // Index the copied record
                                if (isset($dataHandler->copyMappingArray[$table][$id])) {
                                    $newId = $dataHandler->copyMappingArray[$table][$id];
                                    $this->indexRecord($table, (int) $newId, 'create');
                                }

                                break;

                            case 'move':
                                // Re-index moved record (URL might have changed)
                                $this->indexRecord($table, (int) $id, 'update');

                                break;
                        }
                    } catch (Exception $e) {
                        $this->logger?->error('pixelcoda Search command processing failed', [
                            'table' => $table,
                            'id' => $id,
                            'command' => $command,
                            'error' => $e->getMessage(),
                        ]);
                    }
                }
            }
        }
    }

    /**
     * Index a single record.
     */
    private function indexRecord(string $table, int $id, string $action): void
    {
        if (!$this->isAutoIndexingEnabled()) {
            return;
        }

        $this->logger?->info('pixelcoda Search: Indexing record', [
            'table' => $table,
            'id' => $id,
            'action' => $action,
        ]);

        // Delegate to SearchService for actual indexing
        $this->searchService->indexRecord($table, $id, $action);
    }

    /**
     * Remove a record from the search index.
     */
    private function deleteFromIndex(string $table, int $id): void
    {
        if (!$this->isAutoIndexingEnabled()) {
            return;
        }

        $this->logger?->info('pixelcoda Search: Deleting from index', [
            'table' => $table,
            'id' => $id,
        ]);

        $this->searchService->deleteRecord($table, $id);
    }

    /**
     * Get enabled tables from extension configuration.
     */
    private function getEnabledTables(): array
    {
        $config = $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search'] ?? [];

        return $config['enabled_tables'] ?? ['pages', 'tt_content'];
    }

    /**
     * Check if auto-indexing is enabled.
     */
    private function isAutoIndexingEnabled(): bool
    {
        $config = $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search'] ?? [];

        return (bool) ($config['enable_auto_index'] ?? true);
    }
}
