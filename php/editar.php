<?php
    include_once("config.php");

    $erro = "window.location.assign(../pages/home.php')";

    if($_POST['nome-alimento-modal'] != ''){
        $nome_alimento = $_POST['nome-alimento-modal'];
    }else{
        echo "<script> alert('Adicione algum alimento'); $erro </script>";
    }
    if($_POST['quantidade-modal'] != ''){
        $quantidade = $_POST['quantidade-modal'];
    }else{
        echo "<script> alert('Insira a quantidade'); $erro </script>";
    }
    if($_POST['medida-modal'] != ''){
        $medida = $_POST['medida-modal'];
    }else{
        echo "<script> alert('Insira a medida'); $erro </script>";
    }

    $id_user = $_POST['id-modal'];
    $id_alimento = $_POST['id-alimento'];


    date_default_timezone_set('America/Sao_Paulo');
    $data = date('y-m-d');
    


    $sql = "UPDATE `alimento` SET `nome-alimento`='$nome_alimento',`quantidade`='$quantidade',`medida`='$medida',`data`='$data' WHERE `id-alimento`='$id_alimento' and `id-user`='$id_user'";
    if ($connect->query($sql) === TRUE) {
        echo "<script> window.location.assign('../pages/home.php') </script>";
      } else {
        echo "<script> alert('não foi possível adicionar o alimento'); $erro </script>";
    }
?>
