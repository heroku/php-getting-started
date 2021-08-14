<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='POST'){
		try{
			$datos = json_decode(file_get_contents("php://input"),true);

			$dni = $datos['dni']; // obtener parametros POST
			$respuesta = SQLGlobal::selectObjectFiltro(
				"select * from persona where dni=?",
				array($dni)
			);//con filtro ("El tamaño del array debe ser igual a la cantidad de los '?'")
			if($respuesta){
                echo json_encode(array(
                    'respuesta'=>'200',
                    'estado' => 'Usuario logeado',
                    'data'=>$respuesta,
                    'error'=>''
                ));
            }else{
                echo json_encode(array(
                    'respuesta'=>'100',
                    'estado' => 'Usuario no existe',
                    'error'=>''
                ));
            }
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