<?php

require('../vendor/autoload.php');

$app = new Silex\Application();
$app['debug'] = true;

// Register the monolog logging service
$app->register(new Silex\Provider\MonologServiceProvider(), array(
  'monolog.logfile' => 'php://stderr',
));

// Register view rendering
$app->register(new Silex\Provider\TwigServiceProvider(), array(
    'twig.path' => __DIR__.'/views',
));

// Our web handlers

$app->get('/', function() use($app) {
  $app['monolog']->addDebug('logging output.');
  return $app['twig']->render('index.twig');
});

$app->run();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>PHP Form</title>
    <style>
        form {
            box-sizing: content-box;
            display: flex;
            flex-direction: column;
            width: 250px;
            border: black solid 1px;
            padding: 20px;
            border-radius: 5px;
            -webkit-box-shadow: 6px 6px 8px 0px rgba(34, 60, 80, 0.2);
            -moz-box-shadow: 6px 6px 8px 0px rgba(34, 60, 80, 0.2);
            box-shadow: 6px 6px 8px 0px rgba(34, 60, 80, 0.2);
        }
        body {
            display: flex;
            justify-content: center;
            align-items: flex-start;
        }
        input {
            margin-bottom: 20px;
        }
        input:last-child {
            margin-bottom: 0;
        }
    </style>
</head>
<body>
  <form enctype="multipart/form-data" action="upload.php" method="POST">
    <label for="file_name">Имя файла: </label>
    <input id="file_name" type="text" name="file_name" />
    <input type="file" name="content"/>
    <input type="submit" name="submit" value="Отправить файл" />
  </form>
</body>
</html>


