<?php

declare(strict_types=1);

namespace Tests;

use Tests\TestCase;

class IndexTest extends TestCase
{
  public function testResponds() {
    $app = $this->getAppInstance();

    $request = $this->createRequest("GET", "/");

    $response = $app->handle($request);

    $this->assertEquals(200, $response->getStatusCode());
    $this->assertStringContainsString("Getting Started with PHP on Heroku", (string)$response->getBody());
  }

  public function testLogs() {
    $app = $this->getAppInstance();
    $logger = $this->getLogger();

    $request = $this->createRequest("GET", "/");

    $response = $app->handle($request);

    $this->assertTrue($logger->hasDebugThatContains("logging output."));
  }
}
