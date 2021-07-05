htmlstr = "<body style=\"text-align:center\">\r\n\r\n<h2>\u5f39\u7a97<\/h2>\r\n\r\n<div class=\"popup\" onclick=\"myFunction()\">\u70b9\u6211\u6709\u5f39\u7a97!\r\n  <span class=\"popuptext\" id=\"myPopup\">\u63d0\u793a\u4fe1\u606f!<\/span>\r\n<\/div>\r\n<\/body>";
cssstr = "\/* Popup container - can be anything you want *\/\r\n.popup {\r\n    position: relative;\r\n    display: inline-block;\r\n    cursor: pointer;\r\n    -webkit-user-select: none;\r\n    -moz-user-select: none;\r\n    -ms-user-select: none;\r\n    user-select: none;\r\n}\r\n\r\n\/* The actual popup *\/\r\n.popup .popuptext {\r\n    visibility: hidden;\r\n    width: 160px;\r\n    background-color: #555;\r\n    color: #fff;\r\n    text-align: center;\r\n    border-radius: 6px;\r\n    padding: 8px 0;\r\n    position: absolute;\r\n    z-index: 1;\r\n    bottom: 125%;\r\n    left: 50%;\r\n    margin-left: -80px;\r\n}\r\n\r\n\/* Popup arrow *\/\r\n.popup .popuptext::after {\r\n    content: \"\";
jsstr = "function myFunction() {\r\n    var popup = document.getElementById(\"myPopup\");\r\n    popup.classList.toggle(\"show\");\r\n}";