htmlstr = "<p>\u8be5\u5b9e\u4f8b\u8bbe\u7f6e\u4e86\u9ed8\u8ba4\u663e\u793a\u7684\u9009\u9879\u5361\uff0c\u5728\u9875\u9762\u8f7d\u5165\u65f6\u89e6\u53d1\u6307\u5b9a id \u7684 click \u4e8b\u4ef6\u3002<\/p>\n\n<div class=\"tab\">\n  <button class=\"tablinks\" onclick=\"openCity(event, 'London')\" id=\"defaultOpen\">London<\/button>\n  <button class=\"tablinks\" onclick=\"openCity(event, 'Paris')\">Paris<\/button>\n  <button class=\"tablinks\" onclick=\"openCity(event, 'Tokyo')\">Tokyo<\/button>\n<\/div>\n\n<div id=\"London\" class=\"tabcontent\">\n  <h3>London<\/h3>\n  <p>London is the capital city of England.<\/p>\n<\/div>\n\n<div id=\"Paris\" class=\"tabcontent\">\n  <h3>Paris<\/h3>\n  <p>Paris is the capital of France.<\/p> \n<\/div>\n\n<div id=\"Tokyo\" class=\"tabcontent\">\n  <h3>Tokyo<\/h3>\n  <p>Tokyo is the capital of Japan.<\/p>\n<\/div>";
cssstr = "body {font-family: \"Lato\", sans-serif;}\n\n\/* Style the tab *\/\ndiv.tab {\n    overflow: hidden;\n    border: 1px solid #ccc;\n    background-color: #f1f1f1;\n}\n\n\/* Style the buttons inside the tab *\/\ndiv.tab button {\n    background-color: inherit;\n    float: left;\n    border: none;\n    outline: none;\n    cursor: pointer;\n    padding: 14px 16px;\n    transition: 0.3s;\n    font-size: 17px;\n}\n\n\/* Change background color of buttons on hover *\/\ndiv.tab button:hover {\n    background-color: #ddd;\n}\n\n\/* Create an active\/current tablink class *\/\ndiv.tab button.active {\n    background-color: #ccc;\n}\n\n\/* Style the tab content *\/\n.tabcontent {\n    display: none;\n    padding: 6px 12px;\n    border: 1px solid #ccc;\n    border-top: none;\n}";
jsstr = "function openCity(evt, cityName) {\n    var i, tabcontent, tablinks;\n    tabcontent = document.getElementsByClassName(\"tabcontent\");\n    for (i = 0; i < tabcontent.length; i++) {\n        tabcontent[i].style.display = \"none\";
