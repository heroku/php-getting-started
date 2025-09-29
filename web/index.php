<?php

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;
use DI\Container;
use DI\Bridge\Slim\Bridge;
use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\Logger;
use Slim\Factory\AppFactory;
use Slim\Views\Twig;

require(__DIR__.'/../vendor/autoload.php');

// Create DI container
$container = new Container();
// Add Twig to Container
$container->set(Twig::class, function() {
  return Twig::create(__DIR__.'/../views');
});
// Add Monolog to Container
$container->set(LoggerInterface::class, function () {
  $logger = new Logger('default');
  $logger->pushHandler(new StreamHandler('php://stderr'), Level::Debug);
  return $logger;
});
// Add Cowsay to Container
$container->set(\Cowsayphp\AnimalInterface::class, function() {
  $class = '\\Cowsayphp\\Farm\\'.(getenv("COWSAY_FARM_CLASS")?:'Cow');
  return \Cowsayphp\Farm::create($class);
});
// Add Database connection to Container
$container->set(PDO::class, function() {
  $dburl = parse_url(getenv('DATABASE_URL') ?: throw new Exception('no DATABASE_URL'));
  return new PDO(sprintf(
    "pgsql:host=%s;port=%s;dbname=%s;user=%s;password=%s",
    $dburl['host'],
    $dburl['port'],
    ltrim($dburl['path'], '/'), // URL path is the DB name, must remove leading slash
    $dburl['user'],
    $dburl['pass'],
  ));
});

// Create main Slim app
$app = Bridge::create($container);
$app->addErrorMiddleware(true, false, false);

// Our web handlers
$app->get('/', function(Request $request, Response $response, LoggerInterface $logger, Twig $twig) {
  $logger->debug('logging output.');
  return $twig->render($response, 'index.twig');
});
$app->get('/coolbeans', function(Request $request, Response $response, LoggerInterface $logger, \Cowsayphp\AnimalInterface $animal) {
  $logger->debug('letting the Cowsay library write something cool.');
  $response->getBody()->write("<pre>".$animal->say("Cool beans")."</pre>");
  return $response;
});
$app->get('/db', function(Request $request, Response $response, LoggerInterface $logger, Twig $twig, PDO $pdo) {
  $st = $pdo->prepare('SELECT name FROM test_table');
  $st->execute();
  $names = array();
  while($row = $st->fetch(PDO::FETCH_ASSOC)) {
    $logger->debug('Row ' . $row['name']);
    $names[] = $row;
  }
  return $twig->render($response, 'database.twig', [
    'names' => $names,
  ]);
});

$app->run();
