<?php
declare(strict_types=1);

namespace PixelCoda\HeadlessSearchConnector\Command;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Core\Http\RequestFactory;

/**
 * CLI Command to index TYPO3 content to pixelcoda Search
 */
class IndexCommand extends Command
{
    private array $config;
    private RequestFactory $requestFactory;

    public function __construct()
    {
        $this->config = $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search'] ?? [];
        $this->requestFactory = GeneralUtility::makeInstance(RequestFactory::class);
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->setDescription('Index TYPO3 content to pixelcoda Search Platform')
            ->addArgument(
                'table',
                InputArgument::OPTIONAL,
                'Table name to index (default: all enabled tables)'
            )
            ->addOption(
                'project',
                'p',
                InputOption::VALUE_REQUIRED,
                'Project ID',
                $this->config['project_id'] ?? 'typo3'
            )
            ->addOption(
                'batch-size',
                'b',
                InputOption::VALUE_REQUIRED,
                'Batch size for processing',
                $this->config['batch_size'] ?? 50
            )
            ->addOption(
                'dry-run',
                'd',
                InputOption::VALUE_NONE,
                'Show what would be indexed without actually doing it'
            )
            ->addOption(
                'force',
                'f',
                InputOption::VALUE_NONE,
                'Force reindex even if records haven\'t changed'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        
        if (empty($this->config['api_url']) || empty($this->config['api_key'])) {
            $io->error('pixelcoda Search API not configured. Please set api_url and api_key.');
            return Command::FAILURE;
        }

        $table = $input->getArgument('table');
        $project = $input->getOption('project');
        $batchSize = (int)$input->getOption('batch-size');
        $dryRun = $input->getOption('dry-run');
        $force = $input->getOption('force');

        $tablesToProcess = $table ? [$table] : ($this->config['enabled_tables'] ?? []);

        $io->title('pixelcoda Search Indexer');
        $io->text([
            'Project: ' . $project,
            'Batch Size: ' . $batchSize,
            'Dry Run: ' . ($dryRun ? 'Yes' : 'No'),
            'Force: ' . ($force ? 'Yes' : 'No')
        ]);

        $totalProcessed = 0;
        $totalErrors = 0;

        foreach ($tablesToProcess as $tableName) {
            $io->section("Processing table: {$tableName}");
            
            $result = $this->processTable($tableName, $project, $batchSize, $dryRun, $force, $io);
            $totalProcessed += $result['processed'];
            $totalErrors += $result['errors'];
        }

        $io->success([
            "Indexing completed!",
            "Total records processed: {$totalProcessed}",
            "Total errors: {$totalErrors}"
        ]);

        return $totalErrors > 0 ? Command::FAILURE : Command::SUCCESS;
    }

    private function processTable(
        string $table,
        string $project,
        int $batchSize,
        bool $dryRun,
        bool $force,
        SymfonyStyle $io
    ): array {
        $processed = 0;
        $errors = 0;
        $offset = 0;

        $connectionPool = GeneralUtility::makeInstance(ConnectionPool::class);
        $queryBuilder = $connectionPool->getQueryBuilderForTable($table);

        // Count total records
        $countQuery = clone $queryBuilder;
        $totalRecords = $countQuery->count('uid')->from($table)->executeQuery()->fetchOne();
        
        if ($totalRecords === 0) {
            $io->note("No records found in table {$table}");
            return ['processed' => 0, 'errors' => 0];
        }

        $io->progressStart($totalRecords);

        while ($offset < $totalRecords) {
            $queryBuilder = $connectionPool->getQueryBuilderForTable($table);
            $records = $queryBuilder
                ->select('*')
                ->from($table)
                ->setFirstResult($offset)
                ->setMaxResults($batchSize)
                ->executeQuery()
                ->fetchAllAssociative();

            if (empty($records)) {
                break;
            }

            foreach ($records as $record) {
                try {
                    if (!$dryRun) {
                        $this->indexRecord($table, $record, $project);
                    }
                    $processed++;
                    $io->progressAdvance();
                } catch (\Exception $e) {
                    $errors++;
                    $io->progressAdvance();
                    if ($io->isVerbose()) {
                        $io->error("Failed to index record {$record['uid']}: " . $e->getMessage());
                    }
                }
            }

            $offset += $batchSize;
        }

        $io->progressFinish();
        
        return ['processed' => $processed, 'errors' => $errors];
    }

    private function indexRecord(string $table, array $record, string $project): void
    {
        $document = $this->transformRecordToDocument($table, $record, $project);
        
        $url = rtrim($this->config['api_url'], '/') . "/v1/index/{$project}/{$table}";
        
        $payload = ['documents' => [$document]];
        
        $options = [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-API-Key' => $this->config['api_key'],
                'User-Agent' => 'TYPO3-pixelcoda-Indexer/1.0'
            ],
            'body' => json_encode($payload),
            'timeout' => $this->config['timeout'] ?? 30
        ];

        $response = $this->requestFactory->request($url, 'POST', $options);
        
        if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
            throw new \Exception(
                "API request failed with status {$response->getStatusCode()}: " . 
                $response->getBody()->getContents()
            );
        }
    }

    private function transformRecordToDocument(string $table, array $record, string $project): array
    {
        // Extract meaningful content based on table type
        $title = $this->extractTitle($table, $record);
        $content = $this->extractContent($table, $record);
        $url = $this->generateUrl($table, $record);

        return [
            'id' => "{$table}:{$record['uid']}",
            'project_id' => $project,
            'collection' => $table,
            'lang' => $record['sys_language_uid'] == 0 ? 'de' : 'en', // Simplified
            'title' => $title,
            'content' => $content,
            'url' => $url,
            'facets' => [
                'table' => $table,
                'uid' => $record['uid'],
                'pid' => $record['pid'] ?? 0,
                'created' => $record['crdate'] ?? 0,
                'modified' => $record['tstamp'] ?? 0
            ],
            'boost' => $this->calculateBoost($table, $record),
            'created_at' => date('c', $record['crdate'] ?? time()),
            'updated_at' => date('c', $record['tstamp'] ?? time())
        ];
    }

    private function extractTitle(string $table, array $record): string
    {
        $titleFields = ['title', 'header', 'name', 'subject'];
        
        foreach ($titleFields as $field) {
            if (!empty($record[$field])) {
                return strip_tags($record[$field]);
            }
        }

        return ucfirst($table) . ' #' . $record['uid'];
    }

    private function extractContent(string $table, array $record): string
    {
        $contentFields = ['bodytext', 'description', 'abstract', 'teaser', 'content'];
        $content = '';

        foreach ($contentFields as $field) {
            if (!empty($record[$field])) {
                $content .= strip_tags($record[$field]) . ' ';
            }
        }

        // Fallback: concatenate all text fields
        if (empty(trim($content))) {
            foreach ($record as $key => $value) {
                if (is_string($value) && strlen($value) > 10 && strlen($value) < 1000) {
                    $content .= strip_tags($value) . ' ';
                }
            }
        }

        return trim($content);
    }

    private function generateUrl(string $table, array $record): ?string
    {
        // Simplified URL generation - would need proper site configuration
        if ($table === 'pages') {
            return "/page/{$record['uid']}";
        }
        
        return null;
    }

    private function calculateBoost(string $table, array $record): float
    {
        // Simple boost calculation
        $boost = 1.0;
        
        if ($table === 'pages') {
            $boost = 1.2; // Pages get slight boost
        }
        
        if (!empty($record['fe_group']) && $record['fe_group'] === '0') {
            $boost *= 1.1; // Public content gets boost
        }

        return $boost;
    }
}
