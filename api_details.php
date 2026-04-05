<?php
require_once 'node_helper.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$callsign = isset($_GET['callsign']) ? preg_replace('/[^A-Z0-9]/i', '', $_GET['callsign']) : null;
$force = isset($_GET['force']) && $_GET['force'] == '1';

if (!$callsign) {
    echo json_encode(["success" => false, "error" => "Callsign is required"]);
    exit;
}

$cacheFile = "cache/cache_details_" . strtoupper($callsign) . ".json";
$cacheTime = 600; // 10 minutes cache for specific flight details

// Return cache if valid and not forced
if (!$force && file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTime)) {
    echo file_get_contents($cacheFile);
    exit;
}

// Trigger Puppeteer
set_time_limit(60);
$nodePath = getNodePath();
$command = $nodePath . " scrape_details.js " . escapeshellarg($callsign);
$output = shell_exec($command);

if ($output) {
    $data = json_decode($output, true);
    if ($data && $data['success']) {
        file_put_contents($cacheFile, $output);
    }
    echo $output;
} else {
    echo json_encode(["success" => false, "error" => "Failed to execute scraper"]);
}
