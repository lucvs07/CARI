<?php

   
$connect = new mysqli ("localhost", "root", "usbw", "cari") or die("Erro de conexão"); // Variável que armazena a conexão //
    
$db = mysqli_select_db($connect, "cari"); // abertura com o banco de dados da loja //

mysqli_set_charset($connect, 'utf8');

?>