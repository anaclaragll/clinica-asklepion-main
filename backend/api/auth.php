<?php
/**
 * Authentication API
 * Handles login, signup, and session management
 */

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/utils.php';

setJsonHeader();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

$db = Database::getInstance();

/**
 * Handle preflight requests
 */
if ($method === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/**
 * LOGIN endpoint
 */
if ($action === 'login' && $method === 'POST') {
    $data = getJsonData() ?: getRequestData();
    
    $cpf = normalizeCpf($data['cpf'] ?? '');
    $password = $data['senha'] ?? '';
    $tipo = $data['tipo'] ?? 'paciente';
    
    if (empty($cpf) || empty($password)) {
        jsonResponse(false, 'CPF e senha são obrigatórios.', null, 400);
    }
    
    if (!validateCpf($cpf)) {
        $db->logLogin(null, false, 'CPF inválido');
        jsonResponse(false, 'CPF ou senha inválidos.', null, 401);
    }
    
    try {
        $user = $db->fetch(
            "SELECT id, cpf, nome, email, tipo, ativo FROM users WHERE cpf = ? AND tipo = ? LIMIT 1",
            [$cpf, $tipo]
        );
        
        if (!$user) {
            $db->logLogin(null, false, 'Usuário não encontrado');
            jsonResponse(false, 'CPF ou senha inválidos.', null, 401);
        }
        
        if (!$user['ativo']) {
            $db->logLogin($user['id'], false, 'Usuário inativo');
            jsonResponse(false, 'Usuário inativo.', null, 403);
        }
        
        // Verify password
        $storedPassword = $db->fetch(
            "SELECT senha FROM users WHERE id = ?",
            [$user['id']]
        );
        
        if (!verifyPassword($password, $storedPassword['senha'])) {
            $db->logLogin($user['id'], false, 'Senha inválida');
            jsonResponse(false, 'CPF ou senha inválidos.', null, 401);
        }
        
        // Get doctor info if applicable
        $doctorInfo = null;
        if ($user['tipo'] === 'medico') {
            $doctorInfo = $db->fetch(
                "SELECT medico_id, especialidade, crm FROM medicos WHERE user_id = ?",
                [$user['id']]
            );
        }
        
        $db->logLogin($user['id'], true);
        
        $token = generateToken($user['id'], $user['tipo']);
        
        $responseData = [
            'id' => $user['id'],
            'cpf' => $user['cpf'],
            'nome' => $user['nome'],
            'email' => $user['email'],
            'tipo' => $user['tipo'],
            'token' => $token
        ];
        
        if ($doctorInfo) {
            $responseData['medicoId'] = $doctorInfo['medico_id'];
            $responseData['especialidade'] = $doctorInfo['especialidade'];
            $responseData['crm'] = $doctorInfo['crm'];
        }
        
        jsonResponse(true, 'Login realizado com sucesso.', $responseData, 200);
        
    } catch (Exception $e) {
        logError('Login error', ['cpf' => $cpf, 'error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao realizar login.', null, 500);
    }
}

/**
 * SIGNUP endpoint
 */
if ($action === 'signup' && $method === 'POST') {
    $data = getJsonData() ?: getRequestData();
    
    $cpf = normalizeCpf($data['cpf'] ?? '');
    $nome = sanitize($data['nome'] ?? '');
    $email = sanitize($data['email'] ?? '') ?: null;
    $password = $data['senha'] ?? '';
    $tipo = $data['tipo'] ?? 'paciente';
    
    // Validation
    if (empty($cpf) || empty($nome) || empty($password)) {
        jsonResponse(false, 'CPF, nome e senha são obrigatórios.', null, 400);
    }
    
    if (!validateCpf($cpf)) {
        jsonResponse(false, 'CPF inválido.', null, 400);
    }
    
    if (strlen($nome) < 3) {
        jsonResponse(false, 'Nome deve ter pelo menos 3 caracteres.', null, 400);
    }
    
    $passwordValidation = validatePassword($password);
    if (!$passwordValidation['valid']) {
        jsonResponse(false, $passwordValidation['message'], null, 400);
    }
    
    if ($email && !validateEmail($email)) {
        jsonResponse(false, 'Email inválido.', null, 400);
    }
    
    try {
        // Check if CPF already exists
        $existing = $db->fetch("SELECT id FROM users WHERE cpf = ? LIMIT 1", [$cpf]);
        
        if ($existing) {
            jsonResponse(false, 'Já existe cadastro para este CPF.', null, 409);
        }
        
        // Hash password
        $hashedPassword = hashPassword($password);
        
        // Insert user
        $userData = [
            'cpf' => $cpf,
            'nome' => $nome,
            'email' => $email,
            'senha' => $hashedPassword,
            'tipo' => $tipo
        ];
        
        $userId = $db->insert('users', $userData);
        
        $db->logAudit($userId, 'CREATE', 'users', $userId, null, $userData);
        
        $user = $db->fetch(
            "SELECT id, cpf, nome, email, tipo FROM users WHERE id = ?",
            [$userId]
        );
        
        $token = generateToken($user['id'], $user['tipo']);
        
        $responseData = [
            'id' => $user['id'],
            'cpf' => $user['cpf'],
            'nome' => $user['nome'],
            'email' => $user['email'],
            'tipo' => $user['tipo'],
            'token' => $token
        ];
        
        jsonResponse(true, 'Cadastro realizado com sucesso.', $responseData, 201);
        
    } catch (Exception $e) {
        logError('Signup error', ['cpf' => $cpf, 'error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao realizar cadastro.', null, 500);
    }
}

/**
 * VERIFY TOKEN endpoint
 */
if ($action === 'verify' && $method === 'POST') {
    $token = getAuthToken();
    
    if (!$token) {
        jsonResponse(false, 'Token não fornecido.', null, 401);
    }
    
    $payload = verifyToken($token);
    
    if (!$payload) {
        jsonResponse(false, 'Token inválido ou expirado.', null, 401);
    }
    
    try {
        $user = $db->fetch(
            "SELECT id, cpf, nome, email, tipo, ativo FROM users WHERE id = ?",
            [$payload['user_id']]
        );
        
        if (!$user || !$user['ativo']) {
            jsonResponse(false, 'Usuário não encontrado ou inativo.', null, 401);
        }
        
        $responseData = [
            'id' => $user['id'],
            'cpf' => $user['cpf'],
            'nome' => $user['nome'],
            'email' => $user['email'],
            'tipo' => $user['tipo']
        ];
        
        jsonResponse(true, 'Token válido.', $responseData, 200);
        
    } catch (Exception $e) {
        logError('Token verify error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao verificar token.', null, 500);
    }
}

/**
 * Default response for unknown action
 */
jsonResponse(false, 'Ação não encontrada.', null, 404);
