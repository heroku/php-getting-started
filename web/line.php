<?php

/**
 * Copyright 2016 LINE Corporation
 *
 * LINE Corporation licenses this file to you under the Apache License,
 * version 2.0 (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at:
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

require_once('LINEBotTiny.php');
require('pub.php');

$channelAccessToken = 'rOelhqt4xl4hX6WZORz3ehOWtlbUQx5LtZkBxoVsBfg9njkBvJ5GU8bPV9whPro/BkeIAzKE6G4CqPclN4BU4j3KL5Qkt1SUVrol1jQ1+K2M813spu8mUTHZJ9fD5m3ZvtL//Nn8fZfDOuEq3XIDGAdB04t89/1O/w1cDnyilFU=';
$channelSecret = 'd88c9cb9c8b9e622446dc07e579ba482';

$client = new LINEBotTiny($channelAccessToken, $channelSecret);
foreach ($client->parseEvents() as $event) {
    switch ($event['type']) {
        case 'message':
            $message = $event['message'];
            switch ($message['type']) {
                case 'text':

                    getMqttfromlineMsg($message['text']);
                    $mixmsg = '[BOT] > '. $message['text'];

                    $client->replyMessage(array(
                        'replyToken' => $event['replyToken'],
                        'messages' => array(
                            array(
                                'type' => 'text',
                                'text' => $mixmsg
                            )
                        )
                    ));
                    break;
                default:
                    error_log("Unsupporeted message type: " . $message['type']);
                    break;
            }
            break;
        default:
            error_log("Unsupporeted event type: " . $event['type']);
            break;
    }
};
?>
