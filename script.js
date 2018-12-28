'use strict'

let posX; // マウスX座標
let posY; // マウスY座標

$(function() {
  // Peer object
  const peer = new Peer({
    key:   "e91a15d8-c4ec-40de-a9c1-547f2a3b32d3",
    debug: 3,
  });

  let localStream;
  let room;
  peer.on('open', () => {
    $('#my-id').text(peer.id);
    // Get things started
    step1();
  });

  peer.on('error', err => {
    alert(err.message);
    // Return to step 2 if error occurs
    step2();
  });

  $('#make-call').on('submit', e => {
    e.preventDefault();
    // Initiate a call!
    const roomName = $('#join-room').val();
    if (!roomName) {
      return;
    }
    room = peer.joinRoom('mesh_multi_' + roomName, {stream: localStream});

    $('#room-id').text(roomName);
    step3(room);
  });

  $('#end-call').on('click', () => {
    $('#chatbox-'+room.name).hide() // 切断時にチャットボックスを隠す
    room.close();
    step2();
  });

  // Retry if getUserMedia fails
  $('#step1-retry').on('click', () => {
    $('#step1-error').hide();
    step1();
  });

  // set up audio and video input selectors
  const audioSelect = $('#audioSource');
  const videoSelect = $('#videoSource');
  const selectors = [audioSelect, videoSelect];

  navigator.mediaDevices.enumerateDevices()
    .then(deviceInfos => {
      const values = selectors.map(select => select.val() || '');
      selectors.forEach(select => {
        const children = select.children(':first');
        while (children.length) {
          select.remove(children);
        }
      });

      for (let i = 0; i !== deviceInfos.length; ++i) {
        const deviceInfo = deviceInfos[i];
        const option = $('<option>').val(deviceInfo.deviceId);

        if (deviceInfo.kind === 'audioinput') {
          option.text(deviceInfo.label ||
            'Microphone ' + (audioSelect.children().length + 1));
          audioSelect.append(option);
        } else if (deviceInfo.kind === 'videoinput') {
          option.text(deviceInfo.label ||
            'Camera ' + (videoSelect.children().length + 1));
          videoSelect.append(option);
        }
      }

      selectors.forEach((select, selectorIndex) => {
        if (Array.prototype.slice.call(select.children()).some(n => {
            return n.value === values[selectorIndex];
          })) {
          select.val(values[selectorIndex]);
        }
      });

      videoSelect.on('change', step1);
      audioSelect.on('change', step1);
    });

  function step1() {
    // Get audio/video stream
    const audioSource = $('#audioSource').val();
    const videoSource = $('#videoSource').val();
    const constraints = {
      audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
      video: {deviceId: videoSource ? {exact: videoSource} : undefined},
    };
    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
      $('#my-video').get(0).srcObject = stream;
      localStream = stream;

      if (room) {
        room.replaceStream(stream);
        return;
      }

      step2();
    }).catch(err => {
      $('#step1-error').show();
      console.error(err);
    });
  }

  function step2() {
    $('#their-videos').empty();
    $('#step1, #step3').hide();
    $('#step2').show();
    $('#join-room').focus();
  }

  function step3(room) {
    // chatboxを追加する
    const chatbox = $('<div></div>').addClass('chatbox').attr('id', 'chatbox-'+room.name);
    const header = $('<h4></h4>').html('Room: <strong>' + room.name + '</strong>');
    const messages = $('<div><em>Peer connected.</em></div>').addClass('messages');
    chatbox.append(header);
    chatbox.append(messages);
    $('#chatframe').append(chatbox);

    // メッセージ送信部分
    $('#sendtextform').on('submit', e => {
      e.preventDefault(); // form送信を抑制
      const msg = $('#mymessage').val();
      // ルームに送って自分のところにも反映
      room.send(msg);
      // 自分が送ったコマンドは表示されないようにする
      if (msg.substring(0,8) != 'COMMAND_') messages.prepend('<div><span class="you">You: </span>' + msg + '</div>');
      $('#mymessage').val('');
    });

    // チャットとかファイルが飛んできたらdataでonになる
    // ここではファイルは使わないのでもとのサンプルのif文はけしておく
    room.on('data', message => {
      if (message.data.substring(0,8) == 'COMMAND_') {
        // COMMAND_ で始まるメッセージはコマンド扱い
        // ツリー操作に利用する
        sendToLocalTree(message.data.substring(8)); // コマンド部分のみ送る
      } else {
        // ふつうのメッセージ
        messages.prepend('<div><span class="peer">' + message.src.substr(0,8) + '</span>: ' + message.data + '</div>');
      }
    });

    room.on('peerJoin', peerId => {
      messages.prepend('<div><span class="peer">' + peerId.substr(0,8) + '</span>: has joined the room </div>');
    });

    room.on('peerLeave', peerId => {
      messages.prepend('<div><span class="peer">' + peerId.substr(0,8) + '</span>: has left the room </div>');
    });

    // streamが飛んできたら相手の画面を追加する
    room.on('stream', stream => {
      const peerId = stream.peerId;
      const id = 'video_' + peerId + '_' + stream.id.replace('{', '').replace('}', '');

      $('#their-videos').append($(
        '<div class="video_' + peerId +'" id="' + id + '">' +
          '<label>' + stream.peerId + ':' + stream.id + '</label>' +
          '<video class="remoteVideos" autoplay playsinline>' +
        '</div>'));
      const el = $('#' + id).find('video').get(0);
      el.srcObject = stream;
      el.play();
    });

    room.on('removeStream', function(stream) {
      const peerId = stream.peerId;
      $('#video_' + peerId + '_' + stream.id.replace('{', '').replace('}', '')).remove();
    });

    // UI stuff
    room.on('close', step2);
    room.on('peerLeave', peerId => {
      $('.video_' + peerId).remove();
    });
    $('#step1, #step2').hide();
    $('#step3').show();
  }

  // 送信先切り替え用
  function sendCommandWithSwitch(code) {
    // ボタンの文字列を参照してLOCALかPEERSで切り替える
    if ($('#command_send_to').text() == 'LOCAL') {
      // LOCALのとき:通常コマンドを使う
      sendToLocalTree(code);
    } else {
      // PEERSのとき:コマンド用の接頭辞をつけて送信する
      room.send('COMMAND_' + code);
    }
  }

  // マウス位置取得
  $(window).mousemove(function() {
    // 差分取得
    var diffX = posX-event.clientX;
    var diffY = posY-event.clientY;
    var moving = diffX * diffY;

    // Aチャンネル
    if (diffX >= 50)
      sendCommandWithSwitch('A0');
    else if (diffX <= -50)
      sendCommandWithSwitch('A1');

    // Bチャンネル
    if (diffY >= 50)
      sendCommandWithSwitch('B0');
    else if (diffY <= -50)
      sendCommandWithSwitch('B1');

    // Cチャンネル
    if (moving >= 150)
      sendCommandWithSwitch('C0');
    else if (moving <= -150)
      sendCommandWithSwitch('C1');
    else
      sendCommandWithSwitch('X0');

    // ブラウザ側の表示を更新
    $('#mouse_x_diff').val(diffX);
    $('#mouse_y_diff').val(diffY);
    $('#mouse_x').val(event.clientX);
    $('#mouse_y').val(event.clientY);
    $('#mouse_moving').val(moving);
    posX = event.clientX;
    posY = event.clientY;
  });

});
