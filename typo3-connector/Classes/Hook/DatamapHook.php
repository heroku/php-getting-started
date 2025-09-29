<?php
declare(strict_types=1);

namespace PixelCoda\HeadlessSearchConnector\Hook;

use TYPO3\CMS\Core\DataHandling\DataHandler;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Core\Configuration\ExtensionConfiguration;
use TYPO3\CMS\Core\Log\LogManager;
use TYPO3\CMS\Core\Log\Logger;
use TYPO3\CMS\Core\Http\RequestFactory;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Context\Context;

/**
 * DataHandler Hook for pixelcoda Search Integration
 * 
 * Automatically sends webhooks to the pixelcoda search API when
 * TYPO3 records are created, updated, or deleted.
 */
class DatamapHook
{
    private Logger $logger;
    private array $config;
    private RequestFactory $requestFactory;

    public function __construct()
    {
        $this->logger = GeneralUtility::makeInstance(LogManager::class)->getLogger(__CLASS__);
        $this->config = $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['pixelcoda_search'] ?? [];
        $this->requestFactory = GeneralUtility::makeInstance(RequestFactory::class);
    }

    /**
     * Hook: processDatamap_afterDatabaseOperations
     * Called after record operations (insert/update)
     */
    public function processDatamap_afterDatabaseOperations(
        string $status,
        string $table,
        $id,
        array $fieldArray,
        DataHandler $dataHandler
    ): void {
        if (!$this->shouldProcessTable($table)) {
            return;
        }

        // Get the actual record data
        $recordData = $this->getRecordData($table, $id);
        if (!$recordData) {
            return;
        }

        $action = $status === 'new' ? 'create' : 'update';
        $this->sendWebhook($action, $table, (int)$id, $recordData);
    }

    /**
     * Hook: processCmdmap_afterDatabaseOperations  
     * Called after command operations (delete, copy, etc.)
     */
    public function processCmdmap_afterDatabaseOperations(
        string $command,
        string $table,
        $id,
        $value,
        DataHandler $dataHandler
    ): void {
        if (!$this->shouldProcessTable($table)) {
            return;
        }

        if ($command === 'delete') {
            $this->sendWebhook('delete', $table, (int)$id, []);
        }
    }

    /**
     * Check if we should process this table
     */
    private function shouldProcessTable(string $table): bool
    {
        if (empty($this->config['api_url']) || empty($this->config['api_key'])) {
            return false;
        }

        $enabledTables = $this->config['enabled_tables'] ?? [];
        return in_array($table, $enabledTables, true);
    }

    /**
     * Get complete record data from database
     */
    private function getRecordData(string $table, $uid): ?array
    {
        try {
            $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
                ->getQueryBuilderForTable($table);

            $record = $queryBuilder
                ->select('*')
                ->from($table)
                ->where(
                    $queryBuilder->expr()->eq('uid', $queryBuilder->createNamedParameter((int)$uid))
                )
                ->executeQuery()
                ->fetchAssociative();

            return $record ?: null;
        } catch (\Exception $e) {
            $this->logger->error('Failed to fetch record data', [
                'table' => $table,
                'uid' => $uid,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Send lightweight webhook to pixelcoda API (ID+Type only)
     * The worker will refetch the actual content from TYPO3-Headless JSON:API
     */
    private function sendWebhook(string $action, string $table, int $uid, array $data): void
    {
        try {
            // Lightweight payload - only essential info
            $payload = $this->buildLightweightPayload($action, $table, $uid);
            $signature = $this->generateHmacSignature($payload);
            
            $url = rtrim($this->config['api_url'], '/') . '/v1/webhook/typo3';
            
            $options = [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'X-API-Key' => $this->config['api_key'],
                    'X-Signature-SHA256' => $signature,
                    'User-Agent' => 'TYPO3-pixelcoda-Connector/2.0'
                ],
                'body' => json_encode($payload),
                'timeout' => $this->config['timeout'] ?? 10 // Shorter timeout for lightweight payload
            ];

            $response = $this->requestFactory->request($url, 'POST', $options);
            
            if ($response->getStatusCode() >= 200 && $response->getStatusCode() < 300) {
                $this->logger->info('Webhook sent successfully', [
                    'action' => $action,
                    'table' => $table,
                    'uid' => $uid,
                    'status' => $response->getStatusCode(),
                    'payload_size' => strlen(json_encode($payload))
                ]);
            } else {
                $this->logger->warning('Webhook failed', [
                    'action' => $action,
                    'table' => $table,
                    'uid' => $uid,
                    'status' => $response->getStatusCode(),
                    'response' => $response->getBody()->getContents()
                ]);
            }

        } catch (\Exception $e) {
            $this->logger->error('Webhook error', [
                'action' => $action,
                'table' => $table,
                'uid' => $uid,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Build lightweight webhook payload (ID+Type only)
     * Worker will refetch actual content from TYPO3-Headless JSON:API
     */
    private function buildLightweightPayload(string $action, string $table, int $uid): array
    {
        return [
            'action' => $action,
            'type' => $table,
            'id' => (string)$uid,
            'project_id' => $this->config['project_id'] ?? 'typo3',
            'timestamp' => time(),
            'typo3_headless_url' => $this->getTypo3HeadlessUrl(),
            'language' => $this->getCurrentLanguage(),
            'site_identifier' => $this->getCurrentSiteIdentifier(),
            'webhook_version' => '2.0'
        ];
    }

    /**
     * Get TYPO3-Headless API URL for refetching
     */
    private function getTypo3HeadlessUrl(): string
    {
        // Try to get from site configuration or environment
        return $this->config['typo3_headless_url'] ?? 
               $_ENV['TYPO3_HEADLESS_URL'] ?? 
               'http://localhost/api';
    }

    /**
     * Get current language from context
     */
    private function getCurrentLanguage(): string
    {
        try {
            $context = GeneralUtility::makeInstance(Context::class);
            $languageAspect = $context->getAspect('language');
            $languageId = $languageAspect->getId();
            
            // Simple language mapping
            $languageMap = [
                0 => 'de',
                1 => 'en',
                2 => 'fr',
                3 => 'es'
            ];
            
            return $languageMap[$languageId] ?? 'de';
        } catch (\Exception $e) {
            return 'de';
        }
    }

    /**
     * Generate HMAC signature for webhook verification
     */
    private function generateHmacSignature(array $payload): string
    {
        $secret = $this->config['hmac_secret'] ?? '';
        if (empty($secret)) {
            return '';
        }

        $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return hash_hmac('sha256', $jsonPayload, $secret);
    }

    /**
     * Sanitize data for webhook (remove sensitive fields)
     */
    private function sanitizeData(array $data): array
    {
        $sensitiveFields = [
            'password', 'password_hash', 'uc', 'session_data',
            'be_users_password', 'fe_users_password'
        ];

        return array_diff_key($data, array_flip($sensitiveFields));
    }

    /**
     * Get current site identifier
     */
    private function getCurrentSiteIdentifier(): string
    {
        try {
            $context = GeneralUtility::makeInstance(Context::class);
            return $context->getPropertyFromAspect('site', 'identifier', 'default');
        } catch (\Exception $e) {
            return 'default';
        }
    }
}