<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='POST'){
		try{
			$datos = json_decode(file_get_contents("php://input"),true);

			$palabra = $datos["palabra"]; // obtener parametros POST
			$respuesta = SQLGlobal::selectArrayFiltro(
				"select * from producto where lower(descripcion) like lower(?)",
				array($palabra.'%')
			);//con filtro ("El tamaño del array debe ser igual a la cantidad de los '?'")
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
					'estado' => 'Ocurrio un error, intentelo mas tarde',
					'data'=>'',
					'error'=>$e->getMessage())
			);
		}
	}

?>