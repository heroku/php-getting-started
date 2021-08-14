<?php

error_reporting(E_ALL ^ E_DEPRECATED);

require_once 'db_config.php';

class Database{
    private static $db = null;
    private static $pdo;

    final private function __construct(){
        try {
            self::getDb();
        } catch (PDOException $e) {
        }
    }
    public static function getInstance(){
        if (self::$db === null) {
            self::$db = new self();
        }
        return self::$db;
    }

    public function getDb(){
        if (self::$pdo == null) {
            self::$pdo = new PDO(
                'pgsql:dbname=' . DB_DATABASE .';host=' . DB_SERVER .';',
                DB_USER,
                DB_PASSWORD
            );

            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        }

        return self::$pdo;
    }
    final protected function __clone()
    {
    }

    function _destructor()
    {
        self::$pdo = null;
    }
}

?>