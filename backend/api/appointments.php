<?php
/**
 * Appointments API
 * Handles consultation booking, listing, and management
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
 * LIST appointments - GET /api/appointments.php?action=list
 */
if ($action === 'list' && $method === 'GET') {
    $user = requireAuth();
    
    try {
        $query = "SELECT 
                    c.id,
                    c.paciente_id,
                    c.medico_id,
                    c.data_agendamento,
                    c.hora_agendamento,
                    c.dia_semana,
                    c.status,
                    c.data_criacao,
                    u.nome as paciente_nome,
                    u.cpf as paciente_cpf,
                    m.user_id as medico_user_id,
                    mu.nome as medico_nome,
                    m.especialidade,
                    c.lembrete_enviado
                FROM consultas c
                JOIN users u ON c.paciente_id = u.id
                JOIN medicos m ON c.medico_id = m.id
                JOIN users mu ON m.user_id = mu.id
                WHERE 1=1";
        
        $params = [];
        
        // Filter by patient if user is paciente
        if ($user['type'] === 'paciente') {
            $query .= " AND c.paciente_id = ?";
            $params[] = $user['user_id'];
        }
        
        // Filter by doctor if user is medico
        if ($user['type'] === 'medico') {
            $query .= " AND c.medico_id IN (SELECT id FROM medicos WHERE user_id = ?)";
            $params[] = $user['user_id'];
        }
        
        $query .= " ORDER BY c.data_agendamento DESC, c.hora_agendamento DESC";
        
        $appointments = $db->fetchAll($query, $params);
        
        jsonResponse(true, 'Consultas listadas com sucesso.', $appointments, 200);
        
    } catch (Exception $e) {
        logError('List appointments error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao listar consultas.', null, 500);
    }
}

/**
 * CREATE appointment - POST /api/appointments.php?action=create
 */
if ($action === 'create' && $method === 'POST') {
    $user = requireUserType(['paciente']);
    
    $data = getJsonData() ?: getRequestData();
    
    $medico_id = $data['medico_id'] ?? null;
    $data_agendamento = $data['data_agendamento'] ?? null;
    $hora_agendamento = $data['hora_agendamento'] ?? null;
    $dia_semana = $data['dia_semana'] ?? null;
    
    if (!$medico_id || !$data_agendamento || !$hora_agendamento) {
        jsonResponse(false, 'Médico, data e horário são obrigatórios.', null, 400);
    }
    
    try {
        // Validate doctor exists
        $doctor = $db->fetch(
            "SELECT id FROM medicos WHERE id = ? LIMIT 1",
            [$medico_id]
        );
        
        if (!$doctor) {
            jsonResponse(false, 'Médico não encontrado.', null, 404);
        }
        
        // Check if appointment slot is available
        $existing = $db->fetch(
            "SELECT id FROM consultas WHERE medico_id = ? AND data_agendamento = ? AND hora_agendamento = ? AND status != 'cancelada' LIMIT 1",
            [$medico_id, $data_agendamento, $hora_agendamento]
        );
        
        if ($existing) {
            jsonResponse(false, 'Este horário já está reservado.', null, 409);
        }
        
        // Create appointment
        $appointmentData = [
            'paciente_id' => $user['user_id'],
            'medico_id' => $medico_id,
            'data_agendamento' => $data_agendamento,
            'hora_agendamento' => $hora_agendamento,
            'dia_semana' => $dia_semana,
            'status' => 'agendada'
        ];
        
        $appointmentId = $db->insert('consultas', $appointmentData);
        
        $db->logAudit($user['user_id'], 'CREATE', 'consultas', $appointmentId, null, $appointmentData);
        
        $appointment = $db->fetch(
            "SELECT 
                c.id,
                c.paciente_id,
                c.medico_id,
                c.data_agendamento,
                c.hora_agendamento,
                c.dia_semana,
                c.status,
                c.data_criacao,
                u.nome as paciente_nome,
                m.especialidade,
                mu.nome as medico_nome
            FROM consultas c
            JOIN users u ON c.paciente_id = u.id
            JOIN medicos m ON c.medico_id = m.id
            JOIN users mu ON m.user_id = mu.id
            WHERE c.id = ?",
            [$appointmentId]
        );
        
        jsonResponse(true, 'Consulta agendada com sucesso.', $appointment, 201);
        
    } catch (Exception $e) {
        logError('Create appointment error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao agendar consulta.', null, 500);
    }
}

/**
 * GET appointment details - GET /api/appointments.php?action=get&id=123
 */
if ($action === 'get' && $method === 'GET') {
    $user = requireAuth();
    
    $appointmentId = $_GET['id'] ?? null;
    
    if (!$appointmentId) {
        jsonResponse(false, 'ID da consulta é obrigatório.', null, 400);
    }
    
    try {
        $appointment = $db->fetch(
            "SELECT 
                c.id,
                c.paciente_id,
                c.medico_id,
                c.data_agendamento,
                c.hora_agendamento,
                c.dia_semana,
                c.status,
                c.notas_medico,
                c.data_criacao,
                u.nome as paciente_nome,
                u.cpf as paciente_cpf,
                m.especialidade,
                mu.nome as medico_nome
            FROM consultas c
            JOIN users u ON c.paciente_id = u.id
            JOIN medicos m ON c.medico_id = m.id
            JOIN users mu ON m.user_id = mu.id
            WHERE c.id = ?",
            [$appointmentId]
        );
        
        if (!$appointment) {
            jsonResponse(false, 'Consulta não encontrada.', null, 404);
        }
        
        // Check permissions
        if ($user['type'] === 'paciente' && $appointment['paciente_id'] != $user['user_id']) {
            jsonResponse(false, 'Acesso negado.', null, 403);
        }
        
        jsonResponse(true, 'Consulta encontrada.', $appointment, 200);
        
    } catch (Exception $e) {
        logError('Get appointment error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao obter consulta.', null, 500);
    }
}

