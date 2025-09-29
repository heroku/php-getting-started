<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Command;

use Exception;
use PixelCoda\PixelcodaSearch\Service\SearchService;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * CLI Command for re-indexing content to pixelcoda Search
 * This command clears the existing index and rebuilds it from scratch.
 */
class ReindexCommand extends Command
{
    private readonly SearchService $searchService;

    public function __construct()
    {
        parent::__construct();
        $this->searchService = GeneralUtility::makeInstance(SearchService::class);
    }

    protected function configure(): void
    {
        $this->setDescription('Re-index all content to pixelcoda Search (clears existing index)')
            ->setHelp('This command clears the existing search index and rebuilds it from scratch')
            ->addOption(
                'table',
                't',
                InputOption::VALUE_OPTIONAL,
                'Re-index specific table only (pages, tt_content, tx_news_domain_model_news)',
                null
            )
            ->addOption(
                'dry-run',
                'd',
                InputOption::VALUE_NONE,
                'Show what would be re-indexed without actually doing it'
            )
            ->addOption(
                'skip-clear',
                's',
                InputOption::VALUE_NONE,
                'Skip clearing the index before re-indexing'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $io->title('pixelcoda Search Re-indexer');

        $table = $input->getOption('table');
        $dryRun = $input->getOption('dry-run');
        $skipClear = $input->getOption('skip-clear');

        if ($dryRun) {
            $io->note('Running in dry-run mode - no content will be re-indexed');
        }

        try {
            if ($table) {
                // Re-index specific table
                $io->section('Re-indexing table: ' . $table);

                if (!$skipClear) {
                    if (!$dryRun) {
                        $io->text('Clearing existing index for table...');
                        $this->searchService->clearTableIndex($table);
                        $io->text('✓ Index cleared');
                    } else {
                        $io->info('Would clear index for table: ' . $table);
                    }
                }

                if (!$dryRun) {
                    $count = $this->searchService->indexTable($table, true);
                    $io->success(sprintf('Successfully re-indexed %d records from %s', $count, $table));
                } else {
                    $count = $this->searchService->getTableRecordCount($table);
                    $io->info(sprintf('Would re-index %d records from %s', $count, $table));
                }
            } else {
                // Re-index all enabled tables
                $enabledTables = $this->getEnabledTables();
                $io->section('Re-indexing all enabled tables: ' . implode(', ', $enabledTables));

                if (!$skipClear) {
                    if (!$dryRun) {
                        $io->text('Clearing entire search index...');
                        $this->searchService->clearAllIndexes();
                        $io->text('✓ All indexes cleared');
                    } else {
                        $io->info('Would clear entire search index');
                    }
                }

                $totalCount = 0;
                foreach ($enabledTables as $tableName) {
                    $io->text('Processing table: ' . $tableName);

                    if (!$dryRun) {
                        $count = $this->searchService->indexTable($tableName, true);
                        $io->text(sprintf('  → Re-indexed %d records', $count));
                        $totalCount += $count;
                    } else {
                        $count = $this->searchService->getTableRecordCount($tableName);
                        $io->text(sprintf('  → Would re-index %d records', $count));
                        $totalCount += $count;
                    }
                }

                if (!$dryRun) {
                    $io->success(sprintf('Successfully re-indexed %d records total', $totalCount));
                } else {
                    $io->info(sprintf('Would re-index %d records total', $totalCount));
                }
            }

            // Show some statistics
            if (!$dryRun && !$skipClear) {
                $io->section('Index Statistics');

                try {
                    $stats = $this->searchService->getIndexStatistics();
                    if ($stats) {
                        $io->definitionList(
                            ['Total Documents' => $stats['total_documents'] ?? 'N/A'],
                            ['Total Size' => $stats['total_size'] ?? 'N/A'],
                            ['Last Updated' => $stats['last_updated'] ?? 'N/A']
                        );
                    }
                } catch (Exception $e) {
                    $io->note('Could not retrieve index statistics: ' . $e->getMessage());
                }
            }

            return Command::SUCCESS;
        } catch (Exception $exception) {
            $io->error('Re-indexing failed: ' . $exception->getMessage());

            if ($output->isVerbose()) {
                $io->text($exception->getTraceAsString());
            }

            return Command::FAILURE;
        }
    }

    /**
     * Get enabled tables from extension configuration.
     */
    private function getEnabledTables(): array
    {
        $config = $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search'] ?? [];

        return $config['enabled_tables'] ?? ['pages', 'tt_content'];
    }
}
