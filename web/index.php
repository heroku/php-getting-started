<?php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;
use DI\Container;
use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\Logger;
use Slim\Factory\AppFactory;
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;

require(__DIR__.'/../vendor/autoload.php');

// Create DI container
$container = new Container();
// Add Twig to Container
$container->set('view', function() {
  return Twig::create(__DIR__.'/views');
});
// Add Monolog to Container
$container->set(LoggerInterface::class, function () {
  $logger = new Logger('default');
  $logger->pushHandler(new StreamHandler('php://stderr'), Level::Debug);
  return $logger;
});
AppFactory::setContainer($container);

// Create main Slim app
$app = AppFactory::create();
$app->addErrorMiddleware(true, false, false);
$app->add(TwigMiddleware::createFromContainer($app));

// Our web handlers
$app->get('/', function(Request $request, Response $response, $args) {
  $this->get(LoggerInterface::class)->debug('logging output.');
  return $this->get('view')->render($response, 'index.twig');
});

$app->run();
