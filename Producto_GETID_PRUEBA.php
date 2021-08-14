<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='GET'){
		try{
			$respuesta = SQLGlobal::selectObject("select * from producto where id=2");//sin filtro ("No incluir filtros ni '?'")
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