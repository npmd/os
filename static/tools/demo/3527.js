htmlstr = "<p>\r\n  \u4f7f\u7528\u6b63\u5219\u8868\u8fbe\u5f0f\u7684\u65b9\u5f0f\u6765\u5224\u65ad\u3002\r\n<\/p>";
jsstr = "function isValid(str) { return \/^\\w+$\/.test(str); }\r\nstr = \"1234abd__\"\r\ndocument.write(isValid(str));\r\ndocument.write(\"<br>\");\r\n\r\nstr2 = \"$32343#\"\r\ndocument.write(isValid(str2));\r\ndocument.write(\"<br>\");";
