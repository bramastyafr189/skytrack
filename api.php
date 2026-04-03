<?php
// Izinkan akses jika dibutuhkan
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Setel User-Agent agar tidak diblokir dasar oleh penyedia
$options = [
    "http" => [
        "header" => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n" .
                    "Accept: application/json, text/javascript, */*; q=0.01\r\n" .
                    "Referer: https://www.flightradar24.com/data/statistics\r\n" .
                    "Cache-Control: no-cache\r\n"
    ]
];
$context = stream_context_create($options);

// Tambahkan param acak agar melewati sistem cache (Cloudflare)
$url = 'https://www.flightradar24.com/flights/most-tracked?_cb=' . time();
$result = file_get_contents($url, false, $context);

if ($result === FALSE) {
    http_response_code(500);
    echo json_encode(["error" => "Gagal mengambil data dari Flightradar24"]);
} else {
    echo $result;
}
?>
