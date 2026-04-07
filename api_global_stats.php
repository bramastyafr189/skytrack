<?php
require_once 'node_helper.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$cacheFile = 'cache/cache_global_stats.json';
$cacheTime = 60; // Safe 1-minute server-side cache
$forceUpdate = isset($_GET['force']) && $_GET['force'] == '1';

if (!$forceUpdate && file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTime)) {
    echo file_get_contents($cacheFile);
    exit;
}

// Trigger Puppeteer
set_time_limit(90);
$nodePath = getNodePath();
$command = $nodePath . " scrape_global_stats.js";
$output = shell_exec($command);

if ($output) {
    $data = json_decode($output, true);
    if ($data && $data['success']) {
        file_put_contents($cacheFile, $output);
    }
    echo $output;
} else {
    echo json_encode(["success" => false, "error" => "Failed to fetch global stats"]);
}
