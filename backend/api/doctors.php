<?php
/**
 * Doctors API
 * Handles doctor information, availability, and management
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
 * LIST all doctors - GET /api/doctors.php?action=list
 */
if ($action === 'list' && $method === 'GET') {
    try {
        $doctors = $db->fetchAll(
            "SELECT 
                m.id,
                m.user_id,
                m.medico_id,
                m.especialidade,
                m.crm,
                m.descricao,
                m.foto_url,
                u.nome,
                u.email,
                m.ativo
            FROM medicos m
            JOIN users u ON m.user_id = u.id
            WHERE m.ativo = TRUE
            ORDER BY u.nome ASC"
        );
        
        // Add availability for each doctor
        foreach ($doctors as &$doctor) {
            $availability = $db->fetchAll(
                "SELECT dia_semana, horarios FROM disponibilidade WHERE medico_id = ? AND ativo = TRUE",
                [$doctor['id']]
            );
            
            $doctor['disponibilidade'] = [];
            foreach ($availability as $av) {
                $doctor['disponibilidade'][$av['dia_semana']] = json_decode($av['horarios'], true);
            }
        }
        
        jsonResponse(true, 'Médicos listados com sucesso.', $doctors, 200);
        
    } catch (Exception $e) {
        logError('List doctors error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao listar médicos.', null, 500);
    }
}

/**
 * GET doctor details - GET /api/doctors.php?action=get&id=1
 */
if ($action === 'get' && $method === 'GET') {
    $doctorId = $_GET['id'] ?? null;
    
    if (!$doctorId) {
        jsonResponse(false, 'ID do médico é obrigatório.', null, 400);
    }
    
    try {
        $doctor = $db->fetch(
            "SELECT 
                m.id,
                m.user_id,
                m.medico_id,
                m.especialidade,
                m.crm,
                m.descricao,
                m.foto_url,
                u.nome,
                u.email
            FROM medicos m
            JOIN users u ON m.user_id = u.id
            WHERE m.id = ? AND m.ativo = TRUE LIMIT 1",
            [$doctorId]
        );
        
        if (!$doctor) {
            jsonResponse(false, 'Médico não encontrado.', null, 404);
        }
        
        // Get availability
        $availability = $db->fetchAll(
            "SELECT dia_semana, horarios FROM disponibilidade WHERE medico_id = ? AND ativo = TRUE",
            [$doctor['id']]
        );
        
        $doctor['disponibilidade'] = [];
        foreach ($availability as $av) {
            $doctor['disponibilidade'][$av['dia_semana']] = json_decode($av['horarios'], true);
        }
        
        jsonResponse(true, 'Médico encontrado.', $doctor, 200);
        
    } catch (Exception $e) {
        logError('Get doctor error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao obter médico.', null, 500);
    }
}

/**
 * GET doctor by medico_id - GET /api/doctors.php?action=getByMedicoId&medico_id=sara-rodrigues
 */
if ($action === 'getByMedicoId' && $method === 'GET') {
    $medicoId = $_GET['medico_id'] ?? null;
    
    if (!$medicoId) {
        jsonResponse(false, 'ID do médico é obrigatório.', null, 400);
    }
    
    try {
        $doctor = $db->fetch(
            "SELECT 
                m.id,
                m.user_id,
                m.medico_id,
                m.especialidade,
                m.crm,
                m.descricao,
                m.foto_url,
                u.nome,
                u.email
            FROM medicos m
            JOIN users u ON m.user_id = u.id
            WHERE m.medico_id = ? AND m.ativo = TRUE LIMIT 1",
            [$medicoId]
        );
        
        if (!$doctor) {
            jsonResponse(false, 'Médico não encontrado.', null, 404);
        }
        
        // Get availability
        $availability = $db->fetchAll(
            "SELECT dia_semana, horarios FROM disponibilidade WHERE medico_id = ? AND ativo = TRUE",
            [$doctor['id']]
        );
        
        $doctor['disponibilidade'] = [];
        foreach ($availability as $av) {
            $doctor['disponibilidade'][$av['dia_semana']] = json_decode($av['horarios'], true);
        }
        
        jsonResponse(true, 'Médico encontrado.', $doctor, 200);
        
    } catch (Exception $e) {
        logError('Get doctor by medico_id error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao obter médico.', null, 500);
    }
}

/**
 * LIST doctors by specialty - GET /api/doctors.php?action=bySpecialty&especialidade=Clínica%20Geral
 */
