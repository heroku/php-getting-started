<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='POST'){
		try{
			$datos = json_decode(file_get_contents("php://input"),true);

			$codigo = $datos["codigo"]; // obtener parametros POST
			$descripcion = $datos["descripcion"];
            $precio = $datos["precio"];
            $categoria = $datos["categoria"];
            
			$respuesta = SQLGlobal::cudFiltro(
				"update producto set descripcion_producto=?, precio=?, id_categoria=? where id_producto=?",
				array($descripcion, $precio, $categoria, $codigo)
			);//con filtro ("El tamaño del array debe ser igual a la cantidad de los '?'")
			if($respuesta>0){
                echo json_encode(array(
                    'respuesta'=>'200',
                    'estado' => 'Se actualizó correctamente el producto',
                    'data'=>'Número de filas afectadas: '.$respuesta,
                    'error'=>''
                ));
            }else{
                echo json_encode(array(
                    'respuesta'=>'100',
                    'estado' => 'El código del producto no existe',
                    'data'=>$respuesta,
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