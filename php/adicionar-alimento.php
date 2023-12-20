<?php
    include_once("config.php");

    $erro = "window.location.assign(../pages/home.php')";

    if($_POST['nome-alimento'] != ''){
        $nome_alimento = $_POST['nome-alimento'];
    }else{
        echo "<script> alert('Adicione algum alimento'); $erro </script>";
    }
    if($_POST['quantidade'] != ''){
        $quantidade = $_POST['quantidade'];
    }else{
        echo "<script> alert('Insira a quantidade'); $erro </script>";
    }
    if($_POST['medida'] != ''){
        $medida = $_POST['medida'];
    }else{
        echo "<script> alert('Insira a medida'); $erro </script>";
    }

    $id_user = $_POST['id'];

    date_default_timezone_set('America/Sao_Paulo');
    $data = date('y-m-d');
    

    $sql = "INSERT INTO alimento ( `id-user`, `nome-alimento`, `quantidade`,`medida`, `data`) VALUES  ($id_user, '$nome_alimento', $quantidade,'$medida', '$data')";


    if ($connect->query($sql) === TRUE) {
        echo "<script> window.location.assign('../pages/home.php') </script>";
      } else {
        echo "<script> alert('não foi possível adicionar o alimento'); $erro </script>";
    }
?>