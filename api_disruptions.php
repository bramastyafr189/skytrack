<?php
// Izinkan akses dari mana pun (proxy)
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Naikkan limit waktu eksekusi PHP (Min 60 detik untuk Puppeteer)
set_time_limit(60);

$cacheFile = 'cache_disruptions.json';
$cacheTime = 900; // 15 menit
$forceRefresh = isset($_GET['force']) && $_GET['force'] == '1';

if (!$forceRefresh && file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTime)) {
    $cacheData = file_get_contents($cacheFile);
    if ($cacheData) {
        echo $cacheData;
        exit;
    }
}

// Jalankan Puppeteer Script jika cache usang
$command = "node scrape_disruptions.js 2>&1"; 
$output = shell_exec($command);

// Jika terjadi error pada eksekusi bash
if ($output === null) {
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "error" => "PHP shell_exec failed to execute Node.js"
    ]);
    exit;
}

// Terkadang Puppeteer mencetak Peringatan Chromium ke stdout, kita harus menyaring JSON utamanya
$lines = explode("\n", trim($output));
$jsonString = "";

// Ambil baris terakhir atau cari baris yang dimulai dengan '{'
foreach ($lines as $line) {
    if (trim($line) != "" && strpos(trim($line), '{') === 0) {
        $jsonString = $line;
        break;
    }
}

// Jika gagal menemukan JSON dari Node scraper
if (empty($jsonString)) {
    echo json_encode([
        "success" => false,
        "error" => "Corrupted scraper output", 
        "raw_output" => $output
    ]);
} else {
    // Simpan ke cache jika sukses
    $data = json_decode($jsonString, true);
    if ($data && isset($data['success']) && $data['success']) {
        file_put_contents($cacheFile, $jsonString);
    }
    echo $jsonString;
}
?>
