// author: ossoft
jQuery(document).ready(function ($) {
    //搜索
    $(".search-reveal").click(function () {
        $(".row-search-mobile").slideToggle("400",
            function () {
            });
    });

    $('.placeholder').on('blur', function () {
        if ($(this).val() == "") {
            $(this).val("搜索……");
        }
    });
    $('.placeholder').on('focus', function () {
        if ($(this).val() == '搜索……') {
            $(this).val('');
        }
    });

    //代码高亮
    $('pre').each(function () {
        if (!$(this).hasClass("prettyprint")) {
            $(this).addClass("prettyprint");
        }
    });
    $(".altblock").click(function () {

        if ($(this).find('i.fa-plus-square').length !== 0) {
            $("#postcomments").show();
            $(this).find('i').removeClass("fa-plus-square").addClass("fa-minus-square");

        } else {
            $("#postcomments").hide();
            $(this).find('i').removeClass("fa-minus-square").addClass("fa-plus-square");

        }

    });
    $("#qa_headline").click(function () {
        $(".altblock").click()
    });


    $(".comt-main li").prepend("<i style=\"font-size:12px;color:#cfcfcf;padding-right: 4px;\" class=\"fa fa-circle\" aria-hidden=\"true\"></i>");

    // 列表
    color_flag = false; //配色标记
    prev_title_flag = false;
    next_title_flag = false;
    href = window.location.href;

    if ($("#content img").hasClass('navup')) {
        navup_flag = false;
        $("#leftcolumn").find("a").each(function (index, value) {
            if (href.indexOf($(this).prop("href")) != -1) {
                navup_flag = true;
                return false;
            }
        });
        if (!navup_flag) {
            href = $(".navup").parent('a').prop("href");
        }
    }
    // 定位到指定评论位置
    var hash = window.location.hash;

    if (hash && $(hash).length && $(hash).is(':hidden')) {
        $("#postcomments").show();
        $("html,body").animate({scrollTop: $(hash).offset().top}, 200)
    }


    var total = $("#leftcolumn a").length;
    // var _atop = 0;
    $("#leftcolumn").find("a").each(function (index, value) {
        if (next_title_flag) {
            return false; //结束循环
        }


        cur_href = $(this).prop("href");

        cur_obj = $(this);

        //if(href.match(cur_href) != null) {
        if (href.indexOf(cur_href) != -1) {
            // _cura = $(this);
            // _atop =  $(this).offset().top;
            if (index == 0) {
                $(".previous-design-link").hide();
            }
            if (index == (total - 1)) {
                $(".next-design-link").hide();
            }


            if (cur_href.indexOf('/') == -1) { //第二重判断
                tmp_url = href.substring(0, href.lastIndexOf('/') + 1) + cur_href;

                if (href != tmp_url) return;
            }
            if (!color_flag) {
                $(this).css({"background-color": "#438EB9", "font-weight": "bold", "color": "#fff"});
                color_flag = true;
            }
            prev_href = $(this).prev("a").prop("href");
            prev_title = $(this).prev("a").prop("title");
            if (!prev_title) prev_title = $(this).prev("a").text();
            next_href = $(this).next("a").prop("href");
            next_title = $(this).next("a").prop("title");
            if (!next_title) next_title = $(this).next("a").text();
            if (!prev_title_flag) {
                if (prev_title) {
                    $(".previous-design-link a").prop("href", prev_href);
                    $(".previous-design-link a").prop("title", prev_title);
                    $(".previous-design-link a").text(prev_title);
                } else {
                    if (typeof (prev_obj) != 'undefined') {
                        prev_href = prev_obj.prop("href");
                        prev_title = prev_obj.prop("title");
                        if (!prev_title) prev_title = prev_obj.text();
                        if (prev_title) {
                            $(".previous-design-link a").prop("href", prev_href);
                            $(".previous-design-link a").prop("title", prev_title);
                            $(".previous-design-link a").text(prev_title);
                        }
                    }

                }
                prev_title_flag = true;
            }
            if (next_title) {
                if ($(".next-design-link a").prop("href")) {
                    $(".next-design-link a").prop("href", next_href);
                    $(".next-design-link a").prop("title", next_title);
                    $(".next-design-link a").text(next_title);
                } else {
                    $(".next-design-link").html("<a href=\"" + next_href + "\" rel=\"next\" title=\"" + next_title + "\">" + next_title + "</a> <i style=\"font-size:16px;\" class=\"fa fa-arrow-right\" aria-hidden=\"true\"></i>");
                }

                next_title_flag = true;

            }
            //return false;
        } else {
            prev_obj = cur_obj;
            if (next_title_flag) {
                return false;
            } else {
                if (prev_title_flag) {
                    next_href = $(this).prop("href");
                    next_title = $(this).prop("title");
                    if (!next_title) next_title = $(this).text();
                    if (next_title) {
                        if ($(".next-design-link a").prop("href")) {
                            $(".next-design-link a").prop("href", next_href);
                            $(".next-design-link a").prop("title", next_title);
                            $(".next-design-link a").text(next_title);
                        } else {
                            $(".next-design-link").html("<a href=\"" + next_href + "\" rel=\"next\" title=\"" + next_title + "\">" + next_title + "</a> <i style=\"font-size:16px;\" class=\"fa fa-arrow-right\" aria-hidden=\"true\"></i>");
                        }
                        next_title_flag = true;
                    }
                }
            }
        }
    });

    // 侧栏
    $(".sidebar-tree > ul > li").hover(function () {
        $(this).addClass("selected");
        $(this).children("a:eq(0)").addClass("h2-tit");
        $(this).children("ul").show();
    }, function () {
        $(this).removeClass("selected");
        $(this).children(".tit").removeClass("h2-tit");
        $(this).children("ul").hide();
    })
    // 关闭QQ群
    $(".qqinfo").hide();
    //$.getJSON("/try/qqinfo.php", function(data) {
    //	$("#qqid").text(data.qqid);
    //	$("#qqhref").prop("href", data.qqhref);
    //});
    // 首页导航
    $("#index-nav li").click(function () {
        $(this).find("a").addClass("current");
        $(this).siblings().find("a").removeClass("current");
        id = $(this).find("a").attr("data-id");
        $(".sub-navigation-articles").hide();
        if (id == 'index') {

        }
        if (id == 'note') {

        } else if (id == 'tool') {

        } else if (id == 'quiz') {
            $("#tool").hide();
            $("#manual").hide();
            $("#" + id).show();
            $(".sub-navigation-articles").show();
        } else if (id == 'manual') {
            $("#tool").hide();
            $("#quiz").hide();
            $("#" + id).show();
            $(".sub-navigation-articles").show();
        } else {
            $("#tool").hide();
            $("#quiz").hide();
            $("#manual").hide();
        }
    });
    $("#note-nav li").each(function () {
        if (window.location.pathname == $(this).find("a").attr("href")) {
            $(this).find("a").addClass("current");
            return false;
        }
    });
    $("#cate0").click(function () {
        $(".codelist-desktop").show();
    })
    $(".design").click(function () {
        id = $(this).prop("id");
        $("." + id).show();
        $("." + id).siblings().hide();
    })
    //移动设备点击链接
    $('a').on('click touchend', function (e) {
        if (screen.availHeight == 548 && screen.availHeight == 320) {
            var el = $(this);
            var link = el.attr('href');
            window.location = link;
        }
    });

    $("#pull").click(function () {
        $(".left-column").slideToggle("400", function () {
        });
    })
    $(".qrcode").hover(function () {
        $("#bottom-qrcode").show();
    }, function () {
        $("#bottom-qrcode").hide();
    });
    /*
    if($("#leftcolumn").length && $(".previous-next-links").length) {
        var _dheight = $(document).height();
        var _wheight = $(window).height();
        var _endArticle = $(".previous-next-links:eq(1)").offset().top;
        var _leftaTop = $("#leftcolumn a").last().offset().top;
        var _maxScrollTop = _dheight - $(window).height();
    }

    var _srollWidth = '180px';
    if($(window).width()< 1068) {
        _srollWidth = '16%';
    }
     左侧滚动部分代码
    var _scrollFLag = true;
    $('.gallery-list').bind('scroll', function()
    {
        if($(this).scrollTop() + $(this).innerHeight()>=$(this)[0].scrollHeight)
        {
            _scrollFLag = false;
        } else {
            _scrollFLag = true;
        }
    });
    */

    $(window).scroll(function () {
        var _stop = $(window).scrollTop();
        /*  左侧滚动部分代码
        if($("#leftcolumn").length) {
            var _wtop = $(".middle-column").offset().top + $(".middle-column").height();
            var _footerHeight = $("#footer").offset().top;
            if(_leftaTop>=_endArticle) {
                _wtop = _wtop - _stop ;
            } else if(_wheight<(_footerHeight-_stop)) {
                _wtop = _wheight;
            } else {
                _wtop = _footerHeight - _stop - 10;
            }

            if(_scrollFLag && _atop>0 && _stop>=120 && $(window).width() > 768) {
                var _setTop = _stop - _atop + "px";
                //debounce($(".left-column").css("margin-top", _setTop),500);
                $(".gallery-list").css({ 'width':_srollWidth, 'position' : 'fixed', 'overflow-y' : 'scroll', 'overflow-x' : 'hidden', 'height' : _wtop+"px", 'top':0 });
                $(".gallery-list").scrollTop(_cura.position().top + $(".gallery-list").scrollTop());
                console.log('s1');
            } else if(_scrollFLag){
                console.log('s2');
                _scrollFLag = true;
                //debounce($(".left-column").css("margin-top", 0),500);
                $(".gallery-list").css({ 'width':'', 'position' : '', 'overflow-y' : '', 'overflow-x' : '', 'height' : '', 'top':'' });
            }
        }
        */
        if (_stop >= 100) {
            $(".go-top").fadeIn();
            if ($('#htmlfeedback-container').length) {
                if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {

                } else {
                    $("#htmlfeedback-container").show();
                }
            }
        } else {
            $(".go-top").fadeOut();
        }
    });


    $(".go-top").click(function (event) {
        $('html,body').animate({scrollTop: 0}, 100);
        return false;
    });
    $(window).resize(function () {
        var viewportWidth = $(window).width();
        if (window.location.href.indexOf("w3cnote") != -1) {
            //console.log('href', window.location.href);
        } else {
            if (viewportWidth > 768) {
                $(".left-column").show();
            }
        }
        if (viewportWidth < 568) {
            $("#index-nav li").each(function (index) {
                if (index > 2) {
                    $(this).hide();
                }
            });
        } else {
            $("#index-nav li").show();
        }

    });

    // 用户记录
    _arr1 = window.location.href.split(".");
    if ((parseInt(_arr1.length) - parseInt(1)) > 0) {
        if (_arr1[parseInt(_arr1.length) - parseInt(1)] == 'html') {
            $(".writer").show();
        }
    }
    $(".writer").click(function () {
        if ((parseInt(_arr1.length) - parseInt(1)) > 0) {
            if (_arr1[parseInt(_arr1.length) - parseInt(1)] == 'html') {
                var art_title = $.trim($("#content h1").text()); //文章标题
                var art_url = $.trim(document.URL); //页面地址


                if (typeof (Storage) !== "undefined") {

                    var artObject = '';
                    if (localStorage.getItem("artObject") === null) {
                        artObject = '{"urls" : [{ "title": " ' + art_title + '", "url": " ' + art_url + '" }] }';
                        localStorage.setItem('artObject', artObject);
                        alert("文章标记成功！");
                    } else {
                        //localStorage.removeItem("artObject");
                        var retrievedObject = localStorage.getItem('artObject');
                        var retrievedJsonData = JSON.parse(retrievedObject);

                        var canAdd = true; //初始可以插入信息
                        var _tempData = ''
                        var len = 0;
                        var max = 20;
                        var start = 0;

                        for (i in retrievedJsonData.urls) {
                            if (retrievedJsonData.urls[i].title == art_title) {
                                canAdd = false;
                                alert("文章已标记！");
                                break;
                            }
                        }

                        if (canAdd == true) {  // 插入数据
                            _tempData = '{"urls" : [';
                            len = retrievedJsonData.urls.length;  // 长度
                            if (len >= max) {
                                start = 1;
                            }
                            //console.log(start);
                            for (i in retrievedJsonData.urls) {
                                if (start == 1 && i == 0) continue;
                                if (i == start) {
                                    _tempData += '{ "title": "' + retrievedJsonData.urls[i].title + '", "url":"' + retrievedJsonData.urls[i].url + '"}';
                                } else {
                                    _tempData += ',{ "title": "' + retrievedJsonData.urls[i].title + '", "url":"' + retrievedJsonData.urls[i].url + '"}';

                                }

                            }
                            _tempData += ',{ "title":"' + art_title + '", "url":"' + art_url + '" }] }';

                            // console.log(_tempData);
                            localStorage.setItem('artObject', _tempData);
                            alert("文章标记成功！");
                        }


                    }

                } else {
                    alert("抱歉! 您的浏览器不支持 web 存储。")
                }
            }
        }
    });
    if ($('#historylist').length && typeof (Storage) !== "undefined" && localStorage.getItem("artObject") !== null) { // 检索
        var _histtoryHtml = '';
        var retrievedObject2 = localStorage.getItem('artObject');
        var retrievedJsonData2 = JSON.parse(retrievedObject2);
        var len2 = retrievedJsonData2.urls.length - 1;  // 长度
        for (i = len2; i >= 0; i--) {
            _histtoryHtml += '<li><a target="_blank" href="' + retrievedJsonData2.urls[i].url + '">' + retrievedJsonData2.urls[i].title + '</a></li>';
        }
        $('#historylist').html(_histtoryHtml);
    } else {
        $('#historylist').html('<li>没有标记记录！！！</li>');
    }
    $(".previous-design-link i").wrap('<a href="' + $(".previous-design-link a").prop("href") + '"></a>');
    $(".next-design-link i").wrap('<a href="' + $(".next-design-link a").prop("href") + '"></a>');

});
/**
 * 用户登陆注册
 */
