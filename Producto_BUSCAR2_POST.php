<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='POST'){
		try{
			$datos = json_decode(file_get_contents("php://input"),true);

			$palabra = $datos["palabra"]; // obtener parametros POST
			$respuesta = SQLGlobal::selectArrayFiltro(
				"select distinct(p.id_producto), p.descripcion_producto, p.precio, c.descripcion_categoria from producto p, categoria c 
                where p.id_categoria=c.id_categoria and 
                (lower(p.descripcion_producto) like (lower(?)) or lower(c.descripcion_categoria) like (lower(?))) 
                order by p.id_producto",
                array('%'.$palabra.'%', '%'.$palabra.'%')
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
                    'estado' => 'No se encontraron resultados para esta palabra',
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