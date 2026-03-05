<?php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;
use Slim\App;
use Slim\Views\Twig;

return function(App $app) {
  // Our web handlers
  $app->get('/', function(Request $request, Response $response, LoggerInterface $logger, Twig $twig) {
    $logger->debug('logging output.');
    return $twig->render($response, 'index.twig');
  });
};
