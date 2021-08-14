<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='GET'){
		try{
			$precio = $_GET['precio']; // obtener parametros GET
			$respuesta = SQLGlobal::selectArrayFiltro(
				"select * from producto where precio>?",
				array($precio)
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