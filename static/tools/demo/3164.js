htmlstr = "<p>\u70b9\u51fb\u5404\u4e2a\u9009\u9879\u5207\u6362\u5185\u5bb9:<\/p>\n\n<div id=\"London\" class=\"tabcontent\">\n  <h3>London<\/h3>\n  <p>London is the capital city of England.<\/p>\n<\/div>\n\n<div id=\"Paris\" class=\"tabcontent\">\n  <h3>Paris<\/h3>\n  <p>Paris is the capital of France.<\/p> \n<\/div>\n\n<div id=\"Tokyo\" class=\"tabcontent\">\n  <h3>Tokyo<\/h3>\n  <p>Tokyo is the capital of Japan.<\/p>\n<\/div>\n\n<div id=\"Oslo\" class=\"tabcontent\">\n  <h3>Oslo<\/h3>\n  <p>Oslo is the capital of Norway.<\/p>\n<\/div>\n\n<button class=\"tablink\" onclick=\"openCity('London', this, 'red')\" id=\"defaultOpen\">London<\/button>\n<button class=\"tablink\" onclick=\"openCity('Paris', this, 'green')\">Paris<\/button>\n<button class=\"tablink\" onclick=\"openCity('Tokyo', this, 'blue')\">Tokyo<\/button>\n<button class=\"tablink\" onclick=\"openCity('Oslo', this, 'orange')\">Oslo<\/button>";
cssstr = "body {font-family: \"Lato\", sans-serif;}\n\n.tablink {\n    background-color: #555;\n    color: white;\n    float: left;\n    border: none;\n    outline: none;\n    cursor: pointer;\n    padding: 14px 16px;\n    font-size: 17px;\n    width: 25%;\n}\n\n.tablink:hover {\n    background-color: #777;\n}\n\n\/* Style the tab content *\/\n.tabcontent {\n    color: white;\n    display: none;\n    padding: 50px;\n    text-align: center;\n}\n\n#London {background-color:red;}\n#Paris {background-color:green;}\n#Tokyo {background-color:blue;}\n#Oslo {background-color:orange;}";
jsstr = "function openCity(cityName,elmnt,color) {\n    var i, tabcontent, tablinks;\n    tabcontent = document.getElementsByClassName(\"tabcontent\");\n    for (i = 0; i < tabcontent.length; i++) {\n        tabcontent[i].style.display = \"none\";
