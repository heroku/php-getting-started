<?php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use DI\Container;
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
AppFactory::setContainer($container);

// Create main Slim app
$app = AppFactory::create();
$app->addErrorMiddleware(true, false, false);
$app->add(TwigMiddleware::createFromContainer($app));

// // Register the monolog logging service
// $app->register(new Silex\Provider\MonologServiceProvider(), array(
//   'monolog.logfile' => 'php://stderr',
// ));

// Our web handlers
$app->get('/', function(Request $request, Response $response, $args) {
  // $app['monolog']->addDebug('logging output.');
  return $this->get('view')->render($response, 'index.twig');
});

$app->run();
