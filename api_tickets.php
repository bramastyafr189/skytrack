<?php
require_once 'node_helper.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$origin = isset($_GET['origin']) ? preg_replace('/[^A-Z]/i', '', $_GET['origin']) : 'CGK';
$dest = isset($_GET['dest']) ? preg_replace('/[^A-Z]/i', '', $_GET['dest']) : 'SIN';
$date = isset($_GET['date']) ? preg_replace('/[^0-9\-]/', '', $_GET['date']) : date('Y-m-d', strtotime('+1 month'));

if (strlen($origin) !== 3 || strlen($dest) !== 3) {
    echo json_encode(["success" => false, "error" => "Invalid IATA codes"]);
    exit;
}

// Ensure date is not in the past
if (strtotime($date) < strtotime(date('Y-m-d'))) {
    echo json_encode(["success" => false, "error" => "Cannot search for past dates."]);
    exit;
}

$cacheKey = "tickets_{$origin}_{$dest}_{$date}.json";
$cacheTime = 3600; // 1 hour cache for exact search queries
$force = isset($_GET['force']) && $_GET['force'] === '1';

if (!$force && file_exists($cacheKey) && (time() - filemtime($cacheKey) < $cacheTime)) {
    echo file_get_contents($cacheKey);
    exit;
}

// Trigger Puppeteer
set_time_limit(90);
$nodePath = getNodePath();
$command = $nodePath . " scrape_tickets.js " . escapeshellarg($origin) . " " . escapeshellarg($dest) . " " . escapeshellarg($date);
$output = shell_exec($command);

if ($output) {
    $data = json_decode($output, true);
    if ($data && $data['success'] && !empty($data['data'])) {
        file_put_contents($cacheKey, $output);
    }
    echo $output;
} else {
    echo json_encode(["success" => false, "error" => "Failed to fetch ticket data"]);
}
