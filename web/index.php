<?php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;

require(__DIR__.'/../vendor/autoload.php');

// Create main Slim app
$app = AppFactory::create();
$app->addErrorMiddleware(true, false, false);

// Twig for Views
$app->add(TwigMiddleware::create($app, Twig::create(__DIR__.'/views')));

// // Register the monolog logging service
// $app->register(new Silex\Provider\MonologServiceProvider(), array(
//   'monolog.logfile' => 'php://stderr',
// ));

// Our web handlers
$app->get('/', function(Request $request, Response $response, $args) {
  $twig = Twig::fromRequest($request);
  // $app['monolog']->addDebug('logging output.');
  return $twig->render($response, 'index.twig');
});

$app->run();
