<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Controller;

use Psr\Http\Message\ResponseInterface;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Http\JsonResponse;
use TYPO3\CMS\Core\Resource\FileRepository;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Extbase\Mvc\Controller\ActionController;
use TYPO3\CMS\Extbase\Utility\LocalizationUtility;

/**
 * Search Controller for handling search requests.
 */
class SearchController extends ActionController
{
    /**
     * Display search form.
     */
    public function indexAction(): ResponseInterface
    {
        return $this->htmlResponse();
    }

    /**
     * AJAX endpoint for search suggestions.
     */
    public function suggestAction(): ResponseInterface
    {
        $query = $this->request->getQueryParams()['q'] ?? '';
        $query = trim($query);

        // Return empty if query is too short
        if (strlen($query) < 2) {
            return $this->createJsonResponse([]);
        }

        $suggestions = $this->getSuggestions($query);

        return $this->createJsonResponse($suggestions);
    }

    /**
     * Handle search and display results with pagination.
     */
    public function searchAction(): ResponseInterface
    {
        $params = $this->request->getQueryParams();
        $searchQuery = trim($params['q'] ?? '');
        $currentPage = (int) ($params['page'] ?? 1);

        // Get filter parameters
        $filters = [
            'category' => $params['category'] ?? '',
            'dateFrom' => $params['date_from'] ?? '',
            'dateTo' => $params['date_to'] ?? '',
            'contentType' => $params['content_type'] ?? 'all',
            'searchIn' => [
                'pages' => !empty($params['filter_pages']),
                'content' => !empty($params['filter_content']),
                'news' => !empty($params['filter_news']),
            ],
            'sort' => $params['sort'] ?? 'relevance',
        ];

        // Default to searching in pages and content if nothing selected
        if (!$filters['searchIn']['pages'] && !$filters['searchIn']['content'] && !$filters['searchIn']['news']) {
            $filters['searchIn']['pages'] = true;
            $filters['searchIn']['content'] = true;
        }

        // Get settings from FlexForm or fallback to defaults
        $resultsPerPage = (int) ($this->settings['resultsPerPage'] ?? 10);
        $minQueryLength = (int) ($this->settings['minQueryLength'] ?? 3);

        $results = [];
        $message = '';
        $totalResults = 0;
        $pagination = [];

        if (strlen($searchQuery) < $minQueryLength) {
            $message = sprintf($this->getTranslation('search.results.minlength'), $minQueryLength);
        } else {
            // Search with filters
            $allResults = [];

            if ($filters['searchIn']['pages']) {
                $pageResults = $this->searchInPagesWithFilters($searchQuery, $filters);
                $allResults = array_merge($allResults, $pageResults);
            }

            if ($filters['searchIn']['content']) {
                $contentResults = $this->searchInContentWithFilters($searchQuery, $filters);
                $allResults = array_merge($allResults, $contentResults);
            }

            // Apply sorting
            $allResults = $this->sortResults($allResults, $filters['sort']);
            $totalResults = count($allResults);

            // Calculate pagination
            $totalPages = ceil($totalResults / $resultsPerPage);
            $currentPage = max(1, min($currentPage, $totalPages));
            $offset = ($currentPage - 1) * $resultsPerPage;

            // Get results for current page
            $results = array_slice($allResults, $offset, $resultsPerPage);

            if ([] === $results) {
                $message = 'Keine Ergebnisse für "' . htmlspecialchars($searchQuery) . '" gefunden.';
            } else {
                $message = $totalResults . ' Ergebnis(se) für "' . htmlspecialchars($searchQuery) . '" gefunden.';
            }

            // Build pagination array
            if ($totalPages > 1) {
                $pagination = [
                    'current' => $currentPage,
                    'total' => $totalPages,
                    'prev' => $currentPage > 1 ? $currentPage - 1 : null,
                    'next' => $currentPage < $totalPages ? $currentPage + 1 : null,
                    'pages' => range(1, $totalPages),
                ];
            }
        }

        // Get available categories for filter dropdown
        $availableCategories = $this->getAvailableCategories();

        $this->view->assignMultiple([
            'searchQuery' => htmlspecialchars($searchQuery),
            'results' => $results,
            'message' => $message,
            'pagination' => $pagination,
            'totalResults' => $totalResults,
            'settings' => $this->settings,
            'filters' => $filters,
            'availableCategories' => $availableCategories,
        ]);

        // Use the enhanced template with filters
        $this->view->setTemplatePathAndFilename(
            'EXT:pixelcoda_search/Resources/Private/Templates/Search/SearchWithFilters.html'
        );

        return $this->htmlResponse();
    }

