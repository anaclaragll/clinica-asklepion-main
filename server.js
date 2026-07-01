const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'db', 'clinica.db');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

function openDb() {
  return new sqlite3.Database(DB_PATH);
}

function formatDateIso(d) {
  return d.toISOString().slice(0, 10);
}

function weekdayOfDate(d) {
  return d.getDay();
}

function pad(n) { return n.toString().padStart(2, '0'); }

function timeAddMinutes(time, minutes) {
  const [hh, mm] = time.split(':').map(Number);
  const date = new Date(1970,0,1,hh,mm);
  date.setMinutes(date.getMinutes() + minutes);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/doctors', (req, res) => {
  const db = openDb();
  const sql = `SELECT m.id, u.name AS name, m.specialty, m.crm, m.bio, u.email, u.cpf
               FROM medicos m
               JOIN users u ON m.user_id = u.id`;
  db.all(sql, [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ id: r.id, name: r.name, specialty: r.specialty, crm: r.crm, bio: r.bio, email: r.email, cpf: r.cpf })));
  });
});

// Return available slots for a doctor for the next `days` days (default 14)
app.get('/api/doctor/:id/slots', async (req, res) => {
  const doctorId = Number(req.params.id);
  const days = Math.min(30, Number(req.query.days) || 14);
  const db = openDb();

  db.all('SELECT weekday, start_time, end_time, slot_minutes, id FROM doctor_availability WHERE doctor_id = ?', [doctorId], (err, availRows) => {
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }

    const now = new Date();
    const result = [];

    const getAppointmentsForDate = (dateIso) => new Promise((resolve, reject) => {
      const sql = `SELECT scheduled_at FROM appointments WHERE doctor_id = ? AND date(scheduled_at) = ?`;
      db.all(sql, [doctorId, dateIso], (e, rows) => e ? reject(e) : resolve(rows.map(r => r.scheduled_at.slice(11,16))));
    });

    (async () => {
      for (let i = 0; i < days; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const wd = weekdayOfDate(d);
        // find availability entries matching weekday
        const matches = availRows.filter(a => a.weekday === wd);
        if (matches.length === 0) continue;
        const dateIso = formatDateIso(d);
        const booked = await getAppointmentsForDate(dateIso);
        const daySlots = [];
        for (const m of matches) {
          const slotMin = m.slot_minutes || 30;
          let t = m.start_time;
          while (true) {
            const end = timeAddMinutes(t, slotMin);
            // if end > m.end_time break
            if (end > m.end_time) break;
            // only include slots not in booked
            if (!booked.includes(t)) daySlots.push(t);
            t = end;
          }
        }
        if (daySlots.length > 0) {
          result.push({ date: dateIso, weekday: wd, slots: [...new Set(daySlots)].sort() });
        }
      }

      db.close();
      res.json(result);
    })().catch(err => { db.close(); res.status(500).json({ error: err.message }); });
  });
});

app.post('/api/appointments', (req, res) => {
  const { pacienteNome, cpf, email, doctorId, date, time } = req.body;
  if (!pacienteNome || !cpf || !doctorId || !date || !time) {
    return res.status(400).json({ error: 'missing fields' });
  }
  const scheduled_at = `${date} ${time}:00`;
  const db = openDb();
  db.get('SELECT COUNT(*) AS cnt FROM appointments WHERE doctor_id = ? AND scheduled_at = ?', [doctorId, scheduled_at], (err, row) => {
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }
    if (row.cnt > 0) { db.close(); return res.status(409).json({ error: 'slot_unavailable' }); }

    // find or create patient user by cpf
    db.get('SELECT id FROM users WHERE cpf = ?', [cpf], (e, userRow) => {
      if (e) { db.close(); return res.status(500).json({ error: e.message }); }
      const insertAppointment = (patientId) => {
        db.run('INSERT INTO appointments (patient_id, doctor_id, scheduled_at) VALUES (?,?,?)', [patientId, doctorId, scheduled_at], function(err2) {
          if (err2) { db.close(); return res.status(500).json({ error: err2.message }); }
          const appointmentId = this.lastID;
          db.get('SELECT a.id, u.name as pacienteNome, m.id as doctorId, u2.name as doctorName, a.scheduled_at FROM appointments a JOIN users u ON a.patient_id = u.id JOIN medicos m ON a.doctor_id = m.id JOIN users u2 ON m.user_id = u2.id WHERE a.id = ?', [appointmentId], (e3, appt) => {
            db.close();
            if (e3) return res.status(500).json({ error: e3.message });
            res.json({ ok: true, appointment: appt });
          });
        });
      };

      if (userRow) {
        insertAppointment(userRow.id);
      } else {
        // Insere usuário paciente; se o e-mail já existir, usa e-mail baseado no CPF como fallback
        const doInsert = (em) => {
          db.run('INSERT INTO users (name, email, password_hash, role, cpf) VALUES (?,?,?,?,?)', [pacienteNome, em, 'no-password', 'patient', cpf], function(err3) {
            if (err3) {
              if (err3.message.includes('UNIQUE') && err3.message.includes('email') && em !== `${cpf}@paciente.local`) {
                return doInsert(`${cpf}@paciente.local`);
              }
              db.close();
              return res.status(500).json({ error: err3.message });
            }
            insertAppointment(this.lastID);
          });
        };
        doInsert(email || `${cpf}@paciente.local`);
      }
    });
  });
});

