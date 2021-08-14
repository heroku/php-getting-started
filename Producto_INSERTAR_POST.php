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
				"insert into producto values(?, ?, ?, ?)",
				array($codigo, $descripcion, $precio, $categoria)
			);//con filtro ("El tamaño del array debe ser igual a la cantidad de los '?'")
			if($respuesta>0){
                echo json_encode(array(
                    'respuesta'=>'200',
                    'estado' => 'Se insertó correctamente el producto',
                    'data'=>'El número de registros afectados es: '.$respuesta,
                    'error'=>''
                ));
            }else{
                echo json_encode(array(
                    'respuesta'=>'100',
                    'estado' => 'No se insertó correctamente el producto',
                    'data'=>'El número de registros afectados es: '.$respuesta,
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