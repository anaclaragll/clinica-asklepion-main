(() => {
  const auth = window.AsklepionAuth;
  const user = auth.requireAuth(['paciente']);
  if (!user) return;

  let doctors = [];
  const API_BASE = window.AsklepionAuth.apiBase;

  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  const welcomeText = document.getElementById('welcomeText');
  const logoutBtn = document.getElementById('logoutBtn');

  const doctorList = document.getElementById('doctorList');
  const doctorShowcase = document.getElementById('doctorShowcase');

  const doctorDetailsCard = document.getElementById('doctorDetailsCard');
  const doctorDetails = document.getElementById('doctorDetails');
  const dayList = document.getElementById('dayList');

  const timeCard = document.getElementById('timeCard');
  const selectedDayText = document.getElementById('selectedDayText');
  const timeList = document.getElementById('timeList');

  const confirmCard = document.getElementById('confirmCard');
  const bookingSummary = document.getElementById('bookingSummary');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');

  const patientNameInput = document.getElementById('patientNameInput');
  const patientCpfInput = document.getElementById('patientCpfInput');
  const patientEmailInput = document.getElementById('patientEmailInput');

  const myAppointments = document.getElementById('myAppointments');
  const confirmationCard = document.getElementById('confirmationCard');

  const defaultState = { doctorId: null, day: null, time: null };
  let bookingState = { ...defaultState };

  function setActivePanel(targetId) {
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.target === targetId));
    panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
  }

  function doctorById(id) {
    return doctors.find((doctor) => String(doctor.id) === String(id)) || null;
  }

  function createDoctorCard(doctor, onClick, selected) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `doctor-card${selected ? ' selected' : ''}`;

    const title = document.createElement('strong');
    title.textContent = doctor.nome || doctor.name;
    const specialty = document.createElement('p');
    specialty.textContent = doctor.especialidade || doctor.specialty;

    button.append(title, specialty);
    button.addEventListener('click', onClick);
    return button;
  }

  function renderDoctorLists() {
    doctorList.innerHTML = '';
    doctorShowcase.innerHTML = '';

    doctors.forEach((doctor) => {
      const selected = String(doctor.id) === String(bookingState.doctorId);
      doctorList.appendChild(
        createDoctorCard(doctor, () => {
          bookingState = { ...bookingState, doctorId: doctor.id, day: null, time: null };
          fetchSlotsForDoctor(doctor.id).then(() => renderFlow());
        }, selected)
      );

      const showcaseCard = document.createElement('article');
      showcaseCard.className = 'doctor-card';

      const name = document.createElement('strong');
      name.textContent = doctor.nome || doctor.name;
      const specialty = document.createElement('p');
      specialty.textContent = doctor.especialidade || doctor.specialty;
      const days = document.createElement('p');
      days.className = 'hint';
      const info = doctor.descricao || doctor.bio || '';
      days.textContent = info;

      showcaseCard.append(name, specialty, days);
      doctorShowcase.appendChild(showcaseCard);
    });
  }

  function renderDays(doctor) {
    dayList.innerHTML = '';
    const slots = doctor._slots || [];
    slots.forEach((d) => {
      const label = `${d.date} (${d.weekday})`;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip${bookingState.day === d.date ? ' selected' : ''}`;
      chip.textContent = label;
      chip.addEventListener('click', () => {
        bookingState = { ...bookingState, day: d.date, time: null };
        renderFlow();
      });
      dayList.appendChild(chip);
    });
  }

  function renderTimes(doctor) {
    timeList.innerHTML = '';
    const slots = (doctor._slots || []).find(d => d.date === bookingState.day);
    selectedDayText.textContent = bookingState.day ? `Horários disponíveis para ${bookingState.day}:` : 'Selecione um dia para ver os horários disponíveis.';
    const times = slots ? slots.slots : [];
    times.forEach((time) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip${bookingState.time === time ? ' selected' : ''}`;
      chip.textContent = time;
      chip.addEventListener('click', () => {
        bookingState = { ...bookingState, time };
        renderFlow();
      });
      timeList.appendChild(chip);
    });
  }

  function renderFlow() {
    renderDoctorLists();
    const selectedDoctor = bookingState.doctorId ? doctorById(bookingState.doctorId) : null;

    if (selectedDoctor) {
      doctorDetailsCard.classList.remove('hidden');
      doctorDetails.innerHTML = '';
      const nameEl = document.createElement('strong');
      nameEl.textContent = selectedDoctor.nome || selectedDoctor.name;
      const specEl = document.createElement('p');
      specEl.textContent = selectedDoctor.especialidade || selectedDoctor.specialty;
      const bioEl = document.createElement('p');
      bioEl.className = 'hint';
      bioEl.textContent = selectedDoctor.descricao || '';
      doctorDetails.append(nameEl, specEl, bioEl);
      renderDays(selectedDoctor);
    } else {
      doctorDetailsCard.classList.add('hidden');
    }

    if (bookingState.day && selectedDoctor) {
      timeCard.classList.remove('hidden');
      renderTimes(selectedDoctor);
    } else {
      timeCard.classList.add('hidden');
    }

    if (bookingState.day && bookingState.time && selectedDoctor) {
      confirmCard.classList.remove('hidden');
      const doctorName = selectedDoctor.nome || selectedDoctor.name;
      const specialtyText = selectedDoctor.especialidade || selectedDoctor.specialty;
      bookingSummary.textContent = `${doctorName} (${specialtyText}) — ${bookingState.day} às ${bookingState.time}`;
      if (patientNameInput && !patientNameInput.value) patientNameInput.value = user.nome || '';
      if (patientCpfInput && !patientCpfInput.value) patientCpfInput.value = user.cpf || '';
    } else {
      confirmCard.classList.add('hidden');
    }
  }

  async function renderMyAppointments() {
    myAppointments.innerHTML = '';
    const cpf = String(user.cpf || '').replace(/\D/g, '');
    let items = [];
    try {
      const res = await fetch(`${API_BASE}/api/appointments/patient/${cpf}`);
      if (res.ok) {
        items = await res.json();
      }
    } catch (e) {
      console.warn('Erro ao buscar consultas do backend:', e);
    }
    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Você ainda não possui consultas agendadas.';
      myAppointments.appendChild(empty);
      return;
    }
    items.forEach((appointment) => {
      const statusModifier = { cancelled: 'appointment-item--cancelled', completed: 'appointment-item--completed' }[appointment.status] || '';
      const card = document.createElement('article');
      card.className = `appointment-item ${statusModifier}`;

      const title = document.createElement('strong');
      title.textContent = `${appointment.doctorName} • ${appointment.specialty}`;

      const details = document.createElement('p');
      details.className = 'hint';
      details.textContent = appointment.scheduled_at;

      const statusLabels = { scheduled: 'Agendada', completed: 'Concluída', cancelled: 'Cancelada' };
      const statusColors = { scheduled: '#1d4ed8', completed: '#065f46', cancelled: '#b91c1c' };
      const statusBg    = { scheduled: '#dbeafe', completed: '#d1fae5', cancelled: '#fee2e2' };
      const statusBadge = document.createElement('span');
      statusBadge.textContent = statusLabels[appointment.status] || appointment.status;
      statusBadge.style.cssText = `display:inline-block;padding:2px 10px;border-radius:999px;font-size:0.75rem;font-weight:700;background:${statusBg[appointment.status]||'#e5e7eb'};color:${statusColors[appointment.status]||'#374151'};margin-top:4px;`;

      card.append(title, details, statusBadge);

      if (appointment.status === 'cancelled') {
        const note = document.createElement('p');
        note.style.cssText = 'margin:6px 0 0;font-size:0.8rem;color:#b91c1c;font-weight:600;';
        note.textContent = '✕ Esta consulta foi cancelada';
        card.appendChild(note);
      }

      if (appointment.status === 'scheduled') {
        const actions = document.createElement('div');
        actions.className = 'btn-row';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-danger btn-sm';
        cancelBtn.textContent = '✕ Cancelar';
        cancelBtn.addEventListener('click', async () => {
          if (!confirm('Tem certeza que deseja cancelar esta consulta?')) return;
          const r = await fetch(`${API_BASE}/api/appointments/${appointment.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
          });
          if (!r.ok) return alert('Erro ao cancelar consulta.');
          await renderMyAppointments();
        });

        const rescheduleBtn = document.createElement('button');
        rescheduleBtn.type = 'button';
        rescheduleBtn.className = 'btn btn-sm';
        rescheduleBtn.textContent = '↺ Remarcar';
        rescheduleBtn.addEventListener('click', async () => {
          if (!confirm('Isso vai cancelar esta consulta para você escolher um novo horário. Deseja continuar?')) return;
          const r = await fetch(`${API_BASE}/api/appointments/${appointment.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' })
          });
          if (!r.ok) return alert('Erro ao cancelar para remarcar.');
          bookingState = { ...defaultState, doctorId: appointment.doctorId };
          await fetchSlotsForDoctor(appointment.doctorId);
          renderFlow();
          setActivePanel('agendamento');
        });

        actions.append(cancelBtn, rescheduleBtn);
        card.appendChild(actions);
      }

      myAppointments.appendChild(card);
    });
  }

  function showConfirmation(appointment) {
    confirmationCard.classList.remove('hidden');
    confirmationCard.innerHTML = '';
    const title = document.createElement('h2');
    title.textContent = 'Agendamento confirmado!';
    const client = document.createElement('p');
    client.textContent = `Paciente: ${appointment.pacienteNome}`;
    const doctor = document.createElement('p');
    doctor.textContent = `Médico: ${appointment.medicoNome}`;
    const specialty = document.createElement('p');
    specialty.textContent = `Especialidade: ${appointment.especialidade}`;
    const schedule = document.createElement('p');
    schedule.textContent = `${appointment.day} às ${appointment.time}`;
    const resetButton = document.createElement('button');
    resetButton.id = 'newBookingBtn';
    resetButton.className = 'btn';
    resetButton.type = 'button';
    resetButton.textContent = 'Novo agendamento';
    resetButton.addEventListener('click', () => {
      bookingState = { ...defaultState };
      confirmationCard.classList.add('hidden');
      setActivePanel('agendamento');
      renderFlow();
    });
    confirmationCard.append(title, client, doctor, specialty, schedule, resetButton);
  }

  function confirmBooking() {
    const selectedDoctor = doctorById(bookingState.doctorId);
    if (!selectedDoctor || !bookingState.day || !bookingState.time) return;
    const pacienteNome = (patientNameInput && patientNameInput.value) || user.nome;
    const pacienteCpf = (patientCpfInput && patientCpfInput.value) || user.cpf;
    const pacienteEmail = (patientEmailInput && patientEmailInput.value) || user.email || '';

    fetch(`${API_BASE}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pacienteNome, cpf: pacienteCpf, email: pacienteEmail, doctorId: selectedDoctor.id, date: bookingState.day, time: bookingState.time })
    }).then(async (r) => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert('Erro ao agendar: ' + (err.error || r.statusText));
        return;
      }
      showConfirmation({ pacienteNome, medicoNome: selectedDoctor.nome || selectedDoctor.name, especialidade: selectedDoctor.especialidade || selectedDoctor.specialty, day: bookingState.day, time: bookingState.time });
      setActivePanel('minhas-consultas');
      fetchSlotsForDoctor(selectedDoctor.id).then(() => renderMyAppointments());
    }).catch(e => alert('Erro na requisição: ' + e.message));
  }

  async function fetchSlotsForDoctor(doctorId) {
    try {
      const res = await fetch(`${API_BASE}/api/doctor/${doctorId}/slots?days=14`);
      if (!res.ok) return;
      const json = await res.json();
      const doc = doctorById(doctorId);
      if (doc) doc._slots = json.map(d => ({ date: d.date, weekday: d.weekday, slots: d.slots }));
    } catch (e) {
      console.warn('Erro ao buscar slots', e);
    }
  }

  welcomeText.textContent = `Olá, ${user.nome}`;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActivePanel(tab.dataset.target));
  });

  confirmBookingBtn.addEventListener('click', confirmBooking);

  logoutBtn.addEventListener('click', () => {
    auth.clearSession();
    window.location.href = 'login.html';
  });

  // initial load: fetch doctors from backend then render
  fetch(`${API_BASE}/api/doctors`).then(r => r.json()).then(data => {
    doctors = data.map(d => ({ id: d.id, name: d.name, nome: d.name, specialty: d.specialty, especialidade: d.specialty, descricao: d.bio || d.description }));
    renderMyAppointments();
    renderFlow();
  }).catch(() => {
    // fallback: keep existing empty list
    doctors = [];
    renderMyAppointments();
    renderFlow();
  });
})();
