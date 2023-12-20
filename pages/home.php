<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://api.fontshare.com/v2/css?f[]=chillax@1,600,500,300,700,400,200&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
    <script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>
    <script nomodule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.0/jquery.min.js" integrity="sha512-3gJwYpMe3QewGELv8k/BX9vcqhryRdzRMxVfq6ngyWXwo03GFEzjsUm8Q7RZcHPHksttq7/GFoxjCVUjkjvPdw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous">
    <link rel="stylesheet" href="../css/home.css?v=1" type="text/css">
    <script src="../js/modal.js?v=1" type="text/javascript"></script>
    <script src="../js/modal2.js?v=1" type="text/javascript"></script>


    <title>Home</title>

    <?php
	/* esse bloco de código em php verifica se existe a sessão, pois o usuário pode
	 simplesmente não fazer o login e digitar na barra de endereço do seu navegador
	o caminho para a página principal do site (sistema), burlando assim a obrigação de
	fazer um login, com isso se ele não estiver feito o login não será criado a session,
	então ao verificar que a session não existe a página redireciona o mesmo
	 para a cadastro.html.*/
	
	session_start();
	if((!isset ($_SESSION['id-user']) == true) and (!isset ($_SESSION['nome-user']) == true) and (!isset ($_SESSION['email']) == true) and (!isset ($_SESSION['senha']) == true))
	{
        unset ($_SESSION['id-user']);
        unset ($_SESSION['nome-user']);
        unset ($_SESSION['email']);
        unset ($_SESSION['senha']);
        header('location:cadastro.html');
	  }
    
	$nome_user = $_SESSION['nome-user'];
    $id_user = $_SESSION['id-user'];
    $email = $_SESSION['email'];
    $search = '';
    $search = $_SESSION['procura'];
	?>
