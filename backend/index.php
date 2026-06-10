<?php
/**
 * Clínica Asklepion - API Gateway
 * Main entry point for all API requests
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Simple router
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/clinica-asklepion/backend/', '', $path);
$path = trim($path, '/');

// Route to appropriate API
if (strpos($path, 'api/auth') !== false) {
    require __DIR__ . '/api/auth.php';
} elseif (strpos($path, 'api/appointments') !== false) {
    require __DIR__ . '/api/appointments.php';
} elseif (strpos($path, 'api/doctors') !== false) {
    require __DIR__ . '/api/doctors.php';
} else {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'Endpoint não encontrado.'
    ]);
}
