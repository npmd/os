htmlstr = "<p>\u70b9\u51fb\u83dc\u5355\u6309\u94ae\u53d8\u4e3a \"X\":<\/p>\n<div class=\"container\" onclick=\"myFunction(this)\">\n  <div class=\"bar1\"><\/div>\n  <div class=\"bar2\"><\/div>\n  <div class=\"bar3\"><\/div>\n<\/div>";
cssstr = ".container {\n    display: inline-block;\n    cursor: pointer;\n}\n\n.bar1, .bar2, .bar3 {\n    width: 35px;\n    height: 5px;\n    background-color: #333;\n    margin: 6px 0;\n    transition: 0.4s;\n}\n\n.change .bar1 {\n    -webkit-transform: rotate(-45deg) translate(-9px, 6px) ;\n    transform: rotate(-45deg) translate(-9px, 6px) ;\n}\n\n.change .bar2 {opacity: 0;}\n\n.change .bar3 {\n    -webkit-transform: rotate(45deg) translate(-8px, -8px) ;\n    transform: rotate(45deg) translate(-8px, -8px) ;\n}";
jsstr = "function myFunction(x) {\n    x.classList.toggle(\"change\");\n}";
