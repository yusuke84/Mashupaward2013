/**
 * Created with JetBrains PhpStorm.
 * User: yusuke
 * Date: 13/10/26
 * Time: 18:21
 * To change this template use File | Settings | File Templates.
 */

var NCMBAPIKEY = '';
var NCMBCLIKEY = '';
var PEERJSAPIKEY = '';
var PEERSERVERHOST = '';

var translatorURL = '';

var peer;
var myPeerId;
var callhandl;
var connhandl;
var localStream;

var ClientObject;
var client;
var userList = [];
var timer;
var flag = {status: 'regist'};

var langselecter;

var recognition;

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia

// SpeechSynthesisオブジェクトを生成
var msgSpeech = new SpeechSynthesisUtterance();
msgSpeech.volume = 1; // 0 to 1
msgSpeech.rate = 1; // 0.1 to 10
msgSpeech.pitch = 2; //0 to 2
msgSpeech.lang = 'en-US';
msgSpeech.onend = function(e) {
    console.log('Finished in ' + event.elapsedTime + ' seconds.');
};

NCMB.initialize(NCMBAPIKEY, NCMBCLIKEY);
ClientObject = NCMB.Object.extend('client');

function getUserList(){

    var query_ = new NCMB.Query(ClientObject);

    query_.notEqualTo('peerId', myPeerId);
    query_.find({
        success: function(r) {
            // 成功
            for(var cnt = 0;cnt < r.length;cnt++){
                if($.inArray(r[cnt].get('peerName'),userList)<0){
                    userList.push(r[cnt].get('peerName'));
                    $('#userlist').append($('<option>', {"value":r[cnt].get('peerId'), "text":r[cnt].get('peerName')}));
                    $('#regist').attr('disabled', false);
                }
            }

        },
        error: function(error) {
            // エラー
            console.log(error);
        }
    });

}

function changeUI(){

    if(flag.status == "registered"){
        $("#regist").text("Call");
        if($('#userlist').length == 0) $('#regist').attr('disabled', true);
        $('#exit').attr('disabled', false);

    }else if(flag.status == "started"){
        $('#regist').attr('disabled', true);

    }else if(flag.status == "regist"){
        $("#regist").text("Start");
        $('#exit').attr('disabled', true);
    }

}

function finishVideoChat(){

    flag = {status: 'regist'};
    changeUI();
    if(callhandl != null){
        callhandl.close();
    }
    $('#myTelop').text('');
    //peer.disconnect();
    //peer.destroy();

}

function deleteClient(){

    client.destroy({
        success: function(client) {
            // 成功
            console.log("ユーザ情報削除");
        },
        error: function(client, error) {
            // エラー
            console.log("エラー:" + error);
        }
    })

    userList = [];
    $('#userlist').empty();

}

function speechStart(){

    recognition = new webkitSpeechRecognition();

    var isContinuous = true;
    var isInterimResults = true;
    var lang = langselecter.speech;

    recognition.lang = lang;
    recognition.continuous = isContinuous;
    recognition.interimResults = isInterimResults;
    recognition.start();

    recognition.onresult = function(event) {
        for(var i=event.resultIndex; i<event.results.length; i++){
            var result = event.results[i];
            if(result.isFinal && langselecter.transfrom != langselecter.transto){
                $.getJSON(translatorURL,{text: result[0].transcript,from: langselecter.transfrom,to: langselecter.transto},
                    function(json){
                        sendMesg(JSON.stringify($(json.translation).text()));
                    }
                );
            }else if(result.isFinal && langselecter.transfrom == langselecter.transto){
                sendMesg(JSON.stringify(result[0].transcript));
            }
            console.log('result[' + i + '] = ' + result[0].transcript);
            console.log('confidence = ' + result[0].confidence);
            console.log('is Final ? ' + result.isFinal);
        }
    }

    recognition.onend = function(){
        console.log('終了');
        var now = new Date().getTime();
        if(now-recognition.timer<1000){
            alert("Google Web Speech APIが異常動作しました。\n" + "同一ブラウザ複数タブでチャットを試みている場合は正常な挙動です。\n" + "それ以外の場合はブラウザを一度再起動してください。");
            speechStop();
            return;
        }
        speechStart();
        recognition.timer = now;
    }

}

