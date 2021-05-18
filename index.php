<html>
 <head>
	<meta charset="utf8">
 </head>
 <body>
	<lable>Nhập thông tin</label>
	<form method="get" action ="index.php">
		<lable>Họ tên</label><input name="ten"  type="text">
		<label>Email</label><input type="text" name="mail">
		<input type="submit" value="submit">	
	</form>
	<?php
		if(isset($_GET["ten"])){
			$ten=$_GET["ten"];
			$mail=$_GET["mail"];
			echo "\n Chào bạn $ten, email của bạn là $mail";}
	?>
	<br>
        <br><a href="mytable.php"> Create table MyTable </a>
	<br><a href="setup.php"> Create table MyAcc </a>
	<br><a href="add_account.php">Add Account</a>
	<br><a href="list_account.php">List Acount </a>
        <h3> Hoan Thanh Bai Tap nhom </h3>	
 </body>
</html>
