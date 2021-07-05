htmlstr = "<h2>Snackbar \/ Toast<\/h2>\n<p>\u5728\u5c4f\u5e55\u5e95\u90e8\u5f39\u51fa\u6d88\u606f,\u4f5c\u7528\u4e0e\u4f7f\u7528\u65b9\u6cd5\u90fd\u4e0eToast\u7c7b\u4f3c<\/p>\n<p>\u70b9\u51fb\u6309\u94ae\u663e\u793a\u63d0\u793a\u4fe1\u606f\uff0c3 \u79d2\u540e\u6d88\u5931<\/p>\n\n<button onclick=\"myFunction()\">\u663e\u793a Snackbar<\/button>\n\n<div id=\"snackbar\">\u4e00\u4e9b\u6587\u672c..<\/div>";
cssstr = "#snackbar {\n    visibility: hidden;\n    min-width: 250px;\n    margin-left: -125px;\n    background-color: #333;\n    color: #fff;\n    text-align: center;\n    border-radius: 2px;\n    padding: 16px;\n    position: fixed;\n    z-index: 1;\n    left: 50%;\n    bottom: 30px;\n    font-size: 17px;\n}\n\n#snackbar.show {\n    visibility: visible;\n    -webkit-animation: fadein 0.5s, fadeout 0.5s 2.5s;\n    animation: fadein 0.5s, fadeout 0.5s 2.5s;\n}\n\n@-webkit-keyframes fadein {\n    from {bottom: 0; opacity: 0;} \n    to {bottom: 30px; opacity: 1;}\n}\n\n@keyframes fadein {\n    from {bottom: 0; opacity: 0;}\n    to {bottom: 30px; opacity: 1;}\n}\n\n@-webkit-keyframes fadeout {\n    from {bottom: 30px; opacity: 1;} \n    to {bottom: 0; opacity: 0;}\n}\n\n@keyframes fadeout {\n    from {bottom: 30px; opacity: 1;}\n    to {bottom: 0; opacity: 0;}\n}";
jsstr = "function myFunction() {\n    var x = document.getElementById(\"snackbar\")\n    x.className = \"show\";