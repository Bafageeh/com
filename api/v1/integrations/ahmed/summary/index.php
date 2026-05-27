<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$target = 'https://com.pm.sa/api/integrations/ahmed/summary/';
$body = @file_get_contents($target);
if ($body === false) {
    http_response_code(502);
    echo json_encode(['message' => 'Unable to load COM Ahmed summary'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo $body;