jQuery(document).ready(function ($) {
    // Bootstrap 2.x 提示
    if (window.location.href.indexOf('bootstrap-v2') !== -1) {
        var bs2_info = '<div style="color:#a94442;background-color:#f2dede;border-color:#ebccd1;padding: 15px;margin-bottom: 20px;border: 1px solid transparent;border-radius: 4px;"><strong>提示：</strong>你当前查看的是 Bootstrap 2.x 版本，<a target="_blank" href="/bootstrap/bootstrap-tutorial.html">Bootstrap3.x 版本点我</a>。</div>';
        $("#content").prepend(bs2_info);
    }
    $(".widget-header i:odd").click(function () {
        if ($(this).hasClass("fa-caret-up")) {
            $(this).parent(".widget-header").siblings(".widget-content").hide();
            $(this).removeClass("fa-caret-up").addClass("fa-caret-down");
        } else {
            $(this).parent(".widget-header").siblings(".widget-content").show();
            $(this).removeClass("fa-caret-down").addClass("fa-caret-up");
        }
    });

    // 夜间模式与日间模式
    var cateID = $("#moon").attr("data-cate");
    if (cateID) {
        var cookieMoon = readCookie("moon" + cateID);
    }
    $("#moon").click(function () {
        $(this).hide();
        $("#sun").show();
        $(".example_code").css({"background-color": "#eee"})
        $(".hl-main").css({"background-color": "#eee"});
        $(".article").css({"background-color": "#eee"});
        $(".reference tr:nth-child(even)").css("background-color", "#eee");
        $(".simditor-wrapper").css("background-color", "#eee");
        $(".simditor-toolbar").css("background-color", "#eee");
        $(".comt-ctrl").css("background-color", "#eee");
        $(".ipt").css("background-color", "#eee");
        if (!cookieMoon) {
            createCookie("moon" + cateID, 1, 1)
        }
    });
    $("#sun").click(function () {
        $(this).hide();
        $("#moon").show();
        $(".example_code").css({"background-color": "#fff"});
        $(".hl-main").css({"background-color": "#fff"});
        $(".article").css({"background-color": "#fff"});
        $(".reference tr:nth-child(even)").css("background-color", "#fff");
        $(".simditor-wrapper").css("background-color", "#fff");
        $(".simditor-toolbar").css("background-color", "#fff");
        $(".comt-ctrl").css("background-color", "#fbfbfb");
        $(".ipt").css("background-color", "#fff");
        eraseCookie("moon" + cateID)
    });
    if (cateID && cookieMoon) {
        $("#moon").trigger("click");
    }
    if (window.location.href.indexOf("python-exercise") > -1) {
        $("#respond").hide();
    }

});


