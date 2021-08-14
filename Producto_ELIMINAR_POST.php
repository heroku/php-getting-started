<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='POST'){
		try{
			$datos = json_decode(file_get_contents("php://input"),true);

			$codigo = $datos["codigo"]; // obtener parametros POST
			$respuesta = SQLGlobal::cudFiltro(
				"delete from producto where id=?",
				array($codigo)
			);//con filtro ("El tamaño del array debe ser igual a la cantidad de los '?'")
			if($respuesta>0){
                echo json_encode(array(
                    'respuesta'=>'200',
                    'estado' => 'Se eliminó correctamente el producto',
                    'data'=>'El número de filas afectadas es: '.$respuesta,
                    'error'=>''
                ));
            }else{
                echo json_encode(array(
                    'respuesta'=>'100',
                    'estado' => 'El código del producto no existe',
                    'data'=>'El número de filas afectadas es: '.$respuesta,
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