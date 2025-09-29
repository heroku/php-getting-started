<?php

declare(strict_types=1);

namespace PixelCoda\PixelcodaSearch\Tests\Unit\Controller;

use PHPUnit\Framework\MockObject\MockObject;
use PixelCoda\PixelcodaSearch\Controller\SearchController;
use ReflectionClass;
use TYPO3\CMS\Extbase\Mvc\Request;
use TYPO3\CMS\Fluid\View\TemplateView;
use TYPO3\TestingFramework\Core\Unit\UnitTestCase;

/**
 * Test case for SearchController.
 */
class SearchControllerTest extends UnitTestCase
{
    protected bool $resetSingletonInstances = true;

    protected MockObject $subject;

    protected MockObject $viewMock;

    protected MockObject $requestMock;

    protected function setUp(): void
    {
        parent::setUp();

        $this->subject = $this->getMockBuilder(SearchController::class)
            ->onlyMethods(['htmlResponse', 'createJsonResponse'])
            ->disableOriginalConstructor()
            ->getMock();

        $this->viewMock = $this->createMock(TemplateView::class);
        $this->requestMock = $this->createMock(Request::class);

        // Inject mocks
        $this->inject($this->subject, 'view', $this->viewMock);
        $this->inject($this->subject, 'request', $this->requestMock);
    }

    /**
     * @test
     */
    public function indexActionReturnsHtmlResponse(): void
    {
        $this->subject->expects($this->once())
            ->method('htmlResponse');

        $this->subject->indexAction();
    }

    /**
     * @test
     */
    public function suggestActionReturnsEmptyJsonForShortQuery(): void
    {
        $this->markTestSkipped('Needs refactoring - suggestAction uses request directly');
    }

    /**
     * @test
     */
    public function suggestActionCallsGetSuggestionsForValidQuery(): void
    {
        $this->markTestSkipped('Needs refactoring - suggestAction uses request directly');
    }

    /**
     * @test
     */
    public function searchActionHandlesPagination(): void
    {
        $this->markTestSkipped('Needs refactoring to avoid LocalizationUtility dependencies');
    }

    /**
     * @test
     *
     * @dataProvider filterDataProvider
     */
    public function searchActionProcessesFiltersCorrectly(array $params, array $expectedFilters): void
    {
        $this->markTestSkipped('Needs refactoring to avoid LocalizationUtility dependencies');
    }

    public function filterDataProvider(): array
    {
        return [
            'with category filter' => [
                ['q' => 'test', 'category' => '5'],
                [
                    'category' => '5',
                    'dateFrom' => '',
                    'dateTo' => '',
                    'contentType' => 'all',
                    'searchIn' => ['pages' => true, 'content' => true, 'news' => false],
                    'sort' => 'relevance',
                ],
            ],
            'with date range' => [
                ['q' => 'test', 'date_from' => '2024-01-01', 'date_to' => '2024-12-31'],
                [
                    'category' => '',
                    'dateFrom' => '2024-01-01',
                    'dateTo' => '2024-12-31',
                    'contentType' => 'all',
                    'searchIn' => ['pages' => true, 'content' => true, 'news' => false],
                    'sort' => 'relevance',
                ],
            ],
            'with sort order' => [
                ['q' => 'test', 'sort' => 'date_desc'],
                [
                    'category' => '',
                    'dateFrom' => '',
                    'dateTo' => '',
                    'contentType' => 'all',
                    'searchIn' => ['pages' => true, 'content' => true, 'news' => false],
                    'sort' => 'date_desc',
                ],
            ],
        ];
    }

    /**
     * Helper method to inject properties.
     *
     * @param mixed $object
     * @param mixed $value
     */
    protected function inject($object, string $property, $value): void
    {
        $reflection = new ReflectionClass($object);
        $property = $reflection->getProperty($property);
        $property->setValue($object, $value);
    }
}
