document.write('<div class="text-center" style="margin-left: 0;margin-right: 0">');
if (typeof site_enabled_b != "undefined" && site_enabled_b && typeof site_enabled_g != "undefined" && site_enabled_g) {
    document.write('<div class="col-sm-6">');
    loadGoogleAds();
    loadOther();
    document.write('</div>');
    document.write('<div class="col-sm-6">');
    loadBaiduAds("cms_left_bottom");
    document.write('</div>');
} else if (typeof site_enabled_g != "undefined" && site_enabled_g) {
    if (isMobile()) {
        loadGoogleAds();
        loadOther();
    } else {
        loadGoogleAds();
    }
}
document.write('</div>');
