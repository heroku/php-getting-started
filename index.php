<?php

require('vendor/autoload.php');

use Monolog\Logger;
use Monolog\Handler\StreamHandler;

// create a log channel to STDERR
$log = new Logger('name');
$log->pushHandler(new StreamHandler('php://stderr', Logger::WARNING));

// add records to the log
$log->addWarning("This message will be logged!");


echo "Hello World!";


//$loader = new Twig_Loader_String();
//$twig = new Twig_Environment($loader);
//echo $twig->render('Hello {{ name }}!', array('name' => 'Fabien'));


$loader = new Twig_Loader_Filesystem('templates');
$twig = new Twig_Environment($loader, array(
    'cache' => '/tmp/twig',
));

echo $twig->render('index.twig', array('name' => 'Jon was here'));

?>
