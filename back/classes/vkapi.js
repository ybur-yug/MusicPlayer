(function(app){

    var apiBase = 'https://api.vk.com/method/';

    var cbk = app.cbk;

    function VKApi(accessToken, userId, appId) {
        this.accessToken = accessToken;
        this.userId = userId;
        this.appId = appId;
    }

    VKApi.getSession = function(win, callback) {

        var url = 'https://api.vk.com/oauth/authorize?client_id='+app.VK_APP_ID+'&scope=audio,offline&response_type=code';


        function authedHandler(request, sender, back) {
            if(request.cmd == 'vkAuthSuccess') {
                try {
                    back({});
                } catch(e) {}

                chrome.extension.onRequest.removeListener(authedHandler);

                var hash = request.hash.substr(1).split('&');

                var code, userId, expiresIn, accessToken;

                if(hash) {
                    for(var hi=0; hi<hash.length; hi++) {
                        var hp = hash[hi].split('=');

                        switch(hp[0]) {
                            case 'code':
                                code = hp[1];
                                break;
                            case 'access_token':
                                accessToken = hp[1];
                                break;
                            case 'expires_in':
                                expiresIn = hp[1];
                                break;
                            case 'user_id':
                                userId = hp[1];
                                break;
                        }
                    }
                }

                if(userId !== undefined && accessToken !== undefined && expiresIn !== undefined) {
                    cbk(callback, {userId:userId, accessToken:accessToken,expiresIn:expiresIn});
                } else if(code) {
                    $.ajax({
                        url:'https://api.vk.com/oauth/access_token?client_id=' + app.VK_APP_ID + '&client_secret=' + app.VK_APP_SECRET + '&code='+code,
                        success: function(res, status, jXHR){
                            cbk(callback, {userId:res.user_id, accessToken:res.access_token,expiresIn:res.expires_in});
                        },
                        fail: function(jqXHR, textStatus, errorThrown) {
                            console.log('Error getting session from VK: ' + textStatus);
                            cbk(callback, new Error('Failed to get session'));
                        }
                    });

                } else {
                    cbk(callback, new Error('Failed to get session'));
                }
            }
        }

        chrome.extension.onRequest.addListener(authedHandler);

        win.location.href = url;
    };

    VKApi.prototype.apiCall = function(method, params, type, callback) {
        var me = this;

        if(type !== undefined && typeof type == 'function') {
            callback = type;
            type = 'GET';
        }

        params.access_token = me.accessToken;

        $.ajax({
            url: apiBase + method,
            data: params,
            dataType : 'json',
            type : type,
            success: function(data, status) {
                cbk(callback, status == 'success' ? data : new Error('Api call \'' + apiBase + method + '\' failed: status=' + status));
            },
            error : function(jqXHR, textStatus, errorThrown) {
                cbk(callback, new Error('Api call \'' + apiBase + method + '\' failed: status=' + status + '; errorThrown=' + errorThrown));
            }
        });
    };

    VKApi.prototype.getUserName = function(callback) {
        var me = this;
        me.apiCall('getProfiles', { uids:me.userId.toString(), fields:'nickname, screen_name' }, function(err, data) {
            if(!err && data.response) {
                var uname = data.response[0];
                if(uname.nickname) {
                    uname = uname.nickname;
                } else if(uname.screen_name) {
                    uname = uname.screen_name;
                } else {
                    uname = uname.first_name + (uname.last_name || uname.first_name ? ' ' : '') + uname.last_name;
                }
                cbk(callback, uname);
            } else {
                cbk(callback, new Error('Error getting profile info'));
            }
        });
    };
    VKApi.prototype.searchSongs = function(artist, title, callback) {
        var me = this;
        me.apiCall('audio.search', { q:artist + ' - ' + title, count:10 }, function(err, data) {
            if(!err && data.response !== undefined) {
                data.response.shift();
                cbk(callback, data.response);
            } else {
                cbk(callback, new Error('Error gettings mp3s list from VK'));
            }
        });
    };

    app.classes.VKApi = VKApi;

})(MusicPlayer);