    /**
     * Search in pages table.
     */
    protected function searchInPages(string $query): array
    {
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('pages');

        $searchTerms = '%' . $queryBuilder->escapeLikeWildcards($query) . '%';

        $statement = $queryBuilder
            ->select('uid', 'title', 'abstract', 'keywords')
            ->from('pages')
            ->where(
                $queryBuilder->expr()->or(
                    $queryBuilder->expr()->like('title', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('abstract', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('keywords', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('description', $queryBuilder->createNamedParameter($searchTerms))
                ),
                $queryBuilder->expr()->eq('deleted', 0),
                $queryBuilder->expr()->eq('hidden', 0)
            )
            ->setMaxResults(20)
            ->execute();

        $results = [];
        while ($row = $statement->fetchAssociative()) {
            // Build URL for the page - use slug directly
            // First try to get the slug from the database
            $slugQuery = GeneralUtility::makeInstance(ConnectionPool::class)
                ->getQueryBuilderForTable('pages');
            $slugResult = $slugQuery
                ->select('slug')
                ->from('pages')
                ->where($slugQuery->expr()->eq('uid', $row['uid']))
                ->execute()
                ->fetchAssociative();

            if ($slugResult && !empty($slugResult['slug'])) {
                // Use the slug directly
                $url = $slugResult['slug'];
                // Ensure it starts with /
                if (!str_starts_with((string) $url, '/')) {
                    $url = '/' . $url;
                }
            } else {
                // Fallback to ID-based URL
                $url = '/index.php?id=' . $row['uid'];
            }

            $results[] = [
                'title' => $row['title'],
                'abstract' => $row['abstract'] ?: $this->getTranslation('search.results.nodescription'),
                'url' => $url,
            ];
        }

        // Also search in tt_content
        $contentResults = $this->searchInContent($query);

        return array_merge($results, $contentResults);
    }

    /**
     * Search in content elements.
     */
    protected function searchInContent(string $query): array
    {
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('tt_content');

        $searchTerms = '%' . $queryBuilder->escapeLikeWildcards($query) . '%';

        $statement = $queryBuilder
            ->select('tt_content.uid', 'tt_content.header', 'tt_content.bodytext', 'tt_content.pid', 'pages.title as page_title')
            ->from('tt_content')
            ->leftJoin(
                'tt_content',
                'pages',
                'pages',
                $queryBuilder->expr()->eq('tt_content.pid', $queryBuilder->quoteIdentifier('pages.uid'))
            )
            ->where(
                $queryBuilder->expr()->or(
                    $queryBuilder->expr()->like('tt_content.header', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('tt_content.bodytext', $queryBuilder->createNamedParameter($searchTerms))
                ),
                $queryBuilder->expr()->eq('tt_content.deleted', 0),
                $queryBuilder->expr()->eq('tt_content.hidden', 0),
                $queryBuilder->expr()->eq('pages.deleted', 0),
                $queryBuilder->expr()->eq('pages.hidden', 0)
            )
            ->setMaxResults(10)
            ->execute();

        $results = [];
        while ($row = $statement->fetchAssociative()) {
            // Build URL for the parent page
            $abstract = strip_tags($row['bodytext'] ?? '');
            $abstract = mb_substr($abstract, 0, 150) . (mb_strlen($abstract) > 150 ? '...' : '');

            // Get the parent page slug
            $slugQuery = GeneralUtility::makeInstance(ConnectionPool::class)
                ->getQueryBuilderForTable('pages');
            $slugResult = $slugQuery
                ->select('slug')
                ->from('pages')
                ->where($slugQuery->expr()->eq('uid', $row['pid']))
                ->execute()
                ->fetchAssociative();

            if ($slugResult && !empty($slugResult['slug'])) {
                $url = $slugResult['slug'];
                // Ensure it starts with /
                if (!str_starts_with((string) $url, '/')) {
                    $url = '/' . $url;
                }

                $url .= '#c' . $row['uid'];
            } else {
                // Fallback to ID-based URL
                $url = '/index.php?id=' . $row['pid'] . '#c' . $row['uid'];
            }

            $results[] = [
                'title' => $row['header'] ?: $row['page_title'],
                'abstract' => $abstract ?: $this->getTranslation('search.results.nodescription'),
                'url' => $url,
                'page' => $row['page_title'],
            ];
        }

        return $results;
    }

    /**
     * Enhanced search with images, tags, categories.
     */
    protected function searchInPagesEnhanced(string $query, string $sortOrder = 'relevance'): array
    {
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('pages');

        $searchTerms = '%' . $queryBuilder->escapeLikeWildcards($query) . '%';

        // Build query with enhanced fields
        $queryBuilder
            ->select(
                'pages.uid',
                'pages.title',
                'pages.slug',
                'pages.abstract',
                'pages.keywords',
                'pages.description',
                'pages.media',
                'pages.categories',
                'pages.lastUpdated',
                'pages.crdate'
            )
            ->from('pages')
            ->where(
                $queryBuilder->expr()->or(
                    $queryBuilder->expr()->like('title', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('abstract', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('keywords', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('description', $queryBuilder->createNamedParameter($searchTerms))
                ),
                $queryBuilder->expr()->eq('deleted', 0),
                $queryBuilder->expr()->eq('hidden', 0)
            );

        // Apply sorting
        switch ($sortOrder) {
            case 'date_desc':
                $queryBuilder->orderBy('lastUpdated', 'DESC');

                break;
            case 'date_asc':
                $queryBuilder->orderBy('lastUpdated', 'ASC');

                break;
            case 'title':
                $queryBuilder->orderBy('title', 'ASC');

                break;
            default: // relevance - no specific order
                break;
        }

        $statement = $queryBuilder->execute();

        $results = [];
        while ($row = $statement->fetchAssociative()) {
            // Build URL for the page - use slug directly
            if (!empty($row['slug'])) {
                $url = $row['slug'];
                // Ensure it starts with /
                if (!str_starts_with((string) $url, '/')) {
                    $url = '/' . $url;
                }
            } else {
                // Fallback to ID-based URL
                $url = '/index.php?id=' . $row['uid'];
            }

            // Get first image if available
            $image = null;
            if ($row['media']) {
                // Get file reference
                $fileRepository = GeneralUtility::makeInstance(FileRepository::class);
                $fileReferences = $fileRepository->findByRelation('pages', 'media', $row['uid']);
                if (!empty($fileReferences)) {
                    $fileReference = $fileReferences[0];
                    $image = [
                        'url' => $fileReference->getPublicUrl(),
                        'alt' => $fileReference->getAlternative() ?: $row['title'],
                    ];
                }
            }

            // Parse keywords as tags
            $tags = [];
            if ($row['keywords']) {
                $tags = array_map('trim', explode(',', (string) $row['keywords']));
            }

            // Format date
            $date = null;
            if ($row['lastUpdated']) {
                $date = date('d.m.Y', $row['lastUpdated']);
            } elseif ($row['crdate']) {
                $date = date('d.m.Y', $row['crdate']);
            }

            $results[] = [
                'title' => $row['title'],
                'abstract' => ($row['abstract'] ?: $row['description']) ?: 'Keine Beschreibung verfügbar.',
                'url' => $url,
                'image' => $image,
                'tags' => $tags,
                'date' => $date,
                'categories' => $this->getPageCategories($row['uid']),
            ];
        }

        // Also search in content elements with enhanced features
        $contentResults = $this->searchInContentEnhanced($query, $sortOrder);

        return array_merge($results, $contentResults);
    }

    /**
     * Enhanced search in content elements.
     */
    protected function searchInContentEnhanced(string $query, string $sortOrder = 'relevance'): array
    {
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('tt_content');

        $searchTerms = '%' . $queryBuilder->escapeLikeWildcards($query) . '%';

        $queryBuilder
            ->select(
                'tt_content.uid',
                'tt_content.header',
                'tt_content.bodytext',
                'tt_content.pid',
                'tt_content.image',
                'tt_content.categories',
                'tt_content.crdate',
                'pages.title as page_title'
            )
            ->from('tt_content')
            ->leftJoin(
                'tt_content',
                'pages',
                'pages',
                $queryBuilder->expr()->eq('tt_content.pid', $queryBuilder->quoteIdentifier('pages.uid'))
            )
            ->where(
                $queryBuilder->expr()->or(
                    $queryBuilder->expr()->like('tt_content.header', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('tt_content.bodytext', $queryBuilder->createNamedParameter($searchTerms))
                ),
                $queryBuilder->expr()->eq('tt_content.deleted', 0),
                $queryBuilder->expr()->eq('tt_content.hidden', 0),
                $queryBuilder->expr()->eq('pages.deleted', 0),
                $queryBuilder->expr()->eq('pages.hidden', 0)
            );

        // Apply sorting
        switch ($sortOrder) {
            case 'date_desc':
                $queryBuilder->orderBy('tt_content.crdate', 'DESC');

                break;
            case 'date_asc':
                $queryBuilder->orderBy('tt_content.crdate', 'ASC');

                break;
            case 'title':
                $queryBuilder->orderBy('tt_content.header', 'ASC');

                break;
        }

        $statement = $queryBuilder->setMaxResults(20)->execute();

        $results = [];
        while ($row = $statement->fetchAssociative()) {
            // Build URL for the parent page
            // Get the parent page slug
            $slugQuery = GeneralUtility::makeInstance(ConnectionPool::class)
                ->getQueryBuilderForTable('pages');
            $slugResult = $slugQuery
                ->select('slug')
                ->from('pages')
                ->where($slugQuery->expr()->eq('uid', $row['pid']))
                ->execute()
                ->fetchAssociative();

            if ($slugResult && !empty($slugResult['slug'])) {
                $url = $slugResult['slug'];
                // Ensure it starts with /
                if (!str_starts_with((string) $url, '/')) {
                    $url = '/' . $url;
                }

                $url .= '#c' . $row['uid'];
            } else {
                // Fallback to ID-based URL
                $url = '/index.php?id=' . $row['pid'] . '#c' . $row['uid'];
            }

            // Get first image if available
            $image = null;
            if ($row['image']) {
                $fileRepository = GeneralUtility::makeInstance(FileRepository::class);
                $fileReferences = $fileRepository->findByRelation('tt_content', 'image', $row['uid']);
                if (!empty($fileReferences)) {
                    $fileReference = $fileReferences[0];
                    $image = [
                        'url' => $fileReference->getPublicUrl(),
                        'alt' => $fileReference->getAlternative() ?: $row['header'],
                    ];
                }
            }

            $abstract = strip_tags($row['bodytext'] ?? '');
            $abstract = mb_substr($abstract, 0, 150) . (mb_strlen($abstract) > 150 ? '...' : '');

            $results[] = [
                'title' => $row['header'] ?: $row['page_title'],
                'abstract' => $abstract ?: $this->getTranslation('search.results.nodescription'),
                'url' => $url,
                'page' => $row['page_title'],
                'image' => $image,
                'tags' => [],
                'date' => $row['crdate'] ? date('d.m.Y', $row['crdate']) : null,
                'categories' => $this->getContentCategories($row['uid']),
            ];
        }

        return $results;
    }

    /**
     * Get categories for a page.
     */
    protected function getPageCategories(int $pageUid): array
    {
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('sys_category');

        $statement = $queryBuilder
            ->select('sys_category.title')
            ->from('sys_category')
            ->join(
                'sys_category',
                'sys_category_record_mm',
                'mm',
                $queryBuilder->expr()->eq('sys_category.uid', $queryBuilder->quoteIdentifier('mm.uid_local'))
            )
            ->where(
                $queryBuilder->expr()->eq('mm.uid_foreign', $pageUid),
                $queryBuilder->expr()->eq('mm.tablenames', $queryBuilder->createNamedParameter('pages'))
            )
            ->execute();

        $categories = [];
        while ($row = $statement->fetchAssociative()) {
            $categories[] = $row['title'];
        }

        return $categories;
    }

    /**
     * Get categories for content.
     */
    protected function getContentCategories(int $contentUid): array
    {
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('sys_category');

        $statement = $queryBuilder
            ->select('sys_category.title')
            ->from('sys_category')
            ->join(
                'sys_category',
                'sys_category_record_mm',
                'mm',
                $queryBuilder->expr()->eq('sys_category.uid', $queryBuilder->quoteIdentifier('mm.uid_local'))
            )
            ->where(
                $queryBuilder->expr()->eq('mm.uid_foreign', $contentUid),
                $queryBuilder->expr()->eq('mm.tablenames', $queryBuilder->createNamedParameter('tt_content'))
            )
            ->execute();

        $categories = [];
        while ($row = $statement->fetchAssociative()) {
            $categories[] = $row['title'];
        }

        return $categories;
    }

    /**
     * Search in pages with filters.
     */
    protected function searchInPagesWithFilters(string $query, array $filters): array
    {
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('pages');

        $searchTerms = '%' . $queryBuilder->escapeLikeWildcards($query) . '%';

        $queryBuilder
            ->select('pages.*')
            ->from('pages')
            ->where(
                $queryBuilder->expr()->or(
                    $queryBuilder->expr()->like('title', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('abstract', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('keywords', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('description', $queryBuilder->createNamedParameter($searchTerms))
                ),
                $queryBuilder->expr()->eq('hidden', 0),
                $queryBuilder->expr()->eq('deleted', 0)
            );

        // Apply date filters
        if (!empty($filters['dateFrom'])) {
            $dateFrom = strtotime((string) $filters['dateFrom']);
            $queryBuilder->andWhere(
                $queryBuilder->expr()->gte('lastUpdated', $dateFrom)
            );
        }

        if (!empty($filters['dateTo'])) {
            $dateTo = strtotime((string) $filters['dateTo']);
            $queryBuilder->andWhere(
                $queryBuilder->expr()->lte('lastUpdated', $dateTo)
            );
        }

        // Apply category filter
        if (!empty($filters['category'])) {
            $queryBuilder
                ->leftJoin(
                    'pages',
                    'sys_category_record_mm',
                    'mm',
                    'mm.uid_foreign = pages.uid AND mm.tablenames = ' . $queryBuilder->createNamedParameter('pages')
                )
                ->andWhere(
                    $queryBuilder->expr()->eq('mm.uid_local', $queryBuilder->createNamedParameter((int) $filters['category']))
                );
        }

        $results = [];
        $statement = $queryBuilder->execute();

        while ($row = $statement->fetchAssociative()) {
            // Build URL
            if (!empty($row['slug'])) {
                $url = $row['slug'];
                if (!str_starts_with((string) $url, '/')) {
                    $url = '/' . $url;
                }
            } else {
                $url = '/index.php?id=' . $row['uid'];
            }

            $results[] = [
                'title' => $row['title'],
                'abstract' => $row['abstract'] ?: $this->getTranslation('search.results.nodescription'),
                'url' => $url,
                'date' => $row['lastUpdated'] ?: $row['crdate'],
                'type' => 'page',
                'categories' => $this->getPageCategories($row['uid']),
            ];
        }

        return $results;
    }

    /**
     * Search in content with filters.
     */
    protected function searchInContentWithFilters(string $query, array $filters): array
    {
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('tt_content');

        $searchTerms = '%' . $queryBuilder->escapeLikeWildcards($query) . '%';

        $queryBuilder
            ->select('tt_content.*', 'pages.title as page_title', 'pages.slug as page_slug')
            ->from('tt_content')
            ->leftJoin(
                'tt_content',
                'pages',
                'pages',
                $queryBuilder->expr()->eq('pages.uid', $queryBuilder->quoteIdentifier('tt_content.pid'))
            )
            ->where(
                $queryBuilder->expr()->or(
                    $queryBuilder->expr()->like('tt_content.header', $queryBuilder->createNamedParameter($searchTerms)),
                    $queryBuilder->expr()->like('tt_content.bodytext', $queryBuilder->createNamedParameter($searchTerms))
                ),
                $queryBuilder->expr()->eq('tt_content.hidden', 0),
                $queryBuilder->expr()->eq('tt_content.deleted', 0)
            );

        // Apply content type filter
        if ('all' !== $filters['contentType'] && !empty($filters['contentType'])) {
            $queryBuilder->andWhere(
                $queryBuilder->expr()->eq('tt_content.CType', $queryBuilder->createNamedParameter($filters['contentType']))
            );
        }

        // Apply date filters
        if (!empty($filters['dateFrom'])) {
            $dateFrom = strtotime((string) $filters['dateFrom']);
            $queryBuilder->andWhere(
                $queryBuilder->expr()->gte('tt_content.tstamp', $dateFrom)
            );
        }

        if (!empty($filters['dateTo'])) {
            $dateTo = strtotime((string) $filters['dateTo']);
            $queryBuilder->andWhere(
                $queryBuilder->expr()->lte('tt_content.tstamp', $dateTo)
            );
        }

        $results = [];
        $statement = $queryBuilder->execute();

        while ($row = $statement->fetchAssociative()) {
            $abstract = strip_tags($row['bodytext'] ?? '');
            $abstract = mb_substr($abstract, 0, 150) . (mb_strlen($abstract) > 150 ? '...' : '');

            // Build URL
            if (!empty($row['page_slug'])) {
                $url = $row['page_slug'];
                if (!str_starts_with((string) $url, '/')) {
                    $url = '/' . $url;
                }

                $url .= '#c' . $row['uid'];
            } else {
                $url = '/index.php?id=' . $row['pid'] . '#c' . $row['uid'];
            }

            $results[] = [
                'title' => $row['header'] ?: $row['page_title'],
                'abstract' => $abstract ?: $this->getTranslation('search.results.nodescription'),
                'url' => $url,
                'page' => $row['page_title'],
                'date' => $row['tstamp'] ?: $row['crdate'],
                'type' => 'content',
                'contentType' => $row['CType'],
                'categories' => $this->getContentCategories($row['uid']),
            ];
        }

        return $results;
    }

    /**
     * Sort results based on selected criteria.
     */
    protected function sortResults(array $results, string $sortBy): array
    {
        match ($sortBy) {
            'date_desc' => usort($results, static fn (array $a, array $b): int|float => ($b['date'] ?? 0) - ($a['date'] ?? 0)),
            'date_asc' => usort($results, static fn (array $a, array $b): int|float => ($a['date'] ?? 0) - ($b['date'] ?? 0)),
            'title' => usort($results, static fn (array $a, array $b): int => strcasecmp((string) $a['title'], (string) $b['title'])),
            default => $results,
        };

        return $results;
    }

    /**
     * Get all available categories.
     */
    protected function getAvailableCategories(): array
    {
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('sys_category');

        $statement = $queryBuilder
            ->select('uid', 'title')
            ->from('sys_category')
            ->where(
                $queryBuilder->expr()->eq('deleted', 0),
                $queryBuilder->expr()->eq('hidden', 0)
            )
            ->orderBy('title')
            ->execute();

        $categories = [];
        while ($row = $statement->fetchAssociative()) {
            $categories[] = [
                'uid' => $row['uid'],
                'title' => $row['title'],
            ];
        }

        return $categories;
    }

    /**
     * Get search suggestions for autocomplete.
     */
    protected function getSuggestions(string $query, int $limit = 10): array
    {
        $suggestions = [];
        $queryBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
            ->getQueryBuilderForTable('pages');

        $searchTerm = $queryBuilder->escapeLikeWildcards($query) . '%';

        // Search in pages
        $statement = $queryBuilder
            ->select('uid', 'title', 'slug')
            ->from('pages')
            ->where(
                $queryBuilder->expr()->or(
                    $queryBuilder->expr()->like('title', $queryBuilder->createNamedParameter($searchTerm)),
                    $queryBuilder->expr()->like('keywords', $queryBuilder->createNamedParameter($searchTerm))
                ),
                $queryBuilder->expr()->eq('hidden', 0),
                $queryBuilder->expr()->eq('deleted', 0)
            )
            ->orderBy('title')
            ->setMaxResults($limit)
            ->execute();

        while ($row = $statement->fetchAssociative()) {
            $url = empty($row['slug']) ? '/index.php?id=' . $row['uid'] : $row['slug'];
            if (!str_starts_with((string) $url, '/')) {
                $url = '/' . $url;
            }

            $suggestions[] = [
                'title' => $row['title'],
                'url' => $url,
                'type' => 'page',
            ];
        }

        // Also search in content elements if we have less than limit
        if (count($suggestions) < $limit) {
            $contentBuilder = GeneralUtility::makeInstance(ConnectionPool::class)
                ->getQueryBuilderForTable('tt_content');

            $contentStatement = $contentBuilder
                ->select('tt_content.uid', 'tt_content.header', 'tt_content.pid', 'pages.slug', 'pages.title as page_title')
                ->from('tt_content')
                ->leftJoin(
                    'tt_content',
                    'pages',
                    'pages',
                    $contentBuilder->expr()->eq('pages.uid', $contentBuilder->quoteIdentifier('tt_content.pid'))
                )
                ->where(
                    $contentBuilder->expr()->like('tt_content.header', $contentBuilder->createNamedParameter($searchTerm)),
                    $contentBuilder->expr()->eq('tt_content.hidden', 0),
                    $contentBuilder->expr()->eq('tt_content.deleted', 0),
                    $contentBuilder->expr()->neq('tt_content.header', $contentBuilder->createNamedParameter(''))
                )
                ->orderBy('tt_content.header')
                ->setMaxResults($limit - count($suggestions))
                ->execute();

            while ($row = $contentStatement->fetchAssociative()) {
                $url = empty($row['slug']) ? '/index.php?id=' . $row['pid'] : $row['slug'];
                if (!str_starts_with((string) $url, '/')) {
                    $url = '/' . $url;
                }

                $url .= '#c' . $row['uid'];

                $suggestions[] = [
                    'title' => $row['header'],
                    'subtitle' => 'in: ' . $row['page_title'],
                    'url' => $url,
                    'type' => 'content',
                ];
            }
        }

        // Get popular search terms from history (if implemented)
        $popularTerms = $this->getPopularSearchTerms($query, 5);
        foreach ($popularTerms as $term) {
            $suggestions[] = [
                'title' => $term,
                'url' => '/search?q=' . urlencode((string) $term),
                'type' => 'search',
            ];
        }

        return $suggestions;
    }

    /**
     * Get popular search terms (placeholder for future implementation).
     */
    protected function getPopularSearchTerms(string $query, int $limit = 5): array
    {
        // This could be implemented with a search history table
        // For now, return some example terms
        $popularTerms = [
            'TYPO3', 'Headless', 'PWA', 'Content', 'News',
            'Products', 'Services', 'Contact', 'About', 'Documentation',
        ];

        $filtered = array_filter($popularTerms, static fn (string $term): bool => false !== stripos($term, $query) && strtolower($term) !== strtolower($query));

        return array_slice($filtered, 0, $limit);
    }

    /**
     * Return JSON response for suggestions.
     */
    protected function createJsonResponse(array $data): ResponseInterface
    {
        return new JsonResponse($data);
    }

    /**
     * Get translation for a given key.
     *
     * @param string $key       Translation key
     * @param array  $arguments Optional arguments for sprintf
     *
     * @return string Translated text
     */
    protected function getTranslation(string $key, array $arguments = []): string
    {
        $translation = LocalizationUtility::translate(
            'LLL:EXT:pixelcoda_search/Resources/Private/Language/locallang.xlf:' . $key,
            'PixelcodaSearch'
        ) ?? $key;

        if ([] !== $arguments) {
            return vsprintf($translation, $arguments);
        }

        return $translation;
    }
}
