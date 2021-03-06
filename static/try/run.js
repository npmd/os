var mixedMode = {
    name: "htmlmixed",
    scriptTypes: [{
        matches: /\/x-handlebars-template|\/x-mustache/i,
        mode: null
    },
        {
            matches: /(text|application)\/(x-)?vb(a|script)/i,
            mode: "vbscript"
        }]
};
var editor = CodeMirror.fromTextArea(document.getElementById("textareaCode"), {
    mode: mixedMode,
    selectionPointer: true,
    lineNumbers: false,
    matchBrackets: true,
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
    height = winHeight * 0.68
    editor.setSize('100%', height);
    document.getElementById("iframeResult").style.height = height + "px";
}

var initCode = document.getElementById("textareaCode").value;

function resetCode() {
    editor.getDoc().setValue(initCode);
    submitTryit();
}

function submitTryit() {
    var text = editor.getValue();
    var patternHtml = /<html[^>]*>((.|[\n\r])*)<\/html>/im
    var patternHead = /<head[^>]*>((.|[\n\r])*)<\/head>/im
    var array_matches_head = patternHead.exec(text);
    var patternBody = /<body[^>]*>((.|[\n\r])*)<\/body>/im;

    var array_matches_body = patternBody.exec(text);
    var basepath_flag = 1;
    var basepath = '';
    if (basepath_flag) {
        basepath = '<base href="//www.ossoft.cn/try/demo_source/" target="_blank">';
    }
    if (array_matches_head) {
        text = text.replace('<head>', '<head>' + basepath);
    } else if (patternHtml) {
        text = text.replace('<html>', '<head>' + basepath + '</head>');
    } else if (array_matches_body) {
        text = text.replace('<body>', '<body>' + basepath);
    } else {
        text = basepath + text;
    }
    var ifr = document.createElement("iframe");
    ifr.setAttribute("frameborder", "0");
    ifr.setAttribute("id", "iframeResult");
    document.getElementById("iframewrapper").innerHTML = "";
    document.getElementById("iframewrapper").appendChild(ifr);

    var ifrw = (ifr.contentWindow) ? ifr.contentWindow : (ifr.contentDocument.document) ? ifr.contentDocument.document : ifr.contentDocument;
    ifrw.document.open();
    ifrw.document.write(text);
    ifrw.document.close();
    autodivheight();
}

submitTryit();
autodivheight();