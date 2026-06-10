(() => {
  const auth = window.AsklepionAuth;
  const user = auth.requireAuth(['medico']);
  if (!user) return;

  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  const logoutBtn = document.getElementById('logoutBtn');
  const subtitle = document.getElementById('doctorSubtitle');
  const doctorProfile = document.getElementById('doctorProfile');
  const doctorAppointments = document.getElementById('doctorAppointments');

  function setActivePanel(targetId) {
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.target === targetId));
    panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
  }

  function renderAppointments() {
    doctorAppointments.innerHTML = '';
    const doctorId = user.medicoId;

    const items = auth
      .getAppointments()
      .filter((appointment) =>
        doctorId ? appointment.medicoId === doctorId : appointment.medicoNome === user.nome
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Sem consultas agendadas no momento.';
      doctorAppointments.appendChild(empty);
      return;
    }

    items.forEach((appointment) => {
      const card = document.createElement('article');
      card.className = 'appointment-item';

      const patient = document.createElement('strong');
      patient.textContent = appointment.pacienteNome;
      const details = document.createElement('p');
      details.className = 'hint';
      details.textContent = `${appointment.day} às ${appointment.time}`;

      card.append(patient, details);
      doctorAppointments.appendChild(card);
    });
  }

  subtitle.textContent = `Área médica • ${user.nome}`;
  doctorProfile.textContent = `${user.nome} (${user.especialidade || 'Especialidade não informada'}) • ${user.crm || 'CRM não informado'}`;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setActivePanel(tab.dataset.target));
  });

  logoutBtn.addEventListener('click', () => {
    auth.clearSession();
    window.location.href = 'login.html';
  });

  renderAppointments();
})();
