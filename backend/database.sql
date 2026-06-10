-- Clínica Asklepion Database Schema
-- Created for patient appointment management system

CREATE DATABASE IF NOT EXISTS clinica_asklepion;
USE clinica_asklepion;

-- Users Table (Pacientes, Médicos, Recepção)
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cpf VARCHAR(11) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  senha VARCHAR(255) NOT NULL,
  tipo ENUM('paciente', 'medico', 'recepcao') NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cpf (cpf),
  INDEX idx_tipo (tipo)
);

-- Doctors Table (Informações específicas de médicos)
CREATE TABLE medicos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  medico_id VARCHAR(100) NOT NULL UNIQUE,
  especialidade VARCHAR(255) NOT NULL,
  crm VARCHAR(50) NOT NULL UNIQUE,
  descricao TEXT,
  foto_url VARCHAR(255),
  ativo BOOLEAN DEFAULT TRUE,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_especialidade (especialidade)
);

-- Availability Table (Disponibilidade dos médicos)
CREATE TABLE disponibilidade (
  id INT PRIMARY KEY AUTO_INCREMENT,
  medico_id INT NOT NULL,
  dia_semana ENUM('Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo') NOT NULL,
  horarios JSON NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medico_id) REFERENCES medicos(id) ON DELETE CASCADE,
  UNIQUE KEY unique_medico_dia (medico_id, dia_semana)
);

-- Appointments Table (Consultas agendadas)
CREATE TABLE consultas (
  id INT PRIMARY KEY AUTO_INCREMENT,
  paciente_id INT NOT NULL,
  medico_id INT NOT NULL,
  data_agendamento DATE NOT NULL,
  hora_agendamento TIME NOT NULL,
  dia_semana VARCHAR(50),
  status ENUM('agendada', 'concluida', 'cancelada', 'ausente') DEFAULT 'agendada',
  motivo_cancelamento TEXT,
  notas_medico TEXT,
  lembrete_enviado BOOLEAN DEFAULT FALSE,
  data_lembrete TIMESTAMP NULL,
  data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (paciente_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (medico_id) REFERENCES medicos(id) ON DELETE CASCADE,
  INDEX idx_paciente (paciente_id),
  INDEX idx_medico (medico_id),
  INDEX idx_data (data_agendamento),
  INDEX idx_status (status),
  UNIQUE KEY unique_appointment (medico_id, data_agendamento, hora_agendamento)
);

-- Login History Table (Auditoria)
CREATE TABLE historico_login (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  data_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  sucesso BOOLEAN,
  motivo_falha VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_data (data_login)
);

-- Audit Log Table (Rastreamento de ações)
CREATE TABLE auditoria (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  acao VARCHAR(255) NOT NULL,
  tabela VARCHAR(100),
  registro_id INT,
  dados_anteriores JSON,
  dados_novos JSON,
  data_acao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_acao (acao),
  INDEX idx_data (data_acao)
);

-- Insert mock data
INSERT INTO users (cpf, nome, email, senha, tipo) VALUES
('12345678901', 'João da Silva', 'joao@example.com', SHA2('paciente123', 256), 'paciente'),
('22233344455', 'Dra. Sara Rodrigues', 'sara@example.com', SHA2('medico123', 256), 'medico'),
('99988877766', 'Fernanda Souza', 'fernanda@example.com', SHA2('recepcao123', 256), 'recepcao');

INSERT INTO medicos (user_id, medico_id, especialidade, crm, descricao) VALUES
(2, 'sara-rodrigues', 'Clínica Geral', 'CRM 123456', 'Olá! Vou te acompanhar para encontrar o melhor plano de cuidado para sua saúde.');

INSERT INTO disponibilidade (medico_id, dia_semana, horarios) VALUES
(1, 'Segunda-feira', '["08:00", "09:30", "14:00"]'),
(1, 'Quarta-feira', '["10:00", "11:30", "16:00"]'),
(1, 'Sexta-feira', '["09:00", "13:30", "15:30"]');
