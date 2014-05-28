<?php

require('../vendor/autoload.php');

$app = new Silex\Application();
//$app['debug'] = true;

// Register the monolog logging service
$app->register(new Silex\Provider\MonologServiceProvider(), array(
  'monolog.logfile' => 'php://stderr',
));

// Register the Twig templating engine
$app->register(new Silex\Provider\TwigServiceProvider(), array(
    'twig.path' => __DIR__.'/views',
));


// Our web handlers

$app->get('/', function () use ($app) {
  $app['monolog']->addDebug('Monolog logging output.');
  return 'Hello';
});

$app->get('/foo/', function () use ($app) {
  return 'Some other output at /foo';
});

$app->get('/twig/{name}', function ($name) use ($app) {
    return $app['twig']->render('index.twig', array(
        'name' => $name,
    ));
});


$app->run();

?>
