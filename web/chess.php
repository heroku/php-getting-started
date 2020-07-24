<?php

include('class/Storage.php');
include('class/SessionStorage.php');
include('class/FileStorage.php');
include('class/Board.php');

$storage = new FileStorage('figures.txt');
$board = new Board($storage);

if(isset($_GET['newFigures'])) 
  echo $board->newFigures();

if(isset($_GET['getFigures']))
  echo $board->getFigures();

if(isset($_GET['moveFigure'])) {
  $frCoord = $_GET['frCoord'];
  $toCoord = $_GET['toCoord'];
  echo $board->moveFigure($frCoord, $toCoord);
}

?>