app.get('/api/doctor/:id/appointments', (req, res) => {
  const doctorId = Number(req.params.id);
  const db = openDb();
  const sql = `SELECT a.id, a.scheduled_at, a.status, u.name as pacienteNome, u.cpf FROM appointments a JOIN users u ON a.patient_id = u.id JOIN medicos m ON a.doctor_id = m.id WHERE m.id = ? ORDER BY a.scheduled_at ASC`;
  db.all(sql, [doctorId], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/doctor/:id/availability', (req, res) => {
  const doctorId = Number(req.params.id);
  const { weekday, start_time, end_time, slot_minutes } = req.body;
  if (weekday === undefined || !start_time || !end_time) return res.status(400).json({ error: 'missing' });
  const db = openDb();
  db.run('INSERT INTO doctor_availability (doctor_id, weekday, start_time, end_time, slot_minutes) VALUES (?,?,?,?,?)', [doctorId, weekday, start_time, end_time, slot_minutes || 30], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, id: this.lastID });
  });
});

app.delete('/api/availability/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = openDb();
  db.run('DELETE FROM doctor_availability WHERE id = ?', [id], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, changes: this.changes });
  });
});

// Get availability entries for a doctor
app.get('/api/doctor/:id/availability', (req, res) => {
  const doctorId = Number(req.params.id);
  const db = openDb();
  db.all('SELECT id, weekday, start_time, end_time, slot_minutes FROM doctor_availability WHERE doctor_id = ?', [doctorId], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Mark appointment as completed
app.post('/api/appointments/:id/complete', (req, res) => {
  const id = Number(req.params.id);
  const db = openDb();
  db.run('UPDATE appointments SET status = ? WHERE id = ?', ['completed', id], function(err) {
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }
    db.get('SELECT a.id, a.scheduled_at, a.status, u.name as pacienteNome, u.cpf FROM appointments a JOIN users u ON a.patient_id = u.id WHERE a.id = ?', [id], (e, row) => {
      db.close();
      if (e) return res.status(500).json({ error: e.message });
      res.json({ ok: true, appointment: row });
    });
  });
});

// DELETE /api/doctors/:id - remover médico (cascata: user → medico → appointments + availability)
app.delete('/api/doctors/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = openDb();
  db.get('SELECT user_id FROM medicos WHERE id = ?', [id], (err, row) => {
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }
    if (!row) { db.close(); return res.status(404).json({ error: 'Médico não encontrado.' }); }
    db.run('DELETE FROM users WHERE id = ?', [row.user_id], function (err2) {
      db.close();
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ok: true, changes: this.changes });
    });
  });
});

// POST /api/doctors - cadastrar novo médico
app.post('/api/doctors', (req, res) => {
  const { name, email, cpf, specialty, crm, bio, senha } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
  const password = String(senha || '').trim() || 'senha123';
  const cleanCpf = cpf ? String(cpf).replace(/\D/g, '') : null;
  const db = openDb();
  db.run(
    'INSERT INTO users (name, email, cpf, password_hash, role) VALUES (?,?,?,?,?)',
    [name.trim(), email.trim(), cleanCpf || null, password, 'doctor'],
    function (err) {
      if (err) { db.close(); return res.status(500).json({ error: err.message }); }
      const userId = this.lastID;
      db.run(
        'INSERT INTO medicos (user_id, specialty, crm, bio) VALUES (?,?,?,?)',
        [userId, specialty || '', crm || '', bio || ''],
        function (err2) {
          db.close();
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ ok: true, id: this.lastID });
        }
      );
    }
  );
});

