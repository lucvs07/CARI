//função para alterar o modo
const chk = document.getElementById('chk');

        chk.addEventListener('change', () => {
        document.body.classList.toggle('dark')

        });
//função para alterar o tamanho da fonte
function aumentar(){
        //aumentar para display
        let DisplayFont = $(".displayFont");
        let DisplaySize = DisplayFont.css("font-size");
        DisplayFont.css("font-size", parseFloat(DisplaySize) + 1);
        //aumentar para display2
        let Display2Font = $(".display2Font");
        let Display2Size = Display2Font.css("font-size");
        Display2Font.css("font-size", parseFloat(Display2Size) + 1);
        //aumentar para display3
        let Display3Font = $(".display3Font");
        let Display3Size = Display3Font.css("font-size");
        Display3Font.css("font-size", parseFloat(Display3Size) + 1);

        //aumentar para button
        let btnFont = $(".btnFont");
        let btnSize = btnFont.css("font-size");
        btnFont.css("font-size", parseFloat(btnSize) + 1);
        //aumentar para elevated button
        let elevatedbtnFont = $(".elevated-button");
        let elevatedbtnSize = elevatedbtnFont.css("font-size");
        elevatedbtnFont.css("font-size", parseFloat(elevatedbtnSize) + 1);
}
function diminuir(){
        //diminuir para display
        let DisplayFont = $(".displayFont");
        let DisplaySize = DisplayFont.css("font-size");
        DisplayFont.css("font-size", parseFloat(DisplaySize) - 1);
         //diminuir para display2
         let Display2Font = $(".display2Font");
         let Display2Size = Display2Font.css("font-size");
         Display2Font.css("font-size", parseFloat(Display2Size) - 1);
         //diminuir para display3
        let Display3Font = $(".display3Font");
        let Display3Size = Display3Font.css("font-size");
        Display3Font.css("font-size", parseFloat(Display3Size) - 1);

        //diminuir para button
        let btnFont = $(".btnFont");
        let btnSize = btnFont.css("font-size");
        btnFont.css("font-size", parseFloat(btnSize) - 1);
        //diminuir para elevated button
        let elevatedbtnFont = $(".elevated-button");
        let elevatedbtnSize = elevatedbtnFont.css("font-size");
        elevatedbtnFont.css("font-size", parseFloat(elevatedbtnSize) - 1);
}

        