function speechStop(){

    //recognition.stop();
    recognition.abort();

}

function str2binary(str, callback){
    var reader = new FileReader();
    reader.onload = function(e){
        callback(reader.result);
    };
    reader.readAsArrayBuffer(new Blob([str]));
}

function binary2str(message, callback){
    var reader = new FileReader();
    reader.onload = function(e){
        message.transcript = JSON.parse(reader.result);
        callback(message);
    };
    reader.readAsText(new Blob([message.transcript]));
}

function updateTelop(msg){
    binary2str(msg,function(data){
        console.log(data);
        $('#myTelop').text(data.transcript);
        msgSpeech.text = data.transcript;
        speechSynthesis.speak(msgSpeech);
    });
}

function speechlangselecter(mylang){
    switch (mylang){
        case 'ja-JP':
            langselecter = {speech: 'ja-JP',transfrom: 'ja',transto: null}
            break;
        case 'en-US':
            langselecter = {speech: 'en-US',transfrom: 'en',transto: null}
            break;
    }

}
function translangselecter(peerlang){
    switch (peerlang){
        case 'ja-JP':
            if(langselecter.speech == 'ja-JP'){
                //日本語➡日本語
                langselecter.transto = 'ja';
            }else if(langselecter.speech == 'en-US'){
                //英語➡日本語
                langselecter.transto = 'ja';
            }
            break;
        case 'en-US':
            if(langselecter.speech == 'ja-JP'){
                //日本語➡英語
                langselecter.transto = 'en';
            }else if(langselecter.speech == 'en-US'){
                //英語➡英語
                langselecter.transto = 'en';
            }
            break;
    }
}

function sendMesg(msg){

    console.log(msg);
    str2binary(msg,function(data){
        var message_ = {
            transcript: data
        }
        console.log(message_);
        connhandl.send(message_);
    });

}

