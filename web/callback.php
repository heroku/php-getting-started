<?php
  // アカウント情報を設定します。
  // LINE developers サイトの Channels > Basic informationに
  // 記載されている情報を設定します。
  $channelId = "1472511387"; // Channel ID
  $channelSecret = "88c820e418cbbc4c4bfdabd8b34a68c5"; // Channel Secret
  $mid = "uea36db9825d510cf43e105efbfe7d1a0"; // MID

  // LINEから送信されたメッセージ（POSTリクエストのボディ部分）を取得します。
  // 以下のようなJSONフォーマットの文字列が送信されます。
  // {"result":[
  //   {
  //     ・・・
  //     "content": {
  //       "contentType":1,
  //       "from":"uff2aec188e58752ee1fb0f9507c6529a",
  //       "text":"Hello, BOT API Server!"
  //       ・・・
  //     }
  //   },
  //   ・・・
  // ]}
  $requestBodyString = file_get_contents('php://input');
  $requestBodyObject = json_decode($requestBodyString);
  $requestContent = $requestBodyObject->result{0}->content;
  $requestText = $requestContent->text; // ユーザから送信されたテキスト
  $requestFrom = $requestContent->from; // 送信ユーザのMID
  $contentType = $requestContent->contentType; // データ種別（1はテキスト）

  // LINE BOT API へのリクエストのヘッダ
  $headers = array(
    "Content-Type: application/json; charset=UTF-8",
    "X-Line-ChannelID: {$channelId}", // Channel ID
    "X-Line-ChannelSecret: {$channelSecret}", // Channel Secret
    "X-Line-Trusted-User-With-ACL: {$mid}", // MID
  );

  // ユーザに返すテキスト。
  $responseText = <<< EOM
「{$requestText}」ですね。
EOM;

  // LINE BOT API 経由でユーザに渡すことになるJSONデータを作成。
  // to にはレスポンス先ユーザの MID を配列の形で指定。
  // toChannel、eventTypeは固定の数値・文字列を指定。
  // contentType は、テキストを返す場合は 1。
  // toType は、ユーザへのレスポンスの場合は 1。
  // text には、ユーザに返すテキストを指定。
  $responseMessage = <<< EOM
    {
      "to":["{$requestFrom}"],
      "toChannel":1383378250,
      "eventType":"138311608800106203",
      "content":{
        "contentType":1,
        "toType":1,
        "text":"{$responseText}"
      }
    }
EOM;

  // LINE BOT API へのリクエストを作成して実行
  $curl = curl_init('https://trialbot-api.line.me/v1/events');
  curl_setopt($curl, CURLOPT_POST, true);
  curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
  curl_setopt($curl, CURLOPT_POSTFIELDS, $responseMessage);
  curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
  // Heroku Addon の Fixie のプロキシURLを指定。詳細は後述。 
  curl_setopt($curl, CURLOPT_HTTPPROXYTUNNEL, 1);
  curl_setopt($curl, CURLOPT_PROXY, getenv('FIXIE_URL'));
  $output = curl_exec($curl);
