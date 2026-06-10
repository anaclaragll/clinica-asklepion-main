(() => {
  const auth = window.AsklepionAuth;
  const user = auth.requireAuth(['recepcao', 'equipe']);
  if (!user) return;

  const logoutBtn = document.getElementById('logoutBtn');
  const teamAppointments = document.getElementById('teamAppointments');

  function renderAppointments() {
    teamAppointments.innerHTML = '';

    const items = auth.getAppointments().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Não há consultas agendadas ainda.';
      teamAppointments.appendChild(empty);
      return;
    }

    items.forEach((appointment) => {
      const card = document.createElement('article');
      card.className = 'appointment-item';

      const title = document.createElement('strong');
      title.textContent = `${appointment.pacienteNome} com ${appointment.medicoNome}`;
      const details = document.createElement('p');
      details.className = 'hint';
      details.textContent = `${appointment.day} às ${appointment.time}`;

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'btn';
      action.textContent = appointment.reminderSent ? 'Lembrete enviado' : 'Enviar lembrete';
      action.disabled = Boolean(appointment.reminderSent);
      action.addEventListener('click', () => {
        auth.updateAppointmentReminder(appointment.id);
        renderAppointments();
      });

      card.append(title, details, action);
      teamAppointments.appendChild(card);
    });
  }

  logoutBtn.addEventListener('click', () => {
    auth.clearSession();
    window.location.href = 'login.html';
  });

  renderAppointments();
})();
