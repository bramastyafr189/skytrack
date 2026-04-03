<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$iata = isset($_GET['iata']) ? preg_replace('/[^A-Z]/i', '', $_GET['iata']) : null;
$force = isset($_GET['force']) && $_GET['force'] == '1';

if (!$iata) {
    echo json_encode(["success" => false, "error" => "IATA is required"]);
    exit;
}

$cacheFile = "cache_airport_" . strtoupper($iata) . ".json";
$cacheTime = 900; // 15 minutes cache for airport details

// Return cache if valid and not forced
if (!$force && file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTime)) {
    echo file_get_contents($cacheFile);
    exit;
}

// Trigger Puppeteer
set_time_limit(60);
$command = "node scrape_airport_details.js " . escapeshellarg($iata);
$output = shell_exec($command);

if ($output) {
    $data = json_decode($output, true);
    if ($data && $data['success']) {
        file_put_contents($cacheFile, $output);
    }
    echo $output;
} else {
    echo json_encode(["success" => false, "error" => "Failed to execute airport scraper"]);
}
