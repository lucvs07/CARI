<?php

// as próximas linhas são responsáveis em se conectar com o bando de dados.
include_once("config.php");

// session_start inicia a sessão
session_start();

// as variáveis login e senha recebem os dados digitados na página anterior
$email = $_POST['EMAIL'];
$senha = $_POST['SENHA'];


// A variavel $result pega as varias $login e $senha, faz uma
//pesquisa na tabela de usuarios

$result = mysqli_query($connect, "SELECT * FROM usuarios WHERE `email-user` = '$email' AND `senha-user` = '$senha'");
/* Logo abaixo temos um bloco com if e else, verificando se a variável $result foi
bem sucedida, ou seja se ela estiver encontrado algum registro idêntico o seu valor
será igual a 1, se não, se não tiver registros seu valor será 0. Dependendo do
resultado ele redirecionará para a página site.php ou retornara  para a página
do formulário inicial para que se possa tentar novamente realizar o login */
if(mysqli_num_rows ($result) > 0 )
{
  while($mostrar = mysqli_fetch_array($result)){
    $_SESSION['id-user'] = $mostrar['id-user'];
    $_SESSION['nome-user'] = $mostrar['nome-user'];
    $_SESSION['email'] = $email;
    $_SESSION['senha'] = $senha;
  }
    header('location:../pages/home.php');
}
else{
    unset ($_SESSION['id-user']);
    unset ($_SESSION['nome-user']);
    unset ($_SESSION['email']);
    unset ($_SESSION['senha']);
    header('location:../pages/cadastro.html');
  }
?>  