setTimeout(function () {
    (function () {
        var bp = document.createElement('script');
        var curProtocol = window.location.protocol.split(':')[0];
        if (curProtocol === 'https') {
            bp.src = 'https://zz.bdstatic.com/linksubmit/push.js';
        } else {
            bp.src = 'http://push.zhanzhang.baidu.com/push.js';
        }
        var s = document.getElementsByTagName("script")[0];
        s.parentNode.insertBefore(bp, s);
    })();
}, 2000);

if (typeof baid != "undefined") {
    loadBaiduAnalysis(baid);
}
// if (typeof gaid != "undefined") {
//     loadGoogleAnaylytics(gaid);
// }

function loadBaiduAnalysis(id) {
    var _hmt = _hmt || [];
    (function () {
        var hm = document.createElement("script");
        hm.src = "https://hm.baidu.com/hm.js?" + id;
        var s = document.getElementsByTagName("script")[0];
        s.parentNode.insertBefore(hm, s);
    })();
}

function loadGoogleAnaylytics(id) {
    document.write('<script async src="https://www.googletagmanager.com/gtag/js?id="' + id + '></script>');
    window.dataLayer = window.dataLayer || [];

    function gtag() {
        dataLayer.push(arguments);
    }

    gtag('js', new Date());
    gtag('config', id);
}