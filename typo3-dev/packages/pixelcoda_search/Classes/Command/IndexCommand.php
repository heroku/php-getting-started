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
 * CLI Command for indexing content to pixelcoda Search.
 */
class IndexCommand extends Command
{
    private readonly SearchService $searchService;

    public function __construct()
    {
        parent::__construct();
        $this->searchService = GeneralUtility::makeInstance(SearchService::class);
    }

    protected function configure(): void
    {
        $this->setDescription('Index content to pixelcoda Search')
            ->setHelp('This command indexes TYPO3 content to the pixelcoda Search API')
            ->addOption(
                'table',
                't',
                InputOption::VALUE_OPTIONAL,
                'Index specific table only (pages, tt_content, tx_news_domain_model_news)',
                null
            )
            ->addOption(
                'id',
                'i',
                InputOption::VALUE_OPTIONAL,
                'Index specific record ID only',
                null
            )
            ->addOption(
                'dry-run',
                'd',
                InputOption::VALUE_NONE,
                'Show what would be indexed without actually indexing'
            )
            ->addOption(
                'force',
                'f',
                InputOption::VALUE_NONE,
                'Force re-indexing of existing content'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $io->title('pixelcoda Search Indexer');

        $table = $input->getOption('table');
        $id = $input->getOption('id');
        $dryRun = $input->getOption('dry-run');
        $force = $input->getOption('force');

        if ($dryRun) {
            $io->note('Running in dry-run mode - no content will be indexed');
        }

        try {
            if ($table && $id) {
                // Index specific record
                $io->section(sprintf('Indexing single record: %s:%s', $table, $id));

                if (!$dryRun) {
                    $result = $this->searchService->indexRecord($table, (int) $id, 'update', $force);
                    if ($result) {
                        $io->success(sprintf('Successfully indexed %s:%s', $table, $id));
                    } else {
                        $io->error(sprintf('Failed to index %s:%s', $table, $id));

                        return Command::FAILURE;
                    }
                } else {
                    $io->info(sprintf('Would index: %s:%s', $table, $id));
                }
            } elseif ($table) {
                // Index specific table
                $io->section('Indexing table: ' . $table);

                if (!$dryRun) {
                    $count = $this->searchService->indexTable($table, $force);
                    $io->success(sprintf('Successfully indexed %d records from %s', $count, $table));
                } else {
                    $count = $this->searchService->getTableRecordCount($table);
                    $io->info(sprintf('Would index %d records from %s', $count, $table));
                }
            } else {
                // Index all enabled tables
                $enabledTables = $this->getEnabledTables();
                $io->section('Indexing all enabled tables: ' . implode(', ', $enabledTables));

                $totalCount = 0;
                foreach ($enabledTables as $tableName) {
                    $io->text('Processing table: ' . $tableName);

                    if (!$dryRun) {
                        $count = $this->searchService->indexTable($tableName, $force);
                        $io->text(sprintf('  → Indexed %d records', $count));
                        $totalCount += $count;
                    } else {
                        $count = $this->searchService->getTableRecordCount($tableName);
                        $io->text(sprintf('  → Would index %d records', $count));
                        $totalCount += $count;
                    }
                }

                if (!$dryRun) {
                    $io->success(sprintf('Successfully indexed %d records total', $totalCount));
                } else {
                    $io->info(sprintf('Would index %d records total', $totalCount));
                }
            }

            return Command::SUCCESS;
        } catch (Exception $exception) {
            $io->error('Indexing failed: ' . $exception->getMessage());

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
