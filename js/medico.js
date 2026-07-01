(() => {
  const auth = window.AsklepionAuth;
  const user = auth.requireAuth(['doctor','medico']);
  if (!user) return;

  const API_BASE = window.AsklepionAuth.apiBase;
  let doctorRecord = null;

  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  const logoutBtn = document.getElementById('logoutBtn');
  const subtitle = document.getElementById('doctorSubtitle');
  const doctorProfile = document.getElementById('doctorProfile');
  const doctorAppointments = document.getElementById('doctorAppointments');
  const availabilityList = document.getElementById('availabilityList');

  function setActivePanel(targetId) {
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.target === targetId));
    panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActivePanel(tab.dataset.target));
  });

  logoutBtn.addEventListener('click', () => {
    auth.clearSession();
    window.location.href = 'login.html';
  });

  subtitle.textContent = `Área médica • ${user.nome}`;
  doctorProfile.textContent = `${user.nome} (${user.especialidade || 'Especialidade não informada'}) • ${user.crm || 'CRM não informado'}`;

  async function findDoctorRecord() {
    const res = await fetch(`${API_BASE}/api/doctors`);
    if (!res.ok) throw new Error('Não foi possível obter médicos');
    const doctors = await res.json();
    const userCpf = String(user.cpf || '').replace(/\D/g, '');
    let me;
    // Preferir medicoId numérico da sessão (definido pelo login via API)
    if (user.medicoId && !isNaN(Number(user.medicoId))) {
      me = doctors.find(d => Number(d.id) === Number(user.medicoId));
    }
    if (!me) {
      me = doctors.find(d =>
        (userCpf && d.cpf && String(d.cpf).replace(/\D/g, '') === userCpf) ||
        (d.email && user.email && d.email === user.email) ||
        d.name === user.nome ||
        d.name === user.name
      );
    }
    if (!me) throw new Error('Registro do médico não encontrado. Verifique o cadastro.');
    doctorRecord = me;
    return me;
  }

  async function loadAppointments() {
    if (!doctorRecord) return;
    const res = await fetch(`${API_BASE}/api/doctor/${doctorRecord.id}/appointments`);
    if (!res.ok) { doctorAppointments.innerHTML = '<p class="hint">Erro ao carregar consultas.</p>'; return; }
    const rows = await res.json();
    doctorAppointments.innerHTML = '';
    if (rows.length === 0) { doctorAppointments.innerHTML = '<p class="hint">Sem consultas agendadas no momento.</p>'; return; }
    rows.forEach(row => {
      const statusModifier = { cancelled: 'appointment-item--cancelled', completed: 'appointment-item--completed' }[row.status] || '';
      const card = document.createElement('article');
      card.className = `appointment-item ${statusModifier}`;

      const patient = document.createElement('strong');
      patient.textContent = `${row.pacienteNome} • ${row.cpf}`;

      const details = document.createElement('p');
      details.className = 'hint';
      details.textContent = row.scheduled_at;

      const statusLabels = { scheduled: 'Agendada', completed: 'Concluída', cancelled: 'Cancelada' };
      const statusColors = { scheduled: '#1d4ed8', completed: '#065f46', cancelled: '#b91c1c' };
      const statusBg    = { scheduled: '#dbeafe', completed: '#d1fae5', cancelled: '#fee2e2' };
      const statusEl = document.createElement('span');
      statusEl.textContent = statusLabels[row.status] || row.status;
      statusEl.style.cssText = `display:inline-block;padding:2px 10px;border-radius:999px;font-size:0.75rem;font-weight:700;
        background:${statusBg[row.status]||'#e5e7eb'};color:${statusColors[row.status]||'#374151'};margin-top:4px;`;

      const cancelledNote = document.createElement('p');
      cancelledNote.style.cssText = 'margin:6px 0 0;font-size:0.78rem;color:#b91c1c;font-weight:600;display:' + (row.status === 'cancelled' ? 'block' : 'none');
      cancelledNote.textContent = '✕ Esta consulta foi cancelada';

      const actions = document.createElement('div');
      actions.className = 'btn-row';

      const completeBtn = document.createElement('button');
      completeBtn.className = 'btn btn-success btn-sm';
      completeBtn.type = 'button';
      completeBtn.textContent = '✓ Concluir';
      completeBtn.disabled = row.status !== 'scheduled';
      completeBtn.addEventListener('click', async () => {
        const r = await fetch(`${API_BASE}/api/appointments/${row.id}/complete`, { method: 'POST' });
        if (!r.ok) return alert('Erro ao concluir');
        await loadAppointments();
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-danger btn-sm';
      cancelBtn.type = 'button';
      cancelBtn.textContent = '✕ Cancelar';
      cancelBtn.disabled = row.status !== 'scheduled';
      cancelBtn.addEventListener('click', async () => {
        if (!confirm('Cancelar esta consulta?')) return;
        const r = await fetch(`${API_BASE}/api/appointments/${row.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' })
        });
        if (!r.ok) return alert('Erro ao cancelar');
        await loadAppointments();
      });

      actions.appendChild(completeBtn);
      actions.appendChild(cancelBtn);
      card.append(patient, details, statusEl, cancelledNote, actions);
      doctorAppointments.appendChild(card);
    });
  }

  async function loadAvailability() {
    if (!doctorRecord) return;
    const res = await fetch(`${API_BASE}/api/doctor/${doctorRecord.id}/availability`);
    if (!res.ok) { availabilityList.innerHTML = '<p class="hint">Erro ao carregar disponibilidade.</p>'; return; }
    const rows = await res.json();
    availabilityList.innerHTML = '';
    if (rows.length === 0) { availabilityList.innerHTML = '<p class="hint">Nenhuma entrada de disponibilidade.</p>'; return; }
    rows.forEach(r => {
      const item = document.createElement('div');
      item.className = 'availability-item';
      item.textContent = `Dia: ${r.weekday} — ${r.start_time} → ${r.end_time} (slot ${r.slot_minutes}min)`;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn';
      del.textContent = 'Remover';
      del.addEventListener('click', async () => {
        const d = await fetch(`${API_BASE}/api/availability/${r.id}`, { method: 'DELETE' });
        if (!d.ok) return alert('Erro ao remover');
        await loadAvailability();
      });
      item.appendChild(del);
      availabilityList.appendChild(item);
    });
  }

  document.getElementById('addAvailabilityBtn')?.addEventListener('click', async () => {
    if (!doctorRecord) return alert('Registro do médico não encontrado');
    const weekday = Number(document.getElementById('weekdaySelect').value);
    const start_time = document.getElementById('startTime').value;
    const end_time = document.getElementById('endTime').value;
    const slot_minutes = Number(document.getElementById('slotMinutes').value) || 30;
    if (!start_time || !end_time) return alert('Preencha início e fim');
    const res = await fetch(`${API_BASE}/api/doctor/${doctorRecord.id}/availability`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weekday, start_time, end_time, slot_minutes }) });
    if (!res.ok) return alert('Erro ao salvar disponibilidade');
    await loadAvailability();
  });

  (async () => {
    try {
      await findDoctorRecord();
      await loadAppointments();
      await loadAvailability();
    } catch (e) {
      console.error(e);
      doctorAppointments.innerHTML = `<p style="color:#b91c1c;font-weight:600;">⚠ Erro ao carregar consultas: ${e.message || 'verifique se o servidor está rodando.'}</p>`;
    }
  })();
})();
