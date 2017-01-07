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

function store_log($app){
	$sql = "insert into acc_log (ip, uri, agent) values (?,?,?)";
	$ip =get_client_ip_server();
	$uri =$_SERVER['REQUEST_URI'];
	$agent = $_SERVER['HTTP_USER_AGENT'];
        $params = array($ip, $uri, $agent);
	$app['db']->executeUpdate($sql, $params);
 return $params;
}
// Our web handlers

$app->get('/', function() use($app) {
        $params = store_log($app);
	return "<p>stored : $params[0]</p>".
	       "<p>$params[1]</p>".
	       "<p>$params[2]</p>";
  //$app['monolog']->addDebug('logging output.');
  //return $app['twig']->render('index.twig');
});

$app->get('/2mb', function() use() {
  return "<img src='/images/2mb.jpg' />";
});

$app->run();
