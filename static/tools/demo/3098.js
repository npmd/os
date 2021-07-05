htmlstr = "<link class=\"cssdeck\" rel=\"stylesheet\" href=\"\/\/maxcdn.bootstrapcdn.com\/font-awesome\/4.3.0\/css\/font-awesome.min.css\">\n\n\n<ul class=\"pagination modal-1\">\n  <li><a href=\"#\" class=\"prev\">&laquo<\/a><\/li>\n  <li><a href=\"#\" class=\"active\">1<\/a><\/li>\n  <li> <a href=\"#\">2<\/a><\/li>\n  <li> <a href=\"#\">3<\/a><\/li>\n  <li> <a href=\"#\">4<\/a><\/li>\n  <li> <a href=\"#\">5<\/a><\/li>\n  <li> <a href=\"#\">6<\/a><\/li>\n  <li> <a href=\"#\">7<\/a><\/li>\n  <li> <a href=\"#\">8<\/a><\/li>\n  <li> <a href=\"#\">9<\/a><\/li>\n  <li><a href=\"#\" class=\"next\">&raquo;<\/a><\/li>\n<\/ul><br>\n<ul class=\"pagination modal-2\">\n  <li><a href=\"#\" class=\"prev\">&laquo <\/a><\/li>\n  <li><a href=\"#\">1<\/a><\/li>\n  <li> <a href=\"#\">2<\/a><\/li>\n  <li> <a href=\"#\" class=\"active\">3<\/a><\/li>\n  <li> <a href=\"#\">4<\/a><\/li>\n  <li> <a href=\"#\">5<\/a><\/li>\n  <li> <a href=\"#\">6<\/a><\/li>\n  <li> <a href=\"#\">7<\/a><\/li>\n  <li> <a href=\"#\">8<\/a><\/li>\n  <li> <a href=\"#\">9<\/a><\/li>\n  <li><a href=\"#\" class=\"next\">  &raquo;<\/a><\/li>\n<\/ul><br>\n<ul class=\"pagination modal-3\">\n  <li><a href=\"#\" class=\"prev\">&laquo<\/a><\/li>\n  <li><a href=\"#\" class=\"active\">1<\/a><\/li>\n  <li> <a href=\"#\">2<\/a><\/li>\n  <li> <a href=\"#\">3<\/a><\/li>\n  <li> <a href=\"#\">4<\/a><\/li>\n  <li> <a href=\"#\">5<\/a><\/li>\n  <li> <a href=\"#\">6<\/a><\/li>\n  <li> <a href=\"#\">7<\/a><\/li>\n  <li> <a href=\"#\">8<\/a><\/li>\n  <li> <a href=\"#\">9<\/a><\/li>\n  <li><a href=\"#\" class=\"next\">&raquo;<\/a><\/li>\n<\/ul><br>\n<ul class=\"pagination modal-4\">\n  <li><a href=\"#\" class=\"prev\">\n    <i class=\"fa fa-chevron-left\"><\/i>\n      Previous\n    <\/a>\n  <\/li>\n  <li><a href=\"#\">1<\/a><\/li>\n  <li> <a href=\"#\">2<\/a><\/li>\n  <li> <a href=\"#\">3<\/a><\/li>\n  <li> <a href=\"#\">4<\/a><\/li>\n  <li> <a href=\"#\" class=\"active\">5<\/a><\/li>\n  <li> <a href=\"#\">6<\/a><\/li>\n  <li> <a href=\"#\">7<\/a><\/li>\n  <li><a href=\"#\" class=\"next\"> Next \n    <i class=\"fa fa-chevron-right\"><\/i>\n  <\/a><\/li>\n<\/ul><br> \n<ul class=\"pagination modal-5\">\n  <li><a href=\"#\" class=\"prev fa fa-arrow-left\"> <\/a><\/li>\n  <li> <a href=\"#\">1<\/a><\/li>\n  <li> <a href=\"#\">2<\/a><\/li>\n  <li> <a href=\"#\">3<\/a><\/li>\n  <li> <a href=\"#\">4<\/a><\/li>\n  <li><a href=\"#\" class=\"active\">5<\/a><\/li>\n  <li> <a href=\"#\">6<\/a><\/li>\n  <li> <a href=\"#\">7<\/a><\/li>\n  <li> <a href=\"#\">8<\/a><\/li>\n  <li> <a href=\"#\">9<\/a><\/li>\n  <li><a href=\"#\" class=\"next fa fa-arrow-right\"><\/a><\/li>\n<\/ul>\n<br> \n<ul class=\"pagination modal-6\">\n  <li><a href=\"#\" class=\"prev\">&laquo<\/a><\/li>\n  <li> <a href=\"#\">1<\/a><\/li>\n  <li> <a href=\"#\">2<\/a><\/li>\n  <li><a href=\"#\" class=\"active\">3<\/a><\/li>\n  <li> <a href=\"#\">5<\/a><\/li>\n  <li> <a href=\"#\">6<\/a><\/li>\n  <li><a href=\"#\" class=\"next\">&raquo;<\/a><\/li>\n<\/ul>";
cssstr = "* {\n  box-sizing: border-box;\n  -moz-box-sizing: border-box;\n  -webkit-box-sizing: border-box;\n  font-family: arial;\n}\n\nbody {\n  background-color: #555;\n  text-align: center;\n  font-family: arial;\n}\n\n.pagination {\n  list-style: none;\n  display: inline-block;\n  padding: 0;\n  margin-top: 10px;\n}\n.pagination li {\n  display: inline;\n  text-align: center;\n}\n.pagination a {\n  float: left;\n  display: block;\n  font-size: 14px;\n  text-decoration: none;\n  padding: 5px 12px;\n  color: #fff;\n  margin-left: -1px;\n  border: 1px solid transparent;\n  line-height: 1.5;\n}\n.pagination a.active {\n  cursor: default;\n}\n.pagination a:active {\n  outline: none;\n}\n\n.modal-1 li:first-child a {\n  -moz-border-radius: 6px 0 0 6px;\n  -webkit-border-radius: 6px;\n  border-radius: 6px 0 0 6px;\n}\n.modal-1 li:last-child a {\n  -moz-border-radius: 0 6px 6px 0;\n  -webkit-border-radius: 0;\n  border-radius: 0 6px 6px 0;\n}\n.modal-1 a {\n  border-color: #ddd;\n  color: #4285F4;\n  background: #fff;\n}\n.modal-1 a:hover {\n  background: #eee;\n}\n.modal-1 a.active, .modal-1 a:active {\n  border-color: #4285F4;\n  background: #4285F4;\n  color: #fff;\n}\n\n.modal-2 li:first-child a {\n  -moz-border-radius: 50px 0 0 50px;\n  -webkit-border-radius: 50px;\n  border-radius: 50px 0 0 50px;\n}\n.modal-2 li:last-child a {\n  -moz-border-radius: 0 50px 50px 0;\n  -webkit-border-radius: 0;\n  border-radius: 0 50px 50px 0;\n}\n.modal-2 a {\n  border-color: #ddd;\n  color: #999;\n  background: #fff;\n}\n.modal-2 a:hover {\n  color: #E34E48;\n  background-color: #eee;\n}\n.modal-2 a.active, .modal-2 a:active {\n  border-color: #E34E48;\n  background: #E34E48;\n  color: #fff;\n}\n\n.modal-3 a {\n  margin-left: 3px;\n  padding: 0;\n  width: 30px;\n  height: 30px;\n  line-height: 30px;\n  -moz-border-radius: 100%;\n  -webkit-border-radius: 100%;\n  border-radius: 100%;\n}\n.modal-3 a:hover {\n  background-color: #4DAD16;\n}\n.modal-3 a.active, .modal-3 a:active {\n  background-color: #37B247;\n}\n\n.modal-4 a {\n  margin: 0 5px;\n  padding: 0;\n  width: 30px;\n  height: 30px;\n  line-height: 30px;\n  -moz-border-radius: 100%;\n  -webkit-border-radius: 100%;\n  border-radius: 100%;\n  background-color: #F7C12C;\n}\n.modal-4 a.prev {\n  -moz-border-radius: 50px 0 0 50px;\n  -webkit-border-radius: 50px;\n  border-radius: 50px 0 0 50px;\n  width: 100px;\n}\n.modal-4 a.next {\n  -moz-border-radius: 0 50px 50px 0;\n  -webkit-border-radius: 0;\n  border-radius: 0 50px 50px 0;\n  width: 100px;\n}\n.modal-4 a:hover {\n  background-color: #FFA500;\n}\n.modal-4 a.active, .modal-4 a:active {\n  background-color: #FFA100;\n}\n\n.modal-5 {\n  position: relative;\n}\n.modal-5:after {\n  content: '';\n  position: absolute;\n  width: 100%;\n  height: 35px;\n  left: 0;\n  bottom: 0;\n  z-index: -1;\n  background-image: -moz-linear-gradient(left, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.65) 40%, rgba(0, 0, 0, 0.65) 50%, rgba(0, 0, 0, 0.65) 60%, rgba(0, 0, 0, 0) 100%);\n  background-image: -webkit-linear-gradient(left, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.65) 40%, rgba(0, 0, 0, 0.65) 50%, rgba(0, 0, 0, 0.65) 60%, rgba(0, 0, 0, 0) 100%);\n  background-image: linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.65) 40%, rgba(0, 0, 0, 0.65) 50%, rgba(0, 0, 0, 0.65) 60%, rgba(0, 0, 0, 0) 100%);\n}\n.modal-5 a {\n  color: #666;\n  padding: 13px 5px 5px;\n  margin: 0 10px;\n  position: relative;\n}\n.modal-5 a:hover {\n  color: #fff;\n}\n.modal-5 a:hover:after {\n  content: '';\n  position: absolute;\n  width: 24px;\n  height: 24px;\n  background: #1E7EE2;\n  -moz-border-radius: 100%;\n  -webkit-border-radius: 100%;\n  border-radius: 100%;\n  z-index: -1;\n  left: -3px;\n  bottom: 4px;\n  margin: auto;\n}\n.modal-5 a.next, .modal-5 a.prev {\n  color: #1E7EE2;\n}\n.modal-5 a.next:hover, .modal-5 a.prev:hover {\n  color: #fff;\n}\n.modal-5 a.next:hover:after, .modal-5 a.prev:hover:after {\n  display: none;\n}\n.modal-5 a.active {\n  background: #1E7EE2;\n  color: #fff;\n}\n.modal-5 a.active:before {\n  content: '';\n  position: absolute;\n  top: -11px;\n  left: -10px;\n  width: 18px;\n  border: 10px solid transparent;\n  border-bottom: 7px solid #104477;\n  z-index: -1;\n}\n.modal-5 a.active:hover:after {\n  display: none;\n}\n\n.modal-6 {\n  -moz-box-shadow: 0 2px 2px #333;\n  -webkit-box-shadow: 0 2px 2px #333;\n  box-shadow: 0 2px 2px #333;\n  -moz-border-radius: 50px;\n  -webkit-border-radius: 50px;\n  border-radius: 50px;\n}\n.modal-6 a {\n  border-color: #ddd;\n  color: #999;\n  background: #fff;\n  padding: 10px 15px;\n}\n.modal-6 a:hover {\n  color: #E34E48;\n  background-color: #eee;\n}\n.modal-6 a.prev {\n  -moz-border-radius: 50px 0 0 50px;\n  -webkit-border-radius: 50px;\n  border-radius: 50px 0 0 50px;\n  width: 50px;\n  position: relative;\n}\n.modal-6 a.prev:after {\n  content: '';\n  position: absolute;\n  width: 10px;\n  height: 100%;\n  top: 0;\n  right: 0;\n  background-image: -moz-linear-gradient(left, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.2) 100%);\n  background-image: -webkit-linear-gradient(left, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.2) 100%);\n  background-image: linear-gradient(to right, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.2) 100%);\n}\n.modal-6 a.next {\n  -moz-border-radius: 0 50px 50px 0;\n  -webkit-border-radius: 0;\n  border-radius: 0 50px 50px 0;\n  width: 50px;\n  position: relative;\n}\n.modal-6 a.next:after {\n  content: '';\n  position: absolute;\n  width: 10px;\n  height: 100%;\n  top: 0;\n  left: 0;\n  background-image: -moz-linear-gradient(left, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 100%);\n  background-image: -webkit-linear-gradient(left, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 100%);\n  background-image: linear-gradient(to right, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 100%);\n}\n.modal-6 a.active {\n  border-color: #bbb;\n  background: #fff;\n  color: #E34E48;\n  -moz-box-shadow: 0 0 3px rgba(0, 0, 0, 0.25) inset;\n  -webkit-box-shadow: 0 0 3px rgba(0, 0, 0, 0.25) inset;\n  box-shadow: 0 0 3px rgba(0, 0, 0, 0.25) inset;\n}";