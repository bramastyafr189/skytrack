<?php
require_once 'node_helper.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$cacheFile = 'cache/cache_global_stats.json';
$cacheTime = 300; // 5 minutes

if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTime)) {
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
