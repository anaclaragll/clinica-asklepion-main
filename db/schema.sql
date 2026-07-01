PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    cpf TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'patient',
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    specialty TEXT,
    crm TEXT,
    bio TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    scheduled_at DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(patient_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(doctor_id) REFERENCES medicos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS doctor_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER NOT NULL,
    weekday INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    slot_minutes INTEGER NOT NULL DEFAULT 30,
    FOREIGN KEY(doctor_id) REFERENCES medicos(id) ON DELETE CASCADE
);

-- ============================================================
-- Administrador  (CPF: 000.000.000-01 | senha: admin123)
-- ============================================================
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, cpf, phone)
VALUES (1, 'Administrador', 'admin@asklepion.com', 'admin123', 'admin', '00000000001', '');

-- Paciente demo  (CPF: 123.456.789-01 | senha: paciente123)
INSERT OR IGNORE INTO users (name, email, password_hash, role, cpf, phone)
VALUES ('Joao da Silva', 'joao@asklepion.com', 'paciente123', 'patient', '12345678901', '+55 11 99999-0001');

-- ============================================================
-- 6 Medicos pre-cadastrados
-- ============================================================
INSERT OR IGNORE INTO users (name, email, password_hash, role, cpf, phone) VALUES
    ('Dra. Maria Santos',   'maria@asklepion.com',    'maria123',    'doctor', '10010010011', ''),
    ('Dr. Caio Mendes',     'caio@asklepion.com',     'caio123',     'doctor', '11111111111', ''),
    ('Dr. Renan Oliveira',  'renan@asklepion.com',    'renan123',    'doctor', '22222222222', ''),
    ('Dra. Izabela Costa',  'izabela@asklepion.com',  'izabela123',  'doctor', '33333333333', ''),
    ('Dra. Ana Clara Lima', 'anaclara@asklepion.com', 'anaclara123', 'doctor', '44444444444', ''),
    ('Dra. Sara Rodrigues', 'sara@asklepion.com',     'sara123',     'doctor', '55566677788', '');

-- Registros de medicos
INSERT OR IGNORE INTO medicos (user_id, specialty, crm, bio)
SELECT id, 'Cardiologia', 'CRM-10001', 'Cardiologista com 10 anos de experiencia. Referencia em doencas cardiovasculares.'
FROM users WHERE email = 'maria@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM medicos WHERE user_id = (SELECT id FROM users WHERE email = 'maria@asklepion.com'));

INSERT OR IGNORE INTO medicos (user_id, specialty, crm, bio)
SELECT id, 'Dermatologia', 'CRM-10002', 'Especialista em dermatologia clinica e estetica.'
FROM users WHERE email = 'caio@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM medicos WHERE user_id = (SELECT id FROM users WHERE email = 'caio@asklepion.com'));

INSERT OR IGNORE INTO medicos (user_id, specialty, crm, bio)
SELECT id, 'Ortopedia', 'CRM-10003', 'Ortopedista especializado em joelho e coluna vertebral.'
FROM users WHERE email = 'renan@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM medicos WHERE user_id = (SELECT id FROM users WHERE email = 'renan@asklepion.com'));

INSERT OR IGNORE INTO medicos (user_id, specialty, crm, bio)
SELECT id, 'Pediatria', 'CRM-10004', 'Pediatra com foco em desenvolvimento infantil e adolescente.'
FROM users WHERE email = 'izabela@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM medicos WHERE user_id = (SELECT id FROM users WHERE email = 'izabela@asklepion.com'));

INSERT OR IGNORE INTO medicos (user_id, specialty, crm, bio)
SELECT id, 'Endocrinologia', 'CRM-10005', 'Endocrinologista especializada em diabetes, tireoide e metabolismo.'
FROM users WHERE email = 'anaclara@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM medicos WHERE user_id = (SELECT id FROM users WHERE email = 'anaclara@asklepion.com'));

INSERT OR IGNORE INTO medicos (user_id, specialty, crm, bio)
SELECT id, 'Clinica Geral', 'CRM-10006', 'Medica de clinica geral com atendimento humanizado e integral.'
FROM users WHERE email = 'sara@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM medicos WHERE user_id = (SELECT id FROM users WHERE email = 'sara@asklepion.com'));

-- ============================================================
-- Disponibilidade dos medicos (slots de 30 min)
-- ============================================================
INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 1, '08:00', '12:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'maria@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 1);
INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 4, '14:00', '18:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'maria@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 4);

INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 2, '09:00', '12:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'caio@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 2);
INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 5, '14:00', '17:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'caio@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 5);

INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 1, '13:00', '17:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'renan@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 1);
INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 3, '08:00', '12:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'renan@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 3);

INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 2, '08:00', '12:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'izabela@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 2);
INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 4, '13:00', '17:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'izabela@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 4);

INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 3, '09:00', '12:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'anaclara@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 3);
INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 5, '13:00', '17:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'anaclara@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 5);

INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 1, '08:00', '12:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'sara@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 1);
INSERT OR IGNORE INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT m.id, 3, '14:00', '18:00', 30 FROM medicos m JOIN users u ON m.user_id = u.id WHERE u.email = 'sara@asklepion.com'
AND NOT EXISTS (SELECT 1 FROM doctor_availability WHERE doctor_id = m.id AND weekday = 3);