$(document).ready(function(){


    //名前を入力したら登録ボタンが押下可能に
    $('#name').each(function(){
        $(this).bind('keyup', function(){
            if($('#name').val() != ''){
                $('#regist').attr('disabled', false);
            }else{
                $('#regist').attr('disabled', true);
            }
        })
    });

    //登録ボタン
    $('#regist').on('click',function(e){
        e.preventDefault();

        var query_ = new NCMB.Query(ClientObject);
        var results_ = null;

        speechlangselecter($('#langselecter').val());

        if(flag.status == 'regist'){

            query_.equalTo('peerName', $('#name').val());
            query_.find({
                success: function(r) {

                    results_ = r;
                    console.log(results_);

                    if(results_.length == 0){

                        client = new ClientObject();

                        peer = new Peer({
                            host: PEERSERVERHOST,
                            key: PEERJSAPIKEY,
                            secure: false,
                            debug: 3
                        });

                        peer.on('open', function(id) {

                            myPeerId = id;
                            console.log('MyPeerID',myPeerId);

                            client.set('peerId',myPeerId);
                            client.set('peerName',$('#name').val());
                            client.set('lang',langselecter.speech);

                            client.save(null, {
                                success: function(c) {
                                    // 保存完了後に実行される
                                    console.log("New object created with objectId: " + c.id);
                                },
                                error: function(c, error) {
                                    // エラー時に実行される
                                    console.log("Failed to create new object, with error code: " + error.description);
                                }
                            });

                        });

                    }else{

                        client = results_[0];
                        myPeerId = client.get('peerId');

                        console.log('MyPeerID',myPeerId);

                        results_[0].set('peerId',myPeerId);

                        results_[0].save(null, {
                            success: function(c) {
                                // 保存完了後に実行される
                                console.log("New object created with objectId: " + c.id);
                            },
                            error: function(c, error) {
                                // エラー時に実行される
                                console.log("Failed to create new object, with error code: " + error.description);
                            }
                        });

                        peer = new Peer(myPeerId,{
                            host: PEERSERVERHOST,
                            key: PEERJSAPIKEY,
                            secure: false,
                            debug: 3
                        });

                    }

                    //メディア取得
                    navigator.getUserMedia({audio: true, video: true}, function(stream){
                        // Set your video displays
                        $('#myVideo').prop('src', URL.createObjectURL(stream));

                        localStream = stream;

                    });

                    //着信時
                    peer.on('call', function(call){

                        callhandl = call;

                        var query_ = new NCMB.Query(ClientObject);

                            query_.equalTo('peerId', callhandl.peer);
                            query_.find({
                                success: function(r) {

                                    var peerclient_ = r[0];

                                    if(confirm(peerclient_.get('peerName') + "さんから、ビデオチャットを要求されています。応答しますか？")){

                                        translangselecter(peerclient_.get('lang'));

                                        callhandl.answer(localStream);
                                        callhandl.on('stream', function(stream){
                                            $('#remoteVideo').prop('src', URL.createObjectURL(stream));
                                            speechStart();
                                        });
                                        callhandl.on('close', function(){
                                            speechStop();
                                            deleteClient();
                                            finishVideoChat();
                                        });
                                        callhandl.on('error', function(){
                                            console.log(err.message);
                                            speechStop();
                                            deleteClient();
                                            finishVideoChat();
                                        });

                                        clearInterval(timer);

                                        flag = {status: 'started'};
                                        changeUI();

                                    }else{
                                        callhandl.close();

                                    }
                                },
                                error: function(error){
                                    console.log(error);
                                    callhandl.close();
                                }
                            });
                    });

                    peer.on('connection',function(conn) {

                        connhandl = conn;
                        console.log('データチャネル接続確立');

                        connhandl.on('data', function(msg) {
                            updateTelop(msg);

                        })

                        connhandl.on('close', function() {
                            console.log('データチャネルクローズ');
                        });

                        connhandl.on('error', function(err) {
                            console.log('データチャネルエラー：' + err);

                        });

                    });

                    peer.on('close', function(){
                        speechStop();
                        deleteClient();
                        finishVideoChat();

                    });

                    peer.on('error', function(err){
                        console.log(err.message);
                        speechStop();
                        deleteClient();
                        finishVideoChat();
                    });



                },
                error: function(error) {
                    // エラー
                    console.log(error);
                }
            });

            flag = {status: 'registered'};

            getUserList();
            timer = setInterval('getUserList()',5000);

        }else if(flag.status == 'registered'){

            connhandl = peer.connect($("#userlist").val(),
                {label:'controle',serialize:'binary',reliable:'true'});

            connhandl.on('data', function(msg) {
                updateTelop(msg);

            });

            callhandl = peer.call($("#userlist").val(),localStream);
            callhandl.on('stream', function(stream){

                var query_ = new NCMB.Query(ClientObject);

                query_.equalTo('peerId', $("#userlist").val());
                query_.find({
                    success: function(r) {
                        // 成功
                        translangselecter(r[0].get('lang'));
                    },
                    error: function(error) {
                        // エラー
                        console.log(error);
                    }
                });

                $('#remoteVideo').prop('src', URL.createObjectURL(stream));

                speechStart();
            });

            callhandl.on('close', function(){
                speechStop();
                deleteClient();
                finishVideoChat();
            });

            callhandl.on('error', function(){
                console.log(err.message);
                speechStop();
                deleteClient();
                finishVideoChat();
            });

            flag = {status: 'started'};
            clearInterval(timer);

        }

        changeUI();

    });


    //終了ボタン
    $('#exit').on('click',function(e){
        deleteClient();
        finishVideoChat();
        clearInterval(timer);

    });


})


