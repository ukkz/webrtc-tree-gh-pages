'use strict'

const CUSTOM_SERVICE_UUID = "2fb65514-1a38-4597-bf63-590e175a262f";
const CHARACTERISTIC_UUID = "1b68902e-da10-40d8-a58f-c68da82c3021";
let dev = false; // BluetoothRemoteGATTDevice？かな？
let ble = false; // BluetoothRemoteGATTCharacteristicオブジェクト
let ledOff = true; // 全消灯かそうでないか

// コマンド送信先切り替え
// 表示だけ切り替えて、あとは実際に送信の直前に参照
$('#command_send_to').on('click', () => {
  if ($('#command_send_to').text() == 'LOCAL') {
    $('#command_send_to').text('PEERS');
  } else {
    $('#command_send_to').text('LOCAL');
  }
});

// ツリー送信&状態管理
function sendToLocalTree(code) {
  if (code == 'X0') {
    // 全消灯
    if (!ledOff) { // 連続で送らないようにするための処理
      if (ble) ble.writeValue((new TextEncoder).encode('X0')); // 送信
      $('.tree_state').hide();
      ledOff = true;
    }
  } else {
    // その他
    // codeは A0,A1,B0,B1,C0,C1 のみ
    if (ble) ble.writeValue((new TextEncoder).encode(code)); // 送信
    if (ledOff) $('.tree_state').show(); // 消灯->点灯のときのみ
    ledOff = false;
  }
}

// BLEデバイス検出
function getBleDevice(jqObj) {
  jqObj.text('Device select...');
  navigator.bluetooth.requestDevice({
    acceptAllDevices:true,
    optionalServices:[CUSTOM_SERVICE_UUID]
  }).then(device => {
    // 接続します
    jqObj.text('Connecting...');
    console.log('Name:      ' + device.name);
    console.log('Id:        ' + device.id);
    console.log('Connected: ' + device.gatt.connected);
    dev = device;
    return device.gatt.connect();
  }).then(server =>{
    // サービスの指定
    jqObj.text('Service searching...');
    console.log('-> getPrimaryService() ..');
    return server.getPrimaryService(CUSTOM_SERVICE_UUID);
  }).then(service =>{
    // キャラクタリスティックの指定
    jqObj.text('Characteristic searching...');
    console.log('-> getCharacteristic() ..');
    return service.getCharacteristic(CHARACTERISTIC_UUID);
  }).then(characteristic => {
    // ここまできたら接続はOK
    jqObj.text('Disconnect'); // 開始ボタンの文字列を変更
    $('#ble_dev_name').text(dev.name); // デバイス名
    console.log(characteristic);
    ble = characteristic;
    sendToLocalTree('X0'); // リセット送信
    return characteristic;
  }).catch(error => {
    console.log('[Error] ' + error);
    if (!device.gatt.connected) jqObj.text('Failed');
    return false;
  });
}

// ボタンクリックで接続または切断
$('#btn_ble_ctrl').on('click', () => {
  if (ble) {
    // 接続済->切断
    sendToLocalTree('X0'); // リセット送信
    $('#btn_ble_ctrl').text('Connect'); // 次回接続用
    $('#ble_dev_name').text('none'); // 無しにする
    ble = false;
    dev.gatt.disconnect(); // 切断処理
  } else {
    // 未接続->接続
    getBleDevice($('#btn_ble_ctrl'));
  }
});
