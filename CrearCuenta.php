<?php
	require 'SQLGlobal.php';

	if($_SERVER['REQUEST_METHOD']=='POST'){
		try{
			$datos = json_decode(file_get_contents("php://input"),true);

			$dni=$datos["dni"]; // obtener parametros POST
            $contrasena=$datos["contrasena"];
            $nombre=$datos["nombre"];
            $apellidoPat=$datos["apellidoPat"];
            $apellidoMat=$datos["apellidoMat"];
			//$respuesta = SQLGlobal::query("QUERY");//sin filtro ("No incluir filtros ni '?'")
			$respuesta = SQLGlobal::cudFiltro(
				"insert into persona values(?, ?, ?, ?, ?)",
				array($dni, $contrasena, $nombre, $apellidoPat, $apellidoMat)
			);//con filtro ("El tamaño del array debe ser igual a la cantidad de los '?'")
			if($respuesta>0){
                echo json_encode(array(
                    'respuesta'=>'200',
                    'estado' => 'Registro exitoso',
                    'data'=>$respuesta,
                    'error'=>''
                ));
            }else{
                echo json_encode(array(
                    'respuesta'=>'100',
                    'estado' => 'No se pudo registrar',
                    'data'=>$respuesta,
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