/**
 * UPDATE appointment - PUT /api/appointments.php?action=update&id=123
 */
if ($action === 'update' && $method === 'PUT') {
    $user = requireAuth();
    
    $appointmentId = $_GET['id'] ?? null;
    
    if (!$appointmentId) {
        jsonResponse(false, 'ID da consulta é obrigatório.', null, 400);
    }
    
    $data = getJsonData() ?: getRequestData();
    
    try {
        $appointment = $db->fetch(
            "SELECT paciente_id, medico_id FROM consultas WHERE id = ?",
            [$appointmentId]
        );
        
        if (!$appointment) {
            jsonResponse(false, 'Consulta não encontrada.', null, 404);
        }
        
        // Check permissions
        if ($user['type'] === 'paciente' && $appointment['paciente_id'] != $user['user_id']) {
            jsonResponse(false, 'Acesso negado.', null, 403);
        }
        
        $updateData = [];
        
        if (isset($data['status'])) {
            $updateData['status'] = $data['status'];
        }
        
        if (isset($data['notas_medico'])) {
            $updateData['notas_medico'] = sanitize($data['notas_medico']);
        }
        
        if (isset($data['motivo_cancelamento'])) {
            $updateData['motivo_cancelamento'] = sanitize($data['motivo_cancelamento']);
        }
        
        if (empty($updateData)) {
            jsonResponse(false, 'Nenhum campo para atualizar.', null, 400);
        }
        
        $db->update('consultas', $updateData, 'id = ?', [$appointmentId]);
        
        $db->logAudit($user['user_id'], 'UPDATE', 'consultas', $appointmentId, $appointment, $updateData);
        
        $updated = $db->fetch(
            "SELECT 
                c.id,
                c.paciente_id,
                c.medico_id,
                c.data_agendamento,
                c.hora_agendamento,
                c.dia_semana,
                c.status,
                c.notas_medico,
                c.data_criacao
            FROM consultas c
            WHERE c.id = ?",
            [$appointmentId]
        );
        
        jsonResponse(true, 'Consulta atualizada com sucesso.', $updated, 200);
        
    } catch (Exception $e) {
        logError('Update appointment error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao atualizar consulta.', null, 500);
    }
}

/**
 * CANCEL appointment - DELETE /api/appointments.php?action=cancel&id=123
 */
if ($action === 'cancel' && $method === 'DELETE') {
    $user = requireAuth();
    
    $appointmentId = $_GET['id'] ?? null;
    
    if (!$appointmentId) {
        jsonResponse(false, 'ID da consulta é obrigatório.', null, 400);
    }
    
    $data = getJsonData() ?: getRequestData();
    $motivo = sanitize($data['motivo'] ?? '');
    
    try {
        $appointment = $db->fetch(
            "SELECT paciente_id, status FROM consultas WHERE id = ?",
            [$appointmentId]
        );
        
        if (!$appointment) {
            jsonResponse(false, 'Consulta não encontrada.', null, 404);
        }
        
        // Check permissions
        if ($user['type'] === 'paciente' && $appointment['paciente_id'] != $user['user_id']) {
            jsonResponse(false, 'Acesso negado.', null, 403);
        }
        
        if ($appointment['status'] === 'cancelada') {
            jsonResponse(false, 'Consulta já foi cancelada.', null, 409);
        }
        
        $updateData = [
            'status' => 'cancelada',
            'motivo_cancelamento' => $motivo
        ];
        
        $db->update('consultas', $updateData, 'id = ?', [$appointmentId]);
        
        $db->logAudit($user['user_id'], 'DELETE', 'consultas', $appointmentId, $appointment, $updateData);
        
        jsonResponse(true, 'Consulta cancelada com sucesso.', null, 200);
        
    } catch (Exception $e) {
        logError('Cancel appointment error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao cancelar consulta.', null, 500);
    }
}

/**
 * SEND REMINDER - POST /api/appointments.php?action=reminder&id=123
 */
if ($action === 'reminder' && $method === 'POST') {
    $user = requireUserType(['recepcao']);
    
    $appointmentId = $_GET['id'] ?? null;
    
    if (!$appointmentId) {
        jsonResponse(false, 'ID da consulta é obrigatório.', null, 400);
    }
    
    try {
        $appointment = $db->fetch(
            "SELECT lembrete_enviado FROM consultas WHERE id = ?",
            [$appointmentId]
        );
        
        if (!$appointment) {
            jsonResponse(false, 'Consulta não encontrada.', null, 404);
        }
        
        if ($appointment['lembrete_enviado']) {
            jsonResponse(false, 'Lembrete já foi enviado.', null, 409);
        }
        
        $updateData = [
            'lembrete_enviado' => true,
            'data_lembrete' => formatDatetime()
        ];
        
        $db->update('consultas', $updateData, 'id = ?', [$appointmentId]);
        
        $db->logAudit($user['user_id'], 'REMINDER_SENT', 'consultas', $appointmentId);
        
        jsonResponse(true, 'Lembrete enviado com sucesso.', null, 200);
        
    } catch (Exception $e) {
        logError('Send reminder error', ['error' => $e->getMessage()]);
        jsonResponse(false, 'Erro ao enviar lembrete.', null, 500);
    }
}

/**
 * Default response for unknown action
 */
jsonResponse(false, 'Ação não encontrada.', null, 404);
