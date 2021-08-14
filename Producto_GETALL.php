<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='GET'){
		try{
			//$id = $_GET['id']; // obtener parametros GET
			$respuesta = SQLGlobal::selectArray("select * from producto");
			echo json_encode(array(
				'respuesta'=>'200',
				'estado' => 'Se obtuvieron los datos correctamente',
				'data'=>$respuesta,
				'error'=>''
			));
		}catch(PDOException $e){
			echo json_encode(
				array(
					'respuesta'=>'-1',
					'estado' => 'Ocurrió un error, inténtelo más tarde',
					'data'=>'',
					'error'=>$e->getMessage())
			);
		}
	}

?>