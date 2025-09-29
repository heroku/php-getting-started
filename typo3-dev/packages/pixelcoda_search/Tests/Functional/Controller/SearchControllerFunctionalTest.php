<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Tests\Functional\Controller;

use TYPO3\TestingFramework\Core\Functional\Framework\Frontend\InternalRequest;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;

/**
 * Functional test for SearchController.
 */
class SearchControllerFunctionalTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = [
        'typo3conf/ext/pixelcoda_search',
    ];

    protected array $coreExtensionsToLoad = [
        'fluid',
        'fluid_styled_content',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->importCSVDataSet(__DIR__ . '/../Fixtures/pages.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/tt_content.csv');
        $this->importCSVDataSet(__DIR__ . '/../Fixtures/sys_category.csv');

        $this->setUpFrontendRootPage(
            1,
            ['EXT:pixelcoda_search/Tests/Functional/Fixtures/TypoScript/setup.typoscript']
        );
    }

    /**
     * @test
     */
    public function searchFindsPagesByTitle(): void
    {
        $response = $this->executeFrontendSubRequest(
            $this->buildRequest('/search?q=test')
        );

        $content = (string) $response->getBody();

        self::assertStringContainsString('Test Page', $content);
        self::assertStringContainsString('search-result-item', $content);
    }

    /**
     * @test
     */
    public function searchFindsContentElements(): void
    {
        $response = $this->executeFrontendSubRequest(
            $this->buildRequest('/search?q=content')
        );

        $content = (string) $response->getBody();

        self::assertStringContainsString('Test Content', $content);
        self::assertStringContainsString('search-result-item', $content);
    }

    /**
     * @test
     */
    public function searchFiltersByCategory(): void
    {
        $response = $this->executeFrontendSubRequest(
            $this->buildRequest('/search?q=test&category=1')
        );

        $content = (string) $response->getBody();

        self::assertStringContainsString('Category Test Page', $content);
        self::assertStringNotContainsString('Uncategorized Page', $content);
    }

    /**
     * @test
     */
    public function searchPaginationWorks(): void
    {
        $response = $this->executeFrontendSubRequest(
            $this->buildRequest('/search?q=test&page=2')
        );

        $content = (string) $response->getBody();

        self::assertStringContainsString('pagination', $content);
        self::assertStringContainsString('page=1', $content);
    }

    /**
     * @test
     */
    public function suggestEndpointReturnsJson(): void
    {
        $response = $this->executeFrontendSubRequest(
            $this->buildRequest('/index.php?eID=search_suggest&q=test')
        );

        $content = (string) $response->getBody();
        $json = json_decode($content, true);

        self::assertIsArray($json);
        self::assertNotEmpty($json);
        self::assertArrayHasKey('title', $json[0]);
        self::assertArrayHasKey('url', $json[0]);
        self::assertArrayHasKey('type', $json[0]);
    }

    /**
     * @test
     */
    public function searchSortsResultsCorrectly(): void
    {
        $response = $this->executeFrontendSubRequest(
            $this->buildRequest('/search?q=test&sort=title')
        );

        $content = (string) $response->getBody();

        // Check if results are present and sorted
        self::assertStringContainsString('search-result-item', $content);

        // Extract titles and verify alphabetical order
        preg_match_all('/<h2 class="search-result-title">(.*?)<\/h2>/s', $content, $matches);

        if (count($matches[1]) > 1) {
            $titles = array_map('strip_tags', $matches[1]);
            $sortedTitles = $titles;
            sort($sortedTitles);

            self::assertEquals($sortedTitles, $titles);
        }
    }

    /**
     * @test
     */
    public function searchHandlesSpecialCharacters(): void
    {
        $specialQueries = [
            'test&special',
            'test<script>',
            'test"quote',
            "test'apostrophe",
        ];

        foreach ($specialQueries as $query) {
            $response = $this->executeFrontendSubRequest(
                $this->buildRequest('/search?q=' . urlencode($query))
            );

            $content = (string) $response->getBody();

            // Should not break and should escape properly
            self::assertStringNotContainsString('<script>', $content);
            self::assertStringContainsString('search-results-container', $content);
        }
    }

    /**
     * @test
     */
    public function emptySearchShowsNoResults(): void
    {
        $response = $this->executeFrontendSubRequest(
            $this->buildRequest('/search?q=')
        );

        $content = (string) $response->getBody();

        self::assertStringContainsString('search-results-container', $content);
        self::assertStringNotContainsString('search-result-item', $content);
    }

    /**
     * @test
     */
    public function searchWithDateRangeFilter(): void
    {
        $response = $this->executeFrontendSubRequest(
            $this->buildRequest('/search?q=test&date_from=2024-01-01&date_to=2024-12-31')
        );

        $content = (string) $response->getBody();

        self::assertStringContainsString('search-results-container', $content);
        self::assertStringContainsString('filter-tag', $content);
    }

    /**
     * Build a frontend request.
     */
    protected function buildRequest(string $uri): InternalRequest
    {
        $request = new InternalRequest($uri);
        $parsedUrl = parse_url($uri);
        if (isset($parsedUrl['query']) && ('' !== $parsedUrl['query'] && '0' !== $parsedUrl['query'])) {
            parse_str($parsedUrl['query'], $queryParams);
            $request = $request->withQueryParameters($queryParams);
        }

        return $request;
    }

    /**
     * Parse query string from URI.
     */
    protected function parseQueryString(string $uri): array
    {
        $parts = parse_url($uri);
        parse_str($parts['query'] ?? '', $params);

        return $params;
    }
}
