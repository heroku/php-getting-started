<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Eid;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Http\JsonResponse;
use TYPO3\CMS\Core\Utility\GeneralUtility;

/**
 * EID handler for search suggestions.
 */
class SuggestEid
{
    /**
     * Process the AJAX request.
     */
    public function processRequest(ServerRequestInterface $request): ResponseInterface
    {
        $params = $request->getQueryParams();
        $query = trim($params['q'] ?? '');

        // Return empty if query is too short
        if (strlen($query) < 2) {
            return new JsonResponse([]);
        }

        $suggestions = $this->getSuggestions($query);

        return new JsonResponse($suggestions);
    }

    /**
     * Get search suggestions.
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

        // Add popular search terms
        $popularTerms = $this->getPopularSearchTerms($query, 3);
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
     * Get popular search terms.
     */
    protected function getPopularSearchTerms(string $query, int $limit = 5): array
    {
        $popularTerms = [
            'TYPO3', 'Headless', 'PWA', 'Content', 'News',
            'Products', 'Services', 'Contact', 'About', 'Documentation',
        ];

        $filtered = array_filter($popularTerms, static fn (string $term): bool => false !== stripos($term, $query) && strtolower($term) !== strtolower($query));

        return array_slice($filtered, 0, $limit);
    }
}
