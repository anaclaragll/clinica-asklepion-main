<?php
header('Content-Type: application/json; charset=utf-8');

$root = dirname(__DIR__);
$dbPath = $root . DIRECTORY_SEPARATOR . 'db' . DIRECTORY_SEPARATOR . 'clinica.db';
if (!file_exists($dbPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'database not found']);
    exit;
}

try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

// Dev helper: show errors in responses to aid debugging (disable in production)
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

// Wrap routing in try/catch to return JSON error messages
try {

$method = $_SERVER['REQUEST_METHOD'];
// Smart path extraction: works for Apache subdirectory, PHP built-in server (router.php), etc.
if (isset($_SERVER['PATH_INFO']) && strpos($_SERVER['PATH_INFO'], '/api') === 0) {
    $path = $_SERVER['PATH_INFO'];
} else {
    $rawPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $pos = strpos($rawPath, '/api');
    $path = ($pos !== false) ? substr($rawPath, $pos) : '/' . ltrim($rawPath, '/');
}
$path = rtrim($path, '/') ?: '/api';

function json_out($data) { echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }

// routing
$parts = explode('/', ltrim($path,'/'));

if ($path === '/api/health' || $path === '/api') {
    json_out(['ok' => true]);
}

// simple debug route
if ($method === 'GET' && $path === '/api/debug') {
    $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    json_out(['ok' => true, 'dbPath' => $dbPath, 'tables' => $tables]);
}

// GET /api/doctors
if ($method === 'GET' && $path === '/api/doctors') {
    $stmt = $pdo->query("SELECT m.id, u.name as name, m.specialty, m.crm, m.bio, u.email, u.cpf FROM medicos m JOIN users u ON m.user_id = u.id");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    json_out($rows);
}

// POST /api/doctors -> cadastrar médico (cria usuário + medicos)
if ($method === 'POST' && $path === '/api/doctors') {
    $input = json_decode(file_get_contents('php://input'), true);
    $name = $input['name'] ?? null;
    $email = $input['email'] ?? null;
    $cpf = $input['cpf'] ?? null;
    $specialty = $input['specialty'] ?? null;
    $crm = $input['crm'] ?? null;
    $bio = $input['bio'] ?? null;
    $senha = isset($input['senha']) ? trim($input['senha']) : 'senha123';
    if (!$name || !$email) { http_response_code(400); json_out(['error' => 'missing name or email']); }
    $cleanCpf = $cpf ? preg_replace('/\D/', '', $cpf) : null;

    // create user
    $ins = $pdo->prepare('INSERT INTO users (name, email, password_hash, role, cpf) VALUES (?,?,?,?,?)');
    $ins->execute([$name, $email, $senha, 'doctor', $cleanCpf]);
    $userId = $pdo->lastInsertId();

    $ins2 = $pdo->prepare('INSERT INTO medicos (user_id, specialty, crm, bio) VALUES (?,?,?,?)');
    $ins2->execute([$userId, $specialty, $crm, $bio]);
    $medId = $pdo->lastInsertId();

    json_out(['ok' => true, 'id' => $medId, 'user_id' => $userId]);
}

// helper to generate slots
function timeAddMinutes($time, $minutes) {
    $dt = DateTime::createFromFormat('H:i', $time);
    if (!$dt) return null;
    $dt->modify("+{$minutes} minutes");
    return $dt->format('H:i');
}

function slotsForDoctor($pdo, $doctorId, $days = 14) {
    $now = new DateTime();
    $stmt = $pdo->prepare('SELECT weekday, start_time, end_time, slot_minutes FROM doctor_availability WHERE doctor_id = ?');
    $stmt->execute([$doctorId]);
    $avail = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $result = [];
    for ($i=0; $i < $days; $i++) {
        $d = (clone $now)->modify("+{$i} days");
        $wd = (int)$d->format('w'); // 0 Sun ... 6 Sat
        $matches = array_filter($avail, fn($a) => (int)$a['weekday'] === $wd);
        if (empty($matches)) continue;
        $dateIso = $d->format('Y-m-d');
        // get booked times for this date
        $s = $pdo->prepare("SELECT substr(scheduled_at,12,5) as time FROM appointments WHERE doctor_id = ? AND date(scheduled_at) = ?");
        $s->execute([$doctorId, $dateIso]);
        $booked = $s->fetchAll(PDO::FETCH_COLUMN, 0);

        $daySlots = [];
        foreach ($matches as $m) {
            $slotMin = (int)$m['slot_minutes'] ?: 30;
            $t = $m['start_time'];
            while (true) {
                $end = timeAddMinutes($t, $slotMin);
                if ($end === null) break;
                if ($end > $m['end_time']) break;
                if (!in_array($t, $booked)) $daySlots[] = $t;
                $t = $end;
            }
        }
        $daySlots = array_values(array_unique($daySlots));
        sort($daySlots);
        if (!empty($daySlots)) $result[] = ['date' => $dateIso, 'weekday' => $wd, 'slots' => $daySlots];
    }
    return $result;
}

// GET /api/doctor/{id}/slots
if ($method === 'GET' && preg_match('#^/api/doctor/(\d+)/slots$#', $path, $m)) {
    $doctorId = (int)$m[1];
    $days = isset($_GET['days']) ? min(30, (int)$_GET['days']) : 14;
    $slots = slotsForDoctor($pdo, $doctorId, $days);
    json_out($slots);
}

// POST /api/appointments
if ($method === 'POST' && $path === '/api/appointments') {
    $input = json_decode(file_get_contents('php://input'), true);
    $pacienteNome = $input['pacienteNome'] ?? null;
    $cpf = $input['cpf'] ?? null;
    $email = $input['email'] ?? '';
    $doctorId = isset($input['doctorId']) ? (int)$input['doctorId'] : null;
    $date = $input['date'] ?? null;
    $time = $input['time'] ?? null;
    if (!$pacienteNome || !$cpf || !$doctorId || !$date || !$time) {
        http_response_code(400); json_out(['error' => 'missing fields']);
    }
    $scheduled_at = "$date $time:00";
    // check slot
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM appointments WHERE doctor_id = ? AND scheduled_at = ?');
    $stmt->execute([$doctorId, $scheduled_at]);
    if ($stmt->fetchColumn() > 0) { http_response_code(409); json_out(['error' => 'slot_unavailable']); }
    // find or create user
    $u = $pdo->prepare('SELECT id FROM users WHERE cpf = ?');
    $u->execute([$cpf]);
    $userId = $u->fetchColumn();
    if (!$userId) {
        $emailToUse = $email ?: ($cpf . '@paciente.local');
        try {
            $ins = $pdo->prepare('INSERT INTO users (name, email, password_hash, role, cpf) VALUES (?,?,?,?,?)');
            $ins->execute([$pacienteNome, $emailToUse, 'no-password', 'patient', $cpf]);
            $userId = $pdo->lastInsertId();
        } catch (Exception $emailErr) {
            // E-mail já existe: tenta com e-mail baseado no CPF
            if (strpos($emailErr->getMessage(), 'UNIQUE') !== false) {
                $ins = $pdo->prepare('INSERT INTO users (name, email, password_hash, role, cpf) VALUES (?,?,?,?,?)');
                $ins->execute([$pacienteNome, $cpf . '@paciente.local', 'no-password', 'patient', $cpf]);
                $userId = $pdo->lastInsertId();
            } else {
                throw $emailErr;
            }
        }
    }
    $ins2 = $pdo->prepare('INSERT INTO appointments (patient_id, doctor_id, scheduled_at) VALUES (?,?,?)');
    $ins2->execute([$userId, $doctorId, $scheduled_at]);
    $apptId = $pdo->lastInsertId();
    $q = $pdo->prepare('SELECT a.id, u.name as pacienteNome, m.id as doctorId, u2.name as doctorName, a.scheduled_at FROM appointments a JOIN users u ON a.patient_id = u.id JOIN medicos m ON a.doctor_id = m.id JOIN users u2 ON m.user_id = u2.id WHERE a.id = ?');
    $q->execute([$apptId]);
    $appt = $q->fetch(PDO::FETCH_ASSOC);
    json_out(['ok' => true, 'appointment' => $appt]);
}

// GET /api/doctor/{id}/appointments
if ($method === 'GET' && preg_match('#^/api/doctor/(\d+)/appointments$#', $path, $m)) {
    $doctorId = (int)$m[1];
    $stmt = $pdo->prepare("SELECT a.id, a.scheduled_at, a.status, u.name as pacienteNome, u.cpf FROM appointments a JOIN users u ON a.patient_id = u.id JOIN medicos m ON a.doctor_id = m.id WHERE m.id = ? ORDER BY a.scheduled_at ASC");
    $stmt->execute([$doctorId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    json_out($rows);
}

// GET /api/doctor/{id}/availability
if ($method === 'GET' && preg_match('#^/api/doctor/(\d+)/availability$#', $path, $m)) {
    $doctorId = (int)$m[1];
    $stmt = $pdo->prepare('SELECT id, weekday, start_time, end_time, slot_minutes FROM doctor_availability WHERE doctor_id = ?');
    $stmt->execute([$doctorId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    json_out($rows);
}

// POST /api/doctor/{id}/availability
if ($method === 'POST' && preg_match('#^/api/doctor/(\d+)/availability$#', $path, $m)) {
    $doctorId = (int)$m[1];
    $input = json_decode(file_get_contents('php://input'), true);
    $weekday = isset($input['weekday']) ? (int)$input['weekday'] : null;
    $start_time = $input['start_time'] ?? null;
    $end_time = $input['end_time'] ?? null;
    $slot_minutes = isset($input['slot_minutes']) ? (int)$input['slot_minutes'] : 30;
    if ($weekday === null || !$start_time || !$end_time) { http_response_code(400); json_out(['error' => 'missing']); }
    $ins = $pdo->prepare('INSERT INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes) VALUES (?,?,?,?,?)');
    $ins->execute([$doctorId, $weekday, $start_time, $end_time, $slot_minutes]);
    json_out(['ok' => true, 'id' => $pdo->lastInsertId()]);
}

// DELETE /api/availability/{id}
if ($method === 'DELETE' && preg_match('#^/api/availability/(\d+)$#', $path, $m)) {
    $id = (int)$m[1];
    $del = $pdo->prepare('DELETE FROM doctor_availability WHERE id = ?');
    $del->execute([$id]);
    json_out(['ok' => true, 'changes' => $del->rowCount()]);
}

// DELETE /api/doctors/:id - remover medico
if ($method === 'DELETE' && preg_match('#^/api/doctors/(\d+)$#', $path, $m)) {
    $id = (int)$m[1];
    // busca user_id para deletar o usuario (cascade deleta medico, availability, appointments)
    $stmt = $pdo->prepare('SELECT user_id FROM medicos WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) { http_response_code(404); json_out(['error' => 'Medico nao encontrado.']); }
    $del = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $del->execute([$row['user_id']]);
    json_out(['ok' => true, 'changes' => $del->rowCount()]);
}

// POST /api/appointments/{id}/complete
if ($method === 'POST' && preg_match('#^/api/appointments/(\d+)/complete$#', $path, $m)) {
    $id = (int)$m[1];
    $upd = $pdo->prepare('UPDATE appointments SET status = ? WHERE id = ?');
    $upd->execute(['completed', $id]);
    $q = $pdo->prepare('SELECT a.id, a.scheduled_at, a.status, u.name as pacienteNome, u.cpf FROM appointments a JOIN users u ON a.patient_id = u.id WHERE a.id = ?');
    $q->execute([$id]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
    json_out(['ok' => true, 'appointment' => $row]);
}

// POST /api/auth/login - autenticar equipe via banco
if ($method === 'POST' && $path === '/api/auth/login') {
    $input = json_decode(file_get_contents('php://input'), true);
    $cpf = isset($input['cpf']) ? preg_replace('/\D/', '', $input['cpf']) : null;
    $senha = $input['senha'] ?? null;
    if (!$cpf || !$senha) { http_response_code(400); json_out(['error' => 'CPF e senha são obrigatórios.']); }
    $sql = 'SELECT u.id, u.name, u.email, u.cpf, u.role, m.id AS medicoId, m.specialty, m.crm
            FROM users u LEFT JOIN medicos m ON m.user_id = u.id
            WHERE u.cpf = ? AND u.password_hash = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$cpf, $senha]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) { http_response_code(401); json_out(['error' => 'CPF ou senha inválidos.']); }
    if ($row['role'] === 'patient') { http_response_code(403); json_out(['error' => 'Use o acesso de paciente.']); }
    json_out([
        'ok' => true,
        'user' => [
            'cpf' => $row['cpf'],
            'nome' => $row['name'],
            'email' => $row['email'] ?? '',
            'tipo' => $row['role'] === 'doctor' ? 'medico' : $row['role'],
            'medicoId' => $row['medicoId'] ?: null,
            'especialidade' => $row['specialty'] ?? '',
            'crm' => $row['crm'] ?? ''
        ]
    ]);
}

// GET /api/appointments - todas as consultas (equipe)
if ($method === 'GET' && $path === '/api/appointments') {
    $sql = 'SELECT a.id, a.scheduled_at, a.status, a.notes,
            u.name AS pacienteNome, u.cpf AS pacienteCpf,
            u2.name AS medicoNome, m.specialty, m.id AS doctorId
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            JOIN medicos m ON a.doctor_id = m.id
            JOIN users u2 ON m.user_id = u2.id
            ORDER BY a.scheduled_at DESC';
    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
    json_out($rows);
}

// GET /api/appointments/patient/:cpf
if ($method === 'GET' && preg_match('#^/api/appointments/patient/([^/]+)$#', $path, $m)) {
    $cpf = preg_replace('/\D/', '', $m[1]);
    $sql = 'SELECT a.id, a.scheduled_at, a.status, a.notes,
            u2.name AS doctorName, m.specialty, m.id AS doctorId
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            JOIN medicos m ON a.doctor_id = m.id
            JOIN users u2 ON m.user_id = u2.id
            WHERE u.cpf = ?
            ORDER BY a.scheduled_at DESC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$cpf]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    json_out($rows);
}

} catch (Exception $e) {
    http_response_code(500);
    json_out(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
}
