<?php
require_once 'node_helper.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Naikkan limit waktu eksekusi PHP (Default 30s seringkali tidak cukup untuk Puppeteer)
set_time_limit(60);

$cacheFile = 'cache/cache_tracked.json';
$cacheTime = 300; // 5 menit dalam detik
$forceRefresh = isset($_GET['force']) && $_GET['force'] == '1';

// Cek apakah cache masih valid
if (!$forceRefresh && file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTime)) {
    $cacheData = file_get_contents($cacheFile);
    if ($cacheData) {
        echo $cacheData;
        exit;
    }
}

// Jalankan Puppeteer Script jika cache tidak ada atau sudah usang
$nodePath = getNodePath();
$command = $nodePath . " scrape_tracked.js 2>&1"; 
$output = shell_exec($command);

if ($output === null) {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "PHP shell_exec failed to execute Node.js"]);
    exit;
}

$lines = explode("\n", trim($output));
$jsonString = "";

foreach ($lines as $line) {
    $line = trim($line);
    if ($line != "" && strpos($line, '{') === 0) {
        $jsonString = $line;
        break;
    }
}

if (empty($jsonString)) {
    echo json_encode(["success" => false, "error" => "Corrupted scraper output", "raw_output" => $output]);
} else {
    // Simpan ke cache jika sukses
    $data = json_decode($jsonString, true);
    if ($data && isset($data['success']) && $data['success']) {
        file_put_contents($cacheFile, $jsonString);
    }
    echo $jsonString;
}
?>
