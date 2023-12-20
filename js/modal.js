$(document).ready(function(){
    $('.btnEdit').on('click', function(){



        $('#staticBackdrop').modal('show');
        $tr =$(this).closest('tr');
        var data= $tr.children('td').map(function(){
          return $(this).text();
        }).get();
        
        $('#nome-alimento-modal').val(data[0]);
        $('#quantidade-modal').val(data[1]);
        $('#medida-modal').val(data[2]);
        $('#id-alimento-modal').val(data[6]);

    });
  
    
});

