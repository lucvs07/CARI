<?php
    session_start();
    $search = $_POST['procura'];
    $_SESSION['procura'] = $search ;
    header('location:../pages/home.php');
    ?>