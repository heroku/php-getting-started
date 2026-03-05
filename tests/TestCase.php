<?php

declare(strict_types=1);

namespace Tests;

use Exception;
use Monolog\Handler\TestHandler;
use Monolog\Level;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;
use Slim\App;
use Slim\Psr7\Factory\StreamFactory;
use Slim\Psr7\Headers;
use Slim\Psr7\Request as SlimRequest;
use Slim\Psr7\Uri;

class TestCase extends \PHPUnit\Framework\TestCase
{
  private ?App $app = null;
  private ?TestHandler $logger = null;

  /**
    * @return App
    * @throws Exception
    */
  protected function getAppInstance(): App
  {
    if ($this->app) return $this->app;
    
    $this->app = require(__DIR__.'/../app/bootstrap.php');
    $this->logger = new TestHandler();
    
    $logger = $this->app->getContainer()->get(LoggerInterface::class);
    $logger->pushHandler($this->logger, Level::Debug);
    
    return $this->app;
  }

  /**
    * @return ErrorHandler
    * @throws Exception
    */
  protected function getLogger(): TestHandler
  {
    $this->getAppInstance();
    return $this->logger;
  }

  /**
    * @param string $method
    * @param string $path
    * @param array  $headers
    * @param array  $cookies
    * @param array  $serverParams
    * @return Request
    */
  protected function createRequest(
    string $method,
    string $path,
    array $headers = ['HTTP_ACCEPT' => 'application/json'],
    array $cookies = [],
    array $serverParams = []
  ): Request {
    $uri = new Uri('', '', 80, $path);
    $handle = fopen('php://temp', 'w+');
    $stream = (new StreamFactory())->createStreamFromResource($handle);

    $h = new Headers();
    foreach ($headers as $name => $value) {
        $h->addHeader($name, $value);
    }

    return new SlimRequest($method, $uri, $h, $cookies, $serverParams, $stream);
  }
}