if ($action === 'bySpecialty' && $method === 'GET') {
    $especialidade = $_GET['especialidade'] ?? null;
    
    if (!$especialidade) {
        jsonResponse(false, 'Especialidade é obrigatória.', null, 400);
    }
    
    try {
        $doctors = $db->fetchAll(
            "SELECT 
                m.id,
                m.user_id,
                m.medico_id,
                m.especialidade,
                m.crm,
                m.descricao,
                m.foto_url,
                u.nome,
                u.email
            FROM medicos m
            JOIN users u ON m.user_id = u.id
            WHERE m.especialidade = ? AND m.ativo = TRUE
            ORDER BY u.nome ASC",
            [$especialidade]
        );
        
        // Add availability for each doctor
        foreach ($doctors as &$doctor) {
            $availability = $db->fetchAll(
                "SELECT dia_semana, horarios FROM disponibilidade WHERE medico_id = ? AND ativo = TRUE",
                [$doctor['id']]
            );
            
            $doctor['disponibilidade'] = [];
            foreach ($availability as $av) {
                $doctor['disponibilidade'][$av['dia_semana']] = json_decode($av['horarios'], true);
            }
        }
        
        jsonResponse(true, 'Médicos listados com sucesso.', $doctors, 200);
        
    } catch (Exception $e) {
        logError('List doctors by specialty error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao listar médicos.', null, 500);
    }
}

/**
 * GET available time slots - GET /api/doctors.php?action=availability&medico_id=1&data=2024-12-20
 */
if ($action === 'availability' && $method === 'GET') {
    $medicoId = $_GET['medico_id'] ?? null;
    $data = $_GET['data'] ?? null;
    
    if (!$medicoId || !$data) {
        jsonResponse(false, 'Médico e data são obrigatórios.', null, 400);
    }
    
    try {
        $dayOfWeek = getDayOfWeek($data);
        
        $availability = $db->fetch(
            "SELECT horarios FROM disponibilidade WHERE medico_id = ? AND dia_semana = ? AND ativo = TRUE",
            [$medicoId, $dayOfWeek]
        );
        
        if (!$availability) {
            jsonResponse(true, 'Nenhum horário disponível.', [], 200);
        }
        
        $allTimes = json_decode($availability['horarios'], true) ?: [];
        
        // Get booked appointments for this day
        $booked = $db->fetchAll(
            "SELECT hora_agendamento FROM consultas 
             WHERE medico_id = ? AND data_agendamento = ? AND status != 'cancelada'",
            [$medicoId, $data]
        );
        
        $bookedTimes = array_column($booked, 'hora_agendamento');
        
        // Filter available times
        $availableTimes = array_filter($allTimes, function($time) use ($bookedTimes) {
            return !in_array($time, $bookedTimes);
        });
        
        jsonResponse(true, 'Horários disponíveis.', array_values($availableTimes), 200);
        
    } catch (Exception $e) {
        logError('Get availability error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao obter horários disponíveis.', null, 500);
    }
}

/**
 * UPDATE doctor (admin only) - PUT /api/doctors.php?action=update&id=1
 */
if ($action === 'update' && $method === 'PUT') {
    $user = requireUserType(['medico']);
    
    $doctorId = $_GET['id'] ?? null;
    
    if (!$doctorId) {
        jsonResponse(false, 'ID do médico é obrigatório.', null, 400);
    }
    
    $data = getJsonData() ?: getRequestData();
    
    try {
        $doctor = $db->fetch(
            "SELECT user_id FROM medicos WHERE id = ?",
            [$doctorId]
        );
        
        if (!$doctor) {
            jsonResponse(false, 'Médico não encontrado.', null, 404);
        }
        
        // Check if user is updating their own profile
        if ($doctor['user_id'] != $user['user_id']) {
            jsonResponse(false, 'Acesso negado.', null, 403);
        }
        
        $updateData = [];
        
        if (isset($data['descricao'])) {
            $updateData['descricao'] = sanitize($data['descricao']);
        }
        
        if (isset($data['foto_url'])) {
            $updateData['foto_url'] = filter_var($data['foto_url'], FILTER_VALIDATE_URL);
        }
        
        if (empty($updateData)) {
            jsonResponse(false, 'Nenhum campo para atualizar.', null, 400);
        }
        
        $db->update('medicos', $updateData, 'id = ?', [$doctorId]);
        
        $db->logAudit($user['user_id'], 'UPDATE', 'medicos', $doctorId, $doctor, $updateData);
        
        jsonResponse(true, 'Médico atualizado com sucesso.', null, 200);
        
    } catch (Exception $e) {
        logError('Update doctor error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao atualizar médico.', null, 500);
    }
}

/**
 * Default response for unknown action
 */
jsonResponse(false, 'Ação não encontrada.', null, 404);
