<?php
    include_once("config.php");

    $erro = "window.location.assign('../pages/cadastro.html')";

    $nome = $_POST['NOME'];
    $email = $_POST['EMAIL'];
    $senha = $_POST['SENHA'];

    $sql = "INSERT INTO `usuarios`( `nome-user`, `senha-user`, `email-user`) VALUES  ('$nome', '$senha', '$email')";

    if ($connect->query($sql) === TRUE) {
        echo "<script> window.location.assign('../pages/login.html') </script>";
      } else {
        echo "<script> alert('não foi realizar o seu cadastro'); $erro </script>";
    }

?>