// POST /api/auth/login - autenticar usuário da equipe via banco
app.post('/api/auth/login', (req, res) => {
  const { cpf, senha } = req.body;
  if (!cpf || !senha) return res.status(400).json({ error: 'CPF e senha são obrigatórios.' });
  const normalizedCpf = String(cpf).replace(/\D/g, '');
  const db = openDb();
  const sql = `SELECT u.id, u.name, u.email, u.cpf, u.role,
               m.id AS medicoId, m.specialty, m.crm
               FROM users u
               LEFT JOIN medicos m ON m.user_id = u.id
               WHERE u.cpf = ? AND u.password_hash = ?`;
  db.get(sql, [normalizedCpf, String(senha)], (err, row) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'CPF ou senha inválidos.' });
    if (row.role === 'patient') return res.status(403).json({ error: 'Use o acesso de paciente.' });
    res.json({
      ok: true,
      user: {
        cpf: row.cpf,
        nome: row.name,
        email: row.email || '',
        tipo: row.role === 'doctor' ? 'medico' : row.role,
        medicoId: row.medicoId || null,
        especialidade: row.specialty || '',
        crm: row.crm || ''
      }
    });
  });
});

// GET /api/appointments - todas as consultas (para equipe)
app.get('/api/appointments', (req, res) => {
  const db = openDb();
  const sql = `SELECT a.id, a.scheduled_at, a.status, a.notes,
               u.name AS pacienteNome, u.cpf AS pacienteCpf,
               u2.name AS medicoNome, m.specialty, m.id AS doctorId
               FROM appointments a
               JOIN users u ON a.patient_id = u.id
               JOIN medicos m ON a.doctor_id = m.id
               JOIN users u2 ON m.user_id = u2.id
               ORDER BY a.scheduled_at DESC`;
  db.all(sql, [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/appointments/patient/:cpf - consultas de um paciente
app.get('/api/appointments/patient/:cpf', (req, res) => {
  const cpf = req.params.cpf.replace(/\D/g, '');
  const db = openDb();
  const sql = `SELECT a.id, a.scheduled_at, a.status, a.notes,
               u2.name AS doctorName, m.specialty, m.id AS doctorId
               FROM appointments a
               JOIN users u ON a.patient_id = u.id
               JOIN medicos m ON a.doctor_id = m.id
               JOIN users u2 ON m.user_id = u2.id
               WHERE u.cpf = ?
               ORDER BY a.scheduled_at DESC`;
  db.all(sql, [cpf], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// PATCH /api/appointments/:id — atualizar agendamento (remarcar data/hora ou status)
app.patch('/api/appointments/:id', (req, res) => {
  const id = Number(req.params.id);
  const { date, time, status } = req.body;
  const updates = [];
  const params = [];
  if (date && time) { updates.push('scheduled_at = ?'); params.push(`${date} ${time}:00`); }
  if (status)        { updates.push('status = ?');       params.push(status); }
  if (updates.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
  params.push(id);
  const db = openDb();
  db.run(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, changes: this.changes });
  });
});

// DELETE /api/appointments/:id — excluir agendamento
app.delete('/api/appointments/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = openDb();
  db.run('DELETE FROM appointments WHERE id = ?', [id], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, changes: this.changes });
  });
});

// PUT /api/doctors/:id — atualizar dados do médico
app.put('/api/doctors/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, email, specialty, crm, bio } = req.body;
  const db = openDb();
  db.get('SELECT user_id FROM medicos WHERE id = ?', [id], (err, row) => {
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }
    if (!row) { db.close(); return res.status(404).json({ error: 'Médico não encontrado.' }); }
    const userUpdates = [];
    const userParams = [];
    if (name)  { userUpdates.push('name = ?');  userParams.push(name.trim()); }
    if (email) { userUpdates.push('email = ?'); userParams.push(email.trim()); }
    const medicoUpdates = [];
    const medicoParams = [];
    if (specialty !== undefined) { medicoUpdates.push('specialty = ?'); medicoParams.push(specialty); }
    if (crm !== undefined)       { medicoUpdates.push('crm = ?');       medicoParams.push(crm); }
    if (bio !== undefined)       { medicoUpdates.push('bio = ?');       medicoParams.push(bio); }

    const doUser = () => new Promise((resolve, reject) => {
      if (!userUpdates.length) return resolve();
      db.run(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, [...userParams, row.user_id], e => e ? reject(e) : resolve());
    });
    const doMedico = () => new Promise((resolve, reject) => {
      if (!medicoUpdates.length) return resolve();
      db.run(`UPDATE medicos SET ${medicoUpdates.join(', ')} WHERE id = ?`, [...medicoParams, id], e => e ? reject(e) : resolve());
    });

    Promise.all([doUser(), doMedico()])
      .then(() => { db.close(); res.json({ ok: true }); })
      .catch(e  => { db.close(); res.status(500).json({ error: e.message }); });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Static files served from ${__dirname}`);
});
