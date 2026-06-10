<?php
/**
 * Utility functions for API responses and validation
 */

/**
 * Set JSON response header
 */
function setJsonHeader() {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
}

/**
 * Send JSON response
 */
function jsonResponse($success, $message = '', $data = null, $statusCode = 200) {
    http_response_code($statusCode);
    
    $response = [
        'success' => $success,
        'message' => $message,
    ];
    
    if ($data !== null) {
        $response['data'] = $data;
    }
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * Get JSON request data
 */
function getJsonData() {
    $input = file_get_contents('php://input');
    return json_decode($input, true);
}

/**
 * Validate CPF format
 */
function validateCpf($cpf) {
    $cpf = preg_replace('/\D/', '', $cpf);
    
    if (strlen($cpf) !== 11) {
        return false;
    }
    
    // Check if all digits are the same
    if (preg_match('/^(\d)\1{10}$/', $cpf)) {
        return false;
    }
    
    // Calculate first verification digit
    $sum = 0;
    for ($i = 0; $i < 9; $i++) {
        $sum += intval($cpf[$i]) * (10 - $i);
    }
    $firstDigit = 11 - ($sum % 11);
    $firstDigit = $firstDigit >= 10 ? 0 : $firstDigit;
    
    if (intval($cpf[9]) !== $firstDigit) {
        return false;
    }
    
    // Calculate second verification digit
    $sum = 0;
    for ($i = 0; $i < 10; $i++) {
        $sum += intval($cpf[$i]) * (11 - $i);
    }
    $secondDigit = 11 - ($sum % 11);
    $secondDigit = $secondDigit >= 10 ? 0 : $secondDigit;
    
    return intval($cpf[10]) === $secondDigit;
}

/**
 * Format CPF
 */
function formatCpf($cpf) {
    $cpf = preg_replace('/\D/', '', $cpf);
    return preg_replace('/(\d{3})(\d{3})(\d{3})(\d{2})/', '$1.$2.$3-$4', $cpf);
}

/**
 * Normalize CPF
 */
function normalizeCpf($cpf) {
    return preg_replace('/\D/', '', $cpf);
}

/**
 * Validate email format
 */
function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Validate password strength
 */
function validatePassword($password) {
    if (strlen($password) < 8) {
        return ['valid' => false, 'message' => 'A senha deve ter pelo menos 8 caracteres.'];
    }
    
    if (!preg_match('/[A-Za-z]/', $password)) {
        return ['valid' => false, 'message' => 'A senha deve conter letras.'];
    }
    
    if (!preg_match('/\d/', $password)) {
        return ['valid' => false, 'message' => 'A senha deve conter números.'];
    }
    
    return ['valid' => true];
}

/**
 * Hash password
 */
function hashPassword($password) {
    return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
}

/**
 * Verify password
 */
function verifyPassword($password, $hash) {
    return password_verify($password, $hash);
}

/**
 * Get authorization token from headers
 */
function getAuthToken() {
    $headers = getallheaders();
    
    if (isset($headers['Authorization'])) {
        $auth = $headers['Authorization'];
        if (preg_match('/Bearer\s+(.+)/', $auth, $matches)) {
            return $matches[1];
        }
    }
    
    return null;
}

/**
 * Generate JWT token
 */
function generateToken($userId, $userType, $secret = 'your-secret-key') {
    $header = base64_encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload = base64_encode(json_encode([
        'user_id' => $userId,
        'type' => $userType,
        'iat' => time(),
        'exp' => time() + (24 * 60 * 60) // 24 hours
    ]));
    
    $signature = base64_encode(hash_hmac('sha256', "$header.$payload", $secret, true));
    
    return "$header.$payload.$signature";
}

/**
 * Verify JWT token
 */
function verifyToken($token, $secret = 'your-secret-key') {
    $parts = explode('.', $token);
    
    if (count($parts) !== 3) {
        return null;
    }
    
    list($header, $payload, $signature) = $parts;
    
    $expectedSignature = base64_encode(hash_hmac('sha256', "$header.$payload", $secret, true));
    
    if (!hash_equals($signature, $expectedSignature)) {
        return null;
    }
    
    $decodedPayload = json_decode(base64_decode($payload), true);
    
    if ($decodedPayload['exp'] < time()) {
        return null;
    }
    
    return $decodedPayload;
}

/**
 * Get user from token
 */
function getUserFromToken() {
    $token = getAuthToken();
    
    if (!$token) {
        return null;
    }
    
    return verifyToken($token);
}

/**
 * Require authentication
 */
function requireAuth() {
    $user = getUserFromToken();
    
    if (!$user) {
        jsonResponse(false, 'Não autorizado.', null, 401);
    }
    
    return $user;
}

/**
 * Require specific user type
 */
function requireUserType($allowedTypes) {
    $user = requireAuth();
    
    if (!in_array($user['type'], $allowedTypes)) {
        jsonResponse(false, 'Acesso negado.', null, 403);
    }
    
    return $user;
}

/**
 * Sanitize input
 */
function sanitize($input) {
    if (is_array($input)) {
        return array_map('sanitize', $input);
    }
    
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}

/**
 * Check if request method is allowed
 */
function requireMethod($method) {
    if ($_SERVER['REQUEST_METHOD'] !== strtoupper($method)) {
        jsonResponse(false, "Método HTTP {$_SERVER['REQUEST_METHOD']} não permitido.", null, 405);
    }
}

/**
 * Get request data (GET or POST)
 */
function getRequestData() {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        return $_GET;
    }
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        
        if (strpos($contentType, 'application/json') !== false) {
            return getJsonData();
        }
        
        return $_POST;
    }
    
    return [];
}

/**
 * Format datetime for database
 */
function formatDatetime($datetime = null) {
    if ($datetime === null) {
        return date('Y-m-d H:i:s');
    }
    
    return date('Y-m-d H:i:s', strtotime($datetime));
}

/**
 * Format date for display
 */
function formatDateDisplay($date) {
    return date('d/m/Y', strtotime($date));
}

/**
 * Format time for display
 */
function formatTimeDisplay($time) {
    return date('H:i', strtotime($time));
}

/**
 * Get day of week in Portuguese
 */
function getDayOfWeek($date) {
    $days = [
        'Sunday' => 'Domingo',
        'Monday' => 'Segunda-feira',
        'Tuesday' => 'Terça-feira',
        'Wednesday' => 'Quarta-feira',
        'Thursday' => 'Quinta-feira',
        'Friday' => 'Sexta-feira',
        'Saturday' => 'Sábado'
    ];
    
    $englishDay = date('l', strtotime($date));
    return $days[$englishDay] ?? $englishDay;
}

/**
 * Log error
 */
function logError($message, $context = []) {
    $logFile = dirname(__DIR__) . '/logs/error.log';
    
    if (!is_dir(dirname($logFile))) {
        mkdir(dirname($logFile), 0755, true);
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $contextStr = !empty($context) ? ' | ' . json_encode($context) : '';
    $logMessage = "[$timestamp] $message$contextStr\n";
    
    file_put_contents($logFile, $logMessage, FILE_APPEND);
}