jQuery.fn.putCursorAtEnd = function () {
    return this.each(function () {
        // If this function exists...
        if (this.setSelectionRange) {
            // ... then use it (Doesn't work in IE)
            // Double the length because Opera is inconsistent about whether a carriage return is one character or two. Sigh.
            var len = $(this).val().length * 2;
            this.setSelectionRange(len, len);
        } else {
            // ... otherwise replace the contents with itself
            // (Doesn't work in Google Chrome)
            $(this).val($(this).val());
        }
    });
};
//--------- 登陆，注册结束---------------
// 废弃弹窗
function NewWindow(text) {
    win = window.open(text, '', 'top=0,left=0,width=400,height=230');
}

function createCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name, "", -1);
}

//判断是否微信登陆
function isWeiXin() {
    var ua = window.navigator.userAgent.toLowerCase();
    if (ua.match(/MicroMessenger/i) == 'micromessenger') {
        return true;
    } else {
        return false;
    }
}

function dashangToggle() {
    $(".hide_box").fadeToggle();
    $(".shang_box").fadeToggle();
}

function popFunction() {
    var popup = document.getElementById("myPopup");
    popup.classList.toggle("show");
}

/* 测验 */
;(function ($, window, document, undefined) {

    'use strict';

    $.quiz = function (el, options) {
        var base = this;

        // Access to jQuery version of element
        base.$el = $(el);

        // Add a reverse reference to the DOM object
        base.$el.data('quiz', base);

        base.options = $.extend($.quiz.defaultOptions, options);

        var questions = base.options.questions,
            numQuestions = questions.length,
            startScreen = base.options.startScreen,
            startButton = base.options.startButton,
            homeButton = base.options.homeButton,
            resultsScreen = base.options.resultsScreen,
            gameOverScreen = base.options.gameOverScreen,
            nextButtonText = base.options.nextButtonText,
            finishButtonText = base.options.finishButtonText,
            restartButtonText = base.options.restartButtonText,
            currentQuestion = 1,
            score = 0,
            answerLocked = false;

        base.methods = {
            init: function () {
                base.methods.setup();

                $(document).on('click', startButton, function (e) {
                    e.preventDefault();
                    base.methods.start();
                });

                $(document).on('click', homeButton, function (e) {
                    e.preventDefault();
                    base.methods.home();
                });

                $(document).on('click', '.answers a', function (e) {
                    e.preventDefault();
                    base.methods.answerQuestion(this);
                });

                $(document).on('click', '#quiz-next-btn', function (e) {
                    e.preventDefault();
                    base.methods.nextQuestion();
                });

                $(document).on('click', '#quiz-finish-btn', function (e) {
                    e.preventDefault();
                    base.methods.finish();
                });

                $(document).on('click', '#quiz-restart-btn, #quiz-retry-btn', function (e) {
                    e.preventDefault();
                    base.methods.restart();
                });
            },
            setup: function () {
                var quizHtml = '';

                if (base.options.counter) {
                    quizHtml += '<div id="quiz-counter"></div>';
                }

                quizHtml += '<div id="questions">';
                $.each(questions, function (i, question) {
                    quizHtml += '<div class="question-container">';
                    quizHtml += '<p class="question">' + question.q + '</p>';
                    quizHtml += '<ul class="answers">';
                    $.each(question.options, function (index, answer) {
                        quizHtml += '<li><a href="#" data-index="' + index + '">' + answer + '</a></li>';
                    });
                    quizHtml += '</ul>';
                    quizHtml += '</div>';
                });
                quizHtml += '</div>';

                // if results screen not in DOM, add it
                if ($(resultsScreen).length === 0) {
                    quizHtml += '<div id="' + resultsScreen.substr(1) + '">';
                    quizHtml += '<p id="quiz-results"></p>';
                    quizHtml += '</div>';
                }

                quizHtml += '<div id="quiz-controls">';
                quizHtml += '<p id="quiz-response"></p>';
                quizHtml += '<div id="quiz-buttons">';
                quizHtml += '<a href="#" id="quiz-next-btn">' + nextButtonText + '</a>';
                quizHtml += '<a href="#" id="quiz-finish-btn">' + finishButtonText + '</a>';
                quizHtml += '<a href="#" id="quiz-restart-btn">' + restartButtonText + '</a>';
                quizHtml += '</div>';
                quizHtml += '</div>';

                base.$el.append(quizHtml).addClass('quiz-container quiz-start-state');

                $('#quiz-counter').hide();
                $('.question-container').hide();
                $(gameOverScreen).hide();
                $(resultsScreen).hide();
                $('#quiz-controls').hide();
            },
            start: function () {
                base.$el.removeClass('quiz-start-state').addClass('quiz-questions-state');
                $(startScreen).hide();
                $('#quiz-controls').hide();
                $('#quiz-finish-btn').hide();
                $('#quiz-restart-btn').hide();
                $('#questions').show();
                $('#quiz-counter').show();
                $('.question-container:first-child').show().addClass('active-question');
                base.methods.updateCounter();
            },
            answerQuestion: function (answerEl) {
                if (answerLocked) {
                    return;
                }
                answerLocked = true;

                var $answerEl = $(answerEl),
                    response = '',
                    selected = $answerEl.data('index'),
                    currentQuestionIndex = currentQuestion - 1,
                    correct = questions[currentQuestionIndex].correctIndex;

                if (selected === correct) {
                    $answerEl.addClass('correct');
                    response = questions[currentQuestionIndex].correctResponse;
                    score++;
                } else {
                    $answerEl.addClass('incorrect');
                    response = questions[currentQuestionIndex].incorrectResponse;
                    if (!base.options.allowIncorrect) {
                        base.methods.gameOver(response);
                        return;
                    }
                }

                $('#quiz-response').html(response);
                $('#quiz-controls').fadeIn();

                if (typeof base.options.answerCallback === 'function') {
                    base.options.answerCallback(currentQuestion, selected, questions[currentQuestionIndex]);
                }
            },
            nextQuestion: function () {
                answerLocked = false;

                $('.active-question')
                    .hide()
                    .removeClass('active-question')
                    .next('.question-container')
                    .show()
                    .addClass('active-question');

                $('#quiz-controls').hide();

                // check to see if we are at the last question
                if (++currentQuestion === numQuestions) {
                    $('#quiz-next-btn').hide();
                    $('#quiz-finish-btn').show();
                }

                base.methods.updateCounter();

                if (typeof base.options.nextCallback === 'function') {
                    base.options.nextCallback();
                }
            },
            gameOver: function (response) {
                // if gameover screen not in DOM, add it
                if ($(gameOverScreen).length === 0) {
                    var quizHtml = '';
                    quizHtml += '<div id="' + gameOverScreen.substr(1) + '">';
                    quizHtml += '<p id="quiz-gameover-response"></p>';
                    quizHtml += '<p><a href="#" id="quiz-retry-btn">' + restartButtonText + '</a></p>';
                    quizHtml += '</div>';
                    base.$el.append(quizHtml);
                }
                $('#quiz-gameover-response').html(response);
                $('#quiz-counter').hide();
                $('#questions').hide();
                $('#quiz-finish-btn').hide();
                $(gameOverScreen).show();
            },
            finish: function () {
                base.$el.removeClass('quiz-questions-state').addClass('quiz-results-state');
                $('.active-question').hide().removeClass('active-question');
                $('#quiz-counter').hide();
                $('#quiz-response').hide();
                $('#quiz-finish-btn').hide();
                $('#quiz-next-btn').hide();
                $('#quiz-restart-btn').show();
                $(resultsScreen).show();
                var resultsStr = base.options.resultsFormat.replace('%score', score).replace('%total', numQuestions);
                $('#quiz-results').html(resultsStr);

                if (typeof base.options.finishCallback === 'function') {
                    base.options.finishCallback();
                }
            },
            restart: function () {
                base.methods.reset();
                base.$el.addClass('quiz-questions-state');
                $('#questions').show();
                $('#quiz-counter').show();
                $('.question-container:first-child').show().addClass('active-question');
                base.methods.updateCounter();
            },
            reset: function () {
                answerLocked = false;
                currentQuestion = 1;
                score = 0;
                $('.answers a').removeClass('correct incorrect');
                base.$el.removeClass().addClass('quiz-container');
                $('#quiz-restart-btn').hide();
                $(gameOverScreen).hide();
                $(resultsScreen).hide();
                $('#quiz-controls').hide();
                $('#quiz-response').show();
                $('#quiz-next-btn').show();
                $('#quiz-counter').hide();
                $('.active-question').hide().removeClass('active-question');
            },
            home: function () {
                base.methods.reset();
                base.$el.addClass('quiz-start-state');
                $(startScreen).show();

                if (typeof base.options.homeCallback === 'function') {
                    base.options.homeCallback();
                }
            },
            updateCounter: function () {
                var countStr = base.options.counterFormat.replace('%current', currentQuestion).replace('%total', numQuestions);
                $('#quiz-counter').html(countStr);
            }
        };

        base.methods.init();
    };

    $.quiz.defaultOptions = {
        allowIncorrect: true,
        counter: true,
        counterFormat: '%current/%total',
        startScreen: '#quiz-start-screen',
        startButton: '#quiz-start-btn',
        homeButton: '#quiz-home-btn',
        resultsScreen: '#quiz-results-screen',
        resultsFormat: 'You got %score out of %total correct!',
        gameOverScreen: '#quiz-gameover-screen',
        nextButtonText: 'Next',
        finishButtonText: 'Finish',
        restartButtonText: 'Restart'
    };

    $.fn.quiz = function (options) {
        return this.each(function () {
            new $.quiz(this, options);
        });
    };
}(jQuery, window, document));