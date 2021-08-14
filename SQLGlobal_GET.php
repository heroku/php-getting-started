<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='GET'){
		try{
			//$id = $_GET['id']; // obtener parametros GET
			//$respuesta = SQLGlobal::query("QUERY");//sin filtro ("No incluir filtros ni '?'")
			$respuesta = SQLGlobal::queryFiltro(
				"QUERY WHERE A = ? AND B = ? AND C = ?",
				array("element1","element2","...")
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