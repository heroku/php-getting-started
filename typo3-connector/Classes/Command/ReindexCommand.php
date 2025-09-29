<?php
declare(strict_types=1);

namespace PixelCoda\HeadlessSearchConnector\Command;

use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Core\Http\RequestFactory;

/**
 * CLI Command to clear and reindex all content
 */
class ReindexCommand extends Command
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
            ->setDescription('Clear and reindex all content in pixelcoda Search')
            ->addOption(
                'project',
                'p',
                InputOption::VALUE_REQUIRED,
                'Project ID',
                $this->config['project_id'] ?? 'typo3'
            )
            ->addOption(
                'confirm',
                'c',
                InputOption::VALUE_NONE,
                'Confirm deletion of existing index'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        
        if (empty($this->config['api_url']) || empty($this->config['api_key'])) {
            $io->error('pixelcoda Search API not configured. Please set api_url and api_key.');
            return Command::FAILURE;
        }

        $project = $input->getOption('project');
        $confirm = $input->getOption('confirm');

        $io->title('pixelcoda Search Reindexer');
        $io->warning([
            'This will DELETE all existing content in the search index!',
            "Project: {$project}"
        ]);

        if (!$confirm && !$io->confirm('Are you sure you want to continue?', false)) {
            $io->note('Operation cancelled.');
            return Command::SUCCESS;
        }

        // Step 1: Clear existing index
        $io->section('Step 1: Clearing existing index');
        
        try {
            $this->clearIndex($project);
            $io->success('Index cleared successfully');
        } catch (\Exception $e) {
            $io->error('Failed to clear index: ' . $e->getMessage());
            return Command::FAILURE;
        }

        // Step 2: Run full reindex
        $io->section('Step 2: Running full reindex');
        
        $indexCommand = new IndexCommand();
        $indexInput = clone $input;
        $indexInput->setOption('force', true);
        
        return $indexCommand->run($indexInput, $output);
    }

    private function clearIndex(string $project): void
    {
        $enabledTables = $this->config['enabled_tables'] ?? [];
        
        foreach ($enabledTables as $table) {
            $url = rtrim($this->config['api_url'], '/') . "/v1/index/{$project}/{$table}/clear";
            
            $options = [
                'headers' => [
                    'X-API-Key' => $this->config['api_key'],
                    'User-Agent' => 'TYPO3-pixelcoda-Reindexer/1.0'
                ],
                'timeout' => $this->config['timeout'] ?? 30
            ];

            $response = $this->requestFactory->request($url, 'DELETE', $options);
            
            if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
                throw new \Exception(
                    "Failed to clear index for table {$table}: " . 
                    $response->getBody()->getContents()
                );
            }
        }
    }
}
