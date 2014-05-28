<?php

require('../vendor/autoload.php');

$app = new Silex\Application();
//$app['debug'] = true;

$app->register(new Silex\Provider\MonologServiceProvider(), array(
  'monolog.logfile' => 'php://stderr',
));

// ... definitions
$app->get('/', function () use ($app) {
  $app['monolog']->addError('Testing the Monolog logging.');
  return 'Hello';
});

$app->get('/foo/', function () use ($app) {
  return 'HelloFoo';
});

// ... definitions
$app->get('/{name}', function ($name) use ($app) {
  return 'Hello '.$app->escape($name);
});


$app->run();


?>
<!--


echo "Hello World!";


$loader = new Twig_Loader_Filesystem('../templates');
$twig = new Twig_Environment($loader, array(
    'cache' => '/tmp/twig',
));

echo $twig->render('index.twig', array('name' => 'Jon was here'));
-->