</head>
<body>
    <header>
        <div class="logo">
            <img src="../img/logo.svg" alt="logo que representa uma mulher com cabelo de coloração esverdeada">
            <span class="span-logo displayFont">CARI</span>
        </div>
    </header>
    <main class="row">
        <div class="col-sm-1">
            <nav class="nav flex-column nav-pills flex-sm-rows sticky-sm-top">
                <div class="container-fluid">
                    <a class="navbar-brand flex-sm-fill text-sm-center " href="#table">
                        <ion-icon name="home-outline" class="d-inline-block align-text-center"></ion-icon>
                        Home
                    </a>
                </div>
                <div class="container-fluid">
                    <a class="navbar-brand flex-sm-fill text-sm-center" href="#lista">
                        <ion-icon name="pricetag-outline" class="d-inline-block align-text-center"></ion-icon>
                        Lista
                    </a>
                </div>
                <div class="container-fluid">
                    <a class="navbar-brand flex-sm-fill text-sm-center" href="#recipes">
                        <ion-icon name="receipt-outline" class="d-inline-block align-text-center"></ion-icon>
                        Receitas
                    </a>
                </div>
               <!-- <div class="container-fluid">
                    <input type="checkbox" class="checkbox" id="chk" onclick="alterarImagem()"/>
                    <label class="label" for="chk">
                        <ion-icon name="sunny-outline" class="sun acessibilidade" ></ion-icon>
                        <ion-icon name="moon-outline" class="moon acessibilidade" ></ion-icon>
                        <div class="ball"></div>
                    </label>
                </div> -->
            </nav>
        </div>
        <div class="col">
            <section id="table" class="table-estoque">
                <div class="box">
                    <div class="header-input">
                        <div class="box-input">
                            <h1>Adicione o alimento</h1>
                            <div class="form-input">
                                <form action="../php/adicionar-alimento.php" method="post">
                                    <input type="hidden" name="id" value="<?php echo $id_user; ?>"/>
                                    <div class="row form-alimento">
                                        <div class="col">
                                            <input type="text" name="nome-alimento" id="nome-alimento" class="form-control" placeholder="insira seu alimento" required>
                                        </div>
                                        <div class="col">
                                            <input type="number" name="quantidade" id="quantidade" class="form-control" placeholder="quantidade" required>
                                        </div>
                                        <div class="col">
                                            <select class="form-select form-control  mb-3" name="medida" aria-label="Large select example" required>
                                                <option selected>Selecione a medida</option>
                                                <option value="kg">Kilogramas</option>
                                                <option value="g">Gramas</option>
                                                <option value="L">Litros</option>
                                                <option value="ml">Mililitros</option>
                                                <option value="unidades">unidades</option>

                                            </select>
                                        </div>
                                        <div class="col">
                                            <input type="submit" name="adicionar" value="adicionar" class="btn btn-primary">
                                        </div>
                                        
                                    </div>
                                </form>
                            </div>
                        </div>
                        <div class="line"></div>
                    </div>
                    <div class="table-responsive-xxl">
                        <?php
                            //Conexão com o banco loja_02 e puxando dados de cadastro, e se não der certo mostrar a mensagem de erro //
                                include ("../php/config.php");

                            //Executar o comando SQL para selecionar os valores da tabela
                                $regra = "SELECT * FROM alimento WHERE `id-user` ='$id_user' and `quantidade` > 0 ";
                                $select = mysqli_query($connect, $regra);
                                if($select->num_rows < 1){
                                    echo "<h3>Você não possui alimentos adicionados</h3>";
                                }
                                else {
                                    // criando tabela dos clientes
                                echo "</table> ";
                                echo "<table class='table align-middle'>
                                        <thead>
                                            <tr class='table-primary'>
                                                <th scope ='col'>NOME</td>
                                                <th scope ='col'>QUANTIDADE</td>
                                                <th scope ='col'>MEDIDA</td>
                                                <th scope ='col'>DATA</td>
                                                <th scope ='col'></td>
                                                <th scope ='col'></td>
                                                <th scope ='col' style='display:none'></td>
                                            </tr>
                                        </thead>
                                    ";
                            // Imprimir os dados da tabela no html através do while
                                while ($mostrar = mysqli_fetch_array($select)){
                                    echo "<tr>
                                                <td scope = 'row'>".$mostrar['nome-alimento']."</td>
                                                <td scope = 'row'>".$mostrar['quantidade']."</td>
                                                <td scope = 'row'>".$mostrar['medida']."</td>
                                                <td scope = 'row'>".$mostrar['data']."</td>
                                                <td scope = 'row'>
                                                    <a href='../php/delete.php?id-alimento=".$mostrar['id-alimento']."&id-user=".$id_user."' class='btn btn-danger'>apagar</a>
                                                </td>
                                                <td scope = 'row'>
                                                    <button type='button' class='btn btn-primary btnEdit' data-bs-toggle='modal' data-bs-target='#staticBackdrop'>Editar</button>
                                                </td>
                                                <td style='display:none'>".$mostrar['id-alimento']."</td>
                                            </tr>";
                                }
                                echo"</table>";
                                } 
                            ?>
                    </div>
                </div>

                    <!-- Modal -->
                    <div class="modal fade" id="staticBackdrop" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel" aria-hidden="true">
                                <div class="modal-dialog modal-dialog-centered">
                                    <div class="modal-content">
                                        <div class="modal-header">
                                            <h1 class="modal-title fs-5" id="staticBackdropLabel">Editar Alimento</h1>
                                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                        </div>
                                        <form action="../php/editar.php" method="post">
                                            <div class="modal-body">
                                                
                                                <div class="form-input">
                                                            <input type='hidden' name='id-modal' value='<?php echo $id_user; ?>' id="id_user"/>
                                                            <input type='hidden' name='id-alimento' id="id-alimento-modal" value=""/>
                                                            <div class='row form-alimento'>
                                                                <div class='col'>
                                                                    <input type='text' name='nome-alimento-modal' id='nome-alimento-modal' class='form-control' placeholder='insira seu alimento' value = "">
                                                                </div>
                                                                <div class='col'>
                                                                    <input type='number' name='quantidade-modal' id='quantidade-modal' class='form-control' placeholder='quantidade' value = "">
                                                                </div>
                                                                <div class='col'>
                                                                    <select class='form-select form-control  mb-3' name='medida-modal' id="medida-modal" aria-label='Large select example'>
                                                                        <option value = "" selected>Selecione a Medida</option>
                                                                        <option value='kg'>Kilogramas</option>
                                                                        <option value='g'>Gramas</option>
                                                                        <option value='L'>Litros</option>
                                                                        <option value='ml'>Mililitros</option>
                                                                        <option value='unidades'>unidades</option>
        
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        
                                                </div> 
                                            </div>
                                            <div class="modal-footer">
                                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                                                <input type="submit" value="Atualizar" class="btn btn-primary">
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
    
            </section>
            
            <section class="lista" id="lista">
                <div class="box">
                    <div class="header-input">
                        <h1>lista de compras</h1>
                        <div class="line"></div>
                    </div>
                    <div class="table-responsive-xxl">
                    <?php

                            //Executar o comando SQL para selecionar os valores da tabela
                                $regra2 = "SELECT * FROM alimento WHERE `id-user` ='$id_user' and `quantidade` = 0 ";
                                $select2 = mysqli_query($connect, $regra2); 
                            if($select2->num_rows < 1)
                            {
                                echo "<h3>Você não possui alimentos para comprar</h3>";
                            }
                            else{
                                // criando tabela dos clientes
                                echo "</table> ";
                                echo "<table class='table align-middle'>
                                        <thead>
                                            <tr class='table-primary'>
                                                <th scope ='col'>NOME</td>
                                                <th scope ='col'>QUANTIDADE</td>
                                                <th scope ='col'>MEDIDA</td>
                                                <th scope ='col'>DATA</td>
                                                <th scope ='col'></td>
                                                <th scope ='col'></td>
                                                <th scope ='col' style='display:none'></td>
                                            </tr>
                                        </thead>
                                    ";
                            // Imprimir os dados da tabela no html através do while
                                while ($mostrar2 = mysqli_fetch_array($select2)){
                                    echo "<tr>
                                                <td scope = 'row'>".$mostrar2['nome-alimento']."</td>
                                                <td scope = 'row'>".$mostrar2['quantidade']."</td>
                                                <td scope = 'row'>".$mostrar2['medida']."</td>
                                                <td scope = 'row'>".$mostrar2['data']."</td>
                                                <td scope = 'row'>
                                                    <a href='../php/delete.php?id-alimento=".$mostrar2['id-alimento']."&id-user=".$id_user."' class='btn btn-danger'>apagar</a>
                                                </td>
                                                <td scope = 'row'>
                                                    <button type='button' class='btn btn-primary btnEdit' data-bs-toggle='modal' data-bs-target='#staticBackdrop'>Adicionar</button>
                                                </td>
                                                <td style='display:none'>".$mostrar2['id-alimento']."</td>
                                            </tr>";
                                }
                                echo"</table>";
                            }
                            ?>
                        </div>
                </div>
            </section>
            <section id="recipes" class="recipes">
                <div class="box">
                    <div class="header-input">
                        <div class="box-input">
                            <h1>Receitas</h1>
                            <div class="form-input">
                                <form action="../php/search.php" method="post">
                                    <div class="row form-alimento">
                                        <div class="col">
                                            <input type="text" name="procura" id="alimento" class="form-control" placeholder="Insira o Alimento">
                                        </div>
                                        <div class="col">
                                            <input type="submit" value="procurar" class="btn btn-primary">
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                        <div class="line"></div>
                    </div>
                    <div class="row row-cols-1 row-cols-md-3 g-4">
                        <?php

                        
                        
                            if ($search == ''){
                                $regra_receita = "SELECT * FROM receitas";
                            }
                            else {
                                $regra_receita = "SELECT * FROM receitas WHERE `nome-receita` LIKE '%$search%' or `ingredientes` LIKE '%$search%'";
                            }


                            $select_receita = mysqli_query($connect, $regra_receita);

                            if ($select_receita-> num_rows <1){
                                echo "<h3>Não foram encontradas receitas</h3>";
                            }
                            else{
                                while($mostrar_receita = mysqli_fetch_array($select_receita)){
                                    echo "<div class='col'>
                                    <div class='card'>
                                        <div class='front'>
                                            <h5 class='card-header card-title' id='card-title'>".$mostrar_receita['nome-receita']."</h5>
                                            <img src='../img/".$mostrar_receita['nome-receita'].".jpg' alt='imagem de uma salada centralizada ' class='card-img-top'>
                                            
                                        </div>
                                        <div class='back'>
                                            <h5 class='card-header card-title' id='card-title'>".$mostrar_receita['nome-receita']."</h5>
                                            <div class='row'>
                                                <div class='col desc-item'>
                                                    <h5 class='text-center recipe-title'>Ingredientes</h5>
                                                    <p class='text-center text-wrap text-break desc-recipe'>".nl2br($mostrar_receita['ingredientes'])."</p>
                                                </div>
                                                <div class='col desc-item'>
                                                    <h5 class='text-center recipe-title'>Preparo</h5>
                                                    <p class='text-center text-wrap text-break desc-recipe'>".nl2br($mostrar_receita['desc-receita'])."</p>
                                                </div>
                                            </div>
                                        </div>  
                                    </div>
                                </div>";
                                }
                            }
                        
                        ?>   
                    </div>      
                </div>
            </section>
        </div>
                            
    </main>
    <footer>

    </footer>

    <script src="../js/script.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-C6RzsynM9kWDrMNeT87bh95OGNyZPhcTNXj1NW7RuBCsyN/o0jlpcV8Qyq46cDfL" crossorigin="anonymous"></script>
</body>
</html>