var editor = CodeMirror.fromTextArea(document.getElementById("textareaCode"), {
    lineNumbers: false,
    matchBrackets: true,
    mode: "text/x-python",
    indentUnit: 4,
    indentWithTabs: true
});

window.addEventListener("resize", autodivheight);

var x = 0;

function autodivheight() {
    var winHeight = 0;
    if (window.innerHeight) {
        winHeight = window.innerHeight;
    } else if ((document.body) && (document.body.clientHeight)) {
        winHeight = document.body.clientHeight;
    }
    //通过深入Document内部对body进行检测，获取浏览器窗口高度
    if (document.documentElement && document.documentElement.clientHeight) {
        winHeight = document.documentElement.clientHeight;
    }
    height = winHeight * 0.68;
    editor.setSize('100%', height);
    document.getElementById("iframeResult").style.height = height + "px";
}

var initCode = document.getElementById("textareaCode").value;

function resetCode() {
    editor.getDoc().setValue(initCode);
}

function submitTryit() {
    var ifr = document.createElement("iframe");
    ifr.setAttribute("frameborder", "0");
    ifr.setAttribute("id", "iframeResult");
    document.getElementById("iframewrapper").innerHTML = "";
    document.getElementById("iframewrapper").appendChild(ifr);
    var ifrw = (ifr.contentWindow) ? ifr.contentWindow : (ifr.contentDocument.document) ? ifr.contentDocument.document : ifr.contentDocument;

    var text = editor.getValue();
    btn = $("#submitBTN");
    editor.on("change",function(editor,change){
        btn.prop('disabled', false);
    });
    btn.click(function() {
        btn.prop('disabled', true);
        code = editor.getValue();
        token = '4381fe197827ec87cbac9552f14ec62a';
        runcode = 15;
        fileext = "py3";
        loadingdata = '<img src="'+cdn_static+'images/loading.gif">';
        ifrw.document.open();
        ifrw.document.write(loadingdata);
        ifrw.document.close();
        $.ajax({
            type: "post",
            url: 'https://run.ossoft.cn/runcode/compile2',
            data: JSON.stringify({code:code,token:token,language:runcode,fileext:fileext}),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function(data) {
                if(runcode==8) {
                    data.errors = data.errors.replace("/usercode/script.sh: line 69: bc: command not found", "");
                }
                text = data.output.replace(/\r\n|\r|\n/g,"<br />")  + data.errors;
                ifrw.document.open();
                ifrw.document.write('<pre>' + text + '</pre>');
                ifrw.document.close();
            }
        });
        setTimeout(function(){
            btn.prop('disabled', false);
        }, 10*1000);
        autodivheight();
    });
    btn.click();
}

submitTryit();

