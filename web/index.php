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

$dbopts = parse_url(getenv('CLEARDB_DATABASE_URL'));
$app->register(new Silex\Provider\DoctrineServiceProvider(), array(
    'db.options' => array(
    	'driver' => 'pdo_mysql',
	'host'	 => $dbopts["host"],
	'user'	 => $dbopts["user"],
	'password'  => $dbopts["pass"],
	'port'	    => $dbopts["port"],
	'dbname'    => substr($dbopts["path"], 1),
    ),
));

// Function to get the client ip address
function get_client_ip_server() {
$ipaddress = '';
if ($_SERVER['HTTP_CLIENT_IP'])
$ipaddress = $_SERVER['HTTP_CLIENT_IP'];
else if($_SERVER['HTTP_X_FORWARDED_FOR'])
$ipaddress = $_SERVER['HTTP_X_FORWARDED_FOR'];
else if($_SERVER['HTTP_X_FORWARDED'])
$ipaddress = $_SERVER['HTTP_X_FORWARDED'];
else if($_SERVER['HTTP_FORWARDED_FOR'])
$ipaddress = $_SERVER['HTTP_FORWARDED_FOR'];
else if($_SERVER['HTTP_FORWARDED'])
$ipaddress = $_SERVER['HTTP_FORWARDED'];
else if($_SERVER['REMOTE_ADDR'])
$ipaddress = $_SERVER['REMOTE_ADDR'];
else
$ipaddress = 'UNKNOWN';

return $ipaddress;
}
// Our web handlers

$app->get('/', function() use($app) {
  return "<p>hello</p>";
  //$app['monolog']->addDebug('logging output.');
  //return $app['twig']->render('index.twig');
});

$app->get('/log', function() use($app) {
	$sql = "insert into acc_log (ip, uri, agent) values (?,?,?)";
	$ip =get_client_ip_server();
	$uri =$_SERVER['REQUEST_URI'];
	$agent = get_browser();
	$app['db']->executeUpdate($sql, array($ip, $uri, $agent));
	return "<p>stored : $ip</p>".
	       "<p>$uri</p>".
	       "<p>$agent</p>";
});

$app->run();
