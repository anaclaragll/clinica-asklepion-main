(() => {
  const auth = window.AsklepionAuth;
  const user = auth.requireAuth(['admin', 'recepcao']);
  if (!user) return;

  const API_BASE = auth.apiBase;
  const isAdmin = user.tipo === 'admin';

  const logoutBtn   = document.getElementById('logoutBtn');
  const subtitle    = document.getElementById('adminSubtitle');
  const tabs        = document.querySelectorAll('.tab');
  const panels      = document.querySelectorAll('.panel');
  const tabMedicos  = document.getElementById('tabMedicos');

  subtitle.textContent = `Painel Administrativo • ${user.nome}`;

  // Esconde aba de médicos se não for admin
  if (!isAdmin && tabMedicos) tabMedicos.style.display = 'none';

  function setActivePanel(id) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.target === id));
    panels.forEach(p => p.classList.toggle('active', p.id === id));
  }
  tabs.forEach(t => t.addEventListener('click', () => setActivePanel(t.dataset.target)));

  logoutBtn.addEventListener('click', () => {
    auth.clearSession();
    window.location.href = 'login.html';
  });

  // ─── CONSULTAS ────────────────────────────────────────────
  const teamAppointments = document.getElementById('teamAppointments');

  async function renderAppointments() {
    teamAppointments.innerHTML = '<p class="hint">Carregando consultas...</p>';
    let items = [];
    try {
      const res = await fetch(`${API_BASE}/api/appointments`);
      if (res.ok) items = await res.json();
    } catch (e) { console.warn('Erro ao buscar consultas:', e); }

    teamAppointments.innerHTML = '';
    if (items.length === 0) {
      teamAppointments.innerHTML = '<p class="hint">Nenhuma consulta agendada ainda.</p>';
      return;
    }
    items.forEach(a => {
      const card = document.createElement('article');
      const statusModifier = { cancelled: 'appt-card--cancelled', completed: 'appt-card--completed' }[a.status] || '';
      card.className = `appt-card ${statusModifier}`;
      const dt = a.scheduled_at ? a.scheduled_at.slice(0, 16).replace('T', ' ') : '—';
      const badgeClass = { completed: 'badge-completed', cancelled: 'badge-cancelled' }[a.status] || 'badge-scheduled';
      const statusLabel = { completed: 'Concluída', cancelled: '⚠ Cancelada', scheduled: 'Agendada' }[a.status] || a.status;
      const cancelledBanner = a.status === 'cancelled'
        ? `<p style="margin:4px 0 0;font-size:0.78rem;color:#b91c1c;font-weight:600;">✕ Esta consulta foi cancelada</p>` : '';
      card.innerHTML = `
        <div style="flex:1;min-width:0">
          <p class="appt-names" style="margin:0 0 3px">${a.pacienteNome} <span class="hint">com</span> ${a.medicoNome}</p>
          <p class="appt-meta" style="margin:0">${dt} · ${a.specialty || '—'} · CPF: ${a.pacienteCpf || '—'}</p>
          ${cancelledBanner}
        </div>
        <span class="badge ${badgeClass}" style="flex-shrink:0">${statusLabel}</span>
      `;
      const actions = document.createElement('div');
      actions.className = 'btn-row';
      actions.style.cssText = 'flex-shrink:0;margin-top:0;width:100%;';
      if (a.status !== 'completed') {
        const completeBtn = document.createElement('button');
        completeBtn.type = 'button';
        completeBtn.className = 'btn btn-success btn-sm';
        completeBtn.textContent = '✓ Concluir';
        completeBtn.addEventListener('click', async () => {
          const r = await fetch(`${API_BASE}/api/appointments/${a.id}/complete`, { method: 'POST' });
          if (!r.ok) return alert('Erro ao concluir');
          await renderAppointments();
        });
        actions.appendChild(completeBtn);
      }
      if (a.status !== 'cancelled') {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-danger btn-sm';
        cancelBtn.textContent = '✕ Cancelar';
        cancelBtn.addEventListener('click', async () => {
          if (!confirm('Cancelar esta consulta?')) return;
          const r = await fetch(`${API_BASE}/api/appointments/${a.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
          });
          if (!r.ok) return alert('Erro ao cancelar');
          await renderAppointments();
        });
        actions.appendChild(cancelBtn);
      }
      if (actions.children.length) card.appendChild(actions);
      teamAppointments.appendChild(card);
    });
  }

  // ─── MÉDICOS ──────────────────────────────────────────────
  const doctorListAdmin = document.getElementById('doctorListAdmin');
  const addDoctorForm   = document.getElementById('addDoctorForm');
  const addDoctorBtn    = document.getElementById('addDoctorBtn');
  const addDoctorResult = document.getElementById('addDoctorResult');
  const scheduleSlots   = document.getElementById('scheduleSlots');
  const addSlotBtn      = document.getElementById('addSlotBtn');

  const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function createSlotRow() {
    const div = document.createElement('div');
    div.className = 'slot-row';
    div.innerHTML = `
      <select class="slot-weekday">
        ${WEEKDAYS.map((d, i) => i === 0 ? '' : `<option value="${i}">${d}</option>`).join('')}
      </select>
      <input class="slot-start" type="time" value="08:00" />
      <span class="slot-sep">até</span>
      <input class="slot-end" type="time" value="12:00" />
      <select class="slot-dur">
        <option value="30">30 min</option>
        <option value="45">45 min</option>
        <option value="60">60 min</option>
      </select>
      <button type="button" class="btn btn-danger btn-sm">✕</button>
    `;
    div.querySelector('.btn-danger').addEventListener('click', () => div.remove());
    return div;
  }

  if (addSlotBtn) addSlotBtn.addEventListener('click', () => scheduleSlots.appendChild(createSlotRow()));

  async function renderDoctors() {
    if (!doctorListAdmin) return;
    doctorListAdmin.innerHTML = '<p class="hint">Carregando...</p>';
    let doctors = [];
    try {
      const res = await fetch(`${API_BASE}/api/doctors`);
      if (res.ok) doctors = await res.json();
    } catch (e) { console.warn('Erro ao buscar médicos:', e); }

    doctorListAdmin.innerHTML = '';
    if (doctors.length === 0) {
      doctorListAdmin.innerHTML = '<p class="hint">Nenhum médico cadastrado.</p>';
      return;
    }
    doctors.forEach(d => {
      const row = document.createElement('div');
      row.className = 'doctor-row';
      const initials = d.name.split(' ')
        .filter(w => /^[A-ZÀ-ÖØ-Ý]/u.test(w))
        .slice(0, 2).map(w => w[0].toUpperCase()).join('');
      row.innerHTML = `
        <div class="doctor-avatar" aria-hidden="true">${initials || '?'}</div>
        <div class="doctor-row-info">
          <strong>${d.name}</strong>
          ${d.specialty ? `<span class="specialty-badge">${d.specialty}</span>` : ''}<br>
          <small class="hint">${d.email}${d.crm ? ' · ' + d.crm : ''}${d.cpf ? ' · CPF ' + d.cpf : ''}</small>
        </div>
      `;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-danger btn-sm';
      btn.textContent = 'Remover';
      btn.addEventListener('click', async () => {
        if (!confirm(`Remover ${d.name}?\nIsso também removerá as consultas e disponibilidades associadas.`)) return;
        try {
          const r = await fetch(`${API_BASE}/api/doctors/${d.id}`, { method: 'DELETE' });
          const j = await r.json();
          if (!r.ok) { alert('Erro: ' + (j.error || 'Falha ao remover')); return; }
          await renderDoctors();
        } catch (e) { alert('Erro: ' + e.message); }
      });
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-sm';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', () => openEditDoctorModal(d));
      row.appendChild(editBtn);
      row.appendChild(btn);
      doctorListAdmin.appendChild(row);
    });
  }

  if (addDoctorBtn) {
    addDoctorBtn.addEventListener('click', async () => {
      addDoctorResult.textContent = '';
      addDoctorResult.className = 'form-message';
      const senha = document.getElementById('adSenha').value.trim();
      const confirmar = document.getElementById('adConfirmar').value.trim();
      if (!senha) { addDoctorResult.textContent = 'Informe uma senha.'; return; }
      if (senha !== confirmar) { addDoctorResult.textContent = 'As senhas não coincidem.'; return; }
      const payload = {
        name:      document.getElementById('adName').value.trim(),
        email:     document.getElementById('adEmail').value.trim(),
        cpf:       document.getElementById('adCpf').value.replace(/\D/g, ''),
        specialty: document.getElementById('adSpecialty').value.trim(),
        crm:       document.getElementById('adCrm').value.trim(),
        bio:       document.getElementById('adBio').value.trim(),
        senha
      };
      if (!payload.name || !payload.email) {
        addDoctorResult.textContent = 'Preencha nome e e-mail.';
        return;
      }
      addDoctorBtn.disabled = true;
      try {
        const r = await fetch(`${API_BASE}/api/doctors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const j = await r.json();
        if (!r.ok) {
          addDoctorResult.textContent = 'Erro: ' + (j.error || JSON.stringify(j));
          addDoctorResult.classList.add('error');
        } else {
          // Salvar horários de atendimento cadastrados no formulário
          if (scheduleSlots) {
            const slotRows = scheduleSlots.querySelectorAll('.slot-row');
            await Promise.allSettled([...slotRows].map(row =>
              fetch(`${API_BASE}/api/doctor/${j.id}/availability`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  weekday:      parseInt(row.querySelector('.slot-weekday').value),
                  start_time:   row.querySelector('.slot-start').value,
                  end_time:     row.querySelector('.slot-end').value,
                  slot_minutes: parseInt(row.querySelector('.slot-dur').value)
                })
              })
            ));
            scheduleSlots.innerHTML = '';
          }
          addDoctorResult.textContent = `${payload.name} cadastrado(a) com sucesso!`;
          addDoctorForm.reset();
          await renderDoctors();
        }
      } catch (e) {
        addDoctorResult.textContent = 'Erro: ' + e.message;
        addDoctorResult.classList.add('error');
      }
      addDoctorBtn.disabled = false;
    });
  }

  // ─── MODAL: Editar Médico ─────────────────────
  const editModal    = document.getElementById('editDoctorModal');
  const emName       = document.getElementById('emName');
  const emEmail      = document.getElementById('emEmail');
  const emSpecialty  = document.getElementById('emSpecialty');
  const emCrm        = document.getElementById('emCrm');
  const emBio        = document.getElementById('emBio');
  const editResult   = document.getElementById('editDoctorResult');
  let   editingDoctorId = null;

  function openEditDoctorModal(d) {
    editingDoctorId     = d.id;
    emName.value        = d.name        || '';
    emEmail.value       = d.email       || '';
    emSpecialty.value   = d.specialty   || '';
    emCrm.value         = d.crm         || '';
    emBio.value         = d.bio         || '';
    editResult.textContent = '';
    editResult.className   = 'form-message';
    editModal.classList.remove('hidden');
    emName.focus();
  }

  document.getElementById('editDoctorCancelBtn').addEventListener('click', () => {
    editModal.classList.add('hidden');
  });
  editModal.addEventListener('click', e => {
    if (e.target === editModal) editModal.classList.add('hidden');
  });

  document.getElementById('editDoctorSaveBtn').addEventListener('click', async () => {
    if (!editingDoctorId) return;
    editResult.textContent = '';
    const payload = {
      name:      emName.value.trim(),
      email:     emEmail.value.trim(),
      specialty: emSpecialty.value.trim(),
      crm:       emCrm.value.trim(),
      bio:       emBio.value.trim()
    };
    if (!payload.name || !payload.email) {
      editResult.textContent = 'Nome e e-mail são obrigatórios.';
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/api/doctors/${editingDoctorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (!r.ok) {
        editResult.textContent = 'Erro: ' + (j.error || 'Falha ao salvar');
        editResult.classList.add('error');
        return;
      }
      editModal.classList.add('hidden');
      await renderDoctors();
    } catch (e) {
      editResult.textContent = 'Erro: ' + e.message;
      editResult.classList.add('error');
    }
  });

  // ─── INIT ─────────────────────────────────────────────────
  renderAppointments();
  if (isAdmin) renderDoctors();
})();
