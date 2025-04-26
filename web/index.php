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

// Create main Slim app
$app = Bridge::create($container);
$app->addErrorMiddleware(true, false, false);

// Our web handlers
$app->get('/', function(Request $request, Response $response, LoggerInterface $logger, Twig $twig) {
  $logger->debug('logging output.');
  return $twig->render($response, 'index.twig');
});

$app->get('/books', function(Request $request, Response $response, LoggerInterface $logger, Twig $twig, PDO $pdo) {
    $books = getBooks();
    return $twig->render($response, 'books.twig', [
      'books' => $books,
    ]);
});

function getBooks() {
  $books = [
        [
            'title' => 'To Kill a Mockingbird',
            'author' => 'Harper Lee',
            'description' => 'A novel about the serious issues of rape and racial inequality.',
            'pages' => 281
        ],
        [
            'title' => '1984',
            'author' => 'George Orwell',
            'description' => 'A dystopian novel set in a totalitarian society under constant surveillance.',
            'pages' => 328
        ],
        [
            'title' => 'The Great Gatsby',
            'author' => 'F. Scott Fitzgerald',
            'description' => 'A story about the jazz age and the elusive American dream.',
            'pages' => 180
        ],
        [
            'title' => 'Brave New World',
            'author' => 'Aldous Huxley',
            'description' => 'A novel exploring futuristic society and the loss of individuality.',
            'pages' => 268
        ]
    ];
}

$app->run();
