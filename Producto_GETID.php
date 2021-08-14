<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='GET'){
		try{
			$codigo = $_GET['codigo']; // obtener parametros GET
			$respuesta = SQLGlobal::selectObjectFiltro(
				"select * from producto where id=?",
				array($codigo)
			);//con filtro ("El tamaño del array debe ser igual a la cantidad de los '?'")
			if($respuesta){
                echo json_encode(array(
                    'respuesta'=>'200',
                    'estado' => 'Se obtuvieron los datos correctamente',
                    'data'=>$respuesta,
                    'error'=>''
                ));
            }else{
                echo json_encode(array(
                    'respuesta'=>'100',
                    'estado' => 'El codigo del producto no existe',
                    'error'=>''
                ));
            }
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