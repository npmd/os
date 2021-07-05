htmlstr = "<p>\u70b9\u51fb\u6309\u94ae\u6309\u5b57\u6bcd\u5217\u8868\u6392\u5e8f:<\/p>\n<button onclick=\"sortList()\">\u6392\u5e8f<\/button>\n<ul id=\"id01\">\n  <li>Oslo<\/li>\n  <li>Stockholm<\/li>\n  <li>Helsinki<\/li>\n  <li>Berlin<\/li>\n  <li>Rome<\/li>\n  <li>Madrid<\/li>\n<\/ul>";
jsstr = "function sortList() {\n  var list, i, switching, b, shouldSwitch;\n  list = document.getElementById(\"id01\");\n  switching = true;\n  \/*Make a loop that will continue until\n  no switching has been done:*\/\n  while (switching) {\n    \/\/start by saying: no switching is done:\n    switching = false;\n    b = list.getElementsByTagName(\"LI\");\n    \/\/Loop through all list items:\n    for (i = 0; i < (b.length - 1); i++) {\n      \/\/start by saying there should be no switching:\n      shouldSwitch = false;\n      \/*check if the next item should\n      switch place with the current item:*\/\n      if (b[i].innerHTML.toLowerCase() > b[i + 1].innerHTML.toLowerCase()) {\n        \/*if next item is alphabetically lower than current item,\n        mark as a switch and break the loop:*\/\n        shouldSwitch= true;\n        break;\n      }\n    }\n    if (shouldSwitch) {\n      \/*If a switch has been marked, make the switch\n      and mark the switch as done:*\/\n      b[i].parentNode.insertBefore(b[i + 1], b[i]);\n      switching = true;\n    }\n  }\n}";
