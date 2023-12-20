<?php
if(!empty($_GET['id-user']))
{
    include_once("../php/config.php");
    $id_user = $_GET['id-user'];
    $id_alimento = $_GET['id-alimento'];

    $querySelect = "SELECT * FROM `alimento` WHERE `id-user`= $id_user and `id-alimento` = $id_alimento";

    $result = $connect->query($querySelect);
    if($result->num_rows > 0)
    {
        $queryDelete = "DELETE FROM `alimento` WHERE `id-user`= $id_user and `id-alimento` = $id_alimento";
        $resultDelete = $connect ->query($queryDelete);
        echo "<script> alert('Alimento excluído com sucesso!'); window.location.href = '../pages/home.php'; </script>";
    };
};


?>